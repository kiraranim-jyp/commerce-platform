import { describe, expect, it } from "vitest";
import {
  selectCandidateList,
  selectMiSameCandidates,
  selectPresumedCandidates,
} from "../mi-same-candidates";
/** 🔴 **타입을 owner 에서 읽는다** — 이 트랙이 열두 번 틀린 그 자리다. */
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import {
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../../../api/price-history/_lib/candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SOURCING-CANDIDATE-UNIFIED-UX-1 ①②③ — **세 숫자의 «분모» 를 가른다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지적(2026-11-09 · CEO 화면):
 * ```
 * 「국내 참고가격 KRW 88,000 · 확인 1곳」
 * 「국내 소싱 후보 2곳」
 * 「동일상품 확인 0곳」
 * ⟹ CPO 읽음: 「합계 3건인데 1곳만 쓴다 — 나머지 둘은 왜 빠졌나」
 * ```
 *
 * 🔴🔴 **그 「합계 3건」은 성립하지 않는다 — 분모가 겹친다**(아래 D-1 이 증명).
 *    「확인 1곳」은 **「후보 2곳」의 부분집합** 이다. 즉 **후보 2 = 가격 쓴 1 + 제외 1** 이다.
 * 🟡 그러나 **CPO 지적의 본질은 맞다** — 화면이 그 포함/제외를 **후보 옆에서** 말하지
 *    않아서, 셀러는 **어느 후보의 가격인지 · 나머지가 왜 빠졌는지** 알 수 없다.
 *    (🟢 「제외 관측 차이 1곳」은 **참고 수익성 상자에만** 있고 후보 카드엔 없다.)
 *
 * 🔴 이 파일은 **분모를 고정** 한다 — 운영 코드 변경 0. UI 통일은 별 단계다.
 */

/**
 * 🟢 CEO 화면과 **같은 모양** 의 국내 후보 둘이다.
 * ```
 * ⒜ donokids.com   KRW 88,000 · COMPARISON · VERIFIED_CURRENT · blockers [BRAND_UNCONFIRMED]
 *    → 🟢 **참고가격에 들어간다**(BRAND_UNCONFIRMED 는 금액 자격을 뺏지 않는다)
 * ⒝ 두 번째 후보    KRW 79,000 · COMPARISON · VERIFIED_CURRENT · blockers [BRAND_MISMATCH]
 *    → 🔴 **관측 차이로 제외**(`PRICE_DISQUALIFYING_BLOCKERS`)
 * ```
 */
const KR_ROWS = [
  {
    domain: "donokids.com",
    discoveredUrl: "https://donokids.com/product/a",
    title: "허그 헤어리 몬스터 티셔츠",
    market: "KR",
    priceAmount: 88_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: ["BRAND_UNCONFIRMED"],
  },
  {
    domain: "otherkids.kr",
    discoveredUrl: "https://otherkids.kr/product/b",
    title: "몬스터 반팔 티셔츠",
    market: "KR",
    priceAmount: 79_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: ["BRAND_MISMATCH"],
  },
] as unknown as GeminiTransientRow[];

/** 🔴 서버가 국내 축에 싣는 모양 그대로(`market-intelligence.ts:382` 의 push). */
const KR_PRICE_RECORDS = [
  {
    domain: "donokids.com",
    market: "KR",
    currency: "KRW",
    amount: 88_000,
    priceTier: "COMPARISON",
    priceStatus: "VERIFIED_CURRENT",
    blockers: ["BRAND_UNCONFIRMED"],
  },
  {
    domain: "otherkids.kr",
    market: "KR",
    currency: "KRW",
    amount: 79_000,
    priceTier: "COMPARISON",
    priceStatus: "VERIFIED_CURRENT",
    blockers: ["BRAND_MISMATCH"],
  },
] as unknown as CandidateOverseasPriceRecord[];

describe("D. 🔴 세 숫자는 **서로 다른 분모** 다 — 더하지 않는다", () => {
  it("D-1 🔴🔴 「후보 2곳」 ⊇ 「확인 1곳」 — **합계는 3이 아니라 2** 다", () => {
    const list = selectCandidateList(KR_ROWS, "KR");
    const summary = summarizeCandidateOverseasPrices(KR_PRICE_RECORDS);

    /** 🟢 「국내 소싱 후보 N곳」의 분모 — 화면에 **서는 후보 전체**. */
    expect(list.length, "🟢 CEO 화면의 「국내 소싱 후보 2곳」").toBe(2);
    /** 🟢 「참고가격 … 확인 N곳」의 분모 — **금액 자격을 통과한 판매처**. */
    expect(summary.byCurrency.KRW?.count, "🟢 CEO 화면의 「확인 1곳」").toBe(1);
    expect(summary.byCurrency.KRW?.lowestAmount).toBe(88_000);

    /**
     * 🔴🔴 **이 단언이 CPO 의 「합계 3건」을 반증한다** — 확인 1곳은 후보 2곳 «안» 에 있다.
     *    후보 2 = 가격 쓴 1 + 제외 1 ⟹ 합치면 **2** 다.
     */
    expect(summary.byCurrency.KRW!.count + summary.observedDifferenceCount).toBe(list.length);
    expect(summary.observedDifferenceCount, "🔴 「관측 차이로 제외」 1곳이 나머지 하나다").toBe(1);
  });

  it("D-2 🔴 「동일상품 확인 0곳」은 **또 다른 축** 이다 — 가격 건수가 아니다", () => {
    /** 🟢 가격 집계 선별기(= 「동일상품 확인」 축)는 **SAME 만** 센다. */
    const same = selectMiSameCandidates(KR_ROWS, "KR");
    /** 🔴 칸 이름을 **owner 에서 읽는다** — `rows` 가 아니라 `priced`/`sameButExcluded` 다. */
    expect(same.priced.length, "🟢 CEO 화면의 「동일상품 확인 0곳」").toBe(0);
    expect(same.sameButExcluded.length).toBe(0);
    /** 🟢 그런데 **가격 관측은 존재한다** — 그 둘은 독립이다(CPO 문장 그대로). */
    const summary = summarizeCandidateOverseasPrices(KR_PRICE_RECORDS);
    expect(summary.byCurrency.KRW?.count).toBe(1);
    /** 🟡 「동일상품 추정」 축은 또 다르다 — 보류까지 센다. */
    expect(selectPresumedCandidates(KR_ROWS, "KR").length).toBe(2);
  });

  it("D-3 🔴 「동일상품 추정 2곳」이라고 **가격을 통째로 버리지 않는다**(CPO 문장)", () => {
    const summary = summarizeCandidateOverseasPrices(KR_PRICE_RECORDS);
    /** 🟢 둘 다 PRESUMED_SAME 인데 금액은 **하나가 살아남는다**. */
    expect(summary.byCurrency.KRW?.lowestAmount).toBe(88_000);
    /** 🔴 버린 기준은 verdict 가 **아니라** 「상대가 스스로 다르다고 말한」 blocker 다. */
    expect(summary.observedDifferenceCount).toBe(1);
    expect(summary.unverifiedCount, "🟢 둘 다 가격은 확인됐다").toBe(0);
  });

  it("D-4 🟢🟢 **참고가격이 «어느 후보» 에서 왔는지 추적 가능하다**(CPO 요구)", () => {
    const summary = summarizeCandidateOverseasPrices(KR_PRICE_RECORDS);
    const lowest = summary.byCurrency.KRW!.lowestAmount;
    /**
     * 🟢 집계가 **판매처 단위** 로 접으므로(`domain`), 같은 금액을 가진 후보를 역추적할 수
     *    있다 — 화면이 그 연결을 **적기만** 하면 된다(데이터는 이미 있다).
     * 🔴 즉 ②의 답은 「추적 불가」가 **아니다** — **화면이 안 적을 뿐** 이다.
     */
    const source = KR_ROWS.filter((r) => r.priceAmount === lowest);
    expect(source).toHaveLength(1);
    expect(source[0].domain).toBe("donokids.com");

    /** 🔴 제외된 쪽도 같은 방식으로 특정된다 ⟹ 「어느 후보가 왜 빠졌는가」를 적을 수 있다. */
    const excluded = KR_ROWS.filter((r) => r.priceAmount !== lowest);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].domain).toBe("otherkids.kr");
  });

  it("D-5 🔴 **가격이 있는 후보는 리스트에서 사라지지 않는다**(기존 계약 재확인)", () => {
    const list = selectCandidateList(KR_ROWS, "KR");
    const domains = new Set(list.map((e) => e.row.domain));
    /** 🟢 제외된 후보도 **목록에는 남는다** — CPO 「후보 자체를 숨기지 않는다」. */
    expect(domains.has("donokids.com")).toBe(true);
    expect(domains.has("otherkids.kr")).toBe(true);
  });
});
