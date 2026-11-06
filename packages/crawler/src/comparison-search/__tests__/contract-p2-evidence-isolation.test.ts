import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EvidenceItem, ProductEvidence, ProductFacts } from "@commerce/shared";
import { compareCrossSellerProducts } from "../cross-seller";
import { compareModelCode } from "../model-code";
import { deriveMatchTruth } from "../match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CONTRACT P2 — **신규 `evidence` 는 동일성 판정에 «닿지 않는다»**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 브랜드 증거 수집을 열기 «전» 에 세우는 자물쇠다**(CPO 확정 STEP 1).
 *    조사로 「지금 참조가 0 이다」를 확인한 것으로 끝내지 않는다 —
 *    **나중에 누가 연결하면 이 테스트가 FAIL 해야 한다.**
 *
 * 선언 원문은 `packages/shared/src/product-facts.ts` 의 **Contract P2** 다:
 * ```
 * 「`compareCrossSellerProducts` · `compareModelCode` · `deriveMatchTruth` ·
 *   `priceTierFromLink` 는 이 칸을 **읽지 않는다**.
 *   늘어난 증거가 verdict 를 바꾸면 그것은 **실패** 다.」
 * ```
 *
 * ── 🔴 왜 이 순서인가(CPO) ─────────────────────────────────────────────────
 * 「브랜드를 더 많이 읽는 것보다, 읽은 브랜드가 기존 동일상품 판정을 **임의로 바꾸지
 *   못하게 하는 구조를 먼저 확보**하는 것이 중요하다.」
 *
 * ── 🔴 이 파일이 **보장하지 못하는 것**(정직하게 적는다) ────────────────────
 * ```
 * ⒜ 네 owner 모듈 «밖» 의 간접 사슬 — 다른 모듈 함수가 evidence 를 읽어 그 산출을
 *    이 함수들에 넘기는 경로는 **이 테스트가 보지 못한다**(모듈 경계까지만 본다).
 * ⒝ `priceTierFromLink` 는 `apps/admin` 에 있어 이 패키지에서 **import 할 수 없다**
 *    ⟹ 정적 축으로만 잠근다(그 파일에 대한 행동 테스트는 admin 쪽 계약이 갖는다).
 * ⒞ `deriveMatchTruth`·`compareModelCode`·`priceTierFromLink` 는 `ProductFacts` 를
 *    **받지 않는다** ⟹ 행동 불변 테스트가 **성립하지 않는다**(인터페이스를 바꾸지 않았다).
 * ```
 */

/* ═══════════════ 공통 — 소스 로더와 «함수 범위» 추출 ═════════════════════ */

const CS = join(__dirname, "..", "cross-seller.ts");
const MT = join(__dirname, "..", "match-truth.ts");
const MC = join(__dirname, "..", "model-code.ts");
/** 🔴 `priceTierFromLink` 는 **apps/admin** 에 있다 — 패키지 밖이라 경로로만 읽는다. */
const PTL = join(
  __dirname,
  "../../../../../apps/admin/src/app/api/domestic-price-sources/_lib/domestic-product-link.ts",
);

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
/** 🔴 소스 검사는 **주석을 벗기고** 한다(이 저장소에서 여덟 번 걸린 함정). */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
/** 🔴 `import type { ModelEvidenceResult } from "./evidence"` 는 **모듈 경로** 다 — 필드 읽기가 아니다. */
const stripImports = (s: string) => s.replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, " ");

/**
 * 🔴🔴 **중괄호를 세어** 함수 본문을 자른다 — `indexOf("\n}")` 는 중첩 함수가 있으면
 *    **엉뚱한 곳에서 끊긴다**(이 트랙에서 좌표를 세 번 이상 틀렸다).
 * 🔴 함수를 찾지 못하면 **던진다** — 이름 변경·이동이 «조용한 통과» 가 되지 않게 한다.
 */
function functionBody(src: string, decl: string): string {
  const at = src.indexOf(decl);
  if (at < 0) throw new Error(`🔴 선언을 찾지 못했다(이름 변경·이동?): ${decl}`);
  const open = src.indexOf("{", at);
  if (open < 0) throw new Error(`🔴 본문 시작을 찾지 못했다: ${decl}`);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error(`🔴 본문 끝을 찾지 못했다: ${decl}`);
}

/** 🟢 「evidence 칸을 읽는가」의 술어 — 소문자 단어만 본다. */
const READS_EVIDENCE = /\bevidence\b/;

/**
 * 🔴🔴 **선언에 `(` 를 붙인다 — 이것이 없으면 개명이 «조용히 통과» 한다.**
 *    실측: `deriveMatchTruth` 로 찾으면 `deriveMatchTruthRenamed(` 가 **걸려서**
 *    A-0 이 통과했다(접두 포함). 변이가 그 구멍을 잡아 이렇게 고쳤다.
 */
const OWNERS = [
  { name: "compareCrossSellerProducts", file: CS, decl: "export function compareCrossSellerProducts(" },
  { name: "compareModelCode", file: MC, decl: "export function compareModelCode(" },
  { name: "deriveMatchTruth", file: MT, decl: "export function deriveMatchTruth(" },
  { name: "priceTierFromLink", file: PTL, decl: "export function priceTierFromLink(" },
] as const;

/* ═══════════════ A. 정적 — 네 함수가 evidence 를 읽지 않는다 ═════════════ */

describe("CONTRACT-P2 A — 네 판정 함수가 `evidence` 를 읽지 않는다", () => {
  /** 🔴 선언이 **그 자리에 있다** — 이름 변경·이동이 조용한 통과가 되지 않는다. */
  it("A-0 🔴 네 선언이 전부 실재한다(이동·개명 감지)", () => {
    for (const o of OWNERS) {
      expect(() => functionBody(stripComments(read(o.file)), o.decl), `🔴 ${o.name}`).not.toThrow();
    }
  });

  it.each(OWNERS.map((o) => [o.name, o] as const))(
    "A-1 🔴 %s 본문이 `evidence` 를 읽지 않는다",
    (_n, o) => {
      const body = functionBody(stripComments(read(o.file)), o.decl);
      expect(READS_EVIDENCE.test(body), `🔴 ${o.name} 가 evidence 를 읽는다`).toBe(false);
    },
  );

  /**
   * 🔴🔴 **간접 전달 0** — 본문만 보면 같은 모듈의 **헬퍼** 가 읽는 경우를 놓친다.
   *    그래서 **모듈 전체**(import 제외)에 `evidence` 가 **0** 임을 단언한다.
   * 🟢 `from "./evidence"` 는 모듈 경로라 import 를 벗기면 사라진다(실측 확인).
   */
  it.each(OWNERS.map((o) => [o.name, o] as const))(
    "A-2 🔴 %s 의 모듈 전체에 `evidence` 참조가 0 이다(같은 모듈 헬퍼 포함)",
    (_n, o) => {
      const mod = stripImports(stripComments(read(o.file)));
      const hits = mod.match(/\bevidence\b/g) ?? [];
      expect(hits, `🔴 ${o.name} 모듈이 evidence 를 참조한다: ${hits.join(",")}`).toEqual([]);
    },
  );

  /** 🔴 세 함수는 `ProductFacts` 를 **받지 않는다** — 받기 시작하면 경계가 바뀐 것이다. */
  it("A-3 🔴 `compareModelCode`·`deriveMatchTruth`·`priceTierFromLink` 는 ProductFacts 를 받지 않는다", () => {
    for (const o of OWNERS.filter((x) => x.name !== "compareCrossSellerProducts")) {
      const src = stripComments(read(o.file));
      const at = src.indexOf(o.decl);
      const params = src.slice(at, src.indexOf("{", src.indexOf(")", at)));
      expect(params, `🔴 ${o.name} 가 ProductFacts 를 받기 시작했다`).not.toContain("ProductFacts");
      expect(params, `🔴 ${o.name} 가 evidence 를 인자로 받는다`).not.toMatch(READS_EVIDENCE);
    }
  });

  /** 🟢 선언 원문이 **살아 있다** — 문서가 지워지면 이 자물쇠의 근거가 사라진다. */
  it("A-4 🟢 Contract P2 선언이 `product-facts.ts` 에 그대로 있다", () => {
    const shared = read(join(__dirname, "../../../../shared/src/product-facts.ts"));
    expect(shared).toContain("Contract P2");
    for (const fn of ["compareCrossSellerProducts", "compareModelCode", "deriveMatchTruth", "priceTierFromLink"]) {
      expect(shared, `🔴 P2 선언에서 ${fn} 이 빠졌다`).toContain(fn);
    }
  });
});

/* ═══════════════ B. 행동 — evidence 를 바꿔도 판정이 «같다» ══════════════ */

/** 🟢 기존 테스트(`core-sprint02-detail-model-code`)의 빌더를 **그대로** 베꼈다(모양 지어내기 금지). */
const facts = (over: Partial<ProductFacts> = {}): ProductFacts => ({
  sourceUrl: "https://example.com/products/x",
  urlSlug: "x",
  brand: "Bobo Choses",
  brandModelCode: null,
  sellerSku: null,
  title: "Hug Hairy Monster T-Shirt",
  coreTitleTokens: ["hug", "hairy", "monster"],
  categoryText: "T-shirt",
  colorText: "Light Blue",
  materialText: null,
  description: null,
  fitText: null,
  ageRangeText: null,
  sizeLabels: [],
  audienceSignals: [],
  imageUrls: [],
  ...over,
});

const item = (value: string, source: EvidenceItem["source"]): EvidenceItem => ({ value, source });
/** 🔴 CPO 가 지정한 다섯 모양 — 없음 / 추가 / 값 변경 / 판매처명 / UNKNOWN 류. */
const EVIDENCE_CASES: Array<readonly [string, ProductEvidence | null | undefined]> = [
  ["① evidence 없음(undefined)", undefined],
  ["② evidence null", null],
  ["③ DESCRIPTION BRAND 증거 추가", { BRAND: [item("Bobo Choses", "DESCRIPTION")] }],
  ["④ 같은 축에 «다른 값»", { BRAND: [item("Totally Different Brand", "DESCRIPTION")] }],
  ["⑤ 판매처명이 증거로 들어온 모양", { BRAND: [item("비스킷", "DESCRIPTION")] }],
  ["⑥ 여러 축 + MODEL_CODE 까지", {
    BRAND: [item("Bobo Choses", "TITLE"), item("보보쇼즈", "DESCRIPTION")],
    MODEL_CODE: [item("B226AC141", "DESCRIPTION")],
    COLOR: [item("Navy", "DESCRIPTION")],
  }],
];

describe("CONTRACT-P2 B — `compareCrossSellerProducts` 는 evidence 로 결과가 바뀌지 않는다", () => {
  /**
   * 🔴 이 함수만 `ProductFacts` 를 받으므로 **행동 축이 성립하는 유일한 자리** 다.
   * 🔴 기준은 「evidence 가 전혀 없는 쌍」의 산출이고, 나머지는 그것과 **깊은 동일** 이어야 한다.
   */
  const baseA = facts({ brandModelCode: "B226AC010" });
  const baseB = facts({
    sourceUrl: "https://other.example/products/y",
    urlSlug: "y",
    title: "Hug Hairy Monster T-Shirt",
    brandModelCode: "B226AC010",
  });
  const expected = compareCrossSellerProducts(baseA, baseB);

  it.each(EVIDENCE_CASES)("B-1 🔴 %s → 판정 산출이 동일하다", (_label, ev) => {
    const got = compareCrossSellerProducts(
      { ...baseA, evidence: ev },
      { ...baseB, evidence: ev },
    );
    expect(got).toEqual(expected);
  });

  /** 🔴 **한쪽만** 증거를 가진 경우도 같다 — 비대칭 입력으로 새 분기가 생기지 않는다. */
  it("B-2 🔴 한쪽에만 evidence 가 있어도 동일하다", () => {
    const only = { BRAND: [item("보보쇼즈", "DESCRIPTION")] } satisfies ProductEvidence;
    expect(compareCrossSellerProducts({ ...baseA, evidence: only }, baseB)).toEqual(expected);
    expect(compareCrossSellerProducts(baseA, { ...baseB, evidence: only })).toEqual(expected);
  });

  /**
   * 🔴🔴 **이 단언이 이 파일의 핵심이다** — 「brand 가 비어 UNCONFIRMED 인 쌍」에
   *    DESCRIPTION 브랜드 증거를 넣어도 **verdict 와 blockers 가 그대로** 여야 한다.
   *    🟢 이것이 깨지면 WU-080 이 측정한 `UNCONFIRMED → MISMATCH` 전이가
   *       **증거 경로로 되살아난 것** 이다(기존 SAME 이 차단되는 그 모양).
   */
  it("B-3 🔴🔴 brand 가 비어 있어도 DESCRIPTION 증거가 blockers 를 바꾸지 않는다", () => {
    const a = facts({ brand: null, brandModelCode: "B226AC010" });
    const b = facts({
      brand: null,
      brandModelCode: "B226AC010",
      sourceUrl: "https://other.example/products/y",
      urlSlug: "y",
    });
    const before = compareCrossSellerProducts(a, b);
    const after = compareCrossSellerProducts(
      { ...a, evidence: { BRAND: [item("Bobo Choses", "DESCRIPTION")] } },
      { ...b, evidence: { BRAND: [item("비스킷", "DESCRIPTION")] } },
    );
    expect(after.verdict).toBe(before.verdict);
    expect(after.blockers).toEqual(before.blockers);
    expect(after.conflicts).toEqual(before.conflicts);
  });
});

/* ═══════════════ C. 나머지 셋 — 인터페이스를 바꾸지 않았다 ═══════════════ */

describe("CONTRACT-P2 C — evidence 를 받을 «구조» 자체가 없다", () => {
  /** 🟢 문자열 둘만 받는다 ⟹ evidence 가 들어갈 자리가 없다(행동 테스트 불성립). */
  it("C-1 🟢 `compareModelCode` 는 코드 문자열 둘만 받는다", () => {
    expect(compareModelCode("B226AC010", "B226AC010")).toBe("exact");
    expect(compareModelCode("B226AC010", "B226AC141")).toBe("conflict");
    expect(compareModelCode(null, "B226AC010")).toBe("unavailable");
    expect(compareModelCode.length).toBe(2);
  });

  /** 🟢 `deriveMatchTruth` 는 등급·품번결과·verdict 만 받는다. */
  it("C-2 🟢 `deriveMatchTruth` 산출이 evidence 와 무관하다", () => {
    const a = deriveMatchTruth("low", "exact");
    const b = deriveMatchTruth("low", "exact");
    expect(a).toBe(b);
  });
});
