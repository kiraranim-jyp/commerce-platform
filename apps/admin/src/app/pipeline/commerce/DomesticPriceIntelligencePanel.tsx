"use client";

import { useEffect, useRef, useState } from "react";
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
import { shouldRefetchAfterAutoCheck } from "../snapshot-save-guard";

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
/**
 * UX-2(CEO 지시, 2026-09-05) — 판단 패널에서 "가격비교 원본 보기"를 눌렀을 때
 * 스크롤할 대상. 판단(이 패널)과 그 근거(해외/국내 가격비교 섹션)는 서로 다른
 * 컴포넌트에 있으므로 앵커 id를 한 곳에서 정의해 양쪽이 같은 값을 쓰게 한다.
 */
/** MI-UX-5 — 요약 결론의 색/아이콘. tone은 서버가 marketCase + 공급 축으로
 * 이미 정한 값이라 화면에서 다시 판정하지 않는다. */
const MI_SUMMARY_TONE: Record<"GOOD" | "CAUTION" | "STOP" | "UNKNOWN", { icon: string; box: string; text: string }> = {
  GOOD: { icon: "🟢", box: "border-success/40 bg-success-soft", text: "text-success" },
  CAUTION: { icon: "🟡", box: "border-warning/40 bg-warning-soft", text: "text-warning" },
  STOP: { icon: "🔴", box: "border-danger/40 bg-danger-soft", text: "text-danger" },
  UNKNOWN: { icon: "⚪", box: "border-border bg-background", text: "text-text-secondary" },
};

export const PRICE_COMPARISON_ANCHOR_ID = "price-comparison-source";

/**
 * MI-LOADING-1(CPO 지시, 2026-09-06) — Market Intelligence 분석 진행 화면.
 *
 * 설계 원칙은 하나다: **표시되는 단계는 전부 실제로 실행 중인 작업이다.**
 *   상품 정보    이미 로드된 스냅샷 — 진입 시점에 실제로 완료된 상태
 *   국내 시장가   page.tsx의 /api/price-history/check (autoChecking일 때만 표시)
 *   원가·전략    /api/price-history/:id
 *   경쟁 판매처   /api/domestic-price-sources/links
 *   가격 알림    /api/price-history/:id/alerts
 *
 * 뒤 3개는 원래부터 병렬 요청이라 순차로 끝나지 않는다. 그래서 "3/5" 같은
 * 가짜 순번이나 시간 기반 퍼센트를 쓰지 않고, 각 요청이 실제로 resolve될 때
 * 그 항목만 체크한다. 진행률은 "실제로 끝난 항목 수 / 전체"로만 계산한다.
 */
type MiStepState = "running" | "done";
interface MiStep {
  label: string;
  detail: string;
  state: MiStepState;
}

function MarketIntelligenceProgress({ steps, completed }: { steps: MiStep[]; completed: boolean }) {
  const doneCount = steps.filter((s) => s.state === "done").length;
  const percent = Math.round((doneCount / Math.max(1, steps.length)) * 100);

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base">🤖</span>
        <p className="text-sm font-semibold text-text-primary">AI Market Intelligence</p>
      </div>
      <p className="mb-3 text-xs text-text-secondary">
        {completed ? "분석이 끝났습니다. 결과를 정리하고 있습니다." : "상품 데이터를 분석하고 있습니다."}
      </p>

      {/* MI-LOADING-1 STEP 3(CEO 요구: "상단에 기본 진행 스텝도 있고") —
          같은 단계를 가로로 압축해 한눈에 보여준다. 아래 목록과 동일한 상태를
          쓰므로 두 표시가 어긋날 수 없다(별도 상태를 만들지 않는다). */}
      <ol className="mb-3 flex items-center gap-1">
        {steps.map((step, i) => {
          const done = completed || step.state === "done";
          return (
            <li key={step.label} className="flex flex-1 items-center gap-1">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-300 ${
                  done
                    ? "bg-primary text-white"
                    : "animate-pulse border border-primary text-primary"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className={`h-px flex-1 transition-colors duration-300 ${done ? "bg-primary" : "bg-border"}`} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${completed ? 100 : percent}%` }}
        />
      </div>
      <p className="mb-3 text-right text-[10px] text-text-tertiary">
        {completed ? steps.length : doneCount} / {steps.length}
      </p>

      <ul className="space-y-1.5">
        {steps.map((step) => {
          const done = completed || step.state === "done";
          return (
            <li key={step.label} className="flex items-start gap-2 text-xs transition-opacity duration-300">
              <span className={done ? "text-success" : "animate-pulse text-primary"}>{done ? "✓" : "◉"}</span>
              <span className="flex-1">
                <span className={done ? "text-text-secondary" : "font-medium text-text-primary"}>{step.label}</span>
                <span className="ml-1 text-[10px] text-text-tertiary">{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {!completed && (
        <p className="mt-3 text-[10px] text-text-tertiary">
          국내 시장 가격을 실제로 조회하므로 10~20초 정도 걸릴 수 있습니다.
        </p>
      )}
    </div>
  );
}

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
const MATCH_TRUTH_DISPLAY: Record<MatchTruth, { icon: "🟢" | "🟡" | "⚪" | "🔴"; text: string }> = {
  EXACT_IDENTIFIER: { icon: "🟢", text: "동일상품 확인됨 — 정확한 상품 식별자 일치" },
  STRONG_IDENTIFIER: { icon: "🟢", text: "동일상품 확인됨(식별자 기반 검증)" },
  TEXT_CONFIRMED: { icon: "🟡", text: "비교상품 — 상품명은 유사하지만 식별자 근거 없음" },
  SIMILAR: { icon: "🟡", text: "비교상품 — 상품명 유사도만 확인됨" },
  INSUFFICIENT_EVIDENCE: { icon: "⚪", text: "판단 근거 부족 — 동일상품 여부를 확인하지 못했습니다" },
  CONFLICT: { icon: "🔴", text: "다른 상품 가능성 높음 — 식별자 정보가 충돌합니다" },
};

/**
 * P-20 Sprint 7(CPO 지시, 2026-09-02) — priceTierFromLink()가 TEXT_CONFIRMED/SIMILAR를
 * COMPARISON(비교상품 시장가격, 참고용)으로 이미 반영한다(P-19-B Sprint 7). 이 함수는
 * 그 이전(EXCLUDED와 동일하게 "가격비교에 전혀 반영 안 됨")으로 문구가 남아있던 것을
 * 실제 데이터(PèPè + deuxbebe.com 실측)로 발견해 고친다 — priceTierFromLink()와
 * 동일한 3-way 분기(EXACT/COMPARISON/EXCLUDED)를 그대로 따르고, 새 판정을 만들지
 * 않는다. */
export function candidateLabel(c: DomesticCandidate): { icon: string; text: string; note: string } {
  if (c.matchTruth) {
    const base = MATCH_TRUTH_DISPLAY[c.matchTruth];
    if (c.matchTruth === "TEXT_CONFIRMED" || c.matchTruth === "SIMILAR") {
      const pct = Math.round(c.matchConfidence * 100);
      return { ...base, note: `텍스트 유사도 ${pct}% · 비교상품 시장가격(참고용)으로 반영됨` };
    }
    if (c.matchTruth === "CONFLICT" || c.matchTruth === "INSUFFICIENT_EVIDENCE") {
      return { ...base, note: "가격비교에는 반영하지 않습니다" };
    }
    return { ...base, note: "→ 동일상품 가격으로 반영됨" };
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

/** P-19-B Sprint 7(CPO 지시, 2026-09-02) — 서버가 이미 계산해 낸 우선순위 결과를
 * 그대로 옮기는 타입. P-25 Sprint 3(CPO 지시, 2026-09-02) — "EXACT와 COMPARISON
 * 가격을 절대 하나의 가격으로 합치지 않는다"를 지키려면 basis(우선순위 결과)
 * 뿐 아니라 exact/comparison 원본 summary도 그대로 필요하다 — market-
 * intelligence.ts는 이미 이 두 값을 응답에 포함하고 있었다(summarizeDomesticMarketSplit
 * 원본 반환값), 새 계산이 아니라 기존 값을 이 패널에서도 읽기만 한다. */
interface DomesticMarketSplitInfo {
  basis: "EXACT" | "COMPARISON" | "NONE";
  exact: DomesticCompetition;
  comparison: DomesticCompetition;
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

/** P-26(CPO 지시, 2026-09-03) — CASE A/B/C/D. C(시장가 손실)/D(EXACT 데이터
 * 없음)는 recommendedPrice/estimatedMarginPercent가 null이다 — 억지 추천가를
 * 만들지 않는다는 원칙 그대로 화면에서도 "없음"을 명시해야 한다. */
type MarketCase = "A" | "B" | "C" | "D";

interface Recommendation {
  minimumPrice: number;
  targetPrice: number;
  marketCase: MarketCase;
  recommendedPrice: number | null;
  estimatedMarginPercent: number | null;
  /** P-13A CPO 2차 검증 대응 — 이 값이 국내 동일상품 최저가에서 왔는지,
   * 브랜드 시장 중앙값(참고용)에서 왔는지 화면에서 구분해야 한다. */
  competitiveBasis?: "DOMESTIC_LOWEST" | "BRAND_MEDIAN" | null;
  referencePriceKrw?: number | null;
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
  code: "READY" | "REVIEW_MATCH" | "REVIEW_PRICE" | "MARKET_OPPORTUNITY" | "NEEDS_INFO" | "HOLD";
  icon: "🟢" | "🟡" | "🟣" | "🟠" | "🔴";
  title: string;
  description: string;
  reasons: string[];
}

/** P-8 STEP 5 / P-9 STEP 5(대표님 지시, 2026-08-30) — "버튼을 누르기 전에
 * 셀러가 무엇을 확인하는지 알 수 있게 한다." 새 등록/가격 엔드포인트를 만들지
 * 않는다 — 전부 기존 onRequestPriceReview(가격/비용 탭 이동)로 연결한다. */
const REPRESENTATIVE_VERDICT_CTA: Record<RepresentativeVerdict["code"], { label: string; hint: string }> = {
  READY: { label: "등록 진행", hint: "" },
  REVIEW_MATCH: {
    label: "국내 동일상품 다시 확인",
    hint: "동일상품이 확인되지 않아 비교상품(참고용) 시장가격 기준으로 계산됐습니다. 등록 전 직접 확인을 권장합니다.",
  },
  REVIEW_PRICE: { label: "판매 가격 다시 설정", hint: "현재 판매가격과 국내 시장가격을 다시 비교합니다." },
  MARKET_OPPORTUNITY: {
    label: "추천 판매가격 검토",
    hint: "국내 경쟁가격은 확인되지 않았습니다. 판매 가격을 설정하면 예상 수익성을 계산할 수 있습니다.",
  },
  NEEDS_INFO: { label: "비용 정보 입력", hint: "예상 수익 계산에 필요한 비용 정보를 입력하세요." },
  HOLD: { label: "가격·매입 조건 재검토", hint: "현재 판매가격과 국내 시장가격을 다시 비교합니다." },
};

/** P-12B/D(대표님/CPO 지시, 2026-08-31) — "얼마에 살 수 있고"의 근거가 최신
 * 실측값인지 과거 저장값인지 셀러가 구분할 수 있게 한다. */
const COST_SOURCE_LABEL: Record<NonNullable<PriceHistoryResponse["costSource"]>, string> = {
  LATEST_SALE: "최신 확인가 기준(할인 중)",
  LATEST_PRICE: "최신 확인가 기준",
  STATIC_SNAPSHOT: "저장된 가격 기준",
};

/** P-13A — 표본 수 기반 신뢰도를 셀러 언어로. 서버가 이미 INSUFFICIENT는
 * null로 걸러서 보내므로 여기선 3단계만 다룬다. */
const BRAND_MARKET_CONFIDENCE_LABEL: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
  HIGH: "🟢 신뢰도 높음",
  MEDIUM: "🔵 신뢰도 보통",
  LOW: "🟡 신뢰도 낮음",
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
    origin: {
      change: { changeRatePercent: number } | null;
      /** P-12D — costSource 배지("최신 확인가 기준 · N시간 전")에 쓸 시각.
       * records[0]이 최신(서버가 이미 checked_at desc로 정렬해 돌려준다). */
      records: PriceHistoryRecord[];
    };
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
  /** P-12B(대표님/CPO 지시, 2026-08-31) — cost가 실제로 어떤 기준으로
   * 계산됐는지: LATEST_SALE(최신 확인된 할인가)/LATEST_PRICE(최신 확인가,
   * 할인 아님)/STATIC_SNAPSHOT(가격 확인 이력이 없거나 품절이라 과거 저장된
   * canonicalProduct.price로 폴백). cost가 null이면 이 값도 null. */
  costSource: "LATEST_SALE" | "LATEST_PRICE" | "STATIC_SNAPSHOT" | null;
  /** P-13A(대표님/CPO 지시, 2026-08-31) — 국내 동일상품이 없을 때(domesticCompetition.
   * tier==="NONE") 서버가 계산해 돌려주는 브랜드 시장 근거. confidence가
   * INSUFFICIENT(표본 1~2개)면 서버가 이미 null로 걸러서 보낸다 — 화면에서
   * "null이 아니면 항상 쓸 만하다"로 취급해도 된다. */
  brandMarketProfile: {
    market: "KR";
    sampleCount: number;
    minPriceKrw: number;
    p25PriceKrw: number;
    medianPriceKrw: number;
    p75PriceKrw: number;
    maxPriceKrw: number;
    confidence: "HIGH" | "MEDIUM" | "LOW";
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
  /** P-19-B Sprint 8(CPO 지시, 2026-09-02) — 판매자에게 최종적으로 보여줄 화면은
   * 무조건 3단계(🟢 판매 추천/🟡 조건부 판매/🔴 판매 비추천)로 통합한다.
   * representativeVerdict의 5단계 내부 판정은 그대로 유지하되(재계산 없음),
   * 헤드라인 아이콘/타이틀/박스 색은 이 3단계 값만 쓴다 — description/reasons
   * (설명 문장)는 기존 representativeVerdict 값을 그대로 재사용한다(내부 코드/
   * 5단계 용어 자체를 노출하지 않는 것이 CPO 지시의 핵심이지, 설명 문장까지
   * 지우라는 뜻은 아니다). */
  sellerFacingVerdict: SellerFacingVerdict;
  domesticMarketSplit: DomesticMarketSplitInfo;
  /** P-29 Sprint 8(CPO 지시, 2026-09-03) — "가격이 좋아도 팔릴지"를 가격
   * 판정(CASE A/B/C/D)과 완전히 분리해서 보여준다. marketSignals는 marketCase를
   * 전혀 참조하지 않는 별도 계산(packages/pricing/market-signals.ts) — 이
   * 화면도 두 값을 절대 섞지 않는다(신호가 좋다고 recommendation/marketCase를
   * 다시 계산하거나 덮어쓰지 않음). */
  marketSignals: MarketSignalsInfo;
  sellingGuidance: string[];
  /** MI-UX-4 — 기본 화면용 한 줄 요약. 서버가 sellingGuidance와 같은 facts로
   * 만들므로 둘이 다른 숫자를 말할 수 없다. 구버전 응답에는 없다(optional). */
  sellingSummary?: {
    tone: "GOOD" | "CAUTION" | "STOP" | "UNKNOWN";
    headline: string;
    numbers: string | null;
    action: string;
    /** MI-ACTION-1 — 행동 문장이 제시하는 등록 가격. 없으면 null. */
    actionPriceKrw?: number | null;
  } | null;
  /** MI-CONFIDENCE-1 — 신뢰도가 어떤 데이터 위에 서 있는지. 구버전 응답에는 없다. */
  confidenceBasis?: {
    confirmedCount: number;
    totalCount: number;
    items: { label: string; confirmed: boolean; note: string | null }[];
  } | null;
  /** P-31 — 종합 시장 상태 + 구조화된 판단 근거. finalVerdict는
   * sellerFacingVerdict를 시장 신호로 강등만 한 값이다(승격 없음). */
  sellerDecision: SellerDecisionInfo;
}

interface DecisionFactor {
  key: "priceProfitability" | "domesticPrice" | "marketInterest" | "sellerCompetition" | "seasonFit";
  label: string;
  level: "high" | "medium" | "low" | "unknown";
  detail: string;
}

interface SellerDecisionInfo {
  finalVerdict: "RECOMMENDED" | "CONDITIONAL" | "NOT_RECOMMENDED";
  priceVerdict: "RECOMMENDED" | "CONDITIONAL" | "NOT_RECOMMENDED";
  downgradedByMarket: boolean;
  outlook: "GOOD" | "WATCH" | "WEAK" | "UNKNOWN";
  outlookSummary: string;
  knownSignalCount: number;
  factors: DecisionFactor[];
  reasons: string[];
}

interface MarketSignal {
  key: "domesticPresence" | "searchInterest" | "seasonFit";
  label: string;
  level: "high" | "medium" | "low" | "unknown";
  evidence: string;
}

interface MarketSignalsInfo {
  signals: MarketSignal[];
  confidence: "high" | "medium" | "limited";
}

const SIGNAL_LEVEL_BADGE: Record<MarketSignal["level"], string> = {
  high: "🟢 높음",
  medium: "🟡 보통",
  low: "🔴 낮음",
  unknown: "⚪ 확인 불가",
};

/** P-30(CPO 지시, 2026-09-03) — 검색 관심만 관심도 추세임이 드러나는 배지를
 * 쓴다("높음/낮음"은 국내 판매처 수·시즌 적합성과 같은 척도로 오해된다).
 * 여전히 상대적 관심 수준일 뿐이므로 절대 수치(검색량 N건)는 쓰지 않는다. */
const SEARCH_INTEREST_LEVEL_BADGE: Record<MarketSignal["level"], string> = {
  high: "📈 관심 상승",
  medium: "➡️ 보통",
  low: "📉 낮음",
  unknown: "⚪ 확인 불가",
};

function signalBadge(signal: MarketSignal): string {
  return signal.key === "searchInterest" ? SEARCH_INTEREST_LEVEL_BADGE[signal.level] : SIGNAL_LEVEL_BADGE[signal.level];
}

/** P-31 — 종합 시장 상태. 가격 판정(CASE A/B/C/D)과 다른 어휘를 써서 두
 * 레이어가 화면에서 섞이지 않게 한다. */
const MARKET_OUTLOOK_BADGE: Record<SellerDecisionInfo["outlook"], string> = {
  GOOD: "🟢 양호",
  WATCH: "🟡 확인 필요",
  WEAK: "🔴 불리",
  UNKNOWN: "⚪ 확인 불가",
};

/** 판단 근거 표에서 쓰는 아이콘 — "확인 불가"를 나쁨(🔴)과 절대 같은 기호로
 * 쓰지 않는다(CPO UNKNOWN 정책: 데이터 없음 ≠ 시장 약함). */
/** 최종 판정 3단계 문구 — 서버의 SELLER_FACING_COPY와 동일하게 유지한다
 * (강등된 경우 서버가 보낸 sellerFacingVerdict.title과 달라지므로 코드에서
 * 다시 고른다). */
const FINAL_VERDICT_COPY: Record<SellerDecisionInfo["finalVerdict"], { icon: string; title: string }> = {
  RECOMMENDED: { icon: "🟢", title: "판매 추천" },
  CONDITIONAL: { icon: "🟡", title: "조건부 판매" },
  NOT_RECOMMENDED: { icon: "🔴", title: "판매 비추천" },
};

const FACTOR_LEVEL_ICON: Record<DecisionFactor["level"], string> = {
  high: "🟢",
  medium: "🟡",
  low: "🔴",
  unknown: "⚪",
};

// MI-CONFIDENCE-2 — 셀러 화면에서 "신호 신뢰도 ●●○" 노출을 없애면서 이 배지
// 맵의 참조가 사라졌다. 미사용 상수를 남기면 다음 사람이 "어디서 쓰이나"를
// 다시 확인해야 하므로 제거한다. marketSignals.confidence 값 자체는 계산과
// API 응답에 그대로 있다(deriveMarketSignals 공개 계약, 테스트가 검증 중).

interface SellerFacingVerdict {
  code: "RECOMMENDED" | "CONDITIONAL" | "NOT_RECOMMENDED";
  icon: "🟢" | "🟡" | "🔴";
  title: string;
  reasons: string[];
}

const SELLER_FACING_VERDICT_STYLE: Record<SellerFacingVerdict["code"], string> = {
  RECOMMENDED: "border-border bg-success-soft text-success",
  CONDITIONAL: "border-border bg-warning-soft text-warning",
  NOT_RECOMMENDED: "border-border bg-error-soft text-error",
};

/** P-18 Sprint 6(CPO 지시, 2026-09-01) — 상단 4칸 요약 카드 한 칸. 값이 없으면
 * (관측치 없음) 지어내지 않고 "—"만 보여준다. */
function SummaryStat({
  label,
  value,
  formatter = (v: number) => `₩${v.toLocaleString("ko-KR")}`,
}: {
  label: string;
  value: number | null;
  formatter?: (v: number) => string;
}) {
  return (
    <div>
      <div className="text-[10px] text-text-tertiary">{label}</div>
      <div className="text-sm font-semibold text-text-primary">{value != null ? formatter(value) : "—"}</div>
    </div>
  );
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
  onSellerVerdictChange,
  onRequestPriceReview,
  autoChecking,
}: {
  snapshotId: string;
  /** P-32 — "팔 만한가?"의 답(판매 판정)을 상위로 보고한다. CommerceWorkspace가
   * 이 값과 등록 준비 상태를 한 화면에 나란히 놓기 위해 쓴다. 두 값을 합쳐
   * 새 판정을 만들지는 않는다(registration-readiness-outcome.ts 참고). */
  onSellerVerdictChange?: (verdict: SellerDecisionInfo["finalVerdict"] | null) => void;
  /** N-4.08 STEP6-4와 같은 패턴(onReadinessChange) — 이 패널이 계산한 값을
   * CommerceWorkspace가 탭 배지/상태 요약에 캐싱해서 쓸 수 있게 보고한다. */
  onPriceLevelChange?: (level: PriceLevel) => void;
  /** N-4.18-H-2 STEP H-2-5 — "[가격/마진 확인]" 버튼. 이 패널은 상품정보
   * 탭에서만 마운트되고 PriceEditor는 커머스 플랫폼 탭에만 있어(서로 다른
   * 탭), 실제 이동은 CommerceWorkspace가 탭 전환+스크롤로 처리한다. */
  onRequestPriceReview?: () => void;
  /** P-18(CPO 지시, 2026-09-01) — page.tsx가 최초 스냅샷 생성 직후 자동으로
   * 쏜 가격 확인(POST /api/price-history/check)이 아직 응답 전인 동안 true.
   * true→false로 바뀌면(자동 확인 완료) 아래 useEffect가 데이터를 다시
   * 읽는다 — 컴포넌트 mount 자체를 트리거로 쓰지 않는다는 원칙 그대로,
   * 이 패널은 그 신호를 그냥 전달받아 반응만 한다. */
  autoChecking?: boolean;
}) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  // P-2-3 ④(대표님 지시, 2026-08-28) — "기본 화면에서 바로 10개 이상의 경쟁
  // 가격을 보여주지 않는다." 판매처별 개별 리스팅/추세/이력은 기본 접힘.
  const [showDomesticDetail, setShowDomesticDetail] = useState(false);
  // P-2-3 ⑤(대표님 지시, 2026-08-28) — "왜 이런 판단인가"는 기본적으로 접어둔다.
  const [showReasonDetail, setShowReasonDetail] = useState(false);
  // UX-1(CPO 지시, 2026-09-05) — 시장 신호 블록은 "종합 상태 + 3개 신호"까지만
  // 기본 노출하고, 판단 근거 표와 전략 가이드는 상세로 내린다. 사용자가 먼저
  // 봐야 하는 건 "팔아도 되는가"이지 근거 전체가 아니다(기능 제거가 아니라 계층화).
  const [showMarketDetail, setShowMarketDetail] = useState(false);
  // UX-1B(CPO 지시, 2026-09-05) — 해외 원가 구성(상품가/환율/환산/국제배송비/
  // MI-UX-8 — 해외 구매 비용 블록을 제거하면서 이 토글도 쓰이지 않게 됐다.
  // 원가 구성은 "해외 가격비교" 영역에서 확인한다.
  // UX-1C(CPO 지시, 2026-09-05) — 최종 판단 카드를 3단계로 나눈다.
  //   L1 결론      : 판정 · 추천 판매가 · 예상 이익/마진율 · 한 줄 이유
  //   L2 왜 그런가 : representativeVerdict.reasons (판정 엔진이 낸 근거 문장)
  //   L3 어떻게 계산: 구매가 · 착지원가 · 최소마진/목표마진 참고가 · 브랜드 프로파일
  // UX-2(CEO 지시, 2026-09-05) — "이건 노출되도 될 것 같아". UX-1C가 판단
  // 근거(왜 이 판단인가)와 원가 숫자(구매가·착지원가·참고 기준가)를 접었는데,
  // CEO 실사용 판단은 "이 정도는 첫 화면에 보여도 된다"였다. 접는 기능은
  // 그대로 두고 초기 상태만 펼침으로 바꾼다 — 셀러가 결론과 그 근거를 한
  // 화면에서 같이 보게 하는 것이 이 패널의 목적이기 때문이다.
  const [showWhyVerdict, setShowWhyVerdict] = useState(true);
  const [showCalcDetail, setShowCalcDetail] = useState(true);
  // MI-UX-8 — "가격 전략" 블록 제거로 이 토글도 함께 사라졌다.
  const [rechecking, setRechecking] = useState(false);
  const [recheckResult, setRecheckResult] = useState<RecheckResult | null>(null);
  const [candidates, setCandidates] = useState<DomesticCandidate[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  /**
   * MI-LOADING-1(CPO 지시, 2026-09-06) — 분석 중에 화면이 비어 있어서(기존
   * `if (loading) return null`) "AI가 지금 무엇을 하고 있는지"가 전혀 보이지
   * 않았다. 진행 상태를 보여주되, 각 단계는 실제로 실행 중인 요청과 1:1로
   * 대응한다 — 실제로 하지 않는 작업을 완료로 표시하지 않는다(CPO 금지).
   * 세 요청은 원래대로 병렬 실행하고(네트워크 동작 변경 없음), 각자 끝나는
   * 시점에 그 항목만 체크된다. 가짜 순차 진행이나 가짜 퍼센트는 만들지 않는다.
   */
  const [stepDone, setStepDone] = useState({ analysis: false, competitors: false, alerts: false });
  /** 완료 직후 결과가 튀어나오지 않게 하는 짧은 전환 상태(추가 클릭 없음). */
  const [justCompleted, setJustCompleted] = useState(false);

  function runAnalysis(): void {
    setLoading(true);
    setStepDone({ analysis: false, competitors: false, alerts: false });
    void Promise.all([
      loadPriceHistory().finally(() => setStepDone((s) => ({ ...s, analysis: true }))),
      loadCandidates().finally(() => setStepDone((s) => ({ ...s, competitors: true }))),
      loadAlerts().finally(() => setStepDone((s) => ({ ...s, alerts: true }))),
    ]).finally(() => {
      setLoading(false);
      setJustCompleted(true);
    });
  }

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
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId]);

  /** MI-LOADING-1 — "분석 완료"는 잠깐만 보여주고 자동으로 결과로 넘어간다.
   * 결과를 보려고 한 번 더 클릭하게 만들지 않는다(CPO 지시). */
  useEffect(() => {
    if (!justCompleted) return;
    const t = setTimeout(() => setJustCompleted(false), 800);
    return () => clearTimeout(t);
  }, [justCompleted]);

  /** P-18(CPO 지시, 2026-09-01) — autoChecking이 true→false로 전환된 시점(=page.tsx가
   * 쏜 자동 가격 확인이 방금 끝난 시점)에만 데이터를 다시 읽는다. wasAutoCheckingRef로
   * "실제로 진행 중이었다가 끝났는지"를 직접 비교한다 — 단순히 [autoChecking]
   * 의존성 배열만 쓰면 autoChecking이 처음부터 false/undefined인 일반적인 경우
   * (기존 스냅샷 재방문 등)에도 mount 시 이 effect가 한 번 더 불필요하게 실행된다. */
  const wasAutoCheckingRef = useRef(Boolean(autoChecking));
  useEffect(() => {
    const was = wasAutoCheckingRef.current;
    wasAutoCheckingRef.current = Boolean(autoChecking);
    if (shouldRefetchAfterAutoCheck(was, Boolean(autoChecking))) {
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoChecking]);

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
    // P-32 — 판매 판정을 CommerceWorkspace로 올려보낸다(onPriceLevelChange와
    // 같은 패턴). 여기서 새 판정을 만들지 않고 서버가 이미 낸
    // sellerDecision.finalVerdict를 그대로 보고만 한다.
    onSellerVerdictChange?.(data?.sellerDecision?.finalVerdict ?? null);
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

  // P-18(CPO 지시, 2026-09-01) — 자동 가격 확인이 진행 중인 동안은 패널 자체가
  // 사라지는(return null) 대신 "확인 중" 상태를 보여준다. P-14 timeout 정책 —
  // 이 자동 확인은 page.tsx의 fetch("/api/price-history/check")가 언젠가는
  // 반드시 resolve/reject되므로(무한 대기 아님) 별도 타임아웃을 새로 만들지
  // 않는다(기존 정책 그대로 상속, 크롤러 timeout 로직 자체는 이번에 건드리지
  // 않는다).
  // MI-LOADING-1 — 진행 단계는 실제 요청과 1:1이다. autoChecking 단계는 실제로
  // 자동 가격 확인이 돌고 있을 때만 목록에 넣는다(안 돌면 아예 표시하지 않는다).
  const miSteps: MiStep[] = [
    { label: "상품 정보 확인", detail: "상품명 · 옵션 · 원가", state: "done" },
    ...(autoChecking
      ? [{ label: "국내 시장 가격 확인", detail: "동일상품 실시간 조회", state: "running" as MiStepState }]
      : []),
    {
      label: "원가·마진 분석 및 판매 전략 생성",
      detail: "착지원가 · 추천가 · 마진",
      state: stepDone.analysis ? "done" : "running",
    },
    { label: "경쟁 판매처 조회", detail: "국내 판매처 후보", state: stepDone.competitors ? "done" : "running" },
    { label: "가격 변동 알림 확인", detail: "최근 가격 변화", state: stepDone.alerts ? "done" : "running" },
  ];

  if (autoChecking || loading || justCompleted) {
    return (
      <CollapsibleSection title="Market Intelligence" defaultOpen>
        <MarketIntelligenceProgress steps={miSteps} completed={!autoChecking && !loading && justCompleted} />
      </CollapsibleSection>
    );
  }
  // MI-LOADING-1 — 기존에는 결과가 없으면 패널이 통째로 사라져서 "분석이 실패한
  // 건지 아직 안 한 건지" 알 수 없었다. 실패는 실패라고 말한다 — 없는 숫자를
  // 만들지 않는다는 UX-3 원칙과 같은 이유다.
  if (!data) {
    return (
      <CollapsibleSection title="Market Intelligence" defaultOpen>
        <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
          ⚠ 시장 분석 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      </CollapsibleSection>
    );
  }

  const {
    product,
    domesticCompetition,
    currentPrice,
    cost,
    costSource,
    brandMarketProfile,
    fx,
    decision,
    recommendation,
    sellerAction,
    unifiedDecision,
    representativeVerdict,
    // P-31 — sellerFacingVerdict(가격/매칭 레이어 판정)는 이제 화면에서 직접
    // 쓰지 않는다. 서버가 그 값을 sellerDecision.priceVerdict로 넘겨주고,
    // 헤드라인은 sellerDecision.finalVerdict 하나만 본다(판정 단일 소스).
    domesticMarketSplit,
    marketSignals,
    sellingGuidance,
    sellingSummary,
    confidenceBasis,
    sellerDecision,
  } = data;
  const domesticShopHistory = data.priceHistory?.domesticShop ?? null;
  const trend7d = domesticShopHistory?.trend7d ?? null;
  const trend30d = domesticShopHistory?.trend30d ?? null;
  const historyRecords = domesticShopHistory?.records ?? [];
  const originChangeRatePercent = data.priceHistory?.origin?.change?.changeRatePercent ?? null;
  const originLatestCheckedAt = data.priceHistory?.origin?.records?.[0]?.checkedAt ?? null;

  const hasAnyData =
    domesticCompetition.tier !== "NONE" || currentPrice.sellingPriceKrw != null || cost != null;

  /** UX-1D — "가격 전략" 요약에 쓸 대표 국내 가격. 새로 계산하지 않는다.
   * 서버가 이미 낸 domesticMarketSplit의 평균가를 우선순위대로 고르기만 한다:
   * ① 동일상품(EXACT) 평균 → ② 비교상품(COMPARISON) 평균 → ③ 표시 안 함.
   * 최저가는 이상치일 수 있어 대표값으로 쓰지 않는다(CPO 지시). */
  // MI-UX-8 — 대표 국내 가격(동일상품 평균 → 비교상품 평균)은 "가격 전략"
  // 블록에서만 쓰던 표시용 값이라 함께 제거했다. domesticMarketSplit 자체는
  // 서버 계산 그대로 남아 있고 가격 판단에는 영향이 없다.

  return (
    <CollapsibleSection title="Market Intelligence" defaultOpen>
      <div className="space-y-2 text-xs">
        {/* P-18 Sprint 6(CPO 지시, 2026-09-01) — "그래서 얼마에 팔라는 건지"를
         * 판매자가 스크롤 없이 바로 보게 한다. 새 계산 없음 — 아래 다른 섹션들이
         * 이미 쓰는 값(domesticCompetition/recommendation/decision)을 그대로
         * 4칸에 요약만 한다. */}
        {hasAnyData && (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-4">
            <SummaryStat label="국내 최저가" value={domesticCompetition.lowestPriceKrw} />
            <SummaryStat label="국내 평균가" value={domesticCompetition.averagePriceKrw} />
            <SummaryStat label="추천 판매가격" value={recommendation?.recommendedPrice ?? null} />
            {/* P-26 후속(실측 발견, 2026-09-03) — 이 자리는 "추천 판매가격" 바로
                옆이라 그 가격에서의 마진을 기대하게 된다. decision(판매가를
                이미 설정한 뒤에만 존재하는 현재가 기준 마진)에 묶여 있었던 탓에
                등록 전(대부분의 경우, 실측 PèPè 포함)에는 "—"만 보였다 — 바로
                아래서 이미 정직하게 계산해 보여주는 recommendation.
                estimatedMarginPercent(추천가 기준 마진, CASE A/B에서만 값 있음,
                C/D는 여전히 null)이 있는데도 숨긴 셈이다. 새 계산 없음 — 값을
                옮겨서 쓸 자리만 바꾼다. */}
            <SummaryStat
              label="예상 마진"
              value={recommendation?.estimatedMarginPercent ?? decision?.marginPercent ?? null}
              formatter={(v) => `${v.toFixed(1)}%`}
            />
          </div>
        )}
        {/* P-19-B Sprint 7/9(CPO 지시, 2026-09-02) — 위 4칸 요약이 "🟢 동일상품
            확인" 가격인지 "🟡 비교상품" 국내 유사 시장가격(참고용)인지 명확히
            표시한다. 새 계산 없음 — market-intelligence.ts가 이미 우선순위(1순위
            동일상품가격, 없으면 2순위 비교상품 시장가격)로 계산해 낸
            domesticMarketSplit.basis만 그대로 문구로 옮긴다. */}
        {domesticMarketSplit.basis === "EXACT" && (
          <p className="text-[10px] text-success">🟢 동일상품 가격 기준입니다.</p>
        )}
        {domesticMarketSplit.basis === "COMPARISON" && (
          <p className="text-[10px] text-warning">
            🟡 동일상품은 확인되지 않았습니다 — 국내 비교상품 시장가격(참고용)을 기준으로 표시합니다.
          </p>
        )}
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
          <div className={`rounded-md border p-2.5 ${SELLER_FACING_VERDICT_STYLE[sellerDecision.finalVerdict]}`}>
            {/* P-19-B Sprint 8(CPO 지시, 2026-09-02) — 헤드라인 아이콘/타이틀/박스
                색은 3단계(sellerFacingVerdict)만 쓴다. 내부 5단계 코드/용어는
                화면 어디에도 노출하지 않는다 — 아래 설명 문장(description)만
                기존 representativeVerdict 값을 그대로 재사용한다.
                P-31 — 헤드라인은 sellerDecision.finalVerdict 하나만 본다.
                finalVerdict는 sellerFacingVerdict를 시장 신호로 강등만 한
                값이므로(승격 없음) 두 값이 서로 다른 결론을 낼 수 없다 —
                화면에 상반된 판정이 둘 뜨는 것을 구조로 막는다. */}
            <p className="font-medium">
              {FINAL_VERDICT_COPY[sellerDecision.finalVerdict].icon} {FINAL_VERDICT_COPY[sellerDecision.finalVerdict].title}
            </p>
            {sellerDecision.downgradedByMarket && (
              <p className="mt-0.5 text-[10px] text-text-tertiary">
                가격 경쟁력은 {FINAL_VERDICT_COPY[sellerDecision.priceVerdict].title} 수준이지만, 종합 시장 신호가 불리해
                한 단계 낮췄습니다
              </p>
            )}

            {/* P-12D(대표님/CPO 지시, 2026-08-31) — "숫자 → 결론 → 이유 → 상세정보"
                순서로 확정. 얼마에 사서/얼마가 들고/얼마에 팔지/얼마 남는지 4개
                숫자를 결론 설명·판단근거보다 먼저 보여준다. 새 계산 없음 — cost/
                recommendation/unifiedDecision은 기존에 이미 계산되던 값 그대로다. */}
            {/* P-25 Sprint 3/5(CPO 지시, 2026-09-02) — "①원가기반 최소판매가
                ②목표마진 판매가 ③국내시장가격 ④최종추천가"를 한 번에 보여준다.
                minimumPrice/targetPrice는 P-24부터 이미 계산되고 있었지만
                (packages/pricing/src/price-recommendation.ts) 화면에 라벨을
                달고 보여주는 곳이 없었다 — 새 계산 없음, 기존 값을 노출만
                추가한다. 이름은 CPO 제안(손익분기 최소판매가) 대신 "최소마진
                확보 판매가"를 쓴다 — minimumPrice는 실제로 마진율 0%가 아니라
                minimumMarginPercent(10%) 기준이라 "손익분기"라고 부르면 실제
                계산과 다른 숫자를 말하는 셈이다(값을 지어내지 않는다는 이
                프로젝트의 원칙과 동일한 이유). */}
            {cost && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-current/20 bg-background/40 p-2 sm:grid-cols-3">
                {/* UX-1C — 구매가/착지원가는 "이 숫자가 어떻게 나왔나"(L3)로
                    내렸다. L1에는 판매 결정에 직접 쓰는 예상 이익·마진율과
                    추천 판매가만 남긴다. 같은 숫자를 두 곳에 띄우지 않는다. */}
                <div>
                  <dt className="text-[10px] text-text-tertiary">📈 예상 수익</dt>
                  <dd className="text-sm font-semibold text-text-primary">
                    {unifiedDecision?.estimatedProfitKrw.value != null
                      ? `₩${unifiedDecision.estimatedProfitKrw.value.toLocaleString()}`
                      : "판매가 설정 필요"}
                    {unifiedDecision?.marginPercent.value != null && (
                      <span className="text-text-tertiary"> ({unifiedDecision.marginPercent.value}%)</span>
                    )}
                  </dd>
                </div>
                {/* P-26 Sprint 2/3(CPO 지시, 2026-09-03) — "10% 최소마진은 더
                    이상 절대 하한선이 아니다"(CEO 승인 옵션 1). minimumPrice/
                    targetPrice는 참고용 숫자로만 노출하고, 실제 권장가는
                    computePriceRecommendation()의 CASE A/B/C/D 판정
                    (marketCase)을 그대로 따른다 — 여기서 값을 다시 비교하지
                    않는다. CASE C/D는 억지 추천가를 만들지 않으므로
                    recommendedPrice가 null일 수 있다(화면도 "없음"을 명시). */}
                {recommendation && (
                  <>
                    {/* UX-1C — 최소마진/목표마진 참고가는 L3(상세 계산)로 이동.
                        L1에는 실제로 "얼마에 팔지"인 최종 추천 판매가만 남긴다. */}
                    <div>
                      <dt className="text-[10px] text-text-tertiary">🏷 최종 추천 판매가</dt>
                      {recommendation.recommendedPrice != null ? (
                        <>
                          <dd className="text-sm font-semibold text-text-primary">
                            ₩{recommendation.recommendedPrice.toLocaleString()}
                          </dd>
                          {recommendation.estimatedMarginPercent != null && (
                            <p className="mt-0.5 text-[10px] text-text-tertiary">
                              예상 마진 약 {recommendation.estimatedMarginPercent}%
                              {recommendation.marketCase === "B" && " (목표마진 미달, 손실 아님)"}
                            </p>
                          )}
                          {recommendation.competitiveBasis === "BRAND_MEDIAN" && (
                            <p className="mt-0.5 text-[10px] text-text-tertiary">
                              💡 국내 동일상품 없음 — 브랜드 시장 중앙값 기준 참고치
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <dd className="text-sm font-semibold text-text-tertiary">추천가 없음</dd>
                          <p className="mt-0.5 text-[10px] text-text-tertiary">
                            {recommendation.marketCase === "C"
                              ? "국내 시장가로 팔면 착지원가도 회수하지 못합니다"
                              : "국내 동일상품(EXACT) 시장가가 확인되지 않아 시장 경쟁력 기반 추천을 낼 수 없습니다"}
                          </p>
                        </>
                      )}
                    </div>
                  </>
                )}
                {!recommendation && (
                  <div>
                    <dt className="text-[10px] text-text-tertiary">🏷 추천 판매가</dt>
                    <dd className="text-sm font-semibold text-text-primary">₩{cost.suggestedPriceKrw.toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* UX-1C L1 — 한 줄 결론 설명은 항상 보인다. 숫자만 보고 "그래서 왜
                추천인데?"가 되지 않게 하기 위함(CPO 지시). */}
            <p className="mt-2 text-text-secondary">{representativeVerdict.description}</p>

            {/* UX-1C L2 — "왜 이 판단인가". 판정 엔진이 이미 낸 reasons를 그대로
                쓴다(문구를 새로 지어내면 판정 의미를 바꾸는 셈이라 금지). */}
            {representativeVerdict.reasons.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowWhyVerdict((v) => !v)}
                  className="mt-2 text-[11px] text-primary hover:underline"
                >
                  {showWhyVerdict
                    ? "왜 이 판단인가 접기 ▲"
                    : `왜 ${FINAL_VERDICT_COPY[sellerDecision.finalVerdict].title}인가 ▼`}
                </button>
                {showWhyVerdict && (
                  <ul className="mt-1.5 space-y-0.5 text-text-secondary">
                    {representativeVerdict.reasons.map((reason, i) => (
                      <li key={i}>✓ {reason}</li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* UX-1C L3 — "이 숫자가 어떻게 계산됐나". 구매원가·참고 기준가·브랜드
                분포는 검증용 근거이지 첫 화면의 결정 정보가 아니다. */}
            {cost && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCalcDetail((v) => !v)}
                  className="mt-2 block text-[11px] text-primary hover:underline"
                >
                  {showCalcDetail ? "상세 계산 접기 ▲" : "상세 계산 보기 ▼"}
                </button>
                {showCalcDetail && (
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-current/20 bg-background/40 p-2 sm:grid-cols-3">
                    <div>
                      <dt className="text-[10px] text-text-tertiary">💰 현재 구매가</dt>
                      <dd className="text-sm font-semibold text-text-primary">₩{cost.costKrw.toLocaleString()}</dd>
                      {costSource && (
                        <p className="text-[10px] text-text-tertiary">
                          {COST_SOURCE_LABEL[costSource]}
                          {costSource !== "STATIC_SNAPSHOT" && originLatestCheckedAt
                            ? ` · ${relativeTimeFromNow(originLatestCheckedAt)}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <div>
                      <dt className="text-[10px] text-text-tertiary">📦 착지원가</dt>
                      <dd className="text-sm font-semibold text-text-primary">
                        ₩{cost.landedCostKrw.toLocaleString()}
                      </dd>
                    </div>
                    {recommendation && (
                      <>
                        <div>
                          <dt className="text-[10px] text-text-tertiary">최소마진 확보가(참고)</dt>
                          <dd className="text-sm font-semibold text-text-primary">
                            ₩{recommendation.minimumPrice.toLocaleString()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-text-tertiary">목표마진 판매가(참고)</dt>
                          <dd className="text-sm font-semibold text-text-primary">
                            ₩{recommendation.targetPrice.toLocaleString()}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                )}
              </>
            )}
            {/* P-13A(대표님/CPO 지시, 2026-08-31) — "국내 동일상품 없음"이
                "시장 자체가 없음"과 같지 않다. 브랜드 시장 데이터가 있으면
                "왜 이 가격인가"의 근거로 보여준다 — 새 판정 아님, 서버가 이미
                계산한 분포를 그대로 노출한다. */}
            {showCalcDetail && brandMarketProfile && (
              <div className="mt-2 rounded-md border border-current/20 bg-background/40 p-2">
                <p className="text-[10px] font-medium text-text-primary">
                  💡 브랜드 시장 데이터 — {product.brand} 상품 {brandMarketProfile.sampleCount}개 분석
                </p>
                <div className="mt-1.5">
                  <div className="relative h-1.5 rounded-full bg-border">
                    <div
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary"
                      style={{
                        left: `${
                          ((brandMarketProfile.medianPriceKrw - brandMarketProfile.minPriceKrw) /
                            Math.max(1, brandMarketProfile.maxPriceKrw - brandMarketProfile.minPriceKrw)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-text-tertiary">
                    <span>₩{brandMarketProfile.minPriceKrw.toLocaleString()}</span>
                    <span className="font-medium text-text-primary">
                      중앙값 ₩{brandMarketProfile.medianPriceKrw.toLocaleString()}
                    </span>
                    <span>₩{brandMarketProfile.maxPriceKrw.toLocaleString()}</span>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-text-tertiary">
                  {BRAND_MARKET_CONFIDENCE_LABEL[brandMarketProfile.confidence]} · 추천 판매가는 이 브랜드 시장
                  중앙가격 이하로 산정됩니다.
                </p>
              </div>
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
            {/* P-25 Sprint 2(CPO 지시, 2026-09-02) — 이전에는 여기서
                sellability.reason(원가 vs 시장평균가, 배송비/수수료 미포함)을
                "참고" 캡션으로 그대로 출력했다. sellability는 recommendation/
                applyMarketPriceGuard를 전혀 모르는 별도 계산이라, 헤드라인이
                🟡(시장가 대비 마진 부족)인데 캡션은 "가격 경쟁력이 있습니다"라고
                말하는 실측 모순(PèPè)이 있었다 — "화면 안에서 서로 반대되는
                판매 조언이 없어야 한다"는 CPO 원칙에 따라 완전히 제거한다.
                sellability 계산 자체(estimatedMarginPercent 등)는 그대로
                유지한다(재계산 없음) — 화면 노출만 없앤다. */}
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
        {/* P-29 Sprint 8(CPO 지시, 2026-09-03) — "가격이 좋아도 팔릴지"를 가격
            판정(CASE A/B/C/D, 위 카드들)과 완전히 분리된 섹션으로 보여준다.
            marketSignals/sellingGuidance는 marketCase를 다시 계산하지
            않는다 — 신호가 좋아도 위 판매 판정(READY/HOLD 등)은 절대
            바뀌지 않는다(CPO 절대 금지 3). */}
        <div className="mt-3 rounded-md border border-border bg-surface-secondary p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-text-primary">📊 국내 시장 신호</h4>
            {/* MI-CONFIDENCE-2(CPO 지시, 2026-09-06) — 여기 있던 "신호 신뢰도
                ●●○"를 제거했다. 아래 "판단 데이터 N/5"와 분모도 산정 기준도
                달라서(신호 3종의 unknown 수 vs 판단에 쓸 데이터 확보 수)
                둘 다 신뢰도처럼 보이면 셀러가 혼란스럽다. 셀러 화면의 신뢰도는
                하나로 통일한다. marketSignals.confidence 계산과 API 필드는
                그대로 유지한다(deriveMarketSignals 공개 계약 + 테스트 존재). */}
          </div>

          {/* MI-UX-5(CPO 지시, 2026-09-06) — 기본 화면은 3초 안에 "얼마에 팔아볼
              만한가, 왜"에 답한다: 결론 한 줄 → 핵심 숫자 최대 2개 → 행동 한
              문장. 근거(종합 시장 상태, 신호 3종, 판단 요인, 전략 상세)는 전부
              아래 상세 토글로 내렸다 — 삭제가 아니라 위치 이동이다.
              서버가 sellingGuidance와 같은 facts로 만든 값이라 요약과 상세의
              숫자가 어긋날 수 없다. 구버전 응답이면 렌더하지 않는다. */}
          {sellingSummary && (
            <div className={`mb-2 rounded border px-2.5 py-2 ${MI_SUMMARY_TONE[sellingSummary.tone].box}`}>
              <p className={`text-xs font-semibold ${MI_SUMMARY_TONE[sellingSummary.tone].text}`}>
                {MI_SUMMARY_TONE[sellingSummary.tone].icon} {sellingSummary.headline}
              </p>
              {sellingSummary.numbers && (
                <p className="mt-1 text-sm font-semibold text-text-primary">{sellingSummary.numbers}</p>
              )}
              {/* MI-ACTION-1 — 등록 가격이 실제로 제시된 경우에만 행동 문장을
                  강조한다. 가격이 없는 CASE(B+공급충분/C/D)에서는 기존과 같은
                  보조 문장으로 남아 "지금 이 값으로 올리면 된다"는 오해를
                  만들지 않는다. */}
              <p
                className={
                  sellingSummary.actionPriceKrw != null
                    ? "mt-1 text-[11px] font-medium text-text-primary"
                    : "mt-0.5 text-[11px] text-text-secondary"
                }
              >
                {sellingSummary.action}
              </p>
            </div>
          )}

          {/* MI-REDEFINE-1 ⑧(CPO 지시, 2026-09-06) — 기본 화면에서 "판단 근거
              4/4 확인"을 뺀다. 셀러가 첫 화면에서 원하는 답은 "팔아도 되나,
              얼마에"이고 4/4는 그 결론이 아니다. 항목별 내역은 아래 상세보기의
              "🔎 판단 근거"에 그대로 있다 — 삭제가 아니라 노출 계층 변경이고,
              confidenceBasis 산식/데이터는 건드리지 않는다. */}

          <button
            type="button"
            onClick={() => setShowMarketDetail((v) => !v)}
            className="mt-3 w-full border-t border-border pt-2 text-left text-[11px] text-primary hover:underline"
          >
            {showMarketDetail ? "접기 ▲" : "왜 이렇게 판단했나요? ▼"}
          </button>

          {showMarketDetail && (
            <>
              {/* P-31 — "왜 이런 판단인가"를 문장 나열이 아니라 구조화된 표로
                  보여준다. 순서는 CPO 지정 우선순위(가격 수익성 → 동일상품 국내
                  가격 → 시장 관심 → 경쟁 판매처 → 시즌성)로 서버에서 이미 고정돼
                  오므로 여기서 다시 정렬하지 않는다. */}
              {/* MI-CONFIDENCE-1(CPO 지시, 2026-09-06) — "왜 ●●○인데?"에 답한다.
                  새 점수를 만들지 않고 이미 확보된 데이터 항목의 확인 여부만
                  나열한다. 확인되지 않은 항목은 사유까지 적어서, 낮은 신뢰도가
                  "결과를 못 쓴다"가 아니라 "무엇이 빠졌는지"로 읽히게 한다. */}
              {confidenceBasis && (
                <div className="mt-2 rounded border border-border bg-background p-2">
                  <p className="mb-1 text-xs font-semibold text-text-primary">
                    🔎 판단 근거 ({confidenceBasis.confirmedCount}/{confidenceBasis.totalCount} 확인)
                  </p>
                  <ul className="space-y-0.5 text-[11px]">
                    {confidenceBasis.items.map((item) => (
                      <li key={item.label} className="flex items-start gap-1.5">
                        <span className={item.confirmed ? "text-success" : "text-text-tertiary"}>
                          {item.confirmed ? "✓" : "○"}
                        </span>
                        <span className={item.confirmed ? "text-text-secondary" : "text-text-tertiary"}>
                          {item.label}
                          {item.note && <span className="ml-1 text-[10px]">— {item.note}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-text-primary">🧾 왜 이런 시장 판단이 나왔는가</p>
                <dl className="space-y-0.5 text-[11px]">
                  {sellerDecision.factors.map((factor) => (
                    <div key={factor.key} className="flex items-start justify-between gap-2">
                      <dt className="shrink-0 text-text-tertiary">
                        {FACTOR_LEVEL_ICON[factor.level]} {factor.label}
                      </dt>
                      <dd className="text-right text-text-secondary">{factor.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* MI-UX-5 — 종합 시장 상태는 신호 3종을 합친 값이므로 신호 바로
                  위, 상세 영역 안에 둔다(기본 화면 결론과 중복 노출 방지).
                  P-31 원칙 유지: 가격 경쟁력과 별개 레이어이므로 "시장 상태"
                  라고만 부르고 판매 추천/비추천 어휘를 쓰지 않는다. */}
              <div className="mt-2 flex items-center justify-between rounded border border-border bg-background px-2 py-1.5">
                <span className="text-[11px] text-text-secondary">종합 시장 상태</span>
                <span className="text-xs font-semibold text-text-primary">
                  {MARKET_OUTLOOK_BADGE[sellerDecision.outlook]}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-text-tertiary">
                {sellerDecision.outlookSummary}
                {sellerDecision.outlook === "UNKNOWN" &&
                  ` (확인된 신호 ${sellerDecision.knownSignalCount}개 — 데이터가 부족한 것이지 시장이 나쁘다는 뜻이 아닙니다)`}
              </p>

              {/* MI-UX-4 — 신호 3종은 "왜 그렇게 봤나"의 근거이므로 상세로 내렸다.
                  항목/판정은 그대로이고 노출 위치만 바뀐다. */}
              <div className="mt-2">
                <p className="mb-1 text-xs font-semibold text-text-primary">📶 시장 신호</p>
                <dl className="grid grid-cols-2 gap-y-1 text-xs sm:grid-cols-3">
                  {marketSignals.signals.map((signal) => (
                    <div key={signal.key} className="flex items-center justify-between gap-2 pr-2" title={signal.evidence}>
                      <dt className="text-text-tertiary">{signal.label}</dt>
                      <dd className="font-medium text-text-primary">{signalBadge(signal)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {sellingGuidance.length > 0 && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="mb-1 text-xs font-semibold text-text-primary">💡 가격·판매 전략 가이드</p>
                  <ul className="space-y-0.5 text-[11px] text-text-secondary">
                    {sellingGuidance.map((g, i) => (
                      <li key={i}>• {g}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2 text-[10px] text-text-tertiary">
                무료로 확인 가능한 신호를 근거와 함께 보여줍니다 — 실제 판매량 데이터는 포함되지 않습니다.
              </p>
            </>
          )}

          {/* UX-2(CEO 지시, 2026-09-05) — "상세보기 하면 아래 탭쪽으로 이동이
              되어 국내/해외 비교 및 결론 내용 참고할 수 있게". 판단의 원본
              근거인 해외/국내 가격비교 섹션은 같은 탭 아래쪽에 이미 있는데,
              판단 패널이 최상단으로 올라오면서 거리가 멀어졌다. 새 화면을
              만들지 않고 기존 섹션으로 스크롤만 연결한다 — 셀러가 "이 판단의
              근거를 직접 보고 싶다"고 할 때 한 번에 도달하게 하기 위함이다.
              앵커가 없으면(탭 전환 등) 아무 일도 하지 않는다. */}
          <button
            type="button"
            onClick={() =>
              document
                .getElementById(PRICE_COMPARISON_ANCHOR_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-primary hover:underline"
          >
            🔎 해외·국내 가격비교 원본 보기 ↓
          </button>
        </div>

        {/* P-2-3 ④ 국내 시장 가격(요약) — 기존 SellerAction 헤드라인의
            핵심 지표(내판매가/국내최저가/평균가/동일상품수/품절수)를 여기로
            옮긴다. "그래서 시장에서 얼마에 팔리는가?"가 이 블록의 유일한
            질문이다 — 판매 판단(위 ①)과는 별개 관심사로 분리한다. */}
        {/* MI-UX-8(CEO 실화면 테스트 → CPO 지시, 2026-09-06) — "💰 가격 전략"
            대형 블록을 제거했다.
            국내 동일상품 평균가/최저가/평균가/판매처 수, 해외 구매 비용 상세,
            한국向 표시가는 전부 위의 판매 판단·국내 시장 신호와 아래 가격비교
            영역에서 이미 확인할 수 있는 값의 반복이었다. 판단이 끝난 자리에
            다시 긴 가격 분석을 놓으면 "그래서 얼마에 팔아?"의 답이 묻힌다.

            제거한 것은 반복 UI뿐이다 — marketCase/recommendedPrice/targetPrice/
            minimumPrice/landedCost/domesticLowestPrice/sellerCount/confidence
            계산과 API 응답은 그대로다. 원본 수치는 "해외·국내 가격비교 원본
            보기" 버튼으로 기존 비교 영역에서 확인한다.
            MI = 판매 판단 / 가격비교 = 판단 근거 확인, 으로 역할을 나눈다. */}


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


        {/* Beta RC(CPO 지시, 2026-09-05) — "판매 추천/조건부/비추천"이라는 표현이
            상표권·지식재산권·브랜드 판매 권한까지 검토된 결과로 오해될 수 있다.
            현재 판정이 실제로 보는 범위와 보지 않는 범위를 명시한다. 판정 카드
            바깥(패널 루트)에 두어 🟢/🟡/🔴 어떤 상태에서도 항상 함께 보인다.
            문구 추가일 뿐 판정 로직/API/DB는 변경하지 않는다. */}
        <p className="text-[10px] text-text-tertiary">
          현재 판매 판단은 가격 경쟁력, 경쟁 환경, 예상 수익성 및 KC·규제 정보를 기반으로 합니다. 상표권,
          지식재산권, 정품 여부 및 브랜드 판매 권한은 별도 확인이 필요합니다.
        </p>

        <p className="text-[10px] text-text-tertiary">
          참고용 판단입니다 — 판매가는 자동으로 변경되지 않으며, 최종 결정은 직접 내려야 합니다. 가격경쟁력은
          등록 가능 여부와 무관합니다 — 마진이 낮거나 가격이 높아도 등록 자체는 막히지 않습니다.
        </p>
      </div>
    </CollapsibleSection>
  );
}
