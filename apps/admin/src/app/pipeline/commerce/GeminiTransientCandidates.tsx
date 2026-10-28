/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-022 — **Gemini 웹 검색 후보** 를 «이번 확인에만» 보여주는 구역
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 별 구역인가 — 기존 후보 카드(`CandidateCard`)는 `domestic_product_links`
 * (**DB 테이블**)를 읽는다. Gemini 후보는 그 테이블에 **절대 저장하지 않는다**
 * (저장 차단 불변식). 그래서 같은 목록에 섞을 수 없고, 섞으면 「저장된 후보」처럼
 * 읽힌다. 🔴 **데이터의 수명이 다르면 구역도 달라야 한다.**
 *
 * ── 🔴 이 컴포넌트가 «하지 않는» 것 (WU-022 §4) ────────────────────────────
 * ```
 * ❌ 통화 환산 · 해외 가격 집계 · 국내 최저가 반영 · 판매판정 반영
 * ❌ DB 저장 · 링크 승격(「동일상품 확인」 버튼을 달지 않는다)
 * ❌ 시장을 추측해서 「국내/해외」로 적기 — UNKNOWN 은 UNKNOWN 으로 둔다
 * ```
 * 🟢 **표시만 한다.** 서버가 이미 낸 값을 옮기고, 없는 값은 「미확인」으로 적는다.
 */
import type { JSX, ReactNode } from "react";
/**
 * 🔴🔴 WU-028 — 매칭 등급의 **말(label)** 은 이 파일이 owner 다(`MATCHING-UNIFY-1`).
 *    국내/해외 화면이 각자 라벨 맵을 들고 있다가 같은 판정이 화면마다 다르게 보였던
 *    사고를 고친 자리다. 🔴 그래서 여기서 `crossSellerVerdict` 원문(`PRESUMED_SAME`)을
 *    그대로 찍지 않고 **그 owner 가 정한 말** 을 쓴다 — 새 어휘를 만들지 않는다.
 */
/**
 * 🔴 WU-132 — 등급 선택 owner. 🟢 이 파일은 **타입만** 거꾸로 내보내므로(아래
 *    `GeminiTransientRow`) 런타임 순환이 생기지 않는다(type import 는 지워진다).
 */
import { transientDisplay } from "./mi-same-candidates";

/**
 * 🔴 `GeminiTransientEvidence`(run-domestic-price-check.ts)의 **화면이 읽는 칸만**
 *    옮긴 모양이다. 🔴 서버 타입을 직접 import 하지 않는다 — 이 파일은 클라이언트
 *    컴포넌트이고 그쪽은 서버 모듈(DB 클라이언트)을 끌고 온다.
 * 🔴 칸 이름은 서버 타입과 **글자 그대로** 같게 둔다(매핑 코드를 만들지 않는다).
 */
export interface GeminiTransientRow {
  domain: string;
  /** 🔴 WU-028 — 판매처만으로는 「무엇이 그 가격인가」를 말할 수 없다. */
  title?: string | null;
  /** 🔴 WU-028 — 이 후보가 **어디서 왔는가**. 행에서도 출처가 보여야 한다. */
  /** 🔴 E2E-04 — runner 의 `GeminiTransientEvidence.source` 와 **같은 집합** 이어야 한다. */
  source?: "GEMINI_DISCOVERY" | "SELLER_URL" | "OVERSEAS_AUTO" | "REVIEWED_SAME" | "DOMESTIC_LISTING" | "WEB_SEARCH" | null;
  /**
   * 🔴🔴 WU-132 ④ — **후보 대표 이미지.** 셀러가 「동일상품인가」를 가르는 수단이
   *    글자뿐이면 판단이 안 된다 — WU-099 에서 CEO 평가 26건 중 **12건이 「이미지가
   *    없어서」 측정불가** 로 돌아온 그 자리다.
   * 🔴 없으면 `null` 이고 화면이 「이미지 없음」이라고 **적는다**(대체 사진 금지).
   */
  imageUrl?: string | null;
  /**
   * 🔴🔴 WU-132 ② — **지금 팔고 있는가.** 🔴 `null` 은 「판매중」이 **아니다** —
   *    「그 사이트에서 확인할 방법이 없다」다(기존 `StockBadge` 와 같은 규칙).
   */
  soldOut?: boolean | null;
  /** 🔴 WU-028 — 가격 «신뢰도». 숫자 옆에 이것이 없으면 가격이 확정처럼 읽힌다. */
  priceStatus?: string | null;
  discoveredUrl: string;
  /** 🟢 교차판매처 판정. 서버가 낸 값 그대로(SAME / PRESUMED_SAME / SIMILAR / …). */
  crossSellerVerdict?: string | null;
  matchTruth?: string | null;
  priceTier?: string | null;
  confidence?: number | null;
  matchReasons?: string[];
  crossSellerBlockers?: string[];
  crossSellerConflicts?: string[];
  priceAmount?: number | null;
  priceCurrency?: string | null;
  /** 🔴 시장 분류. `KR` / `OVERSEAS` / `UNKNOWN` — WU-020 의 `classifyCandidateMarket` 산출. */
  market?: string | null;
  basis?: string | null;
}

/** 🟢 구역 머리 문구 — CPO 가 글자로 지정했다(WU-022 §3). 바꾸지 않는다. */
export const TRANSIENT_NOTICE = "이번 확인에만 쓰이고 저장되지 않습니다.";
export const TRANSIENT_SCOPE_NOTICE =
  "이 후보 정보는 국내 최저가 및 판매판정에 영향을 주지 않습니다.";

/** 🔴 가격이 없을 때 적는 말. 「0원」·「-」로 적지 않는다. */
export const PRICE_UNKNOWN_TEXT = "가격 미확인";

/**
 * 🔴 시장은 **확인된 경우에만** 적는다. `UNKNOWN`·없음은 **아무 말도 하지 않는다**
 *    (「국내」로도 「해외」로도 적지 않는다 — WU-020 §4 와 같은 규칙).
 */
export function marketText(market: string | null | undefined): string | null {
  if (market === "KR") return "국내";
  if (market === "OVERSEAS") return "해외";
  return null;
}

/** 🟢 가격은 **통화를 그대로** 붙여 적는다. 🔴 환산하지 않는다. */
export function priceText(row: GeminiTransientRow): string {
  if (row.priceAmount == null || !row.priceCurrency) return PRICE_UNKNOWN_TEXT;
  return `${row.priceCurrency} ${row.priceAmount.toLocaleString("ko-KR")}`;
}

/** 🔴 WU-028 — 행에 붙는 **출처** 배지. 입력부와 결과부를 잇는 유일한 표시다. */
export const SOURCE_LABEL: Record<
  "GEMINI_DISCOVERY" | "SELLER_URL" | "OVERSEAS_AUTO" | "REVIEWED_SAME" | "DOMESTIC_LISTING" | "WEB_SEARCH",
  string
> = {
  SELLER_URL: "직접 입력",
  GEMINI_DISCOVERY: "웹 검색",
  /** 🔴 WU-130 — 「자동」이라고 **적는다**. 셀러가 한 일이 아니라는 것이 이 배지의 전부다. */
  OVERSEAS_AUTO: "해외 자동검색",
  /**
   * 🔴🔴 WU-132 ⑥ — 「이전에 **당신이** 동일상품이라고 판단한 후보를 우리가 다시
   *    확인했다」는 뜻이다. 🔴 「직접 입력」으로 적으면 셀러가 **지금 넣은 줄** 안다.
   */
  REVIEWED_SAME: "이전 확인 후보",
  /**
   * 🔴🔴🔴 E2E-04 — **이 둘이 유니온에 없어서 배지가 빈칸으로 나갈 상태였다**
   *    (`SOURCE_LABEL[row.source]` 가 `undefined`). 🟢 typecheck 가 잡았다.
   * 🔴 `GEMINI_DISCOVERY`(「웹 검색」)와 **다른 말** 을 쓴다 — 같은 말을 쓰면
   *    셀러가 두 출처를 구별할 수 없고, 그것이 출처 배지의 존재 이유를 지운다.
   */
  DOMESTIC_LISTING: "국내 목록 탐색",
  WEB_SEARCH: "AI 검색",
};

/**
 * 🔴🔴 WU-028 — **가격 숫자 옆에 「이 가격이 어디까지 확인된 것인가」를 붙인다.**
 *
 * 왜: Production 화면에 `KRW 117,000` 이 떴는데 판매판정은 「국내 동일상품 가격을
 * 확인하지 못했습니다」였다. 둘 다 맞는 말인데 **같은 화면에서 모순처럼 읽힌다**
 * (CPO 화면 검토 ③·④). 원인은 가격의 **검증 상태** 가 화면에 없기 때문이다.
 *
 * 🔴 **정책을 바꾸지 않는다.** `UNVERIFIED_SEARCH` 를 verified 로 승격하지 않고,
 *    집계/판정에 넣지도 않는다 — 바꾸는 것은 **말** 뿐이다.
 * 🔴 내부 enum 을 그대로 노출하지 않는다. 모르는 값은 **지어내지 않고** null 이다.
 */
export function priceConfidenceText(row: GeminiTransientRow): string | null {
  if (row.priceAmount == null || !row.priceCurrency) return null;
  if (row.priceStatus === "VERIFIED_CURRENT") return "상세 페이지에서 확인한 가격 · 판매판정 미반영";
  if (row.priceStatus === "UNVERIFIED_SEARCH") return "판매처 표시가 · 상세 검증 전 · 판매판정 미반영";
  if (row.priceStatus === "PRICE_UNAVAILABLE") return "가격을 확인하지 못했습니다";
  return "판매판정 미반영";
}

/**
 * 🔴 WU-028 — 판정 배지. **라벨 owner(`domesticMatchDisplay`)를 그대로 부른다.**
 * 🟢 `matchTruth` 가 그 함수의 입력이다. 없으면(판정 전) **지어내지 않고** null.
 */
export function verdictDisplay(row: GeminiTransientRow): { icon: string; label: string; note: string } | null {
  /**
   * 🔴🔴 WU-132 — **등급을 고르는 규칙은 이제 owner 가 «하나» 다**(`transientDisplay`).
   *
   * 왜 옮겼나 — 가격비교 선별기(`selectMiSameCandidates`)가 **같은 판단**(「이 행의
   * 등급이 SAME 인가」)을 해야 했고, 여기에 사본을 두면 **화면의 배지와 가격비교가
   * 서로 다른 등급을 말하는 날** 이 온다. 🔴 이 저장소가 반복해서 고쳐 온 그 실수다
   * (`match-display.ts` 머리 주석의 MATCHING-UNIFY-1 과 같은 이유).
   * 🟢 규칙 자체는 **한 글자도 바뀌지 않았다** — `matchTruth` 우선, 없으면
   *    교차판매처 판정값, 둘 다 없으면 `null`.
   */
  const d = transientDisplay(row);
  return d ? { icon: d.icon, label: d.label, note: d.note } : null;
}

/** 🟢 기본 머리 문구 — Gemini 웹 검색 경로의 것이다(WU-022 에서 CPO 가 지정). */
export const WEB_SEARCH_HEADING = "🔎 웹 검색 후보";
/**
 * 🔴🔴 WU-024 — **출처가 다르면 머리 문구도 달라야 한다.** 셀러가 직접 넣은 URL 을
 *    「웹 검색 후보」로 적으면 거짓이다(§7 출처 보존). 구역을 가르는 이유가 그것이다.
 */
export const SUPPLIED_URL_HEADING = "🔗 직접 입력한 후보";
/**
 * 🔴🔴 WU-130 — **해외 자동검색 후보.** 위 둘과 머리 문구를 가르는 이유가 하나 더 있다 —
 *    이 구역은 셀러가 **아무것도 하지 않아도** 서기 때문에, 「직접 입력한 후보」로 적으면
 *    셀러가 자기가 넣은 줄 알고 「왜 내가 넣지 않은 판매처가 있나」로 읽는다.
 * 🔴 「동일상품」이라고 **단정하지 않는다** — 「후보」이고 판정은 행마다 따로 적힌다.
 */
export const OVERSEAS_AUTO_HEADING = "🌎 해외 자동검색 후보";
/**
 * 🔴🔴 WU-132 ⑥ — **이전에 「동일상품」으로 판단한 후보를 다시 확인한 구역.**
 *
 * 🔴 「직접 입력한 후보」와 가르는 이유 — 셀러가 **지금 넣지 않은** URL 이다. 같은
 *    구역에 담으면 「내가 이걸 넣었나?」로 읽힌다(WU-130 이 세 번째 구역을 만든 이유).
 * 🔴 「동일상품」이라고 **단정하지 않는다** — 판정은 이번에도 처음부터 다시 했고,
 *    그 결과가 바뀌었을 수 있다(그래서 행마다 판정이 따로 적힌다).
 */
export const REVIEWED_SAME_HEADING = "🔁 이전 확인 후보 재검증";
/**
 * 🔴🔴 CORE-2R-4 — **국내 등록부 «목록» 을 타고 상세로 들어간 후보.** 위 넷과 출처가
 *    다르다 — 셀러가 넣은 것도 아니고 해외 자동검색도 아니다.
 */
export const DOMESTIC_LISTING_HEADING = "🧭 국내 목록 탐색 후보";
/**
 * 🔴🔴🔴 SEARCH-PROVIDER-07 — **외부 검색엔진(AI Search)이 찾아온 후보.**
 *
 * 🔴 `WEB_SEARCH_HEADING`(「🔎 웹 검색 후보」)과 **다른 출처** 다 — 그 상수는 Gemini
 *    Discovery 경로의 것이다(WU-022). 같은 구역에 담으면 **출처 축이 사라진다**
 *    (WU-130 이 구역을 가른 이유와 같다).
 * 🔴 「동일상품」이라고 **단정하지 않는다** — 판정은 행마다 따로 적힌다.
 */
export const AI_SEARCH_HEADING = "🛰 AI 검색 후보";
/**
 * 🔴🔴 WU-081 — **국내 후보 검토 구역.** 해외 축 제목과 **의미가 겹치지 않게** 짓는다.
 * ```
 * 🇰🇷 국내 참고가격            (WU-056 · 금액 «집계»)
 * 🧾 해외 동일상품 참고가격     (WU-056-R1 · 금액 «집계»)
 * 🔎 웹 검색 후보 / 🔗 직접 입력한 후보  (WU-022/024 · 후보 «행»)
 * ✅ 아래가 이번에 추가되는 것 — 후보 «행» 이고 **검토** 를 위한 자리다
 * ```
 * 🔴 「동일상품」이라고 **단정하지 않는다** — 「후보」 이고 판단은 사람이 한다.
 */
export const DOMESTIC_REVIEW_HEADING = "🇰🇷 국내 후보 검토";

/**
 * 🔴🔴🔴 WU-141-R2 STEP 2 — **탐색 과정 전체를 덮는 «하나의» 접힘 라벨.**
 *
 * 🔴 CPO: 「지금 화면은 셀러용 상품등록 화면이 아니라 **MI 조사 로그 화면**」 ·
 *    「**탐색 과정이 결론보다 앞에 나와 있다**」.
 * 🟢 그래서 위 구역들의 **머리 문구는 그대로 두고**(출처 축 보존 · WU-130 계약)
 *    그 전체를 이 한 줄 뒤로 보낸다.
 * 🔴 「후보 보기」가 아니라 **「판단 근거 보기」** 다 — 셀러가 여는 이유는 후보를
 *    구경하는 것이 아니라 **위 결론을 확인** 하는 것이다(CPO 문장 그대로).
 */
export const JUDGEMENT_BASIS_LABEL = "판단 근거 보기";
/**
 * 🔴 후보가 0건일 때의 문구 — **판정 의미를 부여하지 않는다**(§11).
 *
 * 🔴🔴 WU-130 ② — **「조회했다」를 같이 말한다.** 전 문구(「국내 비교 후보가 없습니다.」)는
 *    「조회조차 안 했다」로도 읽혔다. 실측에서 국내 등록부는 **응답했고 후보도 왔지만**
 *    그 후보가 전부 다른 상품이어서 0 이 됐다 — 그 둘은 **다른 사실** 이다.
 * 🔴 「국내에 동일상품이 없다」로는 적지 않는다(WU-091 어휘 계약 · 부재와 미발견은 다르다).
 */
export const DOMESTIC_REVIEW_EMPTY = "국내 판매처를 조회했지만 동일상품 후보를 찾지 못했습니다.";
/**
 * 🔴 입력칸 안내문. **두 가지를 반드시 말한다** — ⒜ 이번 확인에만 쓰이고 저장되지
 *    않는다 ⒝ 동일상품 판정은 **우리가** 한다(셀러가 「동일상품」이라고 선언하는
 *    칸이 아니다). ⒝ 가 빠지면 셀러가 URL 을 넣는 행위를 「동일상품 확인」으로 읽는다.
 */
/**
 * 🔴🔴 WU-091 §5(CPO 지시 2026-10-19) — **첫 문장을 더했다.**
 *    CEO 육안 테스트에서 이 칸이 **주된 후보 탐색 방법처럼** 보였고, 같은 원상품
 *    URL 을 **다시 넣어야 하는 것처럼** 읽혔다. 그래서 **언제 쓰는 칸인지** 를 먼저 말한다.
 * 🔴 뒤의 두 문장은 **지우지 않았다** — WU-024/081 의 안전 계약이다
 *    (⒜ 저장하지 않는다 ⒝ 동일상품 판정은 **우리가** 한다).
 */
/**
 * 🔴🔴 WU-129(CPO 지시 2026-10-20) — **문구를 「URL 직접 찾기」에서 「AI 조사 결과 붙여넣기」로 바꿨다.**
 *    예전 문구는 셀러에게 **「판매처를 직접 찾아 URL 을 넣어라」** 로 읽혔고, 그것은
 *    제품 방향(「URL 하나 넣으면 우리가 찾아준다」)과 **정반대** 였다.
 * 🟢 뒤의 두 문장은 **지우지 않았다** — WU-024/081 의 안전 계약이다
 *    (⒜ 저장하지 않는다 ⒝ 동일상품 판정은 **우리가** 한다).
 * 🔴 **AI 의 SAME/DIFFERENT 판단은 쓰지 않는다 — URL 만 쓴다**(CPO 명시).
 */
export const SUPPLIED_URL_INPUT_NOTICE =
  "외부 AI 에게 「이 상품 어디서 파는지 찾아줘」라고 물어본 뒤, 그 답변을 그대로 붙여넣으세요. 링크만 자동으로 골라 국내·해외 후보로 확인합니다. 이번 확인에만 쓰이고 저장되지 않으며, 동일상품 여부는 저장된 판매처와 같은 기준으로 우리가 다시 판정합니다.";

/** 🔴 WU-129 — 접힌 보조 기능의 제목. 「URL 직접 확인」이 아니다(그 말이 이 칸을
 *  «셀러가 판매처를 찾아오는 일» 처럼 읽히게 했다). */
export const SUPPLIED_URL_INPUT_SUMMARY = "+ AI 조사 결과 붙여넣기";

export interface GeminiTransientCandidatesProps {
  /** 🔴 `null`/빈 배열이면 **구역을 아예 렌더하지 않는다**(flag OFF 가 그 상태다). */
  evidence?: GeminiTransientRow[] | null;
  /**
   * 🔴 머리 문구. 기본은 웹 검색 경로다. 🔴 **판정 문구가 아니다** — 이 값이 바뀌어도
   *    아래 두 고정 안내문과 판정 표시는 한 글자도 바뀌지 않는다.
   */
  heading?: string;
  /** 🟢 두 구역이 같은 화면에 설 수 있으므로 테스트 훅도 가른다. */
  testId?: string;
  /**
   * 🔴🔴 WU-081 — **사람 검토(CEO)**. 기본은 `undefined` 라 기존 두 구역은
   *    **한 픽셀도 바뀌지 않는다**(버튼이 아예 렌더되지 않는다).
   *
   * 🔴 **자동 판정과 같은 칸을 쓰지 않는다.** `row.crossSellerVerdict`(시스템)과
   *    `review[url]`(사람)은 **별개 상태** 이고 서로 덮어쓰지 않는다 —
   *    `systemVerdict = SIMILAR` 과 `humanReview = SAME` 이 **공존** 한다.
   * 🔴 이 값은 MI 판정 · 가격 · 알림 · 판매판정 · 등록 payload 에 **들어가지 않는다.**
   */
  review?: Record<string, HumanReview>;
  onReview?: (url: string, verdict: HumanReview) => void;
  /** 🔴 WU-131 — 후보별 저장 상태. 「눌렀다」가 아니라 **「저장됐다」** 를 말한다. */
  saveState?: Record<string, ReviewSaveState>;
  /**
   * 🔴🔴 WU-132 ④ — **원상품 이미지.** 이 값이 있으면 행마다 **원본 ↔ 후보** 사진을
   *    나란히 그린다. 🟢 없으면(기본) 기존 구역은 **한 픽셀도 바뀌지 않는다**.
   *
   * 🔴 **대체 사진을 쓰지 않는다** — 없으면 그 칸에 「이미지 없음」이라고 적는다.
   *    WU-099 에서 CEO 평가 26건 중 12건이 「이미지가 없어서」 **측정불가** 로
   *    돌아왔고, 그때 빈 칸을 다른 사진으로 메웠다면 그 12건은 **거짓 판단** 이 됐다.
   */
  originImageUrl?: string | null;
  /** 🟢 원본 칸의 설명. 없으면 「원본 상품」이라고만 적는다. */
  originTitle?: string | null;
  /**
   * 🔴🔴 WU-136 §D — **기본 접힘으로 그린다**(「추가 검토 후보 N건」).
   *    🔴 정보를 지우는 것이 아니다 — 셀러의 1순위는 「팔아도 되는가」이고 그 답은
   *       위 **시장 판매 판단** 이 한다. 후보 행은 그 근거이자 GT 입력이라 남는다.
   *    🟢 기본값 `false` 라 **지정하지 않은 구역의 DOM 은 전과 같다**.
   */
  collapsed?: boolean;
}

/** 🔴 이미지가 없을 때 적는 말. 🔴 빈 칸으로 두지 않는다(「없다」와 「못 그렸다」를 가른다). */
export const IMAGE_MISSING_TEXT = "이미지 없음";
export const ORIGIN_IMAGE_LABEL = "원본 상품";
export const CANDIDATE_IMAGE_LABEL = "이 후보";

/** 🔴 재고 문구 — 기존 `StockBadge`(DomesticShopSearch)와 **같은 세 상태** 다. */
export const STOCK_TEXT = {
  SOLD_OUT: "🔴 품절",
  IN_STOCK: "🟢 판매중",
  UNKNOWN: "⚪ 재고 확인불가",
} as const;

export function stockText(soldOut: boolean | null | undefined): string {
  if (soldOut === true) return STOCK_TEXT.SOLD_OUT;
  if (soldOut === false) return STOCK_TEXT.IN_STOCK;
  /** 🔴 `null` 을 「판매중」으로 바꾸지 않는다 — 확인하지 못한 것이다. */
  return STOCK_TEXT.UNKNOWN;
}

/**
 * 🔴 사람 검토 값 — 시스템 verdict 어휘(`SAME`/`PRESUMED_SAME`/…)와 **다른 타입** 이다.
 *
 * 🔴🔴 WU-131 — **넷이 됐다**(CPO §8). 「유사」와 「보류」가 없으면 셀러가 애매한 후보를
 *    억지로 동일/다름 중 하나로 밀어 넣게 되고, 그 억지가 **GT 를 오염시킨다**.
 * 🔴 DB check constraint 와 **같은 어휘** 다(`candidate_reviews.human_verdict`) —
 *    갈라지면 저장이 터진다.
 */
export const HUMAN_REVIEW_VALUES = ["SAME", "SIMILAR", "DIFFERENT", "UNDECIDED"] as const;
export type HumanReview = (typeof HUMAN_REVIEW_VALUES)[number];

/** 🟢 사람 검토 «결과» 문구 — 시스템 판정 라벨(`tierDisplay`)과 섞지 않는다. */
const HUMAN_REVIEW_LABEL: Record<HumanReview, string> = {
  SAME: "🟢 동일상품",
  SIMILAR: "🟡 유사상품",
  DIFFERENT: "🔴 다른 상품",
  UNDECIDED: "⚪ 판단보류",
};

/** 🟢 버튼에 적히는 말. 🔴 위 결과 문구와 **같은 어휘** 를 쓴다(두 말이 다르면 셀러가 헷갈린다). */
export const HUMAN_REVIEW_BUTTON: Record<HumanReview, string> = HUMAN_REVIEW_LABEL;

/** 🔴 WU-131 — 저장 상태. 「눌렀다」와 「저장됐다」는 **다른 사실** 이다(§8 「저장 성공 여부 확인」). */
export type ReviewSaveState = "SAVING" | "SAVED" | "ERROR";
const SAVE_STATE_TEXT: Record<ReviewSaveState, string> = {
  SAVING: "저장 중…",
  SAVED: "저장됨",
  ERROR: "🔴 저장 실패 — 다시 눌러 주세요",
};

export function GeminiTransientCandidates({
  evidence,
  heading = WEB_SEARCH_HEADING,
  testId = "gemini-transient",
  review,
  onReview,
  saveState,
  originImageUrl,
  originTitle,
  collapsed = false,
}: GeminiTransientCandidatesProps): JSX.Element | null {
  if (!evidence || evidence.length === 0) return null;
  /** 🔴 WU-132 ④ — 원상품 이미지가 **없으면** 비교 칸을 만들지 않는다(빈 틀 금지). */
  const showImagePair = originImageUrl != null;

  return (
    <section data-testid={testId} className="mt-3 rounded-md border border-border bg-surface/40 p-2">
      {/**
       * 🔴🔴 WU-136 §D — **유사·보류 후보는 «접는다». 지우지 않는다.**
       *
       * 🔴 CPO: 「정보를 삭제하는 것이 아니라 셀러의 시야에서 치우는 것」. 셀러의 1순위
       *    질문은 「팔아도 되는가」이고 그 답은 위 **시장 판매 판단** 이 한다. 후보 행은
       *    그 판단의 **근거이자 GT 입력** 이라 남아 있어야 한다(WU-131 축적 경로).
       * 🔴 **`open` 을 붙이지 않는다** — 펼친 채로 두면 후보가 「유력」으로 읽히고
       *    그것이 2026-09-19 사고의 기전이다(WU-091 ① 과 같은 계약).
       * 🟢 `collapsed=false` 면 **DOM 이 전과 같다** — 기존 계약이 그대로 유효하다.
       */}
      <Fold collapsed={collapsed} label={`${heading} ${evidence.length}건`}>
      {/* 🔴 두 문구는 CPO 가 지정한 고정 문장이다 — 요약하거나 바꾸지 않는다. */}
      <p className="mt-0.5 text-[11px] text-text-tertiary">{TRANSIENT_NOTICE}</p>
      <p className="text-[11px] text-text-tertiary">{TRANSIENT_SCOPE_NOTICE}</p>

      <ul className="mt-2 space-y-2">
        {evidence.map((row) => {
          const market = marketText(row.market);
          const verdict = verdictDisplay(row);
          const confidence = priceConfidenceText(row);
          const reasons = (row.matchReasons ?? []).slice(0, 3);
          const blockers = [...(row.crossSellerBlockers ?? []), ...(row.crossSellerConflicts ?? [])].slice(0, 2);
          return (
            <li key={row.discoveredUrl} className="rounded border border-border/60 p-2">
              {/* 🔴🔴 WU-028 — 한 줄: **출처 · 판정 · 시장**. 출처가 행에 있어야
                  「내가 넣은 판매처가 처리된 결과」임이 결과부에서 바로 읽힌다. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {row.source && (
                  <span
                    data-testid="gt-source"
                    className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary"
                  >
                    {SOURCE_LABEL[row.source]}
                  </span>
                )}
                {/* 🟢 판정 — **라벨 owner 가 정한 말**. 내부 enum 을 노출하지 않는다. */}
                <span data-testid="gt-verdict" className="text-[11px] font-medium text-text-primary">
                  {verdict ? `${verdict.icon} ${verdict.label}` : "판정 미확인"}
                </span>
                {/* 🔴 시장은 확인된 경우에만 — UNKNOWN 이면 이 뱃지가 «없다». */}
                {market && (
                  <span data-testid="gt-market" className="rounded bg-surface px-1 text-[10px] text-text-secondary">
                    {market}
                  </span>
                )}
              </div>
              {/**
               * 🔴🔴 WU-132 ④ — **원본 ↔ 후보 사진을 나란히.** 이것이 셀러가
               *    「동일상품인가」를 실제로 가르는 수단이다(글자만으로는 못 가른다 —
               *    WU-099 에서 측정됐다).
               * 🔴 한쪽이 없으면 그 칸에 **「이미지 없음」이라고 적는다** — 다른 상품
               *    사진으로 메우지 않는다(그러면 판단 자체가 거짓이 된다).
               */}
              {showImagePair && (
                <div data-testid="gt-image-pair" className="mt-1 grid grid-cols-2 gap-2">
                  <figure className="m-0">
                    <figcaption className="text-[10px] text-text-tertiary">{ORIGIN_IMAGE_LABEL}</figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      data-testid="gt-origin-image"
                      src={originImageUrl ?? undefined}
                      alt={originTitle ?? ORIGIN_IMAGE_LABEL}
                      className="h-24 w-full rounded border border-border/60 object-contain"
                    />
                  </figure>
                  <figure className="m-0">
                    <figcaption className="text-[10px] text-text-tertiary">{CANDIDATE_IMAGE_LABEL}</figcaption>
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        data-testid="gt-candidate-image"
                        src={row.imageUrl}
                        alt={row.title ?? CANDIDATE_IMAGE_LABEL}
                        className="h-24 w-full rounded border border-border/60 object-contain"
                      />
                    ) : (
                      <p
                        data-testid="gt-candidate-image-missing"
                        className="flex h-24 w-full items-center justify-center rounded border border-dashed border-border/60 text-[10px] text-text-tertiary"
                      >
                        {IMAGE_MISSING_TEXT}
                      </p>
                    )}
                  </figure>
                </div>
              )}
              {/* 🔴 WU-028 — **무엇이** 그 가격인지. domain 만 있을 때는 링크를 열어야 알았다. */}
              {row.title && (
                <p data-testid="gt-title" className="mt-1 truncate text-[11px] text-text-primary">
                  {row.title}
                </p>
              )}
              {/* 🔴 WU-028 — **판매처와 가격을 같은 줄에** 둔다(흩어지면 연결이 끊긴다). */}
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <a
                  data-testid="gt-url"
                  href={row.discoveredUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-[11px] text-text-tertiary underline"
                >
                  {row.domain}
                </a>
                {/* 🔴 통화 그대로 · 환산 없음 */}
                <span data-testid="gt-price" className="shrink-0 text-[11px] font-medium text-text-secondary">
                  {priceText(row)}
                </span>
              </div>
              {/* 🔴🔴 WU-028 — 가격 **바로 아래** 에 신뢰도와 미반영 사실을 적는다.
                  이것이 「가격은 있는데 왜 판매판정엔 없나」를 그 자리에서 답한다. */}
              {confidence && (
                <p data-testid="gt-price-confidence" className="text-[11px] text-text-tertiary">
                  {confidence}
                </p>
              )}
              {/**
               * 🔴🔴 WU-132 ② — **재고를 가격 옆에서 말한다.** 「동일상품이고 가격도
               *    확인됐는데 품절」이면 그 가격은 경쟁가격이 아니다(기존 국내 집계
               *    owner 가 품절을 빼는 그 이유).
               * 🔴 `null` 을 「판매중」으로 적지 않는다 — 세 상태를 그대로 가른다.
               */}
              <p data-testid="gt-stock" className="text-[11px] text-text-tertiary">
                {stockText(row.soldOut)}
              </p>
              {/* 🟢 판정의 한 줄 근거도 owner 가 들고 있다 — 화면이 새로 쓰지 않는다. */}
              {verdict && (
                <p data-testid="gt-verdict-note" className="mt-0.5 text-[11px] text-text-tertiary">
                  {verdict.note}
                </p>
              )}
              {/* 🔴 근거 없이 판정만 보여주지 않는다(기존 정책 N-4.11 STEP2 와 같은 원칙). */}
              {reasons.length > 0 && (
                <p data-testid="gt-reasons" className="mt-1 text-[11px] text-text-tertiary">
                  {reasons.join(" · ")}
                </p>
              )}
              {blockers.length > 0 && (
                <p data-testid="gt-blockers" className="mt-0.5 text-[11px] text-text-tertiary">
                  보류 근거: {blockers.join(" · ")}
                </p>
              )}
              {/**
               * 🔴🔴 WU-081 — **사람 검토.** `onReview` 가 없으면 이 블록은 **렌더되지 않는다**
               *    (기존 두 구역이 그 상태다 — 한 픽셀도 바뀌지 않는다).
               * 🔴 위의 `gt-verdict`(시스템 판정)를 **덮지 않는다.** 둘이 같은 행에 **공존** 한다.
               */}
              {onReview && (
                <div data-testid="gt-human-review" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/40 pt-1">
                  <span className="text-[11px] text-text-tertiary">CEO 검토</span>
                  {/**
                   * 🔴🔴 WU-131 §8 — **네 개를 전부 둔다.** 「유사」와 「보류」가 없으면
                   *    애매한 후보를 억지로 동일/다름에 밀어 넣게 되고 그것이 GT 를 오염시킨다.
                   * 🟢 `data-testid` 는 어휘에서 **파생** 한다 — 버튼을 더할 때 좌표가 갈라지지 않는다.
                   */}
                  {HUMAN_REVIEW_VALUES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      data-testid={`gt-review-${v.toLowerCase()}`}
                      aria-pressed={review?.[row.discoveredUrl] === v}
                      onClick={() => onReview(row.discoveredUrl, v)}
                      className={`rounded border px-1.5 py-0.5 text-[11px] hover:bg-surface ${
                        review?.[row.discoveredUrl] === v
                          ? "border-primary font-medium text-primary"
                          : "border-border text-text-primary"
                      }`}
                    >
                      {HUMAN_REVIEW_BUTTON[v]}
                    </button>
                  ))}
                  {review?.[row.discoveredUrl] && (
                    <span data-testid="gt-review-result" className="text-[11px] font-medium text-text-primary">
                      검토 결과: {HUMAN_REVIEW_LABEL[review[row.discoveredUrl]]}
                    </span>
                  )}
                  {/* 🔴 WU-131 §8 — 「저장 성공 여부」를 화면이 **직접 말한다**. */}
                  {saveState?.[row.discoveredUrl] && (
                    <span data-testid="gt-review-save" className="text-[11px] text-text-tertiary">
                      {SAVE_STATE_TEXT[saveState[row.discoveredUrl]]}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </Fold>
    </section>
  );
}

/**
 * 🔴🔴 WU-136 §D/§E — **접힘 하나를 두 곳이 같이 쓴다.**
 *
 * 🔴 `collapsed=false` 면 **`<details>` 를 만들지 않는다** — 머리 문구를 그대로
 *    `<p>` 로 그린다. 그래서 기존 구역의 DOM 이 **한 노드도 바뀌지 않는다**(계약 보존).
 * 🔴 `open` 속성을 **받지 않는다** — 「기본 접힘」이 계약이다(WU-091 ①).
 */
function Fold({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}): JSX.Element {
  if (!collapsed) {
    return (
      <>
        <p className="text-[11px] font-medium text-text-secondary">{label}</p>
        {children}
      </>
    );
  }
  return (
    <details data-testid="candidate-fold">
      <summary className="cursor-pointer text-[11px] font-medium text-text-secondary">▸ {label}</summary>
      {children}
    </details>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 WU-131 — **📚 이전에 확인한 후보** (검토 이력)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 별 구역인가 — 위 구역들은 **「이번 조회에서 나온 것」** 이고 여기는
 * **「예전에 봤고 지금은 검색에 안 걸릴 수도 있는 것」** 이다. 🔴 수명이 다르면
 * 구역도 달라야 한다(WU-022 가 같은 이유로 구역을 갈랐다).
 *
 * 🔴 **셀러 판단과 시스템 판정을 같은 줄에 «나란히»** 적는다 — 그 불일치가 GT 다.
 * 🔴 판단이 없는 행도 보여준다(⚪ 미판단) — 「본 적 있다」도 이력이다.
 */
export const REVIEW_HISTORY_HEADING = "📚 이전에 확인한 후보";
export const REVIEW_HISTORY_EMPTY = "이 상품에 대해 이전에 확인한 후보가 없습니다.";

export interface ReviewHistoryRow {
  candidateUrl: string;
  candidateDomain: string | null;
  candidateTitle: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  market: string | null;
  systemVerdict: string | null;
  matchTruth: string | null;
  humanVerdict: HumanReview | null;
  source: string;
  lastSeenAt: string;
  reviewedAt: string | null;
}

/** 🟢 날짜는 **그대로** 적는다 — 상대시간("3일 전")을 지어내지 않는다. */
function dayText(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function ReviewHistorySection({
  rows,
  testId = "review-history",
}: {
  rows?: ReviewHistoryRow[] | null;
  testId?: string;
}): JSX.Element | null {
  if (!rows) return null;
  return (
    <section data-testid={testId} className="mt-3 rounded-md border border-border bg-surface/40 p-2">
      {/**
       * ════════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 WU-145 ③ — **구역은 두고 그 «안» 을 접는다** (CPO 작업지시)
       * ════════════════════════════════════════════════════════════════════════
       *
       * 🔴 CPO: 「`▸ 판단 근거` 그 안에서도 **전체 후보를 기본 노출하지 않는다**」 ·
       *    「1차 화면에 후보 URL·이미지·blocker 목록을 **펼쳐 놓지 않는다**」.
       *
       * 🔴🔴 **이 구역이 그 지시에 걸린 «유일한» 자리였다**(실측): 같은 접힘 안의 다섯
       *    구역은 전부 `GeminiTransientCandidates … collapsed` 라 **이미 `Fold` 를 쓰는데**
       *    (`candidate-fold`) 이 구역만 `<ul>` 을 **인라인으로** 그렸다 ⟹ `▸ 판단 근거` 를
       *    열면 **📚 이력 전부**(URL · 가격 · 두 판단 · 날짜)가 한꺼번에 펼쳐졌다.
       * 🔴 그리고 WU-141-R1 STEP 4 가 `recordSeenCandidates` 를 되살린 뒤 이 구역은
       *    **본 후보 전부로 채워진다** ⟹ 가장 길어질 구역이 **유일하게 안 접혀 있었다**.
       *
       * 🟢 그래서 **같은 `Fold` 를 쓴다** — 새 컴포넌트 0 · 새 라벨 체계 0 ·
       *    `open` **없음**(기본 접힘이 계약이다 · WU-091 ①).
       * 🔴 **출처 축을 없애지 않았다**(WU-130 계약) — 머리 문구 `REVIEW_HISTORY_HEADING` 이
       *    접힘 **라벨로** 그대로 간다(「추가 검토 후보」 하나로 합치면 출처가 사라진다).
       * 🔴 행·데이터·testid(`rh-*`)는 **한 글자도 바뀌지 않았다** — React 는 `details` 가
       *    닫혀 있어도 자식을 렌더하므로 `wu-131` 의 DOM 계약이 그대로 유효하다.
       */}
      <Fold collapsed label={`${REVIEW_HISTORY_HEADING} ${rows.length}건`}>
      {rows.length === 0 ? (
        <p className="mt-0.5 text-[11px] text-text-tertiary">{REVIEW_HISTORY_EMPTY}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.candidateUrl} data-testid="rh-row" className="rounded border border-border/60 p-2">
              {r.candidateTitle && (
                <p data-testid="rh-title" className="truncate text-[11px] text-text-primary">
                  {r.candidateTitle}
                </p>
              )}
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <a
                  data-testid="rh-url"
                  href={r.candidateUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-[11px] text-text-tertiary underline"
                >
                  {r.candidateDomain ?? r.candidateUrl}
                </a>
                {/* 🔴 통화 그대로 · 환산 0 · 없으면 「가격 미확인」 */}
                <span data-testid="rh-price" className="shrink-0 text-[11px] text-text-secondary">
                  {r.priceAmount != null && r.priceCurrency
                    ? `${r.priceCurrency} ${r.priceAmount.toLocaleString("ko-KR")}`
                    : PRICE_UNKNOWN_TEXT}
                </span>
              </div>
              {/* 🔴🔴 **두 판단을 나란히** — 한쪽이 다른쪽을 덮지 않는다는 사실이 화면에 보인다. */}
              <p className="mt-1 text-[11px] text-text-tertiary">
                <span data-testid="rh-system">이전 MI: {r.systemVerdict ?? r.matchTruth ?? "판정 없음"}</span>
                {" · "}
                <span data-testid="rh-human" className="font-medium text-text-primary">
                  셀러 판단: {r.humanVerdict ? HUMAN_REVIEW_LABEL[r.humanVerdict] : "⚪ 미판단"}
                </span>
              </p>
              <p data-testid="rh-seen" className="text-[11px] text-text-tertiary">
                마지막 확인일 {dayText(r.lastSeenAt) ?? "-"}
                {r.reviewedAt ? ` · 판단일 ${dayText(r.reviewedAt)}` : ""}
                {` · 출처 ${r.source}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      </Fold>
    </section>
  );
}
