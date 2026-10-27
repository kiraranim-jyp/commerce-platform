import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-IMAGE-EVIDENCE-02 — **비교용 «정규화» 파생표현**(CPO GO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 판정하지 않는다.** threshold · score · SAME/DIFFERENT 가 **0** 이다.
 *    산출물은 「두 이미지를 같은 규격으로 환원한 표현」이고, 그것을 **무엇으로 읽을지는
 *    다음 WU(CPO)** 가 정한다.
 * ```
 * ❌ dHash threshold   ❌ color threshold   ❌ weighted score
 * ❌ IMAGE → SAME      ❌ IMAGE → DIFFERENT
 * 🟢 허용 — 원본을 훼손하지 않는 **파생 표현 생성** 과 그 **식별자**
 * ```
 *
 * ── 🔴🔴 왜 «정규화» 가 핵심인가 (IMAGE-EVIDENCE-01 실측) ────────────────────
 * ```
 * 같은 상품(C42 · human SAME)과 다른 상품(C20)을 원상품과 비교했더니 —
 *   trim 없이  C42 **26**  >  C20 **11**   🔴 **순서가 뒤집힌다**
 *   trim 적용  C42 **3**   ↔  C20 **17**   🟢 깨끗하게 갈린다
 * 원인은 판매처마다 **크롭 · 여백 · 종횡비** 가 다르기 때문이다
 * (원상품 1200x1200 ↔ main-story 3333x5000).
 * ⟹ 🔴 「pHash 를 쓰면 된다」가 아니라 **「정규화가 없으면 틀린 답이 나온다」** 가 결론이다.
 * ```
 *
 * 🔴 **회색조 해시 단독 금지** — dHash 는 밝기만 본다 ⟹ **밝기가 같은 두 색** 을 못 가른다.
 *    그래서 `color` 를 **같이** 낸다(실측: Grey Melange ↔ Graystone 색거리 **157**).
 */

/** 🔴 비교용 규격은 **상수 하나** 다 — 호출부마다 다른 크기를 쓰면 비교가 성립하지 않는다. */
export const VISUAL_SIGNATURE_SPEC = {
  /** dHash 는 가로를 하나 더 본다(인접 비교). */
  hashWidth: 9,
  hashHeight: 8,
  /** 색 서명을 읽는 격자. */
  colorGrid: 32,
  /** 여백 제거 임계 — 흰/크림 배경을 걷되 상품 가장자리를 깎지 않는 값(실측). */
  trimThreshold: 10,
} as const;

export interface VisualSignature {
  /** 🔴 **정규화 «전»** — 원본 그대로의 해시. 비교에 쓰라는 뜻이 아니라 **대조용** 이다. */
  rawDHash: string;
  /** 🟢 **정규화 «후»** — orientation → trim → 규격 resize 를 거친 해시. */
  normalizedDHash: string;
  /** 보조 — 정규화 후 평균 대비 해시. */
  normalizedAHash: string;
  /** 🔴 회색조 해시가 못 보는 축. 정규화 후 중앙 영역 평균 RGB. */
  color: { r: number; g: number; b: number };
  /** 원본 픽셀 크기(관측용). */
  sourceWidth: number;
  sourceHeight: number;
  /** 🔴 **trim 이 실제로 발화했는가** — 전/후를 혼동하지 않기 위한 관측값(계약 I10). */
  trimmed: boolean;
  /** 파생표현 식별자. 🔴 **binary 를 저장하지 않는다** — 이 문자열만 남긴다. */
  digest: string;
}

const bitsToHex = (bits: number[]): string => {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += ((bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!).toString(16);
  }
  return hex;
};

/** 🔴 EXIF orientation 을 먼저 적용한다 — 안 하면 세로로 찍힌 사진이 다른 상품이 된다. */
const base = (buf: Buffer) => sharp(buf, { failOn: "none" }).rotate().removeAlpha();

async function dHashBits(pipeline: sharp.Sharp): Promise<number[]> {
  const { hashWidth: w, hashHeight: h } = VISUAL_SIGNATURE_SPEC;
  const raw = await pipeline.resize(w, h, { fit: "fill" }).grayscale().raw().toBuffer();
  const bits: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) bits.push(raw[y * w + x]! > raw[y * w + x + 1]! ? 1 : 0);
  return bits;
}

async function aHashBits(pipeline: sharp.Sharp): Promise<number[]> {
  const n = VISUAL_SIGNATURE_SPEC.hashHeight;
  const raw = await pipeline.resize(n, n, { fit: "fill" }).grayscale().raw().toBuffer();
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  return [...raw].map((v) => (v > mean ? 1 : 0));
}

/**
 * 한 이미지의 **비교용 정규화 표현** 을 만든다.
 *
 * 🔴 **Contract N1 — 원본을 훼손하지 않는다.** 입력 Buffer 를 수정하지 않고, 원본
 *    URL/바이트를 **어디에도 덮어쓰지 않는다**(파생 데이터만 돌려준다).
 * 🔴 **Contract N2 — 규격은 `VISUAL_SIGNATURE_SPEC` 하나다.** 종횡비가 달라도
 *    결과는 **같은 규격** 이다(계약 I9).
 * 🔴 **Contract N3 — 정규화 전/후를 «둘 다» 낸다.** 하나로 합치면 다음 사람이
 *    어느 쪽을 보고 있는지 모른다(계약 I10 · 01 에서 실제로 답이 뒤집힌 축이다).
 * 🔴 **Contract N4 — 디코드 실패는 «던진다».** 호출부가 그것을 **삼켜서** facts 를
 *    그대로 두는 것이 정책이다(계약 I11/I12) — 여기서 0 을 지어내지 않는다.
 */
export async function computeVisualSignature(buffer: Buffer): Promise<VisualSignature> {
  const meta = await base(buffer).metadata();
  const rawBits = await dHashBits(base(buffer));

  const trimmedPipeline = base(buffer).trim({ threshold: VISUAL_SIGNATURE_SPEC.trimThreshold });
  /** 🔴 `trim` 이 아무것도 못 걷어내는 이미지가 있다 — 그때도 **실패가 아니다**. */
  let normBits: number[];
  let normA: number[];
  let trimmed = true;
  try {
    normBits = await dHashBits(base(buffer).trim({ threshold: VISUAL_SIGNATURE_SPEC.trimThreshold }));
    normA = await aHashBits(base(buffer).trim({ threshold: VISUAL_SIGNATURE_SPEC.trimThreshold }));
  } catch {
    /** 🔴 여백이 없어 trim 이 전체를 지우는 경우 — 정규화 «전» 으로 되돌리고 그 사실을 적는다. */
    trimmed = false;
    normBits = rawBits;
    normA = await aHashBits(base(buffer));
  }
  void trimmedPipeline;

  const g = VISUAL_SIGNATURE_SPEC.colorGrid;
  const { data, info } = await (trimmed
    ? base(buffer).trim({ threshold: VISUAL_SIGNATURE_SPEC.trimThreshold })
    : base(buffer)
  )
    .resize(g, g, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  /** 🔴 **중앙 50% 만** 본다 — 가장자리는 배경이 남아 색을 희석한다. */
  let r = 0;
  let gg = 0;
  let b = 0;
  let n = 0;
  for (let y = g / 4; y < (g * 3) / 4; y++)
    for (let x = g / 4; x < (g * 3) / 4; x++) {
      const i = (y * info.width + x) * info.channels;
      r += data[i]!;
      gg += data[i + 1]!;
      b += data[i + 2]!;
      n += 1;
    }
  const color = { r: Math.round(r / n), g: Math.round(gg / n), b: Math.round(b / n) };
  const normalizedDHash = bitsToHex(normBits);

  return {
    rawDHash: bitsToHex(rawBits),
    normalizedDHash,
    normalizedAHash: bitsToHex(normA),
    color,
    sourceWidth: meta.width ?? 0,
    sourceHeight: meta.height ?? 0,
    trimmed,
    /** 🔴 식별자는 **정규화 결과 + 색** 이다 — 둘을 같이 봐야 한다는 사실을 모양에 박는다. */
    digest: `d1:${normalizedDHash}:${color.r},${color.g},${color.b}`,
  };
}

/**
 * 🔴 **비교 «거리» 는 여기서 내지 않는다** — 판정이 아니라 **관측** 이기 때문이다.
 *    이 함수는 측정 하니스가 쓰는 도구이고 **운영 판정에 연결돼 있지 않다**.
 * 🔴 **threshold 를 두지 않는다**(CPO §3 · §13).
 */
export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.NaN;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}
