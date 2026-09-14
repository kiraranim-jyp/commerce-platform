import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import type { CategorySelection } from "@commerce/category";
import {
  hasLotteOnSellableOptions,
  resolveLotteOnImageUrls,
  resolveLotteOnProductName,
} from "@commerce/listing";

/**
 * LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14) — 롯데ON 탭이 **무엇을 다시
 * 묻고 무엇을 묻지 않는가**를 정하는 단 하나의 파일.
 *
 * ── 이 파일이 존재하는 이유 ────────────────────────────────────────────────
 * CEO 지시의 핵심은 "롯데ON만 잘 등록되는 것"이 아니라 "네이버·쿠팡과 다른 세
 * 번째 시스템을 하나 더 만들지 않는 것"이다. 그 실패는 항상 같은 모양으로
 * 온다 — 채널 탭이 상품명·가격·옵션을 **다시 입력받기 시작하는 순간** 같은
 * 상품이 화면 안에 두 벌 생기고, 둘이 갈라진다.
 *
 * 그래서 경계를 컴포넌트 안이 아니라 여기 순수 함수로 못 박는다:
 *
 *   공통(재입력 금지)  상품명 · 대표이미지 · 상세페이지 · 가격 · 옵션 · 재고
 *                      → CanonicalProduct에서 **읽기만** 한다. 이 파일에는
 *                        그 값을 고치는 함수가 하나도 없다(setter가 없다).
 *   롯데ON 전용(입력)  표준+전시 카테고리 · 고시 · 안전인증 · 배송 선등록 번호
 *                      → 상품 데이터에서 파생할 수 없는 외부 코드들뿐이다.
 *
 * ── 왜 컴포넌트에서 분리했는가 ─────────────────────────────────────────────
 * 아래 함수들은 React를 모르고 fetch를 모른다. 그래서 "공통 정보를 재입력받지
 * 않는다"와 "유아동은 안전인증 없이 통과하지 못한다" 같은 규칙을 렌더링 없이
 * 테스트로 고정할 수 있다(__tests__/lotteon-channel-form.test.ts).
 *
 * ── 요약이 payload와 갈라지지 않게 하는 방법 ───────────────────────────────
 * 화면에 "이 값으로 등록됩니다"를 보여주려면 그 값을 어딘가에서 계산해야 하고,
 * 거기서 두 벌이 생긴다. 그래서 summarizeCommonProduct()는 **새로 계산하지
 * 않는다** — 실제 87 payload를 만드는 packages/listing/src/lotteon/build-payload.ts
 * 가 쓰는 바로 그 함수(resolveLotteOnProductName / resolveLotteOnImageUrls /
 * hasLotteOnSellableOptions)를 그대로 부르고, 가격은 화면이 이미 계산해 둔
 * resolveListingPrice() 결과를 인자로 받기만 한다.
 */

/** 고시 품목코드 23 = 어린이제품(유아동). 안전인증이 필수가 되는 분기점이다. */
export const LOTTEON_CHILD_PRODUCT_ITEM_CODE = "23";

/**
 * 롯데ON 카테고리는 **표준 + 전시 2중 구조**다.
 *
 * 🔴 공통 category를 덮어쓰지 않는다(CEO 명시). 이 타입에는 공통 카테고리를
 * 담는 필드가 아예 없다 — 공통 쪽 값은 아래 CommonCategorySource로 **읽기만**
 * 하고, 그 둘을 잇는 것이 "매핑"이다. 한 필드에 같이 담으면 롯데ON에서 고른
 * 번호가 스마트스토어/쿠팡 카테고리를 덮어쓰는 사고가 구조적으로 가능해진다.
 */
export interface LotteOnCategoryMapping {
  /** 표준카테고리번호(scatNo) — onpick 205. */
  standardCategoryNo: string;
  /** 전시카테고리번호(dcatLst) — onpick 206. 표준카테고리에 매핑된 것만 가능. */
  displayCategoryNos: string[];
}

/** 고시(상품정보제공고시) — pdItmsCd + pdItmsArtlLst[]. */
export interface LotteOnNoticeForm {
  /** 상품품목코드(pdItmsCd). */
  itemCode: string;
  /** 한 줄에 하나씩 `항목코드:내용`. 코드체계는 품목마다 달라 생성하지 않는다. */
  articlesText: string;
}

/** 인증 — sftyAthnLst[] + impPrxCd. */
export interface LotteOnCertificationForm {
  /** 한 줄에 하나씩 `유형코드:인증번호[:기관명]`. */
  safetyText: string;
  /** 수입대행코드(impPrxCd). */
  importProxyCode: string;
}

/** 배송 — 출고지 · 반품지 · 배송비 정책 · 배송가능지역(전부 롯데ON 선등록 값). */
export interface LotteOnDeliveryForm {
  outboundPlaceNo: string;
  returnPlaceNo: string;
  deliveryCostPolicyNo: string;
  deliveryRegionGroupCode: string;
  courierCode: string;
  returnCourierCode: string;
  weekdayCloseTime: string;
}

/** 위 네 축에 들어가지 않는 나머지 롯데ON 코드들. */
export interface LotteOnProductCodeForm {
  /** 원산지코드(oplcCd) — 원산지 텍스트에서 추론하지 않는다. */
  originCode: string;
  /** 과세유형코드(tdfDvsCd). */
  taxTypeCode: string;
  /** 브랜드번호(brdNo) — 문자열 브랜드명은 이 필드에 들어가지 않는다. */
  brandNo: string;
  /** 업체상품번호(epdNo) — 우리 쪽 식별자. */
  externalProductNo: string;
}

/**
 * 롯데ON 탭이 들고 있는 입력 전부. **상품명/가격/옵션/재고/이미지가 없다** —
 * 그것이 이 타입의 존재 이유다. 필드를 더하기 전에 "이 값을 CanonicalProduct
 * 에서 읽을 수 있는가"를 먼저 물어라. 읽을 수 있으면 여기 넣지 마라.
 */
export interface LotteOnChannelForm {
  category: LotteOnCategoryMapping;
  notice: LotteOnNoticeForm;
  certification: LotteOnCertificationForm;
  delivery: LotteOnDeliveryForm;
  codes: LotteOnProductCodeForm;
}

export const EMPTY_LOTTEON_CHANNEL_FORM: LotteOnChannelForm = {
  category: { standardCategoryNo: "", displayCategoryNos: [] },
  notice: { itemCode: "", articlesText: "" },
  certification: { safetyText: "", importProxyCode: "" },
  delivery: {
    outboundPlaceNo: "",
    returnPlaceNo: "",
    deliveryCostPolicyNo: "",
    deliveryRegionGroupCode: "",
    courierCode: "",
    returnCourierCode: "",
    // 문서 기본 관행(평일 14:00 마감). 분은 00/30만 허용된다.
    weekdayCloseTime: "1400",
  },
  codes: { originCode: "", taxTypeCode: "01", brandNo: "", externalProductNo: "" },
};

/** "코드:값" 줄 단위 입력 → 고시 항목 배열. 코드체계를 우리가 만들지 않으므로
 * 셀러가 롯데ON 문서/판매자센터에서 본 코드를 그대로 적는다. */
export function parseNoticeArticles(raw: string): { pdArtlCd: string; pdArtlCnts: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator < 0) return null;
      return { pdArtlCd: line.slice(0, separator).trim(), pdArtlCnts: line.slice(separator + 1).trim() };
    })
    .filter((item): item is { pdArtlCd: string; pdArtlCnts: string } => Boolean(item?.pdArtlCd && item.pdArtlCnts));
}

/** "유형코드:인증번호[:기관명]" 줄 단위 입력. 인증번호는 절대 자동 생성하지 않는다. */
export function parseSafetyCertifications(
  raw: string,
): { sftyAthnTypCd: string; sftyAthnNo: string; sftyAthnOrgnNm?: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [typeCode, number, orgName] = line.split(":").map((part) => part.trim());
      if (!typeCode || !number) return null;
      return { sftyAthnTypCd: typeCode, sftyAthnNo: number, ...(orgName ? { sftyAthnOrgnNm: orgName } : {}) };
    })
    .filter((item): item is { sftyAthnTypCd: string; sftyAthnNo: string; sftyAthnOrgnNm?: string } => Boolean(item));
}

/** 쉼표/공백으로 구분된 전시카테고리 입력 → 번호 배열(중복 제거). */
export function parseDisplayCategoryNos(raw: string): string[] {
  const seen = new Set<string>();
  for (const value of raw.split(/[,\s]+/)) {
    const trimmed = value.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/**
 * 유아동(품목코드 23)은 안전인증 없이 통과하지 못한다.
 *
 * 이 판정을 화면에 두는 이유는 **서버가 막기 전에 먼저 말하기 위해서**다.
 * 실제 차단은 여전히 서버(packages/listing/src/lotteon/validate-payload.ts)가
 * 하고, 여기서는 같은 규칙을 미리 보여주기만 한다 — 두 판정이 갈라지면 화면은
 * 통과인데 등록은 실패하는 그 상태가 된다. 규칙이 바뀌면 두 곳을 함께 고쳐라.
 */
export function requiresSafetyCertification(form: LotteOnChannelForm): boolean {
  return form.notice.itemCode.trim() === LOTTEON_CHILD_PRODUCT_ITEM_CODE;
}

/**
 * 화면 폼 → 서버(`/api/lotteon/payload-preview` · `/api/lotteon/register`)가
 * 받는 평평한 채널 입력.
 *
 * 서버 계약(LotteOnChannelFormInput)은 **한 줄도 바꾸지 않았다** — 화면이
 * 네 축으로 묶였을 뿐이다. 라우트를 건드리지 않았으므로 Preview와 Register가
 * 여전히 같은 buildLotteOnContext() 하나를 통과한다.
 */
export function toLotteOnChannelPayload(form: LotteOnChannelForm) {
  return {
    standardCategoryNo: form.category.standardCategoryNo.trim(),
    displayCategoryNos: form.category.displayCategoryNos.map((no) => no.trim()).filter(Boolean),

    noticeItemCode: form.notice.itemCode.trim(),
    noticeArticles: parseNoticeArticles(form.notice.articlesText),

    safetyCertifications: parseSafetyCertifications(form.certification.safetyText),
    importProxyCode: form.certification.importProxyCode.trim(),

    outboundPlaceNo: form.delivery.outboundPlaceNo.trim(),
    returnPlaceNo: form.delivery.returnPlaceNo.trim(),
    deliveryCostPolicyNo: form.delivery.deliveryCostPolicyNo.trim(),
    deliveryRegionGroupCode: form.delivery.deliveryRegionGroupCode.trim(),
    courierCode: form.delivery.courierCode.trim(),
    returnCourierCode: form.delivery.returnCourierCode.trim(),
    weekdayCloseTime: form.delivery.weekdayCloseTime.trim(),

    originCode: form.codes.originCode.trim(),
    taxTypeCode: form.codes.taxTypeCode.trim(),
    brandNo: form.codes.brandNo.trim(),
    externalProductNo: form.codes.externalProductNo.trim(),
  };
}

/* ── 공통 상품정보 — 읽기 전용 ─────────────────────────────────────────── */

export interface CommonProductRow {
  label: string;
  /** 이미 채워져 있는 값(사람이 읽는 형태). 비어 있으면 null. */
  value: string | null;
  /** 이 값이 어디서 왔는지 — "롯데ON 탭이 만든 값이 아니다"를 화면에 적기 위한 것. */
  origin: string;
  /** 등록에 반드시 필요한데 비어 있으면 true — 고치러 갈 곳은 공통 상품정보다. */
  missing: boolean;
}

export interface CommonProductSummary {
  rows: CommonProductRow[];
  /** 하나라도 비어 있으면 true. 롯데ON 탭에서 고칠 수 없다는 안내를 띄운다. */
  hasMissing: boolean;
}

function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * 롯데ON 등록에 **그대로 쓰이는** 공통 상품정보를 읽기 전용으로 요약한다.
 *
 * 🔴 여기서 값을 만들지 않는다. 상품명/이미지/옵션은 실제 payload를 만드는
 * build-payload.ts의 함수를 그대로 부르고, 가격은 화면이 이미 계산해 둔
 * resolveListingPrice() 결과(priceKrw)를 받기만 한다. 그래서 이 표가 payload와
 * 다른 말을 할 수 있는 경로가 없다.
 */
export function summarizeCommonProduct(
  product: CanonicalProduct,
  price: { priceKrw: number | null; resolved: boolean },
): CommonProductSummary {
  const name = resolveLotteOnProductName(product);
  const { representative, gallery } = resolveLotteOnImageUrls(product);
  const usesOptions = hasLotteOnSellableOptions(product) && product.variants.length > 0;
  const detailImageCount = product.images.filter(
    (image) => image.useInDescription && image.classification === "PRODUCT",
  ).length;
  const description = (product.descriptionKo.value || product.description.value).trim();
  const stock = product.stockQuantity.value ?? 0;

  const rows: CommonProductRow[] = [
    {
      label: "상품명",
      value: name || null,
      origin: "상품정보 · AI 한국어 제목(없으면 원문 제목)",
      missing: !name,
    },
    {
      label: "대표이미지",
      value: representative ? `대표 1장 + 추가 ${Math.max(gallery.length - 1, 0)}장 (최대 10장)` : null,
      origin: "상품정보 · 이미지에서 갤러리로 선택한 것",
      missing: !representative,
    },
    {
      label: "상세페이지",
      value: description
        ? `본문 ${description.length}자 · 상세 이미지 ${detailImageCount}장 (판매자 공통 안내 포함)`
        : null,
      // 쿠팡/스마트스토어가 이미 함께 쓰는 조립 경로 그대로다 — 같은 판매자의
      // 같은 배송/반품 안내를 채널마다 다시 입력하게 하지 않는다.
      origin: "상품정보 · AI 상세설명 + 설정의 판매자 공통 상세블록",
      missing: !description,
    },
    {
      label: "판매가격",
      value: price.resolved && price.priceKrw != null ? formatKrw(price.priceKrw) : null,
      origin: "상품정보 · 가격 계산(resolveListingPrice) 결과 그대로",
      missing: !price.resolved || price.priceKrw == null || price.priceKrw <= 0,
    },
    {
      label: "옵션",
      value: usesOptions
        ? `${product.optionGroups.length}개 옵션 · 단품 ${product.variants.length}건`
        : "옵션 없음 — 단품 1건으로 등록",
      origin: "상품정보 · 크롤러가 실제로 확인한 옵션(조합을 만들어내지 않는다)",
      // 옵션이 없는 것은 결함이 아니다(단일 상품으로 등록된다).
      missing: false,
    },
    {
      label: "재고",
      value: usesOptions ? `단품별 재고 사용 (기본 ${stock}개)` : `${stock}개`,
      origin: "상품정보 · 재고 수량",
      missing: stock <= 0 && !usesOptions,
    },
  ];

  return { rows, hasMissing: rows.some((row) => row.missing) };
}

/* ── 공통 카테고리 → 롯데ON 카테고리 매핑의 "출처" 쪽 ────────────────────── */

export interface CommonCategorySource {
  /** 사람이 읽는 분류 경로. */
  path: string[];
  /** 이 분류가 어디서 왔는지. */
  origin: string;
}

/**
 * 롯데ON 표준/전시 카테고리를 고를 때 **참고할 공통 분류**를 모은다.
 *
 * 🔴 이 함수는 아무것도 쓰지 않는다(순수 읽기). 롯데ON 탭이 고른 번호가
 * categoryMappings로 흘러들어갈 경로 자체를 만들지 않기 위해, 반환 타입에
 * CategorySelection이 들어가지 않는다 — 화면에 보여줄 문자열만 나간다.
 *
 * 순서에 의미가 있다: 먼저 **상품 자신의 분류**(원본 사이트 breadcrumb /
 * JSON-LD)를 놓고, 그다음 다른 채널에서 셀러가 이미 확정한 카테고리를 놓는다.
 * 다른 채널 값이 앞에 오면 "쿠팡 카테고리가 곧 공통 카테고리"라는 잘못된
 * 인상을 주고, 그게 세 번째 시스템이 생기는 첫걸음이다.
 */
export function resolveCommonCategorySources(
  product: CanonicalProduct,
  categoryMappings: Partial<Record<PlatformId, CategorySelection>>,
  options: { order: PlatformId[]; labelOf: (id: PlatformId) => string },
): CommonCategorySource[] {
  const sources: CommonCategorySource[] = [];

  const breadcrumb = (product.breadcrumbPath ?? []).map((part) => part.trim()).filter(Boolean);
  if (breadcrumb.length > 0) {
    sources.push({ path: breadcrumb, origin: "원본 상품 페이지 분류" });
  }

  const jsonLd = product.jsonLdCategory?.trim();
  if (jsonLd) {
    sources.push({ path: [jsonLd], origin: "원본 상품 구조화 데이터" });
  }

  for (const platformId of options.order) {
    const selection = categoryMappings[platformId];
    // 확정(SELECTED/CONFIRMED)된 것만 쓴다 — 추천이 떠 있을 뿐인 값을 "셀러가
    // 정한 분류"로 보여주면, 셀러가 고른 적 없는 카테고리를 근거로 롯데ON
    // 카테고리를 고르게 된다(이 저장소가 이미 여러 번 겪은 실수다).
    if (!selection?.candidate) continue;
    if (selection.state !== "SELECTED" && selection.state !== "CONFIRMED") continue;
    const path = selection.candidate.path.filter(Boolean);
    if (path.length === 0) continue;
    sources.push({ path, origin: `${options.labelOf(platformId)}에서 확정한 카테고리(참고용)` });
  }

  return sources;
}

/* ── 카테고리 조회 결과 표시(최선 노력) ──────────────────────────────────── */

export interface LotteOnCategoryOption {
  code: string;
  name: string;
}

/**
 * onpick 205/206 응답 한 건에서 "번호 + 이름"을 뽑아 본다.
 *
 * 🔴 이 함수는 **추측이고, 추측이라는 사실을 숨기지 않는다.** 롯데ON onpick
 * 응답의 정확한 필드명을 실동작으로 확인하지 못했다(인증키가 있는 환경에서
 * 한 번도 호출해 보지 못했다 — 문서 원문만 봤다). 그래서:
 *
 *  - 알아보면 그 값을 보여주고,
 *  - 못 알아보면 **null을 돌려준다.** 화면은 그때 응답 원문을 그대로 보여준다.
 *
 * 지어낸 필드명으로 빈 목록을 그려서 "카테고리가 없다"고 말하게 하지 않는다 —
 * 그것이 이 저장소가 반복해서 틀린 방식이다. 실동작을 확인하면 이 함수를
 * 지우고 실제 필드명을 쓰면 된다.
 */
export function describeLotteOnCategoryItem(item: unknown): LotteOnCategoryOption | null {
  if (item == null || typeof item !== "object") return null;
  const entries = Object.entries(item as Record<string, unknown>).filter(
    ([, value]) => typeof value === "string" || typeof value === "number",
  );
  const find = (pattern: RegExp) => entries.find(([key]) => pattern.test(key));
  // 롯데ON 명명 규칙: 번호는 …No / …Cd, 이름은 …Nm.
  const codeEntry = find(/(^|_)(scat|dcat|cat)?_?no$/i) ?? find(/no$/i) ?? find(/cd$/i);
  const nameEntry = find(/nm$/i) ?? find(/name$/i);
  if (!codeEntry || !nameEntry) return null;
  const code = String(codeEntry[1]).trim();
  const name = String(nameEntry[1]).trim();
  if (!code || !name) return null;
  return { code, name };
}
