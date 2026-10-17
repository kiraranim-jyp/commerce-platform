import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyCandidateMarket, summarizeCandidateOverseasPrices } from "../candidate-market";
import {
  OVERSEAS_REFERENCE_TITLE,
  buildOverseasReference,
} from "@/app/pipeline/commerce/overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-050 — **Registry 밖 국내 후보가 국내 축에 «구조적으로» 못 들어가는 지점**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 파일은 **새 규칙을 만들지 않는다.** 기존 두 계약을 **이어 붙여** 그 조합의
 *    귀결을 드러낸다 — 각각은 이미 테스트로 잠겨 있는데 **합쳤을 때의 결과** 가
 *    아무 테스트에도 없었다.
 *
 * ```
 * ① classifyCandidateMarket  KR 증거는 **둘뿐** — `.kr` TLD · 등록부 소속
 *                            (mi-020-candidate-price-evidence.test.ts:107 이 잠갔다)
 * ② MI 국내 축               market === "KR" && priceKrw != null
 *                            (wu-039-transient-price-entry.test.ts:79 이 잠갔다)
 * ───────────────────────────────────────────────────────────────────────────
 * ⟹ transient 후보는 **정의상 Registry 밖** 이므로 ①의 둘째 증거가 언제나 false.
 * ⟹ 🔴 **`.kr` 도메인이 아닌 한국 쇼핑몰은 SAME + VERIFIED KRW 를 다 통과해도
 *       국내 가격비교에 진입할 수 없다.**
 * ```
 *
 * 🔴 이것은 **버그가 아니라 정책의 귀결** 이다 — CPO 가 WU-020 §4 에서 「통화 단독으로
 *    시장을 결정하지 않는다」를 명시했고 그 규칙이 이 결과를 만든다. 🔴 그래서 이
 *    파일은 **고치지 않고 «고정»** 한다. 완화는 CPO 판정 사안이다.
 *
 * 🔴 외부 호출 0 · DB 0 · Registry 0 · 운영 코드 변경 0.
 */

/** 🔴 transient 후보의 조건 — 등록부 밖이다. 이 값을 true 로 바꾸면 전제가 깨진다. */
const REGISTRY_OUTSIDE = false;

const mkt = (domain: string, currency: string | null) =>
  classifyCandidateMarket({ domain, currency, isRegisteredDomesticShop: REGISTRY_OUTSIDE });

describe("A. Registry 밖 국내 후보의 시장 판정", () => {
  /**
   * 🔴🔴 **핵심.** 한국 쇼핑몰이 `.com`/`.net` 을 쓰는 것은 흔하다 — 우리 등록부에도
   *    `looxloo.com` · `rulii.com` · `chocoel.com` · `tinyapple.net` 이 그렇게 있다.
   *    그 샵들이 **등록부 안** 이라 지금까지 KR 로 분류됐다. 🔴 등록부 **밖** 이면
   *    같은 도메인 모양이 **UNKNOWN** 이 된다.
   */
  it.each([
    ["tinyapple.net", "KRW"],
    ["looxloo.com", "KRW"],
    ["example-kr-shop.com", "KRW"],
  ])("🔴 %s + KRW(등록부 밖) → UNKNOWN", (domain, currency) => {
    expect(mkt(domain, currency)).toEqual({
      market: "UNKNOWN",
      basis: "KRW_WITHOUT_DOMAIN_EVIDENCE",
    });
  });

  /** 🟢 `.kr` 이면 등록부 밖이어도 KR 이다 — 길이 **아예** 막힌 것은 아니다. */
  it.each([["shop.co.kr"], ["somebrand.kr"]])("🟢 %s + KRW(등록부 밖) → KR", (domain) => {
    expect(mkt(domain, "KRW")).toEqual({ market: "KR", basis: "KR_TLD_AND_KRW" });
  });
});

describe("B. 그 귀결 — 국내 축 자격", () => {
  /**
   * 🔴 MI 국내 축 자격을 **복제하지 않고** 그 술어를 그대로 적는다
   *    (`market-intelligence.ts:216` + `:236`).
   */
  const qualifiesForDomesticAxis = (market: string, priceKrw: number | null) =>
    market === "KR" && priceKrw != null;

  it("🔴🔴 KRW 88,000 이 VERIFIED 여도 등록부 밖 .net 이면 국내 축 자격이 없다", () => {
    expect(qualifiesForDomesticAxis(mkt("tinyapple.net", "KRW").market, 88_000)).toBe(false);
  });

  /** 🔴 차이를 만드는 것은 가격도 판정도 아니라 **도메인 글자** 하나다. */
  it("🟢 같은 가격이 .co.kr 이면 자격이 있다", () => {
    expect(qualifiesForDomesticAxis(mkt("shop.co.kr", "KRW").market, 88_000)).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * C. 🔴🔴 그래서 그 후보는 **어디로 가는가** — WU-049 구역에 KRW 가 뜬다
 * ══════════════════════════════════════════════════════════════════════════ */

describe("C. UNKNOWN 가격의 종착지", () => {
  /**
   * 🔴🔴 **WU-050 이 찾고 WU-051 이 고친 결함.**
   *
   * 발견 당시: `market !== "KR"` 가지가 **UNKNOWN 도 포함** 하므로 한국 샵의 KRW 가격이
   * `overseasEvidence` → `candidateOverseasPrice` → 「🌐 **해외** 참고가격」으로 떴다.
   * **제목이 거짓** 이었다.
   *
   * 🟢 수정 방향은 「KRW 면 국내로 본다」가 **아니다**(그것이 금지된 통화 단독 결정이다).
   *    **어느 가격 축에도 넣지 않는다** — WU-020 §6 과 같은 처리.
   *
   * 🔴 이 단언은 **아래 두 층을 같이** 본다. 집계 함수(`summarizeCandidateOverseasPrices`)는
   *    순수 요약기라 KRW 를 받으면 KRW 를 낸다 — 그래서 **「주지 않는 쪽」** 을 잠근다.
   */
  it("🔴🔴 market-intelligence 가 KRW 를 해외 축에 «넣지 않는다»", () => {
    const src = readFileSync(
      path.join(__dirname, "..", "market-intelligence.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    /** 🔴 대입만 보면 속는다 — **해외 축 push «앞» 에서 끊는지** 를 본다. */
    const branch = src.slice(src.indexOf('if (e.market !== "KR")'), src.indexOf("overseasEvidence.push"));
    expect(branch).toContain('e.priceCurrency?.trim().toUpperCase() === "KRW"');
    expect(branch).toContain("krwWithoutKrEvidence");
    expect(branch).toContain("continue");
  });

  /** 🔴 만약 그 가드가 뚫리면 화면이 무엇을 말하게 되는가 — 그 위험을 명시해 둔다. */
  it("🔴 (위험 고정) 집계기에 KRW 가 들어가면 「해외」 제목 아래 KRW 가 찍힌다", () => {
    const view = buildOverseasReference(
      summarizeCandidateOverseasPrices([
        { market: "UNKNOWN", currency: "KRW", amount: 88_000, priceTier: "EXACT" },
      ]),
    );
    expect(view?.lines[0]?.lowest).toBe("KRW 88,000");
    expect(OVERSEAS_REFERENCE_TITLE).toContain("해외");
  });

  /** 🟢 반대 축 확인 — 진짜 해외(외화)는 그대로다. 이 결함은 KRW 에 한정된다. */
  it("🟢 외화 후보는 정상 — 결함은 «KRW 가 UNKNOWN 으로 떨어질 때» 뿐이다", () => {
    const view = buildOverseasReference(
      summarizeCandidateOverseasPrices([
        { market: "OVERSEAS", currency: "EUR", amount: 40, priceTier: "EXACT" },
      ]),
    );
    expect(view?.lines[0]?.lowest).toBe("EUR 40");
    expect(view?.unknownMarketNote).toBeNull();
  });
});
