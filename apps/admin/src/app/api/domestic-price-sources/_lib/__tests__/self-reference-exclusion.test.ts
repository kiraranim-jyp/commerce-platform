/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02b(2026-10-11) — 자기참조가 「국내 동일상품」으로 나가지 않는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 아래 URL·제목·가격은 **실측값** 이다(MI-P0-02b 측정, bobochoses.com).
 *    깨끗하게 지어낸 값으로 재면 「쿼리파라미터만 다른 같은 URL」이라는 실제
 *    모양을 놓친다 — 이 저장소가 fixture 를 더럽게 만드는 이유다.
 */
import { describe, expect, it } from "vitest";
import type { ComparisonCandidate, ComparisonSearchResult } from "@commerce/crawler";
import { attachMatchTruth, excludeSelfReference } from "../attach-match-truth";

/** 원상품 — 셀러가 보보쇼즈 공식몰에서 사 온 상품. */
const SOURCE_URL = "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt";
const FOREIGN_CODE = "B226AC114";

/** 🔴 실측: 국내 검색이 돌려준 «같은» URL. 쿼리파라미터만 붙어 있다. */
const SELF_1 =
  "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt?_pos=1&_psq=B226AC114&_psid=399399800&_ss=e";
const SELF_2 =
  "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt?_pos=1&_psq=Bobo+Choses+bolder+half+zipped+sweatshirt&_psid=a0075dd58&_ss=e";
/** 같은 판매처의 «다른» 상품 — 이것은 남아야 한다. */
const OTHER = "https://bobochoses.com/products/b226ac043-mystery-bc-half-zipped-sweatshirt?_pos=3&_ss=e";

function candidate(url: string, title: string, amount: number): ComparisonCandidate {
  return {
    title,
    url,
    price: { amount, currency: "KRW" },
    imageUrl: null,
    confidence: 0.92,
    matchLevel: "very_high",
  };
}

const okResult = (candidates: ComparisonCandidate[]): ComparisonSearchResult => ({
  shopId: "bobochoses.com",
  shopName: "bobochoses.com",
  domain: "bobochoses.com",
  status: "ok",
  candidates,
});

const SELF_CANDIDATES = [
  candidate(SELF_1, "Bobo Choses Bolder half zipped sweatshirt", 168000),
  candidate(SELF_2, "Bobo Choses Bolder half zipped sweatshirt", 168000),
];
const OTHER_CANDIDATE = candidate(OTHER, "Mystery BC half zipped sweatshirt", 162000);

describe("🔴 excludeSelfReference — 「외부 판매처를 찾았다」가 아닌 것을 뺀다", () => {
  it("쿼리파라미터만 다른 같은 URL 이 빠진다(실측 2건)", () => {
    const { results, excluded } = excludeSelfReference([okResult([...SELF_CANDIDATES, OTHER_CANDIDATE])], SOURCE_URL);
    expect(excluded).toBe(2);
    expect(results[0].candidates.map((c) => c.url)).toEqual([OTHER]);
  });

  it("🔴 같은 판매처의 «다른» 상품은 남는다 — 판매처를 통째로 빼는 것이 아니다", () => {
    const { results, excluded } = excludeSelfReference([okResult([OTHER_CANDIDATE])], SOURCE_URL);
    expect(excluded).toBe(0);
    expect(results[0].candidates).toHaveLength(1);
  });

  /**
   * 🔴 후보가 전부 자기참조여서 0건이 되는 것은 `ok` + 0건이다.
   *    「검색을 못 했다」(unsupported / error / not_configured)로 바꾸면 화면이
   *    또 거짓말을 한다 — 이 저장소가 반복해 고쳐 온 실패다.
   */
  it("🔴 전부 빠져도 status 는 ok 로 남는다", () => {
    const { results, excluded } = excludeSelfReference([okResult(SELF_CANDIDATES)], SOURCE_URL);
    expect(excluded).toBe(2);
    expect(results[0].status).toBe("ok");
    expect(results[0].candidates).toHaveLength(0);
  });

  it("status 가 ok 가 아닌 결과는 건드리지 않는다", () => {
    const notConfigured: ComparisonSearchResult = {
      shopId: "x",
      shopName: "x",
      domain: "rakuten.co.jp",
      status: "not_configured",
      candidates: [],
      missingCredentials: ["RAKUTEN_APP_ID"],
    };
    const { results, excluded } = excludeSelfReference([notConfigured], SOURCE_URL);
    expect(excluded).toBe(0);
    expect(results[0]).toEqual(notConfigured);
  });

  it("sourceUrl 이 없으면 아무것도 빼지 않는다 — 없는 기준으로 지우지 않는다", () => {
    const { results, excluded } = excludeSelfReference([okResult([...SELF_CANDIDATES])], undefined);
    expect(excluded).toBe(0);
    expect(results[0].candidates).toHaveLength(2);
  });
});

describe("🔴🔴 실측 재현 — 자기참조가 EXACT_IDENTIFIER 로 올라갔다", () => {
  /**
   * 🔴 이 테스트가 이 수정의 **이유** 다. 품번이 글자까지 같으므로
   *    `attachMatchTruth` 는 자기참조를 막을 근거가 «없다» — 그것은 그 함수의
   *    결함이 아니다. 그래서 가드는 그 «앞» 에 있어야 한다.
   */
  it("가드 없이 통과시키면 자기참조 2건이 EXACT_IDENTIFIER 가 된다", async () => {
    const attached = await attachMatchTruth([okResult(SELF_CANDIDATES)], FOREIGN_CODE, null);
    const truths = attached[0].candidates.map((c) => c.matchTruth);
    expect(truths).toEqual(["EXACT_IDENTIFIER", "EXACT_IDENTIFIER"]);
  });

  it("🟢 가드를 거치면 EXACT_IDENTIFIER 가 하나도 남지 않는다", async () => {
    const { results } = excludeSelfReference([okResult(SELF_CANDIDATES)], SOURCE_URL);
    const attached = await attachMatchTruth(results, FOREIGN_CODE, null);
    expect(attached[0].candidates.map((c) => c.matchTruth)).toEqual([]);
  });

  /**
   * 🔴 **threshold 를 낮추지도 올리지도 않았다** 를 증명한다. 외부의 진짜 다른
   *    상품은 가드 전후로 «같은» 판정을 받아야 한다 — 가드가 판정 기준을
   *    건드렸다면 이 단언이 깨진다.
   */
  it("🔴 외부 후보의 판정은 가드 전후가 동일하다", async () => {
    const before = await attachMatchTruth([okResult([OTHER_CANDIDATE])], FOREIGN_CODE, null);
    const { results } = excludeSelfReference([okResult([OTHER_CANDIDATE])], SOURCE_URL);
    const after = await attachMatchTruth(results, FOREIGN_CODE, null);
    expect(after[0].candidates.map((c) => c.matchTruth)).toEqual(before[0].candidates.map((c) => c.matchTruth));
    expect(after[0].candidates).toHaveLength(1);
  });
});

/* ═══════════ ③ 한글 제목에서 브랜드 품번이 «확인된다» — 실측 고정 ═══════════ */

describe("🔴 confirmBrandCodeInTitle 은 한글 제목에서 작동한다 (MI-P0-02b ③ 실측)", () => {
  /**
   * 🔴 MI-P0-02 1차 보고가 「한글 제목 품번 확인 0/18」을 냈고, 그것을
   *    「한글에서 실패한다」로 읽을 수 있었다. **틀린 해석이다.**
   *    품번을 제목에 적는 판매처(littleluna)가 후보를 0건 돌려줬을 뿐이다 —
   *    그 샵은 영문 질의에 0건이고 한글에만 반응하는데, `lookupBrandAlias` 의
   *    `BRAND_ALIASES` 에 「Main Story」가 «없어서» 폴백이 발화하지 않았다.
   *
   * 🔴 아래 네 제목은 `메인스토리` 질의로 littleluna.co.kr 에서 **실제로 받은**
   *    것이다(2026-10-11). 함수는 넷 다 확인한다.
   */
  const LITTLELUNA_TITLES = [
    "[메인스토리] AW26MS185 - Bubble Sweatshirt - Grey Melange",
    "[메인스토리] AW26MS185 - Bubble Sweatshirt - Graystone",
    "[메인스토리] AW26MS185 - Bubble Sweatshirt - Rose Shadow",
    "[메인스토리] AW26MS185 - Bubble Sweatshirt - Chocolate Brown",
  ];
  /** 🔴 foretforet 은 «자체» 품번만 적는다 — 확인되지 않는 것이 정상이다. */
  const FORETFORET_TITLE = "AW26 2차[메인스토리]멜란지 버블 스웻셔츠-MA26KASST0577356";

  it("한글·대괄호가 섞인 제목에서 AW26MS185 를 확인한다", async () => {
    const { confirmBrandCodeInTitle } = await import("@commerce/crawler");
    for (const t of LITTLELUNA_TITLES) {
      expect(confirmBrandCodeInTitle("AW26MS185", t), t).toBe("AW26MS185");
    }
  });

  it("🔴 판매처 자체 품번만 있는 제목은 확인되지 «않는다» — 지어내지 않는다", async () => {
    const { confirmBrandCodeInTitle } = await import("@commerce/crawler");
    expect(confirmBrandCodeInTitle("AW26MS185", FORETFORET_TITLE)).toBeNull();
  });
});
