/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — 롯데ON `상품 등록`(apiNo 87) 요청 스키마.
 *
 * POST https://openapi.lotteon.com/v1/openapi/product/v1/product/registration/request
 *
 * 출처: 롯데ON 공개 API 문서 백엔드에서 받은 원문(2026-09-14 수집)
 *   GET https://soapi.lotteon.com/soapi/v1/openapi/o/apiguide/getApiGuideDetailInfo
 *       ?apiNo=87&apiMjrVerCd=V1&apiMnrVerNm=1.0&mdulDvsCd=SL
 * 누구나 재현 가능한 무인증 조회다(조사 문서 §5-0). **추측한 필드는 하나도 없다** —
 * 문서에 없는 필드는 이 타입에 없고, 문서에 있어도 우리가 값을 만들 수 없는
 * 필드는 optional로 두고 validate-payload.ts가 MISSING/BLOCKED로 잡는다.
 *
 * 이 파일은 스키마만 정의한다. "무엇을 채울 것인가"는 build-payload.ts,
 * "채워도 되는가"는 validate-payload.ts가 판단한다.
 *
 * ⚠️ 롯데ON 스키마가 Naver/Coupang과 결정적으로 다른 두 가지:
 *   1) **카테고리가 2중이다** — 표준카테고리(scatNo) + 전시카테고리 목록(dcatLst).
 *      CategorySelection은 leaf 하나만 담으므로 둘 다 채널 전용 입력으로 받는다.
 *   2) **고시/인증/옵션이 별도 API가 아니라 이 payload 안의 필드다**
 *      (pdItmsInfo / sftyAthnLst / itmLst).
 */

/** 전시카테고리 한 건. `mallCd`는 일반 셀러 기준 항상 "LTON"(롯데ON)이다. */
export interface LotteOnDisplayCategory {
  mallCd: string;
  lfDcatNo: string;
}

/** 상품정보제공고시 항목 한 줄. `pdArtlCd`는 품목코드(pdItmsCd)마다 다른
 * 코드체계이고 통합 코드표를 확보하지 못했다 — 그래서 이 값은 **절대
 * 생성하지 않고** 호출부 입력을 그대로 옮긴다. */
export interface LotteOnNoticeArticle {
  pdArtlCd: string;
  pdArtlCnts: string;
}

export interface LotteOnNoticeInfo {
  /** 상품품목코드 [공통코드 PD_ITMS_CD]. 23 = 어린이제품(유아동) — 이 저장소의
   * 주력 카테고리이고, 23인 경우 표준카테고리에 따라 **안전인증목록이 필수**다. */
  pdItmsCd: string;
  pdItmsArtlLst: LotteOnNoticeArticle[];
}

/** 안전인증(KC 등) 한 건. 문서 원문: "'KC인증'에 해당할 경우 수입대행코드
 * (impPrxCd)는 필수 값이다." */
export interface LotteOnSafetyCertification {
  /** 안전인증유형코드 [공통코드 SFTY_ATHN_TYP_CD] — CHL_ATHN/CHL_CFM/CHL_SUPS
   * (어린이제품) · ELC_* (전기용품) · LIFE_* (생활용품) · KC_CHL_PKG · ETC 등. */
  sftyAthnTypCd: string;
  sftyAthnOrgnNm?: string;
  sftyAthnNo: string;
}

/** 표준카테고리 속성(속성모듈 API가 주는 optCd/optValCd 쌍). 값을 지어낼 수
 * 없으므로 호출부가 준 것만 싣는다. */
export interface LotteOnCategoryAttribute {
  optCd: string;
  optNm?: string;
  optValCd?: string;
  optVal: string;
  dtlsVal?: string;
}

export interface LotteOnPurchaseQuantityInfo {
  itmByMinPurYn: "Y" | "N";
  itmByMinPurQty?: number;
  itmByMaxPurPsbQtyYn: "Y" | "N";
  maxPurQty?: number;
  /** 미입력 시 롯데ON이 PERIOD + 1일로 적용한다(문서 원문). 그래도 명시적으로
   * 보낸다 — 서버 기본값에 의존하면 정책이 바뀌었을 때 조용히 따라간다. */
  maxPurLmtTypCd: "ONCE" | "PERIOD" | "FIXED";
  maxPurLmtPrd?: number;
}

export interface LotteOnShipBudgetDayInfo {
  /** 평일 발송마감시간 [HH24MI]. 00분/30분만 등록 가능. */
  nldySndCloseTm: string;
  satSndPsbYn: "Y" | "N";
  satSndCloseTm?: string;
}

/** 상품콘텐츠파일(이미지/동영상). 단품 이미지(itmImgLst)와 다른 자리다. */
export interface LotteOnProductFile {
  fileTypCd: string;
  fileDvsCd: string;
  origFileNm: string;
}

/** 상품설명. `DSCRP`(상품기술서)가 상세페이지 HTML이 들어가는 자리다. */
export interface LotteOnExplanation {
  pdEpnTypCd: "DSCRP" | "AS_CNTS" | "PRCTN";
  cnts: string;
}

export interface LotteOnItemOption {
  optCd?: string;
  optNm: string;
  optValCd?: string;
  optVal: string;
  dtlsVal?: string;
}

export interface LotteOnItemImage {
  epsrTypCd: "IMG";
  epsrTypDtlCd: "IMG_SQRE" | "IMG_LNTH";
  origImgFileNm: string;
  rprtImgYn: "Y" | "N";
}

/** 단품(=옵션 조합 하나). 롯데ON의 최소 판매 단위. 최대 500개(FAQ). */
export interface LotteOnItem {
  eitmNo?: string;
  rprtSitmYn?: "Y" | "N";
  sortSeq: number;
  itmOptLst?: LotteOnItemOption[];
  itmImgLst: LotteOnItemImage[];
  /** 🔴 P0-D.3 — 가격이 확정되지 않았으면 null 이다. 0 으로 바꾸지 않는다
   *  (0 은 「0원에 판다」는 값이고 「모른다」와 다르다). validateLotteOnPayload 가
   *  이 상태를 PRICE_UNRESOLVED 로 막는다. */
  slPrc: number | null;
  stkQty?: number;
}

export interface LotteOnOptionValueSort {
  optValSeq: number;
  optVal: string;
  optValCd?: string;
  dtlsVal?: string;
}

export interface LotteOnOptionSort {
  optSeq: number;
  optNm: string;
  optCd?: string;
  optValSrtLst: LotteOnOptionValueSort[];
}

/**
 * `spdLst[]`의 원소 하나 = 등록 상품 하나.
 *
 * 이 라우트는 **상품 1개만** 받는다(Coupang/Naver register 라우트와 동일 원칙) —
 * 배열 스키마이지만 우리는 항상 길이 1로 보낸다.
 */
export interface LotteOnProductRegistration {
  /** 거래처 정보 — 207 Identity(GET /v1/openapi/common/v1/identity)가 준다. */
  trGrpCd: string;
  trNo: string;
  lrtrNo?: string;

  /** 표준카테고리번호. */
  scatNo: string;
  /** 전시카테고리 목록 — 최소 1건 필수. */
  dcatLst: LotteOnDisplayCategory[];

  /** 업체상품번호(우리 쪽 식별자). 응답의 spdNo(판매자상품번호)와 짝을 이룬다. */
  epdNo?: string;

  slTypCd: "GNRL" | "CNSL";
  pdTypCd: "GNRL_GNRL" | "GNRL_ECPN" | "GNRL_GFTV" | "GNRL_ZRWON" | "CNSL_CNSL";

  spdNm: string;
  brdNo?: string;
  mfcrNm?: string;
  /** 원산지코드 [공통코드 OPLC_CD]. 기타인 경우 "상품상세 참조" 코드. */
  oplcCd: string;
  mdlNo?: string;
  barCd?: string;
  /** 과세유형코드 01 과세 / 02 면세 / 03 영세 / 04 해당없음. */
  tdfDvsCd: string;

  slStrtDttm: string;
  slEndDttm: string;

  pdItmsInfo: LotteOnNoticeInfo;
  /** 수입대행코드 [IMP_PRX_CD] — 안전인증목록의 KC인증 입력 시 필수. */
  impPrxCd?: string;
  sftyAthnLst?: LotteOnSafetyCertification[];
  scatAttrLst?: LotteOnCategoryAttribute[];

  purPsbQtyInfo: LotteOnPurchaseQuantityInfo;
  ageLmtCd: string;
  prstPsbYn?: "Y" | "N";
  prstPckPsbYn: "Y" | "N";
  prstMsgPsbYn: "Y" | "N";
  prcCmprEpsrYn?: "Y" | "N";

  impCoNm?: string;
  /** 수입구분코드 [IMP_DVS_CD] — 수입사명이 있는 경우 입력. */
  impDvsCd?: string;

  pdStatCd: string;
  dpYn?: "Y" | "N";
  scKwdLst?: string[];
  pdFileLst?: LotteOnProductFile[];
  epnLst: LotteOnExplanation[];

  cnclPsbYn?: "Y" | "N";
  /** 국내해외배송구분코드 DMST/OVS. */
  dmstOvsDvDvsCd?: "DMST" | "OVS";
  dvProcTypCd: string;
  dvPdTypCd: string;
  sndBgtNday?: number;
  sndBgtDdInfo: LotteOnShipBudgetDayInfo;
  /** 배송가능지역코드 [공통코드 DV_RGSPR_GRP_CD]. */
  dvRgsprGrpCd: string;
  dvMnsCd: string;
  /** 출고지번호 — 거래처 API(150/151)로 등록된 값. */
  owhpNo: string;
  /** 택배사코드 [공통코드 DV_CO_CD]. */
  hdcCd?: string;
  /** 배송비정책번호 — 거래처 API(166/168)로 등록된 값. */
  dvCstPolNo: string;
  adtnDvCstPolNo?: string;
  cmbnDvPsbYn?: "Y" | "N";
  dvCstStdQty?: number;

  rtngPsbYn?: "Y" | "N";
  xchgPsbYn?: "Y" | "N";
  cmbnRtngPsbYn?: "Y" | "N";
  rtngHdcCd?: string;
  rtngRtrvPsbYn?: "Y" | "N";
  /** 회수지번호 — 거래처 API로 등록된 값. */
  rtrpNo: string;

  stkMgtYn: "Y" | "N";
  /** 판매자단품여부 — Y면 itmOptLst를 설정해야 한다. */
  sitmYn: "Y" | "N";

  optSrtLst?: LotteOnOptionSort[];
  itmLst: LotteOnItem[];
  adtnPdYn: "Y" | "N";
}

/** 실제 HTTP 바디. */
export interface LotteOnProductRegistrationPayload {
  spdLst: LotteOnProductRegistration[];
}

/**
 * 87 응답의 `data[]` 원소.
 *
 * 🔴 중요 — **옵션(단품) 단위 채널 ID가 응답에 없다.** 문서 원문의 Received
 * Message는 `epdNo / spdNo / resultCode / resultMessage` 네 개뿐이다. 쿠팡
 * `vendorItemId`에 해당하는 값을 롯데ON은 등록 응답으로 돌려주지 않는다 —
 * 단품번호(sitmNo)는 이후 `93 상품 목록 조회`의 sitmNoLst로만 얻을 수 있다.
 * 그래서 옵션 단위 ID는 저장하지 않는다(없는 값을 지어내지 않는다).
 */
export interface LotteOnRegistrationResultRow {
  epdNo?: string;
  /** 판매자상품번호 = 이 채널의 상품 ID. registration_attempts.external_product_id에 저장한다. */
  spdNo?: string;
  resultCode?: string;
  resultMessage?: string;
}
