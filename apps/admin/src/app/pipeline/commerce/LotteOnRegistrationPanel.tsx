"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalProduct, LotteOnChannelInfo } from "@commerce/shared";
import { Button } from "@/components/ui/Button";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  LOTTEON_CHILD_PRODUCT_ITEM_CODE,
  LOTTEON_FIX_LOCATION_LABEL,
  applyLotteOnRecommendedCategory,
  buildLotteOnMissingInfo,
  buildLotteOnSafetyLineFromCommon,
  collectLotteOnNoticeSourceValues,
  computeLotteOnRegistrationReadiness,
  fromLotteOnChannelInfo,
  isLotteOnCategoryChosen,
  lotteOnFieldSectionId,
  requiresSafetyCertification,
  resolveLotteOnSelectedCategory,
  summarizeCommonProduct,
  toLotteOnChannelInfo,
  toLotteOnChannelPayload,
  type CommonCategorySource,
  type CommonProductRow,
  type LotteOnChannelForm,
  type LotteOnValidationSnapshot,
} from "./lotteon-channel-form";
import {
  LOTTEON_SAFETY_TYPE_LABEL,
  buildLotteOnCategoryPath,
  parseLotteOnStandardCategory,
  type LotteOnCategoryCandidate,
  type LotteOnStandardCategory,
} from "./lotteon-category";
import { CategoryCandidateCard, candidateStars } from "./CategoryCandidateCard";
import { CategoryRecommendationShell } from "./CategoryRecommendationPanel";
import { ManufacturerField } from "./ManufacturerResolutionNote";
import type { ManufacturerResolutionState } from "./use-manufacturer-resolution";
/**
 * REWORK-11 ①(CEO 판정, 2026-09-15) — **이 탭의 입력 한 줄은 이제 스마트스토어·
 * 쿠팡과 같은 컴포넌트가 그린다.** 여기 있던 전용 `TextField` · `TextAreaField` ·
 * `RequirementBadge`가 사라지고 공용 `ChannelCodeField` · `ChannelCodeTextArea`로
 * 바뀌었다 — 같은 자리가 탭마다 다른 테두리·여백·글자 크기로 보이던 차이가
 * 여기서 끝난다.
 *
 * REWORK-14(2026-09-15) — 그 공용 컴포넌트 **안에 넣던 것**까지 쿠팡과 한 벌이
 * 됐다. 필수는 라벨 뒤 별표, 비어 있는 필수는 「입력 필요」 알약, 선택은 아무
 * 표시도 없다. API 필드명은 라벨에서 빠져 ⓘ 안으로 들어갔고, 목록에서 고르는
 * 컨트롤은 도움말 줄 밖(입력칸 아래)으로 나왔다.
 */
import {
  ChannelCodeField,
  ChannelCodeTextArea,
  FIELD_INPUT_CLASS,
  ReadOnlyFieldRow,
  type FieldRequirement,
} from "./registration-fields";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  channelSectionTitle,
  FIELD_GRID_CLASS,
  FIELD_GRID_NARROW_CLASS,
  initialOpenSections,
  SECTION_NOTE_CLASS,
  SECTION_STACK_CLASS,
  sectionTitle,
} from "./registration-sections";
import { ChannelRegistrationFrame, ChannelRegistrationSummary } from "./ChannelRegistrationFrame";
import { ListingConfirmationModal, type ListingProgressStep } from "./ListingConfirmationModal";
import type { ReadinessItem } from "./readiness";
import { resolveRegistrationReadinessState, type PriorityItem } from "./readiness-state";
import {
  describeLotteOnSellerSettings,
  type ListingStatus,
  type LotteOnSellerSettingRow,
  type LotteOnSellerSettingsInput,
} from "@commerce/listing";

/**
 * LOTTEON COMMERCE SPRINT 4(CEO 확정, 2026-09-14) — 롯데ON 탭.
 *
 * ── 이 탭이 하는 일 / 하지 않는 일 ─────────────────────────────────────────
 * 하지 않는 일: **상품을 다시 만들지 않는다.** 상품명 · 대표이미지 · 상세페이지 ·
 * 가격 · 옵션 · 재고는 공통 상품관리가 이미 갖고 있고, 이 화면에는 그 값을
 * 입력하는 칸이 하나도 없다(아래 ①은 전부 읽기 전용이다 — input이 아니다).
 * 고치려면 상품정보 탭으로 데려간다(onEditCommonInfo).
 *
 * 하는 일: **롯데ON에만 있는 차별점**만 받는다.
 *   ③ 카테고리  표준(scatNo) + 전시(dcatLst[]) 2중 구조 — **추천**으로 채운다
 *   ④ 고시      pdItmsCd · pdItmsArtlLst[]
 *   ⑤ 인증      sftyAthnLst[] · impPrxCd
 *   ⑥ 배송      출고지 · 반품지 · 배송비 정책 · 배송가능지역
 *   ⑦ 롯데ON 고유 코드  oplcCd · tdfDvsCd · brdNo · epdNo
 *
 * ── REWORK 커머스 탭 구조 통일(CEO 지시, 2026-09-14) ──────────────────────
 * 이 탭의 골격을 스마트스토어·쿠팡과 같은 원칙으로 맞춘다:
 *
 *   ① 상품정보 (공통)   상품정보 Source에서 자동 표시  (읽기 전용 — 이미 있었다)
 *   ② 셀러 설정 정보     Seller Settings에서 자동 반영  (읽기 전용 — **이번에 신설**)
 *   ③ 카테고리           추천 → 셀러 선택 → 확정
 *   ④⑤⑥ 롯데ON 필수 등록정보
 *   ⑦ 롯데ON 고유 관리정보
 *
 * ②가 없던 동안 이 탭은 출고지·반품지·택배사를 "그냥 모르는 값"으로 취급해
 * 셀러에게 손으로 치게 했다 — 셀러 설정에 같은 개념이 있는지조차 말하지 않았다.
 * 판정(자동 반영 / 코드체계 다름 / 개념 없음)은 화면이 만들지 않고
 * @commerce/listing의 describeLotteOnSellerSettings()가 준 표를 그대로 그린다.
 *
 * ── SPRINT 4에서 바뀐 것 ──────────────────────────────────────────────────
 * 1. **등록 가능성**을 화면에 세운다. 값은 서버 검증(validateLotteOnPayload)
 *    결과를 세기만 한 것이라(computeLotteOnRegistrationReadiness) 화면이
 *    서버보다 낙관적으로 말할 경로가 없다. 탭에 들어오면 한 번 자동으로
 *    확인하고, 입력이 바뀌면 **결과를 무효로 표시하고 등록 버튼을 잠근다** —
 *    SPRINT 3까지는 확인을 통과한 뒤 값을 지워도 버튼이 열려 있었다.
 * 2. **부족한 정보**를 "왜 필요한지 + 무엇을 어디서"까지 말한다(§8).
 *    공통 상품정보가 먼저 오고, 그 항목은 상품정보 탭으로 데려간다.
 * 3. **카테고리 추천**(CEO 신규 요건). 조회가 아니라 추천이다. 점수는
 *    쿠팡·스마트스토어가 쓰는 그 함수(scoreCategoryCandidate)를 그대로 쓴다.
 *    표준카테고리를 고르면 전시카테고리 · 고시 품목코드 · 과세구분 · 요구
 *    안전인증 유형이 **같은 응답에서 함께 따라온다** — 다시 묻지 않는다.
 *
 * 🔴 인증키는 이 화면에 절대 나타나지 않는다.
 */
interface PreviewResponse {
  ok: boolean;
  message?: string;
  identityError?: string | null;
  payload?: unknown;
  validation?: LotteOnValidationSnapshot;
}

interface RegisterResponse {
  ok: boolean;
  message?: string;
  validation?: LotteOnValidationSnapshot;
  nextStep?: string;
  result?: {
    status: "SUBMITTED" | "FAILED";
    externalProductId: string | null;
    message: string;
    errorCode: string | null;
    optionIdNote?: string;
    rows?: { spdNo?: string; epdNo?: string; resultCode?: string; resultMessage?: string }[];
  };
}

interface RecommendState {
  loading: boolean;
  error: string | null;
  /**
   * REWORK-12 ②(CEO 실측 캡처, 2026-09-15) — **사유 다음에 오는 행동 한 줄.**
   *
   * 캡처에서 이 자리에 서 있던 글자는 `The operation was aborted due to timeout`
   * 하나였다. 이제 서버가 한국어 사유(`message`)와 다음 행동(`nextAction`)을
   * 나눠 내려보내고(_lib/connection-error.ts), 화면이 둘 다 그린다.
   * 🔴 화면이 사유를 만들지 않는다 — 서버 문장을 그대로 세운다.
   */
  errorAction: string | null;
  decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT" | null;
  candidates: LotteOnCategoryCandidate[];
  signalEvidence: string[];
  scannedLeafCount: number;
  unrecognizedCount: number;
  truncated: boolean;
  /**
   * REWORK-11 ④(CEO 지시, 2026-09-15: "후보가 안 뜨면 그 사유를 화면에") —
   * 롯데ON이 **표준카테고리를 몇 건 돌려줬는가**와 **몇 페이지를 읽었는가**.
   *
   * 이게 없던 동안 화면은 세 가지를 같은 문장("추천할 수 있는 카테고리를 찾지
   * 못했습니다")으로 뭉갰다: ① 응답이 비었다 ② 응답 형식이 파서와 다르다
   * ③ 정말로 맞는 카테고리가 없다. 셀러가 해야 할 일이 각각 다르다.
   */
  totalCategoryCount: number;
  pagesFetched: number;
}

/**
 * REWORK-11 ④ — `/api/lotteon/delivery-settings` 응답. 전부 **롯데ON이 준 값**이고
 * 화면이 만들어내는 필드는 하나도 없다.
 */
interface DeliveryPlaceOption {
  no: string;
  name: string | null;
  typeCode: string | null;
  isDefault: boolean;
}

interface CostPolicyOption {
  no: string;
  name: string | null;
}

interface CodeOption {
  code: string;
  name: string | null;
}

interface DeliverySettingsResponse {
  /** 조회에 실제로 쓴 소속거래처코드. 문서로 확정되지 않은 값이라 화면에 적는다. */
  sentAfflTrCd: string;
  outboundPlaces: DeliveryPlaceOption[];
  returnPlaces: DeliveryPlaceOption[];
  costPolicies: CostPolicyOption[];
  couriers: CodeOption[];
  deliveryRegionGroups: CodeOption[];
  /** 어느 API가 왜 답하지 못했는가. 비어 있으면 전부 정상이다. */
  issues: { source: string; message: string }[];
}

interface DeliverySettingsState {
  loading: boolean;
  error: string | null;
  data: DeliverySettingsResponse | null;
}

/**
 * 자동으로 고를 수 있는 한 건. **판매자센터가 기본으로 표시한 건**이거나
 * **후보가 하나뿐**일 때만이다 — 여럿 중 하나를 우리가 고르면 엉뚱한 출고지로
 * 주문이 간다. 그 경우에는 셀러가 목록에서 고른다.
 *
 * export 하는 이유는 하나다 — `isDefault`의 출처(150의 `rprtYn`)를 고친 뒤에도
 * **이 규칙 자체는 그대로**임을 테스트로 고정하기 위해서다
 * (`__tests__/lotteon-delivery-autopick.test.ts`).
 */
export function autoPick<T extends { no: string; isDefault?: boolean }>(options: T[]): T | null {
  if (options.length === 0) return null;
  const marked = options.find((option) => option.isDefault);
  if (marked) return marked;
  return options.length === 1 ? options[0] : null;
}

const EMPTY_RECOMMEND: RecommendState = {
  loading: false,
  error: null,
  errorAction: null,
  decision: null,
  candidates: [],
  signalEvidence: [],
  scannedLeafCount: 0,
  unrecognizedCount: 0,
  truncated: false,
  totalCategoryCount: 0,
  pagesFetched: 0,
};

export function LotteOnRegistrationPanel({
  product,
  snapshotId,
  jobKey,
  liveRates,
  roundingUnit,
  commonPrice,
  commonCategorySources,
  sellerSettings,
  channelInfo,
  onChannelInfoChange,
  onEditCommonInfo,
  onReadinessChange,
  onRegistered,
  manufacturerResolution,
}: {
  product: CanonicalProduct;
  snapshotId?: string | null;
  jobKey?: string | null;
  liveRates?: Record<string, number>;
  roundingUnit?: number;
  /** 상품정보 화면이 이미 계산해 둔 판매가격. 여기서 다시 계산하지 않는다. */
  commonPrice: { priceKrw: number | null; resolved: boolean };
  /** 공통 분류(원본 사이트 · 다른 채널 확정값). **읽기 전용**. */
  commonCategorySources: CommonCategorySource[];
  /**
   * REWORK 커머스 탭 구조 통일(CEO 지시, 2026-09-14) — 셀러 설정(배송 프로필).
   * 스마트스토어·쿠팡이 쓰는 그 프로필 그대로다(새 저장소를 만들지 않았다).
   * **읽기 전용** — 이 탭에는 셀러 설정을 고치는 입력칸이 하나도 없고, 비어
   * 있으면 설정 화면으로 데려간다.
   */
  sellerSettings?: LotteOnSellerSettingsInput | null;
  /**
   * 3층 구조 재정렬(CEO 지시, 2026-09-14) — 상품 수준에 저장돼 있는 롯데ON
   * 관리정보(CanonicalProduct.lotteOnChannelInfo). 이 값이 폼의 **초기값**이다.
   *
   * 예전에는 이 prop이 없어서 폼이 항상 EMPTY로 시작했고, 탭을 벗어나 컴포넌트가
   * 언마운트되면 고시·인증·배송번호가 전부 사라졌다 — 그것이 "상품정보에
   * 롯데온 내용은 하나도 없다"의 실제 원인이었다.
   */
  channelInfo?: LotteOnChannelInfo;
  /** 입력이 바뀔 때마다 상품 수준으로 올려보낸다(저장 경로는 상품과 같다). */
  onChannelInfoChange?: (info: LotteOnChannelInfo) => void;
  /** 공통 정보를 고치러 가는 유일한 통로 — 상품정보 탭. */
  onEditCommonInfo: () => void;
  /** 탭 줄/준비상태 줄이 롯데ON 상태를 함께 보여주기 위한 보고 채널.
   * 스마트스토어/쿠팡의 onReadinessChange와 같은 자리다 — 여기서 새 판정을
   * 만들지 않고 이미 계산된 값을 올려보내기만 한다. */
  onReadinessChange?: (percent: number, allRequiredPassed: boolean, missingCount: number) => void;
  /**
   * N-05 STEP 2 — **등록이 실제로 끝났다**는 사실만 위로 올린다.
   *
   * 🔴 결과 화면을 옮기는 것이 아니다(그건 이 패널이 계속 그린다). ④ 커머스
   * 등록 목록이 세 채널을 나란히 보여주려면 부모가 「롯데ON 은 끝났는가」를
   * 알아야 하는데, 그 사실이 이 컴포넌트 안에만 있었다 — 그래서 목록에서
   * 롯데ON 만 영영 「등록할 수 있습니다」로 남았다.
   */
  onRegistered?: () => void;
  /**
   * REWORK-10 A(CEO 지시, 2026-09-15) — 전 채널 공통 제조사 resolver의 결과.
   * 스마트스토어·쿠팡 탭(PlatformPreview)이 받는 것과 **같은 값**이다 —
   * CommerceWorkspace가 탭과 무관하게 한 번 계산해서 셋에 똑같이 내려보낸다.
   */
  manufacturerResolution: ManufacturerResolutionState;
}) {
  /**
   * 폼의 시작점은 **상품에 저장된 값**이다(없으면 빈 폼). 여기서 prop을 계속
   * 따라가지 않고 초기값으로만 쓰는 이유: 타이핑 중인 입력칸을 부모 리렌더가
   * 되감지 않게 하기 위해서다. 탭을 벗어나면 이 컴포넌트는 언마운트되고, 다시
   * 들어오면 저장된 값으로 새로 초기화된다 — 그 왕복이 "남아 있다"의 실제 경로다.
   */
  const [form, setForm] = useState<LotteOnChannelForm>(() => fromLotteOnChannelInfo(channelInfo));
  const [displayCategoryText, setDisplayCategoryText] = useState(() =>
    fromLotteOnChannelInfo(channelInfo).category.displayCategoryNos.join(", "),
  );
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<RegisterResponse | null>(null);
  /* REWORK-7 ⑤ — 최종 확인 모달(세 채널 공용)과 그 안의 진행 단계. */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [registerProgress, setRegisterProgress] = useState<ListingProgressStep | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommend, setRecommend] = useState<RecommendState>(EMPTY_RECOMMEND);
  /**
   * REWORK-6 ②(CEO 판정, 2026-09-14: "추천 실패가 곧 등록 불가가 되어서는 안
   * 된다") — 추천이 후보를 내지 못했을 때 셀러가 **목록에서 카테고리를 고르는**
   * 길. 번호를 찾아 적는 폐기된 UX가 아니다(입력칸이 하나도 없다).
   */
  const [directPickOpen, setDirectPickOpen] = useState(false);
  /**
   * 확인을 통과한 뒤 입력이 바뀌었는가. true면 화면의 등록 가능성/부족한 정보는
   * **옛 입력에 대한 답**이다 — 등록 버튼을 잠그고 다시 확인하게 한다.
   * (SPRINT 3까지는 이 상태가 없어서 확인 후 값을 지워도 버튼이 열려 있었다.)
   */
  const [stale, setStale] = useState(false);

  /**
   * REWORK-11 ①(CEO 판정, 2026-09-15) — **접힘/펼침 동작을 스마트스토어·쿠팡과
   * 같게 한다.**
   *
   * 지금까지 롯데ON의 섹션은 전부 `defaultOpen`(항상 펼쳐진 채로 시작)이었다.
   * 스마트스토어·쿠팡은 ① 기본 상품정보 하나만 열고 시작한다(PlatformPreview
   * L600). 그래서 같은 상품으로 탭을 옮기면 롯데ON만 화면이 서너 배 길었고,
   * "펼쳐진 긴 문서"라는 인상이 그대로 남았다 — CEO가 "디자인이 다르다"고
   * 읽은 차이의 큰 몫이다.
   *
   * 🔴 정보를 숨긴 것이 아니다. 접힌 섹션도 제목 · 상태 배지 · 한 줄 요약을
   * 그대로 보여주고(CollapsibleSection의 summary 슬롯), 우측 요약의 [이동]을
   * 누르면 그 섹션이 열리며 스크롤한다 — 스마트스토어·쿠팡의 goToSection과
   * 같은 동작이다.
   */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    initialOpenSections("lotteon-section-basic"),
  );

  function goToSection(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function sectionProps(id: string) {
    return {
      id,
      open: openSections[id] ?? false,
      onToggle: (next: boolean) => setOpenSections((prev) => ({ ...prev, [id]: next })),
    };
  }

  /** ① 공통 상품정보 — 실제 payload를 만드는 함수와 같은 것을 쓴다. */
  const common = useMemo(() => summarizeCommonProduct(product, commonPrice), [product, commonPrice]);
  /**
   * REWORK-4 §5 — 공통 요약의 행을 **10섹션 골격의 제자리로** 나눠 보낸다.
   *
   * 행 자체를 새로 만들지 않는다(summarizeCommonProduct가 유일한 출처다) —
   * 어느 섹션에 설 것인지만 라벨로 고른다. 라벨이 바뀌면 여기서 0행이 되고,
   * 아래 렌더 테스트가 "그 섹션이 비었다"로 바로 잡는다.
   */
  const rowsOf = useCallback(
    (...labels: string[]): CommonProductRow[] => common.rows.filter((row) => labels.includes(row.label)),
    [common],
  );
  /** 고시 "내용"으로 그대로 쓸 수 있는 공통 값 — 다시 치지 않게 한다. */
  const noticeSources = useMemo(() => collectLotteOnNoticeSourceValues(product), [product]);
  /**
   * ② 셀러 설정 정보 — 판정은 화면이 하지 않는다. payload가 쓰는 것과 **같은**
   * 함수(@commerce/listing describeLotteOnSellerSettings)가 준 표를 그대로 그린다.
   */
  const sellerSettingRows = useMemo(() => describeLotteOnSellerSettings(sellerSettings), [sellerSettings]);

  const validation = preview?.validation ?? null;
  const readiness = useMemo(() => computeLotteOnRegistrationReadiness(validation), [validation]);
  const missingInfo = useMemo(() => buildLotteOnMissingInfo(validation), [validation]);
  /** §17 — 카테고리 전에는 등록 가능성을 숫자로 말하지 않는다. */
  const categoryChosen = isLotteOnCategoryChosen(form);
  /**
   * 선택한 표준카테고리가 알려준 것(이름 · 고시 품목코드 · 요구 안전인증 유형).
   *
   * LOTTEON-CATEGORY-PERSIST(CEO 지시, 2026-09-14) — 예전에는 이것이 컴포넌트
   * 로컬 useState(pickedCategory)였다. 그래서 탭을 벗어나면 사라졌고, 돌아온
   * 셀러에게는 **"안전인증이 필요하다"는 차단만 남고 그것을 푸는 길이 없었다**
   * (유형코드를 모르면 상품정보의 실제 인증번호를 등록 형식으로 옮길 수 없다).
   * 이제 폼 = 상품 저장값에서 나온다 — 폼이 남으면 이것도 남는다.
   */
  const selectedCategory = resolveLotteOnSelectedCategory(form);

  const safetyRequired = requiresSafetyCertification(form);
  const safetyMissing = safetyRequired && !form.certification.safetyText.trim();

  useEffect(() => {
    onReadinessChange?.(stale ? 0 : readiness.percent, !stale && readiness.allRequiredPassed, missingInfo.length);
  }, [onReadinessChange, readiness.percent, readiness.allRequiredPassed, missingInfo.length, stale]);

  /**
   * 입력이 바뀐 횟수. 확인 요청을 보낸 시점의 값과 응답이 돌아온 시점의 값이
   * 다르면 그 결과는 **이미 옛 입력에 대한 답**이라 stale을 풀지 않는다 —
   * 느린 응답이 도중에 바뀐 입력을 "확인됨"으로 덮는 경로를 막는다.
   */
  const formVersionRef = useRef(0);

  function markFormChanged() {
    formVersionRef.current += 1;
    // 입력이 바뀌면 직전 확인 결과는 더 이상 이 입력에 대한 답이 아니다.
    setStale(true);
  }

  /**
   * 폼을 바꾸는 **유일한** 통로. 로컬 상태와 상품 수준 저장이 같은 호출에서
   * 함께 움직인다 — 둘을 따로 부르는 자리를 만들면 "화면에는 있는데 저장은 안
   * 된" 값이 생긴다(이 화면이 정확히 그 상태였다).
   */
  function commitForm(next: LotteOnChannelForm) {
    setForm(next);
    onChannelInfoChange?.(toLotteOnChannelInfo(next));
    markFormChanged();
  }

  function patch<K extends keyof LotteOnChannelForm>(section: K, changes: Partial<LotteOnChannelForm[K]>) {
    commitForm({ ...form, [section]: { ...form[section], ...changes } });
  }

  /**
   * 카테고리 **추천**(CEO 신규 요건). 조회가 아니다.
   *
   * 서버(/api/lotteon/category-recommend)가 onpick 205 표준카테고리 목록을
   * 받아 이 상품의 신호(연령/성별/상품유형)와 대조해 점수를 매긴다 — 쿠팡과
   * 같은 scoreCategoryCandidate()를 쓴다.
   */
  const runRecommend = useCallback(async () => {
    setRecommend({ ...EMPTY_RECOMMEND, loading: true });
    try {
      const res = await fetch("/api/lotteon/category-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        /** REWORK-12 ② — 서버가 만든 «다음에 무엇을 하면 되는가» 한 줄. */
        nextAction?: string;
        decision?: RecommendState["decision"];
        candidates?: LotteOnCategoryCandidate[];
        signalEvidence?: string[];
        scannedLeafCount?: number;
        unrecognizedCount?: number;
        truncated?: boolean;
        totalCategoryCount?: number;
        pagesFetched?: number;
      };
      if (!data.ok) {
        /* REWORK-12 ②(CEO 실측 캡처, 2026-09-15) — 여기서 받은 `message`가
           영문 예외 문자열이던 것이 화면의 «The operation was aborted due to
           timeout»이었다. 서버가 한국어 사유/다음 행동을 나눠 보내게 됐으므로
           (api/lotteon/_lib/request.ts) 그대로 두 줄로 세운다. */
        setRecommend({
          ...EMPTY_RECOMMEND,
          error: data.message ?? "카테고리를 추천하지 못했습니다.",
          errorAction: data.nextAction ?? null,
        });
        return;
      }
      setRecommend({
        loading: false,
        error: null,
        errorAction: null,
        decision: data.decision ?? null,
        candidates: data.candidates ?? [],
        signalEvidence: data.signalEvidence ?? [],
        scannedLeafCount: data.scannedLeafCount ?? 0,
        unrecognizedCount: data.unrecognizedCount ?? 0,
        truncated: Boolean(data.truncated),
        totalCategoryCount: data.totalCategoryCount ?? 0,
        pagesFetched: data.pagesFetched ?? 0,
      });
    } catch {
      setRecommend({
        ...EMPTY_RECOMMEND,
        error: "서버에 연결하지 못했습니다.",
        errorAction: "잠시 후 [다시 확인]을 눌러 주세요.",
      });
    }
  }, [product]);

  /**
   * REWORK-10 C(CEO 지시, 2026-09-15) — **카테고리 추천을 탭에 들어오면 바로 돌린다.**
   *
   * 지금까지 롯데ON만 셀러가 [카테고리 추천]을 눌러야 후보가 나왔다.
   * 스마트스토어는 탭에 들어오면 자동으로 /api/naver/category-search를 돌리고
   * (CommerceWorkspace L1105 effect) 쿠팡도 추천 결과를 자동으로 받는다 —
   * 셋 중 롯데ON만 "먼저 버튼을 눌러야 시작되는" 화면이었다.
   *
   * 🔴 새 조회 경로를 만들지 않았다. 셀러가 누르던 그 함수(runRecommend)를
   * 마운트 시 한 번 부를 뿐이고, [다시 추천] 버튼은 그대로 남는다(쿠팡의
   * [다시 확인]과 같은 자리). 이미 고른 카테고리가 있으면 돌리지 않는다 —
   * 셀러의 결정을 덮어쓸 이유가 없다.
   */
  const autoRecommendedRef = useRef(false);
  const hadCategoryOnMountRef = useRef(isLotteOnCategoryChosen(form));
  useEffect(() => {
    if (autoRecommendedRef.current) return;
    autoRecommendedRef.current = true;
    if (hadCategoryOnMountRef.current) return;
    void runRecommend();
  }, [runRecommend]);

  /**
   * 추천 후보를 고른다 — **한 번에 네 가지가 채워진다.**
   *
   * 표준카테고리번호 · 전시카테고리(disp_list) · 고시 품목코드(pd_Itms_list) ·
   * 과세구분코드(tdf_cd)는 전부 205 응답 한 건 안에 같이 들어 있다. 셀러에게
   * 다시 묻지 않는 이유는 "편해서"가 아니라, 따로 입력받으면 표준카테고리와
   * 짝이 맞지 않는 조합을 만들 수 있어서다(등록이 거절된다).
   *
   * 🔴 공통 카테고리(categoryMappings)는 건드리지 않는다 — 이 함수가 쓰는
   * setter는 전부 이 컴포넌트 안의 롯데ON 폼이다.
   */
  function applyRecommendation(candidate: LotteOnCategoryCandidate) {
    applyCategory(candidate.category);
  }

  /**
   * REWORK-11 ④(CEO 지시, 2026-09-15) — **배송 설정을 우리가 조회한다.**
   *
   * CEO 실측: 판매자센터에 출고지·반품지·배송비정책이 이미 등록돼 있다. 지금까지
   * 이 탭은 그 번호를 셀러에게 손으로 치게 했다 — 물어보지 않았을 뿐이다.
   *
   * 🔴 조회에 쓰는 소속거래처코드(afflTrCd)가 문서로 확정되지 않았다(207의 trNo
   * 인지 별도 상위 거래처번호인지). 그래서 **결과가 비거나 실패하면 그 사유를
   * 그대로 화면에 세운다** — "설정값이 없습니다"로 바꿔 셀러에게 다시 입력시키지
   * 않는다. 값은 하나도 지어내지 않는다.
   */
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettingsState>({
    loading: true,
    error: null,
    data: null,
  });
  const deliveryAppliedRef = useRef(false);

  /**
   * ══ LOTTEON-REAL-REGISTRATION-02 ①(CEO 확정, 2026-09-22) ══
   *
   * 판매자가 설정에 «한 번» 정해 둔 값. 이 칸을 비워 두면 서버가 여기서 채워
   * 등록한다(build-context 의 사다리) — 화면이 그 사실을 말하지 않으면 셀러는
   * 빈 칸을 보고 「아직 안 됐다」고 읽고 매 상품마다 다시 고른다. 그게 지금까지
   * 벌어진 일이다.
   *
   * 🔴 이 값으로 폼을 «채우지 않는다». 채우면 상품별 명시값과 구분이 사라지고,
   * 설정을 바꿨을 때 이미 만들어 둔 상품들이 옛 값을 들고 남는다. 화면은
   * 「지금 이 자리에 무엇이 적용되는가」를 말하기만 한다 — 실제 합류는 서버
   * 한 곳에서만 일어난다.
   */
  const [sellerFixed, setSellerFixed] = useState<{
    outboundPlaceNo: string | null;
    outboundPlaceLabel: string | null;
    returnPlaceNo: string | null;
    returnPlaceLabel: string | null;
    deliveryCostPolicyNo: string | null;
    deliveryCostPolicyLabel: string | null;
    deliveryRegionGroupCode: string | null;
    deliveryRegionGroupLabel: string | null;
  } | null>(null);

  /**
   * ══ LOTTEON-REAL-REGISTRATION-05(CEO 확정, 2026-09-22) ══
   *
   * 고시 품목코드 목록. 89 공통코드 `PD_ITMS_CD` 40건이다.
   *
   * 오래 찾았다 — 205 표준카테고리가 줄 것 같았지만 목록·단건 모두 pd_itms_list
   * 가 비어 있었고, attr_list 는 상품 «속성» 이라 무관했다. 89 에 있었다.
   *
   * 🔴 조회 실패를 «목록 없음» 과 같은 얼굴로 두지 않는다. 비어 있으면 셀러는
   * 「고를 것이 없다」고 읽는데 사실은 조회가 닿지 않은 것이다.
   */
  const noticeItemCodeList = useLotteOnCommonCodes("PD_ITMS_CD", "고시 품목코드");
  /**
   * ══ LOTTEON-REAL-REGISTRATION-06(2026-09-22) ══
   *
   * 원산지코드. 첫 LIVE 등록이 **이 필드 하나만** 지목하고 거절했다.
   *
   *     returnCode 9999  "[원산지코드(oplcCd)] 가 유효하지 않습니다."
   *     보낸 값          "oplcCd": "OPLC_CD"   ← 코드가 아니라 «코드그룹 이름»
   *
   * 우리 코드 어디에도 그 문자열을 넣는 곳은 없다. 화면이 「공통코드 OPLC_CD」
   * 라는 힌트를 달아 두고 셀러에게 번호를 «적게» 했고, 셀러는 그 힌트를 답으로
   * 읽었다. 고르게 하면 틀릴 수가 없다.
   */
  const originCodeList = useLotteOnCommonCodes("OPLC_CD", "원산지코드");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/lotteon-seller");
        const data = (await res.json()) as { ok?: boolean; values?: typeof sellerFixed };
        if (!cancelled && data.ok && data.values) setSellerFixed(data.values);
      } catch {
        // 설정을 못 읽어도 화면은 그대로 선다 — 그때는 「설정값 적용됨」을
        // 말하지 않을 뿐이고, 빈 칸은 검증기가 평소대로 blocker 로 잡는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/lotteon/delivery-settings");
        const data = (await res.json()) as Partial<DeliverySettingsResponse> & { ok?: boolean; message?: string };
        if (cancelled) return;
        if (!data.ok) {
          setDeliverySettings({ loading: false, error: data.message ?? "배송 설정을 조회하지 못했습니다.", data: null });
          return;
        }
        /* 🔴 응답에 없는 배열을 undefined로 들고 다니지 않는다 — 한 곳에서
           모양을 맞춰 두면 아래 렌더가 매번 `?? []`를 반복하지 않아도 된다.
           값을 지어내는 것이 아니다(없으면 0건이고, 0건은 위 안내가 말한다). */
        setDeliverySettings({
          loading: false,
          error: null,
          data: {
            sentAfflTrCd: data.sentAfflTrCd ?? "",
            outboundPlaces: data.outboundPlaces ?? [],
            returnPlaces: data.returnPlaces ?? [],
            costPolicies: data.costPolicies ?? [],
            couriers: data.couriers ?? [],
            deliveryRegionGroups: data.deliveryRegionGroups ?? [],
            issues: data.issues ?? [],
          },
        });
      } catch {
        if (!cancelled) {
          setDeliverySettings({ loading: false, error: "서버에 연결하지 못했습니다.", data: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 조회 결과를 **비어 있는 칸에만** 넣는다. 셀러가 이미 넣어 둔 값이나 저장돼
   * 있던 값을 덮지 않는다. 자동으로 고를 수 있는 것은 "판매자센터가 기본으로
   * 표시한 건" 또는 "후보가 하나뿐인 경우"뿐이다 — 여러 개 중 하나를 우리가
   * 골라 주면 엉뚱한 출고지로 주문이 간다.
   */
  useEffect(() => {
    const data = deliverySettings.data;
    if (!data || deliveryAppliedRef.current) return;
    deliveryAppliedRef.current = true;
    const patch: Partial<LotteOnChannelForm["delivery"]> = {};
    const outbound = autoPick(data.outboundPlaces);
    const returning = autoPick(data.returnPlaces);
    const policy = autoPick(data.costPolicies);
    if (!form.delivery.outboundPlaceNo && outbound) patch.outboundPlaceNo = outbound.no;
    if (!form.delivery.returnPlaceNo && returning) patch.returnPlaceNo = returning.no;
    if (!form.delivery.deliveryCostPolicyNo && policy) patch.deliveryCostPolicyNo = policy.no;
    if (Object.keys(patch).length === 0) return;
    const next = { ...form, delivery: { ...form.delivery, ...patch } };
    setForm(next);
    onChannelInfoChange?.(toLotteOnChannelInfo(next));
    markFormChanged();
    void runValidation(next);
    // form/runValidation은 매 렌더 새로 만들어진다 — 이 효과는 조회 결과가
    // 처음 도착했을 때 딱 한 번만 돈다(deliveryAppliedRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliverySettings.data]);

  /**
   * REWORK-6 ②(CEO 판정, 2026-09-14) — **고른 경로가 달라도 반영 경로는 하나다.**
   *
   * 추천 후보에서 고르든(위) 추천 실패 후 목록에서 직접 고르든, 도착하는 곳은
   * 이 함수 하나다 — 그래서 "추천으로 고른 것만 제대로 반영되고 직접 고른 것은
   * 우측 요약에서 안 사라진다" 같은 갈라짐이 생길 수 없다(627ac53이 고친
   * 재검증 경로를 그대로 탄다).
   */
  function applyCategory(category: LotteOnStandardCategory) {
    const next = applyLotteOnRecommendedCategory(form, category);
    setDisplayCategoryText(next.category.displayCategoryNos.join(", "));
    commitForm(next);
    setDirectPickOpen(false);
    /**
     * REWORK-5 ③(CEO 실측: "우측 요약에서도 안 없어짐") — **선택 즉시 자동
     * 반영**의 실제 구현이 이 한 줄이다.
     *
     * 원인은 이랬다: commitForm()이 markFormChanged()로 stale=true를 세우는데,
     * 우측 요약이 읽는 부족정보(missingInfo)는 **직전 검증 응답**에서 나온다.
     * 그래서 카테고리를 골라도 요약에는 고르기 전의 "카테고리 없음"이 그대로
     * 남고, percent는 stale 때문에 0으로 떨어졌다 — 셀러 눈에는 "골랐는데
     * 아무 일도 안 일어났고 오히려 나빠진" 화면이었다. 셀러가 [등록 정보
     * 확인]을 한 번 더 눌러야만 사라졌다.
     *
     * 🔴 새 판정을 만들어 메우지 않는다. 화면이 스스로 "이제 카테고리는
     * 찼다"고 계산하기 시작하면 서버 판정과 갈라진다(이 저장소가 CP001로
     * 이미 겪은 일이다). 대신 **셀러가 눌렀어야 할 그 확인을 대신 눌러 준다**
     * — 판정의 출처는 그대로 서버 하나다.
     *
     * 입력칸 타이핑마다 쏘지 않는 기존 규칙은 그대로다. 카테고리 선택은
     * 타이핑이 아니라 **완결된 한 번의 결정**이고, 그 한 번이 표준·전시·고시
     * 품목·과세·요구 안전인증을 한꺼번에 바꾼다 — 확인을 미룰 이유가 없다.
     */
    void runValidation(next);
  }

  /**
   * 상품정보에 이미 있는 어린이제품 인증을 롯데ON 형식으로 옮겨 적는다.
   * 🔴 인증번호를 만들지 않는다 — 셀러가 상품정보에 입력해 둔 실제 값만 옮긴다.
   */
  const commonSafetyLine = useMemo(
    () => buildLotteOnSafetyLineFromCommon(product, selectedCategory?.safetyTypeCodes[0] ?? null),
    [product, selectedCategory],
  );

  const runValidation = useCallback(
    async (currentForm: LotteOnChannelForm) => {
      setPreviewing(true);
      setError(null);
      setRegisterResult(null);
      const requestedVersion = formVersionRef.current;
      try {
        const res = await fetch("/api/lotteon/payload-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product,
            channel: toLotteOnChannelPayload(currentForm),
            liveRates,
            roundingUnit,
          }),
        });
        const data = (await res.json()) as PreviewResponse;
        setPreview(data);
        // 요청을 보낸 뒤 입력이 또 바뀌었으면 이 결과는 옛 입력에 대한 답이다.
        if (formVersionRef.current === requestedVersion) setStale(false);
        if (!data.ok) setError(data.message ?? "등록 정보를 만들지 못했습니다.");
      } catch {
        setError("서버에 연결하지 못했습니다.");
      } finally {
        setPreviewing(false);
      }
    },
    [product, liveRates, roundingUnit],
  );

  /**
   * 탭에 들어오면 **한 번** 자동으로 확인한다.
   *
   * 이유는 UX가 아니라 정확성이다. 자동 확인이 없으면 "등록 가능성"과 "부족한
   * 정보"를 셀러가 버튼을 누르기 전까지 볼 수 없고, 그동안 화면은 빈 채로
   * 남는다 — 그 빈 화면을 메우려고 화면 쪽에서 따로 판정을 만들면 서버와
   * 갈라진다. 그래서 판정은 계속 서버 하나로 두고, 시점만 앞당긴다.
   *
   * 입력마다 다시 쏘지 않는다(207 Identity를 매번 호출한다). 입력이 바뀌면
   * stale로 표시만 하고, 다시 쏘는 것은 셀러의 [등록 정보 확인] 클릭이다.
   *
   * 3층 구조 재정렬(2026-09-14) — 확인하는 대상이 **빈 폼이 아니라 상품에
   * 저장돼 있던 값**으로 바뀐다. 예전처럼 EMPTY로 확인하면, 배송번호까지 다
   * 채워둔 상품으로 탭에 다시 들어왔을 때 화면이 "아무것도 없다"고 말한다.
   */
  const autoCheckedRef = useRef(false);
  const restoredFormRef = useRef(form);
  useEffect(() => {
    if (autoCheckedRef.current) return;
    autoCheckedRef.current = true;
    void runValidation(restoredFormRef.current);
  }, [runValidation]);

  async function runRegister() {
    // 게이트는 셋을 동시에 만족해야 열린다(§10): 등록 가능성 100% + 서버 검증
    // 통과 + 그 결과가 **지금 입력에 대한 것**일 것.
    if (!canRegister) return;
    setRegistering(true);
    setError(null);
    /* REWORK-7 ⑤ — 단계를 새로 만든 게 아니라 **이미 일어나던 일에 이름을
       붙인 것**이다(627ac53의 스마트스토어·쿠팡과 같은 세 단계, 같은 모달).
       PREPARING payload 조립 → SENDING /api/lotteon/register 왕복 →
       CONFIRMING 돌아온 결과 기록. 등록 경로는 한 줄도 바뀌지 않는다. */
    setRegisterProgress("PREPARING");
    try {
      const body = JSON.stringify({
        product,
        channel: toLotteOnChannelPayload(form),
        snapshotId: snapshotId ?? undefined,
        jobKey: jobKey ?? undefined,
        liveRates,
        roundingUnit,
      });
      setRegisterProgress("SENDING");
      const res = await fetch("/api/lotteon/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      setRegisterProgress("CONFIRMING");
      const data = (await res.json()) as RegisterResponse;
      setRegisterResult(data);
      // 🔴 실제로 제출된 경우에만 올린다 — 실패/검증거부를 「등록됨」으로 말하지 않는다.
      if (data.result?.status === "SUBMITTED") onRegistered?.();
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setRegistering(false);
      setRegisterProgress(null);
      setConfirmOpen(false);
    }
  }

  /**
   * REWORK-7 ④ — 🔴 필수 / ⚪ 선택. 서버 검증이 이름을 올린 필드만 필수다
   * (validateLotteOnPayload의 ok는 MISSING·BLOCKED 둘 다 0일 때만 참이므로,
   * 검증이 들여다본 필드는 예외 없이 등록을 막는다). 검증 전에는 undefined —
   * 모르는 것을 필수라고도 선택이라고도 적지 않는다.
   */
  const requirementOf = useCallback(
    (validationField: string): FieldRequirement => {
      if (!validation) return undefined;
      return validation.fields.some((f) => f.field === validationField) ? "REQUIRED" : "OPTIONAL";
    },
    [validation],
  );

  const connectionOk = preview != null && preview.ok && !preview.identityError;
  const canRegister = !stale && readiness.percent === 100 && readiness.allRequiredPassed && !registering && !previewing;

  /* ──────────────────────────────────────────────────────────────────────
     REWORK-2(CEO 지시, 2026-09-14) — 우측 · 등록 요약으로 옮기기 위한 변환.

     🔴 **판정을 새로 만들지 않는다.** 아래 세 값은 전부 이미 계산돼 있던
     것(validation / readiness / missingInfo)을 스마트스토어·쿠팡 요약이 읽는
     모양으로 옮겨 적기만 한다. 라벨과 사유는 서버 문장 그대로다.
     ────────────────────────────────────────────────────────────────────── */

  /** 서버 검증 한 줄 = 요약의 필수항목 한 줄. 롯데ON 검증에는 선택 항목이 없다. */
  const readinessItems: ReadinessItem[] = useMemo(
    () =>
      (validation?.fields ?? []).map((field) => ({
        label: field.label,
        passed: field.status === "READY",
        required: true,
        hint: field.reason,
        /* REWORK-11 — 통과한 필드도 자리를 안다(예전에는 missingInfo에서만
           찾아서 READY 필드의 sectionId가 늘 undefined였다). 섹션 머리의 상태
           배지가 "이 자리는 다 찼다"를 말하려면 통과한 것도 세어야 한다. */
        sectionId: lotteOnFieldSectionId(field.field),
      })),
    [validation],
  );

  /**
   * REWORK-11 ①(CEO 지시) — 섹션 머리의 상태 배지. **스마트스토어·쿠팡의
   * sectionCompletionBadge와 같은 규칙 · 같은 컴포넌트(StatusBadge)다.**
   *
   * 🔴 판정을 새로 만들지 않는다 — 위 readinessItems(=서버 검증 결과)를 섹션
   * 별로 세기만 한다. 롯데ON 검증에는 선택 항목이 없으므로 "선택 입력 가능"
   * (🟡) 상태는 나오지 않는다.
   */
  function sectionCompletionBadge(sectionId: string) {
    const relevant = readinessItems.filter((item) => item.sectionId === sectionId);
    if (relevant.length === 0) return null;
    if (relevant.some((item) => !item.passed)) return <StatusBadge status="needsCheck" label="확인 필요" />;
    return <StatusBadge status="success" label="준비됨" />;
  }

  /** 부족정보 — "무엇을 어디서" 한 줄. 순서는 buildLotteOnMissingInfo가 정한 그대로다. */
  const priorityItems: PriorityItem[] = useMemo(
    () =>
      missingInfo.slice(0, 3).map((item) => ({
        key: item.key,
        label: item.label,
        detail: `${LOTTEON_FIX_LOCATION_LABEL[item.where]}에서 해결 — ${item.what}`,
        sectionId: item.where === "LOTTEON_TAB" ? item.sectionId : undefined,
        externalHref: item.where === "SETTINGS" ? "/settings" : undefined,
        sourceItems: [],
      })),
    [missingInfo],
  );

  /** 등록 상태 4단계 — 스마트스토어·쿠팡이 쓰는 그 함수 하나로 정한다. */
  const registrationState = resolveRegistrationReadinessState(
    {
      items: readinessItems,
      required: readinessItems,
      recommended: [],
      allRequiredPassed: !stale && readiness.allRequiredPassed,
      percent: readiness.percent,
    },
    commonPrice.resolved,
  );

  /** 등록 버튼의 문구를 정하는 축. 게이트는 canRegister 하나뿐이다. */
  const listingStatus: ListingStatus = registering
    ? "SUBMITTING"
    : registerResult?.result?.status === "SUBMITTED"
      ? "SUBMITTED"
      : registerResult?.result?.status === "FAILED"
        ? "FAILED"
        : canRegister
          ? "READY"
          : "DRAFT";

  const summary = (
    <ChannelRegistrationSummary
      state={registrationState}
      priorityItems={priorityItems}
      onPriorityItemClick={(item) => item.sectionId && goToSection(item.sectionId)}
      /* REWORK-4 §2 — 여기 있던 onResolveMissing(= 「부족한 정보 한 번에
         해결하기」)이 사라졌다. 롯데ON의 §8 부족한 정보 목록은 아래 본문에
         그대로 남아 있고(LOTTEON_MISSING_INFO_ID), 우선순위 첫 항목은 위
         배너가 무엇/왜/어디서/[바로 이동]까지 갖춰서 말한다. */
      /* REWORK-7 ②·④(CEO 지시, 2026-09-15) — 여기 있던 「등록 상태」(롯데ON 연결 ·
         직전 등록 결과)가 **좌측 상세 맨 아래로** 내려갔다. 스마트스토어·쿠팡은
         같은 성격의 사실(ListingSection — 연결/직전 등록 결과)을 처음부터 좌측
         맨 아래에 두고 있었다. 우측에만 한 채널이 칸을 하나 더 갖고 있으면
         "세 탭이 같은 등록 화면"은 렌더 결과에서 거짓이 된다. */
      required={readinessItems}
      allRequiredPassed={!stale && readiness.allRequiredPassed}
      /* ══ COMMERCE-UI-PARITY-02 P0-1(CEO 실측 캡처 + Production 로그, 2026-09-22) ══

         CEO가 본 화면: 우측 요약이 「필수 확인 / 확인 중…」에서 멈춰 있고 [등록
         시작]이 비활성. Production 로그가 그 20초의 정체를 말한다 —

             /api/lotteon/payload-preview → 207 identity
             NETWORK_ERROR · elapsedMs=20,177 · proxy=OCI · aborted due to timeout

         즉 «멈춘» 것이 아니라 20초를 기다렸다가 **실패**한 것이다. 그런데 그
         실패가 화면에 도착하지 못했다. 이 자리가 원래 `previewing && preview ==
         null` 을 직접 읽어 자기 문구(「확인 중…」)를 만들고 있었고, 20초 뒤
         `preview` 가 `{ok:false, reason:"NETWORK_ERROR"}` 로 채워지면
         `validation == null` 분기로 떨어져 **「아직 확인하지 않았습니다」** 라고
         말했다 — 20초를 기다려 실패한 일을 «해보지 않았다» 고 바꿔 말한 것이다.
         셀러는 [등록 정보 확인]을 눌러도 같은 20초 뒤 같은 문장을 본다.

         🔴 새 상태를 만들지 않았다. 공용 껍데기(ChannelRegistrationSummary →
         RegistrationReadinessCard)가 `isCalculating`(스피너 + 「확인 중…」)과
         `errorMessage`(「🔴 등록 가능 여부 확인 실패」 + 사유 + [다시 확인])를
         **이미** 갖고 있고, 스마트스토어·쿠팡은 둘 다 넘기고 있었다(PlatformPreview
         L727-729). 셋 중 롯데ON만 안 넘겼다. 배선 하나가 빠져 있었을 뿐이다.

         실패 사유는 서버가 만든 한국어 한 줄을 그대로 쓴다(classifyLotteOnNetworkError
         → "롯데ON 응답이 제한 시간 안에 오지 않았습니다."). 화면이 다시 쓰지 않는다. */
      isCalculating={previewing}
      errorMessage={preview != null && !preview.ok ? (preview.message ?? "등록 정보를 만들지 못했습니다.") : null}
      onRetry={() => void runValidation(form)}
      status={listingStatus}
      registrationEnabled
      onRegister={() => setConfirmOpen(true)}
      /* §17 — 카테고리 전에는 등록 가능성을 숫자로 말하지 않는다. 0%도 말하지
         않는다: 0%는 "다 모자라다"는 판정이고, 지금 참인 것은 "아직 판단할 수
         없다"이다. 표준카테고리가 전시카테고리·고시 품목코드·과세구분·요구
         안전인증을 함께 들고 오기 때문에(조사 §14-2), 고르는 순간 필수 항목의
         **목록 자체**가 바뀐다. */
      percentUnavailable={
        /* P0-1 — 「확인 중…」 분기가 여기서 빠졌다. 위 `isCalculating` 이 같은 일을
           스마트스토어·쿠팡과 **같은 모양**(스피너 + 무엇을 기다리는지 한 줄)으로
           한다. 남은 두 분기는 그대로다: 정말 한 번도 확인하지 않은 상태와,
           카테고리 전이라 필수 항목 목록 자체가 정해지지 않은 상태(§17). */
        validation == null ? (
          <p className="text-xs text-text-tertiary">아직 확인하지 않았습니다 — 아래 [등록 정보 확인]을 눌러 주세요.</p>
        ) : !categoryChosen ? (
          <div className="rounded-md bg-warning-soft px-2 py-2 text-xs text-warning">
            <p className="font-semibold">⚠ 등록 가능성 판단 제한 — 카테고리를 먼저 선택해주세요.</p>
            <p className="mt-1 text-[11px] text-text-secondary">
              롯데ON은 표준카테고리가 <b>전시카테고리 · 고시 품목코드 · 과세구분 · 요구 안전인증</b>을 함께
              결정합니다. 카테고리를 고르기 전에는 이 상품에 무엇이 요구되는지가 아직 정해지지 않아, 지금
              퍼센트를 보여주면 카테고리를 고른 뒤 숫자가 거꾸로 내려갑니다.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => goToSection("lotteon-section-category")}
            >
              ③ 카테고리 선택으로 이동
            </Button>
          </div>
        ) : null
      }
      /* CEO 프레임의 버튼 순서 — [부족정보 해결](배너) → [등록 정보 확인] →
         [채널 등록]. 등록 게이트는 그대로 canRegister 하나다. */
      verifyAction={
        <div className="space-y-1">
          <button
            type="button"
            disabled={previewing}
            onClick={() => void runValidation(form)}
            className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            {previewing ? "확인 중…" : "등록 정보 확인"}
          </button>
          {!canRegister && (
            <p className="text-[11px] text-text-tertiary">
              {/* REWORK-7 ④(CEO 지시, 2026-09-15) — 퍼센트가 아니라 **등록을 막는
                  조건**으로 말한다. 게이트 자체(canRegister)는 그대로다. */}
              {stale
                ? "입력이 바뀌었습니다 — 등록 정보 확인을 다시 통과해야 등록 버튼이 열립니다."
                : "위 필수 확인을 모두 통과하고 등록 정보 확인을 통과해야 등록 버튼이 열립니다."}
            </p>
          )}
        </div>
      }
    />
  );

  /*
   * REWORK-13B(CEO 실측 판정, 2026-09-15) — **섹션 머리의 한 줄 상태.**
   *
   * 쿠팡 ①②③의 머리에는 접혀 있어도 보이는 한 줄이 서 있다(「자동 입력 6개 ·
   * 확인 필요 1개」 / 카테고리 / 옵션). 롯데ON 머리에는 그 자리에 **정책 설명**이
   * 들어가 있어서, 같은 자리가 한쪽은 상태 한 줄 · 한쪽은 설명 세 줄이었다.
   * 설명은 본문 안내 문단으로 내려갔고(FormSection), 이 자리에는 쿠팡과 **같은
   * 성격 · 같은 문장 형식**의 한 줄이 선다.
   *
   * 🔴 판정을 새로 만들지 않는다 — 셋 다 이 화면이 **이미 읽고 있던 값**이다:
   *   ① summarizeCommonProduct()의 `missing` 플래그(아래 경고 문단이 쓰는 그것)
   *   ② CategoryRecommendation에 넘기는 subtitle과 같은 selectedCategory
   *   ③ LotteOnOptionDetail이 그리는 product.optionGroups 그대로
   */
  const basicRows = rowsOf("상품명", "브랜드", "상품코드(SKU)", "소재", "색상", "사용연령", "품명", "모델명");
  const basicNeedsCheck = basicRows.filter((row) => row.missing).length;
  const basicInfoSummary = `자동 입력 ${basicRows.length - basicNeedsCheck}개 · 확인 필요 ${basicNeedsCheck}개`;
  const categorySummary = selectedCategory
    ? selectedCategory.name
    : "미지정 — 추천 후보에서 선택해주세요.";
  const optionGroupCount = product.optionGroups?.length ?? 0;
  const optionValueCount = product.optionGroups?.reduce((sum, group) => sum + group.values.length, 0) ?? 0;
  const optionSummary =
    optionGroupCount > 0
      ? `자동 추출 — 옵션그룹 ${optionGroupCount}개 · 값 ${optionValueCount}개`
      : "옵션 없음 — 단일 상품으로 등록됩니다";

  const detail = (
    <div className="space-y-4">
      {/* ── REWORK-10 C(CEO 지시, 2026-09-15) — 여기 있던 롯데ON 전용 블록 셋이
          사라졌다. 스마트스토어·쿠팡 좌측 상세는 10섹션 골격으로 **바로 시작**
          하는데, 롯데ON만 그 앞에 자기 블록 셋을 더 갖고 있었다:

            · 「등록을 막고 있는 필수 조건 N개」  (BlockingConditionList)
            · 「⚠ 롯데ON 등록에 N개 정보가 부족합니다」 (§8 missingInfo)
            · 「이 탭에서 정하는 것」 안내 박스

          🔴 정보를 지운 것이 아니다 — 세 가지가 전부 다른 자리에 이미 있다:
            · 등록 판정 · 남은 항목 · 무엇/왜/어디서/[이동]
              → 우측 등록 요약(ChannelRegistrationSummary — 세 채널 공용)
            · 필드별 차단 사유 전체
              → 아래 ⑩ 등록정보의 「필드별 확인 결과」(서버 문장 그대로)
            · 공통값을 여기서 다시 입력하지 않는다는 사실
              → 아래 각 읽기 전용 섹션의 설명 한 줄

          남겨 두면 셀러는 같은 목록을 세 번 읽게 되고, 무엇보다 **롯데ON 탭만
          다른 화면**이 된다. */}

      {/* ── 좌측 등록 상세 — 10섹션 골격(registration-sections.ts) ──────────
          REWORK-4 §5(CEO 지시, 2026-09-14). 여기 있던 순서는 롯데ON만의 것이었다
          (상품정보 → 셀러설정 → 카테고리 → 고시 → 안전인증 → 배송 → 코드, 6/10).
          이제 세 채널이 같은 목차를 쓴다: ① 기본 상품정보 ② 카테고리 ③ 옵션
          ④ 가격 ⑤ 배송 ⑥ 배송정책·반품/교환 ⑦ 고시정보 ⑧ KC/인증 ⑨ 상세설명
          ⑩ 등록정보 + 채널 고유 항목.

          🔴 없던 4개(③④⑨⑩)는 **읽기 전용 요약**으로 붙인다. 전부 공통값이라
          이 탭에서 입력칸을 만들면 같은 값이 두 곳에 생긴다(three-layer-realign
          .test.ts 증명 1이 그 금지를 렌더 결과로 지킨다). 값은 새로 계산하지
          않는다 — ① 이 이미 읽던 summarizeCommonProduct()의 같은 행들을 골라
          제자리에 놓을 뿐이다. */}

      {/* REWORK-13B — 카드 사이 간격을 쿠팡과 같은 한 곳에서 받는다
          (registration-sections.ts `SECTION_STACK_CLASS`). 직전까지 롯데ON은
          이 기둥이 없어 바깥 `space-y-4`가 그대로 카드 간격이 됐고, 쿠팡
          (`space-y-3`)보다 카드마다 4px씩 벌어져 있었다 — 카드 열한 개면
          목록 전체 길이가 눈에 띄게 달라진다. */}
      <div className={SECTION_STACK_CLASS}>
      {/* ── ① 기본 상품정보 — 읽기 전용(공통값) ──────────────────────────── */}
      <CommonInfoSection
        title={sectionTitle("BASIC")}
        description="상품정보에 저장된 값을 그대로 씁니다 — 이 탭에서 다시 입력하지 않습니다. 고치면 스마트스토어·쿠팡에도 함께 반영됩니다."
        /* REWORK-12 ②(CEO 실측 캡처, 2026-09-15) — 쿠팡 ①과 **같은 아홉 칸**이다
           (상품명 · 브랜드 · SKU · 제조사 · 소재 · 색상 · 사용연령 · 품명 ·
           모델명). 제조사는 아래 children의 ManufacturerField가 그린다 — 세 탭
           공용 컴포넌트라 그 한 칸만 순서가 다르게 설 수 없다.
           🔴 입력칸은 여전히 0개다(ReadOnlyFieldRow). */
        summary={basicInfoSummary}
        rows={basicRows}
        onEditCommonInfo={onEditCommonInfo}
        badge={sectionCompletionBadge("lotteon-section-basic")}
        {...sectionProps("lotteon-section-basic")}
      >
        {/* REWORK-10 A(CEO 지시, 2026-09-15) — **제조사는 전 채널 공통이다.**
            REWORK-11 ② — 여기 있던 전용 `<dl>` 한 줄 + 별도 안내 문단이
            스마트스토어·쿠팡과 **완전히 같은 컴포넌트**(ManufacturerField)로
            바뀌었다. 읽기 전용으로 부르면(onCommit 없음) 입력칸 대신 같은 틀의
            읽기 칸이 서고, 라벨·배지·한 줄 안내·ⓘ는 세 탭에서 글자 그대로 같다. */}
        <ManufacturerField field={product.manufacturer} resolution={manufacturerResolution} />
      </CommonInfoSection>

      {/* ── ③ 카테고리 — 표준 + 전시 2중 · 추천 ──────────────────────────── */}
      <FormSection
        badge={sectionCompletionBadge("lotteon-section-category")}
        {...sectionProps("lotteon-section-category")}
        title={sectionTitle("CATEGORY")}
        summary={categorySummary}
        description="롯데ON은 표준카테고리 1개와 전시카테고리 1개 이상을 함께 요구합니다. 여기서 고른 값은 롯데ON에만 적용되고, 스마트스토어·쿠팡 카테고리를 덮어쓰지 않습니다."
        action={
          <Button variant="secondary" size="sm" disabled={recommend.loading} onClick={() => void runRecommend()}>
            {recommend.loading ? "확인 중…" : "다시 확인"}
          </Button>
        }
      >
        <CategoryRecommendation
          state={recommend}
          pickedId={form.category.standardCategoryNo}
          /* 스마트스토어·쿠팡 패널의 "선택됨: A > B > C"와 같은 자리·같은 말. */
          subtitle={
            selectedCategory
              ? `선택됨: ${selectedCategory.name}`
              : "추천 후보에서 롯데ON 표준카테고리를 선택하세요."
          }
          onPick={applyRecommendation}
        />

        {/* REWORK-6 ②(CEO 판정, 2026-09-14) — **추천 실패가 등록 불가가 되지
            않는다.** 추천이 후보를 내지 못하면 지금까지 남는 안내는 "상품정보를
            채우고 다시 추천"뿐이었다 — 셀러가 상품정보를 더 채울 수 없는 상품
            (원문에 연령/유형 신호가 없는 상품)에서는 그대로 막다른 길이었다.

            🔴 되살리지 않는 것: scatNo/dcatLst **번호 직접 입력**. 아래
            CategoryDirectPicker에는 입력칸이 하나도 없다 — 롯데ON이 돌려준
            목록을 위에서부터 눌러 내려가 고르는 것뿐이고, 고르면 추천에서
            고른 것과 **완전히 같은 경로**(applyCategory)를 탄다. */}
        {isRecommendDeadEnd(recommend) && !directPickOpen && (
          <div className="mb-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5">
            <p className="text-[11px] font-medium text-warning">카테고리를 자동 추천하지 못했습니다.</p>
            <p className="mt-1 text-[11px] text-text-secondary">
              롯데ON 카테고리를 직접 선택해주세요 — 롯데ON이 제공하는 표준카테고리 목록에서 고르면 됩니다. 번호를
              찾아 적지 않습니다.
            </p>
            <Button variant="primary" size="sm" className="mt-2" onClick={() => setDirectPickOpen(true)}>
              롯데ON 카테고리 선택
            </Button>
          </div>
        )}

        {directPickOpen && (
          <CategoryDirectPicker onPick={applyCategory} onClose={() => setDirectPickOpen(false)} />
        )}

        {commonCategorySources.length > 0 ? (
          <div className="mb-3 rounded-md bg-background px-3 py-2 text-[11px] text-text-secondary">
            <p className="font-medium text-text-tertiary">참고 — 이 상품의 공통 분류</p>
            <ul className="mt-1 space-y-0.5">
              {commonCategorySources.map((source) => (
                <li key={`${source.origin}-${source.path.join("/")}`}>
                  {source.path.join(" › ")} <span className="text-text-tertiary">· {source.origin}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mb-3 text-[11px] text-text-tertiary">
            이 상품에는 아직 참고할 공통 분류가 없습니다(원본 사이트 분류도, 확정된 채널 카테고리도 없습니다).
          </p>
        )}

        {/* REWORK-5 ③(CEO 실측 판정: FAIL — "다시 조회 → 번호 찾아서 입력") ───
            여기 있던 것들이 **폐기됐다**:
              · 표준카테고리번호(scatNo) 직접 입력칸
              · 전시카테고리번호(dcatLst) 쉼표 입력칸
              · [표준카테고리 직접 찾기] · [전시카테고리 직접 찾기] 조회 목록

            왜 지우는가 — 셀러는 롯데ON 표준 분류 번호를 알 방법이 없다. 조회를
            눌러 목록에서 번호를 찾아 옮겨 적는 것은 "카테고리를 고르는 일"이
            아니라 **우리가 해야 할 대조 작업을 셀러에게 떠넘긴 것**이었다.
            게다가 번호를 손으로 넣으면 그 번호가 요구하는 전시카테고리 · 고시
            품목코드 · 과세구분 · 안전인증 유형을 우리가 들은 적이 없어서
            (setLotteOnStandardCategoryNo가 selected를 버린다) 셀러는 그 넷을
            또 따로 채워야 했다.

            남는 길은 하나다 — 위 [카테고리 추천] → 후보 → [선택]. 스마트스토어·
            쿠팡이 쓰는 추천→선택과 같은 모양이고, 선택 한 번이 다섯 값을 함께
            채운다(applyLotteOnRecommendedCategory).

            🔴 카테고리는 여전히 채널별 독립이다 — 이 선택은 롯데ON 폼에만
            들어가고 공통 categoryMappings를 건드리지 않는다. */}
        <PickedCategorySummary
          form={form}
          selected={selectedCategory}
          displayCategoryText={displayCategoryText}
        />
      </FormSection>

      {/* ── ③ 옵션 — 읽기 전용(공통값) ──────────────────────────────────── */}
      <CommonInfoSection
        badge={sectionCompletionBadge("lotteon-section-options")}
        {...sectionProps("lotteon-section-options")}
        title={sectionTitle("OPTIONS")}
        summary={optionSummary}
        description="옵션과 재고는 상품정보의 값을 그대로 씁니다 — 롯데ON에서 조합을 따로 만들지 않습니다."
        rows={rowsOf("옵션", "재고")}
        onEditCommonInfo={onEditCommonInfo}
      >
        {/* REWORK-12 ②(CEO 실측 캡처, 2026-09-15) — 이 섹션에 있던 글자는
            「1개 옵션 · 단품 6건」 한 줄이 전부였다. 쿠팡 ③은 같은 자리에서
            **무엇이 등록되는지**(축 이름 · 값 · 단품)를 보여준다.
            🔴 입력칸을 만들지 않는다 — 읽기 전용 목록이고, 값은 상품정보의
            product.optionGroups / product.variants 그대로다(새로 계산 0). */}
        <LotteOnOptionDetail product={product} />
      </CommonInfoSection>

      {/* ── ④ 가격 — 읽기 전용(공통값) ──────────────────────────────────── */}
      <CommonInfoSection
        badge={sectionCompletionBadge("lotteon-section-price")}
        {...sectionProps("lotteon-section-price")}
        title={sectionTitle("PRICE")}
        description="판매가격은 상품정보의 가격 계산 결과 하나뿐입니다 — 채널마다 다시 정하지 않습니다."
        rows={rowsOf("판매가격")}
        onEditCommonInfo={onEditCommonInfo}
      />

      {/* ── ⑥ 배송 ──────────────────────────────────────────────────────── */}
      <FormSection
        badge={sectionCompletionBadge("lotteon-section-delivery")}
        {...sectionProps("lotteon-section-delivery")}
        title={sectionTitle("SHIPPING")}
        description="출고지 · 반품지 · 배송비 정책은 롯데ON 판매자센터에 먼저 등록해야 생기는 번호입니다. 우리가 만들 수 없습니다."
      >
        {/*
          REWORK(2026-09-14) — 여기 있는 칸들이 "왜 셀러 설정에서 자동으로 오지
          않는가"를 화면에 적는다. 위 ② 셀러 설정 정보가 같은 판정(코드체계가
          다름 / 개념 자체가 없음)을 이미 보여주고 있고, 두 섹션이 다른 말을
          하지 않도록 문장의 출처를 한 함수로 묶어 두었다.
        */}
        {/* REWORK-11 ④(CEO 지시, 2026-09-15) — 여기 있던 「셀러 설정에서 자동으로
            채울 수 없습니다」 4줄 안내가 사라졌다. **사실이 아니게 됐기 때문이다** —
            이제 롯데ON 판매자센터에 직접 물어본다(150 · 166 · 89). 조회 상태와
            결과는 바로 아래 한 줄이 말한다. */}
        <DeliveryLookupNote state={deliverySettings} />
        <div className={FIELD_GRID_CLASS}>
          {/* REWORK-14 — 목록에서 고르는 컨트롤이 도움말 줄(`note`) 밖으로 나왔다.
              전에는 조회가 성공하면 회색 안내 문장 자리에 전폭 `select`와 버튼 칩이
              서서, 쿠팡에는 없는 「도움말 줄이 입력칸이 되는」 모양이 됐다. 이제
              도움말은 언제나 글자 한 줄이고, 고르는 컨트롤은 쿠팡이 「상세페이지
              참조로 등록」 버튼을 두는 자리(입력칸 바로 아래)에 선다. */}
          <ChannelCodeField
            label="출고지번호"
            code="owhpNo"
            requirement={requirementOf("owhpNo")}
            note="롯데ON에 선등록된 출고지"
            belowInput={
              <>
                {/* ① — 비어 있어도 판매자 설정이 채운다는 사실을 그 자리에서 말한다. */}
                <SellerSettingApplied
                  value={form.delivery.outboundPlaceNo.trim() ? null : sellerFixed?.outboundPlaceNo}
                  label={sellerFixed?.outboundPlaceLabel}
                />
                <DeliveryOptionPicker
                  options={deliverySettings.data?.outboundPlaces ?? []}
                  current={form.delivery.outboundPlaceNo}
                  onPick={(value) => patch("delivery", { outboundPlaceNo: value })}
                />
              </>
            }
            value={form.delivery.outboundPlaceNo}
            onChange={(value) => patch("delivery", { outboundPlaceNo: value })}
          />
          <ChannelCodeField
            label="반품지번호"
            code="rtrpNo"
            requirement={requirementOf("rtrpNo")}
            note="롯데ON에 선등록된 회수지"
            belowInput={
              <>
                <SellerSettingApplied
                  value={form.delivery.returnPlaceNo.trim() ? null : sellerFixed?.returnPlaceNo}
                  label={sellerFixed?.returnPlaceLabel}
                />
                <DeliveryOptionPicker
                  options={deliverySettings.data?.returnPlaces ?? []}
                  current={form.delivery.returnPlaceNo}
                  onPick={(value) => patch("delivery", { returnPlaceNo: value })}
                />
              </>
            }
            value={form.delivery.returnPlaceNo}
            onChange={(value) => patch("delivery", { returnPlaceNo: value })}
          />
          <ChannelCodeField
            label="배송비정책번호"
            code="dvCstPolNo"
            requirement={requirementOf("dvCstPolNo")}
            note="롯데ON에 선등록된 배송비 정책"
            belowInput={
              <>
                <SellerSettingApplied
                  value={form.delivery.deliveryCostPolicyNo.trim() ? null : sellerFixed?.deliveryCostPolicyNo}
                  label={sellerFixed?.deliveryCostPolicyLabel}
                />
                <DeliveryOptionPicker
                  options={(deliverySettings.data?.costPolicies ?? []).map((policy) => ({ ...policy, isDefault: false }))}
                  current={form.delivery.deliveryCostPolicyNo}
                  onPick={(value) => patch("delivery", { deliveryCostPolicyNo: value })}
                />
              </>
            }
            value={form.delivery.deliveryCostPolicyNo}
            onChange={(value) => patch("delivery", { deliveryCostPolicyNo: value })}
          />
          <ChannelCodeField
            label="배송가능지역코드"
            code="dvRgsprGrpCd"
            requirement={requirementOf("dvRgsprGrpCd")}
            note="공통코드 DV_RGSPR_GRP_CD"
            belowInput={
              <>
                <SellerSettingApplied
                  value={form.delivery.deliveryRegionGroupCode.trim() ? null : sellerFixed?.deliveryRegionGroupCode}
                  label={sellerFixed?.deliveryRegionGroupLabel}
                />
                <CodeOptionPicker
                  options={deliverySettings.data?.deliveryRegionGroups ?? []}
                  current={form.delivery.deliveryRegionGroupCode}
                  onPick={(value) => patch("delivery", { deliveryRegionGroupCode: value })}
                />
              </>
            }
            value={form.delivery.deliveryRegionGroupCode}
            onChange={(value) => patch("delivery", { deliveryRegionGroupCode: value })}
          />
          <ChannelCodeField
            label="택배사코드"
            code="hdcCd"
            requirement={requirementOf("hdcCd")}
            note="공통코드 DV_CO_CD (예: 0001 롯데택배)"
            belowInput={
              <CodeOptionPicker
                options={deliverySettings.data?.couriers ?? []}
                current={form.delivery.courierCode}
                onPick={(value) => patch("delivery", { courierCode: value })}
              />
            }
            value={form.delivery.courierCode}
            onChange={(value) => patch("delivery", { courierCode: value })}
          />
          <ChannelCodeField
            label="반품택배사코드"
            code="rtngHdcCd"
            requirement={requirementOf("rtngHdcCd")}
            note="공통코드 DV_CO_CD"
            belowInput={
              <CodeOptionPicker
                options={deliverySettings.data?.couriers ?? []}
                current={form.delivery.returnCourierCode}
                onPick={(value) => patch("delivery", { returnCourierCode: value })}
              />
            }
            value={form.delivery.returnCourierCode}
            onChange={(value) => patch("delivery", { returnCourierCode: value })}
          />
          <ChannelCodeField
            label="평일 발송마감시간"
            code="nldySndCloseTm"
            requirement={requirementOf("nldySndCloseTm")}
            note="HHMM · 분은 00 또는 30만"
            value={form.delivery.weekdayCloseTime}
            onChange={(value) => patch("delivery", { weekdayCloseTime: value })}
          />
        </div>
      </FormSection>

      {/* ── ② 셀러 설정 정보 — 읽기 전용 ─────────────────────────────────── */}
      {/*
        REWORK 커머스 탭 구조 통일(CEO 지시, 2026-09-14).

        이 섹션이 없던 동안 롯데ON 탭은 출고지·반품지·택배사를 "그냥 모르는 값"
        으로 취급해 셀러에게 손으로 치게 했다. 셀러 설정에 이미 같은 개념이
        있는지 없는지를 화면이 말한 적이 한 번도 없었다.

        🔴 여기는 **입력칸을 만들지 않는다.** 셀러 설정을 고치는 곳은 설정 화면
        하나뿐이어야 값이 두 벌로 갈라지지 않는다(스마트스토어·쿠팡의
        settingsMissing이 /settings로 보내는 것과 같은 원칙이다).
      */}
      <FormSection
        badge={sectionCompletionBadge("lotteon-section-seller-settings")}
        {...sectionProps("lotteon-section-seller-settings")}
        title={sectionTitle("SHIPPING_POLICY")}
        description="비즈니스 설정 — Settings에서 한 번만 하면 됩니다. 스마트스토어·쿠팡의 「배송 정책 · 반품/교환」과 같은 배송 프로필을 읽습니다. 이 탭에서는 고칠 수 없습니다."
        action={
          <a
            href="/settings"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            설정하러 가기
          </a>
        }
      >
        {sellerSettings == null && (
          <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-[11px] text-warning">
            셀러 설정(배송 프로필)을 아직 불러오지 못했습니다 — 셀러 설정에서 먼저 등록해주세요. 설정 → 배송 프로필에서 한
            번 채워두면 이후 모든 상품에 자동 적용됩니다.
          </p>
        )}
        <dl className="divide-y divide-border text-xs">
          {sellerSettingRows.map((row) => (
            <SellerSettingRow key={row.label} row={row} />
          ))}
        </dl>
      </FormSection>

      <FormSection
        badge={sectionCompletionBadge("lotteon-section-notice")}
        {...sectionProps("lotteon-section-notice")}
        title={sectionTitle("NOTICE")}
        description="품목코드는 표준카테고리를 고르면 함께 따라옵니다. 항목코드는 롯데ON 고유 코드체계라 품목마다 달라 자동으로 만들지 않습니다."
      >
        {selectedCategory && selectedCategory.noticeItemCodes.length > 0 && (
          <p className="mb-3 rounded-md bg-success/5 px-3 py-2 text-[11px] text-text-secondary">
            선택한 표준카테고리({selectedCategory.name})가 알려준 고시 품목코드:{" "}
            {selectedCategory.noticeItemCodes.join(", ")}
          </p>
        )}
        <div className={FIELD_GRID_NARROW_CLASS}>
          <ChannelCodeField
            label="상품품목코드"
            code="pdItmsCd"
            requirement={requirementOf("pdItmsCd")}
            note={`고시 품목. ${LOTTEON_CHILD_PRODUCT_ITEM_CODE} = 어린이제품(유아동) — 이 경우 ④ 안전인증이 필수입니다.`}
            /* ══ LOTTEON-REAL-REGISTRATION-05(CEO 확정, 2026-09-22) ══
               셀러가 번호를 «찾아 적던» 자리다. 그래서 아무도 등록할 수 없었다.
               이제 롯데ON 이 준 40건에서 「어린이제품」을 고른다.

               🔴 값을 만들지 않는다 — 보여주는 것은 cdNm, payload 로 가는 것은
               롯데ON 이 준 cd 그대로다. 매핑도 번역도 하지 않는다.
               🔴 조회가 실패하면 «목록 없음» 인 척하지 않는다. 직접 입력 칸은
               그대로 살아 있으니 셀러가 막히지는 않는다. */
            belowInput={
              <CommonCodePicker
                list={noticeItemCodeList}
                current={form.notice.itemCode}
                onPick={(value) => patch("notice", { itemCode: value })}
              />
            }
            value={form.notice.itemCode}
            onChange={(value) => patch("notice", { itemCode: value })}
          />
          <ChannelCodeTextArea
            label="고시 항목"
            code="pdItmsArtlLst"
            requirement={requirementOf("pdItmsArtlLst")}
            /* REWORK-10 E(CEO 지시, 2026-09-15) — **조회 API가 없는 것은 없는 그대로
               적는다.** 항목코드(pdArtlCd)는 롯데ON이 목록을 내려주는 API가 없다
               (직전 조사 확정). 우리가 만들어 채우면 등록이 거절되거나 엉뚱한
               고시가 올라간다 — 자동 생성하지 않고 그 사실을 셀러에게 말한다. */
            note="한 줄에 하나씩 `항목코드:내용`. 🔴 항목코드는 롯데ON에 조회 API가 없습니다 — 판매자센터 고시 화면의 코드를 그대로 옮겨 적어주세요(임의로 만들지 않습니다)."
            placeholder={"0020:색상\n0060:제조국"}
            value={form.notice.articlesText}
            onChange={(value) => patch("notice", { articlesText: value })}
          />
        </div>
        {/* 🔴 이 목록은 **입력칸이 아니다.** 상품정보에 이미 있는 값을 읽어서
            보여주기만 한다 — 셀러가 소재/색상/제조사를 세 번째로 다시 치지
            않게 하는 것이 목적이다(스마트스토어는 이 값들로 고시를 자동
            생성한다). 항목코드 체계는 품목마다 달라 여기서 만들지 않는다. */}
        {noticeSources.length > 0 && (
          <div className="mt-3 rounded-md bg-background px-3 py-2 text-[11px] text-text-secondary">
            <p className="font-medium text-text-tertiary">
              고시 내용으로 그대로 쓸 수 있는 값 — 상품정보에 이미 있습니다(다시 입력하지 마세요)
            </p>
            <ul className="mt-1 space-y-0.5">
              {noticeSources.map((row) => (
                <li key={row.label}>
                  <span className="text-text-tertiary">{row.label}</span> — {row.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </FormSection>

      {/* ── ⑤ 인증 ──────────────────────────────────────────────────────── */}
      <FormSection
        badge={sectionCompletionBadge("lotteon-section-certification")}
        {...sectionProps("lotteon-section-certification")}
        title={sectionTitle("KC")}
        description="인증번호는 실제 취득한 값만 사용할 수 있습니다 — 어떤 경우에도 자동 생성하지 않습니다."
      >
        {selectedCategory && selectedCategory.safetyTypeCodes.length > 0 && (
          <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-[11px] text-warning">
            선택한 표준카테고리가 요구하는 안전인증 유형:{" "}
            {selectedCategory.safetyTypeCodes
              .map((code) => `${code}(${LOTTEON_SAFETY_TYPE_LABEL[code] ?? "유형 미상"})`)
              .join(" · ")}
          </p>
        )}
        {safetyRequired && (
          <p
            className={`mb-3 rounded-md px-3 py-2 text-[11px] ${
              safetyMissing ? "bg-error/5 text-error" : "bg-success/5 text-text-secondary"
            }`}
          >
            품목코드 {LOTTEON_CHILD_PRODUCT_ITEM_CODE}(어린이제품)이 선택되어 있습니다 —{" "}
            {safetyMissing ? "안전인증을 입력해야 등록할 수 있습니다." : "안전인증이 입력되어 있습니다."}
          </p>
        )}
        {commonSafetyLine && !form.certification.safetyText.trim() && (
          <div className="mb-3 rounded-md bg-background px-3 py-2 text-[11px] text-text-secondary">
            <p>
              상품정보에 어린이제품 인증이 이미 입력돼 있습니다 — 다시 치지 말고 그대로 가져오세요.
              <span className="ml-1 font-mono text-text-primary">{commonSafetyLine}</span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1"
              onClick={() => patch("certification", { safetyText: commonSafetyLine })}
            >
              상품정보의 인증정보 가져오기
            </Button>
          </div>
        )}
        <div className={FIELD_GRID_NARROW_CLASS}>
          <ChannelCodeTextArea
            label="안전인증 목록"
            code="sftyAthnLst"
            requirement={requirementOf("sftyAthnLst")}
            note="한 줄에 하나씩 `유형코드:인증번호[:기관명]`"
            placeholder={"CHL_CFM:CB123456789"}
            value={form.certification.safetyText}
            onChange={(value) => patch("certification", { safetyText: value })}
          />
          <ChannelCodeField
            label="수입대행코드"
            code="impPrxCd"
            requirement={requirementOf("impPrxCd")}
            note="전기용품·생활용품 계열 KC 인증을 넣으면 필수 — PUR_PRX / PRL_IMP / NONE. 어린이제품(CHL_*)에는 필요 없습니다."
            value={form.certification.importProxyCode}
            onChange={(value) => patch("certification", { importProxyCode: value })}
          />
        </div>
      </FormSection>

      {/* ── ⑨ 상세설명 — 읽기 전용(공통값) ──────────────────────────────── */}
      <CommonInfoSection
        badge={sectionCompletionBadge("lotteon-section-description")}
        {...sectionProps("lotteon-section-description")}
        title={sectionTitle("DESCRIPTION")}
        description="대표이미지와 상세페이지는 상품정보 + 셀러 공통 상세블록에서 조립됩니다 — 스마트스토어·쿠팡과 같은 조립 경로입니다."
        rows={rowsOf("대표이미지", "상세페이지")}
        onEditCommonInfo={onEditCommonInfo}
      />

      {/* ── ⑩ 등록정보 — 읽기 전용(실제 전송 데이터) ────────────────────── */}
      <FormSection
        badge={sectionCompletionBadge("lotteon-section-payload")}
        {...sectionProps("lotteon-section-payload")}
        title={sectionTitle("LISTING_INFO")}
        description="이 화면의 값으로 실제 롯데ON에 나갈 데이터입니다. 여기서 고치지 않습니다 — 위 섹션을 고치면 이 내용이 따라옵니다."
      >
        {/* REWORK-10 C-2 — 좌측 맨 아래의 「등록 상태」 카드에서 내려온 한 줄.
            채널 인증키·서버 IP가 통했는가는 **롯데ON 고유 사실**이라 지우지
            않고, 다른 두 탭에 없는 별도 카드가 아니라 ⑩ 등록정보 안에 둔다
            (쿠팡이 같은 섹션에서 payload를, 스마트스토어가 고급 검증 정보를
            보여주는 자리와 같다). */}
        <ul className="mb-3 space-y-1.5 text-xs">
          <StatusRow
            label="롯데ON 연결"
            tone={preview == null ? "muted" : connectionOk ? "ok" : "warn"}
            value={
              preview == null
                ? "아직 확인하지 않았습니다 — 우측 [등록 정보 확인]을 눌러 주세요."
                : connectionOk
                  ? "인증키 · 서버 IP 확인됨 (거래처 조회 성공)"
                  : (preview.identityError ?? "거래처 정보를 확인하지 못했습니다.")
            }
          />
        </ul>

        {validation && (
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            {/* REWORK-7 ⑤(CEO 지시, 2026-09-15) — 여기 있던 판정 한 줄
                ("등록 정보 확인 — 준비 N · 누락 N · 차단 N")이 사라졌다.
                등록 가능 여부를 말하는 자리는 우측 요약 하나다 — 같은 판정이
                두 곳에 서면 둘이 어긋나는 순간 어느 쪽이 참인지 알 수 없다
                (CP001류). 아래 필드별 사유는 **상세**라 좌측에 남는다. */}
            <p className="mb-2 text-sm font-semibold text-text-primary">필드별 확인 결과</p>
            <ul className="space-y-1 text-xs">
              {validation.fields.map((field) => (
                <li key={field.field} className="flex gap-2">
                  <span
                    className={
                      field.status === "READY" ? "text-success" : field.status === "BLOCKED" ? "text-error" : "text-warning"
                    }
                  >
                    {field.status === "READY" ? "●" : field.status === "BLOCKED" ? "■" : "▲"}
                  </span>
                  <span className="text-text-secondary">
                    <b className="text-text-primary">{field.label}</b>
                    {field.reason ? ` — ${field.reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {preview?.payload != null && (
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-xs text-text-tertiary">
              실제로 롯데ON에 전송될 데이터입니다 — 등록 버튼을 누르기 전에도 항상 최신 상태로 계산되어 있습니다.
            </p>
            <button
              type="button"
              onClick={() => setShowPayload((prev) => !prev)}
              className="mt-1 text-xs font-medium text-text-secondary underline decoration-border hover:text-text-primary"
            >
              {showPayload ? "전송 데이터 원문 닫기" : "▶ 전송 데이터 원문 보기 (LotteON 87 Request)"}
            </button>
            {showPayload && (
              <pre className="mt-2 max-h-[420px] overflow-auto rounded bg-background p-3 text-[11px] text-text-secondary">
                {JSON.stringify(preview.payload, null, 2)}
              </pre>
            )}
          </div>
        )}
        {validation == null && preview?.payload == null && (
          <p className="text-xs text-text-tertiary">
            아직 계산된 전송 데이터가 없습니다 — 우측 등록 요약의 [등록 정보 확인]을 누르면 여기에 나타납니다.
          </p>
        )}
      </FormSection>

      {/* ── 공통 ①~⑩ 뒤에 붙는 롯데ON 고유 영역 ────────────────────────────
          REWORK-13B(CEO 지시, 2026-09-15): "롯데ON 고유 데이터는 ⑩ 이후 별도
          영역으로 붙인다 — ⑪ 롯데ON 고유 관리정보 · ⑫ 롯데ON 고유 코드 …".

          🔴 "롯데ON이라서 별도 화면"이 아니라 **같은 등록 화면 + 롯데ON 전용
          영역**이다. 그래서 아래 섹션은 위 ①~⑩과 같은 카드 · 같은 머리 · 같은
          격자를 쓰고, 다른 것은 번호가 ⑪부터 시작한다는 사실 하나뿐이다.
          직전까지 이 자리의 제목에는 번호가 없어서("그 밖의 롯데ON 코드"),
          공통 골격이 어디서 끝나고 고유 영역이 어디서 시작하는지가 화면의
          번호로 읽히지 않았다. */}
      <GroupHeading
        title="롯데ON 고유 영역"
        description="롯데ON 코드체계를 따르는 값입니다 — 상품정보의 텍스트나 셀러 설정에서 코드를 정할 수 없습니다."
      />

      <FormSection
        badge={sectionCompletionBadge("lotteon-section-codes")}
        {...sectionProps("lotteon-section-codes")}
        title={channelSectionTitle(0, "롯데ON 고유 코드")}
        description="원산지·과세·브랜드는 롯데ON 코드체계를 따릅니다 — 상품정보의 원산지 텍스트로는 코드를 정할 수 없습니다."
      >
        {product.countryOfOrigin.value.trim() && (
          <p className="mb-3 text-[11px] text-text-tertiary">
            참고 — 상품정보의 원산지: <b className="text-text-secondary">{product.countryOfOrigin.value}</b>. 이 텍스트로
            롯데ON 코드를 정할 수 없어서 코드는 따로 고릅니다(추론하지 않습니다).
          </p>
        )}
        <div className={FIELD_GRID_CLASS}>
          <ChannelCodeField
            label="원산지코드"
            code="oplcCd"
            requirement={requirementOf("oplcCd")}
            /* 🔴 힌트 문구를 바꿨다. 예전에는 「공통코드 OPLC_CD」였고, 셀러가
               그것을 «넣어야 할 값» 으로 읽고 그대로 타이핑했다 — 첫 LIVE 등록이
               그 한 줄로 거절됐다("oplcCd":"OPLC_CD"). 코드 이름을 화면에 두면
               언젠가 누군가 그것을 적는다. */
            note="롯데ON이 정한 원산지 중에서 고릅니다."
            belowInput={
              <CommonCodePicker
                list={originCodeList}
                current={form.codes.originCode}
                onPick={(value) => patch("codes", { originCode: value })}
              />
            }
            value={form.codes.originCode}
            onChange={(value) => patch("codes", { originCode: value })}
          />
          <ChannelCodeField
            label="과세유형코드"
            code="tdfDvsCd"
            requirement={requirementOf("tdfDvsCd")}
            note="01 과세 · 02 면세 · 03 영세 · 04 해당없음. 표준카테고리를 고르면 그 카테고리 값으로 채워집니다."
            value={form.codes.taxTypeCode}
            onChange={(value) => patch("codes", { taxTypeCode: value })}
          />
          <ChannelCodeField
            label="브랜드번호"
            code="brdNo"
            requirement={requirementOf("brdNo")}
            note="속성모듈(204) 조회 결과. 없으면 비워둡니다"
            value={form.codes.brandNo}
            onChange={(value) => patch("codes", { brandNo: value })}
          />
          <ChannelCodeField
            label="업체상품번호"
            code="epdNo"
            requirement={requirementOf("epdNo")}
            note="우리 쪽 식별자. 등록 후 상품 상태 조회(93)에 씁니다"
            value={form.codes.externalProductNo}
            onChange={(value) => patch("codes", { externalProductNo: value })}
          />
        </div>
      </FormSection>

      {error && <div className="rounded-lg border border-error/40 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>}

      {preview?.identityError && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-xs text-text-secondary">
          거래처 정보(Identity) 조회 실패 — {preview.identityError}
        </div>
      )}

      {registerResult?.result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            registerResult.result.status === "SUBMITTED"
              ? "border-success/40 bg-success/5 text-text-secondary"
              : "border-error/40 bg-error/5 text-error"
          }`}
        >
          <p className="font-semibold text-text-primary">
            {registerResult.result.status === "SUBMITTED" ? "등록 요청 완료" : "등록 실패"}
          </p>
          <p className="mt-1">{registerResult.result.message}</p>
          {registerResult.result.externalProductId && (
            <p className="mt-1 font-mono text-xs">판매자상품번호(spdNo): {registerResult.result.externalProductId}</p>
          )}
          {registerResult.nextStep && <p className="mt-1 text-xs text-text-tertiary">{registerResult.nextStep}</p>}
          {registerResult.result.optionIdNote && (
            <p className="mt-1 text-[11px] text-text-tertiary">{registerResult.result.optionIdNote}</p>
          )}
        </div>
      )}

      {/* ── 직전 등록 결과 ────────────────────────────────────────────────
          REWORK-10 C-2(CEO 지시, 2026-09-15) — 스마트스토어·쿠팡의 ListingSection과
          **같은 게이트**로 맞춘다: 등록을 시도한 적이 없으면(DRAFT/READY) 이
          블록은 아예 서지 않는다(ListingSection.tsx L166 `return null`).

          예전에는 롯데ON만 이 자리에 「등록 상태」 카드를 항상 세우고 "아직 이
          화면에서 등록한 적이 없습니다"를 적었다 — 다른 두 탭에는 없는 칸이었다.
          채널 연결(인증키·서버 IP) 사실은 지우지 않았다: 그것은 롯데ON 고유
          사실이라 ⑩ 등록정보 안으로 들어갔다. */}
      {registerResult?.result && (
        <section className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-[11px] font-medium leading-4 text-text-tertiary">직전 등록 결과</p>
          <ul className="mt-1 space-y-1.5 text-xs">
            <StatusRow
              label="등록"
              tone={registerResult.result.status === "SUBMITTED" ? "ok" : "error"}
              value={
                registerResult.result.status === "SUBMITTED"
                  ? `등록 요청 완료 — 판매자상품번호(spdNo) ${registerResult.result.externalProductId ?? "미확인"}`
                  : `등록 실패 — ${registerResult.result.message}`
              }
            />
          </ul>
          {stale && (
            <p className="mt-2 rounded-md bg-warning-soft px-2 py-1.5 text-[11px] text-warning">
              입력이 바뀌었습니다 — 위 결과는 바뀌기 전 입력에 대한 것입니다. [등록 정보 확인]을 다시 눌러 주세요.
            </p>
          )}
        </section>
      )}
      </div>
    </div>
  );

  return (
    <>
      <ChannelRegistrationFrame detail={detail} summary={summary} />
      {/* REWORK-7 ⑤(CEO 지시, 2026-09-15) — 롯데ON도 **같은 모달**을 쓴다.
          여기 있던 브라우저 기본 확인창("롯데ON에 이 상품을 실제로 등록합니다…")
          이 사라졌다 — 그 창은 무엇이 등록되는지도, 무엇을 확인해야 하는지도
          말하지 못했고 세 채널 중 롯데ON만 다른 화면이었다.
          627ac53이 만든 모달을 그대로 쓴다(새로 만들지 않는다). */}
      {confirmOpen && (
        <ListingConfirmationModal
          listing={{
            platformLabel: "롯데ON",
            title: product.titleKo.value || product.title.value,
            /* 가격이 아직 없으면(resolved=false) 0을 "0원"으로 말하지 않는다 —
               priceSource=UNRESOLVED가 "판매가격을 계산할 수 없습니다"를
               그대로 띄운다(모달의 기존 문구, 새로 만들지 않음). */
            priceKrw: commonPrice.priceKrw ?? 0,
            priceSource: commonPrice.resolved && commonPrice.priceKrw != null ? "SELLER_OVERRIDE" : "UNRESOLVED",
          }}
          mode="LIVE"
          progress={registerProgress}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void runRegister()}
        />
      )}
    </>
  );
}

/**
 * REWORK-11 ① — 롯데ON 연결 상태 한 줄. 점(●)을 직접 칠하던 자리가 공용
 * StatusBadge로 바뀌었다 — 같은 "상태 + 문장" 표현을 이 파일만 다른 색·다른
 * 글리프로 그리고 있었다.
 */
function StatusRow({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "error" | "muted" }) {
  const status = tone === "ok" ? "success" : tone === "warn" ? "warning" : tone === "error" ? "error" : "neutral";
  return (
    <li className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} label={label} />
      <span className="text-text-secondary">{value}</span>
    </li>
  );
}

/**
 * 섹션 묶음의 이름표(CEO 골격의 "LOTTEON 필수 등록정보" / "LOTTEON 고유
 * 관리정보"). 새 컴포넌트 체계를 만들지 않고 한 줄 제목만 세운다 — 섹션 자체는
 * 기존 Section 그대로다.
 */
function GroupHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-1 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{description}</p>
    </div>
  );
}

/**
 * ② 셀러 설정 정보의 한 줄.
 *
 * 네 가지 처지를 **각각 다른 문장**으로 말한다. "셀러 설정에 없다"와 "셀러
 * 설정에는 있지만 롯데ON 코드가 아니다"는 셀러가 해야 할 일이 완전히 다르다
 * (앞은 설정에 가서 채우면 되고, 뒤는 가도 소용없다).
 */
const SELLER_SETTING_USAGE_LABEL: Record<LotteOnSellerSettingRow["usage"], { mark: string; text: string; tone: string }> = {
  AUTO_APPLIED: { mark: "●", text: "자동 반영됨", tone: "text-success" },
  SETTINGS_REQUIRED: { mark: "▲", text: "셀러 설정에서 먼저 등록해주세요", tone: "text-warning" },
  CHANNEL_CODE_DIFFERS: { mark: "▲", text: "셀러 설정에 있지만 롯데ON 코드체계가 다름", tone: "text-warning" },
  NO_SETTING_CONCEPT: { mark: "○", text: "셀러 설정에 없는 개념 — 롯데ON 고유값", tone: "text-text-tertiary" },
};

function SellerSettingRow({ row }: { row: LotteOnSellerSettingRow }) {
  const usage = SELLER_SETTING_USAGE_LABEL[row.usage];
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="font-medium text-text-secondary">
        {row.label}
        {row.lotteOnField && <span className="ml-1 text-[11px] text-text-tertiary">→ {row.lotteOnField}</span>}
      </dt>
      <dd>
        <p>
          <span className={usage.tone}>{usage.mark}</span>{" "}
          <span className="text-text-primary">{row.settingValue ?? "셀러 설정에 값 없음"}</span>
          <span className={`ml-2 text-[11px] ${usage.tone}`}>{usage.text}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-text-tertiary">{row.note}</p>
      </dd>
    </div>
  );
}

/**
 * REWORK 커머스 등록 구조 통일(CEO 지시, 2026-09-14) — ①~⑦ 입력 섹션의 껍데기.
 *
 * 🔴 **새 껍데기를 만들지 않는다.** 스마트스토어·쿠팡 탭(PlatformPreview)의
 * 「기본정보 · 카테고리 · 옵션 · 가격 · 배송 · 고시정보 · KC · 상세설명 ·
 * 등록 정보」가 쓰는 바로 그 `@/components/ui/CollapsibleSection`을 그대로
 * 쓴다. 지금까지 롯데ON만 자기 `Section`(항상 펼쳐진 카드)을 갖고 있었고,
 * 그래서 같은 자리에 있는 같은 성격의 섹션이 세 탭에서 다르게 보였다 —
 * CEO가 "롯데ON만 뭔가 다른 상품등록 페이지"라고 읽은 차이가 이것이다.
 *
 * `action`(버튼/링크)은 **본문 안**으로 내린다 — CollapsibleSection의 머리는
 * 통째로 `<button>`이라 그 안에 버튼을 넣으면 중첩 버튼이 된다.
 *
 * REWORK-11 ①(CEO 판정, 2026-09-15) — `defaultOpen`이 사라지고 **부모가 여닫는
 * 상태**(open/onToggle)와 **상태 배지**(badge)를 받는다. 이 둘이 없던 동안
 * 롯데ON은 (1) 모든 섹션이 펼쳐진 채로 시작해 화면이 스마트스토어·쿠팡의 서너
 * 배로 길었고, (2) 섹션 머리에 「준비됨 / 확인 필요」 배지가 아예 없었다 —
 * 같은 컴포넌트를 쓰면서도 결과 화면이 달라 보이던 실제 이유다.
 *
 * REWORK-13B(CEO 실측 판정, 2026-09-15: "롯데ON만 UI가 아직 다르다") — **머리와
 * 본문 첫 줄이 쿠팡과 같아진다.** 직전까지 이 껍데기는 두 가지를 제 방식으로
 * 하고 있었고, 그 둘이 카드 열한 개에 전부 반복돼 목록 전체의 인상을 갈랐다
 * (jsdom 실측):
 *
 *   1. `description`(두세 줄짜리 정책 설명)을 **머리의 summary**에 넣었다.
 *      쿠팡의 summary는 「자동 입력 6개 · 확인 필요 1개」 같은 **한 줄 상태**라
 *      머리가 한 줄인데, 롯데ON은 머리마다 설명이 두세 줄로 흘렀다.
 *   2. 본문 첫 줄이 `justify-end` 버튼 행이었다. 쿠팡의 본문 첫 줄은 파란 안내
 *      문단(SECTION_NOTE_CLASS)이다.
 *
 * 그래서 설명은 **쿠팡이 쓰는 바로 그 안내 문단**으로 내려오고, 머리의 summary
 * 자리는 쿠팡과 같은 성격의 한 줄 상태에만 내준다. 버튼은 사라지지 않는다 —
 * 같은 안내 문단 안에 들어가 별도의 행을 차지하지 않는다.
 *
 * 🔴 새 클래스를 만들지 않았다. 문단·격자·카드 간격은 전부
 * registration-sections.ts가 들고 있는 **쿠팡의 값 그대로**다.
 */
function FormSection({
  id,
  title,
  description,
  summary,
  action,
  badge,
  open,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  /** 머리의 한 줄 상태. 쿠팡 ①②③이 같은 자리에 같은 성격의 값을 세운다. */
  summary?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <CollapsibleSection
      id={id}
      title={title}
      summary={summary}
      badge={badge}
      open={open}
      onToggle={onToggle}
      defaultOpen={open === undefined ? true : undefined}
    >
      {(description || action) && (
        <p className={SECTION_NOTE_CLASS}>
          {description}
          {action && <span className="ml-2 inline-flex align-middle">{action}</span>}
        </p>
      )}
      {children}
    </CollapsibleSection>
  );
}

/**
 * REWORK-4 §5(CEO 지시, 2026-09-14) — **공통값을 읽기만 하는 섹션.**
 *
 * 10섹션 골격에서 롯데ON에 없던 ③ 옵션 · ④ 가격 · ⑨ 상세설명과 ① 기본
 * 상품정보가 전부 이 모양이다. 세 채널이 같은 목차를 갖되, 공통값을 롯데ON
 * 탭에서 **다시 입력받지는 않는다**는 두 요구를 동시에 지키는 자리다.
 *
 * 🔴 이 컴포넌트는 input/textarea/select를 하나도 만들지 않는다 — 그것이
 * 계약이다(three-layer-realign.test.ts 증명 1이 롯데ON 탭 전체에서 공통
 * 상품정보 입력칸 0개를 렌더 결과로 세고 있다). 고치러 가는 길은 하나,
 * [상품정보에서 수정]뿐이다.
 */
function CommonInfoSection({
  id,
  title,
  description,
  summary,
  rows,
  onEditCommonInfo,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  description: string;
  /** 머리의 한 줄 상태. 주지 않으면 머리는 쿠팡 ④⑨처럼 제목 한 줄이다. */
  summary?: React.ReactNode;
  rows: CommonProductRow[];
  onEditCommonInfo: () => void;
  badge?: React.ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** REWORK-10 A — 표 아래에 붙는 읽기 전용 행(지금은 제조사 하나뿐이다).
   *  🔴 이 섹션은 공통값 입력칸을 만들지 않는다 — 계약은 그대로다. */
  children?: React.ReactNode;
}) {
  const hasMissing = rows.some((row) => row.missing);
  return (
    <FormSection
      id={id}
      title={title}
      description={description}
      summary={summary}
      badge={badge}
      open={open}
      onToggle={onToggle}
      action={
        <Button variant="secondary" size="sm" onClick={onEditCommonInfo}>
          상품정보에서 수정
        </Button>
      }
    >
      {/* REWORK-11 ①(CEO 판정, 2026-09-15) — 여기 있던 `<dl>` 정의 목록이
          스마트스토어·쿠팡 기본정보와 **같은 격자 · 같은 행**으로 바뀌었다.
          예전에는 같은 자리(① 기본 상품정보)가 한쪽은 라벨+입력칸 격자,
          한쪽은 좌우 2단 표라서 한눈에 다른 화면으로 보였다.
          🔴 입력칸은 여전히 0개다 — ReadOnlyFieldRow는 input을 만들지 않는다. */}
      <div className={FIELD_GRID_CLASS}>
        {rows.map((row) => (
          <ReadOnlyFieldRow
            key={row.label}
            label={row.label}
            value={row.value ?? ""}
            placeholder="입력 필요 — 상품정보에서 채워주세요"
            origin={row.origin}
            /* P0-3 — 값이 비어 있는 이유가 «아직 없어서»인지 «상세페이지를
               가리키기로 이미 정해서»인지를 여기서 갈라 준다. 판정하지 않는다 —
               공통 상품정보가 들고 있던 source를 그대로 옮겨 읽을 뿐이다. */
            referenced={row.source === "DETAIL_PAGE_REFERENCE"}
          />
        ))}
        {children}
      </div>
      {hasMissing && (
        <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-[11px] text-warning">
          비어 있는 항목은 롯데ON 탭에서 채울 수 없습니다 — 상품정보에서 채우면 이 표와 등록 정보가 함께 갱신됩니다.
        </p>
      )}
    </FormSection>
  );
}


/**
 * REWORK-12 ②(CEO 실측 캡처, 2026-09-15: 롯데ON "③ 옵션 = 「1개 옵션 · 단품 6건」
 * 한 줄") — **무엇이 단품으로 나가는가.**
 *
 * 쿠팡 ③에는 옵션 표가 서 있는데 롯데ON ③에는 요약 한 줄뿐이었다. 같은 번호의
 * 같은 섹션이 한쪽에서만 값을 보여주면 셀러는 롯데ON에 무엇이 등록되는지 이
 * 화면에서 확인할 수 없다.
 *
 * 🔴 입력칸을 만들지 않는다. 롯데ON 탭은 공통값을 입력받지 않는다는 계약이
 * 그대로다(three-layer-realign.test.ts 증명 1). 여기 있는 것은 목록뿐이고,
 * 값은 상품정보의 `optionGroups` / `variants`를 그대로 읽는다 — 조합을
 * 만들어내지도, 없는 재고를 0으로 채우지도 않는다.
 */
function LotteOnOptionDetail({ product }: { product: CanonicalProduct }) {
  const groups = product.optionGroups ?? [];
  const variants = product.variants ?? [];

  if (groups.length === 0 && variants.length === 0) {
    return (
      <p className="text-[11px] text-text-tertiary sm:col-span-2 xl:col-span-3">
        원본에서 옵션을 찾지 못했습니다 — 단품 1건으로 등록됩니다.
      </p>
    );
  }

  return (
    <div className="space-y-2 sm:col-span-2 xl:col-span-3">
      {groups.map((group) => (
        <div key={group.name} className="text-[11px]">
          <span className="font-medium text-text-secondary">{group.name}</span>
          <span className="ml-1 text-text-tertiary">({group.values.length}개)</span>
          <p className="mt-0.5 text-text-secondary">{group.values.join(" · ")}</p>
        </div>
      ))}
      {variants.length > 0 && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-background text-text-tertiary">
              <tr>
                <th className="px-2 py-1 text-left font-medium">단품</th>
                <th className="px-2 py-1 text-left font-medium">재고</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id} className="border-t border-border">
                  <td className="px-2 py-1 text-text-secondary">
                    {Object.values(variant.optionValues).join(" / ") || "단품"}
                  </td>
                  {/* 🔴 없는 값을 0으로 적지 않는다 — 어댑터가 상품 재고로 폴백한다. */}
                  <td className="px-2 py-1 text-text-tertiary">
                    {variant.stockQuantity == null ? "상품 재고 사용" : `${variant.stockQuantity}개`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * 카테고리 추천 결과.
 *
 * 점수와 이유를 그대로 보여준다 — scoreCategoryCandidate()가 만든 문장이고
 * 화면이 다시 쓰지 않는다. 상품유형과 충돌하는 후보는 눌러서 고를 수 있게
 * 두되(셀러가 우리보다 잘 알 수 있다) 충돌이라는 사실을 숨기지 않는다.
 */
function CategoryRecommendation({
  state,
  pickedId,
  subtitle,
  onPick,
}: {
  state: RecommendState;
  pickedId: string;
  /** 제목 아래 한 줄 — 스마트스토어·쿠팡 패널의 "선택됨: …"과 같은 자리다. */
  subtitle: string;
  onPick: (candidate: LotteOnCategoryCandidate) => void;
}) {
  /* REWORK-11 ①(CEO 지시, 2026-09-15) — 껍데기가 **스마트스토어·쿠팡과 같은
     것**으로 바뀌었다(CategoryRecommendationShell). 예전에는 같은 "추천 →
     후보 → 선택"이 이 탭에서만 다른 상자(작은 회색 박스 · 제목 줄 없음 ·
     접기/펼치기 없음)에 담겨 있었다. 안에 들어가는 후보 카드는 REWORK-10부터
     이미 공용(CategoryCandidateCard)이다. */
  if (state.loading) {
    return (
      <CategoryRecommendationShell subtitle={subtitle}>
        <p className="text-xs text-text-tertiary">롯데ON 표준카테고리를 읽어 상품과 대조하는 중…</p>
      </CategoryRecommendationShell>
    );
  }
  if (state.error) {
    /* REWORK-12 ②(CEO 실측 캡처, 2026-09-15) — 이 자리에 영문 예외 문자열
       하나만 서 있었다. 이제 **한국어 사유 + 다음 행동** 두 줄이고, 아래에는
       추천 없이도 카테고리를 고를 수 있는 길(isRecommendDeadEnd → [롯데ON
       카테고리 선택])이 그대로 열린다 — 조회 실패가 등록 불가가 되지 않는다. */
    return (
      <CategoryRecommendationShell subtitle={subtitle}>
        <div className="rounded-md bg-error/5 px-3 py-2">
          <p className="text-xs font-medium text-error">🔴 카테고리 추천 실패 — {state.error}</p>
          {state.errorAction && <p className="mt-1 text-[11px] text-text-secondary">{state.errorAction}</p>}
        </div>
      </CategoryRecommendationShell>
    );
  }
  if (state.decision == null) {
    return (
      <CategoryRecommendationShell subtitle={subtitle}>
        <p className="text-xs text-text-tertiary">
          [카테고리 추천]을 누르면 이 상품의 연령대·성별·상품유형 신호로 롯데ON 표준카테고리 후보를 골라 드립니다 —
          스마트스토어·쿠팡 추천과 같은 판단 기준을 씁니다.
        </p>
      </CategoryRecommendationShell>
    );
  }
  return (
    <CategoryRecommendationShell subtitle={subtitle}>
      <p className="text-xs font-medium text-text-secondary">
        {state.decision === "AUTO_SELECT"
          ? "추천 — 상품과 잘 맞는 카테고리를 찾았습니다."
          : state.decision === "RECOMMEND"
            ? "추천 — 후보를 골랐지만 확신이 높지는 않습니다. 확인하고 골라 주세요."
            : "추천할 수 있는 카테고리를 찾지 못했습니다 — 상품정보(상품유형·연령대)를 채운 뒤 다시 추천해 주세요."}
        <span className="ml-1 text-text-tertiary">
          (표준카테고리 리프 {state.scannedLeafCount}개와 대조)
        </span>
      </p>
      {state.signalEvidence.length > 0 && (
        <p className="mt-1 text-[11px] text-text-tertiary">판단 근거 — {state.signalEvidence.join(" · ")}</p>
      )}
      {(state.truncated || state.unrecognizedCount > 0) && (
        <p className="mt-1 text-[11px] text-warning">
          {state.truncated ? "카테고리 목록을 끝까지 읽지 못했습니다(조회 상한). " : ""}
          {state.unrecognizedCount > 0
            ? `응답 ${state.unrecognizedCount}건은 표준카테고리로 읽히지 않았습니다 — 그만큼 후보에서 빠져 있습니다.`
            : ""}
        </p>
      )}
      {/* REWORK-11 ④(CEO 지시, 2026-09-15) — **후보가 0건이면 왜인지 적는다.**
          "추천할 수 있는 카테고리를 찾지 못했습니다" 한 문장으로는 「응답이
          비었다」와 「응답은 왔는데 우리 파서가 못 읽었다」와 「맞는 게 없다」가
          구분되지 않는다 — 셀러가 해야 할 일이 각각 다르다. */}
      {state.candidates.length === 0 && (
        <p className="mt-1 rounded bg-warning-soft px-2 py-1 text-[11px] text-warning">
          {state.totalCategoryCount === 0
            ? `⚠ 롯데ON이 표준카테고리를 0건 돌려줬습니다(읽은 페이지 ${state.pagesFetched}). 조회는 성공했지만 목록이 비어 있습니다.`
            : state.scannedLeafCount === 0
              ? `⚠ 표준카테고리 ${state.totalCategoryCount}건을 받았지만 그중 선택 가능한(leaf_yn=Y · use_yn≠N) 카테고리가 0건입니다.`
              : `⚠ 선택 가능한 카테고리 ${state.scannedLeafCount}건과 대조했지만 이 상품의 신호로는 후보를 고르지 못했습니다.`}
        </p>
      )}
      {/* REWORK-10 C(CEO 지시, 2026-09-15) — 스마트스토어·쿠팡과 **같은 후보 카드**다.
          예전에는 줄 전체가 버튼이고 점수·이유·파생값이 한 줄에 섞여 있었다 —
          같은 일(후보 하나 고르기)을 세 탭이 다른 방식으로 시키고 있었다.
          🔴 점수 자체는 서버(scoreCategoryCandidate)가 낸 값 그대로다. */}
      {state.candidates.length > 0 && (
        <ol className="mt-2 space-y-2">
          {state.candidates.map((candidate) => (
            <CategoryCandidateCard
              key={candidate.category.id}
              path={candidate.path}
              stars={candidateStars(candidate.score / 100, candidate.score >= 95 && !candidate.conflict)}
              reasons={[
                `${candidate.score}점${candidate.conflict ? " · 다른 도메인으로 보임" : ""} — ${candidate.reason}`,
              ]}
              detail={
                <>
                  표준카테고리번호 {candidate.category.id} · 전시카테고리{" "}
                  {candidate.category.displayCategories.length}개
                  {candidate.category.noticeItemCodes.length > 0
                    ? ` · 고시 품목 ${candidate.category.noticeItemCodes.join("/")}`
                    : ""}
                  {candidate.category.safetyTypeCodes.length > 0
                    ? ` · 안전인증 ${candidate.category.safetyTypeCodes.join("/")}`
                    : ""}
                </>
              }
              isSelected={pickedId === candidate.category.id}
              onSelect={() => onPick(candidate)}
            />
          ))}
        </ol>
      )}
    </CategoryRecommendationShell>
  );
}

/**
 * REWORK-6 ②(CEO 판정, 2026-09-14) — 추천이 막다른 길이 됐는가.
 *
 * 조회 실패(error)와 "추천 못 함"(REJECT)과 "후보 0건"은 셀러에게는 같은
 * 상황이다 — 이 화면에서 더 나아갈 수단이 없다는 것. 셋 다 직접 선택 경로를
 * 열어 준다. 아직 추천을 눌러보지도 않았을 때(decision === null, error === null)
 * 는 막다른 길이 아니다 — 먼저 추천을 시켜야 한다(원칙: 시스템 추천 → 셀러 선택).
 */
function isRecommendDeadEnd(state: RecommendState): boolean {
  if (state.loading) return false;
  if (state.error) return true;
  if (state.decision == null) return false;
  return state.decision === "REJECT" || state.candidates.length === 0;
}

/** 목록을 몇 장까지 읽는가 — /api/lotteon/category-recommend와 같은 상한이다. */
const DIRECT_PICK_PAGE_SIZE = 500;
const DIRECT_PICK_MAX_PAGES = 20;

/** 최상위(부모 없음) 묶음의 키. */
const DIRECT_PICK_ROOT = "";

/**
 * REWORK-6 ②(CEO 판정, 2026-09-14) — **추천이 실패해도 카테고리를 고를 수 있다.**
 *
 * ── 되살리지 않는 것 ─────────────────────────────────────────────────────────
 * 🔴 scatNo / dcatLst **번호 직접 입력**. 이 컴포넌트에는 `<input>`이 하나도
 * 없다(테스트가 그것을 고정한다). 셀러가 하는 일은 롯데ON이 돌려준 표준카테고리
 * 목록을 위에서부터 눌러 내려가는 것뿐이고, 마지막 리프를 누르면 끝난다.
 *
 * ── 왜 이 길이 필요한가 ──────────────────────────────────────────────────────
 * 추천은 상품 원문의 신호(연령/성별/상품유형)로 점수를 매긴다. 원문에 그 신호가
 * 없는 상품은 아무리 다시 눌러도 후보가 나오지 않는다 — "상품정보를 채우고 다시
 * 추천"은 그런 상품에게는 해결책이 아니라 막다른 길이다. 카테고리를 아는 사람은
 * 그때 셀러다.
 *
 * ── 새 조회 경로를 만들지 않는다 ─────────────────────────────────────────────
 * 이미 있는 조회 라우트(/api/lotteon/categories, job=cheetahStandardCategory)를
 * 그대로 쓰고, 응답을 읽는 파서도 추천 라우트와 같은 parseLotteOnStandardCategory
 * 하나다 — 같은 응답을 두 군데서 다르게 읽을 경로가 없다.
 *
 * ── 고른 뒤 ──────────────────────────────────────────────────────────────────
 * onPick은 추천 후보를 고를 때와 **같은 함수**(applyCategory)다. 표준·전시·고시
 * 품목·과세·요구 안전인증이 한 번에 채워지고 곧바로 재검증이 돈다.
 */
function CategoryDirectPicker({
  onPick,
  onClose,
}: {
  onPick: (category: LotteOnStandardCategory) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<LotteOnStandardCategory[]>([]);
  const [truncated, setTruncated] = useState(false);
  /** 지금 펼쳐 보고 있는 상위 카테고리 id. null이면 최상위 목록이다. */
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const collected: LotteOnStandardCategory[] = [];
      let cut = false;
      try {
        for (let page = 0; page < DIRECT_PICK_MAX_PAGES; page += 1) {
          const params = new URLSearchParams({
            job: "cheetahStandardCategory",
            skip: String(page * DIRECT_PICK_PAGE_SIZE),
            limit: String(DIRECT_PICK_PAGE_SIZE),
          });
          const res = await fetch(`/api/lotteon/categories?${params.toString()}`);
          const data = (await res.json()) as { ok?: boolean; message?: string; items?: unknown[] };
          if (!data.ok) {
            // 첫 장부터 실패하면 그 실패를 그대로 보여준다 — 인증/네트워크
            // 실패를 "카테고리 없음"으로 바꾸지 않는다(추천 라우트와 같은 원칙).
            if (page === 0) {
              if (!cancelled) {
                setError(data.message ?? "롯데ON 카테고리 목록을 불러오지 못했습니다.");
                setLoading(false);
              }
              return;
            }
            cut = true;
            break;
          }
          const items = data.items ?? [];
          for (const item of items) {
            const parsed = parseLotteOnStandardCategory(item);
            if (parsed) collected.push(parsed);
          }
          if (items.length < DIRECT_PICK_PAGE_SIZE) break;
          if (page === DIRECT_PICK_MAX_PAGES - 1) cut = true;
        }
      } catch {
        if (!cancelled) {
          setError("서버에 연결하지 못했습니다.");
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      setCategories(collected);
      setTruncated(cut);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  /** 부모 id → 자식 목록. 사용중지(use_yn=N)는 아예 보여주지 않는다. */
  const childrenOf = useMemo(() => {
    const map = new Map<string, LotteOnStandardCategory[]>();
    for (const category of categories) {
      if (!category.usable) continue;
      const key = category.parentId ?? DIRECT_PICK_ROOT;
      const bucket = map.get(key);
      if (bucket) bucket.push(category);
      else map.set(key, [category]);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return map;
  }, [categories]);

  const current = cursor ? (byId.get(cursor) ?? null) : null;
  /** 최상위 → 지금 자리까지의 이름 경로. 되돌아갈 길이기도 하다. */
  const trail = useMemo(
    () => (current ? buildLotteOnCategoryPath(current, byId) : []),
    [current, byId],
  );
  const trailIds = useMemo(() => {
    if (!current) return [] as string[];
    const ids: string[] = [current.id];
    let parent = current.parentId;
    while (parent && byId.has(parent) && !ids.includes(parent)) {
      ids.unshift(parent);
      parent = byId.get(parent)!.parentId;
    }
    return ids;
  }, [current, byId]);

  const rows = childrenOf.get(cursor ?? DIRECT_PICK_ROOT) ?? [];
  /* N-05 QA FIX(CPO 확정, 2026-09-23) — 여기 있던 `max-h-72 overflow-y-auto` 가
     페이지 안에 두 번째 세로 스크롤을 만들고 있었다. 긴 목록은 이 저장소가 이미
     쓰는 「더 보기 / 접기」로 접는다 — 스크롤은 목록이 얼마나 긴지 숨기지만
     「더 보기 (35건)」은 그 사실을 숫자로 말한다. */
  const [showAllRows, setShowAllRows] = useState(false);
  const DIRECT_PICK_PREVIEW_COUNT = 12;

  return (
    <div className="mb-3 rounded-md border border-border bg-background px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-text-secondary">롯데ON 카테고리 선택</p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            롯데ON이 제공하는 표준카테고리 목록입니다. 위에서부터 눌러 내려가 맨 끝(선택 가능) 카테고리를 고르면
            표준카테고리 · 전시카테고리 · 고시 품목코드 · 과세구분 · 요구 안전인증이 함께 채워집니다.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>

      {loading && <p className="mt-2 text-[11px] text-text-tertiary">롯데ON 표준카테고리 목록을 읽는 중…</p>}
      {error && <p className="mt-2 rounded-md bg-error/5 px-3 py-2 text-[11px] text-error">{error}</p>}

      {!loading && !error && (
        <>
          {truncated && (
            <p className="mt-2 text-[11px] text-warning">
              카테고리 목록을 끝까지 읽지 못했습니다(조회 상한) — 보이지 않는 카테고리가 있을 수 있습니다.
            </p>
          )}
          <nav className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-text-tertiary">
            <button type="button" className="underline hover:text-text-primary" onClick={() => setCursor(null)}>
              전체
            </button>
            {trail.map((name, index) => (
              <span key={trailIds[index] ?? name} className="flex items-center gap-1">
                <span aria-hidden>›</span>
                <button
                  type="button"
                  className="underline hover:text-text-primary"
                  onClick={() => setCursor(trailIds[index] ?? null)}
                >
                  {name}
                </button>
              </span>
            ))}
          </nav>

          {rows.length === 0 ? (
            <p className="mt-2 text-[11px] text-text-tertiary">
              이 아래에는 더 고를 카테고리가 없습니다 — 위 경로에서 다른 갈래를 골라 주세요.
            </p>
          ) : (
            <ul className="mt-2 space-y-0.5">
              {(showAllRows ? rows : rows.slice(0, DIRECT_PICK_PREVIEW_COUNT)).map((category) => {
                const hasChildren = (childrenOf.get(category.id) ?? []).length > 0;
                // 리프 판정은 롯데ON이 말한 leaf_yn을 먼저 믿는다. 트리를 다 읽지
                // 못했을 때(truncated) 자식이 안 보인다는 이유로 리프라고 단정하지
                // 않는다 — 87의 scatNo는 리프여야 하고, 아니면 등록이 거절된다.
                const selectable = category.leaf && !hasChildren;
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => (selectable ? onPick(category) : setCursor(category.id))}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-text-primary">{category.name}</span>
                        {selectable && category.safetyTypeCodes.length > 0 && (
                          <span className="block text-text-tertiary">
                            안전인증 {category.safetyTypeCodes.join("/")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-text-tertiary">
                        {selectable ? "이 카테고리 선택 →" : "하위 열기 ›"}
                      </span>
                    </button>
                  </li>
                );
              })}
              {rows.length > DIRECT_PICK_PREVIEW_COUNT && (
                <li>
                  <button
                    type="button"
                    onClick={() => setShowAllRows((v) => !v)}
                    className="px-2 py-1.5 text-[11px] text-primary underline hover:text-primary-hover"
                  >
                    {showAllRows ? "접기" : `더 보기 (${rows.length - DIRECT_PICK_PREVIEW_COUNT}건)`}
                  </button>
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/**
 * REWORK-5 ③ — **고른 결과**를 읽기 전용으로 보여준다.
 *
 * 입력칸이 아니다. 셀러가 만질 것은 위의 [선택] 하나뿐이고, 여기는 그 한 번의
 * 선택이 실제로 무엇을 채웠는지 **확인**하는 자리다 — 선택이 다섯 값을 한꺼번에
 * 채운다는 말이 참인지를 셀러가 눈으로 볼 수 있어야 한다(그러지 않으면 "골랐는데
 * 아무 일도 안 일어났다"는 직전 상태와 화면상 구분되지 않는다).
 *
 * 🔴 번호를 숨기지는 않는다. 판매자센터에서 대조해야 할 때 필요한 값이라
 * 그대로 보여주되, **고쳐 넣는 칸으로는 두지 않는다.**
 */
function PickedCategorySummary({
  form,
  selected,
  displayCategoryText,
}: {
  form: LotteOnChannelForm;
  selected: ReturnType<typeof resolveLotteOnSelectedCategory>;
  displayCategoryText: string;
}) {
  if (!isLotteOnCategoryChosen(form)) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-2 text-[11px] text-text-tertiary">
        아직 고른 카테고리가 없습니다 — 위 [카테고리 추천]을 눌러 후보에서 하나를 고르면 표준카테고리 · 전시카테고리 ·
        고시 품목코드 · 과세구분 · 요구 안전인증이 한 번에 채워집니다.
      </p>
    );
  }
  const rows: { label: string; value: string }[] = [
    { label: "표준카테고리 (scatNo)", value: `${selected?.name ? `${selected.name} · ` : ""}${form.category.standardCategoryNo}` },
    {
      label: "전시카테고리 (dcatLst)",
      value: `${form.category.displayCategoryNos.length}개 — ${displayCategoryText || form.category.displayCategoryNos.join(", ")}`,
    },
  ];
  if (selected?.noticeItemCodes.length) {
    rows.push({ label: "고시 품목코드 (pdItmsCd)", value: selected.noticeItemCodes.join(" / ") });
  }
  if (form.codes.taxTypeCode) {
    rows.push({ label: "과세구분 (tdfCd)", value: form.codes.taxTypeCode });
  }
  if (selected?.safetyTypeCodes.length) {
    rows.push({ label: "요구 안전인증 (sftyAthnLst)", value: selected.safetyTypeCodes.join(" / ") });
  }
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] font-medium text-text-secondary">
        선택한 카테고리가 채운 값 — 셀러가 다시 입력하지 않습니다
      </p>
      <dl className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2 text-[11px]">
            <dt className="w-44 shrink-0 text-text-tertiary">{row.label}</dt>
            <dd className="min-w-0 break-words font-mono text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[11px] text-text-tertiary">
        다른 카테고리로 바꾸려면 위 [카테고리 추천]에서 다시 고르면 됩니다.
      </p>
    </div>
  );
}

/**
 * REWORK-11 ④(CEO 지시, 2026-09-15) — **조회가 어떻게 됐는지 한 줄.**
 *
 * 🔴 "설정값이 없습니다"로 뭉개지 않는다. 실패했으면 실패 사유를, 응답은 왔는데
 * 0건이면 그 사실과 **무엇으로 물어봤는지**(소속거래처코드)를 그대로 적는다 —
 * 그 둘은 셀러가 해야 할 일이 완전히 다르다.
 */
function DeliveryLookupNote({ state }: { state: DeliverySettingsState }) {
  if (state.loading) {
    return (
      <p className="mb-3 text-[11px] text-text-tertiary">
        롯데ON 판매자센터에서 출고지 · 반품지 · 배송비 정책을 불러오는 중…
      </p>
    );
  }
  if (state.error) {
    return (
      <p className="mb-3 rounded-md bg-error/5 px-3 py-2 text-[11px] text-error">
        롯데ON 배송 설정을 불러오지 못했습니다 — {state.error}
      </p>
    );
  }
  const data = state.data;
  if (!data) return null;
  const found =
    data.outboundPlaces.length + data.returnPlaces.length + data.costPolicies.length;
  return (
    <div className="mb-3 space-y-1">
      <p className="text-[11px] text-text-secondary">
        {found > 0
          ? `롯데ON 판매자센터에서 출고지 ${data.outboundPlaces.length}건 · 반품지 ${data.returnPlaces.length}건 · 배송비 정책 ${data.costPolicies.length}건을 불러왔습니다 — 후보가 하나뿐이거나 기본으로 표시된 건은 자동으로 채웠습니다.`
          : `롯데ON이 출고지 · 반품지 · 배송비 정책을 0건 돌려줬습니다(소속거래처코드 ${data.sentAfflTrCd}로 조회).`}
      </p>
      {/* 🔴 실패/빈 응답 사유를 서버 문장 그대로. 화면이 다시 쓰지 않는다. */}
      {data.issues.map((issue) => (
        <p key={`${issue.source}-${issue.message}`} className="rounded bg-warning-soft px-2 py-1 text-[11px] text-warning">
          ⚠ {issue.source} — {issue.message}
        </p>
      ))}
    </div>
  );
}

/**
 * ══ LOTTEON-REAL-REGISTRATION-02 ①(CEO 확정, 2026-09-22) ══
 *
 * 「이 칸은 비어 있지만 «판매자 설정» 이 채운다」를 그 자리에서 말한다.
 *
 * 이게 없으면 셀러는 빈 칸을 보고 「아직 안 됐다」고 읽는다. 그래서 매 상품마다
 * 출고지를 다시 골랐다 — 판매자가 바꾸지 않는 한 상품마다 달라질 일이 없는
 * 값인데도.
 *
 * 🔴 여기서 판정하지 않는다. 폼이 비었고 설정에 값이 있을 때만 서고, 실제로
 * 그 값을 payload 에 합류시키는 것은 서버 한 곳이다(build-context 의
 * resolveLotteOnSellerFixedValue). 화면이 따로 계산하면 「화면에는 적용됐다고
 * 적혀 있는데 payload 는 다른 값」이 생긴다.
 *
 * 🔴 번호를 크게 쓰지 않는다. 셀러가 기억해야 하는 것은 「○○ 물류센터」이지
 * 「12345」가 아니다 — 번호는 확인용으로 작게만 둔다.
 */
function SellerSettingApplied({
  value,
  label,
}: {
  /** 설정에 저장된 «번호/코드». 없으면 이 줄은 서지 않는다. */
  value: string | null | undefined;
  /** 고를 때 보였던 사람이 읽는 이름. 없으면 번호만 보여준다. */
  label: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <p
      data-seller-setting-applied="true"
      className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-text-secondary"
    >
      <span className="font-medium text-text-primary">{label || value}</span>
      <span className="text-success">✓ 설정값 적용됨</span>
      {label && <span className="text-text-tertiary">({value})</span>}
      <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
        설정에서 변경
      </Link>
    </p>
  );
}

/**
 * 롯데ON이 돌려준 장소/정책 중 하나를 고른다. 번호를 찾아 적게 하지 않는다.
 *
 * REWORK-14 — `emptyLabel`이 사라졌다. 조회 결과가 없을 때 하던 말("롯데ON에
 * 선등록된 출고지")은 이제 **언제나** 그 칸의 도움말 줄(`note`)에 서 있다 —
 * 조회 성공 여부에 따라 도움말 줄이 입력 컨트롤로 바뀌던 것이 롯데ON에만
 * 있던 모양이었다. 고를 것이 없으면 이 컴포넌트는 아무것도 그리지 않는다.
 */
function DeliveryOptionPicker({
  options,
  current,
  onPick,
}: {
  options: { no: string; name: string | null; isDefault?: boolean }[];
  current: string;
  onPick: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <button
          key={option.no}
          type="button"
          onClick={() => onPick(option.no)}
          className={`rounded border px-1.5 py-0.5 text-[11px] ${
            current === option.no
              ? "border-selected-border bg-selected-soft text-selected"
              : "border-border text-text-secondary hover:bg-background"
          }`}
        >
          {option.name ? `${option.name} · ${option.no}` : option.no}
        </button>
      ))}
    </span>
  );
}

/** 공통코드(89) 한 건 고르기. 목록이 길 수 있어 select로 받는다. */
/**
 * ══ LOTTEON-REAL-REGISTRATION-06 §17(CEO 확정, 2026-09-22) ══
 *
 * 롯데ON 공통코드(89) 목록 하나를 읽어 온다. 「공식 Master 가 있으면 고르게
 * 한다」는 원칙의 실행부다.
 *
 * 🔴 조회 «실패» 를 «목록 0건» 과 같은 얼굴로 두지 않는다. 비면 셀러는 「고를
 * 것이 없다」고 읽는데 사실은 조회가 닿지 않은 것이다. 직접 입력칸은 그대로
 * 살아 있어서 조회가 실패해도 셀러가 막히지는 않는다.
 */
function useLotteOnCommonCodes(group: string, label: string) {
  const [items, setItems] = useState<{ code: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/lotteon/common-codes?group=${encodeURIComponent(group)}`);
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          items?: { code: string; name: string }[];
        };
        if (cancelled) return;
        if (!data.ok) {
          setError(data.message ?? `${label}를 불러오지 못했습니다.`);
          return;
        }
        setItems(data.items ?? []);
      } catch {
        if (!cancelled) setError("롯데ON에 연결하지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [group, label]);
  return { items, error, label };
}

/** 공통코드 선택기 + 조회 실패를 «실패로» 말하는 한 줄. */
function CommonCodePicker({
  list,
  current,
  onPick,
}: {
  list: { items: { code: string; name: string }[]; error: string | null; label: string };
  current: string;
  onPick: (value: string) => void;
}) {
  if (list.error) {
    return (
      <p className="mt-1 text-[11px] text-error">
        🔴 {list.label}를 불러오지 못했습니다 — {list.error}
      </p>
    );
  }
  return <CodeOptionPicker options={list.items} current={current} onPick={onPick} />;
}

function CodeOptionPicker({
  options,
  current,
  onPick,
}: {
  options: CodeOption[];
  current: string;
  onPick: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    /* REWORK-14 — 입력칸과 **같은 옷**을 입는다(FIELD_INPUT_CLASS). 전에는
       `text-xs` + 제 여백이라 바로 위 입력칸과 다른 높이로 서 있었다. */
    <select
      value={current}
      onChange={(event) => onPick(event.target.value)}
      className={FIELD_INPUT_CLASS}
    >
      <option value="">선택 안 함</option>
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.name ? `${option.name} (${option.code})` : option.code}
        </option>
      ))}
    </select>
  );
}

/* REWORK-11 ①(CEO 지시, 2026-09-15) — 여기 있던 롯데ON **전용** 입력 컴포넌트
   셋(FieldRequirement · RequirementBadge · TextField · TextAreaField)이
   사라졌다. 셋 다 스마트스토어·쿠팡의 FieldRow + FIELD_INPUT_CLASS와 같은 일을
   하면서 테두리 반경(rounded-md vs rounded) · 여백(px-3 py-1.5 vs px-2 py-1) ·
   라벨 굵기 · 배지 모양만 달랐다 — "순서는 같은데 롯데ON만 다르게 생겼다"의
   실체다. 지금은 registration-fields.tsx의 공용 컴포넌트를 그대로 쓴다. */
