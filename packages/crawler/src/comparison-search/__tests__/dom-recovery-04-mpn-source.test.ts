/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 Coverage WU — STEP 4b: `mpn` 이 «어디서» 오는가 (FP 의 최종 원인)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. 추출기를 고치지 않는다.
 *
 * ── 지금까지 확정된 것 (§3-10) ────────────────────────────────────────────
 *   후보  「AW25 3차[페페슈즈]**3094** 구두_VERNICE NERO-PP25KASHE3094VNE」
 *         url  foretforet.com/shop/shopdetail.html?branduid=10249010
 *         sku  `PP25KASHE3094VNE`  (제목과 일치)
 *   🔴 운영이 쓴 국내품번  `PP24KASHE**1195**NER`  ← 다른 상품(Lulu T Bar)의 코드
 *   → partial → STRONG_IDENTIFIER → tier EXACT → 가격 오염
 *   독립 라벨  Vision 10점 「completely different Mary Jane designs」
 *
 * ── 🔴 이 파일이 가르는 것 — 수정 여부가 여기서 갈린다 ────────────────────
 *   `extractForetforetModelCode` 는 JSON-LD 의 `mpn` «하나» 를 읽는다
 *   (`@type === "Product"` 인 첫 블록, foretforet.ts:251).
 *
 *     ① 그 페이지 `mpn` 이 실제로 `PP24KASHE1195NER` 다
 *        → 🔴 **판매처 데이터 오류** 다. 우리 코드는 정상이고 고칠 것이 없다
 *          (고치면 「없는 값을 지어내는」 쪽이 된다).
 *     ② `@type:Product` 블록이 **여럿** 이고 첫 블록이 연관상품이다
 *        → 🟢 **우리 버그** 다. 「본문 상품」을 고르는 규칙이 없다.
 *
 *   🔴 둘을 구분하지 않고 추출기를 고치면 ①에서 틀린 수정이 된다.
 */
import { describe, expect, it } from "vitest";
import { extractForetforetModelCode } from "../foretforet";
import { fetchHtmlDirect } from "../../utils/direct-html-fetch";
import { checkRobots } from "../../utils/robots-gate";

const LIVE = process.env.MI_P0_02_LIVE === "1";

/** 🔴 FP 가 난 그 URL 과, 대조군으로 «정답» 상품 URL. 지어내지 않았다 — 실측값이다. */
const FP_URL = "https://www.foretforet.com/shop/shopdetail.html?branduid=10249010";

describe.skipIf(!LIVE)("🔴 DOM-RECOVERY-04 — mpn 의 출처", () => {
  it("그 상세의 JSON-LD 블록을 «전부» 찍어 ①판매처 오류 ↔ ②우리 버그를 가른다", async () => {
    const rb = await checkRobots(FP_URL);
    if (rb.state !== "NOT_DISALLOWED") {
      // eslint-disable-next-line no-console
      console.log(`🔴 robots ${rb.state} — 받지 않는다`);
      expect(rb.state).not.toBe("NOT_DISALLOWED");
      return;
    }
    const r = await fetchHtmlDirect(FP_URL);
    expect(r?.html, "상세 HTML 을 받아야 가를 수 있다").toBeTruthy();
    const html = r!.html;

    /** 🔴 추출기와 «같은» 정규식으로 블록을 전부 모은다(다른 파서를 쓰면 다른 걸 잰다). */
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m, i) => {
        let parsed: Record<string, unknown> | null = null;
        let parseError: string | null = null;
        try { parsed = JSON.parse(m[1]) as Record<string, unknown>; }
        catch (e) { parseError = e instanceof Error ? e.name : "parse-failed"; }
        return {
          index: i,
          type: parsed?.["@type"] ?? null,
          mpn: parsed?.mpn ?? null,
          name: typeof parsed?.name === "string" ? parsed.name.slice(0, 60) : null,
          sku: parsed?.sku ?? null,
          parseError,
          rawHead: m[1].trim().slice(0, 120),
        };
      });
    const products = blocks.filter((b) => b.type === "Product");
    const extracted = extractForetforetModelCode(html);

    /** 🔴 「3094」가 페이지 어디에 있는가 — 본문 상품이 3094 인지 확인한다. */
    const has3094 = /3094/.test(html);
    const has1195 = /1195/.test(html);
    const titleTag = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim().slice(0, 90);

    const verdict =
      products.length === 0 ? "🔴 Product JSON-LD 가 없다 — 추출 경로가 바뀐 것이다"
      : products.length > 1 ? "🟢 ② 우리 버그 가능 — Product 블록이 여럿이고 첫 블록을 쓴다"
      : String(products[0].mpn) === "PP24KASHE1195NER"
        ? "🔴 ① 판매처 데이터 오류 — 그 페이지 mpn 자체가 다른 상품 코드다. 우리 코드는 정상."
        : "🔴 예상과 다르다 — mpn 이 1195 도 아니다. 다른 경로를 찾아야 한다";

    const report = {
      url: FP_URL, pageTitle: titleTag,
      robots: rb.state,
      jsonLdBlocks: blocks.length, productBlocks: products.length,
      products, extractedByOwner: extracted,
      pageContains: { "3094": has3094, "1195": has1195 },
      verdict,
      "🔴 하지 않은 것": "추출기 수정 · mpn 추론 · 다른 필드로 폴백",
    };
    // eslint-disable-next-line no-console
    console.log("\n" + JSON.stringify(report, null, 2));
    // 🔴 방향을 단언하지 않는다 — 블록을 읽었다는 것만 고정한다.
    expect(blocks.length).toBeGreaterThan(0);
  }, 20 * 60 * 1000);
});
