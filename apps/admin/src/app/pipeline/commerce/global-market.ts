import { isTargetMarket, parseMarketRegion, KR_TARGET_MARKET, type TargetMarket } from "./market-target";
import { miEmptyState, type MiEmptyState } from "./mi-empty-state";
import { formatKrwAmount, formatOriginAmount } from "./mi-headline";
// UX 2.4.1 — 제목(번호 포함)은 가격 계층 표 한 곳에서만 나온다. 이 카드가 자기
// 제목을 따로 들고 있으면 읽는 순서를 두 파일이 각각 주장하게 된다.
// MI-MATCHING-INTEGRATION-2 — 여기서 PRICE_MEANING_LABEL을 더 이상 읽지 않는다.
// 줄마다 붙던 가격 의미 라벨("원본 판매자 한국 표시가")이 사라졌기 때문이다:
// 이 카드의 줄은 이제 나라와 금액 둘만 말하고, 그 금액이 무슨 값인지는 카드가
// note와 invariant로 한 번만 말한다. 라벨을 가져올 수 있는 import가 남아 있으면
// 언젠가 다시 줄에 붙는다.
import { PRICE_SECTION_TITLE } from "./price-hierarchy";

/**
 * UX 2.4(CEO 지시, 2026-09-11) — 판매자 글로벌 시장 가격.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * GLOBAL-MARKET ②③이 시장별 가격을 전부 수집해서 저장까지 했다: en-kr ₩,
 * en-us $, en-fr/en-de/en-int €. 그런데 화면에는 한 줄도 나오지 않았다 —
 * 데이터가 DB까지 도착한 다음 경험에서 사라졌다. 셀러가 이 화면에 들어와서
 * 던지는 가장 당연한 질문("원래 얼마고, 이 판매자는 한국/미국/유럽에서 각각
 * 얼마에 팔고 있지?")에 화면이 답을 갖고 있으면서 답하지 않고 있었다.
 *
 * ── 이 파일이 존재하는 진짜 이유: 두 한국 가격을 가르는 것 ────────────────
 * 화면에는 "한국 가격"이 둘 있고, 둘은 완전히 다른 사실이다.
 *
 *   🇰🇷 판매자 한국 가격  ₩78,000   Bobo Choses가 **직접** 한국에 파는 값
 *   🇰🇷 국내 비교상품     ₩116,600  **다른** 한국 판매자들이 파는 값
 *
 * 앞은 내가 살 수 있는 값이고 뒤는 내가 경쟁해야 하는 값이다. 두 숫자가 같은
 * 라벨·같은 카드·같은 집계에 들어가는 순간 셀러는 ₩38,600의 기회를 못 본다.
 * 그래서 이 파일은 국내 비교상품을 **입력으로도 받지 않는다** — price-hierarchy의
 * buildPriceChain/buildMarketContext가 서로의 입력을 받지 않는 것과 같은 장치다.
 *
 * ── 계산하지 않는다 ─────────────────────────────────────────────────────
 * 환율을 다시 돌리지 않는다. 시장끼리 평균·최저를 내지 않는다. 서버가 이미
 * 관측해 저장한 값(price_amount / price_krw / sold_out)을 고르고 문장으로만
 * 옮긴다. 여기서 뺄셈 한 번이라도 하면 어느 시장에도 존재하지 않는 "글로벌
 * 평균가"가 생기고, 그 숫자는 아무 시장에서도 살 수 없는 가격이다.
 *
 * ── 절대 하지 않는 추론(market-target.ts와 같은 규칙) ────────────────────
 *   EUR → 독일 ✕ · GBP → 영국 ✕ · KRW → 한국 ✕ · .kr → 한국 ✕
 *   판매자 신고 국가(market_country) ES → 스페인 시장 ✕
 *   en-int → 어느 나라든 ✕ (국제 공용 페이지다, 국가가 아니다)
 * 시장 이름과 국기는 **관측된 market_code 안에 적힌 글자**에서만 나온다.
 *
 * ── MI/PRICE-2(CEO 지시, 2026-09-12) — 이 줄의 숫자는 "관측된 시장가"다 ────────
 * 실제 화면(Bobo Choses B226AC043)은 이렇게 떠 있었다:
 *
 *   🇰🇷 한국 · en-kr    착지원가 기준    ₩162,000
 *
 * ₩162,000은 착지원가가 아니다. 그건 Bobo Choses가 **한국 방문자에게 직접
 * 보여주는 값**이고, 착지원가는 원본가 €75 → 환율 → ₩116,742 + 국제배송비로
 * 만들어지는 전혀 다른 숫자다. 관측된 시장가 옆에 "착지원가 기준"이라고 적는
 * 순간 *판매자가 그 시장에서 받는 값*과 *내가 물건을 들여오는 데 드는 돈*의
 * 경계가 뭉개지고, 그 혼동은 GLOBAL 판매처마다 그대로 반복된다.
 *
 * 그래서 이 카드는 원가를 **입력으로도 받지 않는다**(GlobalMarketCardInput에서
 * costBasisIsTargetMarket을 지운 이유다 — 넘길 수 있는 인자가 없으면 배지도
 * 되살아날 수 없다). 착지원가는 ③ 수익성 한 곳에만 있다.
 *
 * 지운 것은 배지이지 사실이 아니다. "그 관측이 곧 원가 계산의 출발점"인 상품이
 * 있다는 사실은 ① 원본 상품 가격이 한 문장으로 말한다(price-hierarchy의
 * buildOriginalPriceHeadline). 사실을 옮겼을 뿐, 시장가를 원가라고 부르지 않는다.
 */

/** 서버가 돌려주는 시장 관측 한 건(@commerce/pricing MarketObservation과 같은 모양).
 * 화면이 이 값을 다시 계산하지 않는다는 것을 타입으로 분명히 하기 위해 옮겨 적는다. */
export interface MarketObservationInput {
  /** 관측된 market_code. 빈 값은 애초에 서버에서 빠져 있다(시장이 아니다). */
  marketCode: string;
  /** 판매자가 스스로 신고한 국가. **기본 화면에 절대 쓰지 않는다**(아래 주석 참고). */
  marketCountry: string | null;
  currency: string;
  priceAmount: number | null;
  priceKrw: number;
  soldOut: boolean | null;
  productUrl: string | null;
  checkedAt: string;
}

/**
 * 시장 코드의 지역 글자 → 나라 이름. **코드에 적힌 것을 읽는 표**이지 추론표가
 * 아니다("de"라고 적혀 있으니 독일이다 — 유로를 쓰니 독일이다가 아니다).
 * 모르는 지역은 여기에 없고, 그때는 코드를 대문자로 그대로 보여준다 —
 * 없는 나라 이름을 지어내느니 코드가 낫다.
 *
 * 목록의 근거는 실제로 조회하는 시장이다(crawler의 EXPAND_CANDIDATE_MARKET_CODES
 * + 기본 조회의 en-kr + SMALLABLE-MARKET-PROBE-1의 SMALLABLE_CANDIDATE_MARKET_COUNTRIES
 * = FR/KR/US/JP, 전부 이미 이 표에 있다). 새 시장을 찌르기 시작하면 여기에 한
 * 줄을 더해야 한다.
 */
const MARKET_REGION_NAME: Record<string, string> = {
  kr: "한국",
  us: "미국",
  gb: "영국",
  fr: "프랑스",
  de: "독일",
  jp: "일본",
  au: "호주",
  ca: "캐나다",
};

/**
 * 국가가 아닌 시장 코드. Shopify의 국제 공용 페이지라 어느 나라도 아니다 —
 * 실측(Bobo Choses B226AC043, 2026-09-11): /en-de €75.00과 /en-int €84.00이
 * 동시에 존재한다. 즉 en-int는 "유럽"도 "독일"도 아닌 **별개의 시장**이고,
 * 국기를 붙이는 순간 그 사실이 화면에서 사라진다.
 */
const INTERNATIONAL_MARKET_LABEL = { flag: "🌎", name: "국제" };

/** 시장 코드 안에 적힌 지역 글자로 국기를 만든다(regional indicator). 코드에
 * 국가 글자가 없으면 국기가 없다 — 지어내지 않는다. */
function flagOfRegion(region: string): string {
  return String.fromCodePoint(...[...region.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** 코드 뒤쪽(시장 파트)을 대문자로. "en-int" → "INT", "kr" → "KR". */
function marketSuffix(marketCode: string): string {
  const code = marketCode.trim().toLowerCase();
  return (code.includes("-") ? code.split("-").pop()! : code).toUpperCase();
}

/**
 * 시장 코드 하나를 화면 이름으로. **이 함수가 이 파일의 규칙 그 자체다** —
 * 국기와 이름의 유일한 출처가 market_code라는 것을 여기 한 곳에서만 정한다.
 */
export function marketDisplayName(marketCode: string): { flag: string; name: string } {
  const region = parseMarketRegion(marketCode);
  // 지역 글자가 없다(en-int 등) → 국가가 아니다. 끝까지 국가로 바꾸지 않는다.
  if (!region) return INTERNATIONAL_MARKET_LABEL;
  const name = MARKET_REGION_NAME[region];
  // 아는 나라면 이름을, 모르면 코드를 그대로. 국기는 코드 글자에서 나온 것이라
  // 이름을 모른다고 해서 틀린 국기가 되지는 않는다.
  return { flag: flagOfRegion(region), name: name ?? marketSuffix(marketCode) };
}

/** 이 시장에서 지금 살 수 있는가. 세 상태를 하나로 뭉개지 않는다 —
 * "확인 못 했다"를 "판매중"으로 바꿔 적으면 매입 계획이 틀어진다. */
export interface MarketAvailability {
  icon: string;
  text: string;
}

/**
 * MI-MATCHING-INTEGRATION-2 — 관측이 없는 나라 줄에 서는 것. 이 상수가 있는
 * 이유는 반대편을 막기 위해서다: 빈 칸을 채울 값이 이것 하나뿐이면, 다른 나라의
 * 가격을 옮겨 적는 코드가 들어올 자리가 없다.
 */
const EMPTY_PRICE = "—";

function availabilityOf(soldOut: boolean | null): MarketAvailability {
  if (soldOut === true) return { icon: "🔴", text: "품절" };
  if (soldOut === false) return { icon: "🟢", text: "판매중" };
  return { icon: "⚪", text: "재고 확인 불가" };
}

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **줄마다 붙던 🟢 배지를
 * 지운다.**
 *
 * 이 카드의 동일성은 구성으로 성립한다(identity by construction): 각 줄은 같은
 * 판매처가 같은 상품 페이지를 시장 코드만 바꿔 관측한 값이다. 그 사실은 줄마다
 * 달라지지 않는다 — 그런데 달라지지 않는 사실을 네 줄에 네 번 적으면, 읽는
 * 사람은 그것을 **줄마다 판정된 결과**로 읽는다. 게다가 그 배지의 어휘가
 * ③ 국내의 🟢 동일상품과 같아서, 두 카드가 같은 종류의 목록으로 보였다.
 *
 * 사실은 지우지 않고 카드에 **한 번** 적는다(GlobalMarketCard.invariant). 그래야
 * "같은 페이지, 시장 코드만 바꿈"이라는 이 카드의 불변식이 그대로 남으면서도,
 * 줄은 나라와 가격 둘만 말하는 목록이 된다.
 */
export interface GlobalMarketIdentity {
  icon: string;
  /** 카드에 한 번 적는 짧은 말. 매칭 등급이 아니라 관측 방식이다. */
  text: string;
}

/** 카드 전체가 한 번 갖는 값 — 줄마다 갖는 값이 아니다. */
const SAME_PRODUCT_BY_CONSTRUCTION: GlobalMarketIdentity = {
  icon: "🟢",
  text: "같은 판매처 · 같은 상품 페이지에서 시장 코드만 바꿔 관측한 값입니다",
};

/**
 * 시장 코드를 뗀 상품 경로. 관측된 URL에 적힌 것을 읽을 뿐이고, 읽을 수 없으면
 * null이다 — "같은 상품"의 근거를 지어내지 않는다.
 *
 * 첫 조각이 이 줄의 시장 코드일 때만 떼어낸다(/en-kr/products/x → /products/x).
 * 그래야 남는 경로가 시장과 무관해지고, 여러 줄에 같은 경로가 적히는 것 자체가
 * "같은 상품을 시장만 바꿔 봤다"는 증거가 된다.
 */
function sameProductPath(productUrl: string | null, marketCode: string): string | null {
  if (!productUrl) return null;
  try {
    const segments = new URL(productUrl).pathname.split("/").filter(Boolean);
    if (segments[0]?.toLowerCase() === marketCode.trim().toLowerCase()) segments.shift();
    return segments.length > 0 ? `/${segments.join("/")}` : null;
  } catch {
    return null;
  }
}

/** 화면에 그대로 쓰는 시장 한 줄. 문자열은 전부 여기서 완성한다 — 컴포넌트가
 * 숫자를 다시 포맷하기 시작하면 같은 값이 카드마다 다른 모양으로 뜬다. */
export interface GlobalMarketRow {
  /** React key이자 이 줄의 정체성. 관측된 market_code 그대로다. */
  marketCode: string;
  flag: string;
  /** 시장 이름("한국"/"미국"/"국제"…). 절대 판매자 신고 국가가 아니다. */
  name: string;
  /** 목록에 함께 적는 원본 코드("en-de"). 이름이 어디서 왔는지 셀러가 대조할 수 있게. */
  code: string;
  /**
   * 이 줄의 유일한 금액.
   *
   * ── MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — 나라마다 한 숫자 ───────
   * 규칙은 셋이고 전부 이 한 필드로 강제된다:
   *
   *   · 한국(판단 시장) 줄의 대표값은 **언제나 원화**다. 그 줄을 읽는 사람은
   *     한국에서 파는 사람이고, 큰 숫자가 유로면 답을 얻으려고 환산을 한 번 더
   *     해야 한다.
   *   · 다른 나라 줄의 대표값은 **그 나라에서 관측된 통화 그대로**다. 환산값이
   *     비-한국 줄의 대표값이 되는 경로는 존재하지 않는다.
   *   · 관측이 없으면 `—`다. 다른 나라의 값을 옮겨 적어 칸을 채우는 코드는
   *     이 함수 안에 없다 — 각 줄은 자기 관측 하나만 읽는다.
   *
   * 환율을 다시 돌리지 않는다. 한국 줄의 원화는 관측 시점에 저장된 price_krw
   * 그대로다.
   */
  observedPrice: string;
  /**
   * 한국 줄의 대표값이 원화일 때, 그 판매처가 페이지에 실제로 적어 둔 외화
   * 표시가. 화면에는 괄호로 붙는다("(원 표시가 €73)").
   *
   * 지우지 않는 이유는 하나다 — 지우면 그 ₩113,629가 한국에서 관측된 값인지
   * 우리가 환율로 만든 값인지 화면이 더 이상 말하지 못한다. 관측 통화가 이미
   * 원화면 null이다(같은 숫자를 두 번 쓰지 않는다).
   *
   * "원화 환산"이라는 말은 이 카드 어디에도 쓰지 않는다. 그 말이 붙은 줄이
   * 시장가와 같은 층으로 읽히던 것이 이번에 지우는 것이다.
   */
  observedOriginPrice: string | null;
  availability: MarketAvailability;
  /**
   * 판매자가 스스로 신고한 국가(market_country). **기본 화면에 쓰지 않는다.**
   * DB에는 market_code=en-de인데 market_country=ES인 행이 실제로 있다(Bobo
   * Choses는 모든 시장에서 country=ES다). 기본 화면에 "독일 / 판매자 신고 국가
   * ES"를 같이 그리면, 이번 작업이 없애려는 바로 그 혼동("이게 독일 가격이야
   * 스페인 가격이야?")을 화면이 스스로 만든다. 펼친 상세에서만 쓴다.
   */
  declaredCountry: string | null;
  /** 시장 코드를 뗀 상품 경로. 여러 줄에 같은 경로가 적히는 것 자체가 이 카드의
   * 불변식이 참이라는 증거다. 읽어낼 수 없으면 null이고, 펼친 상세에만 쓴다. */
  sameProductPath: string | null;
  productUrl: string | null;
  checkedAt: string;
  /** 판매 판단이 서 있는 시장인가. market_code로만 판별한다. */
  isJudgingMarket: boolean;
  /**
   * MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 이 줄을 본문 한 줄에 넣을 때의 모양
   * ("🇫🇷 FR €75"). 시장 · 가격, 그 둘뿐이다.
   *
   * 문자열을 여기서 만드는 이유는 이 파일의 다른 모든 문자열과 같다: 화면이
   * 국기와 코드를 다시 조립하기 시작하면 같은 관측이 툴팁과 상세에서 서로 다른
   * 모양으로 뜬다. 금액은 observedPrice 그대로라 값이 갈라질 수 없다.
   */
  compact: string;
}

export interface GlobalMarketCard {
  title: string;
  rows: GlobalMarketRow[];
  /**
   * MI-MATCHING-INTEGRATION-2 — 줄마다 반복되던 🟢 배지가 카드에 한 번 서는
   * 자리. 이 카드의 불변식("같은 페이지, 시장 코드만 바꿈")은 그대로 남고,
   * 줄은 나라와 가격만 말한다.
   */
  invariant: GlobalMarketIdentity;
  /** 이 카드의 값이 무엇인지 한 줄. 국내 경쟁가가 아니라는 사실을 항상 함께 말한다. */
  note: string;
  /** 관측된 시장이 하나도 없을 때. 판단 실패가 아니다 — 흔적이 없는 것이다. */
  empty: MiEmptyState | null;
}

export interface GlobalMarketCardInput {
  /**
   * 서버가 시장별 최신 1건으로 이미 접어서 보낸 관측 목록.
   *
   * MI/PRICE-2 — 이 카드가 받는 것은 관측뿐이다. 예전에는 착지원가 기준 여부
   * (costBasisIsTargetMarket)도 받아서 🇰🇷 줄에 "착지원가 기준" 배지를 붙였는데,
   * 그 배지가 관측된 시장가 ₩162,000을 원가처럼 읽히게 만들었다. 인자를 지운
   * 것이 장치다 — 원가를 넘길 수 있는 자리가 없으면 배지도 되살아나지 않는다.
   */
  observations: MarketObservationInput[];
}

/**
 * 시장 관측을 화면 한 줄씩으로 옮긴다. **국내 비교상품도 착지원가도 입력으로
 * 받지 않는다** — 받을 수 있게 두면 언젠가 "국내 평균가도 여기 한 줄로 넣자",
 * "이 줄이 원가 기준이라고 적어주자"는 코드가 들어오고, 그 순간 이 카드는
 * 관측된 시장가만 말하는 카드가 아니게 된다.
 */
export function buildGlobalMarketCard(
  input: GlobalMarketCardInput,
  market: TargetMarket = KR_TARGET_MARKET,
): GlobalMarketCard {
  const rows: GlobalMarketRow[] = input.observations.map((o) => {
    const display = marketDisplayName(o.marketCode);
    const isKrw = o.currency.toUpperCase() === "KRW";
    const isJudgingMarket = isTargetMarket(o.marketCode, market);
    const path = sameProductPath(o.productUrl, o.marketCode);
    // 이 줄의 관측 금액. 관측 통화 그대로이고, 금액이 없으면 null이다.
    const originAmount = o.priceAmount != null ? formatOriginAmount(o.priceAmount, o.currency) : null;
    // MI-MATCHING-INTEGRATION-2 — 한국 줄만 원화가 대표값이다. 다른 나라 줄은
    // **어떤 경우에도** 환산값이 대표값이 되지 않는다: 관측 통화 금액이 없으면
    // 그냥 없는 것이고(EMPTY_PRICE), 저장된 price_krw로 대신 채우지 않는다.
    const krwLeads = isJudgingMarket && !isKrw && originAmount != null;
    const observedPrice = isJudgingMarket
      ? // 한국 줄: 관측이 원화면 그대로, 외화면 저장된 환산 원화. 둘 다 없으면 —.
        (krwLeads || isKrw ? formatKrwAmount(o.priceKrw) : EMPTY_PRICE)
      : // 그 밖의 나라: 그 나라에서 관측된 통화 금액 하나뿐.
        (originAmount ?? EMPTY_PRICE);
    return {
      marketCode: o.marketCode,
      flag: display.flag,
      name: display.name,
      code: o.marketCode,
      observedPrice,
      // 한국 줄에서 원화가 대표값일 때만 채운다 — 그 외에는 observedPrice가 이미
      // 관측 통화 그대로라 같은 값을 두 번 적는 꼴이 된다.
      observedOriginPrice: krwLeads ? originAmount : null,
      // 본문 한 줄용 모양. 같은 observedPrice를 쓰므로 툴팁과 상세가 다른 금액을
      // 말할 수 없다(사본이 아니라 같은 문자열이다).
      compact: `${display.flag} ${marketSuffix(o.marketCode)} ${observedPrice}`,
      availability: availabilityOf(o.soldOut),
      declaredCountry: o.marketCountry,
      // 근거는 관측에 적힌 것만 쓴다. 경로를 읽지 못하면 그 조각을 빼고,
      // 없는 상품 코드를 지어내지 않는다. 펼친 상세에서만 보인다.
      sameProductPath: path,
      productUrl: o.productUrl,
      checkedAt: o.checkedAt,
      isJudgingMarket,
    };
  });

  return {
    title: PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET,
    rows,
    invariant: SAME_PRODUCT_BY_CONSTRUCTION,
    // "각 시장에서 실제 관측된 판매가격"(CEO 지시문 그대로). 뒷문장 둘은 이
    // 카드가 무엇이 **아닌지**를 화면이 직접 말하게 한다 — 국내 비교상품도
    // 아니고(③), 내가 치르는 돈도 아니다(④). MI/PRICE-2에서 뒤 절이 늘었다:
    // 🇰🇷 줄에 붙어 있던 "착지원가 기준" 배지를 지우면서, 그 배지가 잘못 말하던
    // 경계를 카드 전체가 한 번만 정확히 말하게 옮긴 것이다.
    note: `각 시장에서 실제 관측된 판매가격입니다 — 이 판매처가 직접 파는 값이고, ${market.label} 편집샵의 비교상품 가격이 아닙니다. 제가 들여올 때 드는 돈은 ③ 수익성에서 따로 계산합니다.`,
    empty:
      rows.length > 0
        ? null
        : // 조회는 정상이었는데 다른 시장이 없었다(Shopify가 아니거나 시장이 하나뿐).
          // "확인 불가"가 아니라 "흔적이 없다"이다.
          miEmptyState("NO_SEARCH_DATA", "이 판매처에서 확인된 다른 시장 가격이 없습니다"),
  };
}

/**
 * MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — ②였던 카드가 본문에서 **한 줄**이 된다.
 *
 * ── 왜 카드를 접는가 ────────────────────────────────────────────────────
 * MI가 답하는 질문은 하나뿐이다: "이 상품을 한국에서 이 가격에 팔 만한가?"
 * 그 판단에 필요한 사실은 셋이다 — 원본 가격 · 한국에서 팔 수 있는 가격 ·
 * 내 마진 기준으로 팔 만한가. 판매처가 프랑스에서 얼마를 받는지는 그 셋 중
 * 어느 것도 아니다. **매입처를 고를 때** 필요한 사실이라 화면에서 지우지는
 * 않지만, 본문에 카드로 서면 판단에 필요한 숫자와 같은 무게로 읽힌다.
 *
 * 그래서 이 저장소의 규칙을 그대로 적용한다:
 *   본문     판단에 필요한 숫자
 *   툴팁     그 숫자의 근거
 *   상세보기  원하면 확인하는 원자료
 *
 * 이 함수가 만드는 것이 그 가운데 층이다. 계산은 여전히 없다 — 각 줄이 이미
 * 들고 있는 compact 문자열을 이어 붙이기만 한다(평균도, 최저도, 차액도 없다).
 */
export function globalMarketSummaryLine(card: GlobalMarketCard): string | null {
  return card.rows.length > 0 ? card.rows.map((row) => row.compact).join(" · ") : null;
}

/**
 * 관측이 하나도 없을 때 본문에 남는 **한 줄**.
 *
 * 노란 경고 상자도, 실패 로그도, 긴 설명도 쓰지 않는다(CPO 명시). 다른 시장
 * 가격을 못 봤다는 것은 판단의 실패가 아니라 이 판매처에 다른 시장이 없거나
 * 조회할 수 없었다는 사실일 뿐이고, 그 사실은 "팔 만한가"의 답을 바꾸지 않는다
 * — ③ 수익성은 이 줄이 비어도 전부 계산된 채로 남는다. 경고 상자를 세우면
 * 셀러는 판정이 흔들린 줄 알고 멈춘다.
 *
 * ── MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — "현재 사이트에서는"을 앞에 단다 ──
 * 실증으로 확인한 사실이 하나 있다: 다른 시장 가격은 시장 관측 경로가 **등록된
 * 사이트에서만** 생기고, 등록되지 않은 사이트에서는 관측이 아예 생기지 않는다
 * (빈 배열). 즉 이 줄이 뜨는 대부분의 경우는 "조회에 실패했다"가 아니라 "이
 * 사이트에는 우리가 찔러 볼 시장이 아직 없다"이다. 주어가 없으면 셀러는 우리
 * 조회가 고장난 줄 알고 다시 확인을 누른다 — 고칠 수 없는 것을 고치라고 시키는
 * 문장이 된다.
 *
 * SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13) — 등록된 경로가 둘이 됐다:
 * Shopify Markets probe(로케일 프리픽스)와 사이트별 probe(smallable의 배송국가
 * 쿼리). 그래서 위 문장의 주어가 "Shopify가 아닌 사이트"에서 "아직 등록되지
 * 않은 사이트"로 좁아졌다 — 문구 자체는 그대로 참이다.
 */
export const GLOBAL_MARKET_UNAVAILABLE_NOTE = "현재 사이트에서는 글로벌 시장 가격을 확인할 수 없습니다.";

/**
 * 본문 ① 원본 가격 아래 ⓘ 한 줄에 쓰는 이름.
 *
 * card.title(🌎 판매자 글로벌 시장 가격)을 쓰지 않는 이유는 층이 다르기
 * 때문이다. 그건 펼친 원자료의 **제목**이고, 본문에 남는 것은 "여기를 누르면
 * 무엇이 열리는가"를 말하는 가장 짧은 이름 하나다 — 본문 한 줄이 제목처럼
 * 길어지면 그 줄은 다시 판단 숫자와 같은 무게를 갖는다.
 */
export const GLOBAL_MARKET_HINT_LABEL = "글로벌 시장 가격";

/**
 * 판단 시장(오늘은 한국) 관측 줄. **정확히 하나일 때만** 돌려준다.
 *
 * "kr"과 "en-kr"이 함께 관측되면 둘 중 어느 쪽이 이 판매처의 한국 표시가인지
 * 우리가 모른다 — 모르면 고르지 않는다(집계 쪽 resolvePriceMarketKey와 같은
 * 규칙). 이 함수가 따로 있는 이유는 그 규칙을 쓰는 곳이 둘이기 때문이다:
 * ③ 비교의 왼쪽 칸(market-comparison)과 ① 원본 상품 가격의 한국 표시가 줄.
 * 두 곳이 각자 세기 시작하면 한쪽만 "확정 못 했다"고 말하는 날이 온다.
 */
export function pickJudgingMarketRow(card: GlobalMarketCard): GlobalMarketRow | null {
  const judging = card.rows.filter((row) => row.isJudgingMarket);
  return judging.length === 1 ? judging[0]! : null;
}
