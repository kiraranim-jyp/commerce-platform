/**
 * ════════════════════════════════════════════════════════════════════════════
 *  고시품목 — **의미는 Canonical 에서 하나, 코드는 채널에서 변환** (CPO P0-6)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 가 본 것: 「LotteON 에는 고시품목이 있는데 다른 Commerce 는 자동으로 의류로
 * 들어가는 것 같다」. 코드를 전수로 따라가 보니 **맞았고, 더 나빴다** —
 * 세 채널이 «서로 다른 입력» 으로 «각자» 판정하고 있었다:
 *
 *   SmartStore  categoryRequiresChildCertification (채널 카테고리 플래그)
 *                 → "KIDS" / "WEAR"            (하드코딩 문자열)
 *   Coupang     상품명 키워드 + 필드 수         (채널이 준 카테고리 목록에서 선택)
 *   LotteON     카테고리 경로의 한국어 낱말      → "01" / "23" (2자리 코드)
 *
 * 🔴 **같은 상품이 채널마다 다른 고시품목으로 신고될 수 있는 구조였다.**
 *    SmartStore 카테고리에 어린이인증 플래그가 없고 LotteON 경로에 「아동」이
 *    있으면, 한쪽은 일반 의류로 다른 쪽은 어린이제품으로 나간다. 규제 신고가
 *    채널마다 다른 것은 「UX 가 다르다」가 아니라 «사실이 다르다» 다.
 *
 * ── 이 모듈이 하는 것 / 하지 않는 것 ────────────────────────────────────
 *
 *   한다      「이 상품은 어린이제품 의류인가 / 일반 의류인가 / 모르는가」를
 *             **한 곳에서** 판정한다. 그것이 canonical 의 «의미» 다.
 *   하지 않는다 채널 코드를 만들지 않는다. "KIDS"·"01"·"23" 같은 코드 변환은
 *             각 채널 builder 가 자기 매퍼로 한다(채널 API 어휘가 실제로 다르다).
 *
 * 🔴 판정 근거를 «지어내지 않는다». 쓰는 신호는 셋뿐이고 전부 이미 있는 것이다:
 *    ① 채널 카테고리가 명시한 어린이인증 필요 여부 ② 카테고리 경로의 낱말
 *    ③ `resolveProductSignals` 의 연령축(상품명/설명에서 뽑은 것)
 * 🔴 모르면 `UNKNOWN` 으로 «남긴다». 「일단 의류」로 떨어뜨리지 않는다 —
 *    그것이 지금 Coupang·SmartStore 에서 벌어지고 있는 일이고 CEO 가 본 것이다.
 */

/** 고시품목의 «의미». 🔴 채널 코드가 아니다 — 코드 변환은 builder 가 한다. */
export type NoticeCategoryKind =
  /** 어린이제품(의류) — 규제가 더 무겁다. */
  | "KIDS_APPAREL"
  /** 일반 의류. */
  | "APPAREL"
  /** 가르지 못했다. 🔴 「일단 의류」로 떨어뜨리지 않는다. */
  | "UNKNOWN";

export interface NoticeCategoryVerdict {
  kind: NoticeCategoryKind;
  /** 셀러에게 보여줄 한 줄. 🔴 왜 그렇게 봤는지 적는다. */
  reason: string;
  /** 판정 근거가 된 토막. 없으면 빈 배열. */
  matched: string[];
}

export interface NoticeCategorySignals {
  /**
   * 채널 카테고리가 「어린이제품 인증이 필요하다」고 «명시» 했는가.
   * 🔴 이것이 1순위다 — 추론이 아니라 채널이 적어 준 사실이다.
   * (SmartStore 의 `categoryRequiresChildCertification` 이 바로 이 값이다.)
   */
  childCertificationRequired?: boolean;
  /** 선택된 카테고리의 전체 경로 이름. 대 > 중 > 소 > 세. */
  categoryPath?: readonly string[];
  /**
   * `resolveProductSignals(product).ageGroup` — 상품명/설명에서 뽑은 연령축.
   * 🔴 추론이므로 3순위다. 카테고리가 말해 주면 그것을 먼저 믿는다.
   */
  ageGroup?: "baby" | "kids" | "teen" | "adult" | "unknown";
}

/**
 * 🔴 어휘를 새로 만들지 않는다 — `lotteon/notice-item-suggest.ts` 가 실측으로
 *    모아 둔 그 목록을 그대로 올렸다. 두 벌을 두면 채널마다 다르게 판정한다
 *    (그것이 바로 이 모듈이 없애려는 결함이다).
 */
const CHILD_WORDS = ["유아", "아동", "베이비", "주니어", "키즈", "신생아", "영아", "어린이"];
const APPAREL_WORDS = [
  "의류",
  "상의",
  "하의",
  "티셔츠",
  "셔츠",
  "니트",
  "원피스",
  "바지",
  "스커트",
  "자켓",
  "재킷",
  "점퍼",
  "코트",
  "조끼",
  "트레이닝복",
  "수영복",
  "언더웨어",
  "속옷",
  "잠옷",
  "패션의류",
];
/** 🔴 「의류가 아닌데 의류 낱말이 들어간」 경로를 빼낸다 — 가방·신발·용품. */
const NOT_APPAREL_WORDS = ["가방", "지갑", "신발", "슈즈", "모자", "양말", "용품", "장비", "라켓", "공"];

function hit(parts: readonly string[], words: readonly string[]): string[] {
  return parts.filter((part) => words.some((word) => part.includes(word)));
}

/** 어린이제품으로 보는 연령축. 🔴 `adult`·`unknown` 은 «아니다». */
const CHILD_AGE_GROUPS = new Set(["baby", "kids", "teen"]);

/**
 * 고시품목의 «의미» 를 한 곳에서 판정한다.
 *
 * 우선순위 — 위에서 아래로, 먼저 맞는 것이 이긴다:
 *
 *   ① 채널이 「어린이인증 필요」라고 명시 → KIDS_APPAREL
 *      🔴 채널이 적어 준 사실이 추론을 이긴다.
 *   ② 카테고리 경로에 어린이 낱말 → KIDS_APPAREL
 *      🔴 의류 낱말보다 «먼저» 본다. 「유아동 의류」는 둘 다이고 규제가 무거운
 *         쪽이 적용된다. 순서를 뒤집으면 아동복이 일반 의류로 신고된다.
 *   ③ 카테고리 경로에 의류 낱말(비의류만 있는 경로는 제외)
 *      → 상품 연령축이 아동이면 KIDS_APPAREL, 아니면 APPAREL
 *   ④ 그 외 → UNKNOWN
 */
export function resolveNoticeCategory(signals: NoticeCategorySignals): NoticeCategoryVerdict {
  const parts = (signals.categoryPath ?? []).map((p) => (p ?? "").trim()).filter(Boolean);

  if (signals.childCertificationRequired === true) {
    return {
      kind: "KIDS_APPAREL",
      reason: "카테고리가 어린이제품 인증을 요구합니다 — «어린이제품» 고시입니다.",
      matched: [],
    };
  }

  const child = hit(parts, CHILD_WORDS);
  if (child.length > 0) {
    return {
      kind: "KIDS_APPAREL",
      reason: `카테고리에 「${child.join(" · ")}」가 있어 «어린이제품» 고시로 봅니다.`,
      matched: child,
    };
  }

  const apparel = hit(parts, APPAREL_WORDS);
  const notApparel = hit(parts, NOT_APPAREL_WORDS);

  /* ══ 🔴 실측이 잡은 결함(2026-10-10, 두 상품 라이브) ════════════════════

     Smallable 아기 바지에서 이 함수는 `KIDS_APPAREL` 을 돌려주는데, 네이버
     payload 는 `"WEAR"`(일반 의류)로 나갔다. 즉 **공통화가 네이버에서는
     아무 일도 하지 않았다.**

     원인: 네이버 입력에는 카테고리 «경로 이름» 이 없다(숫자 id 뿐). 그래서
     `parts` 가 비고, 아래 「의류 낱말이 있어야 연령축을 본다」 관문에서 막혀
     `UNKNOWN` → `"WEAR"` 로 떨어졌다. 연령축 신호가 «닿지 못하는» 구조였다.

     ══ 🔴 그래서 「경로가 없으면 연령축을 본다」로 고쳤다가 **되돌렸다.** ══

     그 변경은 네이버 선재 테스트 7건을 깼고, 깨진 내용이 중요했다 — fixture 가
     「아동용 반팔 티셔츠 · 권장연령 3세」인데 **네이버 카테고리는 어린이인증을
     요구하지 않는** 경우였다. 즉 두 사실이 서로 다르게 말한다.

     🔴 그 상황에서 payload 를 `KIDS` 로 바꾸는 것은 **내가 확인할 수 없는 규제
        주장을 새로 만드는 것**이다. 어린이제품 고시는 KC 인증 항목을 더 요구하고,
        채널 카테고리가 어린이제품이 아닌데 어린이제품으로 신고하면 네이버가
        거절할 수도 있다 — 그 결과는 실제 등록 없이는 알 수 없다.
        「API 문서에 있다」가 capability 근거가 아닌 것과 같은 축이다.

     🔴 따라서 **채널이 적어 준 플래그가 네이버에서는 최종 권한**이다. 연령축은
        카테고리 경로가 «있을» 때만 본다(롯데ON 경로). 네이버에는 경로가 없으므로
        연령축이 닿지 않는다 — 그 사실을 숨기지 않고 Known Unknown 으로 남긴다.
        고칠 길은 네이버 입력에 카테고리 «경로 이름» 을 넣는 것이고, 그건 이
        배치의 범위가 아니다(카테고리 조회 경로를 건드려야 한다). */
  if (apparel.length > 0 && notApparel.length === 0) {
    if (signals.ageGroup && CHILD_AGE_GROUPS.has(signals.ageGroup)) {
      return {
        kind: "KIDS_APPAREL",
        reason: `상품 정보가 「${signals.ageGroup}」 연령대를 가리켜 «어린이제품» 고시로 봅니다 — 확인해 주세요.`,
        matched: apparel,
      };
    }
  }

  if (apparel.length === 0) {
    return {
      kind: "UNKNOWN",
      reason:
        notApparel.length > 0
          ? `「${notApparel.join(" · ")}」 카테고리입니다 — 의류·어린이제품 고시가 아니라 품목을 직접 골라 주세요.`
          : parts.length === 0
            ? "카테고리를 먼저 선택해주세요."
            : "이 카테고리의 고시 품목을 따져가 판단하지 못했습니다 — 직접 골라 주세요.",
      matched: notApparel,
    };
  }

  return {
    kind: "APPAREL",
    reason: `카테고리에 「${apparel.join(" · ")}」가 있어 «의류» 고시로 봅니다.`,
    matched: apparel,
  };
}

/**
 * LotteON 품목코드로 변환한다. 🔴 변환«만» 한다 — 판정은 위 함수 하나가 했다.
 *
 * `"01"` 의류 · `"23"` 어린이제품 · `null` 모름(셀러가 직접 고른다).
 */
export function lotteOnNoticeItemCodeFor(kind: NoticeCategoryKind): "01" | "23" | null {
  switch (kind) {
    case "KIDS_APPAREL":
      return "23";
    case "APPAREL":
      return "01";
    default:
      return null;
  }
}

/**
 * 네이버 `productInfoProvidedNoticeType` 으로 변환한다.
 *
 * 🔴 `UNKNOWN` 은 `"WEAR"` 로 간다 — **기존 동작을 바꾸지 않기 위해서다.**
 *    지금 네이버 builder 는 어린이인증 플래그가 false 면 무조건 `"WEAR"` 를 넣고
 *    있고, 그 경로에는 실제 등록 성공 이력이 있다. 여기서 `undefined` 로 바꾸면
 *    고시 블록 자체가 사라져 등록이 거절된다 — 그건 이 배치의 범위가 아니다.
 *    🔴 다만 「모름을 의류로 신고하고 있다」는 사실은 남는다(Known Unknown).
 */
export function naverNoticeTypeFor(kind: NoticeCategoryKind): "KIDS" | "WEAR" {
  return kind === "KIDS_APPAREL" ? "KIDS" : "WEAR";
}
