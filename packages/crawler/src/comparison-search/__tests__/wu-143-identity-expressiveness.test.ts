import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../cross-seller";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-143 — **세 변경을 재 보고 «셋 다 되돌렸다»** (구현 0 · 2026-10-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 「고쳤다」가 아니라 「왜 못 고쳤는지」를 잠근다.**
 *    다음 사람이 같은 세 변경을 다시 시도할 때 **여기서 먼저 걸리고** 사유를 읽는다.
 *
 * ── 측정한 것 (운영 코드를 임시로 바꿔 «실제 엔진» 으로 쟀다 · 복제식 0) ──────
 * ```
 * C1  AUDIENCE_LINE 보류 제거     → 🔴🔴 **false SAME 13건** (아래 ②)
 * C2  MODEL_CODE 충돌 제거        → 🟡 2상품 leak 0 이지만 **CPO 금지**(전면 해제)
 * C3  품번 exact ⟹ brandOk        → 🔴 **12파일 16건** 충돌(아래 ①)
 * C4  `.kr`+가격없음 ⟹ KR(시장/가격 분리) → 🔴 **알림 체인 계약**이 깨진다(아래 ③)
 * ```
 * 🟢 2상품 GT(19 SAME / 6 DIFFERENT)만 보면 C1+C2+C3 는 **recall 6/19 → 9/19 · leak 0**
 *    이었다. 🔴 **그 표본이 작아서 안전해 보였을 뿐** 이다 — 리포의 목적성 negative
 *    fixture 와 precision 측정 계약이 **전부 반대를 말했다.**
 *    ⟹ 🔴 **「내 표본에서 leak 0」을 「안전」으로 읽지 않는다.** 이 트랙의 반복 교훈이다.
 */

const facts = (over: Partial<ProductFacts>): ProductFacts => ({
  sourceUrl: "https://origin.example/p/1",
  urlSlug: null,
  brand: null,
  brandModelCode: null,
  sellerSku: null,
  title: "",
  coreTitleTokens: [],
  categoryText: null,
  colorText: null,
  materialText: null,
  fitText: null,
  ageRangeText: null,
  sizeLabels: [],
  audienceSignals: [],
  imageUrls: [],
  ...over,
});

/** 🟢 실측 원상품(B226AC010 · Booty Ghosts T-shirt · Heather grey · kids). */
const ORIGIN = facts({
  sourceUrl: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt",
  brand: "Bobo Choses",
  brandModelCode: "B226AC010",
  title: "Booty Ghosts T-shirt",
  coreTitleTokens: ["booty", "ghosts"],
  categoryText: "t-shirts",
  colorText: "heather grey",
  materialText: "organic cotton 100%",
  audienceSignals: ["kids"],
});

/* ═════ ① C3 — 품번 exact 는 «아직» 브랜드 확인이 아니다 (되돌림) ═════ */

describe("① 🔴 품번 exact 만으로 브랜드를 확인하지 않는다 (C3 HOLD)", () => {
  /** 🟢 `beaumonde` 모양 — 후보측 brand **공백** · 품번 exact. */
  const brandBlank = facts({
    sourceUrl: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
    brandModelCode: "B226AC010",
    title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
    coreTitleTokens: ["booty", "ghosts"],
    categoryText: "t-shirts",
    audienceSignals: ["아동"],
  });

  /**
   * 🔴🔴 **왜 되돌렸나** — `brandKnown`/`brandOk` 를 품번 exact 로 충족시키니 **12파일
   *    16건** 이 깨졌고, 그중 셋은 **precision 측정 기준선** 이다:
   * ```
   * wu-057  「품번이 맞아도 브랜드 미확인이면 SAME 이 아니다」 ← WU-057 이 **의도한** 결정
   * wu-068  통합 GT **63쌍** precision · wu-060 False EXACT · wu-069 품번 충돌
   * wu-037  「양쪽 brand 가 없으면 브랜드를 지어내지 않는다」 · fit-normalization
   * ```
   * ⟹ 🔴 「계약 갱신 2건」이 아니라 **GT 63 재측정이 선행인 범위** 다.
   *
   * 🔴 **그리고 켤 때 반드시 같이 측정할 의존** — `m.luxboy.com` 은 품번 **exact** 인데
   *    human **DIFFERENT** 다(WU-142 실측). C3 를 켜면 그 쌍을 막는 것이
   *    **`NO_TITLE_OVERLAP` 하나** 가 된다 ⟹ 그 축 완화와 **절대 같이 가면 안 된다.**
   */
  it("C3-1 후보 brand 가 비면 `BRAND_UNCONFIRMED` 가 **그대로 선다**", () => {
    const m = compareCrossSellerProducts(ORIGIN, brandBlank);
    expect(m.blockers.map((b) => b.blocker)).toContain("BRAND_UNCONFIRMED");
    expect(m.verdict).not.toBe("SAME");
    /** 🟢 그런데 **품번은 축으로 이미 세어진다** — 증거가 없는 게 아니라 브랜드만 모른다. */
    expect(m.axes.map((a) => a.axis)).toContain("MODEL_CODE");
  });

  it("C3-2 🔴 브랜드 «문자열» 을 어느 경로로도 만들지 않는다", () => {
    const before = JSON.stringify(brandBlank);
    const m = compareCrossSellerProducts(ORIGIN, brandBlank);
    expect(JSON.stringify(brandBlank)).toBe(before);
    /** 🔴 샵 이름·도메인·제목에서 브랜드를 긁어오지 않는다(WU-080 금지축). */
    expect(m.reasons.join(" ")).not.toContain("보보쇼즈");
    expect(m.reasons.join(" ")).not.toContain("beaumonde");
  });

  it("C3-3 🔴 샵 이름이 brand 자리에 오면 **여전히 「다르다」로 센다**", () => {
    /** 🟢 `biskuit` 모양 — brand = 샵 이름. 🔴 이것이 **거짓 신호** 인 것은 WU-080 이 측정했다. */
    const shopName = facts({
      sourceUrl: "https://biskuit.kr/product/x/8891/category/367/display/1/",
      brand: "비스킷",
      brandModelCode: "B226AC010",
      title: "[보보쇼즈] 부티 고스트 티셔츠 B226AC010 - 비스킷",
      categoryText: "t-shirts",
    });
    const m = compareCrossSellerProducts(ORIGIN, shopName);
    expect(m.blockers.map((b) => b.blocker)).toContain("BRAND_MISMATCH");
    /** 🔴 그렇다고 "비스킷" 을 브랜드로 **인정하지도 않는다**(양방향 금지). */
    expect(m.verdict).not.toBe("SAME");
  });
});

/* ═════ ② C1 — AUDIENCE_LINE 은 «다른 그래픽» 까지 막고 있었다 ═════ */

describe("② 🔴🔴 AUDIENCE_LINE 보류는 유지된다 (C1 NO-GO · false SAME 13건)", () => {
  const babySameGraphic = facts({
    sourceUrl: "https://cissywears.com/products/bobo-choses-baby-booty-ghosts-t-shirt",
    brand: "Bobo Choses",
    title: "Bobo Choses Baby Booty Ghosts T-Shirt",
    coreTitleTokens: ["booty", "ghosts"],
    categoryText: "t-shirts",
    colorText: "heather grey",
    materialText: "organic cotton 100%",
    audienceSignals: ["baby"],
  });

  /**
   * 🔴🔴🔴 **CPO 정책은 맞는데 이 축은 그 일만 하고 있지 않았다.**
   *
   * CPO 확정(2026-10-22) — 「같은 그래픽의 BABY/CHILD 는 동일상품 · 재고 차이로 처리」.
   * 그대로 보류를 없애고 **전체 회귀** 를 돌리니 `cross-seller-matching.test.ts` 의
   * 5쌍 negative fixture 가 **13건** 깨졌다:
   * ```
   * 원상품 430632(아동) ↔ bobochoses **Mush Monster Duo** all over T-shirt   → SAME
   *                     ↔ bobochoses **Softpaw Monster** all over T-shirt    → SAME
   *                     ↔ junioredition **Juicy Tomatoes** All Over Baby Tee → SAME
   *                     ↔ junioredition **Bobo Choses Color** All Over Baby  → SAME
   * ```
   * 🔴 그 넷은 **BABY판이 아니라 «다른 그래픽»** 이다. 「all over T-shirt」 공통 어휘로
   *    제목·상품군·소재·대상 축이 맞아떨어지고, **가르던 유일한 축이 연령 라인** 이었다.
   * ⟹ 🔴 CPO 절대조건(DIFFERENT → SAME = 0) 위반 ⟹ **되돌렸다.**
   *
   * 🟡 **정책을 구현하려면 범위를 좁혀야 한다**(다음 WU · CPO 판정):
   *    「연령 라인이 달라도 **핵심 상품명 토큰이 사실상 동일** 할 때만 비차단」 —
   *    위 넷은 그래픽 이름이 **서로 다르다**. 🔴 새 규칙이고 표본 설계가 선행이다.
   */
  it("A-1 🔴 BABY↔CHILD 는 **여전히 보류다** — 없애면 다른 그래픽이 샌다", () => {
    const m = compareCrossSellerProducts(ORIGIN, babySameGraphic);
    expect(m.blockers.map((b) => b.blocker)).toContain("AUDIENCE_LINE");
    expect(m.verdict).not.toBe("SAME");
  });

  it("A-2 🟢 그 사실은 `reasons` 에 **보류로** 적힌다(관측으로 내리지 않았다)", () => {
    const m = compareCrossSellerProducts(ORIGIN, babySameGraphic);
    expect(m.reasons.some((r) => r.startsWith("보류: 연령 라인"))).toBe(true);
    /** 🔴 「관측:」으로 내려가 있으면 C1 이 되돌아온 것이다 — 여기서 FAIL 로 잡는다. */
    expect(m.reasons.some((r) => r.startsWith("관측: 연령 라인"))).toBe(false);
  });

  it("A-3 🟢 **그리고 그 보류 하나에만 의존하지 않는다** — 상품 형태도 따로 막는다", () => {
    /** 🔴 `tinyapple` 실측 — "Baby Booty Ghosts **sweatshirt**" 는 human DIFFERENT 다. */
    const babySweatshirt = facts({
      ...babySameGraphic,
      sourceUrl: "https://www.tinyapple.net/p/9",
      title: "Bobo Choses Baby Booty Ghosts sweatshirt",
      categoryText: "sweatshirts",
    });
    const m = compareCrossSellerProducts(ORIGIN, babySweatshirt);
    expect(m.verdict).not.toBe("SAME");
  });
});

/* ═════ ③ C2 — MODEL_CODE 충돌은 그대로다 (CPO 금지) ═════ */

describe("③ 🔴 MODEL_CODE 충돌은 전면 해제하지 않는다 (C2 금지)", () => {
  it("M-1 AC ↔ AB 는 **여전히 CONFLICT** 다", () => {
    /**
     * 🟡 CF 에서 전면 해제를 재 봤다 — 2상품에서 **SAME 3→5 · leak 0**(좋아 보였다).
     * 🔴 그런데 CPO 가 **「AC↔AB 한정」** 을 명시했고(「`B226AC141` 은 반드시 방어 유지」),
     *    전면 해제는 WU-069/070 이 **GT 51·63쌍에서 「품번 보호 해체」** 로 측정한 그것이다.
     *    ⟹ 표본 19건의 leak 0 으로 전면 규칙을 바꾸지 않는다.
     */
    const otherLine = facts({
      sourceUrl: "https://other.example/p/5",
      brand: "Bobo Choses",
      brandModelCode: "B226AB046",
      title: "Booty Ghosts T-shirt",
      coreTitleTokens: ["booty", "ghosts"],
      categoryText: "t-shirts",
    });
    expect(compareCrossSellerProducts(ORIGIN, otherLine).conflicts.map((c) => c.conflict)).toContain("MODEL_CODE");
  });

  it("M-2 🟢 **전제** — 같은 라인의 다른 번호는 색상이 «따로» 막는다", () => {
    /** 🔴 `junioredition` 실측 — `B226AC141` · Light Blue · human DIFFERENT. */
    const otherModelOtherColor = facts({
      sourceUrl: "https://www.junioredition.com/p/7",
      brand: "Bobo Choses",
      brandModelCode: "B226AC141",
      title: "Booty Ghosts T-Shirt by Bobo Choses",
      coreTitleTokens: ["booty", "ghosts"],
      categoryText: "t-shirts",
      colorText: "light blue",
    });
    const m = compareCrossSellerProducts(ORIGIN, otherModelOtherColor);
    expect(m.verdict).toBe("CONFLICT");
    const said = [...m.conflicts.map((c) => c.conflict), ...m.blockers.map((b) => b.blocker)];
    /** 🟢 품번이 풀려도 **색상이 남는다**(이중 방어 · C2 를 열 때의 전제다). */
    expect(said.some((s) => String(s).startsWith("COLOR"))).toBe(true);
  });
});
