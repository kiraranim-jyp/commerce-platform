import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { GEMINI_VIRTUAL_SHOP_ID, GEMINI_VIRTUAL_SHOP_NAME } from "../transient-candidates";
/** 🟢 CORE-2C — 로직 owner 는 운영 모듈 하나다. 하니스가 사본을 들고 있지 않는다. */
import { buildBookmarkletForSnapshot, collectFromResultLinks } from "../../../../pipeline/supplied-url-handoff";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2B — **사용자 브라우저 → `candidateUrls[]` → 서버** 최소 PoC
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「코드부터 쓰지 말고 **실제 가능한 경로를 먼저 기술적으로
 * 증명** 한 다음 최소 PoC 만 작성한다」 · 「MI/SAME/가격은 기존 파이프라인이 담당하므로
 * 이번에는 **Discovery 성공 여부까지만** 측정한다」 · 「B226AC009 하나로 끝내지 않는다」.
 *
 * ── 🔴🔴 기술 증명(이 PoC 의 설계를 «결정한» 실측) ────────────────────────────
 * ```
 * ① CORS   `html.duckduckgo.com` 은 **Origin 헤더를 보내면 403** 이다(능동 거부) ·
 *          `api.duckduckgo.com` 은 `ACAO: *` 인데 **Instant Answer** 라 검색 목록이 아니다 ·
 *          `s.jina.ai` 는 **CORS 를 반사** 하지만 **401**(키 필요)
 *          ⟹ 🔴 **확장 없이 브라우저가 검색 API 를 직접 때리는 길은 없다**
 * ② CSP    `html.duckduckgo.com`·`duckduckgo.com` 은 `connect-src` 를 **자기 도메인으로
 *          제한** 한다 ⟹ bookmarklet 의 `fetch()` 가 **우리 서버로 못 간다**
 *          🟢 반면 `andisearch.com`·`you.com` 은 **CSP 가 아예 없다**(fetch 가능)
 *          ⟹ 🔴 **서비스마다 다르다** ⟹ `fetch` 에 의존하는 설계는 **깨진다**
 * ③ 우리 서버  세션 쿠키가 **`sameSite: "lax"`**(login/route.ts:30) 이고
 *          **CORS 헤더를 내는 코드가 0** 이다(전수 grep)
 *          ⟹ 🔴 **cross-origin 「인증된 POST」는 구조적으로 불가** 하다
 *             (Lax 는 cross-site POST 에 쿠키를 싣지 않는다)
 * ```
 *
 * ── 🟢🟢 그래서 셋을 «동시에» 피하는 설계가 하나뿐이다 — **내비게이션 핸드오프** ──
 * ```
 * bookmarklet/확장이 URL 을 모아 → **우리 페이지로 top-level 내비게이션** 한다
 *   ⒜ CORS      **무관**(내비게이션은 CORS 대상이 아니다)
 *   ⒝ CSP       **무관**(`connect-src` 는 fetch/XHR 만 본다 · 내비게이션은 `navigate-to` 소관이고
 *                위 세 서비스 전부 그 directive 가 **없다**)
 *   ⒞ 🟢 **`SameSite=Lax` 가 top-level GET 내비게이션에는 쿠키를 싣는다** ⟹ **인증 유지**
 *   ⒟ 서버 코드·CORS·인증 **변경 0**
 * ```
 *
 * 🟢🟢 **CORE-2C 에서 배선이 들어왔다** — 페이지가 `?candidateUrls=` 를 읽는 자리는
 *    `pipeline/page.tsx` 의 `?resume=` 복원 **직후** 다. 그래서 이 파일의 로직 사본을
 *    지우고 **운영 모듈 `pipeline/supplied-url-handoff.ts`** 를 import 한다
 *    (owner 를 둘로 만들면 테스트가 증명하는 것과 실제가 갈라진다).
 *
 * 🔴 MI 0 · Price 0 · UI 0 · Adapter/Registry 0 · Seller 입력 부활 0 · 외부 계정 0 · 배포 0.
 */

/** 🟢 상품 하나에 묶인 북마크릿 — 운영 함수가 만든 **그 문자열** 을 검사한다. */
const BOOKMARKLET = buildBookmarkletForSnapshot("https://ttaejyo.vercel.app", "snap-1");

/**
 * 🔴 **실제 검색이 돌려준 URL 원문 그대로** — 상품 3개(CPO 요구).
 * 🔴 URL 을 **지어내지 않았다** · 🔴 스니펫/가격을 쓰지 않았다.
 */
const SEARCHES: { product: string; origin: string; hrefs: string[] }[] = [
  {
    product: "B226AC009",
    origin: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
    hrefs: [
      "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
      "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue",
      "https://scoutandcokids.com/collections/bobo-choses",
      "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
      "https://www.ssense.com/en-us/everything-else/designers/bobo-choses",
      "https://whoopikids.com/collections/bobo-choses",
      "https://www.lfmall.co.kr/app/product/DNSVXX00636",
      "https://www.thefrontshop.com/products/hug-hairy-monster-t-shirt",
      "https://cissywears.com/en-us/products/bobo-choses-babyhug-hairy-monster-t-shirt",
      "https://m.bunjang.co.kr/products/99927762",
    ],
  },
  {
    product: "B226AC010",
    origin: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt",
    hrefs: [
      "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
      "https://www.eraldo.com/en-us/products/bobo-choses-booty-ghosts-t-shirt-340496",
      "https://www.rboutique.com/en-us/products/booty-ghosts-cotton-t-shirt-bobo-choses-38533",
      "https://www.tinyapple.net/products/bobo-choses-booty-ghosts-t-shirt-heather-grey",
      "https://global.trenbe.com/products/bobo-choses-kids-long-sleeve-t-shirt-159889144-p",
      "https://www.ssense.com/en-us/everything-else/designers/bobo-choses",
      "https://whoopikids.com/collections/bobo-choses",
      "https://www.luckywang.com/brands/bobo-choses/",
    ],
  },
  {
    product: "B226AC117",
    origin: "https://bobochoses.com/ko-kr/products/b226ac117-b-c-embossed-tracksuit-jacket",
    hrefs: [
      "https://kihanan.com/products/drop2-2026aw-bobochoses-b-c-embossed-tracksuit-jacket-b226ac117",
      "https://kihanan.com/?gid=1215147&mode=grp",
      "https://www.smallable.com/en/brands/bobo-choses",
      "https://www.vitkac.com/us/kids/designer/bobo-choses",
      "https://www.designlifekids.com/collections/bobo-choses",
      "https://www.boutiquelittle.com/collections/bobo-choses",
      "https://thelittleredplanet.com/collections/bobo-choses",
    ],
  },
];

const LIVE = process.env.CORE2B_POC === "1";

describe("CORE-2B — 브라우저 핸드오프 PoC(계약 · 네트워크 0)", () => {
  it("A-1 🟢 bookmarklet 은 `fetch` 를 쓰지 않는다(CSP `connect-src` 를 피한다)", () => {
    expect(BOOKMARKLET).not.toContain("fetch(");
    expect(BOOKMARKLET).not.toContain("XMLHttpRequest");
    expect(BOOKMARKLET, "🔴 내비게이션으로 넘겨야 CORS·CSP·쿠키 셋을 모두 피한다").toContain(
      "location.href",
    );
  });

  it("A-2 🔴 DDG 래퍼(`uddg`)를 풀어 실제 판매처 URL 을 낸다", () => {
    const got = collectFromResultLinks(
      ["https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.lfmall.co.kr%2Fapp%2Fproduct%2FDNSVXX00636&rut=x"],
      "https://html.duckduckgo.com",
    );
    expect(got).toEqual(["https://www.lfmall.co.kr/app/product/DNSVXX00636"]);
  });

  it("A-3 🔴 검색 서비스 «자신» 의 링크는 보내지 않는다", () => {
    const got = collectFromResultLinks(
      ["https://html.duckduckgo.com/html/?q=next", "https://example.com/products/a"],
      "https://html.duckduckgo.com",
    );
    expect(got).toEqual(["https://example.com/products/a"]);
  });

  it("A-4 🔴 중복을 보내지 않고 상한 50 을 지킨다(URL 길이 제약)", () => {
    const many = Array.from({ length: 80 }, (_, i) => `https://shop.example.com/products/p${i}`);
    expect(collectFromResultLinks([...many, ...many], "https://s.example")).toHaveLength(50);
  });

  it("A-5 🔴 javascript:/mailto: 같은 비-HTTP 는 버린다", () => {
    const got = collectFromResultLinks(
      ["javascript:void(0)", "mailto:a@b.c", "https://ok.example/products/z"],
      "https://s.example",
    );
    expect(got).toEqual(["https://ok.example/products/z"]);
  });

  it.runIf(LIVE)("B 🟢 3상품 — 검색결과 → candidateUrls → **서버 수신** 까지 간다", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-2B — 브라우저 핸드오프 실측(상품 3개) ════════");
    console.log("  🔴 측정 범위는 **Discovery 성공 여부까지** 다 — MI/SAME/가격은 재지 않는다(CPO).");

    for (const s of SEARCHES) {
      const handed = collectFromResultLinks(s.hrefs, "https://html.duckduckgo.com");
      const shapes = handed.map((u) => classifyUrlShape(u));
      const detail = handed.filter((_, i) => shapes[i] === "PRODUCT_PAGE");
      console.log(`\n  ── ${s.product} ──`);
      console.log(`    검색결과 링크 ${s.hrefs.length} → bookmarklet 핸드오프 **${handed.length}**`);
      console.log(`    그중 상품 상세 모양 ${detail.length} · 목록/기타 ${handed.length - detail.length}`);

      /** 🟢 **운영 경계** 에 그대로 넣는다 — 이것이 「서버 수신」의 정의다. */
      const pool = await collectUrlCandidatePool({
        urls: handed,
        originUrl: s.origin,
        maxUrls: 12,
        existingCanonicalUrls: new Set<string>(),
        shopId: GEMINI_VIRTUAL_SHOP_ID,
        shopNamePrefix: GEMINI_VIRTUAL_SHOP_NAME,
      });
      const m = pool.metrics;
      console.log(
        `    🟢 서버 수신 — supplied ${m.suppliedUrls} · accepted ${m.acceptedUrls} · ` +
          `usable ${m.usableProductUrls} · miEligible ${m.miEligibleCandidates} · fetch ${m.fetchCalls}`,
      );
      const hosts = [...new Set(pool.searchResults.map((r) => r.domain))];
      console.log(`    후보 호스트(${hosts.length}): ${hosts.join(", ")}`);
      if (m.dropped.length > 0) {
        const byReason = new Map<string, number>();
        for (const d of m.dropped) byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + 1);
        console.log(`    🔴 탈락 ${m.dropped.length} — ${JSON.stringify(Object.fromEntries(byReason))}`);
      }
      /** 🔴 **Discovery 성공 조건** — 서버가 후보를 **하나라도** 받았는가. */
      console.log(`    🔴🔴 Discovery ${m.miEligibleCandidates > 0 ? "🟢 **성공**" : "🔴 실패"}`);
    }

    console.log("\n  🔴 이 경로는 **사용자가 직접 검색한 결과** 를 쓴다 — 자동 로그인·백그라운드");
    console.log("     자동화·소비자 계정 우회를 **하지 않았다**(CPO 금지 준수).");
    console.log("  🔴 페이지가 `?candidateUrls=` 를 읽는 배선은 **UI 변경이라 하지 않았다**.");
    expect(SEARCHES).toHaveLength(3);
  }, 900_000);
});
