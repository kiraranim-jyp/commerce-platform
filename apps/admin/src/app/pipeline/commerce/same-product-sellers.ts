import { formatKrwAmount } from "./mi-headline";
import { miEmptyState, type MiEmptyState } from "./mi-empty-state";

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **동일상품 판매처**.
 *
 * ── 왜 카드가 하나 더 생기는가 ───────────────────────────────────────────
 * 🌎 판매자 글로벌 시장 가격은 **한 판매처의 여러 나라 가격**이다. 그 카드의
 * 줄들이 같은 상품이라는 것은 매칭이 판정한 결과가 아니라 구성으로 참인 불변식이다
 * (같은 상품 페이지, 시장 코드만 바꿔 관측). 그래서 그 카드에는 등급이 없다.
 *
 * 이 카드는 정반대다. **여러 판매처의 같은 상품**이고, "같다"는 말은 판정의
 * 결과다(matchTruth). 등급이 있고, 흔들릴 수 있고, 근거가 필요하다.
 *
 * 두 사실을 한 카드에 넣으면 어떤 일이 벌어지는지 이미 봤다: 줄마다 🟢이 붙은
 * 나라 목록이 🟢 동일상품 판정 목록과 같은 모양으로 읽혔고, 셀러는 "프랑스"가
 * 판매처 이름인지 나라 이름인지부터 골라야 했다. 그래서 카드를 나눈다 —
 * 나누는 것이 곧 두 개념이 섞이지 않게 하는 장치다.
 *
 * ── 이 카드에 설 수 있는 값 ─────────────────────────────────────────────
 * 🟢 동일상품으로 **확정된** 관측뿐이다. 🟡 추정도 ⚪ 유사도 여기 들어오지
 * 않는다 — 들어올 수 있는 인자 자체가 없다. 입력 이름이 sameProductListings인
 * 것이 그 장치다: 호출부는 EXACT 버킷(priceTierFromLink === "EXACT",
 * domesticMarketSplit.exact)만 여기로 넘길 수 있고, 다른 버킷을 넣으려면
 * 새 인자를 뚫어야 한다. 그때 이 파일의 테스트가 먼저 깨진다.
 *
 * ── 계산하지 않는다 ─────────────────────────────────────────────────────
 * 최저가도 평균가도 차액도 내지 않는다. 판매처와 그 판매처의 관측가를 나란히
 * 놓는 것까지가 이 카드의 일이고, 빼는 일은 ③ 수익성이 한다.
 */

export const SAME_PRODUCT_SELLERS_TITLE = "동일상품 판매처";

/** 관측이 없는 줄에 서는 것. 다른 판매처의 가격을 옮겨 적어 칸을 채우지 않는다. */
const EMPTY_PRICE = "—";

/**
 * 이 카드가 다는 단 하나의 등급. 줄마다 다르지 않다 — 다른 등급의 관측은
 * 애초에 이 카드에 들어오지 못하기 때문이다(위 주석). match-display.ts의
 * 🟢 동일상품과 **같은 말**을 쓴다: 여기서 두 번째 이름을 만들면 같은 판정이
 * 화면마다 다르게 불린다(MATCHING-UNIFY-1이 없앤 문제 그 자체다).
 */
export interface SameProductVerdict {
  icon: string;
  label: string;
}

export interface SameProductSellerRow {
  /** React key이자 이 줄의 정체성. 판매처 이름은 중복될 수 있으므로 URL을 섞는다. */
  key: string;
  /** 화면에 쓰는 판매처 이름. 등록된 이름 그대로이고, 지어내지 않는다. */
  sellerName: string;
  /** 화면에 그대로 쓰는 금액 문자열. 관측이 없으면 "—". */
  price: string;
  productUrl: string | null;
  /**
   * 셀러가 등록한 그 판매처인가. 목록의 어느 줄이 원본인지 화면이 말할 수
   * 있어야 한다 — 여러 판매처가 나란히 선 목록에서 그 구분이 없으면 "지금
   * 보고 있는 이 가격이 내가 사려는 곳의 값인가"에 답할 수 없다.
   */
  isOrigin: boolean;
}

export interface SameProductSellersCard {
  title: string;
  rows: SameProductSellerRow[];
  /** 카드 전체가 한 번 다는 등급. 줄마다 갖는 값이 아니다. */
  verdict: SameProductVerdict;
  note: string;
  /** 비교할 다른 판매처가 없을 때. 판정 실패가 아니라 흔적이 없는 것이다. */
  empty: MiEmptyState | null;
}

export interface SameProductSellersInput {
  /**
   * 셀러가 등록한 원본 판매처. 이름은 등록된 URL의 호스트에서 읽고, 금액은
   * 🌎 글로벌 시장 카드의 판단 시장 줄이 이미 완성한 문자열을 그대로 받는다
   * (금액을 여기서 다시 만들지 않는다 — 한 화면에 같은 사실의 두 문자열이
   * 생기면 한쪽만 고쳐지는 날이 온다).
   */
  origin: { sourceUrl: string | null; price: string | null } | null;
  /**
   * **🟢 동일상품으로 확정된** 국내 판매처 관측. EXACT 버킷만 들어온다
   * (domesticMarketSplit.exact.sampleListings 그대로).
   */
  sameProductListings: { mallName: string | null; priceKrw: number; productUrl: string | null }[];
}

/**
 * 등록된 URL에서 판매처 이름을 읽는다. **지어내지 않는다** — 호스트에 적혀
 * 있는 글자를 그대로 쓰고, 앞의 www.와 뒤의 도메인 꼬리만 뗀다
 * (www.smallable.com → Smallable). 읽을 수 없으면 null이고, 그때는 이 줄을
 * 그리지 않는다: 이름 없는 판매처 줄은 "여기가 어디지"라는 질문이지 정보가
 * 아니다.
 *
 * 별칭 표(smallable.com → "스몰러블")를 만들지 않는 이유는 이 저장소의 다른
 * 표들과 같다 — 표가 생기는 순간 표에 없는 판매처는 이름을 잃는다.
 */
export function sellerNameFromUrl(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  let host: string;
  try {
    host = new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
  const label = host.replace(/^www\./i, "").split(".")[0];
  if (!label) return null;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * 판매처 목록을 만든다. 원본 판매처가 언제나 첫 줄이다 — 나머지 줄은 그 줄과
 * 비교하기 위해 있는 것이므로, 기준이 목록 가운데에 섞이면 비교의 방향이
 * 사라진다. 그 아래는 서버가 준 순서 그대로다(여기서 정렬하지 않는다 —
 * 최저가순으로 세우면 "가장 싼 곳"이라는 판단이 목록 모양으로 새어 나온다).
 */
export function buildSameProductSellersCard(input: SameProductSellersInput): SameProductSellersCard {
  const rows: SameProductSellerRow[] = [];

  const originName = sellerNameFromUrl(input.origin?.sourceUrl ?? null);
  if (originName) {
    rows.push({
      key: `origin:${input.origin!.sourceUrl}`,
      sellerName: originName,
      price: input.origin?.price ?? EMPTY_PRICE,
      productUrl: input.origin?.sourceUrl ?? null,
      isOrigin: true,
    });
  }

  for (const listing of input.sameProductListings) {
    // 이름이 없는 관측은 그리지 않는다 — 어느 판매처인지 말할 수 없는 가격은
    // 비교의 재료가 아니다.
    if (!listing.mallName) continue;
    rows.push({
      key: `same:${listing.productUrl ?? listing.mallName}`,
      sellerName: listing.mallName,
      price: formatKrwAmount(listing.priceKrw),
      productUrl: listing.productUrl,
      isOrigin: false,
    });
  }

  return {
    title: SAME_PRODUCT_SELLERS_TITLE,
    rows,
    verdict: { icon: "🟢", label: "동일상품" },
    note: "같은 상품을 파는 판매처들의 관측 가격입니다 — 동일상품으로 확정된 판매처만 이 목록에 섭니다.",
    empty:
      // 원본 한 줄만 있는 상태는 비교가 아니라 관측 하나다(① 원본 상품이 이미
      // 말하고 있다). 비교할 상대가 생겼을 때만 이 카드가 답을 갖는다.
      rows.filter((row) => !row.isOrigin).length > 0
        ? null
        : miEmptyState("NO_SEARCH_DATA", "같은 상품을 파는 다른 판매처가 아직 확인되지 않았습니다"),
  };
}
