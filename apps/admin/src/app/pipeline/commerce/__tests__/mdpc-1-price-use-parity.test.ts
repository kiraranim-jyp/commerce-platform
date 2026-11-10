import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "./source-text";
import { candidatePriceUse, CANDIDATE_PRICE_USE_LABEL, selectCandidateList } from "../mi-same-candidates";
/** 🔴 **타입을 owner 에서 읽는다** — 이 트랙이 열두 번 틀린 그 자리다. */
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import {
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../../../api/price-history/_lib/candidate-market";
/** 🔴 tier 를 **손으로 적지 않는다** — 운영 매핑 함수가 낸 값을 쓴다. */
import { priceTierFromLink } from "../../../api/domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-DOMESTIC-PRICE-CANDIDATE-CONSISTENCY-1 — **카드의 「반영/제외」가 집계와 같은가**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 과녁(CEO Production 화면):
 * ```
 * 「국내 참고가격 KRW 88,000 · 확인 1곳」   ← A  summarizeCandidateOverseasPrices(국내 레코드)
 * 「동일상품 확인 0곳」                      ← B  buildPriceGuide(j,"KR").sameCount
 * 「국내 소싱 후보 2곳」                     ← C  selectCandidateList(rows,"KR").length
 * ```
 * 🟢 **셋은 서로 다른 분모이고 각자 정확하다** — 그 사실은 이미 계약으로 잠겨 있다
 *    (`sourcing-candidate-count-denominators-1` D-1~D-5). 🔴 **이 파일은 그 숫자를
 *    다시 세지 않는다.** 분모·집계 조건 **변경 0.**
 *
 * 🔴🔴 이 파일이 잠그는 것은 **그 다음 한 칸** 이다 — 「A 에 들어간 후보가 어느 것인지」를
 *    말하는 카드 한 줄(`mi-candidate-price-use` · ⑧)이 **집계기와 다른 게이트** 를 보고
 *    있었다. 집계기(`candidate-market.ts`)의 순서는 넷이다:
 * ```
 * ① priceTier === "EXCLUDED"      → 금액에서 빠진다
 * ② verdict 가 자격 집합 밖         → 금액에서 빠진다
 * ③ 관측된 차이(blockers)          → 금액에서 빠진다
 * ④ 금액 없음 / priceStatus 미확인  → 금액에서 빠진다
 * ```
 * 🔴 ⑧ 은 **③④ 만** 봤다 ⟹ **①에서 버려진 후보가 카드에서는 「참고가격에 반영」** 이었다.
 * 🔴 그 모양은 가상이 아니다 — 「🟡 품번 충돌 · 참고」 군(`CANDIDATE-POSSIBLE-CONFLICT-01` ·
 *    실제 후보 `b226ab046`)이 **가격을 들고** 그 자리에 선다.
 *
 * 🔴 **고치지 않은 것** — 집계기 · 분모 · 자격 조건 · tier · verdict · 판정 · CASE ·
 *    추천가격 · SAME/PRESUMED/POSSIBLE 정책 · 차액(= 추가 금지). 바뀐 것은 **표시 한 줄** 이다.
 */

const DIR = join(__dirname, "..");
const SEL_SRC = stripComments(readFileSync(join(DIR, "mi-same-candidates.ts"), "utf8").replace(/\r\n/g, "\n"));
const AGG_SRC = stripComments(
  readFileSync(
    join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "candidate-market.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n"),
);
const INTEL_SRC = stripComments(
  readFileSync(
    join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "market-intelligence.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n"),
);

/* ════════════════════════ 입력 — 운영 모양 그대로 ════════════════════════ */

/** 🔴 운영이 내는 값들이다 — 조합을 **미리 거르지 않는다**(거르면 틈이 숨는다). */
const MATCH_TRUTHS = [
  "EXACT_IDENTIFIER",
  "STRONG_IDENTIFIER",
  "TEXT_CONFIRMED",
  "SIMILAR",
  "CONFLICT",
  "INSUFFICIENT_EVIDENCE",
] as const;
const VERDICTS = ["SAME", "PRESUMED_SAME", "SIMILAR", "CONFLICT", "UNKNOWN", null] as const;
const STATUSES = ["VERIFIED_CURRENT", "UNVERIFIED_SEARCH", null] as const;
/** 🔴 `BRAND_UNCONFIRMED` 는 **자격을 뺏지 않는다**(실측: 그 사유 4건이 사람 SAME). */
const BLOCKER_SETS: readonly string[][] = [[], ["BRAND_UNCONFIRMED"], ["BRAND_MISMATCH"]];

/** 🟢 `PRICE_ELIGIBLE_VERDICTS` 의 값 — 🔴 사본이 아니라 **대조용** 이다(집계기 소유). */
const ELIGIBLE_VERDICTS = new Set(["SAME", "PRESUMED_SAME"]);

interface Combo {
  matchTruth: (typeof MATCH_TRUTHS)[number];
  verdict: (typeof VERDICTS)[number];
  priceStatus: (typeof STATUSES)[number];
  blockers: string[];
}

const COMBOS: Combo[] = [];
for (const matchTruth of MATCH_TRUTHS)
  for (const verdict of VERDICTS)
    for (const priceStatus of STATUSES)
      for (const blockers of BLOCKER_SETS) COMBOS.push({ matchTruth, verdict, priceStatus, blockers });

const KRW = 88_000;

function rowOf(market: "KR" | "OVERSEAS", c: Combo, amount: number | null = KRW): GeminiTransientRow {
  return {
    source: "REVIEWED_SAME",
    domain: "shop.example.com",
    title: "Booty Ghosts T-Shirt",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: `https://shop.example.com/p/${c.matchTruth}-${c.verdict}-${c.priceStatus}-${c.blockers.join("+")}`,
    matchTruth: c.matchTruth,
    /** 🔴 운영 매핑 — `CONFLICT`/`INSUFFICIENT_EVIDENCE` 는 여기서 `EXCLUDED` 가 된다. */
    priceTier: priceTierFromLink({ matchTruth: c.matchTruth, verified: false } as never),
    crossSellerVerdict: c.verdict,
    confidence: 0.5,
    /** 🟢 「품번만 충돌한 참고 후보」가 카드로 설 수 있는 최소 조건(제목 + 이유 + 단일 충돌). */
    matchReasons: ["핵심 상품명 일부 일치"],
    crossSellerBlockers: [...c.blockers],
    crossSellerConflicts: ["MODEL_CODE"],
    priceAmount: amount,
    priceCurrency: "KRW",
    priceStatus: c.priceStatus,
    market,
    basis: "DOMAIN",
  } as unknown as GeminiTransientRow;
}

/**
 * 🔴 **생산자 모양을 베낀 것이다** — `market-intelligence.ts` 의 두 push 를 그대로 옮긴다.
 *    🟢 그래서 아래 B-2 가 **그 push 의 칸 구성** 을 소스로 단언한다(모양이 바뀌면 FAIL).
 * 🔴 국내는 **verdict 를 싣지 않는다**(의도된 비대칭 · `sprint3-p1 D-2`).
 */
const toDomesticRecord = (r: GeminiTransientRow): CandidateOverseasPriceRecord =>
  ({
    market: r.market,
    currency: "KRW",
    amount: r.priceAmount,
    priceTier: r.priceTier,
    sellerKey: r.domain,
    priceStatus: r.priceStatus,
    blockers: r.crossSellerBlockers,
  }) as unknown as CandidateOverseasPriceRecord;

/** 🔴 해외는 `verdict` 와 `matchTruth` 를 **싣는다**(그 축의 게이트가 하나 더 산다). */
const toOverseasRecord = (r: GeminiTransientRow): CandidateOverseasPriceRecord =>
  ({
    domain: r.domain,
    url: r.discoveredUrl,
    market: r.market,
    basis: "DOMAIN",
    currency: r.priceCurrency,
    amount: r.priceAmount,
    priceKrwDerived: r.priceAmount,
    priceTier: r.priceTier,
    matchTruth: r.matchTruth,
    verdict: r.crossSellerVerdict,
    priceStatus: r.priceStatus,
    blockers: r.crossSellerBlockers,
  }) as unknown as CandidateOverseasPriceRecord;

/** 🟢 **집계기가 그 금액을 «썼는가»** — 통화 칸이 생겼는지로만 본다(새 계산 0). */
const countedByAggregate = (rec: CandidateOverseasPriceRecord): boolean =>
  summarizeCandidateOverseasPrices([rec]).byCurrency.KRW != null;

/** 🟢 카드가 **서는가**(= 셀러가 그 줄을 읽을 수 있는가). */
const cardOf = (r: GeminiTransientRow, market: "KR" | "OVERSEAS") =>
  selectCandidateList([r], market)[0] ?? null;

/* ════════════════════════════════ A. 평형 ════════════════════════════════ */

describe("MDPC-1 A — 🔴 카드의 「반영/제외」는 **집계와 같은 답** 이어야 한다", () => {
  it("A-1 🔴🔴 품번만 충돌한 참고 후보 — 카드도 **제외** 라고 적는다(이 WU 가 고친 자리)", () => {
    const c: Combo = {
      matchTruth: "CONFLICT",
      verdict: "CONFLICT",
      priceStatus: "VERIFIED_CURRENT",
      blockers: [],
    };
    for (const market of ["KR", "OVERSEAS"] as const) {
      const row = rowOf(market, c);
      /** 🟢 ① 이 후보는 **카드로 선다**(숨기지 않는다 · `CANDIDATE-POSSIBLE-CONFLICT-01`). */
      const card = cardOf(row, market);
      expect(card, `🔴 ${market} — 그 후보가 카드로 서지 않는다(전제가 깨졌다)`).not.toBeNull();
      expect(card!.group).toBe("POSSIBLE");
      /** 🟢 ② 집계기는 그 금액을 **쓰지 않는다**(tier `EXCLUDED`). */
      const rec = market === "KR" ? toDomesticRecord(row) : toOverseasRecord(row);
      expect(countedByAggregate(rec), `🔴 ${market} — 집계 전제가 바뀌었다`).toBe(false);
      /** 🔴🔴 ③ 그러므로 카드도 「반영」이라 적을 수 없다. */
      expect(
        candidatePriceUse(row),
        `🔴🔴 ${market} — 집계는 버렸는데 카드가 「반영」이라 적는다(화면이 거짓말한다)`,
      ).toBe("EXCLUDED_OBSERVED_DIFFERENCE");
    }
  });

  it("A-2 🔴🔴 🇰🇷 **전수 평형** — 카드가 「반영」 ⟺ 집계가 그 금액을 쓴다", () => {
    let carded = 0;
    const mismatch: string[] = [];
    for (const c of COMBOS) {
      const row = rowOf("KR", c);
      if (!cardOf(row, "KR")) continue;
      carded += 1;
      const used = candidatePriceUse(row) === "USED";
      const counted = countedByAggregate(toDomesticRecord(row));
      if (used !== counted) {
        mismatch.push(
          `${c.matchTruth}/${c.verdict}/${c.priceStatus}/[${c.blockers.join(",")}] card=${used} agg=${counted}`,
        );
      }
    }
    /** 🔴 분모가 0 이면 이 계약은 **아무것도 재지 않는다**(측정불가를 PASS 로 쓰지 않는다). */
    expect(carded, "🔴 카드가 서는 조합이 0 이다 — 하니스가 측정을 못 하고 있다").toBeGreaterThan(5);
    expect(mismatch, `🔴🔴 🇰🇷 카드와 집계가 어긋난다:\n${mismatch.join("\n")}`).toEqual([]);
  });

  it("A-3 🔴🔴 🌎 **전수 평형** — 카드가 「반영」 ⟺ 집계가 그 금액을 쓴다", () => {
    let carded = 0;
    let verdictOnly = 0;
    const mismatch: string[] = [];
    /**
     * 🔴🔴 **1차 구현은 여기서 FAIL 했고, 그 FAIL 이 설계를 바꿨다.**
     *    처음에는 `priceTier` 게이트 하나만 카드에 더하고 「verdict 만으로 빠지는 행은
     *    카드로 서지 않는다」를 **안전조건으로 단언** 했다. 🔴 그런데 이 전수가
     *    **반증** 했다 — `matchTruth EXACT_IDENTIFIER`(tier `EXACT`) + `verdict CONFLICT`
     *    가 **카드로 선다**(display tier 는 `matchTruth` 가 정하고 verdict 는 안 본다).
     *    ⟹ 그 행은 집계에서 ②로 빠지는데 카드는 「반영」이라 적었다.
     * 🟢 그래서 카드도 ②를 본다 — 단 **해외 축에만**(국내 생산자는 verdict 를 안 싣는다).
     */
    for (const c of COMBOS) {
      const row = rowOf("OVERSEAS", c);
      if (!cardOf(row, "OVERSEAS")) continue;
      carded += 1;
      if (c.verdict != null && !ELIGIBLE_VERDICTS.has(c.verdict) && row.priceTier !== "EXCLUDED") {
        verdictOnly += 1;
      }
      const used = candidatePriceUse(row) === "USED";
      const counted = countedByAggregate(toOverseasRecord(row));
      if (used !== counted) {
        mismatch.push(
          `${c.matchTruth}/${c.verdict}/${c.priceStatus}/[${c.blockers.join(",")}] card=${used} agg=${counted}`,
        );
      }
    }
    expect(carded, "🔴 카드가 서는 조합이 0 이다 — 하니스가 측정을 못 하고 있다").toBeGreaterThan(5);
    /**
     * 🔴 **분모를 숨기지 않는다** — 「verdict 게이트가 혼자 발화하는 카드」가 실제로
     *    몇 개인지 센다. 0 이 되면 이 계약이 **그 축을 재지 않는 상태** 라는 뜻이다.
     */
    expect(verdictOnly, "🔴 verdict 축이 측정되지 않았다 — 이 전수는 ②를 못 지킨다").toBeGreaterThan(0);
    expect(mismatch, `🔴🔴 🌎 카드와 집계가 어긋난다:\n${mismatch.join("\n")}`).toEqual([]);
  });

  it("A-3b 🔴🔴 **비대칭은 의도다** — 같은 행이 🇰🇷 에서는 「반영」, 🌎 에서는 「제외」", () => {
    /**
     * 🔴 국내 생산자는 verdict 를 싣지 않으므로(계약 `sprint3-p1 D-2`) 🇰🇷 집계는
     *    이 행의 금액을 **쓴다**. 🟢 그래서 카드도 「반영」이라 적는 것이 **정확하다** —
     *    여기에 verdict 게이트를 걸면 **CEO 화면의 「확인 1곳」을 카드가 부정한다**.
     */
    const c: Combo = {
      matchTruth: "EXACT_IDENTIFIER",
      verdict: "CONFLICT",
      priceStatus: "VERIFIED_CURRENT",
      blockers: [],
    };
    const kr = rowOf("KR", c);
    const os = rowOf("OVERSEAS", c);
    expect(kr.priceTier, "전제 — tier 는 EXACT 다(①이 막지 않는다)").toBe("EXACT");
    expect(countedByAggregate(toDomesticRecord(kr)), "🔴 국내 집계 전제가 바뀌었다").toBe(true);
    expect(candidatePriceUse(kr), "🔴 국내에서 반대 방향으로 거짓을 적었다").toBe("USED");
    expect(countedByAggregate(toOverseasRecord(os)), "🔴 해외 집계 전제가 바뀌었다").toBe(false);
    expect(candidatePriceUse(os)).toBe("EXCLUDED_OBSERVED_DIFFERENCE");
  });

  it("A-4 🔴 **순서 계약** — 가격이 없으면 tier 가 `EXCLUDED` 여도 **줄을 만들지 않는다**", () => {
    const row = rowOf(
      "KR",
      { matchTruth: "CONFLICT", verdict: "CONFLICT", priceStatus: "VERIFIED_CURRENT", blockers: [] },
      null,
    );
    expect(row.priceTier, "전제 — 이 행의 tier 는 EXCLUDED 다").toBe("EXCLUDED");
    expect(
      candidatePriceUse(row),
      "🔴 「모른다」를 「제외」로 적었다 — 집계기 순서를 그대로 베끼면 이렇게 된다",
    ).toBe("NOT_PRICED");
    expect(CANDIDATE_PRICE_USE_LABEL.NOT_PRICED, "🔴 그 상태는 줄이 없다").toBeNull();
    /** 🔴 미확인 금액도 같다 — tier 가 EXCLUDED 라도 「제외」로 적지 않는다. */
    const unver = rowOf("KR", {
      matchTruth: "CONFLICT",
      verdict: "CONFLICT",
      priceStatus: "UNVERIFIED_SEARCH",
      blockers: [],
    });
    expect(candidatePriceUse(unver)).toBe("NOT_PRICED");
  });

  it("A-5 🟢 tier 를 **모르면 막지 않는다** — 낡은 저장분을 「제외」로 적지 않는다", () => {
    expect(candidatePriceUse({ priceAmount: KRW, priceStatus: "VERIFIED_CURRENT" })).toBe("USED");
    expect(candidatePriceUse({ priceAmount: KRW, priceStatus: "VERIFIED_CURRENT", priceTier: null })).toBe(
      "USED",
    );
  });
});

/* ════════════════════════════════ B. 보존 ════════════════════════════════ */

describe("MDPC-1 B — 🟢 **지운 것이 없다**(집계·분모·어휘 불변)", () => {
  it("B-1 🟢 집계기의 네 게이트가 **그 순서로** 살아 있다(집계 변경 0)", () => {
    const at = AGG_SRC.indexOf("export function summarizeCandidateOverseasPrices");
    expect(at).toBeGreaterThan(0);
    const body = AGG_SRC.slice(at);
    const order = [
      'r.priceTier === "EXCLUDED"',
      "r.verdict != null && !PRICE_ELIGIBLE_VERDICTS.has(r.verdict)",
      "PRICE_DISQUALIFYING_BLOCKERS.has(b)",
      'r.priceStatus !== PRICE_VERIFIED_STATUS',
    ];
    let cursor = 0;
    for (const needle of order) {
      const i = body.indexOf(needle, cursor);
      expect(i, `🔴 집계 게이트가 사라졌거나 순서가 바뀌었다: ${needle}`).toBeGreaterThan(-1);
      cursor = i;
    }
    /**
     * 🔴 집합의 **값** 은 owner 모듈이 갖는다(B-6). 🟢 여기서는 집계기가 그것을
     *    **읽어서 게이트에 쓴다** 는 것만 본다 — 같은 리터럴을 두 곳에서 세면 사본이 된다.
     */
    expect(AGG_SRC, "🔴 집계기가 자격 집합을 직접 선언했다 — owner 가 둘이 된다").not.toContain(
      'PRICE_ELIGIBLE_VERDICTS = new Set(',
    );
  });

  it("B-2 🔴 **생산자 두 모양** 이 그대로다 — 국내는 verdict 를 싣지 않는다", () => {
    const dom = INTEL_SRC.indexOf("domesticTransientRecords.push({");
    expect(dom).toBeGreaterThan(0);
    const domBody = INTEL_SRC.slice(dom, dom + 420);
    for (const k of ["priceTier", "sellerKey", "priceStatus", "blockers"]) {
      expect(domBody, `🔴 국내 레코드에서 ${k} 가 빠졌다 — 하니스 모양이 거짓이 된다`).toContain(k);
    }
    expect(domBody, "🔴 국내가 verdict 를 싣기 시작했다 — A-2/A-3 의 비대칭 전제가 바뀐다").not.toContain(
      "verdict",
    );
    const os = INTEL_SRC.indexOf("overseasEvidence.push({");
    expect(os).toBeGreaterThan(0);
    expect(INTEL_SRC.slice(os, os + 520)).toContain("verdict: e.crossSellerVerdict");
  });

  it("B-3 🟢 상태는 **셋 그대로** 다 — 새 상태·새 문구를 만들지 않았다", () => {
    expect(Object.keys(CANDIDATE_PRICE_USE_LABEL).sort()).toEqual(
      ["EXCLUDED_OBSERVED_DIFFERENCE", "NOT_PRICED", "USED"].sort(),
    );
    expect(CANDIDATE_PRICE_USE_LABEL.USED).toBe("참고가격에 반영");
    expect(CANDIDATE_PRICE_USE_LABEL.EXCLUDED_OBSERVED_DIFFERENCE).toBe("참고가격 제외 — 상품 차이가 확인됨");
  });

  it("B-4 🟢 **「반영」이 여전히 난다** — 게이트를 더해 기능을 죽이지 않았다", () => {
    const row = rowOf("KR", {
      matchTruth: "TEXT_CONFIRMED",
      verdict: "PRESUMED_SAME",
      priceStatus: "VERIFIED_CURRENT",
      blockers: ["BRAND_UNCONFIRMED"],
    });
    expect(row.priceTier, "전제 — 그 후보의 tier 는 COMPARISON 이다").toBe("COMPARISON");
    expect(candidatePriceUse(row), "🔴 CEO 화면의 「확인 1곳」이 사라진다").toBe("USED");
    expect(countedByAggregate(toDomesticRecord(row))).toBe(true);
  });

  it("B-5 🔴 화면 파일에 **자격 집합 사본이 없다** — 술어는 owner 를 부른다", () => {
    const at = SEL_SRC.indexOf("export function candidatePriceUse");
    expect(at).toBeGreaterThan(0);
    /**
     * 🔴 **1차에 좌표를 틀렸다** — `"\n}"` 로 끝을 잡으니 **매개변수 객체의 닫는 괄호**
     *    (`}): CandidatePriceUse {`)에 걸려 본문을 **한 줄도 자르지 못했다**(단언이
     *    엉뚱한 구간을 봤다 · 이 트랙이 세 번 이상 밟은 그 함정).
     * 🟢 다음 `export` 까지로 자른다 — 그 사이가 이 함수의 본문이다.
     */
    const end = SEL_SRC.indexOf("\nexport ", at + 10);
    expect(end, "🔴 함수 본문의 끝을 찾지 못했다").toBeGreaterThan(at);
    const body = SEL_SRC.slice(at, end);
    expect(body, "🔴 본문이 비었다 — 좌표가 또 틀렸다").toContain("return \"USED\"");
    expect(body, "🔴 blocker 집합을 베꼈다").toContain("isPriceDisqualifiedByObservedDifference");
    expect(body, "🔴 verdict 집합을 베꼈다").toContain("isPriceIneligibleByVerdict");
    expect(body, "🔴 화면이 자기 집합을 만들었다").not.toContain("new Set(");
    for (const b of ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "SAME_SELLER_DISTINCT_LISTING", "PRESUMED_SAME"]) {
      expect(body, `🔴 '${b}' 가 술어 안에 박혔다 — 사본이다`).not.toContain(b);
    }
  });

  it("B-6 🟢 **집합 owner 는 하나** 다 — 집계기와 화면이 같은 모듈을 읽는다", () => {
    const LIB = readFileSync(
      join(__dirname, "..", "..", "..", "..", "lib", "price-eligible-verdicts.ts"),
      "utf8",
    );
    expect(LIB).toMatch(/PRICE_ELIGIBLE_VERDICTS\s*=\s*new Set\(\["SAME",\s*"PRESUMED_SAME"\]\)/);
    /** 🔴 그 모듈은 **import 0** 이어야 한다(브라우저 번들 오염 방지 — 이 파일이 생긴 이유). */
    expect(
      stripComments(LIB.replace(/\r\n/g, "\n")),
      "🔴 owner 모듈이 무언가를 import 했다 — 화면이 그것을 끌어온다",
    ).not.toContain("import ");
    expect(AGG_SRC, "🔴 집계기가 owner 를 읽지 않는다 — 사본이 생겼다").toContain(
      'from "@/lib/price-eligible-verdicts"',
    );
    expect(SEL_SRC, "🔴 화면이 owner 를 읽지 않는다 — 사본이 생겼다").toContain(
      'from "@/lib/price-eligible-verdicts"',
    );
  });
});
