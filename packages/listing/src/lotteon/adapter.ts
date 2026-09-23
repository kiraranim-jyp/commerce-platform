import type { CanonicalProduct } from "@commerce/shared";
import { soonMarketplace } from "@commerce/marketplace";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  hasLotteOnSellableOptions,
  resolveLotteOnImageUrls,
  type LotteOnChannelConfig,
  type LotteOnPayloadInput,
  type LotteOnProductInput,
} from "./build-payload";
import { validateLotteOnPayload } from "./validate-payload";
import type { LotteOnProductRegistrationPayload } from "./types";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — 롯데ON 어댑터.
 *
 * CPO 확정대로 `NextGenMarketplaceAdapter`(packages/marketplace/src/soon/types.ts)
 * 계약을 쓴다. **`PlatformId`(smartstore/coupang/elevenst)는 건드리지 않는다** —
 * 그 유니언을 넓히면 소진 검사에 걸리는 12곳과 Naver/Coupang의 동작 중인 등록
 * 경로를 전부 흔들게 된다(registry.ts 주석의 기존 결정 그대로).
 *
 * 구현체가 marketplace가 아니라 listing 패키지에 있는 이유: 이 어댑터는 실제
 * payload 빌더/검증기(같은 폴더)를 쓰는데, listing → marketplace 단방향 의존이라
 * 반대로는 import할 수 없다. 계약은 marketplace에, 구현은 listing에 둔다.
 *
 * 🔴 `register()`는 여기서 하지 않는다. 인증키는 서버에만 있어야 하므로 실제
 * 등록은 `/api/lotteon/register` 라우트가 수행한다(Coupang/Naver executor가
 * 라우트를 fetch하는 것과 같은 경계). 이 함수가 NOT_IMPLEMENTED를 돌려주는 것은
 * "미구현"이 아니라 "이 층에서는 절대 호출하지 않는다"는 뜻이다.
 */
const LOTTEON_API_SPEC_CONFIRMED = true;

export const LOTTEON_ADAPTER_ID = "lotteon";

/** 어댑터의 순수 판정용 입력 — 채널 설정이 아직 없을 때 "무엇이 비어 있는지"를
 * 보여주기 위한 최소 구성. 실제 등록은 서버가 완전한 LotteOnPayloadInput을 만든다. */
export function buildLotteOnPreviewInput(
  /* NEXT-04d Phase B-1 — 여기도 Master + 판매 조건까지만 본다. 아래
     `resolveOptions`/`buildPayload` 는 NextGenMarketplaceAdapter «공통 계약» 의
     시그니처라 그대로 둔다 — 계약을 좁히는 것은 어댑터 계열 통합 작업이고
     이번 범위가 아니다(CPO 확정). */
  product: LotteOnProductInput,
  channel: Partial<LotteOnChannelConfig> = {},
  detailHtml = "",
): LotteOnPayloadInput {
  const period = buildLotteOnSalePeriod(new Date());
  return {
    product,
    detailHtml: detailHtml || product.descriptionKo.value || product.description.value,
    channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG, ...period, ...channel },
  };
}

export const lotteOnAdapter: soonMarketplace.NextGenMarketplaceAdapter<LotteOnProductRegistrationPayload> = {
  id: LOTTEON_ADAPTER_ID,
  label: "롯데ON",
  status: "LIVE",

  resolveConnectionStatus(hasCredentials: boolean): soonMarketplace.SoonConnectionStatus {
    return soonMarketplace.resolveSoonConnectionStatus(hasCredentials, LOTTEON_API_SPEC_CONFIRMED);
  },

  /** 롯데ON 카테고리는 **다른 호스트**(onpick-api)에서 오고 표준/전시 2중
   * 구조다. 이 저장소의 카테고리 추천기는 쿠팡/네이버 코드체계만 알기 때문에
   * 상품 데이터만으로는 결정할 수 없다 — 추측하지 않고 UNRESOLVED로 남긴다. */
  resolveCategory(): soonMarketplace.CategoryResolution {
    return {
      status: "UNRESOLVED",
      categoryId: null,
      categoryName: null,
      reason:
        "롯데ON 표준카테고리(scatNo)와 전시카테고리(dcatLst)는 onpick-api 조회로 선택해야 합니다 — 쿠팡/네이버 카테고리 코드를 그대로 쓸 수 없습니다.",
    };
  },

  resolveOptions(product: CanonicalProduct): soonMarketplace.OptionResolution {
    if (!hasLotteOnSellableOptions(product)) {
      return { status: "NOT_AVAILABLE", options: [], reason: "옵션이 없는 단일 상품입니다(단품 1건으로 등록됩니다)." };
    }
    if (product.variants.length === 0) {
      return {
        status: "UNRESOLVED",
        options: product.optionGroups.map((group) => ({ name: group.name, values: group.values })),
        reason: "옵션 축은 확인됐지만 실제 조합(variant)이 없습니다 — 조합을 임의로 생성하지 않습니다.",
      };
    }
    return {
      status: "MATCHED",
      options: product.optionGroups.map((group) => ({ name: group.name, values: group.values })),
    };
  },

  /** 표준카테고리 속성(scatAttrLst)은 속성모듈(203)이 주는 optCd/optValCd 쌍이
   * 있어야 채울 수 있다. 상품 텍스트에서 코드를 만들어낼 수 없다. */
  resolveAttributes(): soonMarketplace.AttributeResolution {
    return {
      status: "UNRESOLVED",
      attributes: [],
      reason: "롯데ON 표준카테고리 속성은 속성모듈 API(203)가 주는 옵션코드/옵션값코드로만 채울 수 있습니다.",
    };
  },

  /** 출고지/반품지/배송비정책은 전부 롯데ON에 **선등록된 번호**다. */
  resolveDelivery(): soonMarketplace.DeliveryResolution {
    return {
      status: "UNRESOLVED",
      reason: "출고지번호 · 회수지번호 · 배송비정책번호는 롯데ON 판매자센터(또는 거래처 API)에 먼저 등록돼 있어야 합니다.",
    };
  },

  /**
   * 채널 설정 없이 상품만으로 payload를 만들어 본다 — 그 결과의 issues가 곧
   * "등록하려면 무엇을 더 채워야 하는가"다(Phase 3의 필수값 검증 화면이 읽는 값).
   * 실제 등록 payload는 서버가 완전한 채널 설정으로 다시 만든다.
   */
  buildPayload(product: CanonicalProduct): soonMarketplace.PayloadBuildResult<LotteOnProductRegistrationPayload> {
    const input = buildLotteOnPreviewInput(product);
    const validation = validateLotteOnPayload(input);
    const issues = validation.fields
      .filter((field) => field.status !== "READY")
      .map((field) => ({
        field: field.field,
        severity: field.status === "BLOCKED" ? ("BLOCKED" as const) : ("MISSING" as const),
        reason: field.reason ?? "",
      }));
    // 대표 이미지조차 없으면 payload 자체가 의미 없다 — 그때만 null.
    const { representative } = resolveLotteOnImageUrls(product);
    if (!representative) return { payload: null, issues };
    return { payload: buildLotteOnPayload(input), issues };
  },

  validate(payload: LotteOnProductRegistrationPayload): soonMarketplace.ValidationResult {
    // payload 단독 검증 — 서버가 만든 최종 바디에 빈 필수값이 남아 있지 않은지
    // 마지막으로 본다(입력 단계 검증은 validateLotteOnPayload가 한다).
    const issues: soonMarketplace.PayloadIssue[] = [];
    const registration = payload.spdLst[0];
    if (!registration) {
      return { ok: false, issues: [{ field: "spdLst", severity: "BLOCKED", reason: "등록 상품이 없습니다." }] };
    }
    const requiredStrings: [keyof typeof registration, string][] = [
      ["trGrpCd", "거래처그룹코드"],
      ["trNo", "거래처번호"],
      ["scatNo", "표준카테고리번호"],
      ["spdNm", "판매자상품명"],
      ["oplcCd", "원산지코드"],
      ["slStrtDttm", "판매시작일시"],
      ["slEndDttm", "판매종료일시"],
      ["dvRgsprGrpCd", "배송가능지역코드"],
      ["owhpNo", "출고지번호"],
      ["dvCstPolNo", "배송비정책번호"],
      ["rtrpNo", "회수지번호"],
    ];
    for (const [key, label] of requiredStrings) {
      if (!String(registration[key] ?? "").trim()) {
        issues.push({ field: String(key), severity: "BLOCKED", reason: `${label}가 비어 있습니다.` });
      }
    }
    if (registration.dcatLst.length === 0) {
      issues.push({ field: "dcatLst", severity: "BLOCKED", reason: "전시카테고리가 비어 있습니다." });
    }
    if (!registration.pdItmsInfo.pdItmsCd) {
      issues.push({ field: "pdItmsCd", severity: "BLOCKED", reason: "상품품목코드(고시)가 비어 있습니다." });
    }
    if (registration.itmLst.length === 0) {
      issues.push({ field: "itmLst", severity: "BLOCKED", reason: "단품이 하나도 없습니다." });
    }
    // 🔴 P0-D.3 — slPrc 가 null 일 수 있다(가격 미확정). 「0 이하」와 「모른다」를
    //    한 문장으로 말하지 않는다 — 앞은 잘못된 값이고 뒤는 아직 없는 값이다.
    if (registration.itmLst.some((item) => item.slPrc == null)) {
      issues.push({ field: "slPrc", severity: "BLOCKED", reason: "판매가격을 아직 확정하지 못한 단품이 있습니다." });
    }
    if (registration.itmLst.some((item) => item.slPrc != null && !(item.slPrc > 0))) {
      issues.push({ field: "slPrc", severity: "BLOCKED", reason: "판매가가 0 이하인 단품이 있습니다." });
    }
    return { ok: issues.length === 0, issues };
  },

  async register(): Promise<soonMarketplace.RegistrationResult> {
    return {
      status: "NOT_IMPLEMENTED",
      message:
        "롯데ON 등록은 서버 라우트(/api/lotteon/register)에서만 실행됩니다 — 인증키가 클라이언트로 나가지 않도록 어댑터는 payload 생성/검증까지만 담당합니다.",
    };
  },
};
