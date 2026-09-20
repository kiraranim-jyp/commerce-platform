import type { ShippingPolicyStatus } from "@commerce/pricing";
import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import { decodeHtmlEntities } from "./html-entities";
import { productFactsFromListing } from "./seller-facts";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOMAIN = "www.foretforet.com";

/** N-4.20(대표님 지시, 2026-08-26: "포레포레 위에 신발건도 그렇고 동일을 못찾고") —
 * 포레포레(foretforet.com)는 domestic_price_sources에 collectionStrategy="MANUAL"로
 * 등록만 되어 있고 실제 파서가 없어서 항상 unsupported였다(매칭 정확도 문제가
 * 아니라 애초에 검색을 시도한 적이 없었다). 실측 확인(2026-08-26, curl):
 * 이 매장은 MakeShop 플랫폼이고, 검색결과 상품 목록은 홈페이지 HTML에 서버렌더링
 * 되지 않는다(초기 HTML엔 검색 폼만 있고, 상품 그리드는 JS의 get_list()가 별도
 * AJAX 호출로 채운다) — 그 AJAX 엔드포인트(`/shop/product_list.action.html`)를
 * 직접 GET으로 호출하면 인증/세션 없이도 JSON({html: "...상품 카드 HTML..."})을
 * 그대로 반환한다(실측: 검색어 "페페"로 실제 PèPè(브랜드 표기 "PEPE SHOES") 상품
 * 100건, 카드마다 branduid/브랜드/제목(SKU 접미사 포함)/가격/이미지 확인).
 */
const ITEM_SPLIT_RE = /<div class="item item_(\d+)">/;
const BRAND_RE = /<div class="brand"><a[^>]*>([^<]*)<\/a><\/div>/;
/** 실측 확인 — 표시용 제목(`summary`)과 별개로, 검색 결과 없는 `name` div에
 * "AW26[페페슈즈]루시 말라가 슈즈 NUDE-PP26KASTR0006MNU"처럼 실제 상품명 전체와
 * 내부 품번이 함께 들어있다(화면엔 숨겨져 있지만 마크업엔 항상 존재 — 5개 샘플
 * 전부 확인). match.ts의 모델명 비교에는 이 전체 문자열을, SKU는 아래
 * extractTrailingCode()로 마지막 하이픈 뒤 품번만 따로 뽑는다. */
const NAME_RE = /<div class="name"[^>]*>\s*<a[^>]*>([^<]*)<\/a>/;
const IMG_RE = /<img src="([^"]+)"/;
/** 실측 확인 — 할인 없는 카드는 `<span class="price">` 하나만, 할인 카드는
 * `<span class="price strike">정가</span><span class="price">할인가</span>`
 * 순서로 둘 다 나온다(둘 다 이 정규식에 매칭, strike 여부만 다름). */
const PRICE_RE = /<span class="price( strike)?">([\d,]+)<\/span>/g;
/** 실측 확인(5개 샘플: PP26KASTR0006MNU/PP26KABAL0275RRC/PP26KSSAN1325MCH 등) —
 * 상품명 마지막 하이픈 뒤에 항상 대문자+숫자로만 이루어진 내부 품번이 붙는다.
 * 이 패턴이 없으면(다른 상품유형 등) 그냥 undefined — 지어내지 않는다. */
const TRAILING_CODE_RE = /-([A-Z0-9]{6,20})$/;

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export interface ForetforetProductPrice {
  price: { amount: number; currency: "KRW" } | null;
  available: boolean;
  soldOut: boolean | null;
  /**
   * DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — soldOut 선례 그대로다. HTML을
   * «실제로 읽었을 때만» 채운다. 응답을 못 받으면(!response.ok) 이 두 칸은
   * undefined로 남는다 — 그건 "상태 데이터 없음"이고 UNREAD("읽었지만 못 찾음")와
   * 다른 사실이다(shipping-policy.ts describeShippingPolicy 주석 참고).
   */
  shippingPolicyStatus?: ShippingPolicyStatus | null;
  shippingPolicyNote?: string | null;
  /**
   * P0-C STEP 2(CEO 승인, 2026-09-20) — 🔴 **FLAT 일 때만 값이 있다.**
   * 다른 상태에서 숫자가 들어오면 저장 계층이 배치를 거절한다(그것이 054 의
   * 목적이다). 위 ForetforetShippingPolicy 유니온이 그 모순을 만들 수 없게 한다.
   */
  shippingCostAmount?: number | null;
}

/** N-4.18-Q3 PART S(대표님 지시, 2026-08-26) — domestic_product_links로 이미 연결된
 * 상품의 "지금" 가격을 재조회할 때 쓴다(Daily Watch cron이 매일 호출). 실측 확인
 * (2026-08-26, curl shopdetail.html): 상세 페이지 JS에 `var product_price = '258000';`
 * 형태로 최종 판매가(할인 적용 후)가 그대로 담겨 있다 — 검색결과 카드의 price/strike
 * 구조와 달리 상세 페이지는 이 변수 하나만 확인됨. */
const DETAIL_PRICE_RE = /var product_price = '(\d+)'/;

/** N-4.18-Q3 PART E-10(대표님 지시, 2026-08-27) — 이전 세션에서 changeOpt2value의
 * `num` 배열 출처를 찾지 못했던 이유를 실측으로 규명: 이 함수는 옵션이 구형
 * spcode/spcode2 구조(`document.getElementById('option_type')`가 없는 경우)일 때만
 * 실행되는데, 실제 골든케이스(VERNICE NERO T-스트랩 슈즈, branduid=10226592)를
 * 포함해 실측한 20개 이상의 상품 전부가 `id="option_type" value="PS"` 히든
 * 인풋을 갖고 있어(신형 통합옵션 구조) 이 조건이 항상 거짓이 된다 — 즉
 * changeOpt2value는 죽은 코드이고 옵션별 재고는 다른 경로로 내려온다.
 *
 * 실제 재고 신호는 두 가지 형태로 존재한다(둘 다 20개 이상 실측 확인):
 * 1) 단일 옵션(사이즈만 등) 상품 — `<select name="optionlist[]">` 안의 각
 *    `<option ... sto_state="SALE|SOLDOUT">`에 HTML 속성으로 직접 노출된다
 *    (골든케이스 실측: NER,23=SOLDOUT / NER,24~27=SALE / NER,28~30=SOLDOUT).
 * 2) 다차원 옵션(사이즈+색상처럼 select가 2개 이상) 상품 — 개별 `<option>`
 *    태그에는 `sto_id="0"` 플레이스홀더만 있고, 실제 조합별 재고는 별도 JS
 *    변수 `var optionJsonData = {...}`의 각 조합 객체마다 홑따옴표
 *    `sto_state:'SALE'` 형태로 들어있다(20개 상품 실측: 전부 이 형태였고 값은
 *    전부 SALE — 완전품절 실사례는 이번 조사에서 찾지 못했다).
 * 두 형태 모두 "조합 하나하나의 재고 상태"를 그대로 나열한 것이므로, 형태와
 * 무관하게 같은 규칙을 적용할 수 있다: 신호가 하나도 없으면 null(확인불가),
 * 하나라도 SALE이면 전체 soldOut=false(옵션 일부만 품절이어도 구매 가능),
 * 전부 SOLDOUT이면 soldOut=true. 검색 목록 AJAX 응답(product_list.action.html)에는
 * 이 신호가 전혀 없다(실측 확인) — 상세 페이지를 반드시 거쳐야 한다. */
const STO_STATE_RE = /sto_state(?:="([A-Z]+)"|:'([A-Z]+)')/g;

function detectSoldOut(html: string): boolean | null {
  const states = [...html.matchAll(STO_STATE_RE)].map((m) => m[1] ?? m[2]);
  if (states.length === 0) return null;
  return states.every((s) => s === "SOLDOUT");
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — 배송비 «정책»을 읽는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 여기서 금액을 뽑지 않는다. 「3,000원」을 정규화해서 shipping_cost_amount에
 *    넣는 순간 그 숫자는 «이 상품의 배송비»로 읽히는데, 실제 사실은
 *    「70,000원 미만일 때만 3,000원」이다. 상태(CONDITIONAL_FREE)와 원문(note)만
 *    남기고 금액 칸은 비운다 — resolveShippingPolicy()가 그 규칙을 저장 직전에
 *    다시 강제한다.
 *
 * ── 어디를 읽는가 (2026-09-16 실측, branduid=10226592 · HTTP 200) ───────────
 * MakeShop 상세 페이지에는 배송비가 «두 자리»에 있고, 둘의 성격이 다르다.
 *
 *  ① 상품정보 필드 — 상태의 근거
 *       <span class="shopdetailInfoName">배송비</span>
 *       <span class="shopdetailInfoCont"><a href="javascript:alert('총 결제금액이
 *         70,000원 미만시 배송비 3,000원이 청구됩니다.');"><span>배송조건 : (조건)</span>
 *     "배송조건 : (조건)"은 판매자가 쓴 문장이 아니라 MakeShop이 배송비 설정
 *     «종류»를 그대로 찍어 주는 라벨이다. 즉 이 자리가 «판매처 스스로 선언한
 *     배송비 유형»이고, 그래서 상태는 여기서만 읽는다(본문 문장을 우리가
 *     해석해서 상태를 정하지 않는다).
 *
 *  ② 구매혜택 블록 — note의 근거
 *       <dl><dt>입점사 배송비</dt><dd>총 결제금액이 70,000원 미만시 배송비
 *         3,000원이 청구됩니다. <br>아래 지역에 배송비가 추가됩니다.<br>진도군
 *         조도면 : 3,000원(10,000,000원 미만시), …</dd></dl>
 *     🔴 이 블록의 첫 문장은 ①의 alert 문자열과 «글자까지 같다». 즉 ②는 ①의
 *        상위집합이다 — 그래서 note를 ②로 두면 «우리가 두 자리를 이어 붙인
 *        문장»이 아니라 «판매처가 한 자리에 쓴 원문 하나»가 된다. 지역 할증까지
 *        그 안에 이미 들어 있다.
 *
 * 🔴 note에 «원문 그대로»가 아닌 부분은 정확히 셋뿐이고, 저장을 위해 피할 수 없다:
 *    <br> → 줄바꿈 · 그 밖의 태그 제거 · HTML 엔티티 디코드와 줄별 공백 정리.
 *    단어는 한 글자도 바꾸지 않고, 요약·재작성·단위 정규화를 하지 않는다.
 *
 * 🔴 «(조건)» 말고 다른 라벨은 이번에 한 건도 실측하지 못했다. 그래서 그 밖의
 *    모든 경우는 UNREAD다 — 「(무료)는 FREE겠지」 같은 추측으로 표를 만들지
 *    않는다(실측 1건으로 어휘를 넓히지 않는다). UNREAD여도 읽어낸 원문은 note에
 *    그대로 남기므로, 다음 라벨을 실측하면 그 note가 바로 근거가 된다.
 */
const SHIPPING_FIELD_RE = /<span class="shopdetailInfoName">\s*배송비\s*<\/span>([\s\S]*?)<\/p>/;
/** 필드 안의 판매처 문장은 태그가 아니라 alert() 인자 안에 있다(위 실측 참고). */
const SHIPPING_FIELD_ALERT_RE = /javascript:alert\('([\s\S]*?)'\)/;
const VENDOR_SHIPPING_BLOCK_RE = /<dt>\s*입점사 배송비\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/;
/** MakeShop이 찍는 «조건부 무료배송» 라벨. 이 한 값만 실측했다. */
const CONDITIONAL_SHIPPING_LABEL = "(조건)";
/**
 * P0-C STEP 2(CEO 승인, 2026-09-20) — MakeShop 이 «고정 배송비» 에 찍는 라벨.
 *
 * 2026-09-20 실측 12건에서 배송조건 라벨은 «둘뿐» 이었다:
 *     배송조건 : (조건)  × 11   "총 결제금액이 70,000원 미만시 …"
 *     배송조건 : (고정)  ×  1   "주문금액에 상관없이 배송비가 3,500원 …"
 * 세 번째 라벨은 나오지 않았다 — 그래서 이번에도 그 칸을 «만들지 않는다».
 *
 * 🔴 문장 하나만 보고 승격한 것이 아니다. 라벨 「고정」과 본문 「주문금액에
 *    상관없이」가 서로 «독립적으로» 같은 말을 한다. 하나뿐이었다면 UNREAD 로
 *    두었을 것이다.
 */
const FLAT_SHIPPING_LABEL = "(고정)";

/** 「3,500원」 · 「4000원」 처럼 판매처가 «원» 을 붙여 쓴 금액만 센다. */
const MONEY_RE = /(\d{1,3}(?:,\d{3})+|\d+)\s*원/g;

/**
 * 🔴 **금액이 «정확히 하나» 일 때만 답한다.** 이것이 이 함수의 전부다.
 *
 * 실측(uid 10278273)에서 같은 정책이 두 자리에 있고 숫자 개수가 다르다:
 *
 *     alert   "… 배송비가 3,500원 청구됩니다."                 숫자 1개  ← 기본 배송비
 *     입점사  "… 3,500원 … 제주 및 도서산간 지역 4000원"       숫자 2개  ← 지역 할증 포함
 *
 * 입점사 블록에서 뽑으면 **제주 할증 4,000 이 이 상품의 배송비가 된다.**
 * 그래서 호출부는 alert 만 넘기고, 여기서는 후보가 둘 이상이면 «모른다» 고
 * 답한다 — 둘 중 하나를 고르는 규칙을 만들지 않는다. 고르는 순간 그것은
 * 관측이 아니라 우리의 해석이다.
 */
function soleAmountKrw(text: string): number | null {
  const found = [...text.matchAll(MONEY_RE)].map((m) => Number(m[1]!.replace(/,/g, "")));
  if (found.length !== 1) return null;
  const amount = found[0]!;
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

/** 판매처가 쓴 문장만 남긴다 — 태그를 지우고 <br>은 줄바꿈으로 둔다. */
function shippingBlockToText(html: string): string {
  return decodeHtmlEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n")
    // 줄 안의 연속 공백만 한 칸으로 줄인다(정규식 공백류에 &nbsp; 디코드 문자도 포함된다).
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * 🔴 **`FLAT` 이면 금액이 «반드시» 있다 — 타입이 그것을 강제한다.**
 *
 * 「대체로 잘 뽑힌다」로는 안 되는 이유가 있다. recordPriceObservations 는 상태와
 * 금액이 모순되면 **그 배치를 통째로 거절한다**(price-observations.ts). 그리고
 * FLAT 의 amountRule 은 REQUIRED_POSITIVE 다. 즉 금액 없는 FLAT 이 한 건이라도
 * 나오면 **그 실행의 국내 관측 전부가 0행이 되고**, 그 상품만이 아니라 같이
 * 돌던 다른 판매처 가격까지 사라진다.
 *
 * 그 설계는 옳다(모순된 행을 막는 것이 054 의 목적이다). 그래서 그 모순을
 * «만들 수 없게» 여기서 유니온으로 잠근다 — 금액을 못 구하면 FLAT 을 아예
 * 표현할 수 없고, 호출부는 UNREAD 로 떨어진다.
 */
export type ForetforetShippingPolicy = {
  /** 판매처 원문. 아무 문장도 못 찾으면 null(빈 문자열로 "근거를 적었다"고 하지 않는다). */
  note: string | null;
} & (
  | { status: "FLAT"; amountKrw: number }
  /** 🔴 HTML을 읽은 이상 «상태 없음(null)»은 나오지 않는다 — 못 읽은 것과 읽고도
   *  못 찾은 것(UNREAD)은 다른 사실이고, 여기 온 시점에 이미 읽은 뒤다. */
  | { status: Exclude<ShippingPolicyStatus, "FLAT">; amountKrw: null }
);

export function extractForetforetShippingPolicy(html: string): ForetforetShippingPolicy {
  const fieldBlock = SHIPPING_FIELD_RE.exec(html)?.[1] ?? null;
  const fieldLabel = fieldBlock ? shippingBlockToText(fieldBlock) : "";
  const alertText = fieldBlock ? shippingBlockToText(SHIPPING_FIELD_ALERT_RE.exec(fieldBlock)?.[1] ?? "") : "";
  const vendorText = shippingBlockToText(VENDOR_SHIPPING_BLOCK_RE.exec(html)?.[1] ?? "");
  // ②(상위집합) → ①의 문장 → ①의 라벨 순으로 «한 자리»를 고른다. 이어 붙이지
  // 않는다 — 두 자리를 합치는 순간 그 문장은 판매처 원문이 아니라 우리 편집물이다.
  const note = vendorText || alertText || fieldLabel || null;

  // 조건부 무료는 예전 그대로다 — 조건을 숫자 한 칸에 욱여넣지 않는다.
  if (fieldLabel.includes(CONDITIONAL_SHIPPING_LABEL)) return { status: "CONDITIONAL_FREE", amountKrw: null, note };

  if (fieldLabel.includes(FLAT_SHIPPING_LABEL)) {
    // 🔴 금액은 «alert 만» 본다. note 는 지역 할증까지 든 상위집합이라 그쪽에서
    //    뽑으면 「제주 4,000」이 기본 배송비가 된다.
    const amountKrw = soleAmountKrw(alertText);
    if (amountKrw != null) return { status: "FLAT", amountKrw, note };
    // 라벨은 「고정」인데 금액이 하나로 좁혀지지 않았다. 그건 «못 읽은 것»이다.
  }

  return { status: "UNREAD", amountKrw: null, note };
}

/** N-4.18-Q3 PART H-3-2(대표님 지시, 2026-08-27) — 상세페이지 JSON-LD(schema.org/
 * Product)의 `mpn`(Manufacturer Part Number)을 실측 확인(PèPè 골든케이스:
 * `"mpn":"PP24KASHE1195NER"`, `"@type":"Offer"`가 배열이 아니라 단일 객체 —
 * RULII/LOOXLOO/DEUXBEBE(Cafe24, offers[] 배열)와 다른 MakeShop 플랫폼 구조).
 * mpn이 없으면 null — 다른 필드로 추정하지 않는다. */
const JSON_LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

export function extractForetforetModelCode(html: string): string | null {
  for (const match of html.matchAll(JSON_LD_RE)) {
    try {
      const data = JSON.parse(match[1]) as { "@type"?: string; mpn?: string };
      if (data["@type"] === "Product" && typeof data.mpn === "string" && data.mpn.trim()) {
        return data.mpn.trim();
      }
    } catch {
      // 이 <script> 블록이 유효한 JSON이 아니면 건너뛴다(예: FORETFORET의 두 번째
      // JSON-LD 블록은 홑따옴표를 쓰는 비표준 형식이라 실측 확인상 파싱 실패함).
    }
  }
  return null;
}

export async function fetchForetforetProductPrice(url: string): Promise<ForetforetProductPrice> {
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  // 🔴 응답 자체를 못 받았다 — 배송비 정책을 «읽지 않았다». 두 칸을 채우지 않는다
  //    (UNREAD는 "읽었는데 못 찾았다"는 주장이라 여기서 쓰면 없는 관측이 된다).
  if (!response.ok) return { price: null, available: false, soldOut: null };
  const html = await response.text();
  const amount = parsePrice(DETAIL_PRICE_RE.exec(html)?.[1] ?? "");
  const soldOut = detectSoldOut(html);
  // DOMESTIC-SHIPPING-03 — soldOut과 같은 자리에서 같은 원칙으로 읽는다: 가격을
  // 못 찾아도(아래 else 분기) 배송비 정책을 확인한 사실은 그대로 남긴다.
  const shipping = extractForetforetShippingPolicy(html);
  return amount
    ? {
        price: { amount, currency: "KRW" },
        available: true,
        soldOut,
        shippingPolicyStatus: shipping.status,
        shippingPolicyNote: shipping.note,
        shippingCostAmount: shipping.amountKrw,
      }
    : {
        price: null,
        available: false,
        soldOut,
        shippingPolicyStatus: shipping.status,
        shippingPolicyNote: shipping.note,
        shippingCostAmount: shipping.amountKrw,
      };
}

/** N-4.18-Q3 PART H-3-6(대표님 지시, 2026-08-27) — domestic_product_links 연결
 * 단계에서 실제 후보의 modelCode 증거를 확보하기 위한 단독 fetch. 기존
 * fetchForetforetProductPrice(가격/품절)와 별도 요청이다 — 그 함수의 반환
 * 계약을 바꾸지 않는다(이미 daily cron 등 기존 호출부가 의존 중이므로). 실패
 * 시 null — 추정하지 않는다. */
export async function fetchForetforetModelCode(url: string): Promise<string | null> {
  try {
    const response = await fetchWithDomainRateLimit(url, {
      headers: { Accept: "text/html", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractForetforetModelCode(html);
  } catch {
    return null;
  }
}

export async function searchForetforet(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/shop/product_list.action.html?action_mode=get_list&page=1&category=&sort=&search=${encodeURIComponent(query)}&viewtype=&sp_search_type=&add_check=`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "application/json", "User-Agent": CHROME_UA, "X-Requested-With": "XMLHttpRequest" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`foretforet search ${response.status}`);

  const data = (await response.json()) as { html?: string };
  const html = data.html ?? "";
  const parts = html.split(ITEM_SPLIT_RE);
  // split()으로 캡처 그룹(branduid)까지 같이 쪼개면 [머리말, id1, block1, id2, block2, ...] 형태가 된다.
  const candidates: ComparisonCandidate[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    if (candidates.length >= 5) break;
    const branduid = parts[i];
    const block = parts[i + 1] ?? "";

    const nameMatch = NAME_RE.exec(block);
    if (!nameMatch) continue;
    const title = decodeHtmlEntities(nameMatch[1].trim());
    if (!title) continue;

    const rawBrand = BRAND_RE.exec(block)?.[1]?.trim();
    const brand = rawBrand ? decodeHtmlEntities(rawBrand) : undefined;

    const priceMatches = [...block.matchAll(PRICE_RE)].map((m) => ({
      isStrike: Boolean(m[1]),
      amount: parsePrice(m[2]),
    }));
    const salePrice = priceMatches.find((p) => !p.isStrike)?.amount ?? null;
    const regularPrice = priceMatches.find((p) => p.isStrike)?.amount ?? null;

    const img = IMG_RE.exec(block)?.[1];
    const sku = TRAILING_CODE_RE.exec(title)?.[1];
    const url = `https://${DOMAIN}/shop/shopdetail.html?branduid=${branduid}`;
    const imageUrl = img ? (img.startsWith("//") ? `https:${img}` : img) : null;

    candidates.push({
      title,
      url,
      price: salePrice ? { amount: salePrice, currency: "KRW" } : null,
      regularPrice:
        regularPrice && salePrice && regularPrice > salePrice ? { amount: regularPrice, currency: "KRW" } : null,
      imageUrl,
      confidence: 0,
      brand,
      sku,
      // MI-MATCHING-3.0 — 위에서 이미 읽은 값을 판정기가 보는 칸에도 담는다.
      // sku(BB26KSSSTC045041)는 국내 유통사 코드라 brandModelCode가 아니라
      // sellerSku 칸으로만 들어간다(productFactsFromListing 주석 참고).
      facts: productFactsFromListing({ title, url, brand, sellerSku: sku, imageUrl }),
    });
  }

  return candidates;
}
