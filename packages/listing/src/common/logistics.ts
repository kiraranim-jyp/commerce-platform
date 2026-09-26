/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2A — **배송/물류 Common 과 Commerce binding**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 이 파일이 생긴 이유 ────────────────────────────────────────────────────
 * C-2 는 「셀러 배송 기본값(전국 배송 · 우체국택배)을 저장하자」였다. 저장소를
 * 찾다가 그 앞에 게이트가 셋 있었고(docs/commerce-6-c1c-c2.md), CPO 가 방향을
 * 바꿨다: **롯데ON 때문에 화면을 하나 더 만들지 말고 Common 을 먼저 세운다.**
 *
 * ── 🔴 조사해 보니 Common 은 «코드를 저장하는 자리» 가 아니었다 ────────────
 * 세 채널의 실제 경로를 payload 까지 따라가 보면 이미 답이 나와 있다.
 *
 *     스마트스토어 출고지/반품지   /v1/seller/addressbooks-for-page 를 조회해서
 *                                 addressType 이 RELEASE / REFUND_OR_EXCHANGE 인
 *                                 것을 «역할로» 고른다. 우리는 번호를 저장하지 않는다.
 *     스마트스토어 반품택배사      /v2/product-delivery-info/return-delivery-companies
 *                                 를 조회해서 PRIMARY 를 고른다. 역시 저장하지 않는다.
 *     쿠팡 출고지                  출고지 목록을 조회해서 «상품 원산지 국가» 와
 *                                 맞는 곳을 고른다(selectOutboundShippingPlace).
 *
 * 즉 **채널이 목록을 주는 값은 아무도 저장하지 않는다 — 런타임에 의미로 고른다.**
 * 반대로 우리 DB 에 채널 코드가 저장돼 있는 세 칸(`delivery_company_code` ·
 * `naver_delivery_company_code` · `return_center_code`)은 전부 **목록 API 가
 * 없어서** 어쩔 수 없이 셀러가 적어 둔 것이다. 규칙이 아니라 예외다.
 *
 * 그래서 Common 의 정의는 이렇게 된다:
 *
 *     Common 은 «의미» 를 갖는다(역할 · 이름 · 금액 · 일수).
 *     채널 코드는 각 채널의 목록에서 «런타임에» 해석한다.
 *     목록이 없는 채널에서만 코드를 저장한다.
 *
 * 🔴 그러므로 `DV_CO_CD` · `DV_RGSPR_GRP_CD` 같은 채널 발급 ID 는 Common 값이
 *    될 수 없다(CPO B 항 명시). 이 파일 어디에도 그 코드의 «값» 은 없다.
 *
 * ── 이 표가 «판단» 이 아니라 «실측» 인 근거 ────────────────────────────────
 * 아래 모든 칸은 파일명이나 타입이 아니라 **최종 payload 까지 값이 흐르는가** 로
 * 확인했다. 그 과정에서 기존 설명 세 개가 사실이 아니었다(각 칸 note 에 적었다).
 */

/** 이 저장소가 등록하는 세 곳. 새 채널을 여기 «먼저» 적지 않는다. */
export type CommerceChannel = "SMARTSTORE" | "COUPANG" | "LOTTEON";

/**
 * Common 이 들고 있는 것이 «무엇» 인가. 이것이 승격 가능 여부를 가른다.
 *
 *  ROLE         「출고용 주소」처럼 역할만 같고 실체는 채널이 발급한다.
 *               → Common 에 저장할 것이 없다. 역할 이름만 공통이다.
 *  NAMED_VALUE  「우체국택배」처럼 사람이 읽는 이름이 곧 의미다.
 *               → Common 에 «이름» 을 저장할 수 있다. 코드는 채널이 준다.
 *  AMOUNT       금액. 코드체계가 없다 → 그대로 공통이다.
 *  DAYS         일수. 같은 이유로 그대로 공통이다.
 *  POLICY       「도서산간을 어떻게 취급하는가」 — 채널마다 «묻는 것» 이 다르다.
 */
export type CommonLogisticsMeaningKind = "ROLE" | "NAMED_VALUE" | "AMOUNT" | "DAYS" | "POLICY";

/**
 * 채널 코드를 «어떻게» 얻는가. 이 표의 핵심이 이 한 축이다.
 *
 *  CHANNEL_LIST    채널이 목록 API 를 준다 → 런타임 해석. 🔴 저장할 코드가 없다.
 *  SELLER_TYPED    목록 API 가 없다 → 셀러가 적어 두고 우리가 저장한다(예외).
 *  CONSTANT        우리 코드가 상수로 박아 보낸다 — 🔴 셀러가 정한 적이 없다.
 *  NOT_APPLICABLE  그 채널 payload 에 그 개념 자체가 없다.
 *  UNKNOWN         실제 응답·스펙을 확인하지 못했다. 🔴 추정하지 않는다.
 */
export type ChannelBindingStrategy =
  | "CHANNEL_LIST"
  | "SELLER_TYPED"
  | "CONSTANT"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export interface ChannelBinding {
  strategy: ChannelBindingStrategy;
  /** 최종 payload 필드명. 지어낸 이름이 아니라 실제로 나가는 키다. */
  payloadField: string | null;
  /** 목록을 주는 곳(CHANNEL_LIST 일 때만). 경로/문서번호 원문. */
  listSource?: string;
  /** 어디를 보고 이렇게 적었는가 — 되짚을 수 있게 남긴다. */
  evidence: string;
}

export interface CommonLogisticsConcept {
  key: string;
  /** 셀러가 화면에서 보는 이름. 🔴 코드가 아니라 이 이름만 보여준다(F-7). */
  label: string;
  meaning: CommonLogisticsMeaningKind;
  /**
   * Common 으로 승격하는가. 🔴 「필드를 합친다」가 아니라 «사업적 의미» 기준이다.
   *  PROMOTE      Common 이 값을 갖는다(이름·금액·일수).
   *  ROLE_ONLY    역할만 공통이고 값은 채널이 발급한다 — 저장하지 않는다.
   *  CHANNEL_ONLY 한 채널에만 있는 개념이다.
   */
  promotion: "PROMOTE" | "ROLE_ONLY" | "CHANNEL_ONLY";
  bindings: Record<CommerceChannel, ChannelBinding>;
  /** 이 개념에 대해 이번 조사에서 «새로 밝혀진» 사실. */
  finding?: string;
}

/**
 * 배송/물류 Common 전수. 🔴 여덟 개가 전부다 — 더 있으면 조사가 덜 된 것이다.
 */
export const COMMON_LOGISTICS_CONCEPTS: CommonLogisticsConcept[] = [
  {
    key: "OUTBOUND_PLACE",
    label: "출고지",
    meaning: "ROLE",
    promotion: "ROLE_ONLY",
    bindings: {
      SMARTSTORE: {
        strategy: "CHANNEL_LIST",
        payloadField: "releaseAddressBookNo",
        listSource: "GET /v1/seller/addressbooks-for-page",
        evidence: 'addressType === "RELEASE" 로 고른다(resolve-context.ts).',
      },
      COUPANG: {
        strategy: "CHANNEL_LIST",
        payloadField: "outboundShippingPlaceCode",
        listSource: "출고지 목록 조회(fetchShippingPlaces)",
        evidence:
          "selectOutboundShippingPlace(상품 원산지 국가, 목록) 이 고른다 — 프로필의 outbound_shipping_place_code 는 목록이 비었을 때의 폴백이다.",
      },
      LOTTEON: {
        strategy: "CHANNEL_LIST",
        payloadField: "owhpNo",
        listSource: "150 getDvpListSr (dvpTypCd=02)",
        evidence: "delivery-settings 라우트가 목록을 주고 셀러가 롯데ON 탭에서 고른다.",
      },
    },
    finding:
      "🔴 세 채널 모두 «채널이 준 목록에서» 고른다. 그러므로 출고지는 Common 에 저장할 값이 없다 — 공통인 것은 「출고용」이라는 역할뿐이다.",
  },
  {
    key: "RETURN_PLACE",
    label: "반품지",
    meaning: "ROLE",
    promotion: "ROLE_ONLY",
    bindings: {
      SMARTSTORE: {
        strategy: "CHANNEL_LIST",
        payloadField: "refundAddressBookNo",
        listSource: "GET /v1/seller/addressbooks-for-page",
        evidence: 'addressType === "REFUND_OR_EXCHANGE" 로 고른다(같은 주소록 한 번 조회).',
      },
      COUPANG: {
        strategy: "SELLER_TYPED",
        payloadField: "returnCenterCode",
        evidence:
          "프로필의 return_center_code 가 그대로 나간다. 🔴 출고지와 달리 목록을 조회하는 경로가 코드에 없다 — 같은 채널 안에서도 두 개념의 처리가 다르다.",
      },
      LOTTEON: {
        strategy: "CHANNEL_LIST",
        payloadField: "rtrpNo",
        listSource: "150 getDvpListSr (dvpTypCd=01)",
        evidence: "출고지와 같은 150 응답을 유형으로 나눠 쓴다.",
      },
    },
  },
  {
    key: "CARRIER",
    label: "택배사",
    meaning: "NAMED_VALUE",
    promotion: "PROMOTE",
    bindings: {
      SMARTSTORE: {
        strategy: "SELLER_TYPED",
        payloadField: "deliveryCompany",
        evidence:
          "출고 택배사 조회 API 가 없다(N-2.5/N-3.3/N-3.6 확인). 셀러가 적은 naver_delivery_company_code 가 build-payload.ts:622 로 나간다.",
      },
      COUPANG: {
        strategy: "SELLER_TYPED",
        payloadField: "deliveryCompanyCode",
        evidence: "같은 이유로 프로필의 delivery_company_code 가 build-payload.ts:1592 로 나간다.",
      },
      LOTTEON: {
        strategy: "CHANNEL_LIST",
        payloadField: "hdcCd",
        listSource: "89 getDetailCodeList (grpCd=DV_CO_CD)",
        evidence: "delivery-settings 라우트가 89 를 불러 목록을 준다.",
      },
    },
    finding:
      "🔴 여기가 Common 승격의 본체다. 지금은 같은 「우체국택배」를 두 칸(쿠팡 코드 · 네이버 문자열)에 «따로» 적게 하고, 롯데ON 에서는 매 상품 다시 고르게 한다. Common 이 이름 하나를 갖고 채널이 각자 해석하면 셀러의 입력은 한 번이 된다.",
  },
  {
    key: "RETURN_CARRIER",
    label: "반품 택배사",
    meaning: "NAMED_VALUE",
    promotion: "PROMOTE",
    bindings: {
      SMARTSTORE: {
        strategy: "CHANNEL_LIST",
        payloadField: "returnDeliveryCompanyPriorityType",
        listSource: "GET /v2/product-delivery-info/return-delivery-companies",
        evidence:
          "resolvePrimaryReturnCompany(목록) 가 PRIMARY 를 고른다. 🔴 나가는 값은 택배사 코드가 아니라 «우선순위»(PRIMARY 등) 다 — 실체는 셀러가 네이버에 등록해 둔 반품 택배사다.",
      },
      COUPANG: {
        strategy: "NOT_APPLICABLE",
        payloadField: null,
        evidence: "쿠팡 payload 에 반품 택배사 필드가 없다(build-payload 전수 확인, 0건).",
      },
      LOTTEON: {
        strategy: "CHANNEL_LIST",
        payloadField: "rtngHdcCd",
        listSource: "89 getDetailCodeList (grpCd=DV_CO_CD)",
        evidence: "택배사와 같은 89 목록을 쓴다.",
      },
    },
    finding:
      "🔴 기존 설명이 틀렸다 — 「쿠팡·스마트스토어는 반품 택배사를 구분하지 않습니다」로 적혀 있었으나 스마트스토어는 «목록 API 까지 있고» 이미 고르고 있다. 구분하지 않는 것은 쿠팡뿐이다.",
  },
  {
    key: "DELIVERY_FEE",
    label: "배송비",
    meaning: "AMOUNT",
    promotion: "PROMOTE",
    bindings: {
      SMARTSTORE: {
        strategy: "SELLER_TYPED",
        payloadField: "deliveryInfo.deliveryFee",
        evidence: "프로필 delivery_charge 가 resolve-context 를 거쳐 금액으로 나간다.",
      },
      COUPANG: {
        strategy: "SELLER_TYPED",
        payloadField: "deliveryCharge",
        evidence: "같은 프로필 금액을 쓴다.",
      },
      LOTTEON: {
        strategy: "CHANNEL_LIST",
        payloadField: "dvCstPolNo",
        listSource: "166 getDvCstListSr",
        evidence:
          "🔴 롯데ON 만 금액이 아니라 판매자센터에 등록된 «정책 번호» 를 받는다. 금액에서 번호를 만들 수 없다 — 같은 개념이 아니다.",
      },
    },
    finding:
      "금액은 Common 이 맞지만 롯데ON binding 은 금액이 아니다. 🔴 Common 승격이 곧 「한 값으로 세 채널을 채운다」가 아니라는 반례다.",
  },
  {
    key: "OUTBOUND_LEAD_DAYS",
    label: "출고 소요일",
    meaning: "DAYS",
    promotion: "PROMOTE",
    bindings: {
      SMARTSTORE: {
        strategy: "NOT_APPLICABLE",
        payloadField: null,
        evidence:
          "🔴 네이버 payload 에 출고 소요일 필드가 없다(build-payload 배송 필드 전수 확인). 설정 화면이 「두 플랫폼에 동일하게 적용」이라고 말하는 것은 배송비에는 맞고 출고 소요일에는 맞지 않는다.",
      },
      COUPANG: {
        strategy: "SELLER_TYPED",
        payloadField: "outboundShippingTimeDay",
        evidence: "프로필 outbound_lead_time_days ?? 7 (build-payload.ts:1403).",
      },
      LOTTEON: {
        strategy: "SELLER_TYPED",
        payloadField: "sndBgtNday",
        evidence: "같은 프로필 값을 쓰되 일반상품 상한 3일로 자른다(resolveLotteOnShipBudgetDays).",
      },
    },
    finding: "코드체계가 없는 순수 일수라 세 칸이 아니라 한 칸이면 된다 — 이미 그렇게 돼 있다.",
  },
  {
    key: "REMOTE_AREA",
    label: "도서산간 · 배송 가능 지역",
    meaning: "POLICY",
    promotion: "CHANNEL_ONLY",
    bindings: {
      SMARTSTORE: {
        strategy: "NOT_APPLICABLE",
        payloadField: null,
        evidence:
          "타입(deliveryAreaType AREA_2/AREA_3)은 선언돼 있으나 build-payload 가 채우지 않는다(0건). 🔴 게다가 네이버가 묻는 것은 «추가 배송비» 이지 가능 여부가 아니다.",
      },
      COUPANG: {
        strategy: "CONSTANT",
        payloadField: "remoteAreaDeliverable",
        evidence:
          '🔴 build-payload.ts:1597 이 항상 "N" 을 보낸다 — 모든 상품이 「도서산간 배송 불가」로 등록되고 있고 셀러가 정한 적이 없다.',
      },
      LOTTEON: {
        strategy: "CHANNEL_LIST",
        payloadField: "dvRgsprGrpCd",
        listSource: "89 getDetailCodeList (grpCd=DV_RGSPR_GRP_CD)",
        evidence: "셀러가 롯데ON 탭에서 고른다.",
      },
    },
    finding:
      "🔴 기존 설명이 틀렸다 — 「쿠팡·스마트스토어도 이 값을 쓰지 않습니다」로 적혀 있었으나 쿠팡은 쓴다(상수로). 다만 세 채널이 «같은 것을 묻지 않는다»(가능여부 vs 추가비 vs 지역그룹) 므로 Common 한 값으로 합치면 안 된다.",
  },
  {
    key: "DISPATCH_CUTOFF",
    label: "평일 발송마감시간",
    meaning: "POLICY",
    promotion: "CHANNEL_ONLY",
    bindings: {
      SMARTSTORE: { strategy: "NOT_APPLICABLE", payloadField: null, evidence: "payload 에 없다." },
      COUPANG: { strategy: "NOT_APPLICABLE", payloadField: null, evidence: "payload 에 없다." },
      LOTTEON: {
        strategy: "UNKNOWN",
        payloadField: "nldySndCloseTm",
        evidence:
          "🔴 저장소도 목록도 확인되지 않았다. 87 필드명만 안다 — 형식(HHmm 인지)을 실제 응답으로 확인하지 못했으므로 추정하지 않는다.",
      },
    },
  },
];

const BY_KEY = new Map(COMMON_LOGISTICS_CONCEPTS.map((c) => [c.key, c]));

export function findCommonLogisticsConcept(key: string): CommonLogisticsConcept | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Common 이 «값을 갖는» 개념만. 즉 셀러에게 한 번 물어서 여러 채널이 쓰는 것.
 * ROLE_ONLY 는 채널이 발급하므로 여기 없다 — 저장하면 그 순간 틀린 값이 된다.
 */
export function promotableCommonLogistics(): CommonLogisticsConcept[] {
  return COMMON_LOGISTICS_CONCEPTS.filter((c) => c.promotion === "PROMOTE");
}

/**
 * 「셀러가 의미를 골랐는데 채널 코드를 못 찾았다」를 말하는 한 줄.
 *
 * 🔴 여기서 코드를 «추정하지 않는다». 89 응답이 없으면 없다고 말하고, 어디서
 * 해결하는지를 함께 준다 — readiness 가 그대로 읽는다(CPO F 항).
 */
export interface UnresolvedBinding {
  conceptKey: string;
  label: string;
  /** 셀러가 고른 «의미». 코드가 아니다. */
  meaningValue: string;
  channel: CommerceChannel;
  /** 어디서 해결하는가. 채널 목록이 있으면 그 목록에서 고르는 화면이다. */
  resolveHint: string;
}

export function describeUnresolvedBinding(
  conceptKey: string,
  channel: CommerceChannel,
  meaningValue: string,
): UnresolvedBinding | null {
  const concept = findCommonLogisticsConcept(conceptKey);
  if (!concept) return null;
  const binding = concept.bindings[channel];
  /* 그 채널에 개념이 없으면 «부족» 이 아니다 — 없는 것을 요구하지 않는다. */
  if (binding.strategy === "NOT_APPLICABLE" || binding.strategy === "CONSTANT") return null;
  return {
    conceptKey,
    label: concept.label,
    meaningValue,
    channel,
    resolveHint:
      binding.strategy === "CHANNEL_LIST"
        ? `${concept.label} 목록에서 「${meaningValue}」을(를) 골라 주세요.`
        : binding.strategy === "UNKNOWN"
          ? `${concept.label}은(는) 아직 연결 방법이 확인되지 않았습니다.`
          : `${concept.label}을(를) 설정에서 한 번 입력해 주세요.`,
  };
}
