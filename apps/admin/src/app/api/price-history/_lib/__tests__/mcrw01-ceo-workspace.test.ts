/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CEO-REVIEW-WORKSPACE-01 — **CEO 판정 워크스페이스 입력 캡처**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CTO 가 SAME/DIFFERENT 를 확정하지 않는다** — `ceoVerdict` 전건 `null`.
 *
 * 🔴 §6 수집 원칙 — 원상품 **5** + 후보 **22** 의 **그 URL 만** 읽기 전용 재관측 ·
 *    운영 추출기 재사용 · 광범위 재검색 **0** · 신규 크롤러 **0** ·
 *    이미지 URL **조합 0**(추출기가 준 값만) · 실패·리다이렉트는 **확인 불가** ·
 *    원문 변형 **0** · 번역·정규화는 **원문과 분리**.
 * 🔴 §7 정책 불변 — MCE-01/02 자격 조건 **0** · 8축 **0** · SAME 승격 **0** ·
 *    가격·등록·seller **0** · DB/schema **0** · 원본 파기 **0**.
 *
 * 🔴🔴 **이미지는 «임베드» 한다.** CPO 완료 기준 ③ — 「링크만 제공하거나 존재 여부만
 *    표시하는 것으로는 부족」. 🔴 Artifact 는 외부 호스트를 **CSP 로 차단** 하므로
 *    `data:` URI 로 넣어야 **보인다**. 🟢 대상은 **추출기가 이미 준 이미지 URL** 뿐이고
 *    새로 찾지 않는다(WU-093 선례).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  extractCodeLikeSlugSegment,
  extractCodeLikeTitleToken,
  extractLabeledProductCode,
  extractUrlSlug,
} from "@commerce/shared/src/product-facts";

const FIX = join(__dirname, "fixtures");
const DUMP = join(FIX, "mcrw01-workspace.json");
const LIVE = process.env.MCRW01_LIVE === "1";
const SELECTED_GROUPS = new Set(["Dress", "Jacket", "Trousers"]);

/** 🔴 이미지 한 장 상한 — 화면이 열리지 않을 만큼 커지면 **싣지 않고 사유를 적는다**. */
const MAX_IMAGE_BYTES = 700_000;
/**
 * 🔴 1차에 **180KB** 로 잡았다가 **11장이 빠졌다**(후보 8 · 원상품 3) ⟹
 *    CPO 완료기준 ③(「링크만으로는 부족」)을 충족하지 못했다. 🟢 상한을 올렸다 —
 *    🔴 이 저장소 선례(WU-112 자립형 7.5MB)보다 작게 유지되는지 계약이 본다.
 */

interface Snap {
  snapshot_id: string;
  origin_brand: string | null;
  origin_sku: string | null;
  origin_title: string | null;
  origin_desc: string | null;
  shopify_type: string | null;
  source_url: string | null;
}
interface BaseRow {
  snapshot_id: string | null;
  candidate_url: string;
  candidate_domain: string | null;
  candidate_title: string | null;
  market: string | null;
  system_verdict: string | null;
  match_truth: string | null;
  price_tier: string | null;
  blockers: unknown;
  match_reasons: unknown;
  human_verdict: string | null;
}

/** 🟢 운영 owner 순서 그대로(설명문 → 제목 → URL slug). 🔴 DB `sku` 는 그 순서에 없다. */
const operationalCode = (desc: string | null, title: string | null, url: string | null): string | null =>
  extractLabeledProductCode(desc) ??
  extractCodeLikeTitleToken(title) ??
  extractCodeLikeSlugSegment(extractUrlSlug(url));

/** 🔴 발췌 — **원문 그대로** 자른다(번역·보정 0). */
const excerptAround = (text: string, needle: string, pad = 60): string | null => {
  const i = text.toUpperCase().indexOf(needle.toUpperCase());
  if (i < 0) return null;
  const a = Math.max(0, i - pad);
  const b = Math.min(text.length, i + needle.length + pad);
  return (a > 0 ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ").trim() + (b < text.length ? "…" : "");
};

/** 🔴 **라벨이 붙은 품번만** — MCE-02 의 그 규칙과 같은 모양(새 규칙 0). */
const LABELED_CODE_RE =
  /(?:product\s*code|article\s*code|model\s*(?:code|no\.?)|품번|모델\s*번호)\s*[:\s]*([A-Za-z0-9-]{4,20})/i;

/** 🔴 **판매처 자체 SKU** 를 모델 품번으로 쓰지 않는다 — 숫자만은 재고번호다(WU-095). */
const looksLikeModelCode = (v: string): boolean =>
  /[a-z]/i.test(v) && /[0-9]/.test(v) && !/^[0-9]+$/.test(v);

/** 🟢 이미지 — **추출기가 준 URL 만** 받아 `data:` 로 바꾼다. 🔴 URL 조합 0. */
async function fetchImageDataUri(
  url: string | null | undefined,
): Promise<{ dataUri: string | null; note: string }> {
  if (!url) return { dataUri: null, note: "이미지 URL 미확보" };
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return { dataUri: null, note: `이미지 HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return { dataUri: null, note: `이미지가 아니다(${type})` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return { dataUri: null, note: `상한 초과(${Math.round(buf.byteLength / 1024)}KB) — 싣지 않았다` };
    }
    return { dataUri: `data:${type};base64,${buf.toString("base64")}`, note: `확보(${Math.round(buf.byteLength / 1024)}KB)` };
  } catch (e) {
    return { dataUri: null, note: "이미지 수집 실패: " + String((e as Error)?.message ?? e).slice(0, 60) };
  }
}

describe("MCRW01 — CEO 판정 워크스페이스 입력", () => {
  it(
    LIVE ? "L-1 🔵 원상품 5 + 후보 22 전체 facts·이미지 캡처" : "L-1 (SKIP) 🔴 라이브 게이트",
    async () => {
      if (!LIVE) return;
      const base = JSON.parse(readFileSync(join(FIX, "mmse01-baseline.json"), "utf8")) as {
        bySnapshot: Snap[];
        rows: BaseRow[];
      };
      const snaps = base.bySnapshot.filter((s) => SELECTED_GROUPS.has((s.shopify_type ?? "").trim()));
      const rows = base.rows.filter((r) => r.snapshot_id != null);
      expect(snaps, "🔴 원상품 5 가 아니다").toHaveLength(5);

      const collectedAt = new Date().toISOString();
      let httpCalls = 0;
      const out: unknown[] = [];

      for (const s of snaps) {
        /** 🟢 **원상품도 운영 추출기로** 다시 읽는다 — 색상·소재·형태가 저장분에 없다. */
        let oFacts: Record<string, unknown> | null = null;
        let oStatus = "NO_RESULT";
        let oImage: string | null = null;
        try {
          const r = await factsFromProductUrl(s.source_url ?? "");
          httpCalls += r?.httpCalls ?? 0;
          oStatus = r?.status ?? "NO_RESULT";
          if (r?.status === "OK") {
            oFacts = (r.candidate?.facts ?? null) as Record<string, unknown> | null;
            oImage = r.candidate?.imageUrl ?? null;
          }
        } catch (e) {
          oStatus = "EXCEPTION: " + String((e as Error)?.message ?? e).slice(0, 80);
        }
        const oImg = await fetchImageDataUri(oImage);

        const originDesc = s.origin_desc ?? "";
        const originBrand = (s.origin_brand ?? "").trim();
        const originOpCode = operationalCode(s.origin_desc, s.origin_title, s.source_url);

        const cands: unknown[] = [];
        for (const c of rows.filter((r) => r.snapshot_id === s.snapshot_id)) {
          let facts: Record<string, unknown> | null = null;
          let status = "NO_RESULT";
          let imageUrl: string | null = null;
          let fetchPath: string | null = null;
          try {
            const r = await factsFromProductUrl(c.candidate_url);
            httpCalls += r?.httpCalls ?? 0;
            status = r?.status ?? "NO_RESULT";
            if (r?.status === "OK") {
              facts = (r.candidate?.facts ?? null) as Record<string, unknown> | null;
              imageUrl = r.candidate?.imageUrl ?? null;
              fetchPath = r.fetchPath ?? null;
            }
          } catch (e) {
            status = "EXCEPTION: " + String((e as Error)?.message ?? e).slice(0, 80);
          }
          const img = await fetchImageDataUri(imageUrl);
          const desc = (facts?.description as string | null) ?? null;
          const descOk = typeof desc === "string" && desc.length > 0;

          /** 🔵 **실제 모델 품번** — MCE-02 규칙 그대로(판매처 자체 SKU 제외 · 라벨 요구). */
          const structured = ((facts?.brandModelCode as string | null) ?? "").trim();
          const labeled = (LABELED_CODE_RE.exec(desc ?? "")?.[1] ?? "").trim();
          const modelCode =
            structured.length > 0 && looksLikeModelCode(structured)
              ? { value: structured, source: "구조화 필드" }
              : labeled.length > 0 && looksLikeModelCode(labeled)
                ? { value: labeled, source: "상세설명 라벨" }
                : { value: null as string | null, source: "없음" };
          /** 🔴 **판매처 자체 SKU 로 본 값** 을 따로 적는다 — 혼동 금지(CPO §3-C). */
          const sellerSku =
            structured.length > 0 && !looksLikeModelCode(structured) ? structured : null;

          const oc = (originOpCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          const mc = (modelCode.value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          const codeVerdict =
            oc.length === 0 || mc.length === 0
              ? "비교 불가"
              : oc === mc || (oc.length >= 4 && oc.slice(1) === mc) || (mc.length >= 4 && mc.slice(1) === oc)
                ? "일치"
                : "불일치";

          cands.push({
            domain: c.candidate_domain,
            url: c.candidate_url,
            market: c.market ?? "미확정",
            /** 🔴 기존 자동 판정은 **그대로 보존**(§7). */
            systemVerdict: c.system_verdict,
            matchTruth: c.match_truth,
            priceTier: c.price_tier,
            blockers: Array.isArray(c.blockers) ? c.blockers : [],
            matchReasons: Array.isArray(c.match_reasons) ? c.match_reasons : [],
            storedHumanVerdict: c.human_verdict,
            fetchStatus: status,
            fetchPath,
            /** ── 상품 정보 ── */
            title: (facts?.title as string | null) ?? c.candidate_title,
            brand: (facts?.brand as string | null) ?? null,
            modelCode,
            sellerSku,
            codeVerdict,
            categoryText: (facts?.categoryText as string | null) ?? null,
            colorText: (facts?.colorText as string | null) ?? null,
            materialText: (facts?.materialText as string | null) ?? null,
            fitText: (facts?.fitText as string | null) ?? null,
            sizeLabels: (facts?.sizeLabels as string[] | null) ?? null,
            audienceSignals: (facts?.audienceSignals as string[] | null) ?? null,
            /** ── 상세설명 ── */
            descriptionChars: desc?.length ?? 0,
            descriptionRaw: desc,
            excerpts: {
              brand: descOk && originBrand ? excerptAround(desc!, originBrand) : null,
              code: descOk && modelCode.value ? excerptAround(desc!, modelCode.value) : null,
              name: descOk
                ? (() => {
                    const t = (s.origin_title ?? "").split(/\s+/).find((w) => w.length >= 4 && desc!.toLowerCase().includes(w.toLowerCase()));
                    return t ? excerptAround(desc!, t) : null;
                  })()
                : null,
            },
            /** ── 이미지 ── */
            image: { dataUri: img.dataUri, note: img.note, sourceUrl: imageUrl },
            collectedAt,
            /** 🔴 §4 — CEO 판정란은 **비워 둔다**. */
            ceoVerdict: null,
            ceoNote: null,
          });
        }

        out.push({
          group: (s.shopify_type ?? "").trim(),
          snapshotId: s.snapshot_id,
          title: s.origin_title,
          url: s.source_url,
          brand: s.origin_brand,
          /** 🔴 DB SKU 와 운영 품번을 **혼용하지 않는다**. */
          dbSku: s.origin_sku,
          opCode: originOpCode,
          opCodeSource:
            extractLabeledProductCode(s.origin_desc) != null
              ? "설명문"
              : extractCodeLikeTitleToken(s.origin_title) != null
                ? "제목"
                : originOpCode != null
                  ? "URL slug"
                  : "없음",
          fetchStatus: oStatus,
          categoryText: (oFacts?.categoryText as string | null) ?? null,
          colorText: (oFacts?.colorText as string | null) ?? null,
          materialText: (oFacts?.materialText as string | null) ?? null,
          fitText: (oFacts?.fitText as string | null) ?? null,
          sizeLabels: (oFacts?.sizeLabels as string[] | null) ?? null,
          audienceSignals: (oFacts?.audienceSignals as string[] | null) ?? null,
          descriptionChars: originDesc.length,
          descriptionRaw: originDesc,
          image: { dataUri: oImg.dataUri, note: oImg.note, sourceUrl: oImage },
          collectedAt,
          candidates: cands,
        });
      }

      writeFileSync(
        DUMP,
        JSON.stringify(
          {
            note:
              "🔴 MCRW-01 — CEO 판정 워크스페이스 입력. CTO 가 SAME/DIFFERENT 를 확정하지 않았다 " +
              "(ceoVerdict 전건 null · DB 저장 0 · 운영 판정 연결 0). 원문 변형 0 · 이미지 URL 조합 0.",
            collectedAt,
            httpCalls,
            origins: out.length,
            candidates: out.reduce<number>((a, o) => a + (o as { candidates: unknown[] }).candidates.length, 0),
            rows: out,
          },
          null,
          2,
        ),
        "utf8",
      );
      /* eslint-disable no-console */
      console.log(`[MCRW01] 원상품 ${out.length} · HTTP ${httpCalls}`);
      /* eslint-enable no-console */
    },
    1_800_000,
  );

  it("A-1 🟢🟢 **22개 후보가 전부 담겼고 비교 재료가 행마다 있다**", () => {
    if (!existsSync(DUMP)) {
      expect(LIVE, "🔴 산출물이 없다 — `MCRW01_LIVE=1` 로 한 번 돌려야 한다").toBe(true);
      return;
    }
    const d = JSON.parse(readFileSync(DUMP, "utf8")) as {
      origins: number;
      candidates: number;
      rows: {
        group: string;
        title: string;
        image: { dataUri: string | null };
        candidates: {
          domain: string;
          codeVerdict: string;
          modelCode: { value: string | null; source: string };
          sellerSku: string | null;
          descriptionChars: number;
          image: { dataUri: string | null; note: string };
          ceoVerdict: string | null;
          matchReasons: string[];
        }[];
      }[];
    };
    expect(d.origins, "🔴 원상품 5 가 아니다").toBe(5);
    expect(d.candidates, "🔴🔴 후보 22 가 아니다").toBe(22);
    const all = d.rows.flatMap((r) => r.candidates);
    for (const c of all) {
      expect(["일치", "불일치", "비교 불가"], `🔴 ${c.domain} 품번 판정 어휘가 아니다`).toContain(c.codeVerdict);
      /** 🔴 §4 — CTO 가 판정을 채우지 않았다. */
      expect(c.ceoVerdict, `🔴🔴 ${c.domain} CTO 가 판정을 채웠다`).toBeNull();
      /** 🔴 이미지는 **없으면 사유** 가 있어야 한다(「있다/없다」만 적지 않는다). */
      if (c.image.dataUri == null) expect(c.image.note.length, `🔴 ${c.domain} 이미지 사유 없음`).toBeGreaterThan(3);
    }
    /** 🔵 CPO 완료기준 ③ — **이미지가 실제로 실렸다**(링크만이 아니다). */
    const withImg = all.filter((c) => c.image.dataUri != null);
    expect(withImg.length, "🔴🔴 임베드된 후보 이미지가 부족하다 — 링크만으로는 미완료다").toBeGreaterThanOrEqual(18);
    expect(d.rows.filter((r) => r.image.dataUri != null).length, "🔴 원상품 이미지가 부족하다").toBe(5);
    /** 🔵 CPO 완료기준 ② — **품번 충돌과 판매처 자체 SKU 가 갈려 있다**. */
    expect(all.filter((c) => c.codeVerdict === "불일치").length, "🔴 품번 충돌 사례가 사라졌다").toBeGreaterThanOrEqual(1);
    expect(all.filter((c) => c.sellerSku != null || c.modelCode.value == null).length).toBeGreaterThanOrEqual(1);
  });

  it("B-1 🔵 **필수 6 사례의 판단 근거가 산출물에 있다**", () => {
    if (!existsSync(DUMP)) return;
    const d = JSON.parse(readFileSync(DUMP, "utf8")) as {
      rows: {
        group: string;
        opCode: string | null;
        candidates: {
          url: string;
          domain: string;
          codeVerdict: string;
          modelCode: { value: string | null; source: string };
          sellerSku: string | null;
          descriptionChars: number;
          fetchStatus: string;
          colorText: string | null;
          excerpts: { brand: string | null; code: string | null; name: string | null };
        }[];
      }[];
    };
    const find = (key: string) => d.rows.flatMap((r) => r.candidates.map((c) => ({ r, c }))).find((x) => x.c.url.includes(key));
    /* eslint-disable no-console */
    console.log("\n═══ 필수 6 사례 ═══");
    const cases = [
      "taxi-saurus-tag-denim-pants-by-bobo",
      "donokids",
      "exclusive-handsmock-dress-in-pink-tapestry",
      "handsmock-apron-dress-in-natural",
      "mixed-media-jacket-in-blue-mix-by-wynken",
      "wynken-jacke-mixed-media",
    ];
    for (const k of cases) {
      const x = find(k);
      expect(x, `🔴 사례를 못 찾았다: ${k}`).toBeTruthy();
      const c = x!.c;
      console.log(
        `  ${String(c.domain).padEnd(22)} 원품번=${String(x!.r.opCode ?? "-").padEnd(10)}` +
          ` 모델품번=${String(c.modelCode.value ?? "-").padEnd(11)}(${c.modelCode.source})` +
          ` 판매처SKU=${String(c.sellerSku ?? "-").padEnd(12)} 품번=${c.codeVerdict.padEnd(7)}` +
          ` 설명=${String(c.descriptionChars).padStart(5)}자 색상=${String(c.colorText ?? "-").slice(0, 18).padEnd(18)} ${c.fetchStatus}`,
      );
    }
    /* eslint-enable no-console */
    /** 🔴 ③ `BJ21 ↔ BJ87` 는 **불일치** 여야 한다. */
    expect(find("exclusive-handsmock-dress-in-pink-tapestry")!.c.codeVerdict).toBe("불일치");
    expect(find("exclusive-handsmock-dress-in-pink-tapestry")!.c.modelCode.value).toBe("BJ87");
    /** 🔴 ⑥ nickis 는 **모델 품번이 없다** — 판매처 자체 번호를 모델 품번으로 쓰지 않는다. */
    expect(find("wynken-jacke-mixed-media")!.c.modelCode.value, "🔴 판매처 SKU 를 모델 품번으로 썼다").toBeNull();
    /** 🔴 ④ REDIRECTED_AWAY 는 **확인 불가** 다 — 설명 0자. */
    expect(find("handsmock-apron-dress-in-natural")!.c.descriptionChars).toBe(0);
    /** 🔴 ⑤ Wynken 색상 변형 — 품번은 **일치** 다. */
    expect(find("mixed-media-jacket-in-blue-mix-by-wynken")!.c.codeVerdict).toBe("일치");
  });

  it("D-1 🔵🔵 **생성기를 돌려 화면 구조를 실측한다** — 「기능이 있다」가 아니다", () => {
    if (!existsSync(DUMP)) return;
    /**
     * 🔴🔴 **생성기를 실제로 돌린다.** 「구성했다」가 아니라 **생성된 HTML 을 세어** 본다.
     *    🟢 WU-093 선례(`scripts/wu-093-build-review.mjs`)와 같은 모양이다.
     * 🔴 출력은 **임시 경로** 다 — 기존 산출물을 덮지 않는다.
     */
    const repo = join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..");
    const out = join(mkdtempSync(join(tmpdir(), "mcrw01-")), "workspace.html");
    execFileSync(process.execPath, [join(repo, "scripts", "mcrw01-build-workspace.mjs"), out], {
      cwd: repo,
      stdio: "pipe",
    });
    const html = readFileSync(out, "utf8");
    const n = (re: RegExp) => (html.match(re) ?? []).length;

    /** 🔴 CPO §9 — **22개 후보가 화면에 실제로 선다**. */
    expect(n(/class="cand"/g), "🔴🔴 후보 카드가 22개가 아니다").toBe(22);
    expect(n(/class="oin"/g), "🔴 원상품 패널이 5개가 아니다").toBe(5);
    /** 🔴 ⑦ 판정·메모가 **행마다** 있다. */
    expect(n(/class="verdictbox"/g)).toBe(22);
    expect(n(/type="radio"/g), "🔴 세 선택지 × 22 가 아니다").toBe(66);
    /** 🔴 ②③⑤ 비교표가 **행마다** 둘(세 축 + 차이 6행). */
    expect(n(/class="three">/g)).toBe(22);
    expect(n(/class="three diffs"/g)).toBe(22);
    /** 🔴 ⑥ 기존 MI 자동 판정 근거가 행마다 있다. */
    expect(n(/기존 MI 자동 판정 근거/g)).toBe(22);
    /** 🔵 CPO 완료기준 ③ — **이미지가 실렸다**(링크만이 아니다). */
    expect(n(/<img src="data:image/g), "🔴🔴 임베드 이미지가 부족하다").toBeGreaterThanOrEqual(20);
    expect(n(/class="oref"/g), "🔴 후보 카드마다 원상품 이미지가 서지 않는다").toBe(22);
    /** 🔴 이미지 미확보는 **사유와 함께** 표시된다(「없다」만 적지 않는다). */
    expect(n(/class="noimg"/g), "🔴 미확보 표시가 사라졌다").toBeGreaterThanOrEqual(1);
    /** 🔵 CPO 완료기준 ② — **판매처 자체 번호를 모델 품번과 갈라 적는다**. */
    /**
     * 🔴🔴 **음성 대조 P5 가 통과했다 — 두 출처를 합쳐 셌기 때문이다.**
     * ```
     * 구조화 유래   후보 `brandModelCode` 가 숫자만일 때            **1**
     * URL 유래      URL 꼬리가 숫자만일 때(nickis `7400851022` 등)  **2**
     * ```
     * 🟢 그래서 **갈라** 센다 — 한쪽을 지우면 FAIL 한다.
     */
    const skuFromField = n(/>판매처 자체 번호 /g);
    const skuFromUrl = n(/>URL 의 판매처 자체 번호 /g);
    /**
     * 🔴🔴 **내 1차 단언이 틀렸다** — 「모델 품번으로 쓰지 않습니다」 **3** 중 하나는
     *    머리말 **안내문** 이고, **구조화 유래는 0** 이다(이 표본에 숫자만인 구조화
     *    품번을 가진 후보가 **없다**). 🟢 실측대로 적는다.
     */
    expect(skuFromField, "🔴 구조화 유래 표시 수가 바뀌었다(이 표본은 0 이다)").toBe(0);
    expect(skuFromUrl, "🔴🔴 URL 유래 판매처 번호 표시가 사라졌다 — nickis 구분이 안 보인다").toBe(2);
    expect(html, "🔴 nickis 판매처 번호가 화면에 없다").toContain("7400851022");
    /** 🟢 안내문 1 + URL 유래 2 = 3. 🔴 어느 쪽이 사라져도 FAIL 한다. */
    expect(n(/모델 품번으로 쓰지 않습니다/g), "🔴🔴 판매처 자체 번호 구분이 사라졌다").toBe(3);
    expect(html, "🔴 머리말의 구분 설명이 사라졌다").toContain("판매처가 자기 창고용으로 붙인 번호");
    expect(html, "🔴 품번 충돌 표시가 없다").toContain("품번 불일치");
    /** 🔴 ④ 확인 불가는 **「없음」과 갈라** 적는다. */
    expect(n(/class="unk"/g), "🔴 확인 불가 표시가 사라졌다").toBe(2);
    expect(html).toContain("「없음」이 아닙니다");
    /** 🔴 §5 검토 효율 — 필터 넷 · 이전/다음 · 판정 현황. */
    expect(n(/data-f="/g)).toBe(4);
    expect(html).toContain('id="next"');
    expect(html).toContain('id="prev"');
    expect(html).toContain('id="done"');
    /** 🔴🔴 **자립형** 이어야 Artifact CSP 에서 보인다 — 외부 호스트 참조 **0**. */
    expect(n(/src="https?:/g), "🔴🔴 외부 호스트를 참조한다 — CSP 가 막는다").toBe(0);
    /** 🔴 Artifact 규약 — `DOCTYPE`/`html` 태그를 쓰지 않는다. */
    expect(/<!DOCTYPE|<html/i.test(html), "🔴 문서 골격을 직접 썼다").toBe(false);
    /** 🔴 §4 — CTO 가 판정을 **미리 채우지 않았다**(checked 가 없다). */
    expect(n(/type="radio"[^>]*checked/g), "🔴🔴 판정이 미리 선택돼 있다").toBe(0);
    /** 🔴 선례보다 작게 유지한다(WU-112 자립형 7.5MB). */
    expect(html.length / 1048576, "🔴 산출물이 너무 크다").toBeLessThan(9);

    /* eslint-disable no-console */
    console.log(
      `[MCRW01-D1] 카드 22 · 원상품 5 · 임베드 이미지 ${n(/<img src="data:image/g)} · ` +
        `확인불가 ${n(/class="unk"/g)} · 판매처번호 ${n(/모델 품번으로 쓰지 않습니다/g)} · ` +
        `${(html.length / 1048576).toFixed(1)}MB`,
    );
    /* eslint-enable no-console */
  });

  it("C-1 🔴 **금지 전수 — 판정·저장·광범위 수집을 하지 않았다**", () => {
    const self = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const banned of [
      ["compute", "MarketIntelligence"].join(""),
      ["price", "TierFromLink"].join(""),
      ["candidate", "reviews"].join("_"),
      ["search", "ComparisonShops"].join(""),
      ["search", "DomesticShops"].join(""),
      ["BRAND", "_ALIASES"].join(""),
      ["SAME", "_MIN_AXES"].join(""),
    ]) {
      expect(self, `🔴 금지 경로: ${banned}`).not.toContain(banned);
    }
    expect(self).toContain(["process.env.MCRW01", '_LIVE === "1"'].join(""));
    expect(self, "🔴 게이트 없이 수집한다").toContain(["if (!LIVE)", " return;"].join(""));
    expect(self).toContain(["ceoVerdict", ": null"].join(""));
  });
});
