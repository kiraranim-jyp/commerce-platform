import { isTargetMarket, parseMarketRegion, KR_TARGET_MARKET, type TargetMarket } from "./market-target";
import { miEmptyState, type MiEmptyState } from "./mi-empty-state";
import { formatKrwAmount, formatOriginAmount } from "./mi-headline";
// UX 2.4.1 — 제목(번호 포함)은 가격 계층 표 한 곳에서만 나온다. 이 카드가 자기
// 제목을 따로 들고 있으면 읽는 순서를 두 파일이 각각 주장하게 된다.
// MI/PRICE-2 — 라벨도 같은 이유로 그 표에서만 가져온다(의미 하나당 라벨 하나).
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "./price-hierarchy";

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
 * 되살아날 수 없다). 착지원가는 ④ 수익성 한 곳에만 있다.
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
 * + 기본 조회의 en-kr). 새 시장을 찌르기 시작하면 여기에 한 줄을 더해야 한다.
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

function availabilityOf(soldOut: boolean | null): MarketAvailability {
  if (soldOut === true) return { icon: "🔴", text: "품절" };
  if (soldOut === false) return { icon: "🟢", text: "판매중" };
  return { icon: "⚪", text: "재고 확인 불가" };
}

/**
 * MI/PRICE-2(CEO 지시, 2026-09-12) — 글로벌 시장 줄의 동일성은 **구성으로**
 * 성립한다(identity by construction).
 *
 * ②의 각 줄은 같은 판매처가 같은 원본 상품을 시장 코드만 바꿔 보여주는 값이다.
 * "같은 상품인가"를 매칭 알고리즘이 판정한 결과가 아니라, 애초에 같은 상품
 * 페이지를 시장별로 관측한 결과다. 그래서 등급이 없고 언제나 🟢 하나다.
 *
 * ③ 국내 경쟁시장의 🟢 동일상품 / 🟡 동일상품 추정 / ⚪ 유사상품과는 **다른
 * 개념**이다. 그쪽은 *다른 판매자*의 비교 가능 상품을 matchTruth가 판정한
 * 결과이고(match-display.ts) 등급이 흔들린다. 여기서 match-display의 등급을
 * 불러다 쓰면 두 개념이 한 어휘로 합쳐지고, 그 순간 "판매자 글로벌 시장"과
 * "국내 경쟁시장"이 같은 종류의 목록으로 읽힌다 — 이 파일이 따로 있는 이유가
 * 사라진다. 그래서 문구도 일부러 다르다("동일 상품" · 뒷말이 관측 방식이다).
 */
export interface GlobalMarketIdentity {
  icon: string;
  /** 줄에 붙는 짧은 말. 매칭 등급이 아니라 관측 방식이다. */
  text: string;
  /** 펼친 상세에서만 보이는 근거. 줄에 두면 시장·가격이 뒤로 밀린다. */
  evidence: string;
}

/** 모든 글로벌 시장 줄이 같은 값을 갖는다 — 줄마다 달라질 수 있는 판정이 아니다. */
const SAME_PRODUCT_BY_CONSTRUCTION = { icon: "🟢", text: "동일 상품 · 판매자 직접 관측" } as const;

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
  /** 관측된 통화 그대로의 금액. 이 줄의 주인공이다. */
  observedPrice: string;
  /**
   * MI/PRICE-2 — 이 금액이 무슨 값인지 말하는 라벨. 판단 시장(한국) 줄에만 붙고
   * 나머지 줄은 null이다.
   *
   * 한국 줄에만 붙이는 이유는 그 줄만 화면에서 다른 "한국 가격"과 부딪히기
   * 때문이다(③의 국내 비교상품 ₩116,600, ④의 착지원가). €75(DE)는 부딪힐
   * 상대가 없어서 "🇩🇪 독일 · en-de · €75"로 충분하고, 라벨을 억지로 붙이면
   * 줄만 길어진다.
   *
   * 문자열은 price-hierarchy의 표에서 그대로 가져온다. 여기서 "판매자 한국
   * 시장가" 같은 두 번째 이름을 만들면 같은 사실에 라벨이 둘이 되고, 그게 가격
   * 계층이 없애려던 문제 그 자체다(의미 하나당 라벨 하나 — 테스트가 고정한다).
   */
  priceMeaningLabel: string | null;
  /** 같은 판매처·같은 상품을 시장만 바꿔 관측했다는 사실. 모든 줄이 같다. */
  identity: GlobalMarketIdentity;
  /**
   * 관측 시점에 저장된 원화 환산. 관측 통화가 이미 원화면 **null**이다 —
   * "₩78,000 ≈ ₩78,000"은 정보가 아니라 같은 숫자의 두 번째 사본이고,
   * 그게 이번 지시의 "같은 가격이 여러 번 반복된다" 항목이다.
   */
  krwPrice: string | null;
  availability: MarketAvailability;
  /**
   * 판매자가 스스로 신고한 국가(market_country). **기본 화면에 쓰지 않는다.**
   * DB에는 market_code=en-de인데 market_country=ES인 행이 실제로 있다(Bobo
   * Choses는 모든 시장에서 country=ES다). 기본 화면에 "독일 / 판매자 신고 국가
   * ES"를 같이 그리면, 이번 작업이 없애려는 바로 그 혼동("이게 독일 가격이야
   * 스페인 가격이야?")을 화면이 스스로 만든다. 펼친 상세에서만 쓴다.
   */
  declaredCountry: string | null;
  productUrl: string | null;
  checkedAt: string;
  /** 판매 판단이 서 있는 시장인가. market_code로만 판별한다. */
  isJudgingMarket: boolean;
}

export interface GlobalMarketCard {
  title: string;
  rows: GlobalMarketRow[];
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
    return {
      marketCode: o.marketCode,
      flag: display.flag,
      name: display.name,
      code: o.marketCode,
      // 원본 금액이 없는 행(레거시)은 저장된 원화값이 그 줄의 유일한 가격이다.
      observedPrice:
        o.priceAmount != null ? formatOriginAmount(o.priceAmount, o.currency) : formatKrwAmount(o.priceKrw),
      // 판단 시장 줄만 라벨을 갖는다 — 화면에서 다른 "한국 가격"과 부딪히는
      // 유일한 줄이기 때문이다(위 GlobalMarketRow 주석).
      priceMeaningLabel: isJudgingMarket ? PRICE_MEANING_LABEL.KR_MARKET_PRICE : null,
      identity: {
        ...SAME_PRODUCT_BY_CONSTRUCTION,
        // 근거는 관측에 적힌 것만 쓴다. 경로를 읽지 못하면 그 조각을 빼고,
        // 없는 상품 코드를 지어내지 않는다.
        evidence: ["동일 판매처 · 동일 상품 경로", path, `시장 코드만 ${o.marketCode}로 바꿔 관측`]
          .filter(Boolean)
          .join(" · "),
      },
      // 원화가 이미 앞에 있으면 환산 칸을 비운다(같은 숫자를 두 번 쓰지 않는다).
      krwPrice: o.priceAmount != null && !isKrw ? formatKrwAmount(o.priceKrw) : null,
      availability: availabilityOf(o.soldOut),
      declaredCountry: o.marketCountry,
      productUrl: o.productUrl,
      checkedAt: o.checkedAt,
      isJudgingMarket,
    };
  });

  return {
    title: PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET,
    rows,
    // "각 시장에서 실제 관측된 판매가격"(CEO 지시문 그대로). 뒷문장 둘은 이
    // 카드가 무엇이 **아닌지**를 화면이 직접 말하게 한다 — 국내 비교상품도
    // 아니고(③), 내가 치르는 돈도 아니다(④). MI/PRICE-2에서 뒤 절이 늘었다:
    // 🇰🇷 줄에 붙어 있던 "착지원가 기준" 배지를 지우면서, 그 배지가 잘못 말하던
    // 경계를 카드 전체가 한 번만 정확히 말하게 옮긴 것이다.
    note: `각 시장에서 실제 관측된 판매가격입니다 — 이 판매처가 직접 파는 값이고, ${market.label} 편집샵의 비교상품 가격이 아닙니다. 제가 들여올 때 드는 돈은 ④ 수익성에서 따로 계산합니다.`,
    empty:
      rows.length > 0
        ? null
        : // 조회는 정상이었는데 다른 시장이 없었다(Shopify가 아니거나 시장이 하나뿐).
          // "확인 불가"가 아니라 "흔적이 없다"이다.
          miEmptyState("NO_SEARCH_DATA", "이 판매처에서 확인된 다른 시장 가격이 없습니다"),
  };
}

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
