"use client";

import { useEffect, useState } from "react";
import {
  priceAgeTier,
  priceLevelFromVerdict,
  type PriceAgeTier,
  type PriceLevel,
  type UnifiedPriceDecision,
} from "@commerce/pricing";
// P-9-A(대표님 지시, 2026-08-30) — @commerce/crawler 루트 배럴(index.ts)은
// playwright-core/browser-launcher를 함께 export한다. 클라이언트 컴포넌트에서
// 루트로 import하면 Node 전용 모듈(tls/fs)이 브라우저 번들에 끌려 들어와
// next build가 깨진다 — 순수 함수 파일만 직접 가리켜서 배럴을 우회한다.
import { sortDomesticCandidatesByTrust } from "@commerce/crawler/src/comparison-search/display-priority";
import type { MatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

interface SampleListing {
  mallName: string | null;
  priceKrw: number;
  productUrl: string | null;
  checkedAt: string;
  /** N-4.18-G STEP G-4(대표님 지시, 2026-08-25) — 실측된 사이트(RULII)만 값이
   * 있다, 나머지는 null(정가/할인가 구분 미지원). */
  salePriceKrw: number | null;
  originalPriceKrw: number | null;
}

interface SoldOutListing {
  mallName: string | null;
  productUrl: string | null;
  checkedAt: string;
}

/** N-4.07 Sprint(대표님 지시: "출처 + 가격 + 확인시간을 보여준다") — "2시간 전"/
 * "3일 전" 형태. 절대시각은 옆의 오래된 가격 배지/전체 마지막확인 문구가 이미
 * 보여주므로, 리스팅 한 줄에는 상대시간만 짧게 붙인다. */
function relativeTimeFromNow(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

/** N-4.11 STEP1(대표님 지시: "오늘 확인/1~6일/7~30일/30일+를 명확하게") — packages/pricing의
 * priceAgeTier(계산)를 화면 문구로만 옮긴다(새 판정 없음). */
const PRICE_AGE_LABEL: Record<PriceAgeTier, string> = {
  TODAY: "오늘 확인",
  RECENT: "최근 확인",
  STALE: "7일 이상 경과",
  VERY_STALE: "30일 이상 경과",
};

interface RecheckResult {
  icon: string;
  message: string;
}

/** N-4.18-F STEP1(대표님 지시, 2026-08-25: "95%가 나왔다고 단순히 배지만 보여주지
 * 말고 왜 같은 상품인지 근거를 보여줘야 한다") — /api/domestic-price-sources/links가
 * 이제 EXACT(95%+, 이미 자동확정)까지 포함해 전부 돌려준다. 세 등급을 같은 시각
 * 패턴으로 보여준다: 🟢 동일상품(95~100%, 가격비교 자동반영) / 🟡 동일상품 후보
 * (85~94%, 셀러 확인 필요) / ⚪ 유사상품(70~84%, 가격비교 미반영). */
interface DomesticCandidate {
  id: string;
  matchType: "EXACT" | "HIGH_CONFIDENCE" | "REVIEW_REQUIRED";
  matchConfidence: number;
  matchedTitle: string | null;
  matchedBrand: string | null;
  matchReasons: string[];
  /** P-10 STEP 4/5(대표님/CPO 지시, 2026-08-30) — decideCandidateEvidence()가 이미
   * 계산하던 값을 그대로 전달받는다(새 판정 없음). 마이그레이션 030 이전에 저장된
   * 레거시 행은 null — legacy fallback으로 처리한다. */
  matchTruth: MatchTruth | null;
  verified: boolean;
  externalUrl: string;
}

const CANDIDATE_LABEL: Record<DomesticCandidate["matchType"], { icon: string; text: string; note: string }> = {
  EXACT: { icon: "🟢", text: "동일상품", note: "→ 가격비교에 자동 반영" },
  HIGH_CONFIDENCE: { icon: "🟡", text: "동일상품 후보", note: "→ 확인하면 가격비교에 반영됩니다" },
  REVIEW_REQUIRED: { icon: "⚪", text: "유사상품", note: "가격비교에는 반영하지 않습니다" },
};

/** P-7-C STEP 2 후속 실측 발견(2026-08-29, 실제 브라우저 확인) — 이 배지는 지금까지
 * matchType만 보고 정해졌다. P-7-C 이전에는 REVIEW_REQUIRED가 사실상 항상
 * verified=false였으므로 문제가 없었다(예외: conflict조차 이미 false). 하지만
 * P-7-C(deriveMatchTruth 통일)로 REVIEW_REQUIRED + verified=true(식별자 증거로
 * 자동확정, 예: 포레포레 42%)가 실제로 생기면서, matchType만 보는 이 배지가 이미
 * Market Intelligence에 반영된 후보를 "가격비교에는 반영하지 않습니다"로 잘못
 * 보여주는 게 실제 프로덕션 데이터(PèPè)로 확인됐다. verified를 최우선으로 본다
 * — 실제로 반영 여부를 결정하는 단일 필드는 matchType이 아니라 verified다
 * (run-domestic-price-check.ts STEP 2: verified===true인 링크만 가격을 저장). */
/** P-8 STEP 3(대표님 지시, 2026-08-30) — "셀러에게 중요한 것은 '몇 % 닮았나'보다
 * '실제로 가격 비교에 사용 가능한 검증 상품인가'이다." 검증된(verified=true)
 * 후보의 헤드라인에서는 텍스트 유사도 %를 강조하지 않는다 — 42%처럼 낮은 숫자가
 * "그런데 왜 동일상품이지?"라는 혼란을 준다(Pepe Shoes 실측). % 자체는 지우지
 * 않고 아래 matchReasons 상세 목록(이미 "상품명 유사도 22%" 줄이 있음)으로만
 * 내려보낸다 — 새 판정을 하지 않고 표시 위치만 바꾼다. */
/** P-10 STEP 6(대표님/CPO 지시, 2026-08-30) — matchTruth 6단계별 화면 문구.
 * "동일상품 반영 여부"(note)는 여기서 새로 정하지 않고 항상 c.verified를 그대로
 * 따른다 — matchTruth 카테고리별로 새 자동확정 규칙을 만들지 않는다는 STEP 0
 * 절대 원칙 그대로. TEXT_CONFIRMED조차 verified=true가 될 수 있는 이유는
 * toDomesticMatchType()의 기존 autoVerified(matchLevel=very_high) 판정
 * 때문이며, 이 파일은 그 결과를 그대로 읽기만 한다. */
const MATCH_TRUTH_DISPLAY: Record<MatchTruth, { icon: "🟢" | "⚪" | "🔴"; text: string }> = {
  EXACT_IDENTIFIER: { icon: "🟢", text: "동일상품 확인됨 — 정확한 상품 식별자 일치" },
  STRONG_IDENTIFIER: { icon: "🟢", text: "동일상품 확인됨(식별자 기반 검증)" },
  TEXT_CONFIRMED: { icon: "🟢", text: "높은 상품명 일치 — 동일상품 가능성이 높음" },
  SIMILAR: { icon: "⚪", text: "유사상품" },
  INSUFFICIENT_EVIDENCE: { icon: "⚪", text: "판단 근거 부족 — 동일상품 여부를 확인하지 못했습니다" },
  CONFLICT: { icon: "🔴", text: "다른 상품 가능성 높음 — 식별자 정보가 충돌합니다" },
};

export function candidateLabel(c: DomesticCandidate): { icon: string; text: string; note: string } {
  if (c.matchTruth) {
    const base = MATCH_TRUTH_DISPLAY[c.matchTruth];
    if (c.matchTruth === "SIMILAR") {
      const pct = Math.round(c.matchConfidence * 100);
      return { ...base, note: `텍스트 유사도 ${pct}% · 가격비교에는 반영하지 않습니다` };
    }
    return { ...base, note: c.verified ? "→ 가격비교에 반영됨" : "가격비교에는 반영하지 않습니다" };
  }
  // 레거시 fallback(matchTruth=null, 마이그레이션 030 이전 저장된 행) — 예전 로직 그대로.
  if (c.verified) {
    const byIdentifier = c.matchReasons.some((r) => r.includes("식별자 근거"));
    return {
      icon: "🟢",
      text: byIdentifier ? "동일상품 확인됨(식별자 기반 검증)" : "동일상품 확인됨",
      note: "→ 가격비교에 반영됨",
    };
  }
  if (c.matchType === "HIGH_CONFIDENCE") return CANDIDATE_LABEL.HIGH_CONFIDENCE;
  return CANDIDATE_LABEL.REVIEW_REQUIRED;
}

/** match.ts(scoreCandidateMatch)가 이미 낸 matchReasons 문자열을 그대로 화면에
 * 옮긴다 — 새 판정 로직을 만들지 않는다. "불일치"가 포함되면 ✕, "모델명 유사도"는
 * 퍼센트가 50% 이상이면 ✓ 아니면 △, 그 외(일치류)는 ✓.
 *
 * N-4.18-Q3 UI 후속(대표님 지시, 2026-08-27) — H-3-6 Evidence Decision이
 * 이제 unchanged일 때도 matchReasons에 modelCode/options/image 문구를 남긴다
 * (run-domestic-price-check.ts applyEvidenceDecision 참고). 이 문구들은 기존
 * "불일치"/"모델명 유사도" 패턴과 다른 어휘를 쓰므로("충돌", "완전 일치", "부분
 * 일치", "강하게 일치", "약한 긍정") 그대로 두면 전부 기본값 ✓로 렌더링돼
 * "modelCode 충돌"(사실은 경고)까지 체크마크로 보이는 오표시가 있었다 — 실제
 * H-3-9 프로덕션 데이터(PèPè)로 확인. */
function reasonIcon(reason: string): "✓" | "✕" | "△" {
  if (reason.includes("불일치") || reason.includes("충돌")) return "✕";
  if (reason.includes("부분 일치") || reason.includes("약한 긍정")) return "△";
  if (reason.includes("완전 일치") || reason.includes("강하게 일치")) return "✓";
  if (reason.startsWith("모델명 유사도")) {
    const pct = Number(/(\d+)%/.exec(reason)?.[1] ?? 0);
    return pct >= 50 ? "✓" : "△";
  }
  return "✓";
}

/** 서버 문구를 그대로 쓰되, CEO 예시 문구("상품명 유사")에 맞춰 "모델명"만
 * "상품명"으로 표기를 통일한다(값 자체는 안 바꿈, 라벨만). */
function reasonLabel(reason: string): string {
  return reason.replace("모델명 유사도", "상품명 유사도").replace(/^SKU /, "SKU/품번 ");
}

/** N-4.18-F STEP2(대표님 지시: "정보 없음은 감점하지 않되, 없다는 사실 자체는
 * 보여준다") — matchReasons에 해당 신호가 아예 언급되지 않았다면(둘 중 한쪽에
 * 정보가 없어 애초에 채점되지 않은 것) "정보 없음"으로 표시한다.
 *
 * N-4.18-I STEP I-7(대표님 지시, 2026-08-25) — 카테고리 신호가 이제 실제로
 * 존재한다(match.ts extractCategoryTaxon, 실측된 제목 텍스트 상품유형 단어
 * 기반). "카테고리 일치"/"카테고리 불일치" reason이 실제로 있으면(즉 양쪽 다
 * taxon이 확인됐으면) 더는 "정보 없음"이라고 지어내지 않는다 — reasons에
 * 언급이 전혀 없을 때만(한쪽이라도 상품유형 단어가 없어 판정 자체를 못한
 * 경우) "카테고리 정보 없음"을 보여준다. */
function missingSignalNotes(reasons: string[]): string[] {
  const notes: string[] = [];
  if (!reasons.some((r) => r.includes("SKU"))) notes.push("품번 정보 없음");
  if (!reasons.some((r) => r.includes("색상"))) notes.push("색상 정보 없음");
  if (!reasons.some((r) => r.includes("카테고리"))) notes.push("카테고리 정보 없음");
  return notes;
}

/** N-4.11 STEP2 / N-4.18-C(대표님 지시, 2026-08-25) — /api/price-history/check
 * 응답을 판매자가 이해할 수 있는 한 줄로 요약한다. run-price-check.ts는
 * 이제 해외 원가(SELLER_ORIGIN)만 담당하고, 국내가격비교는 domesticShop
 * 필드(국내 편집샵 domestic_price_sources 기반 runDomesticPriceCheck)가
 * 전담한다 — 둘을 합쳐서 하나의 문장으로 만든다(네이버 쇼핑 검색 경로
 * 제거로 PARTIAL/NOT_CONFIGURED 상태 자체가 더 이상 나오지 않는다). */
function summarizeRecheckResult(json: {
  status?: string;
  savedCount?: number;
  errors?: string[];
  domesticShop?: { pricesRecorded: number; linksCreatedOrUpdated: number; sourceErrors: string[] };
}): RecheckResult {
  const domesticSaved = json.domesticShop?.pricesRecorded ?? 0;
  const domesticLinks = json.domesticShop?.linksCreatedOrUpdated ?? 0;

  if (json.status !== "SUCCESS" && json.status !== "NO_RESULT") {
    return { icon: "🔴", message: json.errors?.[0] ?? "원가 확인 중 오류가 발생했습니다." };
  }

  const originMessage = json.status === "SUCCESS" ? "원가를 확인했습니다" : "원가를 확인하지 못했습니다";
  if (domesticSaved > 0) {
    return { icon: "🟢", message: `${originMessage}. 국내 편집샵 ${domesticSaved}건의 가격도 확인했습니다.` };
  }
  if (domesticLinks > 0) {
    return {
      icon: "🟡",
      message: `${originMessage}. 국내 편집샵에서 비슷한 상품 후보는 찾았지만, 아직 검증된 가격은 없습니다.`,
    };
  }
  return { icon: "⚪", message: `${originMessage}. 일치하는 국내 편집샵 판매처는 아직 찾지 못했습니다.` };
}

interface DomesticCompetition {
  tier: "PRIMARY" | "SECONDARY" | "NONE";
  lowestPriceKrw: number | null;
  highestPriceKrw: number | null;
  averagePriceKrw: number | null;
  sellerCount: number;
  sampleListings: SampleListing[];
  /** N-4.18-G STEP G-4 — 최저/평균/최고가 계산에서 제외된, 실제 품절 확인된
   * 리스팅. 가격표에는 안 넣고 별도로 보여준다. */
  soldOutListings: SoldOutListing[];
  checkedAt: string | null;
}

interface Decision {
  verdict: "MAINTAIN" | "CONSIDER_LOWER" | "MARGIN_RISK";
  marginPercent: number;
  priceGapVsAveragePercent: number | null;
  /** N-4.18-H(대표님 지시, 2026-08-25) — computePriceDecision()이 이제 최저가
   * 대비 gap도 함께 낸다. */
  priceGapVsLowestPercent: number | null;
  reason: string;
}

/** N-4.18-H-2(대표님 지시, 2026-08-25) — "그래서 지금 무엇을 해야 하는가"를
 * 상품 단위로 제안하는 값. 서버(computeSellerAction)가 이미 계산해 돌려주는
 * status/title/signals/reasons를 그대로 옮긴다 — 여기서 새 판정을 하지 않는다. */
interface SellerActionSignal {
  icon: string;
  title: string;
  detail: string;
}

interface SellerAction {
  status: "PRICE_KEEP" | "PRICE_REVIEW" | "PRICE_ADJUST" | "INSUFFICIENT_DATA";
  icon: string;
  title: string;
  signals: SellerActionSignal[];
  reasons: string[];
  /** N-4.18-J STEP J-10 — "지금 유리한 점"(있을 때만, 최대 1건). */
  opportunity: SellerActionSignal | null;
}

/** N-4.18-K STEP K-3/K-5(대표님 지시, 2026-08-26) — price_alerts에 저장된
 * "확인 가치가 있는 변화"만 여기 표시한다. sellerAction(위)은 항상 최신
 * 계산값을 보여주지만, 이 목록은 "언제부터 이 상태였는지"(K-4 중복방지로
 * 최초 1회만 열림)를 셀러가 확인/해소 여부와 함께 볼 수 있게 한다. */
interface PriceAlert {
  id: string;
  category: "PRICE_GAP" | "OPPORTUNITY" | "ORIGIN_TREND";
  severity: "ACTION_REQUIRED" | "REVIEW" | "INFO";
  title: string;
  detail: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  openedAt: string;
}

const ALERT_SEVERITY_ICON: Record<PriceAlert["severity"], string> = {
  ACTION_REQUIRED: "🔴",
  REVIEW: "🟡",
  INFO: "🔵",
};

const ALERT_SEVERITY_STYLE: Record<PriceAlert["severity"], string> = {
  ACTION_REQUIRED: "border-error/30 bg-error-soft text-error",
  REVIEW: "border-warning/30 bg-warning-soft text-warning",
  INFO: "border-border bg-background text-text-secondary",
};

const SELLER_ACTION_STYLE: Record<SellerAction["status"], string> = {
  PRICE_KEEP: "border-border bg-success-soft text-success",
  PRICE_REVIEW: "border-border bg-warning-soft text-warning",
  PRICE_ADJUST: "border-border bg-error-soft text-error",
  INSUFFICIENT_DATA: "border-border bg-background text-text-secondary",
};

interface Recommendation {
  minimumPrice: number;
  targetPrice: number;
  competitivePrice: number | null;
  recommendedPrice: number;
}

interface PriceHistoryRecord {
  checkedAt: string;
  priceKrw: number;
}

interface PriceTrend {
  changeRate: number | null;
}

/** N-4.18-Q3(대표님 지시) — computeSellability()가 낸 "등록해도 되는가" 판단.
 * sellerAction(가격 유지/조정 판단)과 별개 — 이건 판매가가 아직 없는 상품도
 * 다룬다(국내 평균가를 잠정 기준가로만 참고). */
interface Sellability {
  level: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  title: string;
  reason: string;
  estimatedMarginPercent: number | null;
}

/** P-8 STEP 2(대표님 지시, 2026-08-30) — "화면 최상단에 대표 판단 1개만 둔다."
 * deriveRepresentativeSellerVerdict(packages/pricing)가 unifiedDecision/
 * sellability를 재계산 없이 압축해 낸 단일 결과. 이 화면은 이 값을 그대로
 * 옮기기만 한다 — 새 판정을 만들지 않는다. */
/** P-9-B(대표님 지시, 2026-08-30) — "국내 동일상품 없음 = 판단 불가"라는
 * 철학을 버린다. MARKET_OPPORTUNITY(🟣)를 새 상태로 추가 — 국내 경쟁 데이터가
 * 없어도(sellability=YELLOW, 비용은 이미 확인됨) "판단 불가"로 끝내지 않고
 * "시장 진입 기회"로 안내한다. */
interface RepresentativeVerdict {
  code: "READY" | "REVIEW_PRICE" | "MARKET_OPPORTUNITY" | "NEEDS_INFO" | "HOLD";
  icon: "🟢" | "🟡" | "🟣" | "🟠" | "🔴";
  title: string;
  description: string;
  reasons: string[];
}

const REPRESENTATIVE_VERDICT_STYLE: Record<RepresentativeVerdict["code"], string> = {
  READY: "border-border bg-success-soft text-success",
  REVIEW_PRICE: "border-border bg-warning-soft text-warning",
  MARKET_OPPORTUNITY: "border-border bg-primary-soft text-primary",
  NEEDS_INFO: "border-border bg-warning-soft text-warning",
  HOLD: "border-border bg-error-soft text-error",
};

/** P-8 STEP 5 / P-9 STEP 5(대표님 지시, 2026-08-30) — "버튼을 누르기 전에
 * 셀러가 무엇을 확인하는지 알 수 있게 한다." 새 등록/가격 엔드포인트를 만들지
 * 않는다 — 전부 기존 onRequestPriceReview(가격/비용 탭 이동)로 연결한다. */
const REPRESENTATIVE_VERDICT_CTA: Record<RepresentativeVerdict["code"], { label: string; hint: string }> = {
  READY: { label: "등록 진행", hint: "" },
  REVIEW_PRICE: { label: "판매 가격 다시 설정", hint: "현재 판매가격과 국내 시장가격을 다시 비교합니다." },
  MARKET_OPPORTUNITY: {
    label: "추천 판매가격 검토",
    hint: "국내 경쟁가격은 확인되지 않았습니다. 판매 가격을 설정하면 예상 수익성을 계산할 수 있습니다.",
  },
  NEEDS_INFO: { label: "비용 정보 입력", hint: "예상 수익 계산에 필요한 비용 정보를 입력하세요." },
  HOLD: { label: "가격·매입 조건 재검토", hint: "현재 판매가격과 국내 시장가격을 다시 비교합니다." },
};

interface PriceHistoryResponse {
  ok: boolean;
  product: { title: string; brand: string; sourceUrl: string };
  currentPrice: {
    sellingPriceKrw: number | null;
    costPriceKrw: number | null;
    /** N-4.18-Q3 P0-2 — "KR_MARKET"(실제 한국 표시가 우선) / "ORIGIN_FX"(원문
     * 통화×환율 폴백) / null(이 필드 도입 이전 관측). */
    costBasis: "KR_MARKET" | "ORIGIN_FX" | null;
  };
  domesticCompetition: DomesticCompetition;
  priceHistory: {
    /** N-4.18-J STEP J-6 — "🌎 해외" 블록에 원가 변화(▼/▲%)를 보여주기 위해
     * 이미 서버가 계산해 돌려주는 값을 그대로 읽는다(새 계산 없음). */
    origin: { change: { changeRatePercent: number } | null };
    domesticShop: { records: PriceHistoryRecord[]; trend7d: PriceTrend | null; trend30d: PriceTrend | null };
  };
  fx: { rate: number; isEstimate: boolean } | null;
  /** N-4.18-Q3 PART F-1/F-2(대표님 지시, 2026-08-27) — costKrw(원본가×환율,
   * 마크업 없음)는 computePriceBreakdown이 이미 계산해 API가 항상 돌려주던
   * 값인데 이 화면이 지금까지 landedCostKrw(배송비 포함)만 쓰고 costKrw는
   * 읽지 않았다 — 새 계산이 아니라 이미 있던 값을 추가로 노출하는 것뿐이다. */
  cost: {
    originalAmount: number;
    originalCurrency: string;
    costKrw: number;
    landedCostKrw: number;
    /** P-9 STEP 6(대표님 지시, 2026-08-30) — 이미 computePriceBreakdown()이
     * 판매가 유무와 무관하게 항상 계산해 돌려주던 값(packages/pricing/src/
     * breakdown.ts). 새 추천가격 공식을 만들지 않는다 — 있던 값을 MARKET_
     * OPPORTUNITY 카드에 추가로 노출하는 것뿐이다. */
    suggestedPriceKrw: number;
  } | null;
  decision: Decision | null;
  recommendation: Recommendation | null;
  sellerAction: SellerAction;
  sellability: Sellability;
  /** P-2-3(대표님 지시, 2026-08-28) — 배송비/수수료를 포함한 단일 가격판단
   * 결과. market-intelligence.ts는 이미 이 필드를 응답에 포함하고 있었지만
   * (P-1-3 STEP 6/7) 프론트 타입 선언이 없어 화면에서 못 읽고 있었다 — 새
   * 계산이 아니라 타입 노출만 추가한다. */
  unifiedDecision: UnifiedPriceDecision | null;
  representativeVerdict: RepresentativeVerdict;
}

function TrendBadge({ label, trend }: { label: string; trend: PriceTrend | null }) {
  if (!trend || trend.changeRate == null) return null;
  const rate = trend.changeRate;
  return (
    <span className={rate < 0 ? "text-success" : rate > 0 ? "text-error" : "text-text-tertiary"}>
      {label} {rate > 0 ? "▲" : rate < 0 ? "▼" : ""}
      {Math.abs(rate)}%
    </span>
  );
}

/** N-4.07 2차(대표님 지시: "해외 원가 → 환율 → 국내 경쟁가 → 내 판매가 → 예상 마진을
 * 한 번에 판단") — /api/price-history/[snapshotId]가 이미 계산해둔 값(cost/
 * domesticCompetition/decision/recommendation)을 그대로 화면에 옮기기만 한다.
 * 새 판정 로직을 만들지 않는다 — computePriceDecision/computePriceRecommendation을
 * 그대로 재사용(이 프로젝트의 반복 원칙).
 *
 * 절대 금지(작업지시서 Part 14) — 여기서 판매가를 자동으로 바꾸지 않는다.
 * 읽기 전용 판단 화면이다. */
export type { PriceLevel };

export function DomesticPriceIntelligencePanel({
  snapshotId,
  onPriceLevelChange,
  onRequestPriceReview,
}: {
  snapshotId: string;
  /** N-4.08 STEP6-4와 같은 패턴(onReadinessChange) — 이 패널이 계산한 값을
   * CommerceWorkspace가 탭 배지/상태 요약에 캐싱해서 쓸 수 있게 보고한다. */
  onPriceLevelChange?: (level: PriceLevel) => void;
  /** N-4.18-H-2 STEP H-2-5 — "[가격/마진 확인]" 버튼. 이 패널은 상품정보
   * 탭에서만 마운트되고 PriceEditor는 커머스 플랫폼 탭에만 있어(서로 다른
   * 탭), 실제 이동은 CommerceWorkspace가 탭 전환+스크롤로 처리한다. */
  onRequestPriceReview?: () => void;
}) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  // P-2-3 ④(대표님 지시, 2026-08-28) — "기본 화면에서 바로 10개 이상의 경쟁
  // 가격을 보여주지 않는다." 판매처별 개별 리스팅/추세/이력은 기본 접힘.
  const [showDomesticDetail, setShowDomesticDetail] = useState(false);
  // P-2-3 ⑤(대표님 지시, 2026-08-28) — "왜 이런 판단인가"는 기본적으로 접어둔다.
  const [showReasonDetail, setShowReasonDetail] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [recheckResult, setRecheckResult] = useState<RecheckResult | null>(null);
  const [candidates, setCandidates] = useState<DomesticCandidate[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  function loadPriceHistory(): Promise<void> {
    return fetch(`/api/price-history/${snapshotId}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.ok ? json : null);
      })
      .catch(() => {
        setData(null);
      });
  }

  function loadCandidates(): Promise<void> {
    return fetch(`/api/domestic-price-sources/links?snapshotId=${snapshotId}`)
      .then((res) => res.json())
      .then((json) => {
        setCandidates(json.ok ? sortDomesticCandidatesByTrust(json.candidates) : []);
      })
      .catch(() => {
        setCandidates([]);
      });
  }

  /** N-4.18-K STEP K-5/K-6 — price_alerts(마이그레이션 039 대기 중)가 아직
   * 없으면 API가 빈 배열을 돌려주므로 이 블록은 조용히 아무것도 보여주지
   * 않는다(에러 아님). */
  function loadAlerts(): Promise<void> {
    return fetch(`/api/price-history/${snapshotId}/alerts`)
      .then((res) => res.json())
      .then((json) => {
        setAlerts(json.ok ? json.alerts : []);
      })
      .catch(() => {
        setAlerts([]);
      });
  }

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadPriceHistory(), loadCandidates(), loadAlerts()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId]);

  async function acknowledgeAlert(id: string) {
    if (acknowledgingId) return;
    setAcknowledgingId(id);
    try {
      await fetch(`/api/price-history/${snapshotId}/alerts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: id }),
      });
      await loadAlerts();
    } finally {
      setAcknowledgingId(null);
    }
  }

  useEffect(() => {
    if (loading) return;
    onPriceLevelChange?.(priceLevelFromVerdict(data?.decision?.verdict ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  /** N-4.07 Sprint(대표님 지시: "상품 화면 [가격 다시 확인] 버튼") —
   * /api/price-history/check(기존, UI 연결처 없었음)를 그대로 호출한다.
   * skipIfCheckedToday는 이 경로에서는 안 준다 — 사용자가 명시적으로 "지금
   * 확인"을 눌렀으므로 오늘 이미 확인했어도 다시 시도하는 게 맞다.
   *
   * N-4.11 STEP2(대표님 지시: "검색→매칭→저장을 판매자가 알 수 있게, 성공/
   * 실패/가격없음/매칭실패를 구분") — run-price-check.ts/run-domestic-
   * price-check.ts가 이미 계산해 돌려주는 status/savedCount/domesticShop을
   * 그대로 문장으로 옮긴다. 새 판정을 만들지 않는다 — 서버가 이미 낸 결론을
   * 화면에 정직하게 보여주기만 한다(가짜 진행률 애니메이션을 만들지 않는다
   * — 실제로는 서버가 한 번에 처리하는 요청이다). */
  async function recheckNow() {
    if (rechecking) return; // 중복 클릭 방지 — 버튼도 disabled지만 방어적으로 한 번 더 막는다.
    setRechecking(true);
    setRecheckResult(null);
    try {
      const res = await fetch("/api/price-history/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      if (!res.ok) {
        setRecheckResult({ icon: "🔴", message: "가격 확인 요청이 실패했습니다(서버 오류)." });
      } else {
        const json = (await res.json()) as {
          status?: string;
          savedCount?: number;
          errors?: string[];
          domesticShop?: { pricesRecorded: number; linksCreatedOrUpdated: number; sourceErrors: string[] };
        };
        setRecheckResult(summarizeRecheckResult(json));
      }
      await Promise.all([loadPriceHistory(), loadAlerts()]);
    } catch {
      setRecheckResult({ icon: "🔴", message: "가격 확인 요청이 실패했습니다(네트워크 오류)." });
    } finally {
      setRechecking(false);
    }
  }

  /** N-4.18-F STEP4(대표님 지시: "85~94% [동일상품으로 확인] 클릭 시 REVIEW_REQUIRED
   * → VERIFIED로 승격. 기존 승인/검증 상태 구조를 재사용") — updateDomesticProductLink
   * 를 그대로 호출하는 PATCH 라우트를 부르기만 한다. 새 상태값을 만들지 않는다. */
  async function confirmSameProduct(id: string) {
    if (confirmingId) return;
    setConfirmingId(id);
    try {
      await fetch(`/api/domestic-price-sources/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      });
      await Promise.all([loadCandidates(), loadPriceHistory()]);
    } finally {
      setConfirmingId(null);
    }
  }

  if (loading) return null;
  if (!data) return null;

  const {
    domesticCompetition,
    currentPrice,
    cost,
    fx,
    decision,
    recommendation,
    sellerAction,
    sellability,
    unifiedDecision,
    representativeVerdict,
  } = data;
  const domesticShopHistory = data.priceHistory?.domesticShop ?? null;
  const trend7d = domesticShopHistory?.trend7d ?? null;
  const trend30d = domesticShopHistory?.trend30d ?? null;
  const historyRecords = domesticShopHistory?.records ?? [];
  const originChangeRatePercent = data.priceHistory?.origin?.change?.changeRatePercent ?? null;

  const hasAnyData =
    domesticCompetition.tier !== "NONE" || currentPrice.sellingPriceKrw != null || cost != null;

  return (
    <CollapsibleSection title="Market Intelligence" defaultOpen>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary">{hasAnyData ? "" : "아직 확인된 가격 정보가 없습니다."}</span>
          <button
            type="button"
            onClick={() => void recheckNow()}
            disabled={rechecking}
            className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-background disabled:opacity-50"
          >
            {rechecking ? "확인 중..." : "가격 다시 확인"}
          </button>
        </div>
        {recheckResult && (
          <p className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-text-secondary">
            {recheckResult.icon} {recheckResult.message}
          </p>
        )}
        {!hasAnyData && (
          <p className="text-[10px] text-text-tertiary">
            원본 사이트/등록된 국내 편집샵에서 가격을 조회합니다 — 몇 초 걸릴 수 있습니다.
          </p>
        )}

        {/* P-8 STEP 2/3/4(대표님 지시, 2026-08-30) — "화면 최상단에 대표 판단
            1개만 둔다." 이전에는 이 카드가 unifiedDecision이 없으면(=판매가
            미확정, 현재 프로덕션 대부분) "판단 불가" 헤드라인 아래에 곧바로
            sellability.reason의 GREEN 문구("가격 경쟁력이 있습니다")를 붙여서
            보여줬다 — 헤드라인과 본문이 반대 뉘앙스인 모순이었다(실측:
            Pepe Shoes, Bruno Cut Out Sandals). representativeVerdict(서버가
            unifiedDecision/sellability 중 더 신뢰할 수 있는 쪽을 골라 이미
            압축해 낸 값)를 그대로 헤드라인으로 쓰고, "판단 근거"는 그
            결론과 같은 방향의 사실만 나열한다 — 새 판정을 만들지 않는다. */}
        {hasAnyData && (
          <div className={`rounded-md border p-2.5 ${REPRESENTATIVE_VERDICT_STYLE[representativeVerdict.code]}`}>
            <p className="font-medium">
              {representativeVerdict.icon} {representativeVerdict.title}
            </p>
            <p className="mt-1 text-text-secondary">{representativeVerdict.description}</p>
            {representativeVerdict.reasons.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-text-secondary">
                {representativeVerdict.reasons.map((reason, i) => (
                  <li key={i}>✓ {reason}</li>
                ))}
              </ul>
            )}
            {unifiedDecision && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-text-secondary sm:grid-cols-4">
                <div>
                  <dt className="text-[10px] text-text-tertiary">현재 확인된 구매원가</dt>
                  <dd className="font-medium text-text-primary">
                    ₩{unifiedDecision.landedCostKrw.value.toLocaleString()}
                  </dd>
                </div>
                {unifiedDecision.estimatedProfitKrw.value != null && (
                  <div>
                    <dt className="text-[10px] text-text-tertiary">예상 순이익</dt>
                    <dd className="font-medium text-text-primary">
                      ₩{unifiedDecision.estimatedProfitKrw.value.toLocaleString()}
                    </dd>
                  </div>
                )}
                {unifiedDecision.marginPercent.value != null && (
                  <div>
                    <dt className="text-[10px] text-text-tertiary">예상 마진율</dt>
                    <dd className="font-medium text-text-primary">{unifiedDecision.marginPercent.value}%</dd>
                  </div>
                )}
                {recommendation && (
                  <div>
                    <dt className="text-[10px] text-text-tertiary">권장 판매가(국내 시장 참고)</dt>
                    <dd className="font-medium text-text-primary">
                      ₩{recommendation.recommendedPrice.toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {/* "unknown을 0원처럼 보여주면 안 된다"(대표님 명시) — 알려진
                비용 기준 숫자는 그대로 보여주되, 무엇이 빠졌는지를 항상
                같이 알린다. */}
            {unifiedDecision?.dataCompleteness === "INCOMPLETE" && unifiedDecision.missingComponents.length > 0 && (
              <div className="mt-2 rounded-md border border-current/30 bg-background/60 p-1.5">
                <p className="text-[10px] font-medium">아직 확인되지 않은 비용</p>
                <ul className="mt-0.5 space-y-0.5 text-[10px] text-text-secondary">
                  {unifiedDecision.missingComponents.map((label) => (
                    <li key={label}>• {label}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-text-secondary">실제 마진은 위 표시값보다 낮아질 수 있습니다.</p>
              </div>
            )}
            {/* P-8 STEP 4 — sellability 참고 계산값은 대표 판단과 같은
                레벨의 결론처럼 보이면 안 된다("참고 계산값 ≠ 최종 판단").
                unifiedDecision이 없어 위 판단이 sellability 기준일 때만,
                그 근거 문장을 "참고" 라벨을 붙여 작게 덧붙인다. */}
            {!unifiedDecision && sellability.estimatedMarginPercent != null && (
              <p className="mt-2 text-[10px] text-text-tertiary">참고: {sellability.reason}</p>
            )}
            {/* P-9 STEP 6(대표님 지시, 2026-08-30) — "숫자를 새로 지어내거나
                가짜 추천가격을 만들면 안 된다." cost.suggestedPriceKrw는 이미
                computePriceBreakdown()이 판매가 유무와 무관하게 늘 계산해
                돌려주던 값이다(SellerProfile 기본 마진/수수료 기준) — 새 계산
                없이 MARKET_OPPORTUNITY 카드에서만 추가로 보여준다. */}
            {representativeVerdict.code === "MARKET_OPPORTUNITY" && cost && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-text-secondary">
                <div>
                  <dt className="text-[10px] text-text-tertiary">예상 비용(착지원가)</dt>
                  <dd className="font-medium text-text-primary">₩{cost.landedCostKrw.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-text-tertiary">현재 설정 기준 목표 판매가</dt>
                  <dd className="font-medium text-text-primary">₩{cost.suggestedPriceKrw.toLocaleString()}</dd>
                </div>
              </dl>
            )}
            {(() => {
              const cta = REPRESENTATIVE_VERDICT_CTA[representativeVerdict.code];
              if (!onRequestPriceReview) return null;
              return (
                <>
                  {cta.hint && <p className="mt-2 text-[10px] text-text-tertiary">{cta.hint}</p>}
                  <button
                    type="button"
                    onClick={onRequestPriceReview}
                    className="mt-1.5 rounded-md border border-current px-2 py-1 text-[11px] font-medium hover:opacity-80"
                  >
                    {cta.label}
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* P-2-3 ④ 국내 시장 가격(요약) — 기존 SellerAction 헤드라인의
            핵심 지표(내판매가/국내최저가/평균가/동일상품수/품절수)를 여기로
            옮긴다. "그래서 시장에서 얼마에 팔리는가?"가 이 블록의 유일한
            질문이다 — 판매 판단(위 ①)과는 별개 관심사로 분리한다. */}
        {hasAnyData && (domesticCompetition.tier !== "NONE" || currentPrice.sellingPriceKrw != null) && (
          <div className="rounded-md border border-border bg-background p-2">
            <p className="mb-1 font-medium text-text-primary">🇰🇷 국내 시장 가격</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-text-secondary sm:grid-cols-3">
              {currentPrice.sellingPriceKrw != null && (
                <div>
                  <dt className="text-[10px] text-text-tertiary">내 판매가</dt>
                  <dd className="font-medium text-text-primary">₩{currentPrice.sellingPriceKrw.toLocaleString()}</dd>
                </div>
              )}
              {domesticCompetition.lowestPriceKrw != null && (
                <div>
                  <dt className="text-[10px] text-text-tertiary">국내 최저가</dt>
                  <dd className="font-medium text-text-primary">₩{domesticCompetition.lowestPriceKrw.toLocaleString()}</dd>
                </div>
              )}
              {domesticCompetition.averagePriceKrw != null && (
                <div>
                  <dt className="text-[10px] text-text-tertiary">국내 평균가</dt>
                  <dd className="font-medium text-text-primary">
                    ₩{Math.round(domesticCompetition.averagePriceKrw).toLocaleString()}
                  </dd>
                </div>
              )}
              {domesticCompetition.tier !== "NONE" && (
                <div>
                  <dt className="text-[10px] text-text-tertiary">국내 동일상품</dt>
                  <dd className="font-medium text-text-primary">{domesticCompetition.sellerCount}곳</dd>
                </div>
              )}
              {domesticCompetition.soldOutListings.length > 0 && (
                <div>
                  <dt className="text-[10px] text-text-tertiary">품절</dt>
                  <dd className="font-medium text-text-primary">{domesticCompetition.soldOutListings.length}곳</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* N-4.18-K STEP K-3/K-5/K-6 — 활성 알림(확인/해소 전). price_alerts가
            비어있으면(마이그레이션 대기 또는 변화 없음) 아무것도 표시하지
            않는다 — "변화 없음 → Alert 생성 안 됨"이 UI에도 그대로 반영된다. */}
        {alerts.map((a) => (
          <div key={a.id} className={`rounded-md border p-2.5 ${ALERT_SEVERITY_STYLE[a.severity]}`}>
            <p className="font-medium">
              {ALERT_SEVERITY_ICON[a.severity]} {a.title}
            </p>
            <p className="mt-1 text-text-secondary">{a.detail}</p>
            <div className="mt-2 flex items-center gap-2">
              {a.status === "OPEN" && (
                <button
                  type="button"
                  onClick={() => void acknowledgeAlert(a.id)}
                  disabled={acknowledgingId === a.id}
                  className="rounded-md border border-current px-2 py-1 text-[11px] font-medium hover:opacity-80 disabled:opacity-50"
                >
                  {acknowledgingId === a.id ? "처리 중..." : "확인함"}
                </button>
              )}
              {a.status === "ACKNOWLEDGED" && <span className="text-[10px] text-text-tertiary">✓ 확인함</span>}
              {/* N-4.18-L STEP L-9(대표님 지시, 2026-08-26: "Alert에서 바로
                  행동할 수 있어야 함") — 자동 가격변경은 절대 하지 않는다.
                  기존 handleRequestPriceReview(J-9)와 같은 이동만 한다. */}
              {onRequestPriceReview && (
                <button
                  type="button"
                  onClick={onRequestPriceReview}
                  className="rounded-md border border-current px-2 py-1 text-[11px] font-medium hover:opacity-80"
                >
                  가격/마진 확인
                </button>
              )}
            </div>
          </div>
        ))}

        {/* P-2-3 ③ 해외 구매 비용(대표님 지시, 2026-08-28) — "착지원가"라는
            내부 계산 필드명을 UI 개념으로 노출하지 않는다. cost/fx는 기존
            computePriceBreakdown 값 그대로(새 계산 없음), 국제배송비는
            landedCostKrw-costKrw로 표시만 한다(cost 응답에 이미 있는 두
            숫자의 차이일 뿐, 새 필드가 아니다). 총 구매원가는 unifiedDecision.
            landedCostKrw(관세/부가세/국내배송원가까지 반영 시도)가 있으면
            그 값을, 없으면 기존 cost.landedCostKrw로 폴백한다. */}
        {cost && fx && (
          <div className="rounded-md border border-border bg-background p-2">
            <p className="mb-1 font-medium text-text-primary">🌎 해외 구매 비용</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary">
              <span>
                🌍 상품 가격 {cost.originalAmount.toLocaleString()} {cost.originalCurrency}
              </span>
              {originChangeRatePercent != null && originChangeRatePercent !== 0 && (
                <span className={originChangeRatePercent < 0 ? "text-success" : "text-error"}>
                  원가 변화 {originChangeRatePercent < 0 ? "▼" : "▲"}
                  {Math.abs(originChangeRatePercent)}%
                </span>
              )}
              <span>·</span>
              <span>
                환율 ₩{Math.round(fx.rate).toLocaleString()}
                {fx.isEstimate ? "(추정)" : "(실시간)"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary">
              <span>상품가 환산 ≈ ₩{Math.round(cost.costKrw).toLocaleString()}</span>
              <span>·</span>
              <span>
                국제 배송비 ₩{Math.round(cost.landedCostKrw - cost.costKrw).toLocaleString()}
                <span className="text-[10px] text-text-tertiary"> (추정)</span>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-border pt-1 text-text-secondary">
              <span className="font-medium text-text-primary">
                현재 확인된 구매원가 ₩
                {Math.round(unifiedDecision?.landedCostKrw.value ?? cost.landedCostKrw).toLocaleString()}
              </span>
            </div>
            {currentPrice.costBasis === "KR_MARKET" && currentPrice.costPriceKrw != null && (
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-text-secondary">
                <span className="font-medium text-text-primary">
                  🇰🇷 한국向 표시가 ₩{currentPrice.costPriceKrw.toLocaleString()}
                </span>
                <span className="text-[10px] text-text-tertiary">(실제 확인됨 — 위 판단은 이 값 기준)</span>
              </div>
            )}
            {currentPrice.costBasis === "ORIGIN_FX" && (
              <p className="mt-1 text-[10px] text-text-tertiary">
                ⚪ 한국向 실제 표시가는 확인되지 않아, 위 판단은 환율 환산가(₩
                {Math.round(cost.costKrw).toLocaleString()}) 기준입니다.
              </p>
            )}
          </div>
        )}

        {/* STEP J-6/J-11 — "🇰🇷 국내" 블록. sampleListings는 verified 링크만
            가격이 저장되므로(run-domestic-price-check.ts STEP 2) 전부 동일상품
            확정건이다 — 행마다 ✓를 붙인다("몇 곳을 뒤졌는지"가 아니라 "검증된
            가격 몇 건인지"를 보여준다, STEP J-11). */}
        {domesticCompetition.tier !== "NONE" && (
          <div className="rounded-md border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDomesticDetail((v) => !v)}
                className="font-medium text-text-primary hover:underline"
              >
                🇰🇷 국내 가격 상세보기 ({domesticCompetition.sellerCount}곳
                {domesticCompetition.tier === "SECONDARY" ? " · 참고가격(검증 전)" : ""})
                {showDomesticDetail ? " 접기" : ""}
              </button>
              <div className="flex items-center gap-2">
                <TrendBadge label="7일" trend={trend7d} />
                <TrendBadge label="30일" trend={trend30d} />
              </div>
            </div>
            {showDomesticDetail && (
              <>
            <ul className="space-y-0.5">
              {domesticCompetition.sampleListings.slice(0, 5).map((listing, i) => {
                const tier = priceAgeTier(listing.checkedAt);
                // N-4.18-G STEP G-4(대표님 예시: "포레포레 ₩109,000 → ₩99,000 ↓
                // 10,000원 가격 하락") — 실측된 사이트(RULII)만 정가/할인가가
                // 둘 다 있고 서로 다를 때만 이 줄을 보여준다. 지어내지 않는다.
                const hasDiscount =
                  listing.salePriceKrw != null &&
                  listing.originalPriceKrw != null &&
                  listing.originalPriceKrw > listing.salePriceKrw;
                return (
                  <li key={i} className="text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        {listing.mallName ?? "알 수 없음"}
                        {(tier === "STALE" || tier === "VERY_STALE") && (
                          <span className="rounded bg-warning-soft px-1 py-0.5 text-[9px] font-medium text-warning">
                            🟡 {PRICE_AGE_LABEL[tier]}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {listing.productUrl ? (
                          <a href={listing.productUrl} target="_blank" rel="noreferrer" className="text-text-primary underline">
                            ₩{listing.priceKrw.toLocaleString()}
                          </a>
                        ) : (
                          <span className="text-text-primary">₩{listing.priceKrw.toLocaleString()}</span>
                        )}
                        <span className="text-success">✓</span>
                        <span className="text-[10px] text-text-tertiary">· {relativeTimeFromNow(listing.checkedAt)}</span>
                      </span>
                    </div>
                    {hasDiscount && (
                      <p className="text-right text-[10px] text-success">
                        ₩{listing.originalPriceKrw!.toLocaleString()} → ₩{listing.salePriceKrw!.toLocaleString()} ↓{" "}
                        {(listing.originalPriceKrw! - listing.salePriceKrw!).toLocaleString()}원 가격 하락
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {domesticCompetition.soldOutListings.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
                {domesticCompetition.soldOutListings.map((listing, i) => (
                  <li key={i} className="flex items-center justify-between text-text-tertiary">
                    <span>{listing.mallName ?? "알 수 없음"}</span>
                    <span>품절 · 가격비교 제외 · ✓ · {relativeTimeFromNow(listing.checkedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {domesticCompetition.checkedAt &&
              (() => {
                const overallTier = priceAgeTier(domesticCompetition.checkedAt);
                return (
                  <>
                    <p className="mt-1 text-[10px] text-text-tertiary">
                      마지막 확인 {new Date(domesticCompetition.checkedAt).toLocaleString("ko-KR")} (
                      {PRICE_AGE_LABEL[overallTier]})
                    </p>
                    {(overallTier === "STALE" || overallTier === "VERY_STALE") && (
                      <p className="mt-1 rounded-md bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning">
                        ⚠️ 최근 가격이 아닙니다. 다시 확인하세요.
                      </p>
                    )}
                  </>
                );
              })()}
            {historyRecords.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="mt-1.5 text-[11px] text-primary hover:underline"
                >
                  {showHistory ? "가격 변동 이력 접기" : `가격 변동 이력 보기 (${historyRecords.length}건)`}
                </button>
                {showHistory && (
                  <ul className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
                    {historyRecords.slice(0, 30).map((r, i) => (
                      <li key={i} className="flex items-center justify-between text-text-secondary">
                        <span>{new Date(r.checkedAt).toLocaleDateString("ko-KR")}</span>
                        <span className="text-text-primary">₩{r.priceKrw.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
              </>
            )}
          </div>
        )}

        {/* STEP J-10 — "💡 기회"(있을 때만, computeSellerAction이 이미 계산). */}
        {sellerAction.opportunity && (
          <div className="rounded-md border border-primary/30 bg-primary-soft p-2.5 text-text-secondary">
            <p className="font-medium text-text-primary">
              {sellerAction.opportunity.icon} {sellerAction.opportunity.title}
            </p>
            <p className="mt-1">{sellerAction.opportunity.detail}</p>
          </div>
        )}

        {/* P-2-3 ⑤ 왜 이런 판단인가(대표님 지시, 2026-08-28) — signals/reasons는
            ① 최종 판단 카드의 근거 상세다. 기본 접힘, H-3 동일상품 매칭
            근거(아래)와는 완전히 다른 관심사라 별도 블록으로 유지한다. */}
        {hasAnyData && (sellerAction.signals.length > 0 || sellerAction.reasons.length > 0) && (
          <div className={`rounded-md border p-2.5 ${SELLER_ACTION_STYLE[sellerAction.status]}`}>
            <button
              type="button"
              onClick={() => setShowReasonDetail((v) => !v)}
              className="font-medium hover:underline"
            >
              ▼ 왜 이런 판단인가? {showReasonDetail ? "접기" : ""}
            </button>
            {showReasonDetail && (
              <>
                {sellerAction.signals.length > 0 && (
                  <ul className="mt-1.5 space-y-1 text-text-secondary">
                    {sellerAction.signals.map((signal, i) => (
                      <li key={i}>
                        <span className="font-medium text-text-primary">
                          {signal.icon} {signal.title}
                        </span>
                        <span className="ml-1">{signal.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {sellerAction.reasons.length > 0 && (
                  <div className="mt-1.5 border-t border-border pt-1.5">
                    <p className="text-[10px] font-medium text-text-tertiary">추천 이유</p>
                    <ul className="mt-0.5 space-y-0.5 text-text-secondary">
                      {sellerAction.reasons.map((reason, i) => (
                        <li key={i}>✓ {reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* N-4.18-F STEP1/2/4(대표님 지시, 2026-08-25: "95%가 나왔다고 단순히 배지만
            보여주지 말고 왜 같은 상품인지 근거를 보여줘야 한다") — 서버의 기존
            matchReasons를 그대로 체크리스트로 옮긴다(새 판정 로직 없음). EXACT는
            가격비교에 이미 반영됨을, HIGH_CONFIDENCE는 확인 버튼을, REVIEW_REQUIRED는
            미반영 문구를 보여준다 — 확정 가격(위)과는 별도 블록으로 명확히 구분한다. */}
        {candidates.length > 0 && (
          <div className="rounded-md border border-dashed border-border bg-background p-2">
            <span className="font-medium text-text-primary">동일상품 매칭 근거 ({candidates.length}건)</span>
            <ul className="mt-1.5 space-y-2">
              {candidates.slice(0, 8).map((c) => {
                const label = candidateLabel(c);
                const pct = Math.round(c.matchConfidence * 100);
                return (
                  <li key={c.id} className="rounded-md border border-border bg-surface p-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-primary">
                        {label.icon} {label.text}
                        {!c.verified && ` ${pct}%`}
                      </span>
                      <a href={c.externalUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">
                        상품 보기
                      </a>
                    </div>
                    {(c.matchedBrand || c.matchedTitle) && (
                      <p className="mt-0.5 truncate text-text-secondary">
                        {c.matchedBrand ? `${c.matchedBrand} · ` : ""}
                        {c.matchedTitle ?? ""}
                      </p>
                    )}
                    <ul className="mt-1 space-y-0.5">
                      {c.matchReasons.map((reason, i) => (
                        <li key={i} className="text-[11px] text-text-secondary">
                          {reasonIcon(reason)} {reasonLabel(reason)}
                        </li>
                      ))}
                      {missingSignalNotes(c.matchReasons).map((note, i) => (
                        <li key={`missing-${i}`} className="text-[11px] text-text-tertiary">
                          ⚠ {note}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[10px] text-text-tertiary">{label.note}</p>
                    {c.matchType === "HIGH_CONFIDENCE" && !c.verified && (
                      <button
                        type="button"
                        onClick={() => void confirmSameProduct(c.id)}
                        disabled={confirmingId === c.id}
                        className="mt-1.5 rounded-md border border-primary px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                      >
                        {confirmingId === c.id ? "확인 중..." : "동일상품으로 확인"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* recommendation.recommendedPrice는 이제 ① 최종 판단 카드의 "권장
            판매가"로 승격됐다(P-2-3) — 여기서 다시 보여주면 같은 숫자를
            두 번 노출하게 되므로 제거한다(계산/필드 자체는 그대로 유지). */}

        <p className="text-[10px] text-text-tertiary">
          참고용 판단입니다 — 판매가는 자동으로 변경되지 않으며, 최종 결정은 직접 내려야 합니다. 가격경쟁력은
          등록 가능 여부와 무관합니다 — 마진이 낮거나 가격이 높아도 등록 자체는 막히지 않습니다.
        </p>
      </div>
    </CollapsibleSection>
  );
}
