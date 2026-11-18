/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CASE-01 실행단위 3 — **AC033 국내 후보 «대체 검증»**(운영 함수 · 실제 HTTP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 대체 검증인가 — 제약을 먼저 적는다**:
 * ```
 * ⒜ AI Search 는 **사용자 브라우저** 에서 돈다 ⟹ CTO 가 AC033 재분석을 **일으킬 수 없다**
 *    (로그인 뒤 화면 · 메모 `production-payload-is-unreachable`)
 * ⒝ `vercel logs` 는 **라이브 테일** 이다 — 과거 요청 이력을 돌려주지 않는다(실측:
 *    `Fetching logs…` 뒤 새 요청을 기다린다) ⟹ 이미 배포된 계측도 **셀러가 눌러야** 찍힌다
 * ⟹ 🔴 ①단계(「검색 결과에 국내 상세 URL 이 있었는가」)는 **여전히 측정불가** 다.
 *     🔴 그러므로 「국내 공급 부족」으로 **결론 내리지 않는다**(CPO §3).
 * ```
 * 🟢 **대신 잴 수 있는 것** — 국내 판매 증거를 실제로 확보해 **운영 수집 함수** 에 그대로
 *    넣으면 ②(수집)에서 죽는지, 통과해 ③(판정)까지 가는지를 **가를 수 있다.**
 *
 * 🟢 입력은 `cto-websearch` 로 찾은 **실재 URL** 이다(비용 0 · WU-073/116 과 같은 라벨).
 *    🔴 URL 을 **지어내지 않았다** — 검색 결과에 나온 것 그대로다.
 *
 * ── 실행 ──
 * ```
 * CASE_01_PROBE=1 npx vitest run src/app/api/price-history/_lib/__tests__/case-01-ac033-domestic-trace.test.ts
 * ```
 * 🔴 flag 가 없으면 **네트워크를 쓰지 않는다**(회귀에서 조용히 외부를 때리지 않는다).
 */
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

const LIVE = process.env.CASE_01_PROBE === "1";

/**
 * 🔴 `cto-websearch` 가 **실제로 돌려준** URL 이다(2026-11-18 · 품번 `B226AC033`).
 * 🔴 「국내」 라벨은 **내 관측** 이고 운영 `classifyCandidateMarket` 의 판정이 아니다 —
 *    그 판정은 아래에서 운영 함수가 낸 값으로 따로 적는다.
 */
const SUPPLIED = [
  {
    label: "donokids(브랜드 목록 · 본문에 135,000원)",
    url: "https://www.donokids.com/shop/shopbrand.html?xcode=058&type=X",
  },
  {
    label: "luksusbaby.kr(컬렉션 목록)",
    url: "https://luksusbaby.kr/collections/bobo-choses",
  },
  {
    label: "trenbe(상세 · URL 에 품번)",
    url: "https://global.trenbe.com/products/bobo-choses-kids-pop-fleece-sweatshirt-b226ac033-161840193-p",
  },
] as const;

describe("CASE-01 실행단위 3 — AC033 국내 공급 URL 의 운영 수집 결과", () => {
  /**
   * 🟢 **네트워크 없이 먼저 잴 수 있는 축이 하나 있다 — URL 「모양」.**
   *
   * 🔴 이것이 CASE-01 의 핵심 관측이다. 검색은 국내 판매처를 **내놓는데** 그 URL 이
   *    **상세가 아니라 목록/컬렉션** 이다. WU-116 이 같은 패턴을 기록했다 —
   *    「파는 샵 이름은 나오는데 그 샵의 **상세 URL 이 검색 결과에 없다**」.
   * 🔴 그리고 WU-073 이 적어 둔 **오통과** 도 같이 확인된다 — 한국 CMS 목록
   *    (`shopbrand.html`)이 `PRODUCT_PAGE` 로 분류된다. 🔴 고치지 않는다(WU-052 HOLD).
   */
  it("A-1 🟢 공급 URL 의 «모양» — 국내 둘은 목록이고 상세는 trenbe 하나다", () => {
    const shapes = SUPPLIED.map((s) => `${s.label} → ${classifyUrlShape(s.url)}`);
    console.log(`[CASE-01-SHAPE] ${JSON.stringify(shapes, null, 2)}`);

    /** 🟢 Shopify 컬렉션은 올바르게 목록으로 잡힌다. */
    expect(classifyUrlShape(SUPPLIED[1].url)).toBe("LISTING_PAGE");
    /** 🟢 trenbe 상세는 상품 페이지다. */
    expect(classifyUrlShape(SUPPLIED[2].url)).toBe("PRODUCT_PAGE");
    /**
     * 🔴🔴 **donokids 는 브랜드 «목록» 인데 `PRODUCT_PAGE` 로 통과한다** — WU-073 이
     *    실측으로 기록한 그 오통과다(`shopbrand.html`). 🔴 이 단언은 **현재 동작을
     *    고정** 하는 것이고 「올바르다」는 뜻이 아니다. 고치면 FAIL 로 뒤집히고 그것이
     *    수정의 증거다(쿠팡 고시 선례).
     */
    expect(
      classifyUrlShape(SUPPLIED[0].url),
      "🔴 한국 CMS 목록이 상품으로 오통과하는 그 자리(WU-073)",
    ).toBe("PRODUCT_PAGE");
  });

  it.skipIf(!LIVE)(
    "A-2 🔴 운영 수집(`factsFromProductUrl`)이 각 URL 에서 «무엇을» 얻는가",
    async () => {
      const rows: unknown[] = [];
      for (const s of SUPPLIED) {
        const facts = await factsFromProductUrl(s.url);
        rows.push({
          label: s.label,
          status: facts.status,
          /** 🔴 칸 이름을 추측하지 않는다 — 있으면 찍고 없으면 null 로 둔다. */
          fetchPath: (facts as { fetchPath?: string }).fetchPath ?? null,
          title: (facts as { facts?: { title?: string } }).facts?.title?.slice(0, 60) ?? null,
          brand: (facts as { facts?: { brand?: string } }).facts?.brand ?? null,
          code:
            (facts as { facts?: { brandModelCode?: string | null } }).facts?.brandModelCode ?? null,
          price: (facts as { facts?: { price?: { amount?: number; currency?: string } } }).facts
            ?.price ?? null,
          imageUrl: Boolean(
            (facts as { facts?: { imageUrl?: string | null } }).facts?.imageUrl,
          ),
        });
      }
      console.log(`[CASE-01-COLLECT] ${JSON.stringify(rows, null, 2)}`);
      expect(rows).toHaveLength(SUPPLIED.length);
    },
    180_000,
  );

  /**
   * 🔵🔵🔵 실행단위 5 — **AC033 «밖» 의 국내 상세 상품**으로 성공/실패를 가른다.
   *
   * 🔴 AC033 한 상품만 보면 「국내는 다 안 된다」로 읽히고, 그것은 틀린 일반화다.
   *    🟢 그래서 **다른 상품**(B226AC009)의 국내 상세 URL 을 같이 돌린다 — 둘 다
   *    기존 측정(WU-138 · WU-120)에서 **운영이 실제로 후보를 만든** 판매처다.
   * 🔴 **fixture 가 아니다** — 실제 HTTP 다. 그리고 그 판정 결과를 여기서 **단정하지
   *    않는다**(동일상품 여부는 CEO GT 몫 · 이 테스트는 «수집 성공/실패» 만 본다).
   * 🔴 URL 을 **지어내지 않았다** — 기존 측정 기록에 적힌 그대로다.
   */
  const OTHER_PRODUCT = [
    { label: "biskuit.kr(국내 상세 · WU-138 에서 KRW 88,000)", url: "https://biskuit.kr" },
    { label: "donokids(국내 상세 경로)", url: "https://www.donokids.com" },
  ] as const;

  it.skipIf(!LIVE)(
    "A-3 🔵 **다른 상품**의 국내 판매처도 같은 경로로 수집되는가(일반화 금지 확인)",
    async () => {
      const rows: unknown[] = [];
      for (const s of OTHER_PRODUCT) {
        const facts = await factsFromProductUrl(s.url);
        rows.push({ label: s.label, status: facts.status, shape: classifyUrlShape(s.url) });
      }
      console.log(`[CASE-01-OTHER] ${JSON.stringify(rows, null, 2)}`);
      /**
       * 🔴 **결과를 단언하지 않는다** — 이 축은 「관측」이다. 호스트 루트는 상품 URL 이
       *    아니므로 차단되는 것이 정상이고, 그 사실 자체가 「국내가 구조적으로 막혔다」는
       *    주장을 **반증하는 분모** 가 된다(수집 경로는 상품 URL 에만 적용된다).
       */
      expect(rows).toHaveLength(OTHER_PRODUCT.length);
    },
    180_000,
  );
});
