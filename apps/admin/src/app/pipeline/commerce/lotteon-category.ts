import type { CanonicalProduct } from "@commerce/shared";
import { resolveProductSignals, scoreCategoryCandidate } from "@commerce/category";

/**
 * LOTTEON COMMERCE SPRINT 4(CEO 확정, 2026-09-14) — 롯데ON 카테고리 **추천**.
 *
 * ── 왜 이 파일이 생겼는가 ─────────────────────────────────────────────────
 * SPRINT 3까지 롯데ON 카테고리는 "조회"였다. 셀러가 번호를 직접 알아내서 칸에
 * 적는 구조다. CEO 확정 요건은 조회가 아니라 **추천**이다 — 스마트스토어/쿠팡과
 * 같이 시스템이 상품을 보고 후보를 제시해야 한다.
 *
 * 🔴 추천 기계장치를 새로 만들지 않는다. 판단은 전부 이미 있는 두 순수 함수가
 * 한다:
 *   resolveProductSignals()   상품 → 연령대/성별/상품유형 신호(+근거)
 *   scoreCategoryCandidate()  (카테고리명, 조상경로, 신호) → 0~100 + 이유 + 충돌
 * 둘 다 플랫폼을 모른다(PlatformId를 인자로 받지 않는다). 쿠팡이 쓰는 바로 그
 * 함수다 — 롯데ON에서 점수 기준이 갈라질 경로가 없다.
 *
 * 이 파일이 새로 하는 일은 **후보를 만드는 것뿐**이다: onpick 205 응답을
 * 표준카테고리 트리로 읽고, 리프마다 조상 경로를 세워서 위 두 함수에 넘긴다.
 *
 * ── 필드명은 추측이 아니다 ────────────────────────────────────────────────
 * 아래 필드명은 전부 롯데ON 공개 API 가이드 **원문**에서 그대로 옮겼다
 * (2026-09-14 무인증 GET으로 확보 — 조사 문서 §12-1의 재현 방법과 같은 경로):
 *
 *   205 표준카테고리 조회 Received Message / Response Sample
 *       std_cat_id · std_cat_nm · upr_std_cat_id · depth_no · leaf_yn · use_yn
 *       disp_list[] { mall_dvs_cd, std_cat_id, disp_cat_id }
 *       pd_Itms_list[] { std_cat_id, pd_Itms_cd }     ← 샘플 표기는 pd_itms_list
 *       attr_list[] { attr_pi_type, attr_id, prio_rnk }
 *       tdf_cd · age_limit_cd
 *       chl_athn · chl_cfm · chl_sups · elc_athn · elc_cfm · elc_sups ·
 *       life_athn · life_cfm · life_sups · life_std · cmcn_athn · cmcn_reg ·
 *       cmcn_tntt · chem_life · chem_bioc · etc
 *   206 전시카테고리 조회
 *       disp_cat_id · disp_cat_nm · upr_disp_cat_id · depth_no · leaf_yn ·
 *       mall_dvs_cd · disp_yn · use_yn
 *
 * ⚠️ 여전히 **실동작으로는 확인하지 못했다**(인증키가 있는 세션에서 한 번도
 * 호출하지 못했다 — 조사 §13-2). 그래서 파서는 문서 원문 필드가 보이면 읽고,
 * 안 보이면 **null을 돌려준다** — 화면이 그때 응답 원문을 그대로 보여준다.
 * 지어낸 필드명으로 "결과 없음"을 만들지 않는다.
 *
 * 🔴 이 파일은 공통 카테고리를 **쓰지 않는다.** 반환 타입 어디에도
 * CategorySelection이 없다 — 롯데ON에서 고른 번호가 스마트스토어/쿠팡
 * categoryMappings로 흘러갈 경로가 타입 수준에서 존재하지 않는다
 * (lotteon-channel-form.ts의 같은 원칙).
 */

/* ── 205 표준카테고리 ────────────────────────────────────────────────────── */

/** 205 응답의 disp_list 한 줄 — 이 표준카테고리에 매핑된 전시카테고리. */
export interface LotteOnMappedDisplayCategory {
  /** mall_dvs_cd. 일반 셀러는 LTON 하나다. */
  mallCode: string;
  /** disp_cat_id — 87 payload의 dcatLst[].lfDcatNo 로 들어간다. */
  displayCategoryId: string;
}

/**
 * 안전인증 플래그(205) → 상품등록(87)의 sftyAthnTypCd 공통코드값.
 *
 * 🔴 `elc_athn → ELC_AHTN` 은 오타가 아니다. 87 문서 원문의 공통코드표가
 * `ELC_AHTN`([전기용품] 안전인증)이라고 적고 있다(205 쪽 플래그명만 `elc_athn`).
 * 우리가 "고쳐서" 보내면 롯데ON이 모르는 코드가 된다.
 */
export const LOTTEON_SAFETY_FLAG_TO_TYPE_CODE: Record<string, string> = {
  chl_athn: "CHL_ATHN",
  chl_cfm: "CHL_CFM",
  chl_sups: "CHL_SUPS",
  elc_athn: "ELC_AHTN",
  elc_cfm: "ELC_CFM",
  elc_sups: "ELC_SUPS",
  life_athn: "LIFE_ATHN",
  life_cfm: "LIFE_CFM",
  life_sups: "LIFE_SUPS",
  life_std: "LIFE_STD",
  cmcn_athn: "CMCN_ATHN",
  cmcn_reg: "CMCN_REG",
  cmcn_tntt: "CMCN_TNTT",
  chem_life: "CHEM_LIFE",
  chem_bioc: "CHEM_BIOC",
  etc: "ETC",
};

/** 사람이 읽는 안전인증 유형 이름 — 87 문서 공통코드표의 코드명 그대로. */
export const LOTTEON_SAFETY_TYPE_LABEL: Record<string, string> = {
  CHL_ATHN: "[어린이제품] 안전인증",
  CHL_CFM: "[어린이제품] 안전확인",
  CHL_SUPS: "[어린이제품] 공급자적합성확인",
  ELC_AHTN: "[전기용품] 안전인증",
  ELC_CFM: "[전기용품] 안전확인",
  ELC_SUPS: "[전기용품] 공급자적합성확인",
  LIFE_ATHN: "[생활용품] 안전인증",
  LIFE_CFM: "[생활용품] 안전확인",
  LIFE_SUPS: "[생활용품] 공급자적합성확인",
  LIFE_STD: "[생활용품] 안전기준준수",
  CMCN_ATHN: "[방송통신기자재] 적합인증",
  CMCN_REG: "[방송통신기자재] 적합등록",
  CMCN_TNTT: "[방송통신기자재] 잠정인증",
  CHEM_LIFE: "[생활화학제품] 안전기준적합확인신고번호",
  CHEM_BIOC: "[살생물제품] 승인번호",
  ETC: "KC기타",
};

export interface LotteOnStandardCategory {
  /** std_cat_id — 87 payload의 scatNo. */
  id: string;
  /** std_cat_nm. */
  name: string;
  /** upr_std_cat_id. 최상위는 "0"이거나 비어 있다. */
  parentId: string | null;
  /** depth_no. 못 읽으면 null(0으로 지어내지 않는다). */
  depth: number | null;
  /** leaf_yn === "Y". 87의 scatNo는 리프여야 한다. */
  leaf: boolean;
  /** use_yn !== "N". */
  usable: boolean;
  /** disp_list — 이 표준카테고리에 매핑된 전시카테고리. dcatLst 후보다. */
  displayCategories: LotteOnMappedDisplayCategory[];
  /** pd_Itms_list의 pd_Itms_cd — 고시 상품품목코드(pdItmsCd) 후보. */
  noticeItemCodes: string[];
  /** tdf_cd — 과세구분코드(tdfDvsCd). */
  taxTypeCode: string | null;
  /** age_limit_cd — 나이제한코드(ageLmtCd). */
  ageLimitCode: string | null;
  /** 이 카테고리가 요구하는 안전인증 유형코드(sftyAthnTypCd) 목록. */
  safetyTypeCodes: string[];
}

function readString(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readArray(source: Record<string, unknown>, ...keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object");
  }
  return [];
}

/** 플래그가 "켜져 있다"의 정의 — 문서상 길이 1 문자열이고 샘플은 빈 문자열이다.
 * 빈 문자열/N/0 이 아닌 값만 켜진 것으로 본다(값 체계를 지어내지 않고,
 * 비어있음만 확실히 꺼진 것으로 취급한다). */
function isFlagOn(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.toUpperCase() !== "N" && trimmed !== "0";
}

/**
 * 205 응답 한 건 → 표준카테고리. 문서 원문의 필수 필드(std_cat_id/std_cat_nm)를
 * 못 찾으면 **null**이다 — 화면이 원문을 그대로 보여준다.
 */
export function parseLotteOnStandardCategory(raw: unknown): LotteOnStandardCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const id = readString(source, "std_cat_id");
  const name = readString(source, "std_cat_nm");
  if (!id || !name) return null;

  const parentIdRaw = readString(source, "upr_std_cat_id");
  const depthRaw = readString(source, "depth_no");
  const depth = depthRaw != null && /^\d+$/.test(depthRaw) ? Number(depthRaw) : null;

  const safetyTypeCodes: string[] = [];
  for (const [flag, code] of Object.entries(LOTTEON_SAFETY_FLAG_TO_TYPE_CODE)) {
    if (isFlagOn(source[flag])) safetyTypeCodes.push(code);
  }

  return {
    id,
    name,
    // "0"은 문서 샘플의 최상위 표기다(206 upr_disp_cat_id: "0"). 부모 없음으로 읽는다.
    parentId: parentIdRaw && parentIdRaw !== "0" && parentIdRaw !== id ? parentIdRaw : null,
    depth,
    leaf: readString(source, "leaf_yn")?.toUpperCase() === "Y",
    usable: readString(source, "use_yn")?.toUpperCase() !== "N",
    displayCategories: readArray(source, "disp_list")
      .map((entry) => {
        const displayCategoryId = readString(entry, "disp_cat_id");
        if (!displayCategoryId) return null;
        return { mallCode: readString(entry, "mall_dvs_cd") ?? "LTON", displayCategoryId };
      })
      .filter((entry): entry is LotteOnMappedDisplayCategory => entry != null),
    // 문서 표는 pd_Itms_list/pd_Itms_cd, 응답 샘플은 pd_itms_list로 적혀 있다 —
    // 어느 쪽이 실제인지 확인하지 못했으므로 둘 다 읽는다.
    noticeItemCodes: readArray(source, "pd_Itms_list", "pd_itms_list")
      .map((entry) => readString(entry, "pd_Itms_cd", "pd_itms_cd"))
      .filter((code): code is string => Boolean(code)),
    taxTypeCode: readString(source, "tdf_cd"),
    ageLimitCode: readString(source, "age_limit_cd"),
    safetyTypeCodes,
  };
}

/* ── 206 전시카테고리 ────────────────────────────────────────────────────── */

export interface LotteOnDisplayCategory {
  /** disp_cat_id — 87 payload의 dcatLst[].lfDcatNo. */
  id: string;
  /** disp_cat_nm. */
  name: string;
  parentId: string | null;
  depth: number | null;
  /** leaf_yn === "Y". dcatLst는 **리프 전시카테고리**만 받는다(필드명 lfDcatNo). */
  leaf: boolean;
  usable: boolean;
  /** mall_dvs_cd — dcatLst[].mallCd 로 그대로 들어간다. */
  mallCode: string;
}

export function parseLotteOnDisplayCategory(raw: unknown): LotteOnDisplayCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const id = readString(source, "disp_cat_id");
  const name = readString(source, "disp_cat_nm");
  if (!id || !name) return null;
  const parentIdRaw = readString(source, "upr_disp_cat_id");
  const depthRaw = readString(source, "depth_no");
  return {
    id,
    name,
    parentId: parentIdRaw && parentIdRaw !== "0" && parentIdRaw !== id ? parentIdRaw : null,
    depth: depthRaw != null && /^\d+$/.test(depthRaw) ? Number(depthRaw) : null,
    leaf: readString(source, "leaf_yn")?.toUpperCase() === "Y",
    usable: readString(source, "use_yn")?.toUpperCase() !== "N" && readString(source, "disp_yn")?.toUpperCase() !== "N",
    mallCode: readString(source, "mall_dvs_cd") ?? "LTON",
  };
}

/* ── 추천 ────────────────────────────────────────────────────────────────── */

/**
 * 점수 임계값. 쿠팡 resolver(category-resolver-v3.ts AUTO_SELECT_THRESHOLD)와
 * **같은 95**를 쓴다 — 같은 scoreCategoryCandidate() 점수를 놓고 채널마다 다른
 * 기준을 쓰면 "쿠팡은 자동인데 롯데ON은 아니다"가 설명 불가능해진다.
 */
export const LOTTEON_AUTO_SELECT_THRESHOLD = 95;

export interface LotteOnCategoryCandidate {
  category: LotteOnStandardCategory;
  /** 최상위 → 이 카테고리 순서의 이름 경로. */
  path: string[];
  /** 0~100. scoreCategoryCandidate() 결과 그대로. */
  score: number;
  /** 왜 이 점수인지 — 그대로 화면에 보여준다. */
  reason: string;
  /** 상품유형과 명백히 다른 도메인. 자동 선택 대상에서 제외된다. */
  conflict: boolean;
}

export interface LotteOnCategoryRecommendation {
  decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT";
  candidates: LotteOnCategoryCandidate[];
  /** resolveProductSignals()가 남긴 근거 문장 — "왜 이 후보인가"의 앞쪽 절반. */
  signalEvidence: string[];
  /** 점수를 매긴 리프 카테고리 수. 0이면 트리를 못 읽은 것이다. */
  scannedLeafCount: number;
  /** 응답에서 표준카테고리로 읽히지 않은 항목 수. 0이 아니면 파서와 실응답이
   * 어긋난다는 뜻이다 — 조용히 넘기지 않고 화면에 적는다. */
  unrecognizedCount: number;
}

/** 리프까지의 이름 경로를 세운다. 부모를 못 찾으면 거기서 멈춘다(지어내지 않는다). */
export function buildLotteOnCategoryPath(
  category: LotteOnStandardCategory,
  byId: Map<string, LotteOnStandardCategory>,
): string[] {
  const path: string[] = [category.name];
  const seen = new Set<string>([category.id]);
  let cursor = category.parentId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const parent = byId.get(cursor);
    if (!parent) break;
    path.unshift(parent.name);
    cursor = parent.parentId;
  }
  return path;
}

/**
 * 표준카테고리 목록 + 상품 → 추천.
 *
 * 🔴 **표준카테고리만 추천한다.** 전시카테고리는 따로 추천하지 않는다 —
 * 205 응답의 `disp_list`가 "이 표준카테고리에 매핑된 전시카테고리"를 직접
 * 알려주고, 87의 `dcatLst`에는 그중 1개 이상을 넣게 돼 있다. 전시를 따로
 * 점수 매기면 표준과 짝이 안 맞는 조합을 만들 수 있다(등록이 거절된다).
 *
 * 고시 품목코드(pdItmsCd) · 과세구분(tdfDvsCd) · 나이제한 · 요구 안전인증
 * 유형도 같은 응답에 함께 실려 온다 — 셀러에게 다시 묻지 않는다.
 */
export function recommendLotteOnStandardCategories(
  product: Pick<
    CanonicalProduct,
    | "title"
    | "description"
    | "brand"
    | "recommendedAge"
    | "breadcrumbPath"
    | "jsonLdCategory"
    | "sourceUrl"
    | "shopifyTags"
    | "shopifyProductType"
  >,
  categories: LotteOnStandardCategory[],
  options?: { limit?: number; unrecognizedCount?: number },
): LotteOnCategoryRecommendation {
  const signals = resolveProductSignals(product);
  const byId = new Map(categories.map((category) => [category.id, category]));
  // 87의 scatNo는 리프 표준카테고리다. 사용중지된 것도 후보로 올리지 않는다.
  const leaves = categories.filter((category) => category.leaf && category.usable);

  const candidates: LotteOnCategoryCandidate[] = leaves
    .map((category) => {
      const path = buildLotteOnCategoryPath(category, byId);
      // 마지막 원소는 자기 이름이라 조상 경로만 넘긴다(쿠팡 호출부와 같은 모양).
      const result = scoreCategoryCandidate(category.name, path.slice(0, -1), signals);
      return { category, path, score: result.score, reason: result.reason, conflict: result.conflict };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.limit ?? 10);

  const best = candidates[0];
  const decision: LotteOnCategoryRecommendation["decision"] = !best
    ? "REJECT"
    : best.conflict
      ? "REJECT"
      : // 🔴 metaVerified에 해당하는 "실존 검증"을 따로 하지 않는다 — 할 필요가
        // 없다. 후보 자체가 롯데ON이 방금 돌려준 표준카테고리 목록에서 나왔고,
        // leaf_yn/use_yn까지 그 응답이 말해준 값이다. 쿠팡은 predict API가
        // 트리에 없는 코드를 주는 일이 있어 fetchCategoryMeta로 한 번 더
        // 확인해야 하지만, 여기서는 목록 자체가 출처다.
        best.score >= LOTTEON_AUTO_SELECT_THRESHOLD
        ? "AUTO_SELECT"
        : "RECOMMEND";

  return {
    decision,
    candidates,
    signalEvidence: signals.evidence.map((item) => item.label),
    scannedLeafCount: leaves.length,
    unrecognizedCount: options?.unrecognizedCount ?? 0,
  };
}
