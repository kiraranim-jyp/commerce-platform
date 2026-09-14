"use client";

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
  describeLotteOnCategoryItem,
  fromLotteOnChannelInfo,
  isLotteOnCategoryChosen,
  listLotteOnBlockingConditions,
  parseDisplayCategoryNos,
  requiresSafetyCertification,
  resolveLotteOnSelectedCategory,
  setLotteOnStandardCategoryNo,
  summarizeCommonProduct,
  toLotteOnChannelInfo,
  toLotteOnChannelPayload,
  type CommonCategorySource,
  type CommonProductRow,
  type LotteOnChannelForm,
  type LotteOnValidationField,
  type LotteOnValidationSnapshot,
} from "./lotteon-channel-form";
import { LOTTEON_SAFETY_TYPE_LABEL, type LotteOnCategoryCandidate } from "./lotteon-category";
import { sectionTitle } from "./registration-sections";
import { ChannelRegistrationFrame, ChannelRegistrationSummary } from "./ChannelRegistrationFrame";
import type { ReadinessItem } from "./readiness";
import { resolveRegistrationReadinessState, type PriorityItem } from "./readiness-state";
import {
  describeLotteOnSellerSettings,
  type ListingStatus,
  type LotteOnSellerSettingRow,
  type LotteOnSellerSettingsInput,
} from "@commerce/listing";

/** [부족정보 해결]이 데려가는 자리. 우측 요약과 좌측 상세가 같은 id를 본다. */
const LOTTEON_MISSING_INFO_ID = "lotteon-missing-info";

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

interface CategoryLookupState {
  loading: boolean;
  error: string | null;
  /** 알아본 것 — 누르면 번호가 입력칸에 들어간다. */
  options: { code: string; name: string }[];
  /** 못 알아본 원문 — 지어내지 않고 그대로 보여준다. */
  unrecognized: unknown[];
}

interface RecommendState {
  loading: boolean;
  error: string | null;
  decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT" | null;
  candidates: LotteOnCategoryCandidate[];
  signalEvidence: string[];
  scannedLeafCount: number;
  unrecognizedCount: number;
  truncated: boolean;
}

const EMPTY_LOOKUP: CategoryLookupState = { loading: false, error: null, options: [], unrecognized: [] };
const EMPTY_RECOMMEND: RecommendState = {
  loading: false,
  error: null,
  decision: null,
  candidates: [],
  signalEvidence: [],
  scannedLeafCount: 0,
  unrecognizedCount: 0,
  truncated: false,
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
  const [showPayload, setShowPayload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [standardLookup, setStandardLookup] = useState<CategoryLookupState>(EMPTY_LOOKUP);
  const [displayLookup, setDisplayLookup] = useState<CategoryLookupState>(EMPTY_LOOKUP);
  const [recommend, setRecommend] = useState<RecommendState>(EMPTY_RECOMMEND);
  /**
   * 확인을 통과한 뒤 입력이 바뀌었는가. true면 화면의 등록 가능성/부족한 정보는
   * **옛 입력에 대한 답**이다 — 등록 버튼을 잠그고 다시 확인하게 한다.
   * (SPRINT 3까지는 이 상태가 없어서 확인 후 값을 지워도 버튼이 열려 있었다.)
   */
  const [stale, setStale] = useState(false);

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
  /** §18 — 퍼센트보다 먼저 보여줄, 실제로 등록을 막는 필수 조건. */
  const blockingConditions = useMemo(() => listLotteOnBlockingConditions(validation), [validation]);

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

  /** 전시카테고리는 여러 개다 — 화면에서는 한 줄 텍스트로 받고 배열로 보관한다. */
  function setDisplayCategories(raw: string) {
    setDisplayCategoryText(raw);
    patch("category", { displayCategoryNos: parseDisplayCategoryNos(raw) });
  }

  function addDisplayCategory(code: string) {
    const next = parseDisplayCategoryNos(`${displayCategoryText} ${code}`);
    setDisplayCategoryText(next.join(", "));
    patch("category", { displayCategoryNos: next });
  }

  /**
   * 카테고리 **추천**(CEO 신규 요건). 조회가 아니다.
   *
   * 서버(/api/lotteon/category-recommend)가 onpick 205 표준카테고리 목록을
   * 받아 이 상품의 신호(연령/성별/상품유형)와 대조해 점수를 매긴다 — 쿠팡과
   * 같은 scoreCategoryCandidate()를 쓴다.
   */
  async function runRecommend() {
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
        decision?: RecommendState["decision"];
        candidates?: LotteOnCategoryCandidate[];
        signalEvidence?: string[];
        scannedLeafCount?: number;
        unrecognizedCount?: number;
        truncated?: boolean;
      };
      if (!data.ok) {
        setRecommend({ ...EMPTY_RECOMMEND, error: data.message ?? "카테고리를 추천하지 못했습니다." });
        return;
      }
      setRecommend({
        loading: false,
        error: null,
        decision: data.decision ?? null,
        candidates: data.candidates ?? [],
        signalEvidence: data.signalEvidence ?? [],
        scannedLeafCount: data.scannedLeafCount ?? 0,
        unrecognizedCount: data.unrecognizedCount ?? 0,
        truncated: Boolean(data.truncated),
      });
    } catch {
      setRecommend({ ...EMPTY_RECOMMEND, error: "서버에 연결하지 못했습니다." });
    }
  }

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
    const next = applyLotteOnRecommendedCategory(form, candidate.category);
    setDisplayCategoryText(next.category.displayCategoryNos.join(", "));
    commitForm(next);
  }

  /**
   * 번호를 직접 넣는 길(입력칸 · 조회 결과 클릭). 추천이 알려준 값은 여기서
   * 버려진다 — 판단은 setLotteOnStandardCategoryNo() 한 곳에만 있다.
   */
  function setStandardCategoryNo(value: string) {
    commitForm(setLotteOnStandardCategoryNo(form, value));
  }

  /**
   * 상품정보에 이미 있는 어린이제품 인증을 롯데ON 형식으로 옮겨 적는다.
   * 🔴 인증번호를 만들지 않는다 — 셀러가 상품정보에 입력해 둔 실제 값만 옮긴다.
   */
  const commonSafetyLine = useMemo(
    () => buildLotteOnSafetyLineFromCommon(product, selectedCategory?.safetyTypeCodes[0] ?? null),
    [product, selectedCategory],
  );

  /**
   * 카테고리 **조회** — 번호를 이미 아는 셀러를 위한 길은 그대로 둔다.
   *
   * 🔴 응답 필드명을 실동작으로 확인하지 못했다. 문서 원문 필드(std_cat_id /
   * disp_cat_id)로 읽어보고, 못 읽으면 원문을 그대로 보여준다.
   */
  async function lookupCategories(kind: "standard" | "display") {
    const setState = kind === "standard" ? setStandardLookup : setDisplayLookup;
    const job = kind === "standard" ? "cheetahStandardCategory" : "cheetahDisplayCategory";
    setState({ ...EMPTY_LOOKUP, loading: true });
    try {
      const res = await fetch(`/api/lotteon/categories?job=${job}&limit=100`);
      const data = (await res.json()) as { ok: boolean; message?: string; items?: unknown[] };
      if (!data.ok) {
        setState({ ...EMPTY_LOOKUP, error: data.message ?? "카테고리를 조회하지 못했습니다." });
        return;
      }
      const items = data.items ?? [];
      const options: { code: string; name: string }[] = [];
      const unrecognized: unknown[] = [];
      for (const item of items) {
        const described = describeLotteOnCategoryItem(item);
        if (described) options.push(described);
        else unrecognized.push(item);
      }
      setState({ loading: false, error: null, options, unrecognized });
    } catch {
      setState({ ...EMPTY_LOOKUP, error: "서버에 연결하지 못했습니다." });
    }
  }

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
    if (!window.confirm("롯데ON에 이 상품을 실제로 등록합니다. 계속하시겠습니까?")) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch("/api/lotteon/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          channel: toLotteOnChannelPayload(form),
          snapshotId: snapshotId ?? undefined,
          jobKey: jobKey ?? undefined,
          liveRates,
          roundingUnit,
        }),
      });
      const data = (await res.json()) as RegisterResponse;
      setRegisterResult(data);
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setRegistering(false);
    }
  }

  const connectionOk = preview != null && preview.ok && !preview.identityError;
  const canRegister = !stale && readiness.percent === 100 && readiness.allRequiredPassed && !registering && !previewing;

  /* ──────────────────────────────────────────────────────────────────────
     REWORK-2(CEO 지시, 2026-09-14) — 우측 · 등록 요약으로 옮기기 위한 변환.

     🔴 **판정을 새로 만들지 않는다.** 아래 세 값은 전부 이미 계산돼 있던
     것(validation / readiness / missingInfo)을 스마트스토어·쿠팡 요약이 읽는
     모양으로 옮겨 적기만 한다. 라벨과 사유는 서버 문장 그대로다.
     ────────────────────────────────────────────────────────────────────── */

  /** 서버 검증 한 줄 = 요약의 필수항목 한 줄. 롯데ON 검증에는 선택 항목이 없다. */
  const readinessItems: ReadinessItem[] = useMemo(() => {
    const sectionOf = new Map(missingInfo.map((item) => [item.key, item.sectionId]));
    return (validation?.fields ?? []).map((field) => ({
      label: field.label,
      passed: field.status === "READY",
      required: true,
      hint: field.reason,
      sectionId: sectionOf.get(field.field),
    }));
  }, [validation, missingInfo]);

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
      onPriorityItemClick={(item) => item.sectionId && scrollToSection(item.sectionId)}
      /* REWORK-4 §2 — 여기 있던 onResolveMissing(= 「부족한 정보 한 번에
         해결하기」)이 사라졌다. 롯데ON의 §8 부족한 정보 목록은 아래 본문에
         그대로 남아 있고(LOTTEON_MISSING_INFO_ID), 우선순위 첫 항목은 위
         배너가 무엇/왜/어디서/[바로 이동]까지 갖춰서 말한다. */
      statusRows={
        <section className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[11px] font-medium leading-4 text-text-tertiary">등록 상태</p>
          <ul className="mt-1 space-y-1.5 text-xs">
            <StatusRow
              label="롯데ON 연결"
              tone={preview == null ? "muted" : connectionOk ? "ok" : "warn"}
              value={
                preview == null
                  ? "확인 중…"
                  : connectionOk
                    ? "인증키 · 서버 IP 확인됨 (거래처 조회 성공)"
                    : (preview.identityError ?? "거래처 정보를 확인하지 못했습니다.")
              }
            />
            <StatusRow
              label="등록"
              tone={registerResult?.result?.status === "SUBMITTED" ? "ok" : registerResult ? "error" : "muted"}
              value={
                registerResult?.result
                  ? registerResult.result.status === "SUBMITTED"
                    ? `등록 요청 완료 — 판매자상품번호(spdNo) ${registerResult.result.externalProductId ?? "미확인"}`
                    : `등록 실패 — ${registerResult.result.message}`
                  : "아직 이 화면에서 등록한 적이 없습니다."
              }
            />
          </ul>
          {stale && (
            <p className="mt-2 rounded-md bg-warning-soft px-2 py-1.5 text-[11px] text-warning">
              입력이 바뀌었습니다 — 위 결과는 바뀌기 전 입력에 대한 것입니다. [등록 정보 확인]을 다시 눌러 주세요.
            </p>
          )}
        </section>
      }
      percent={readiness.percent}
      required={readinessItems}
      recommended={[]}
      allRequiredPassed={!stale && readiness.allRequiredPassed}
      platformLabel="롯데ON"
      status={listingStatus}
      registrationEnabled
      registrationReadinessState={registrationState}
      onRegister={() => void runRegister()}
      onItemClick={scrollToSection}
      /* §17 — 카테고리 전에는 등록 가능성을 숫자로 말하지 않는다. 0%도 말하지
         않는다: 0%는 "다 모자라다"는 판정이고, 지금 참인 것은 "아직 판단할 수
         없다"이다. 표준카테고리가 전시카테고리·고시 품목코드·과세구분·요구
         안전인증을 함께 들고 오기 때문에(조사 §14-2), 고르는 순간 필수 항목의
         **목록 자체**가 바뀐다. */
      percentUnavailable={
        previewing && preview == null ? (
          <p className="text-xs text-text-tertiary">확인 중…</p>
        ) : validation == null ? (
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
              onClick={() => scrollToSection("lotteon-section-category")}
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
              {stale
                ? "입력이 바뀌었습니다 — 등록 정보 확인을 다시 통과해야 등록 버튼이 열립니다."
                : "등록 가능성 100% + 등록 정보 확인을 통과해야 등록 버튼이 열립니다."}
            </p>
          )}
        </div>
      }
    />
  );

  const detail = (
    <div className="space-y-4">
      {/* ── §18 등록을 막고 있는 필수 조건 ────────────────────────────────
          우측 요약의 필수항목 목록과 같은 값이지만, 여기서는 **차단된 것만**
          서버 문장 그대로 먼저 세운다. 셀러가 해야 할 일은 "83%를 100%로
          만드는 것"이 아니라 이 줄들을 없애는 것이기 때문이다. */}
      {blockingConditions.length > 0 && (
        <section className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">
            등록을 막고 있는 필수 조건 {blockingConditions.length}개
          </p>
          {!categoryChosen && (
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              카테고리와 무관하게 지금 이미 확인된 것 — 카테고리를 고르면 여기에 항목이 더 늘어납니다.
            </p>
          )}
          <BlockingConditionList fields={blockingConditions} />
        </section>
      )}

      {/* ── 부족한 정보 (§8) ──────────────────────────────────────────────
          우측 요약의 부족정보는 "무엇이 몇 개"까지다. 여기서는 **왜 필요하고
          어디서 고치는지**를 항목마다 편다 — [부족정보 해결]이 데려오는 자리다. */}
      {missingInfo.length > 0 && (
        <section id={LOTTEON_MISSING_INFO_ID} className="scroll-mt-4 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            ⚠ 롯데ON 등록에 {missingInfo.length}개 정보가 부족합니다
          </h3>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            공통 상품정보는 고치면 스마트스토어·쿠팡에도 함께 반영됩니다 — 그래서 맨 위에 둡니다.
          </p>
          <ol className="mt-3 space-y-3">
            {missingInfo.map((item, index) => (
              <li key={item.key} className="text-xs">
                <p className="font-medium text-text-primary">
                  {index + 1}. {item.label}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                      item.where === "COMMON_PRODUCT"
                        ? "bg-primary/10 text-primary"
                        : "bg-background text-text-tertiary"
                    }`}
                  >
                    {LOTTEON_FIX_LOCATION_LABEL[item.where]}에서 해결
                  </span>
                </p>
                <p className="mt-0.5 text-text-secondary">{item.why}</p>
                <p className="mt-0.5 text-text-secondary">→ {item.what}</p>
                {item.where === "COMMON_PRODUCT" && (
                  <Button variant="secondary" size="sm" className="mt-1" onClick={onEditCommonInfo}>
                    상품정보에서 수정
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        {/* REWORK(2026-09-14) — 예전 제목은 "롯데ON 등록"이었다. 화면 맨 아래
            등록 버튼과 같은 이름이라 "여기가 등록하는 곳인가"로 읽혔다. 안내
            박스라는 사실을 제목이 직접 말하게 바꾼다(새 용어가 아니라 설명이다). */}
        <p className="text-sm font-semibold text-text-primary">이 탭에서 정하는 것</p>
        <p className="mt-1 text-xs text-text-tertiary">
          상품명 · 이미지 · 상세페이지 · 가격 · 옵션 · 재고는 <b>상품정보에 있는 것을 그대로 씁니다</b>. 출고 소요일 ·
          공통 상세블록은 <b>셀러 설정에 있는 것을 그대로 씁니다</b>. 둘 다 이 탭에서 다시 입력하지 않습니다. 아래에서는{" "}
          <b>롯데ON에만 필요한 것</b>(표준·전시 2중 카테고리, 고시, 안전인증, 배송 선등록 번호)만 정합니다.
        </p>
        {/* 3층 구조 재정렬(CEO 지시, 2026-09-14) — 이 탭의 입력이 어디에 남는지
            화면에 적는다. 예전에는 탭을 벗어나면 사라졌기 때문에, "남는다"는
            사실 자체가 셀러가 알아야 할 변경점이다. */}
        <p className="mt-1 text-xs text-text-tertiary">
          여기서 입력한 값은 <b>이 상품에 저장됩니다</b> — 다른 탭에 다녀와도 그대로 남아 있습니다. 스마트스토어·쿠팡에는
          아무 영향을 주지 않습니다.
        </p>
      </div>

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

      {/* ── ① 기본 상품정보 — 읽기 전용(공통값) ──────────────────────────── */}
      <CommonInfoSection
        id="lotteon-section-basic"
        title={sectionTitle("BASIC")}
        description="상품관리에 저장된 값입니다. 여기서는 고칠 수 없고, 고치면 스마트스토어·쿠팡에도 함께 반영됩니다."
        rows={rowsOf("상품명", "브랜드")}
        onEditCommonInfo={onEditCommonInfo}
      />

      {/* ── ③ 카테고리 — 표준 + 전시 2중 · 추천 ──────────────────────────── */}
      <FormSection
        id="lotteon-section-category"
        title={sectionTitle("CATEGORY", "롯데ON 전용 · 2중 구조")}
        description="롯데ON은 표준카테고리 1개와 전시카테고리 1개 이상을 함께 요구합니다. 여기서 고른 값은 롯데ON에만 적용되고, 스마트스토어·쿠팡 카테고리를 덮어쓰지 않습니다."
        action={
          <Button variant="primary" size="sm" disabled={recommend.loading} onClick={() => void runRecommend()}>
            {recommend.loading ? "추천 중…" : "카테고리 추천"}
          </Button>
        }
      >
        <CategoryRecommendation
          state={recommend}
          pickedId={form.category.standardCategoryNo}
          onPick={applyRecommendation}
        />

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

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="표준카테고리번호 (scatNo)"
            hint="롯데ON 표준 분류 1개. 위 [카테고리 추천]으로 고르거나, 번호를 알고 있으면 직접 적습니다."
            value={form.category.standardCategoryNo}
            onChange={setStandardCategoryNo}
          />
          <TextField
            label="전시카테고리번호 (dcatLst)"
            hint="1개 이상. 쉼표로 구분합니다. 표준카테고리에 매핑된 것만 등록됩니다."
            value={displayCategoryText}
            onChange={setDisplayCategories}
          />
        </div>
        <p className="mt-1 text-[11px] text-text-tertiary">
          전시카테고리 {form.category.displayCategoryNos.length}개 인식됨
          {form.category.displayCategoryNos.length > 0 ? ` — ${form.category.displayCategoryNos.join(", ")}` : ""}
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CategoryLookup
            title="표준카테고리 직접 찾기"
            state={standardLookup}
            onLookup={() => void lookupCategories("standard")}
            onPick={setStandardCategoryNo}
          />
          <CategoryLookup
            title="전시카테고리 직접 찾기"
            state={displayLookup}
            onLookup={() => void lookupCategories("display")}
            onPick={addDisplayCategory}
          />
        </div>
      </FormSection>

      {/* ── ③ 옵션 — 읽기 전용(공통값) ──────────────────────────────────── */}
      <CommonInfoSection
        id="lotteon-section-options"
        title={sectionTitle("OPTIONS")}
        description="옵션과 재고는 상품정보의 값을 그대로 씁니다 — 롯데ON에서 조합을 따로 만들지 않습니다."
        rows={rowsOf("옵션", "재고")}
        onEditCommonInfo={onEditCommonInfo}
      />

      {/* ── ④ 가격 — 읽기 전용(공통값) ──────────────────────────────────── */}
      <CommonInfoSection
        id="lotteon-section-price"
        title={sectionTitle("PRICE")}
        description="판매가격은 상품정보의 가격 계산 결과 하나뿐입니다 — 채널마다 다시 정하지 않습니다."
        rows={rowsOf("판매가격")}
        onEditCommonInfo={onEditCommonInfo}
      />

      {/* ── ⑥ 배송 ──────────────────────────────────────────────────────── */}
      <FormSection
        id="lotteon-section-delivery"
        title={sectionTitle("SHIPPING", "롯데ON 전용")}
        description="출고지 · 반품지 · 배송비 정책은 롯데ON 판매자센터에 먼저 등록해야 생기는 번호입니다. 우리가 만들 수 없습니다."
      >
        {/*
          REWORK(2026-09-14) — 여기 있는 칸들이 "왜 셀러 설정에서 자동으로 오지
          않는가"를 화면에 적는다. 위 ② 셀러 설정 정보가 같은 판정(코드체계가
          다름 / 개념 자체가 없음)을 이미 보여주고 있고, 두 섹션이 다른 말을
          하지 않도록 문장의 출처를 한 함수로 묶어 두었다.
        */}
        <p className="mb-3 rounded-md bg-background px-3 py-2 text-[11px] text-text-secondary">
          이 번호들은 <b>셀러 설정에서 자동으로 채울 수 없습니다.</b> 출고지·반품지·택배사는 셀러 설정에 같은 개념이
          있지만 쿠팡/스마트스토어 코드체계라 롯데ON에 그대로 쓸 수 없고, 배송비정책번호·배송가능지역코드·반품택배사코드는
          셀러 설정에 그 개념 자체가 없습니다 — 위 <b>② 셀러 설정 정보</b>에 항목별 사유를 적어 두었습니다. 발송예정일수는
          셀러 설정의 <b>출고 소요일</b>이 자동으로 들어갑니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="출고지번호 (owhpNo)"
            hint="롯데ON에 선등록된 출고지"
            value={form.delivery.outboundPlaceNo}
            onChange={(value) => patch("delivery", { outboundPlaceNo: value })}
          />
          <TextField
            label="반품지번호 (rtrpNo)"
            hint="롯데ON에 선등록된 회수지"
            value={form.delivery.returnPlaceNo}
            onChange={(value) => patch("delivery", { returnPlaceNo: value })}
          />
          <TextField
            label="배송비정책번호 (dvCstPolNo)"
            hint="롯데ON에 선등록된 배송비 정책"
            value={form.delivery.deliveryCostPolicyNo}
            onChange={(value) => patch("delivery", { deliveryCostPolicyNo: value })}
          />
          <TextField
            label="배송가능지역코드 (dvRgsprGrpCd)"
            hint="공통코드 DV_RGSPR_GRP_CD"
            value={form.delivery.deliveryRegionGroupCode}
            onChange={(value) => patch("delivery", { deliveryRegionGroupCode: value })}
          />
          <TextField
            label="택배사코드 (hdcCd)"
            hint="공통코드 DV_CO_CD (예: 0001 롯데택배)"
            value={form.delivery.courierCode}
            onChange={(value) => patch("delivery", { courierCode: value })}
          />
          <TextField
            label="반품택배사코드 (rtngHdcCd)"
            value={form.delivery.returnCourierCode}
            onChange={(value) => patch("delivery", { returnCourierCode: value })}
          />
          <TextField
            label="평일 발송마감시간"
            hint="HHMM · 분은 00 또는 30만"
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
        id="lotteon-section-seller-settings"
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
        id="lotteon-section-notice"
        title={sectionTitle("NOTICE", "상품정보제공고시 · 롯데ON 전용")}
        description="품목코드는 표준카테고리를 고르면 함께 따라옵니다. 항목코드 체계는 품목마다 달라 자동으로 만들지 않습니다."
      >
        {selectedCategory && selectedCategory.noticeItemCodes.length > 0 && (
          <p className="mb-3 rounded-md bg-success/5 px-3 py-2 text-[11px] text-text-secondary">
            선택한 표준카테고리({selectedCategory.name})가 알려준 고시 품목코드:{" "}
            {selectedCategory.noticeItemCodes.join(", ")}
          </p>
        )}
        <div className="grid gap-3">
          <TextField
            label="상품품목코드 (pdItmsCd)"
            hint={`고시 품목. ${LOTTEON_CHILD_PRODUCT_ITEM_CODE} = 어린이제품(유아동) — 이 경우 ④ 안전인증이 필수입니다.`}
            value={form.notice.itemCode}
            onChange={(value) => patch("notice", { itemCode: value })}
          />
          <TextAreaField
            label="고시 항목 (pdItmsArtlLst)"
            hint="한 줄에 하나씩 `항목코드:내용`"
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
        id="lotteon-section-certification"
        title={sectionTitle("KC", "안전인증 · 롯데ON 전용")}
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
        <div className="grid gap-3">
          <TextAreaField
            label="안전인증 목록 (sftyAthnLst)"
            hint="한 줄에 하나씩 `유형코드:인증번호[:기관명]`"
            placeholder={"CHL_CFM:CB123456789"}
            value={form.certification.safetyText}
            onChange={(value) => patch("certification", { safetyText: value })}
          />
          <TextField
            label="수입대행코드 (impPrxCd)"
            hint="전기용품·생활용품 계열 KC 인증을 넣으면 필수 — PUR_PRX / PRL_IMP / NONE. 어린이제품(CHL_*)에는 필요 없습니다."
            value={form.certification.importProxyCode}
            onChange={(value) => patch("certification", { importProxyCode: value })}
          />
        </div>
      </FormSection>

      {/* ── ⑨ 상세설명 — 읽기 전용(공통값) ──────────────────────────────── */}
      <CommonInfoSection
        id="lotteon-section-description"
        title={sectionTitle("DESCRIPTION")}
        description="대표이미지와 상세페이지는 상품정보 + 셀러 공통 상세블록에서 조립됩니다 — 스마트스토어·쿠팡과 같은 조립 경로입니다."
        rows={rowsOf("대표이미지", "상세페이지")}
        onEditCommonInfo={onEditCommonInfo}
      />

      {/* ── ⑩ 등록정보 — 읽기 전용(실제 전송 데이터) ────────────────────── */}
      <FormSection
        id="lotteon-section-payload"
        title={sectionTitle("LISTING_INFO")}
        description="이 화면의 값으로 실제 롯데ON에 나갈 데이터입니다. 여기서 고치지 않습니다 — 위 섹션을 고치면 이 내용이 따라옵니다."
      >

        {validation && (
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-text-primary">
              등록 정보 확인 — 준비 {validation.readyCount} · 누락 {validation.missingCount} · 차단{" "}
              {validation.blockedCount}
            </p>
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

      {/* ── 롯데ON 고유 관리정보 (⑦) ───────────────────────────────────── */}
      <GroupHeading
        title="롯데ON 고유 관리정보"
        description="롯데ON 코드체계를 따르는 값입니다 — 상품정보의 텍스트나 셀러 설정에서 코드를 정할 수 없습니다."
      />

      <FormSection
        id="lotteon-section-codes"
        title="그 밖의 롯데ON 코드 (채널 고유)"
        description="원산지·과세·브랜드는 롯데ON 코드체계를 따릅니다 — 상품정보의 원산지 텍스트로는 코드를 정할 수 없습니다."
      >
        {product.countryOfOrigin.value.trim() && (
          <p className="mb-3 text-[11px] text-text-tertiary">
            참고 — 상품정보의 원산지: <b className="text-text-secondary">{product.countryOfOrigin.value}</b>. 이 텍스트로
            롯데ON 코드를 정할 수 없어서 코드는 따로 고릅니다(추론하지 않습니다).
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="원산지코드 (oplcCd)"
            hint="공통코드 OPLC_CD"
            value={form.codes.originCode}
            onChange={(value) => patch("codes", { originCode: value })}
          />
          <TextField
            label="과세유형코드 (tdfDvsCd)"
            hint="01 과세 · 02 면세 · 03 영세 · 04 해당없음. 표준카테고리를 고르면 그 카테고리 값으로 채워집니다."
            value={form.codes.taxTypeCode}
            onChange={(value) => patch("codes", { taxTypeCode: value })}
          />
          <TextField
            label="브랜드번호 (brdNo)"
            hint="속성모듈(204) 조회 결과. 없으면 비워둡니다"
            value={form.codes.brandNo}
            onChange={(value) => patch("codes", { brandNo: value })}
          />
          <TextField
            label="업체상품번호 (epdNo)"
            hint="우리 쪽 식별자. 등록 후 상품 상태 조회(93)에 씁니다"
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
    </div>
  );

  return <ChannelRegistrationFrame detail={detail} summary={summary} />;
}

/** 이 탭 안의 섹션으로 데려간다. 서버 렌더(테스트)에서는 document가 없으므로 조용히 아무 일도 하지 않는다. */
function scrollToSection(id: string) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * §18 — 등록을 막는 필수 조건 목록.
 *
 * 라벨과 사유는 **서버가 준 문장 그대로**다(field.label / field.reason). 화면이
 * 다시 쓰면 서버가 막는 이유와 화면이 말하는 이유가 갈라진다.
 */
function BlockingConditionList({ fields }: { fields: LotteOnValidationField[] }) {
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {fields.map((field) => (
        <li key={field.field} className="flex gap-2">
          <span className={field.status === "BLOCKED" ? "text-error" : "text-warning"}>
            {field.status === "BLOCKED" ? "■" : "▲"}
          </span>
          <span className="text-text-secondary">
            <b className="text-text-primary">{field.label}</b>
            {field.reason ? ` — ${field.reason}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "error" | "muted" }) {
  const dot = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : tone === "error" ? "text-error" : "text-text-tertiary";
  return (
    <li className="flex gap-2">
      <span className={dot}>●</span>
      <span className="text-text-secondary">
        <b className="text-text-primary">{label}</b> — {value}
      </span>
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
 * 두 가지만 맞춰준다:
 *  1. `description`은 CollapsibleSection의 `summary` 자리로 간다(접었을 때도
 *     보이는 한 줄 — 그 컴포넌트가 이미 그 용도로 갖고 있는 슬롯이다).
 *  2. `action`(버튼/링크)은 **본문 안**으로 내린다. CollapsibleSection의 머리는
 *     통째로 `<button>`이라 그 안에 버튼을 넣으면 중첩 버튼이 된다.
 *
 * `defaultOpen`은 true다 — 오늘 화면에서 보이던 것이 내일 사라지지 않게 한다.
 * 달라지는 것은 **접을 수 있게 됐다**는 것뿐이고, 그게 "긴 단일 컬럼"을 스마트
 * 스토어·쿠팡과 같은 길이로 만드는 수단이다.
 */
function FormSection({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <CollapsibleSection id={id} title={title} summary={description} defaultOpen>
      {action && <div className="mb-3 flex flex-wrap items-center justify-end gap-2">{action}</div>}
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
  rows,
  onEditCommonInfo,
}: {
  id: string;
  title: string;
  description: string;
  rows: CommonProductRow[];
  onEditCommonInfo: () => void;
}) {
  const hasMissing = rows.some((row) => row.missing);
  return (
    <FormSection
      id={id}
      title={title}
      description={description}
      action={
        <Button variant="secondary" size="sm" onClick={onEditCommonInfo}>
          상품정보에서 수정
        </Button>
      }
    >
      <dl className="divide-y divide-border text-xs">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-0.5 py-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
            <dt className="font-medium text-text-secondary">{row.label}</dt>
            <dd>
              {row.value ? (
                <span className="text-text-primary">{row.value}</span>
              ) : (
                <span className="text-warning">입력 필요 — 상품정보에서 채워주세요</span>
              )}
              <span className="ml-2 text-[11px] text-text-tertiary">{row.origin}</span>
            </dd>
          </div>
        ))}
      </dl>
      {hasMissing && (
        <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-[11px] text-warning">
          비어 있는 항목은 롯데ON 탭에서 채울 수 없습니다 — 상품정보에서 채우면 이 표와 등록 정보가 함께 갱신됩니다.
        </p>
      )}
    </FormSection>
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
  onPick,
}: {
  state: RecommendState;
  pickedId: string;
  onPick: (candidate: LotteOnCategoryCandidate) => void;
}) {
  if (state.loading) {
    return <p className="mb-3 text-[11px] text-text-tertiary">롯데ON 표준카테고리를 읽어 상품과 대조하는 중…</p>;
  }
  if (state.error) {
    return <p className="mb-3 rounded-md bg-error/5 px-3 py-2 text-[11px] text-error">{state.error}</p>;
  }
  if (state.decision == null) {
    return (
      <p className="mb-3 text-[11px] text-text-tertiary">
        [카테고리 추천]을 누르면 이 상품의 연령대·성별·상품유형 신호로 롯데ON 표준카테고리 후보를 골라 드립니다 —
        스마트스토어·쿠팡 추천과 같은 판단 기준을 씁니다.
      </p>
    );
  }
  return (
    <div className="mb-3 rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] font-medium text-text-secondary">
        {state.decision === "AUTO_SELECT"
          ? "추천 — 상품과 잘 맞는 카테고리를 찾았습니다."
          : state.decision === "RECOMMEND"
            ? "추천 — 후보를 골랐지만 확신이 높지는 않습니다. 확인하고 골라 주세요."
            : "추천할 수 있는 카테고리를 찾지 못했습니다 — 아래에서 직접 찾아 주세요."}
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
      {state.candidates.length > 0 && (
        <ul className="mt-2 space-y-1">
          {state.candidates.map((candidate) => (
            <li key={candidate.category.id}>
              <button
                type="button"
                onClick={() => onPick(candidate)}
                className={`w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-surface ${
                  pickedId === candidate.category.id ? "bg-surface ring-1 ring-primary" : ""
                }`}
              >
                <span className="font-medium text-text-primary">{candidate.path.join(" › ")}</span>
                <span className="ml-2 font-mono text-text-tertiary">{candidate.category.id}</span>
                <span
                  className={`ml-2 ${candidate.conflict ? "text-error" : candidate.score >= 95 ? "text-success" : "text-warning"}`}
                >
                  {candidate.score}점{candidate.conflict ? " · 다른 도메인으로 보임" : ""}
                </span>
                <span className="block text-text-tertiary">{candidate.reason}</span>
                <span className="block text-text-tertiary">
                  전시카테고리 {candidate.category.displayCategories.length}개
                  {candidate.category.noticeItemCodes.length > 0
                    ? ` · 고시 품목 ${candidate.category.noticeItemCodes.join("/")}`
                    : ""}
                  {candidate.category.safetyTypeCodes.length > 0
                    ? ` · 안전인증 ${candidate.category.safetyTypeCodes.join("/")}`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 조회 결과. 알아본 항목은 버튼으로, 못 알아본 것은 원문 그대로 보여준다. */
function CategoryLookup({
  title,
  state,
  onLookup,
  onPick,
}: {
  title: string;
  state: CategoryLookupState;
  onLookup: () => void;
  onPick: (code: string) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-text-secondary">{title}</span>
        <Button variant="secondary" size="sm" disabled={state.loading} onClick={onLookup}>
          {state.loading ? "조회 중…" : "조회"}
        </Button>
      </div>
      {state.error && <p className="mt-2 text-[11px] text-error">{state.error}</p>}
      {state.options.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto">
          {state.options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                onClick={() => onPick(option.code)}
                className="w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-text-secondary hover:bg-background"
              >
                <span className="font-mono text-text-primary">{option.code}</span> {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.unrecognized.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-warning">
            응답 {state.unrecognized.length}건의 필드 구조를 아직 확인하지 못했습니다 — 원문을 그대로 보여줍니다.
          </p>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-[10px] text-text-tertiary">
            {JSON.stringify(state.unrecognized.slice(0, 5), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-text-secondary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
    </label>
  );
}

function TextAreaField({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-text-secondary">{label}</span>
      <textarea
        rows={4}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border px-3 py-1.5 font-mono text-xs focus:border-primary focus:outline-none"
      />
      {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
    </label>
  );
}
