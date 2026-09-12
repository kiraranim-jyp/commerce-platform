"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
// MATCHING-UNIFY-1 — 국내 가격비교 표와 같은 라벨을 쓰기 위한 공통 매핑.
import { domesticMatchDisplay } from "./match-display";
// MI 2.0 PHASE 1 — 판매 판단의 근거를 4축으로 분해해 보여준다(새 판정 아님).
import { computeRadar, type RadarSearchInterest, type RadarMatchTruth } from "@commerce/pricing";
// MI-POLISH-2(CEO 지시, 2026-09-12) — MiVerdictAxes(판정 아래 축 세 줄)를 더
// 이상 쓰지 않는다. 축은 "판단 근거"이지 "판단 숫자"가 아니라서 본문이 아니라
// 「왜 이렇게 판단했나요?」 안에 한 벌만 산다 — 거기 이미 MiAxisStars가 네 축을
// 사유까지 들고 있어서, 요약 세 줄을 같이 두면 같은 축이 한 화면에 두 번 뜬다.
import { MiAxisStars, MiRadar, MiRadarSummary } from "./MiRadar";
import { shouldRefetchAfterAutoCheck } from "../snapshot-save-guard";
// MI-FLOW-2(CEO 지시, 2026-09-11) — 판단 기준 시장 / 빈 상태 / 핵심 숫자 라벨은
// 전부 순수 함수로 빼 두었다. 화면에서 시장을 다시 판별하거나 숫자를 다시
// 계산하지 않기 위한 장치다(테스트가 그 규칙을 고정하고 있다).
import { KR_TARGET_MARKET, SUPPORTED_TARGET_MARKETS, type TargetMarket } from "./market-target";
import { buildHeadlineNumbers, type HeadlineNumber } from "./mi-headline";
import { miEmptyState } from "./mi-empty-state";
// UX 2.3(CEO 지시, 2026-09-11) — 여덟 가지 "가격"에 각각 하나씩만 라벨을 붙이고,
// 수익성 사슬과 시장 경쟁력을 서로 독립된 두 축으로 만든다(둘 다 순수 함수).
import {
  buildMarketContext,
  buildOriginalPriceHeadline,
  buildPriceChain,
  PRICE_MEANING_LABEL,
  PRICE_SECTION_TITLE,
  type MarketContext,
  type OriginalPriceHeadline,
  type PriceChainRow,
} from "./price-hierarchy";
// UX 2.4.1(CEO 지시, 2026-09-11) — ② 한국 시장 경쟁가격(MI-SIMPLIFY-1 전 ③).
// 두 축의 **결과만** 받아
// 나란히 놓는다(어느 builder의 입력에도 손대지 않는다).
import {
  buildMarketComparison,
  type MarketComparison,
  type MarketComparisonSide,
} from "./market-comparison";
// UX 2.4(CEO 지시, 2026-09-11) — 판매자가 시장마다 직접 파는 가격(B 그룹).
// 국내 비교상품(C 그룹)과 절대 같은 카드에 서지 않도록 파일부터 분리돼 있다.
import {
  buildGlobalMarketCard,
  globalMarketSummaryLine,
  pickJudgingMarketRow,
  GLOBAL_MARKET_HINT_LABEL,
  GLOBAL_MARKET_UNAVAILABLE_NOTE,
  type GlobalMarketCard,
  type GlobalMarketRow,
  type MarketObservationInput,
} from "./global-market";
// MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — CASE A/B/C/D를 셀러 어휘로 옮기는 유일한
// 지점. 화면이 marketCase로 직접 분기해 문장을 조립하지 않는다(내부 이름이
// 새어 나가는 경로 자체를 없앤다).
import {
  miMarketCaseVerdict,
  NO_DOMESTIC_COMPARABLE_NOTE,
  PRICE_BASIS_TOOLTIP,
} from "./mi-market-case";
// UX 2.1 — 이 패널의 내부 진행 상태를 하나의 작업 Flow(② 시장 판단)로 올려보낸다.
import type { MarketSignal as WorkflowMarketSignal } from "./workflow";
// UX 2.2 — 이 패널을 어느 무게로 그릴지는 화면이 아니라 단계가 정한다.
import type { MiPresentation } from "./stage-focus";

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

/** GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — 서버(summarizeFrom)가 이미 시장별로
 * 나눠 낸 값을 그대로 옮기는 타입. 여기서 시장을 다시 판별하거나 합치지
 * 않는다. 구버전 응답에는 없을 수 있어 optional로 둔다(화면이 죽지 않게). */
interface SellerMarketPriceInfo {
  marketCode: string | null;
  marketCountry: string | null;
  currency: string;
  priceAmount: number | null;
  priceKrw: number;
  productUrl: string | null;
  checkedAt: string;
}

interface SellerMarketGroupInfo {
  sellerKey: string;
  sellerLabel: string | null;
  markets: SellerMarketPriceInfo[];
}

/** 시장 코드 안에 적힌 지역을 그대로 읽어 라벨/국기로 만든다. 코드에 없는
 * 나라를 통화나 도메인으로 지어내지 않는다 — "en-int"처럼 국가가 아닌 코드는
 * 국기 없이 🌐로 둔다. marketCode가 null이거나 ""면 "시장 미확인"이다. */
function marketLabel(marketCode: string | null): { flag: string; text: string } {
  const code = marketCode?.trim().toLowerCase() ?? "";
  if (!code) return { flag: "❔", text: "시장 미확인" };
  const region = /^(?:[a-z]{2}-)?([a-z]{2})$/.exec(code)?.[1];
  const suffix = (code.includes("-") ? code.split("-").pop()! : code).toUpperCase();
  if (!region) return { flag: "🌐", text: suffix };
  const flag = String.fromCodePoint(...[...region.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  return { flag, text: suffix };
}

/** 관측된 통화와 금액을 그대로 보여준다 — 원화 환산값만 남기면 €75(DE)와
 * €84(INT)가 서로 다른 시장의 가격이라는 사실이 화면에서 다시 사라진다.
 * 원본 금액이 없으면(레거시 행) 저장된 원화값으로 폴백한다. */
function formatMarketPrice(price: SellerMarketPriceInfo): string {
  if (price.priceAmount == null) return `₩${price.priceKrw.toLocaleString()}`;
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: price.currency,
      maximumFractionDigits: price.currency === "KRW" ? 0 : 2,
    }).format(price.priceAmount);
  } catch {
    // Intl이 모르는 통화 코드면 지어내지 않고 코드를 그대로 붙인다.
    return `${price.priceAmount.toLocaleString()} ${price.currency}`;
  }
}

/**
 * GLOBAL-MARKET ② / MI-FLOW-2 — 판매처 한 곳의 한 시장 가격 한 줄.
 *
 * 한국 시장 목록과 해외 참고 목록이 같은 모양이어야 셀러가 두 번 배우지 않는다 —
 * 그래서 컴포넌트를 하나만 둔다. 여기서 시장을 판별하지 않는다(호출부가 이미
 * market_code로 갈라서 넘긴다).
 *
 * "기준 국가"라는 라벨을 쓰지 않는 이유가 중요하다. market_country는 *판매자가
 * 신고한 국가*이고 market_code는 *실제로 관측된 시장*이다(예: 신고 국가 ES인
 * 판매자가 en-kr 시장 페이지를 갖고 있을 수 있다). "기준 국가"라고 부르면 그
 * 둘이 같은 것처럼 읽혀서, 화면에서 두 사실이 섞인다.
 */
function MarketPriceRow({
  sellerLabel,
  price,
  isJudgingMarket,
  judgingBasis,
  showDeclaredCountry = false,
}: {
  sellerLabel: string | null;
  price: SellerMarketPriceInfo;
  isJudgingMarket: boolean;
  judgingBasis: "SINGLE" | "ANALYSIS" | "UNRESOLVED" | null;
  /**
   * UX 2.4(CEO 지시, 2026-09-11) — 판매자 신고 국가는 **펼친 상세에서만** 쓴다.
   * 기본 화면에 "독일 / 판매자 신고 국가 ES"를 나란히 그리면(실측: Bobo Choses는
   * 모든 시장에서 country=ES다) 읽는 사람이 "이게 독일 가격이야 스페인 가격이야?"
   * 에서 멈춘다 — 시장과 신고 국가를 가르려고 만든 표시가 오히려 둘을 섞어
   * 보이게 했다. 사실을 지우지 않고 한 겹 아래로 내린다.
   */
  showDeclaredCountry?: boolean;
}) {
  const label = marketLabel(price.marketCode);
  return (
    <li className="flex flex-wrap items-center justify-between gap-1 text-text-secondary">
      <span className="flex flex-wrap items-center gap-1">
        <span className="text-text-primary">{sellerLabel ?? "알 수 없음"}</span>
        <span>
          {label.flag} {label.text}
        </span>
        {/* 판단 시장만 명시한다 — 나머지는 보여주되 판단에 쓰이지 않았다는 뜻이다. */}
        {isJudgingMarket && judgingBasis === "ANALYSIS" && (
          <span className="rounded bg-success-soft px-1 py-0.5 text-[9px] font-medium text-success">판단 기준</span>
        )}
        {showDeclaredCountry && (
          <span className="text-[10px] text-text-tertiary">
            · 판매자 신고 국가 {price.marketCountry ?? "미확인"}
          </span>
        )}
      </span>
      {/* UX 2.3(CEO 지시, 2026-09-11) — 한 행이 시장 · 원본 통화 가격 · 원화
          환산을 전부 말해야 한다. 지금까지 이 줄은 €75만 보여줬고, 그 값이
          원화로 얼마인지는 셀러가 직접 환산해야 했다(매입처 비교가 이 블록의
          존재 이유인데 비교할 수가 없었다). 저장된 price_krw를 그대로 옮긴다 —
          여기서 환율 계산을 새로 하지 않는다. 원본 금액이 없는 레거시 행은
          formatMarketPrice가 이미 원화를 보여주므로 같은 값을 두 번 쓰지 않는다. */}
      {price.priceAmount != null && price.currency.toUpperCase() !== "KRW" && (
        <span className="text-[10px] text-text-tertiary">원화 환산 ₩{price.priceKrw.toLocaleString()}</span>
      )}
      {price.productUrl ? (
        <a href={price.productUrl} target="_blank" rel="noreferrer" className="text-text-primary underline">
          {formatMarketPrice(price)}
        </a>
      ) : (
        <span className="text-text-primary">{formatMarketPrice(price)}</span>
      )}
    </li>
  );
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
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 판단 카드로 스크롤할 때 쓰는 앵커.
 * 상단 진행바의 "⭐ 시장 판단"과 오른쪽 Action Center가 같은 곳을 가리켜야
 * 한다 — id를 한 곳에서 정의해 두 진입점이 어긋날 수 없게 한다.
 */
export const MARKET_VERDICT_ANCHOR_ID = "market-verdict";

/**
 * MI/PRICE-1(CEO 지시, 2026-09-12) — ③ 💰 수익성으로 데려가는 앵커.
 *
 * 상세 계산이 여기 하나뿐이 되면서, "왜 이 가격인가"를 묻는 모든 진입점
 * (③ 등록 준비의 확정 카드, 채널 화면의 [상품정보 가격 계산 →])이 결국 이
 * 한 자리로 와야 한다. id를 한 곳에서 정의해 두어 진입점마다 다른 곳으로
 * 데려가는 일이 생기지 않게 한다(MARKET_VERDICT_ANCHOR_ID와 같은 이유).
 */
export const PRICE_CALCULATION_ANCHOR_ID = "price-calculation-detail";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — "분석 기준 시장: 🇰🇷 대한민국"을 항상 띄운다.
 *
 * 판매 판단은 처음부터 한국 시장 관측(KR_MARKET)을 기준으로 계산돼 왔는데,
 * 화면에는 그 사실이 어디에도 없었다. €75(DE)·€84(INT)·₩162,000(KR)이 같은
 * 층위로 나열돼 있으니 "이 판단이 어느 시장 얘기인지"를 셀러가 역추적해야 했다.
 *
 * onChange를 받는 형태로 둔 것은 지금 필요해서가 아니라, 시장 선택기가 생길
 * 자리를 비워 두기 위해서다 — 지원 시장이 하나뿐인 동안에는 고정 문구로
 * 렌더된다(누를 수 없는 선택기를 그려서 "고를 수 있다"고 착각하게 만들지 않는다).
 */
function TargetMarketBanner({
  market = KR_TARGET_MARKET,
  onChange,
}: {
  market?: TargetMarket;
  onChange?: (next: TargetMarket) => void;
}) {
  const selectable = onChange != null && SUPPORTED_TARGET_MARKETS.length > 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-text-secondary">
        분석 기준 시장{" "}
        <span className="ml-1 text-sm font-semibold text-text-primary">
          {market.flag} {market.label}
        </span>
      </p>
      {selectable ? (
        <div className="flex items-center gap-1">
          {SUPPORTED_TARGET_MARKETS.map((m) => (
            <button
              key={m.region}
              type="button"
              onClick={() => onChange(m)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                m.region === market.region
                  ? "bg-primary text-white"
                  : "border border-border text-text-secondary hover:bg-surface"
              }`}
            >
              {m.flag} {m.shortLabel}
            </button>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-text-tertiary">판매 판단은 한국 시장을 기준으로 합니다</span>
      )}
    </div>
  );
}

/** MI-UI-1(CEO 지시, 2026-09-11) — 펼침 상태는 캐럿 하나로 말한다. 같은 화면에
 * 접힘 블록이 여러 개라 규칙이 블록마다 다르면(▼ 고정 vs ▸/▾) 셀러가 어느 게
 * 열려 있는지 매번 다시 읽어야 한다. */
function caret(open: boolean): string {
  return open ? "▾" : "▸";
}

/**
 * UX 2.1(CEO 지시, 2026-09-11) — 이 자리에 있던 MarketIntelligenceProgress
 * (시장가격 → 국내비교 → 레이더 → 가격비교 5단계 목록)를 제거한다.
 *
 * 없애는 것이 아니라 **옮기는** 것이다. 그 진행 상태는 이제 onMarketSignalChange로
 * 상단의 단 하나뿐인 작업 Flow에 올라가 ② 시장 판단의 하위 단계로 그려진다
 * (workflow.ts / WorkflowPanel.tsx). 같은 정보를 화면 두 곳에서 각자 그리면
 * 그게 바로 이번 지시가 없애려는 "진행 표시 세 개" 문제 그 자체다.
 *
 * 여기(화면 가운데)는 이제 ②의 **결과**만 책임진다 — 분석이 도는 동안에는
 * 결과 자리를 잡아두는 준비 화면(MarketIntelligenceSkeleton)을 보여준다.
 * 실제 요청과 1:1로만 진행을 표시한다는 MI-LOADING-1 원칙은 그대로 살아 있다:
 * 그 판단이 workflow.ts로 옮겨갔을 뿐이다.
 */

/**
 * MI-UI-1(CEO 지시, 2026-09-11) — 준비 화면과 진행 화면의 높이를 맞추기 위한
 * 최소 높이. 두 화면이 차례로 나타나는데 높이가 다르면 그 사이에서 아래 섹션
 * (이미지/Source Data)이 한 번 더 밀린다 — 자리를 미리 잡아두는 것이 이번
 * 지시의 핵심이라 같은 값을 둘 다 쓴다.
 */
const MI_LOADING_MIN_HEIGHT = "min-h-[260px]";

/**
 * MI-UI-1(CEO 지시, 2026-09-11) — "URL을 넣으면 1~2초 뒤에 Market Intelligence가
 * 갑자기 나타나서, 로딩 중인지 아닌지 알 수가 없다."
 *
 * 원인은 이 패널이 snapshotId가 생긴 뒤에야 마운트된다는 것이다(스냅샷 최초
 * 저장 응답까지의 공백). 그동안 화면에는 이 섹션이 아예 없어서, 자리도 없고
 * 로딩 표시도 없었다. 그 공백을 이 컴포넌트가 채운다.
 *
 * 여기서 데이터를 흉내 내지 않는다 — 숫자 자리에 회색 막대만 두고, 무엇을
 * 기다리는 중인지 문장으로 말한다. 단계 목록은 여기에 두지 않는다: 어디까지
 * 왔는지는 상단 작업 Flow의 ② 시장 판단이 하위 단계로 보여주고, 이 자리는
 * 곧 들어올 결과의 모양만 잡아둔다(UX 2.1).
 */
export function MarketIntelligenceSkeleton({
  /** 무엇을 기다리는 중인지. 스냅샷 저장 전과 분석 중은 기다리는 대상이 다르다. */
  message = "상품 정보를 저장하는 중입니다 — 저장이 끝나면 시장 분석을 시작합니다.",
}: {
  message?: string;
} = {}) {
  return (
    <CollapsibleSection title="Market Intelligence" defaultOpen>
      <div className={`rounded-md border border-border bg-background p-4 ${MI_LOADING_MIN_HEIGHT}`}>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-base">🤖</span>
          <p className="text-sm font-semibold text-text-primary">AI Market Intelligence</p>
        </div>
        <p className="mb-4 text-xs text-text-secondary">{message}</p>
        {/* 결과 화면의 4칸 요약이 들어올 자리. 라벨을 미리 쓰지 않는다 —
            값이 없는데 "국내 최저가"라고 써두면 곧 숫자가 나올 자리인지
            "확인 불가"로 끝날 자리인지 지금은 알 수 없기 때문이다. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2 w-2/3 animate-pulse rounded bg-border" />
              <div className="h-4 w-full animate-pulse rounded bg-border" />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-3 w-5/6 animate-pulse rounded bg-border" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-border" />
        </div>
      </div>
    </CollapsibleSection>
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
export interface DomesticCandidate {
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
/* MATCHING-UNIFY-1(CPO 지시, 2026-09-06) — 라벨을 match-display.ts로 통합했다.
   같은 matchTruth가 이 패널과 국내 가격비교 표에서 다른 문구로 보이던 문제를
   없앤다. 판정값·가격 반영 정책은 변경 없다. */

/**
 * P-20 Sprint 7(CPO 지시, 2026-09-02) — priceTierFromLink()가 TEXT_CONFIRMED/SIMILAR를
 * COMPARISON(비교상품 시장가격, 참고용)으로 이미 반영한다(P-19-B Sprint 7). 이 함수는
 * 그 이전(EXCLUDED와 동일하게 "가격비교에 전혀 반영 안 됨")으로 문구가 남아있던 것을
 * 실제 데이터(PèPè + deuxbebe.com 실측)로 발견해 고친다 — priceTierFromLink()와
 * 동일한 3-way 분기(EXACT/COMPARISON/EXCLUDED)를 그대로 따르고, 새 판정을 만들지
 * 않는다. */
export function candidateLabel(c: DomesticCandidate): { icon: string; text: string; note: string } {
  if (c.matchTruth) {
    const d = domesticMatchDisplay(c.matchTruth);
    const base = { icon: d.icon, text: d.label };
    // 가격 반영 여부는 판정이 아니라 기존 정책의 결과를 그대로 옮긴 문구다
    // (EXACT/STRONG만 동일상품 가격, 나머지는 참고 또는 제외).
    if (c.matchTruth === "TEXT_CONFIRMED" || c.matchTruth === "SIMILAR") {
      const pct = Math.round(c.matchConfidence * 100);
      return { ...base, note: `${d.note} · 텍스트 유사도 ${pct}%` };
    }
    if (c.matchTruth === "CONFLICT" || c.matchTruth === "INSUFFICIENT_EVIDENCE") {
      return { ...base, note: `${d.note} — 가격비교에 반영하지 않습니다` };
    }
    return { ...base, note: `${d.note} → 동일상품 가격으로 반영됨` };
  }
  // 레거시 fallback(matchTruth=null, 마이그레이션 030 이전 저장된 행) — 예전 로직 그대로.
  if (c.verified) {
    // MATCHING-UNIFY-1 — 레거시 경로도 같은 라벨을 쓴다. 마이그레이션 전
    // 저장된 행이라는 이유로 다른 문구가 나오면 셀러에게는 다른 등급으로 보인다.
    const byIdentifier = c.matchReasons.some((r) => r.includes("식별자 근거"));
    return {
      icon: "🟢",
      text: "동일상품",
      note: byIdentifier ? "식별자 근거로 확인됨 → 가격비교에 반영됨" : "→ 가격비교에 반영됨",
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
  /** MI-STOCK-CLARITY-1 — 위 가격 집계에 들어간 리스팅의 재고 3분류 개수.
   * 구버전 응답에는 없을 수 있어 optional로 둔다(화면이 죽지 않게). */
  stockCounts?: { onSale: number; unknown: number; soldOut: number };
  /** GLOBAL-MARKET ② — 판매처별 시장 가격. 위 lowestPriceKrw/averagePriceKrw는
   * 이 중 priceMarketCode 한 시장의 값이고, 나머지 시장은 여기에만 있다. */
  sellers?: SellerMarketGroupInfo[];
  priceMarketCode?: string | null;
  priceMarketBasis?: "SINGLE" | "ANALYSIS" | "UNRESOLVED";
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

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — 원가 근거가 된 관측 행이 통화 그대로 들고
 * 있는 값. 서버(price_observations → getPriceHistory)는 이 세 칸을 처음부터
 * 돌려주고 있었는데 프론트 타입 선언이 없어 화면이 읽지 못했다 — 새 계산이
 * 아니라 타입 노출만 추가한다(cost.shippingKrw / unifiedDecision 때와 같은 패턴).
 *
 * 이 행이 필요한 이유는 하나다. cost.originalAmount는 최근 실측 관측이 있으면
 * 이미 **원화로 접힌** 값이라(costSource = LATEST_SALE/LATEST_PRICE) 원본 통화가
 * 남지 않는다. 그래서 화면의 첫 줄이 "원본 판매가격 ₩99,928"이었다.
 */
interface OriginObservationRecord extends PriceHistoryRecord {
  /** 관측된 통화 그대로("GBP" / "KRW"). */
  currency?: string;
  /** 그 통화 그대로의 금액. 품절 등으로 가격을 못 읽었으면 null. */
  priceAmount?: number | null;
  /** 그 관측에 함께 저장된 환율. 한국 표시가 관측(KR_MARKET)은 환산이 없어 null이다. */
  exchangeRate?: number | null;
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

export interface PriceHistoryResponse {
  ok: boolean;
  product: { title: string; brand: string; sourceUrl: string };
  currentPrice: {
    sellingPriceKrw: number | null;
    costPriceKrw: number | null;
    /** N-4.18-Q3 P0-2 — "KR_MARKET"(실제 한국 표시가 우선) / "ORIGIN_FX"(원문
     * 통화×환율 폴백) / null(이 필드 도입 이전 관측). */
    costBasis: "KR_MARKET" | "ORIGIN_FX" | null;
  };
  /**
   * UX 2.4(CEO 지시, 2026-09-11) — 이 판매처가 시장마다 직접 파는 가격(B 그룹).
   * 서버(groupMarketObservations)가 market_code별 최신 1건으로 이미 접어서 보낸
   * 값이다 — 화면에서 시장을 다시 판별하거나 합치지 않는다. 구버전 응답에는
   * 없을 수 있어 optional로 둔다(화면이 죽지 않게).
   */
  sellerGlobalMarkets?: MarketObservationInput[];
  domesticCompetition: DomesticCompetition;
  priceHistory: {
    /** N-4.18-J STEP J-6 — "🌎 해외" 블록에 원가 변화(▼/▲%)를 보여주기 위해
     * 이미 서버가 계산해 돌려주는 값을 그대로 읽는다(새 계산 없음). */
    origin: {
      change: { changeRatePercent: number } | null;
      /** P-12D — costSource 배지("최신 확인가 기준 · N시간 전")에 쓸 시각.
       * records[0]이 최신(서버가 이미 checked_at desc로 정렬해 돌려준다).
       * UX 2.4.1 — 그 최신 1건이 곧 원가 근거 관측이다(market-intelligence.ts가
       * costPriceKrw/costBasis를 같은 행에서 읽는다). ①의 원본 통화 가격도
       * 여기서 온다 — 같은 행에서 나와야 금액·통화·환율이 서로 맞는다. */
      records: OriginObservationRecord[];
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
    /** UX 2.3(CEO 지시, 2026-09-11) — computePriceBreakdown()이 처음부터 돌려주던
     * 값인데(packages/pricing/src/breakdown.ts) 프론트 타입에 없어서 화면이 읽지
     * 못하고 있었다. 착지원가 = 원화 환산 + 이 값이라는 관계를 보여주려면 중간
     * 항이 화면에 있어야 한다 — 새 계산이 아니라 타입 노출만 추가한다(P-2-3
     * unifiedDecision 때와 같은 패턴). */
    shippingKrw: number;
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
/** MI-FLOW-2 — 오른쪽 Action Center도 같은 판정을 보여줘야 한다. 문구 맵을
 * 그쪽에 복사하면 언젠가 한쪽만 바뀌어 같은 상품이 화면 좌우에서 다른 판정으로
 * 보인다 — 타입과 맵을 여기서 내보내 한 벌만 유지한다. */
export type SellerFinalVerdict = SellerDecisionInfo["finalVerdict"];

export const FINAL_VERDICT_COPY: Record<
  SellerFinalVerdict,
  { icon: string; title: string; tone: "GOOD" | "CAUTION" | "STOP" }
> = {
  RECOMMENDED: { icon: "🟢", title: "판매 추천", tone: "GOOD" },
  CONDITIONAL: { icon: "🟡", title: "조건부 판매", tone: "CAUTION" },
  NOT_RECOMMENDED: { icon: "🔴", title: "판매 비추천", tone: "STOP" },
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

/** UX 2.2 — 요약 카드는 박스 색 대신 글자 색만 쓴다(오른쪽 Action Center의
 * 판단 줄과 같은 위계). 판정 3단계는 위 STYLE과 같은 값에서 나온다 — 색이
 * 서로 다른 판정을 말하지 않도록 키를 공유한다. */
const SELLER_FACING_VERDICT_TEXT: Record<SellerFacingVerdict["code"], string> = {
  RECOMMENDED: "text-success",
  CONDITIONAL: "text-warning",
  NOT_RECOMMENDED: "text-error",
};

/**
 * UX 2.2(CEO 지시, 2026-09-11) — ③④에서 MI가 앉는 자리.
 *
 * 전체 화면과 같은 카드 골격(border/surface)을 쓰되 높이를 한 줄로 줄인다.
 * 자리를 아예 없애지 않는 이유: 등록 준비/등록 단계에서도 셀러는 "지금 이
 * 상품을 팔아도 된다고 했었나?"를 계속 확인한다 — 결론은 남고 근거만 접힌다.
 */
function MiSummaryShell({
  children,
  onOpenDetail,
}: {
  children: React.ReactNode;
  onOpenDetail?: () => void;
}) {
  return (
    <section
      id={MARKET_VERDICT_ANCHOR_ID}
      className="flex scroll-mt-4 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-4 py-2.5 shadow-subtle"
    >
      <div className="flex min-w-0 flex-col">{children}</div>
      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary-soft"
        >
          {/* UX 2.3 — 이 버튼이 여는 것은 "판단"이 아니라 가격 계층 전체다.
              무엇이 열리는지 버튼이 먼저 말해야 셀러가 눌러볼지 고를 수 있다. */}
          가격 판단 상세보기 →
        </button>
      )}
    </section>
  );
}

/** 요약 한 줄에 들어가는 숫자 한 칸. 값이 없으면 빈 상태 칩을 그대로 쓴다 —
 * 요약이라고 해서 "없음"을 "0"이나 "—"로 바꾸지 않는다. */
function MiSummaryNumber({ number }: { number: HeadlineNumber | undefined }) {
  if (!number) return null;
  return (
    <span className="text-xs text-text-secondary">
      · {number.label} {number.value ?? <span className="text-text-tertiary">{number.empty?.chip}</span>}
    </span>
  );
}

/**
 * UX 2.3(CEO 지시, 2026-09-11) — 가격 계층. "이 숫자들이 서로 무슨 관계인가"를
 * 화면 모양 자체가 말하게 한다.
 *
 * ── 왜 한 줄에 한 의미만 두는가 ──────────────────────────────────────────
 * CEO 지시문의 스케치는 `£55.00 → 약 ₩99,928`처럼 두 값을 한 줄에 둔다. 그
 * 모양을 그대로 쓰지 않고 줄을 나눈 이유는 같은 지시문의 더 강한 규칙 때문이다:
 * "서로 다른 두 의미를 하나의 뭉뚱그린 숫자로 잇지 않는다". 한 줄에 두 값을
 * 두면 라벨은 앞의 값에만 붙고 뒤의 숫자는 라벨 없이 남는다 — 그게 정확히
 * "€37 ≈ ₩57,756"이 만들어지던 방식이다. 대신 관계는 줄머리 기호(→ / + / =)와
 * 가로줄이 그대로 보여준다: 관계는 살리고 라벨은 하나씩 유지한다.
 *
 * 계산은 하지 않는다 — price-hierarchy.ts가 고른 값을 순서대로 그리기만 한다.
 */
const CHAIN_ROLE_MARK: Record<PriceChainRow["role"], string> = {
  SOURCE: "",
  CONVERT: "→",
  ADD: "+",
  TOTAL: "=",
  PLAN: "",
  RESULT: "",
};

function PriceChainView({ rows }: { rows: PriceChainRow[] }) {
  /**
   * UX 2.4(CEO 지시, 2026-09-11) — 여기 남는 것은 착지원가 → 내 판매가격 →
   * 예상 수익 → 예상 마진이다. 환산가와 국제배송비는 착지원가 안에 이미
   * 합쳐져 있어서(결과가 화면에 남아 있어서) 접어도 사실이 사라지지 않는다.
   * 무엇이 요약인지는 price-hierarchy.ts의 tier가 정한다 — 화면이 key/role을
   * 세어 고르기 시작하면 값이 하나 늘 때마다 여기를 또 고쳐야 한다.
   *
   * MI/PRICE-1(CEO 지시, 2026-09-12) — showDetail prop이 없어졌다. 예전에는 이
   * 뷰가 DETAIL 층(원화 환산 · 국제배송비)까지 펼쳐 그렸는데, 지금은 그 줄들을
   * **편집 가능한 상세 계산**(PriceCalculationDetail)이 같은 ④ 안에서 그린다.
   * 둘 다 그리면 한 접힘 안에서 같은 국제배송비가 두 번 나온다 — 이번 지시가
   * 없애라고 한 중복 그대로다. 그래서 이 뷰는 언제나 요약 넷만 그린다.
   *
   * ── MI-POLISH-2(CEO 지시, 2026-09-12) — 기준 문장은 툴팁으로 내려간다 ──────
   * 요약 넷은 줄이 넷이 아니라 **여덟**이었다. 값 아래마다 기준 문장이 따라
   * 붙었기 때문이다("내 판매가 − 확인된 원가 − 플랫폼 수수료 · 수수료 ₩8,610 ·
   * 아직 확인되지 않은 비용이 있어…"). 그 문장들은 전부 참이지만 셋 다 같은
   * 성격이다 — **숫자가 아니라 그 숫자의 근거**. 이 저장소의 규칙 그대로 층을
   * 내린다: 본문은 판단 숫자, 툴팁은 근거, 펼침은 원자료.
   *
   * 지우지 않고 title로 옮기는 이유가 중요하다. "⚪ 확인 불가"만 남으면 셀러는
   * 무엇을 못 했는지 모르고, 사유까지 본문에 적으면 ③이 다시 설명 문단이 된다.
   * title은 그 둘 사이의 유일한 자리다(글로벌 시장 ⓘ 한 줄과 같은 장치).
   */
  const visible = rows.filter((row) => row.tier === "SUMMARY");
  return (
    <dl className="rounded-md border border-current/20 bg-background/40 p-2.5">
      {visible.map((row) => {
        const total = row.role === "TOTAL";
        const plan = row.role === "PLAN";
        const result = row.role === "RESULT";
        // 값이 있으면 "무엇을 기준으로 한 값인가", 없으면 "왜 없는가". 둘 다
        // 근거라 같은 자리(툴팁)에 선다 — 어느 쪽도 본문 줄을 얻지 못한다.
        const note = row.value ? row.basis : (row.empty?.reason ?? row.basis);
        return (
          <div
            key={row.key}
            title={note ?? undefined}
            className={`flex flex-wrap items-baseline justify-between gap-x-2 py-1 ${
              // 가로줄은 "여기까지가 내가 치르는 돈"이라는 뜻이다. 합계 줄 위에만 둔다.
              total ? "mt-0.5 border-t border-current/25 pt-1.5" : ""
            } ${plan ? "mt-1 border-t border-dashed border-current/25 pt-1.5" : ""}`}
          >
            <dt className="flex min-w-0 items-baseline gap-1">
              <span className="w-3 shrink-0 text-[11px] text-text-tertiary" aria-hidden>
                {CHAIN_ROLE_MARK[row.role]}
              </span>
              <span
                className={
                  total || plan || result
                    ? "text-[11px] font-semibold text-text-primary"
                    : "text-[11px] text-text-secondary"
                }
              >
                {row.label}
              </span>
            </dt>
            <dd className="flex min-w-0 flex-col items-end">
              {row.value ? (
                <span
                  className={
                    total || result
                      ? "text-sm font-bold text-text-primary"
                      : "text-sm font-semibold text-text-primary"
                  }
                >
                  {row.value}
                </span>
              ) : (
                // 값이 없으면 0이나 "—"로 바꾸지 않는다. 왜 없는지는 지우지 않고
                // 위 title로 옮겼다 — 칩만으로는 "조회가 고장났나"로 읽힌다.
                <span className="text-xs font-semibold text-text-tertiary">{row.empty?.chip}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — **① 원본 상품 가격**. 화면이 여는 첫 줄.
 *
 * 셀러는 URL을 붙여넣고 "이 상품이 원래 얼마지?"를 묻는다. 그 답은 원본 통화로
 * 적힌 한 줄이다 — 그래서 가장 큰 숫자는 언제나 원본 통화 금액이다.
 * 국내 경쟁시장의 어떤 값도 여기 들어오지 않는다: 남이 파는 값이 원본가 옆에
 * 서는 순간 "원본가격이 왜 한국 돈이지?"가 다시 시작된다(UX 2.4.1의 출발점이
 * 정확히 그 화면이다).
 *
 * ── MI/PRICE-2(CEO 지시, 2026-09-12) — 원본 판매자 한국 표시가는 여기 산다 ──
 * 다만 /en-kr의 ₩162,000은 남의 값이 아니다. **그 판매처 자신의 페이지**에서
 * 직접 읽은 값이라 원본 상품의 사실에 속한다 — 그래서 작은 줄로 함께 선다.
 * 그 값을 ②의 시장 줄에 "착지원가 기준"이라고 적어 두던 것이 이번에 지운
 * 화면이다: 관측된 시장가와 내가 치르는 돈(₩116,742 + 국제배송비)은 다른
 * 사실이고, 후자는 ③ 수익성에만 있다.
 */
/**
 * ── MI-POLISH-2(CEO 지시, 2026-09-12) — 근거 문장 세 줄이 툴팁으로 내려간다 ──
 * ①이 답하는 질문은 "이 상품이 원래 얼마인가" 하나다. 그런데 화면에는 그 아래로
 * 환율 기준("1 EUR = ₩1,455 · 가격 확인 시점 환율")·원본 기준("원본 판매자
 * 페이지 기준 · 최신 확인가 기준")·한국 표시가의 관측 기준·※ 주석이 차례로
 * 붙어서, 숫자 하나를 위해 네 문장을 읽어야 했다. 전부 참이지만 전부 **근거**다.
 * 사실은 지우지 않고 title로 옮긴다 — 본문은 숫자, 툴팁은 근거(이 파일의 규칙).
 */
function OriginalPriceView({ headline }: { headline: OriginalPriceHeadline }) {
  // 원본가·환산의 근거와 ※ 주석을 한 줄로 합쳐 큰 숫자에 붙인다. 여러 title을
  // 나눠 달면 셀러가 어느 숫자 위에 마우스를 올려야 하는지 또 골라야 한다.
  const priceNote =
    [
      headline.converted?.value ? headline.converted.basis : null,
      headline.price.value ? headline.price.basis : (headline.price.empty?.reason ?? headline.price.basis),
      headline.note,
    ]
      .filter(Boolean)
      .join(" · ") || undefined;
  return (
    <div className="rounded-md border border-current/20 bg-background/40 p-2.5">
      <p className="text-[11px] font-semibold text-text-primary">{headline.title}</p>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2" title={priceNote}>
        {headline.price.value ? (
          // 원본 통화 금액이 이 화면에서 가장 큰 숫자다 — 첫 질문의 답이므로.
          <span className="text-lg font-bold text-text-primary">{headline.price.value}</span>
        ) : (
          <span className="text-sm font-semibold text-text-tertiary">{headline.price.empty?.chip}</span>
        )}
        {/* 환산값은 "약"을 달고 작게 온다. 라벨 없이 두면 원본가와 같은 층위의
            두 번째 가격으로 읽힌다 — 이건 가격이 아니라 같은 가격의 환산이다. */}
        {headline.converted?.value && (
          <span className="text-xs text-text-secondary">
            약 {headline.converted.value} · {headline.converted.label}
          </span>
        )}
      </div>
      {/* MI/PRICE-2 — 원본 판매자 한국 표시가. 원본 통화 금액보다 한 단계 작게
          두는 것이 층위다: 첫 질문의 답은 €75이고, 이 줄은 같은 판매처가 한국
          페이지에 따로 매긴 값이다. 숫자를 여기서 만들지 않는다 — ②의 🇰🇷 줄이
          들고 있던 문자열 그대로다(같은 사실의 두 표시). */}
      {headline.krMarket?.value && (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5" title={headline.krMarket.basis ?? undefined}>
          <span className="text-[10px] text-text-tertiary">{headline.krMarket.label}</span>
          <span className="text-sm font-semibold text-text-primary">{headline.krMarket.value}</span>
        </p>
      )}
    </div>
  );
}

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — **② 한국 시장 경쟁가격**. 비교가 일어나는
 * 유일한 자리.
 *
 * ── 왜 두 값을 나란히 놓는가 ─────────────────────────────────────────────
 * 셀러가 이 화면에서 실제로 내리는 판단은 한 문장이다: "이 판매자는 한국에서
 * ₩78,000에 파는데 한국의 다른 판매자들은 ₩116,600에 판다." 지금까지 그 두
 * 숫자는 서로 다른 카드에 따로 있었고, 둘을 이어 붙이는 일은 셀러의 머릿속에서
 * 일어나야 했다 — 라벨이 둘 다 "🇰🇷 ₩"라서 대개는 같은 값으로 읽고 지나쳤다.
 *
 * 차액을 계산하지 않는다. 그 사이에는 국제배송비·수수료가 있고, 빼는 일은
 * ③ 수익성이 이미 한다(같은 뺄셈을 두 곳에서 하면 두 숫자가 갈라진다).
 */
/**
 * ── MI-POLISH-2(CEO 지시, 2026-09-12) — 게이트가 뷰 안으로 들어온다 ──────────
 * "비교할 국내 상품이 없으면 DOM에서 사라진다"는 규칙을 **이 컴포넌트 자신이**
 * 지킨다. MI-SIMPLIFY-1에서는 호출부가 `{marketComparison.hasComparable && …}`로
 * 감쌌는데, 그 방식은 규칙과 뷰가 서로 다른 파일 위치에 살아서 다음 사람이
 * 이 뷰를 한 번 더 쓰는 순간 게이트 없는 두 번째 렌더가 생긴다. 조건이 뷰의
 * 첫 줄이면 그런 자리가 존재할 수 없다.
 *
 * export하는 이유는 하나다 — 렌더 결과가 **빈 문자열**이라는 것을 테스트가
 * 실제 DOM으로 확인할 수 있게(mi-polish.test.ts). "빈 카드가 아니라 카드 없음"은
 * 소스 배치가 아니라 렌더 결과로만 증명되는 사실이다.
 */
export function MarketComparisonView({
  comparison,
  context,
  stockNote,
}: {
  comparison: MarketComparison;
  /** 근거의 두께(비교 판매처 수)와 "가격 경쟁력만 확인 불가" 문장은 C 그룹 그대로다. */
  context: MarketContext;
  /** 국내 비교상품 가격이 어떤 재고 상태 위에 서 있는지. 그 사실이 붙어야 할
   * 곳은 그 가격 옆이라 이 블록이 들고 있는다. */
  stockNote?: React.ReactNode;
}) {
  // 빈 칸 두 개짜리 카드는 정보가 아니라 질문이다 — 셀러는 조회가 고장났는지
  // 자기가 뭘 안 했는지를 스스로 추론해야 했다. 무엇이 "비교상품이 있다"인지는
  // 화면이 아니라 buildMarketComparison이 정한다(두 곳이 각자 세면 블록은
  // 숨겼는데 판정은 비교한 것으로 나오는 날이 온다).
  if (!comparison.hasComparable) return null;
  return (
    <div className="rounded-md border border-current/20 bg-background/40 p-2.5" title={comparison.versusNote}>
      <p className="text-[11px] font-semibold text-text-primary">{comparison.title}</p>
      <div className="mt-1.5 flex flex-wrap items-stretch gap-2">
        <ComparisonSideView flag={context.market.flag} side={comparison.seller} />
        {/* 기호가 "이 둘은 비교 대상"이라고 말한다. 가운데 놓여야 두 칸이 서로
            다른 사실이라는 것이 모양만으로 읽힌다. */}
        <div className="flex items-center text-[11px] font-bold text-text-tertiary">{comparison.versus}</div>
        <ComparisonSideView flag={context.market.flag} side={comparison.domestic} />
      </div>
      {/* MI-POLISH-2 — ※ versusNote(무엇과 무엇을 비교하는가)는 블록 title로
          올라갔다. 아래 남는 것은 근거의 두께 한 줄과, 지울 수 없는 경고뿐이다. */}
      <p className="mt-1 text-[10px] text-text-tertiary">{context.sellerCount.label}</p>
      {stockNote}
      {/* UX 2.3의 핵심 문장. "시장 비교 불가 ≠ 수익성 계산 불가"를 화면이 직접
          말한다 — 셀러가 빈 칸을 보고 스스로 추론하게 두지 않는다.
          MI-POLISH-2 — 문구는 그대로 두고 상자만 걷었다. 테두리를 두르면 조회
          실패가 판정의 실패처럼 읽히는데, 이건 "원가·수익 계산은 그대로다"라고
          말하는 문장이라 경고 모양을 가질 이유가 없다. */}
      {context.competitivenessNote && (
        <p className="mt-0.5 text-[10px] leading-relaxed text-text-tertiary">→ {context.competitivenessNote}</p>
      )}
    </div>
  );
}

/** 비교 한 칸. 두 칸은 완전히 같은 모양이다 — 모양이 다르면 한쪽이 결론처럼
 * 보이는데, 여기서는 어느 쪽도 결론이 아니라 서로의 기준이다.
 *
 * MI-POLISH-2 — 기준 문장(관측 시장·환산·등급)과 결측 사유는 title로 내려간다.
 * 왼쪽 칸이 비었을 때 "⚪ 검색 데이터 없음"과 그 사유가 함께 두 줄로 서면,
 * 비교 카드의 절반이 조회 실패 설명문이 된다. */
function ComparisonSideView({ flag, side }: { flag: string; side: MarketComparisonSide }) {
  return (
    <div
      className="min-w-[9rem] flex-1 rounded border border-border bg-background px-2 py-1.5"
      title={(side.value ? side.basis : (side.empty?.reason ?? side.basis)) ?? undefined}
    >
      <p className="text-[10px] text-text-tertiary">
        {flag} {side.label}
      </p>
      {side.value ? (
        <p className="text-sm font-semibold text-text-primary">{side.value}</p>
      ) : (
        <p className="text-xs font-semibold text-text-tertiary">{side.empty?.chip}</p>
      )}
    </div>
  );
}

/**
 * UX 2.4(CEO 지시, 2026-09-11) — **B 그룹: 판매자 글로벌 시장 가격**.
 *
 * 한 행이 네 가지를 말한다: 시장 · 관측된 통화 그대로의 가격 · 원화 환산 ·
 * 판매 상태. 지금까지 이 값들은 price_observations까지 도착해 놓고 화면에
 * 한 줄도 나오지 않았다.
 *
 * ── 왜 착지원가 사슬에 접어 넣지 않는가 ──────────────────────────────────
 * 사슬은 "내가 치르는 돈"의 계산이다. 여기 있는 €37(FR)이나 $53(US)은 내가
 * 치르는 돈이 아니라 **이 판매처가 그 시장에서 받는 값**이다. 사슬 안에 넣으면
 * 어느 줄이 원가 계산에 들어갔는지 읽을 수 없게 된다(실제로 MARKET_PROBE 행이
 * 원가로 잘못 읽히던 사고를 GLOBAL-MARKET ③이 라벨로 막아 뒀다 — 화면에서도
 * 같은 분리를 유지한다).
 *
 * ── 왜 국내 비교상품과 한 카드에 두지 않는가 ─────────────────────────────
 * 🇰🇷 한국 ₩78,000(이 판매처가 한국에 직접 파는 값)과 국내 비교상품 ₩116,600
 * (다른 한국 판매자들이 파는 값)이 같은 목록에 서면, 셀러는 ₩38,600짜리
 * 기회를 "같은 종류의 숫자 둘"로 읽고 지나친다.
 *
 * ── MI/PRICE-2(CEO 지시, 2026-09-12) — 두 블록의 "동일 상품"은 다른 개념이다 ─
 *   🌎 판매자 글로벌 시장   같은 판매자가 여러 시장에서 파는 가격   구성으로 동일
 *   🇰🇷 국내 경쟁시장       다른 판매자의 비교 가능 상품           매칭으로 판정
 *
 * 그래서 이 줄의 배지는 언제나 🟢 하나이고(등급이 없다), ③의 🟢 동일상품 /
 * 🟡 동일상품 추정 / ⚪ 유사상품(match-display.ts)과 문구가 일부러 다르다.
 * 같은 어휘를 쓰면 셀러는 글로벌 줄의 동일성도 알고리즘이 흔들 수 있다고 읽고,
 * 반대로 국내 줄의 추정도 확정처럼 읽는다.
 */
/**
 * ── MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 카드였던 것이 한 줄이 된다 ─────────
 * 이 블록은 판단에 필요한 숫자가 아니라 **매입처를 고를 때의 근거**다. 본문에
 * 카드로 서 있으면 "팔 만한가"의 답과 같은 무게로 읽히고, 그러는 동안 MI는
 * 판단 화면이 아니라 가격 설명 화면이 된다.
 *
 * 그래서 층을 하나 내린다 — 사실은 그대로 두고 무게만 바꾼다:
 *   본문     ⓘ 글로벌 시장 가격  🇫🇷 FR €75 · 🇩🇪 DE €75 · …   (한 줄)
 *   펼침     시장별 관측 · 판매자 신고 국가 · 관측 시각 · 원본 링크
 *
 * 관측이 없을 때 이 자리에 서는 것도 한 줄뿐이다(GLOBAL_MARKET_UNAVAILABLE_NOTE).
 * 노란 경고 상자를 세우지 않는 이유는 그게 사실이 아니기 때문이다 — 다른 시장
 * 가격을 못 본 것은 판정의 실패가 아니고, ③ 수익성은 그대로 계산된 채 남는다.
 */
/**
 * ── MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 한 줄이 이름 하나가 된다 ───────
 * MI-SIMPLIFY-1이 카드를 한 줄로 접었는데, 그 한 줄이 여전히 시장 목록 전체를
 * 본문에 늘어놓고 있었다("ⓘ 🌎 판매자 글로벌 시장 가격  🇫🇷 FR €75.00 ·
 * 🇩🇪 DE €75.00 · 🌎 INT €84.00 · 🇰🇷 KR ₩162,000"). 층은 내렸는데 **표면이
 * 줄지 않은** 것이다 — 원본 가격 바로 아래에서 네 개의 가격이 판단 숫자와
 * 같은 줄 폭을 차지하면, 셀러의 눈은 "원래 얼마인가" 다음에 곧바로 "그래서
 * 어느 게 진짜 가격이지?"로 빠진다.
 *
 * 그래서 본문에 남는 것은 **이름 하나**다: ⓘ 글로벌 시장 가격 ▸.
 * 시장별 가격은 사라지지 않는다 — 툴팁(한 줄 요약)과 펼침(원자료)에 그대로
 * 있다. 이 파일의 규칙 그대로다: 본문은 판단 숫자, 툴팁은 근거, 펼침은 원자료.
 */
function GlobalMarketHint({
  card,
  summaryLine,
  open,
  onToggle,
}: {
  card: GlobalMarketCard;
  /** 시장 줄들을 이어 붙인 한 줄. global-market.ts가 완성한 문자열 그대로다.
   * 본문에 그리지 않고 툴팁으로만 쓴다(펼치지 않아도 값을 볼 수 있는 자리). */
  summaryLine: string | null;
  /** 시장별 원자료를 펼쳤는가. */
  open: boolean;
  onToggle: () => void;
}) {
  // 조용한 한 줄. 상태 칩(⚪)도 쓰지 않는다 — 이 사실은 판단의 빈 칸이 아니라
  // 그저 부가 정보의 부재라, 빈 상태 어휘를 쓰면 판정이 비어 보인다.
  // 버튼으로 만들지 않는 이유: 눌러도 나올 것이 없는 토글은 셀러에게 "뭔가
  // 숨겨져 있다"고 거짓말한다.
  if (summaryLine == null) {
    return <p className="text-[10px] text-text-tertiary">ⓘ {GLOBAL_MARKET_UNAVAILABLE_NOTE}</p>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        // 툴팁이 "그 숫자의 근거"를 맡는다 — 시장별 가격과, 이 줄이 국내
        // 비교상품도 착지원가도 아니라는 사실이 전부 여기 있다(본문 문장이 아님).
        title={`${summaryLine} · ${card.note}`}
        className="flex flex-wrap items-baseline gap-x-1 text-left text-[10px] text-text-tertiary hover:underline"
      >
        <span className="font-medium">ⓘ {GLOBAL_MARKET_HINT_LABEL}</span>
        <span aria-hidden>{caret(open)}</span>
      </button>
      {open && <GlobalMarketCardView card={card} />}
    </div>
  );
}

/**
 * 펼쳤을 때만 그려지는 원자료. 본문에서 내려온 것은 배치이지 사실이 아니다 —
 * 시장별 줄·라벨·근거·신고 국가는 전부 그대로다.
 *
 * open/onToggle을 더 이상 받지 않는다. 이 뷰 자체가 이미 "펼친 상태"이므로
 * 자기 안에 두 번째 접힘을 갖는 순간 셀러는 같은 내용을 두 번 열어야 한다
 * (UX 2.4가 없애 둔 중첩 토글이 되살아난다).
 */
function GlobalMarketCardView({ card }: { card: GlobalMarketCard }) {
  return (
    <div className="mt-1 rounded-md border border-current/20 bg-background/40 p-2.5">
      {card.rows.length === 0 ? (
        <p className="text-[11px] text-text-tertiary">
          {card.empty?.chip}
          {card.empty?.reason && <span className="ml-1 text-[10px]">— {card.empty.reason}</span>}
        </p>
      ) : (
        <>
          <ul className="space-y-0.5">
            {card.rows.map((row) => (
              <GlobalMarketRowView key={row.marketCode} row={row} showDetail />
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-relaxed text-text-tertiary">※ {card.note}</p>
        </>
      )}
    </div>
  );
}

/** 시장 한 줄. 숫자를 여기서 만들지 않는다 — global-market.ts가 이미 완성한
 * 문자열을 배치만 한다(같은 값이 카드마다 다른 모양으로 뜨는 것을 막는다). */
function GlobalMarketRowView({ row, showDetail }: { row: GlobalMarketRow; showDetail: boolean }) {
  return (
    <li className="text-[11px] text-text-secondary">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="flex flex-wrap items-baseline gap-1">
          <span className="text-text-primary">
            {row.flag} {row.name}
          </span>
          <span className="text-[10px] text-text-tertiary">{row.code}</span>
          {/* MI/PRICE-2 — 여기 있던 "착지원가 기준" 배지를 지웠다. ₩162,000은
              관측된 시장가이고 착지원가(₩116,742 + 국제배송비)는 다른 숫자라,
              그 자리에서 원가를 말하면 시장가가 원가로 읽힌다. 같은 관측이 ④
              원가 계산의 출발점이라는 사실은 ①이 문장으로 말한다. */}
          <span className="rounded bg-success-soft px-1 py-0.5 text-[9px] font-medium text-success">
            {row.identity.icon} {row.identity.text}
          </span>
          <span className="text-[10px] text-text-tertiary">
            {row.availability.icon} {row.availability.text}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          {/* 판단 시장 줄만 라벨을 단다 — 화면의 다른 "한국 가격"(③ 국내 비교상품,
              ④ 착지원가)과 부딪히는 유일한 줄이라서다. €75(DE)는 부딪힐 상대가
              없어 시장 이름만으로 충분하다. */}
          {row.priceMeaningLabel && (
            <span className="text-[10px] text-text-tertiary">{row.priceMeaningLabel}</span>
          )}
          {row.productUrl ? (
            <a href={row.productUrl} target="_blank" rel="noreferrer" className="font-semibold text-text-primary underline">
              {row.observedPrice}
            </a>
          ) : (
            <span className="font-semibold text-text-primary">{row.observedPrice}</span>
          )}
          {/* 원화 환산값에는 반드시 라벨이 붙는다 — "≈ ₩57,756"만 있으면 그게
              한국에서 관측된 가격인지 우리가 환율로 만든 값인지 알 수 없다. */}
          {row.krwPrice && <span className="text-[10px] text-text-tertiary">원화 환산 {row.krwPrice}</span>}
        </span>
      </div>
      {showDetail && (
        <p className="text-[10px] text-text-tertiary">
          {/* 동일 상품이라는 판단의 근거. 줄에 두면 시장·가격이 뒤로 밀려서
              펼침에만 둔다(배지는 사실을, 이 줄은 그 사실이 선 근거를 말한다). */}
          {row.identity.evidence} · 판매자 신고 국가 {row.declaredCountry ?? "미확인"} · 관측{" "}
          {relativeTimeFromNow(row.checkedAt)}
        </p>
      )}
    </li>
  );
}

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
  snapshotOriginPrice = null,
  onPriceLevelChange,
  onSellerVerdictChange,
  onMarketSignalChange,
  onRequestPriceReview,
  autoChecking,
  presentation = "FULL",
  onOpenDetail,
  onCloseDetail,
  priceCalculationDetail = null,
  openPriceDetailRequest = 0,
}: {
  snapshotId: string;
  /**
   * UX 2.4.1(CEO 지시, 2026-09-11) — 스냅샷에 저장된 원본 판매자 페이지 가격
   * (통화 그대로). 서버 응답을 늘리지 않고 CommerceWorkspace가 이미 들고 있는
   * canonicalProduct.price를 그대로 넘긴다 — 셀러가 Source Data에서 보는 원본
   * 가격과 ①이 같은 값을 말하게 하기 위한 연결이다.
   *
   * 쓰이는 경우는 하나뿐이다: 원가 기준이 "판매자의 한국 표시가"라 응답 어디에도
   * 원본 통화 가격이 남지 않은 상품(costBasis = KR_MARKET). 가격을 읽지 못한
   * 스냅샷(priceValidity ≠ VALID)은 호출부가 null로 넘긴다 — 못 읽은 값을
   * 원본가격이라고 부르지 않는다.
   */
  snapshotOriginPrice?: { amount: number; currency: string } | null;
  /** P-32 — "팔 만한가?"의 답(판매 판정)을 상위로 보고한다. CommerceWorkspace가
   * 이 값과 등록 준비 상태를 한 화면에 나란히 놓기 위해 쓴다. 두 값을 합쳐
   * 새 판정을 만들지는 않는다(registration-readiness-outcome.ts 참고). */
  onSellerVerdictChange?: (verdict: SellerDecisionInfo["finalVerdict"] | null) => void;
  /** N-4.08 STEP6-4와 같은 패턴(onReadinessChange) — 이 패널이 계산한 값을
   * CommerceWorkspace가 탭 배지/상태 요약에 캐싱해서 쓸 수 있게 보고한다. */
  onPriceLevelChange?: (level: PriceLevel) => void;
  /**
   * UX 2.1(CEO 지시, 2026-09-11) — 이 패널 안에서만 돌던 진행 표시(시장가격 →
   * 국내비교 → 레이더 → 가격비교)를 상단의 단 하나뿐인 작업 Flow로 올려보낸다.
   *
   * 그 진행 표시가 여기 갇혀 있었기 때문에 셀러는 "MI는 별도 작업인가?"를
   * 물었다 — 실제로는 ② 시장 판단, 즉 흐름의 핵심 단계 하나가 돌고 있는
   * 것이었다. 여기서 새 판정을 만들지 않는다: 이미 갖고 있는 요청 완료 여부와
   * 서버 응답의 존재 여부만 사실 그대로 옮긴다.
   */
  onMarketSignalChange?: (signal: WorkflowMarketSignal) => void;
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
  /**
   * UX 2.2(CEO 지시, 2026-09-11) — 이 패널의 **표현 무게**. 데이터도, 계산도,
   * 서버 호출도 전혀 달라지지 않는다(아래 useState/useEffect는 어느 값이든
   * 똑같이 돈다) — 같은 결과를 통째로 펼칠지 한 줄로 접을지만 정한다.
   *
   *   FULL    ② 시장 판단이 현재 단계 — 화면의 주인공.
   *   SUMMARY ③④ — 결론 한 줄 + [판단 상세보기].
   *   HIDDEN  아직 판단할 근거 자체가 없는 구간. 계산은 그대로 돌고 화면에만 없다.
   *
   * ── HIDDEN이 return null인 것이 중요한 이유 ─────────────────────────────
   * 이 패널은 이제 탭 분기 밖(CommerceWorkspace 껍데기)에서 **항상** 마운트된다.
   * 예전처럼 상품정보 탭 안에서만 마운트되면, 쿠팡 탭이 sessionStorage로 복원된
   * 세션에서는 패널이 아예 뜨지 않아 ② 시장 판단이 영원히 "시작 안 함"에
   * 머물렀다 — 상단 단계가 탭에 따라 뒤로 돌아가는 실제 버그였다. 화면에서
   * 숨길 때도 언마운트하지 않는 이유가 그것이다.
   */
  presentation?: MiPresentation;
  /** 요약 카드의 [판단 상세보기]. 단계를 되돌리지 않고 판단만 펼친다. */
  onOpenDetail?: () => void;
  /** 펼쳐 둔 판단을 다시 접는다. 상세보기로 펼친 경우에만 넘어온다. */
  onCloseDetail?: () => void;
  /**
   * MI/PRICE-1(CEO 지시, 2026-09-12) — ③ 💰 수익성의 접힘 안에 들어가는 **상세
   * 계산**. 제품 전체에서 이 슬롯 하나뿐이다(PriceCalculationDetail).
   *
   * ── 왜 컴포넌트가 아니라 슬롯(ReactNode)인가 ─────────────────────────────
   * 상세 계산은 CanonicalProduct와 그 setter 넷을 읽고 쓴다. 그 값을 이 패널이
   * 직접 받으면, 셀러가 배송비를 10원 고칠 때마다 MI가 통째로 다시 그려지고
   * 언젠가는 "가격이 바뀌었으니 다시 분석하자"는 코드가 여기 들어온다. 그 순간
   * 숫자 하나 고칠 때마다 10~20초짜리 재분석이 붙는다.
   *
   * 그래서 이 패널은 product를 통째로 받지 않는다(price-single-surface.test.ts가
   * 이 사실을 마운트 지점에서 검사한다). 이미 만들어진 노드를 자리에 놓기만
   * 하고, 상태와 핸들러 소유권은 CommerceWorkspace에 그대로 남는다 —
   * StageBody가 무거운 편집기를 ReactNode로 받는 것과 완전히 같은 규칙이다.
   */
  priceCalculationDetail?: React.ReactNode;
  /**
   * 바깥에서 "가격이 왜 이 값인지 보여달라"는 요청이 올 때마다 1씩 올라가는 값
   * (③ 등록 준비의 확정 카드, 채널 화면의 [상품정보 가격 계산 →]).
   *
   * 불리언이 아니라 카운터인 이유는 StageBody.openPriceSurfaceRequest와 같다:
   * 같은 요청이 두 번 올 수 있는데(접었다가 다시 누르는 경우) 불리언이면 두
   * 번째 클릭에서 값이 그대로라 아무 일도 일어나지 않는다.
   */
  openPriceDetailRequest?: number;
}) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 펼침 상태(showMarketDetail /
  // showPriceDetail / showGlobalMarketDetail / showDomesticDetail / showHistory /
  // showMatchEvidence / showCalcDetail)는 전부 MiPanelView로 내려갔다. 여기
  // 남는 것은 "서버에서 무엇을 읽었는가"뿐이다 — 그 분리가 있어야 화면 전체를
  // 서버 렌더로 그려서 첫 화면에 무엇이 서는지 직접 확인할 수 있다.
  // MI-FLOW-2(CEO 지시, 2026-09-11)의 규칙은 그대로다: "왜"를 묻는 접힘은
  // 화면에 하나뿐이고, 나머지는 전부 그 아래에 산다.
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

  /**
   * UX 2.1 — ② 시장 판단의 진행 상태. 위 onSellerVerdictChange와 같은 패턴이지만
   * 판정 하나가 아니라 "지금 어디까지 왔는가"를 통째로 올려보낸다.
   *
   * ── 여기서 절대 하지 않는 것 ───────────────────────────────────────────
   * 다시 계산하지 않는다. 아래 값들은 전부 (a) 이미 끝난 요청인지(stepDone /
   * autoChecking)와 (b) 서버 응답에 그 값이 실제로 들어있는지 둘 중 하나다.
   * 특히 "데이터가 없다"와 "못 불러왔다"를 분리해서 올린다 — 위쪽 화면이 그
   * 둘을 같은 실패로 그리면 국내 비교상품 0건이 "시장 판단 실패"가 된다.
   */
  const marketSignal = useMemo<WorkflowMarketSignal>(() => {
    // 자동 가격 확인(page.tsx가 쏘는 /api/price-history/check)이 돌고 있는 동안은
    // 시장가 조회가 아직 끝나지 않은 것이다 — stepDone.analysis만 보면 안 된다.
    const priceProbeDone = !autoChecking && stepDone.analysis;
    // 아래 세 항목은 같은 응답(/api/price-history/:id) 하나에서 나온다.
    // 요청을 쪼개서 가짜 순차 진행을 만들지 않는다 — 같은 시점에 함께 끝난다.
    const analysisDone = priceProbeDone;
    const hasDomestic = (data?.domesticCompetition?.tier ?? "NONE") !== "NONE" || candidates.length > 0;
    const hasDemandSignal = (data?.marketSignals?.signals ?? []).some((s) => s.level !== "unknown");
    const verdict = data?.sellerDecision?.finalVerdict ?? null;
    return {
      notStarted: false,
      priceProbeDone,
      domesticProbeDone: !autoChecking && stepDone.competitors,
      domesticDataFound: hasDomestic,
      demandProbeDone: analysisDone,
      demandDataFound: hasDemandSignal,
      profitabilityDone: analysisDone,
      profitabilityFound: data?.recommendation?.estimatedMarginPercent != null,
      verdictKnown: verdict != null,
      // 서버의 SELLER_FACING_COPY와 같은 문구를 쓴다 — UI에서 이름을 다시 짓지 않는다.
      verdictLabel: verdict ? FINAL_VERDICT_COPY[verdict].title : null,
      // 요청이 전부 끝났는데 응답이 없는 경우에만 "못 불러왔다"이다.
      // 로딩 중의 null을 실패로 읽으면 화면이 매번 실패부터 보여준다.
      loadFailed: !loading && !autoChecking && data === null,
    };
  }, [autoChecking, loading, data, candidates, stepDone]);

  useEffect(() => {
    onMarketSignalChange?.(marketSignal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketSignal]);

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
  // UX 2.1 — 분석이 도는 동안 이 자리는 "어디까지 왔는지"를 말하지 않는다.
  // 그건 상단 작업 Flow의 ② 시장 판단이 이미 하위 단계로 보여주고 있고
  // (onMarketSignalChange로 올려보낸 그 값이다), 같은 말을 두 번 하는 순간
  // 셀러는 두 진행 표시가 다른 작업인 줄 알고 다시 읽는다. 여기는 곧 들어올
  // 결과의 자리만 잡아둔다 — 화면이 갑자기 튀어나오지 않게 하려던 MI-UI-1의
  // 목적은 그대로 지켜진다.
  //
  // UX 2.2 — 아래 세 갈래(진행 중 / 못 불러옴 / 결과)는 표현 무게마다 모양이
  // 다르다. 판정은 하나도 달라지지 않는다 — 같은 사실을 한 줄로 줄일 뿐이다.
  // HIDDEN은 훅이 전부 돈 뒤에 화면만 비운다(위 presentation 주석 참고).
  if (presentation === "HIDDEN") return null;

  if (autoChecking || loading || justCompleted) {
    if (presentation === "SUMMARY") {
      return (
        <MiSummaryShell>
          <span className="text-sm font-semibold text-text-secondary">⏳ 시장 분석 중</span>
          <span className="text-[11px] text-text-tertiary">
            {KR_TARGET_MARKET.flag} {KR_TARGET_MARKET.label} 시장 기준으로 판단하고 있습니다
          </span>
        </MiSummaryShell>
      );
    }
    // MarketIntelligenceSkeleton이 CollapsibleSection까지 포함한다 — 여기서 또
    // 감싸면 "Market Intelligence" 헤더가 두 겹으로 겹친다.
    return (
      <MarketIntelligenceSkeleton
        message={
          justCompleted && !autoChecking && !loading
            ? "분석이 끝났습니다. 결과를 정리하고 있습니다."
            : "한국 시장 기준으로 이 상품을 판단하고 있습니다 — 실제 시장 가격을 조회하므로 10~20초 정도 걸릴 수 있습니다."
        }
      />
    );
  }
  // MI-LOADING-1 — 기존에는 결과가 없으면 패널이 통째로 사라져서 "분석이 실패한
  // 건지 아직 안 한 건지" 알 수 없었다. 실패는 실패라고 말한다 — 없는 숫자를
  // 만들지 않는다는 UX-3 원칙과 같은 이유다.
  if (!data) {
    if (presentation === "SUMMARY") {
      return (
        <MiSummaryShell>
          <span className="text-sm font-semibold text-text-secondary">⚠ 시장 분석을 불러오지 못했습니다</span>
          <span className="text-[11px] text-text-tertiary">잠시 후 다시 시도해주세요 — 등록은 계속할 수 있습니다</span>
        </MiSummaryShell>
      );
    }
    return (
      <CollapsibleSection title="Market Intelligence" defaultOpen>
        {/* MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 기술적 실패는 카드가 아니라
            한 줄이다. 테두리 두른 상자는 "판정이 나빴다"처럼 읽히는데, 이건
            판정이 아니라 우리 쪽 조회가 아직 안 된 상태다. */}
        <p className="text-xs text-text-tertiary">
          ⓘ 시장 분석 데이터를 불러오지 못했습니다 — 잠시 후 다시 시도해주세요.
        </p>
      </CollapsibleSection>
    );
  }

  return (
    <MiPanelView
      data={data}
      candidates={candidates}
      snapshotOriginPrice={snapshotOriginPrice}
      presentation={presentation}
      priceCalculationDetail={priceCalculationDetail}
      openPriceDetailRequest={openPriceDetailRequest}
      onCloseDetail={onCloseDetail}
      onOpenDetail={onOpenDetail}
      onRequestPriceReview={onRequestPriceReview}
      rechecking={rechecking}
      recheckResult={recheckResult}
      onRecheck={() => void recheckNow()}
      confirmingId={confirmingId}
      onConfirmSameProduct={(id) => void confirmSameProduct(id)}
    />
  );
}

/**
 * MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — **패널이 실제로 그리는 화면 전부**.
 *
 * ── 왜 이 컴포넌트가 생겼나 ──────────────────────────────────────────────
 * 이번 지시의 출발점은 "테스트는 통과하는데 화면은 여전히 길다"였다. 그 간극의
 * 원인은 명확하다: 지금까지의 검사는 (a) 소스 텍스트를 잘라 보거나 (b) 자식
 * 하나(MarketComparisonView)만 렌더해 봤다. 둘 다 "패널 전체를 그렸을 때 셀러
 * 눈앞에 무엇이 서는가"는 증명하지 못한다 — 실제로 판정 카드 **아래**에는
 * 재조회 버튼 · 기회 카드 · 국내 비교상품 블록 · 동일상품 근거 · 안내 두 문단이
 * 접힘 없이 계속 서 있었고, 어떤 테스트도 그 영역을 보고 있지 않았다.
 *
 * 그래서 화면을 통째로 렌더할 수 있는 자리를 만든다. 바깥 패널은 fetch와
 * 서버 보고(onPriceLevelChange 등)만 갖고, 그리는 일은 전부 여기서 한다 —
 * 이 컴포넌트는 서버 응답과 후보 목록만 받으면 되므로 react-dom/server로
 * **패널 전체**를 그려서 결과 마크업을 검사할 수 있다(mi-ux-final.test.ts).
 * 자식 하나가 아니라 화면 하나를 검사한다는 것이 이번 변경의 핵심이다.
 *
 * 데이터도 계산도 하나 바뀌지 않았다: 아래 코드는 예전 패널의 렌더 부분
 * 그대로이고, 펼침 상태(showMarketDetail 등)가 함께 내려온 것뿐이다.
 * 서버 호출은 여기에 하나도 없다(있으면 그리는 일과 읽는 일이 다시 섞인다).
 */
export function MiPanelView({
  data,
  candidates,
  snapshotOriginPrice = null,
  presentation = "FULL",
  priceCalculationDetail = null,
  openPriceDetailRequest = 0,
  onCloseDetail,
  onOpenDetail,
  onRequestPriceReview,
  rechecking = false,
  recheckResult = null,
  onRecheck,
  confirmingId = null,
  onConfirmSameProduct,
}: {
  data: PriceHistoryResponse;
  candidates: DomesticCandidate[];
  snapshotOriginPrice?: { amount: number; currency: string } | null;
  presentation?: MiPresentation;
  priceCalculationDetail?: React.ReactNode;
  openPriceDetailRequest?: number;
  onCloseDetail?: () => void;
  onOpenDetail?: () => void;
  onRequestPriceReview?: () => void;
  rechecking?: boolean;
  recheckResult?: RecheckResult | null;
  onRecheck?: () => void;
  confirmingId?: string | null;
  onConfirmSameProduct?: (id: string) => void;
}) {
  // P-2-3 ④(대표님 지시, 2026-08-28) — "기본 화면에서 바로 10개 이상의 경쟁
  // 가격을 보여주지 않는다." 판매처별 개별 리스팅/추세/이력은 기본 접힘.
  const [showDomesticDetail, setShowDomesticDetail] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  /** MI-UX-9 §9 — "동일상품 매칭 근거"는 기본 숨김(상세 펼침에서만 확인). */
  const [showMatchEvidence, setShowMatchEvidence] = useState(false);
  /**
   * UX 2.4(CEO 지시, 2026-09-11) — 가격 영역의 접힘은 **두 개뿐**이다.
   *
   *   showPriceDetail        ③ 수익성의 [ⓘ 가격 계산 기준]
   *   showGlobalMarketDetail 글로벌 시장 상세(판매자 신고 국가 · 관측 시각)
   *
   * MI/PRICE-1(CEO 지시, 2026-09-12) — 이 토글이 여는 것이 바뀌었다. 예전에는
   * 사슬의 DETAIL 두 줄(환율 환산 · 국제배송비)만 폈는데, 이제는 제품 전체에서
   * 유일한 상세 계산(priceCalculationDetail 슬롯)을 편다. ③의 접힘은 여전히
   * **하나**다 — 요약 넷 + 토글 하나가 CPO가 지정한 모양이다.
   */
  const [showPriceDetail, setShowPriceDetail] = useState(false);
  /**
   * 바깥의 "가격 계산 기준 보기" 요청을 이 토글에 잇는다. useEffect가 아니라
   * 렌더 중 동기화인 이유는 이 저장소의 다른 파생 state(StageBody의
   * priceOpen, LiveNumberField의 draft)와 같다 — 한 번 더 그리는 대신 이번
   * 렌더에서 바로 맞춘다. 접는 것은 셀러만 할 수 있다(요청은 열기만 한다).
   */
  const [syncedPriceDetailRequest, setSyncedPriceDetailRequest] = useState(openPriceDetailRequest);
  if (openPriceDetailRequest !== syncedPriceDetailRequest) {
    setSyncedPriceDetailRequest(openPriceDetailRequest);
    setShowPriceDetail(true);
  }
  const [showGlobalMarketDetail, setShowGlobalMarketDetail] = useState(false);
  /**
   * 「왜 이렇게 판단했나요?」 하나. 본문이 아닌 것은 전부 이 아래에 산다.
   *
   * MI-UX-FINAL-REVIEW — 이 토글이 맡는 범위가 넓어졌다. 예전에는 판정 카드
   * 안쪽 상세만 여닫았고, 카드 **아래**의 재조회·기회·국내 비교상품·동일상품
   * 근거·안내 문단은 어떤 토글에도 속하지 않은 채 항상 서 있었다. 이제 그
   * 다섯 덩어리가 전부 여기로 들어온다 — 지운 것은 하나도 없다.
   */
  const [showMarketDetail, setShowMarketDetail] = useState(false);
  // UX-1C(CPO 지시, 2026-09-05) / MI 2.0 PHASE 1.2 — 원가 참고 숫자는 기본 접힘.
  const [showCalcDetail, setShowCalcDetail] = useState(false);

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

  // MI 2.0 PHASE 1 — 서버가 이미 낸 값들을 읽어 4축 상태로 옮긴다.
  // 여기서 가격/판정을 다시 계산하지 않는다.
  // 서버가 이미 낸 신호 등급을 그대로 넘긴다 — 같은 신호를 두 곳에서 다르게
  // 계산하지 않는다(레이더가 자체 임계값을 만들지 않는 이유).
  const searchSignal = marketSignals.signals.find((s) => s.key === "searchInterest");
  const searchInterest: RadarSearchInterest = searchSignal?.level ?? "unknown";
  const radar = computeRadar({
    // recommendation이 없으면(가격 근거 자체가 없는 상태) CASE도 없다 —
    // 없는 판정을 지어내지 않고 null을 넘겨 "확인 불가"로 떨어뜨린다.
    marketCase: recommendation?.marketCase ?? null,
    landedCostKrw: cost?.landedCostKrw ?? null,
    recommendedPriceKrw: recommendation?.recommendedPrice ?? null,
    domesticLowestPriceKrw: domesticCompetition.lowestPriceKrw,
    domesticAveragePriceKrw: domesticCompetition.averagePriceKrw,
    domesticBasis: domesticMarketSplit.basis,
    searchInterest,
    bestMatchTruth: (candidates.find((c) => c.matchTruth)?.matchTruth ?? null) as RadarMatchTruth | null,
  });
  const radarNotes = [
    recommendation?.estimatedMarginPercent != null ? `예상 마진 ${recommendation.estimatedMarginPercent}%` : null,
    domesticCompetition.lowestPriceKrw != null ? `국내 최저가 ₩${domesticCompetition.lowestPriceKrw.toLocaleString()}` : null,
  ].filter((v): v is string => v != null);
  const domesticShopHistory = data.priceHistory?.domesticShop ?? null;
  const trend7d = domesticShopHistory?.trend7d ?? null;
  const trend30d = domesticShopHistory?.trend30d ?? null;
  const historyRecords = domesticShopHistory?.records ?? [];
  const originChangeRatePercent = data.priceHistory?.origin?.change?.changeRatePercent ?? null;
  /** 원가 근거가 된 관측 1건. 서버가 checked_at desc로 정렬해 돌려주고,
   * market-intelligence.ts도 이 행 하나에서 costPriceKrw/costBasis를 읽는다. */
  const originObservation = data.priceHistory?.origin?.records?.[0] ?? null;
  const originLatestCheckedAt = originObservation?.checkedAt ?? null;
  /**
   * UX 2.4.1 — 그 관측이 통화 그대로 들고 있는 값. 새 계산은 없고 저장된 세 칸을
   * 고를 뿐이다.
   *
   * STATIC_SNAPSHOT(관측이 없거나 품절이라 스냅샷 가격으로 폴백한 경우)에는
   * 쓰지 않는다 — 그때 cost는 이 관측이 아니라 스냅샷 가격으로 계산됐으므로,
   * 이 행의 금액을 사슬 첫 줄에 세우면 아래 원화 환산(cost.costKrw)과 짝이
   * 맞지 않는 두 숫자가 한 사슬에 서게 된다.
   */
  const observedOriginPrice =
    costSource !== "STATIC_SNAPSHOT" && originObservation?.priceAmount != null && originObservation.currency
      ? {
          amount: originObservation.priceAmount,
          currency: originObservation.currency,
          exchangeRate: originObservation.exchangeRate ?? null,
        }
      : null;

  const hasAnyData =
    domesticCompetition.tier !== "NONE" || currentPrice.sellingPriceKrw != null || cost != null;

  /**
   * MI-FLOW-2(CEO 지시, 2026-09-11) — 헤드라인 "핵심 숫자" 네 칸.
   * 새 계산 없음 — cost / domesticCompetition / recommendation / decision을
   * 고르고 기준 라벨만 붙인다(mi-headline.ts). 특히 원본 판매가격과 한국 시장
   * 가격을 "≈"로 잇지 않는 것이 이 블록의 핵심이다: 둘은 같은 가격의 다른
   * 표기가 아니라 서로 다른 시장의 서로 다른 사실이다.
   */
  const headlineNumbers = buildHeadlineNumbers({
    originPrice: cost ? { amount: cost.originalAmount, currency: cost.originalCurrency } : null,
    targetMarketAveragePriceKrw: domesticCompetition.averagePriceKrw,
    targetMarketLowestPriceKrw: domesticCompetition.lowestPriceKrw,
    targetMarketBasis: domesticMarketSplit.basis,
    targetMarketUnresolved: domesticCompetition.priceMarketBasis === "UNRESOLVED",
    landedCostKrw: cost?.landedCostKrw ?? null,
    recommendedMarginPercent: recommendation?.estimatedMarginPercent ?? null,
    currentMarginPercent: decision?.marginPercent ?? null,
  });

  /**
   * 국내 비교상품 판매처별 관측 한 줄씩. 여기서 시장으로 가르지 않는다 —
   * 이 목록의 출처는 DOMESTIC_SHOP/NAVER_SHOPPING, 즉 **국내 편집샵** 관측이고
   * 그 소스는 market_code를 저장하지 않아 전부 null이다. UX 2.3까지는 이 목록을
   * splitByTargetMarket에 넣어서, null을 "한국이 아님"으로 분류한 결과 국내
   * 편집샵들이 "🌎 해외 시장 참고"라는 제목 아래 서 있었다(UX 2.4에서 고침).
   * 판매처가 실제로 여러 시장에 낸 가격은 아래 globalMarketCard가 따로 본다.
   */
  const domesticSellerRows = (domesticCompetition.sellers ?? []).flatMap((seller) =>
    seller.markets.map((market) => ({
      sellerKey: seller.sellerKey,
      sellerLabel: seller.sellerLabel,
      marketCode: market.marketCode,
      price: market,
    })),
  );

  /**
   * UX 2.3(CEO 지시, 2026-09-11) — 수익성 사슬과 시장 맥락, 두 축.
   *
   * 새 계산 없음 — cost / currentPrice / unifiedDecision / recommendation /
   * domesticCompetition을 고르기만 한다(price-hierarchy.ts). 두 함수가 서로의
   * 입력을 받지 않는 것이 이번 지시의 핵심이다: 국내 비교상품이 0건이어도
   * 사슬은 전부 계산된 채로 남고, 무너지는 것은 가격 경쟁력 하나뿐이다.
   */
  const priceChain = buildPriceChain({
    originPrice: cost ? { amount: cost.originalAmount, currency: cost.originalCurrency } : null,
    // UX 2.4.1 — 사슬의 첫 줄을 원본 통화로 되돌린다. cost.originalAmount는
    // 실측 관측이 있으면 이미 원화로 접혀 있어서 "원본 판매가격 ₩99,928"이 됐다.
    observedOriginPrice,
    // 언제 확인된 가격인지까지 한 문장에 남긴다(예전 현재 구매가 칸(💰)이
    // 들고 있던 정보 그대로 — 칸을 없애면서 사실을 잃지 않게 옮겼다).
    originPriceBasis: costSource
      ? `${COST_SOURCE_LABEL[costSource]}${
          costSource !== "STATIC_SNAPSHOT" && originLatestCheckedAt
            ? ` · ${relativeTimeFromNow(originLatestCheckedAt)}`
            : ""
        }`
      : null,
    // 원가 기준이 "원본 판매자의 한국 표시가"면 그건 환율 환산값이 아니다 —
    // 라벨 자체가 달라야 한다(run-price-check.ts의 KR_MARKET 승격).
    costBasisIsKrMarket: currentPrice.costBasis === "KR_MARKET",
    sourcePriceKrw: cost?.costKrw ?? null,
    exchangeRate: fx?.rate ?? null,
    exchangeRateIsEstimate: fx?.isEstimate ?? false,
    internationalShippingKrw: cost?.shippingKrw ?? null,
    landedCostKrw: cost?.landedCostKrw ?? null,
    // 추천가를 여기에 절대 넣지 않는다 — "내 판매가격"은 판매자가 정한 값만이다.
    sellerPlannedPriceKrw: currentPrice.sellingPriceKrw,
    expectedProfitKrw: unifiedDecision?.estimatedProfitKrw.value ?? null,
    platformFeeKrw: unifiedDecision?.platformFeeKrw.value ?? null,
    costIncomplete: unifiedDecision?.dataCompleteness === "INCOMPLETE",
    // 판매가가 있으면 그 기준 마진, 없으면 추천가 기준 마진 — 어느 쪽인지는
    // marginBasis가 라벨 옆에 밝힌다(같은 "예상 마진"이 두 사실이 되지 않게).
    marginPercent: unifiedDecision?.marginPercent.value ?? recommendation?.estimatedMarginPercent ?? null,
    marginBasis:
      unifiedDecision?.marginPercent.value != null
        ? "PLANNED"
        : recommendation?.estimatedMarginPercent != null
          ? "RECOMMENDED"
          : null,
  });
  const marketContext = buildMarketContext({
    domesticBasis: domesticMarketSplit.basis,
    domesticAveragePriceKrw: domesticCompetition.averagePriceKrw,
    domesticLowestPriceKrw: domesticCompetition.lowestPriceKrw,
    domesticSellerCount: domesticCompetition.sellerCount,
    domesticUnresolved: domesticCompetition.priceMarketBasis === "UNRESOLVED",
  });

  /**
   * UX 2.4(CEO 지시, 2026-09-11) — B 그룹: 판매자가 시장마다 직접 파는 가격.
   *
   * 새 계산 없음 — 서버가 market_code별 최신 1건으로 이미 접어서 보낸 관측을
   * 문장으로만 옮긴다(global-market.ts). 국내 비교상품은 입력으로 넘기지
   * 않는다(넘길 수 있는 인자 자체가 없다) — 그게 "판매자 한국 가격"과
   * "국내 비교상품"이 같은 목록에 설 수 없게 하는 장치다.
   */
  const globalMarketCard = buildGlobalMarketCard({
    observations: data.sellerGlobalMarkets ?? [],
  });

  /**
   * MI/PRICE-2(CEO 지시, 2026-09-12) — ②에서 관측된 한국 줄을 ①로 넘긴다.
   *
   * 여기서 관측을 다시 고르지 않는다. 카드가 이미 만든 줄을 그대로 집고
   * (pickJudgingMarketRow: 판단 시장 관측이 정확히 하나일 때만), 그 줄이 들고
   * 있는 문자열을 넘긴다 — ①의 ₩162,000과 ②의 ₩162,000이 같은 코드에서 나온
   * 같은 사실이어야 한쪽만 고쳐지는 날이 오지 않는다.
   */
  const judgingMarketRow = pickJudgingMarketRow(globalMarketCard);

  /**
   * UX 2.4.1(CEO 지시, 2026-09-11) — ① 원본 상품 가격.
   *
   * 사슬과 **같은 입력**을 받는다(observedOriginPrice / cost / fx). 그래야 ①의
   * £55와 ④ 첫 줄의 £55가 갈라질 수 없다 — 사본이 아니라 같은 사실의 두 표시다.
   * 사슬이 답할 수 없는 경우(원가 기준이 한국 표시가라 응답에 원본 통화가 없는
   * 상품)에만 스냅샷 원본가를 쓴다.
   */
  const originalPrice = buildOriginalPriceHeadline({
    observedOriginPrice,
    originPrice: cost ? { amount: cost.originalAmount, currency: cost.originalCurrency } : null,
    sourcePriceKrw: cost?.costKrw ?? null,
    exchangeRate: fx?.rate ?? null,
    exchangeRateIsEstimate: fx?.isEstimate ?? false,
    originPriceBasis: costSource
      ? `${COST_SOURCE_LABEL[costSource]}${
          costSource !== "STATIC_SNAPSHOT" && originLatestCheckedAt
            ? ` · ${relativeTimeFromNow(originLatestCheckedAt)}`
            : ""
        }`
      : null,
    costBasisIsKrMarket: currentPrice.costBasis === "KR_MARKET",
    snapshotOriginPrice,
    // ②의 🇰🇷 줄 그대로. 그 값은 판매자 자신의 한국 페이지에서 직접 읽은 값이라
    // 원본 상품의 사실에 속한다(MI/PRICE-2). 금액을 여기서 다시 만들지 않는다.
    krMarketObservation: judgingMarketRow
      ? { price: judgingMarketRow.observedPrice, marketCode: judgingMarketRow.code }
      : null,
  });

  /**
   * UX 2.4.1 — ② 한국 시장 경쟁가격. 화면에서 비교가 일어나는 **유일한** 자리다.
   *
   * 두 builder의 결과만 받는다. buildGlobalMarketCard는 국내 비교상품을 입력으로
   * 받을 수 없고 buildMarketContext는 시장 코드를 인자로조차 받지 않는다 — 그
   * 분리를 그대로 두고, 나란히 놓는 일만 여기서 한다(차액·평균 계산 없음).
   */
  const marketComparison = buildMarketComparison(globalMarketCard, marketContext);

  /**
   * MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — ③ 수익성의 판정 배지.
   *
   * 판정을 여기서 내리지 않는다. 서버가 이미 낸 marketCase(computePriceRecommendation
   * 의 CASE A/B/C/D)를 셀러 어휘로 바꾸기만 한다 — 비교도 하한선도 반올림도 없다.
   * 추천 자체가 아직 없는 상품(marketCase가 null)은 "근거가 부족하다"와 같은
   * 자리에 선다: 없는 판정을 지어내지 않는다.
   */
  const profitVerdict = miMarketCaseVerdict(recommendation?.marketCase ?? null);

  /**
   * MI-POLISH-2(CEO 지시, 2026-09-12) — 판정이 가리키는 **단 하나의** 행동.
   *
   * IIFE 안에 있던 것을 끌어올린다. 카드 맨 아래에서 「왜 이렇게 판단했나요?」와
   * 한 줄에 서야 하는데, 즉석 함수가 그 줄 안에 있으면 무엇이 본문 블록이고
   * 무엇이 바닥 행동인지 화면 구조가 말해주지 못한다. 값도 대상도 그대로다
   * (기존 onRequestPriceReview 하나로만 연결된다 — 새 엔드포인트 없음).
   */
  const verdictCta = REPRESENTATIVE_VERDICT_CTA[representativeVerdict.code];

  /** UX-1D — "가격 전략" 요약에 쓸 대표 국내 가격. 새로 계산하지 않는다.
   * 서버가 이미 낸 domesticMarketSplit의 평균가를 우선순위대로 고르기만 한다:
   * ① 동일상품(EXACT) 평균 → ② 비교상품(COMPARISON) 평균 → ③ 표시 안 함.
   * 최저가는 이상치일 수 있어 대표값으로 쓰지 않는다(CPO 지시). */
  // MI-UX-8 — 대표 국내 가격(동일상품 평균 → 비교상품 평균)은 "가격 전략"
  // 블록에서만 쓰던 표시용 값이라 함께 제거했다. domesticMarketSplit 자체는
  // 서버 계산 그대로 남아 있고 가격 판단에는 영향이 없다.

  /**
   * UX 2.2(CEO 지시, 2026-09-11) — ③④에서의 MI.
   *
   * "🟡 조건부 판매 · 국내 비교상품 ₩116,600 · 착지원가 ₩111,928 ·
   *  예상 마진 22.4% · [가격 판단 상세보기]"
   *
   * 여기서 어떤 숫자도 새로 만들지 않는다 — 바로 위에서 전체 화면이 쓰는 것과
   * **같은** headlineNumbers/sellerDecision을 골라 쓴다. 요약이 자기 계산을
   * 갖게 되면 접었을 때와 펼쳤을 때 다른 숫자를 말하게 되고, 그건 이 프로젝트가
   * 반복해서 겪은 "화면마다 다른 숫자" 버그와 정확히 같은 종류다.
   * 값이 없으면 지어내지 않고 빈 상태 어휘(mi-empty-state.ts)를 그대로 쓴다.
   *
   * UX 2.3(CEO 지시, 2026-09-11) — 착지원가를 요약에 넣는다. ③④에서 셀러가
   * 계속 확인하는 것은 "얼마에 사서 얼마 남는가"인데 그 앞쪽 절반(원가)이
   * 요약에 없어서, 확인하려면 매번 상세를 펼쳐야 했다. 여기는 끝까지 **요약**
   * 이다 — 사슬 전체와 시장 근거는 ②(FULL)에만 있다.
   */
  if (presentation === "SUMMARY") {
    const verdictCopy = hasAnyData ? FINAL_VERDICT_COPY[sellerDecision.finalVerdict] : null;
    return (
      <MiSummaryShell onOpenDetail={onOpenDetail}>
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {verdictCopy ? (
            <span className={`text-sm font-bold ${SELLER_FACING_VERDICT_TEXT[sellerDecision.finalVerdict]}`}>
              {verdictCopy.icon} {verdictCopy.title}
            </span>
          ) : (
            // 근거가 하나도 없는 상태 — "비추천"이 아니다. 나쁘다고 말하지 않는다.
            <span className="text-sm font-bold text-text-secondary">{miEmptyState("UNJUDGEABLE").chip}</span>
          )}
          <MiSummaryNumber number={headlineNumbers.find((n) => n.key === "targetMarketPrice")} />
          <MiSummaryNumber number={headlineNumbers.find((n) => n.key === "landedCost")} />
          <MiSummaryNumber number={headlineNumbers.find((n) => n.key === "estimatedMargin")} />
        </span>
        <span className="text-[11px] text-text-tertiary">
          {KR_TARGET_MARKET.flag} {KR_TARGET_MARKET.label} 시장 기준 판단입니다 — 이 단계에서는 결론만 보여줍니다
        </span>
      </MiSummaryShell>
    );
  }

  return (
    <CollapsibleSection title="Market Intelligence" defaultOpen>
      <div className="space-y-2 text-xs">
        {/* UX 2.2 — 요약에서 [판단 상세보기]로 펼친 경우에만 되돌아갈 길을 둔다.
            ②가 현재 단계일 때는 이 버튼이 없다 — 그때 MI는 접을 수 있는 곁가지가
            아니라 그 단계에서 해야 할 일 자체다. */}
        {onCloseDetail && (
          <button
            type="button"
            onClick={onCloseDetail}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-background"
          >
            ▴ 판단 요약으로 접기
          </button>
        )}
        {/* MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 여기 있던 분석 기준 시장
            배너(테두리 두른 두 줄: "분석 기준 시장 🇰🇷 대한민국" + "판매 판단은
            한국 시장을 기준으로 합니다")를 「왜 이렇게 판단했나요?」 안으로
            내렸다. 같은 사실을 바로 아래 판정 카드의 첫 줄이 이미 말하고 있어서
            (🇰🇷 대한민국 시장 기준), 화면이 열리자마자 같은 문장을 두 번 읽게
            된다. 판단의 **기준**은 판단 숫자가 아니라 그 숫자의 근거다. */}

        {/* MI-FLOW-2 — 빈 상태를 세 가지로 구분한다. 여기는 그중 "판단 불가":
            가격 근거가 하나도 없어서 아직 아무 말도 할 수 없는 상태다.
            "비추천"이 아니다 — 나쁘다고 말하지 않는다. */}
        {!hasAnyData && (
          <div
            id={MARKET_VERDICT_ANCHOR_ID}
            className="scroll-mt-4 rounded-md border border-border bg-background p-3"
          >
            <p className="text-[11px] text-text-tertiary">
              {KR_TARGET_MARKET.flag} {KR_TARGET_MARKET.label} 시장 기준
            </p>
            <p className="mt-1 text-base font-semibold text-text-secondary">
              {miEmptyState("UNJUDGEABLE").chip}
            </p>
            <p className="mt-1 text-[11px] text-text-secondary">
              아직 확인된 가격이 없습니다 — 원본 사이트와 등록된 국내 편집샵에서 가격을 조회하면 판단을 시작합니다
              (몇 초 걸릴 수 있습니다).
            </p>
          </div>
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
          <div
            id={MARKET_VERDICT_ANCHOR_ID}
            className={`scroll-mt-4 rounded-md border p-3 ${SELLER_FACING_VERDICT_STYLE[sellerDecision.finalVerdict]}`}
          >
            {/* MI-FLOW-2(CEO 지시, 2026-09-11) — 이 카드 하나가 3초 안에 세 가지에
                답해야 한다: ① 팔 만한가(판정) ② 왜 그런가(핵심 숫자·판단 근거)
                ③ 다음에 뭘 하나(행동 한 줄 + CTA). 그 순서대로만 쌓고, 나머지는
                전부 "왜 이렇게 판단했나요?" 하나로 접는다 — 기존에는 같은 판정이
                이 카드와 "📊 국내 시장 신호" 카드에 두 번 떠 있었고, 근거는
                국내 가격 목록·기회·레이더 사이에 흩어져 있었다. 지운 정보는
                없다(전부 아래 상세로 내려갔다). 판정/계산은 서버 값 그대로다. */}
            {/* P-19-B Sprint 8(CPO 지시, 2026-09-02) — 헤드라인 아이콘/타이틀/박스
                색은 3단계(sellerFacingVerdict)만 쓴다. 내부 5단계 코드/용어는
                화면 어디에도 노출하지 않는다 — 아래 설명 문장(description)만
                기존 representativeVerdict 값을 그대로 재사용한다.
                P-31 — 헤드라인은 sellerDecision.finalVerdict 하나만 본다.
                finalVerdict는 sellerFacingVerdict를 시장 신호로 강등만 한
                값이므로(승격 없음) 두 값이 서로 다른 결론을 낼 수 없다 —
                화면에 상반된 판정이 둘 뜨는 것을 구조로 막는다. */}
            <p className="text-[11px] opacity-70">
              {KR_TARGET_MARKET.flag} {KR_TARGET_MARKET.label} 시장 기준
            </p>
            <p className="mt-0.5 text-lg font-bold">
              {FINAL_VERDICT_COPY[sellerDecision.finalVerdict].icon} {FINAL_VERDICT_COPY[sellerDecision.finalVerdict].title}
            </p>
            {/* MI-POLISH-2(CEO 지시, 2026-09-12) — 판정 아래는 곧바로 ①이다.
                여기 있던 축 세 줄(MiVerdictAxes)을 뺀다. 그 세 줄은 "얼마에 팔
                만한가"의 답이 아니라 **그 답의 근거**이고, 같은 네 축이 아래
                「왜 이렇게 판단했나요?」 안에 사유까지 달고 이미 서 있었다 —
                본문에 남겨 두면 같은 축이 한 화면에 두 벌이 되고, 첫 화면은
                판정 하나를 말하려고 네 줄을 쓴다. 정보 이동이지 삭제가 아니다
                (MiAxisStars가 네 축 전부를 상세에서 그대로 보여준다).

                MI-TEXT-1에서 이 자리로 올라왔던 representativeVerdict.description
                두 문장은 그때 그대로 상세의 첫 줄에 있다. */}

            {/* 가격 계층 ①~④ — UX 2.3(CEO 지시, 2026-09-11).
                여기 있던 "핵심 숫자" 4칸 표(원본 판매가격 / 한국 시장 가격 /
                착지원가 / 예상 마진)를 걷어낸다. 네 숫자가 같은 크기·같은 모양의
                칸에 나란히 있어서, 서로 무슨 관계인지(무엇을 더하면 무엇이 되고
                무엇에서 무엇을 빼면 무엇이 남는지)가 화면에서 전혀 읽히지 않았다.
                게다가 그중 둘("한국 시장 가격"과 원본 판매자의 한국 표시가)이
                같은 이름을 쓰고 있었다.

                대신 수익성 사슬(원본가격 → 환산 → 국제배송 → 착지원가 → 내
                판매가 → 예상 수익·마진)과 시장 맥락을 서로 독립된 축으로 둔다 —
                한쪽이 비어도 다른 쪽은 그대로 계산된 채 남는다. "국내 비교 불가"가
                "수익성 계산 불가"로 읽히던 것이 그 지시가 고치라고 한 화면이다.

                UX 2.4(CEO 지시, 2026-09-11) — 그 두 축을 **네 그룹**으로 펴고
                읽는 순서를 화면 순서로 못박는다.

                UX 2.4.1(CEO 지시, 2026-09-11) — 그 순서를 한 칸 더 민다:
                판단 → ① 원본 → ② 글로벌 시장 → ③ 한국 경쟁 → ④ 수익성 → ⑤ 근거.

                UX 2.4에서는 ④(수익성 사슬)가 맨 앞이었고, 사슬의 첫 줄이 실측
                관측 때문에 원화로 접혀 있어서 화면이 "원본 판매자 한국 표시가
                ₩104,600"으로 열렸다. 셀러가 URL을 붙여넣고 묻는 첫 질문은
                "이 상품이 원래 얼마지?"인데, 답이 원화로 나오니 되돌아오는
                질문이 "원본가격이 왜 한국 돈이지?"였다.

                그래서 ①을 따로 세워 원본 통화로 먼저 답하고, 수익성(얼마 남나)은
                시장을 다 본 다음에 온다 — "얼마인가"와 "얼마 남는가"는 다른
                질문이고, 뒤엣것은 앞엣것 없이는 읽히지 않는다.

                MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 그 사이에 있던 두 블록 중
                하나가 본문에서 내려간다. 남는 순서는 셋이다:
                판단 → ① 원본 → ② 한국 경쟁 → ③ 수익성 → ④ 근거.

                판매자 글로벌 시장(옛 ②)은 매입처를 고를 때의 사실이지 "팔
                만한가"의 답이 아니다. 카드로 서 있는 동안 그 값은 판단에 필요한
                숫자와 같은 무게로 읽혔고, 그렇게 본문이 한 줄씩 길어지면서 MI는
                판단 화면이 아니라 가격 계산 설명 화면이 되어갔다. 사실은 그대로
                두고 층만 내린다 — ① 아래 ⓘ 한 줄, 펼치면 시장별 원자료.

                한국 경쟁(옛 ③, 이제 ②)은 비교할 국내 상품이 없으면 블록 자체가
                없다. 빈 칸 두 개짜리 카드는 정보가 아니라 질문이기 때문이다.

                MI-POLISH-2(CEO 지시, 2026-09-12) — 본문에 남는 것은 이 셋이
                전부다. ④ 판단 근거가 「왜 이렇게 판단했나요?」 안으로 내려가면서
                본문의 읽는 순서는 판정 → ① → ② → ③에서 끝난다. 번호를 다시
                매기지 않는 이유는 ④가 사라진 것이 아니라 층이 바뀐 것이기
                때문이다 — 제목의 번호는 여전히 "몇 번째로 읽는가"를 말한다.

                숫자는 전부 서버 값 그대로다(새 계산 없음). */}
            <div className="mt-2.5 space-y-2">
              {/* ① 원본 상품 — 원본 통화가 먼저고, 원화는 그 아래 환산이다.
                  이 블록에는 한국에서 관측된 어떤 값도 들어오지 않는다.

                  MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 판매자 글로벌 시장이 이
                  블록 **아래 한 줄**로 붙는다. 그 값들은 같은 판매처가 시장마다
                  받는 값이라 원본 상품의 사실에 속하지만, 판단("팔 만한가")의
                  답은 아니다 — 그래서 카드가 아니라 ⓘ 한 줄이고, 시장별 원자료는
                  펼쳤을 때만 나온다. 두 builder의 분리는 그대로다(글로벌 카드는
                  국내 비교상품을 입력으로 받을 수 없다). */}
              <div>
                <OriginalPriceView headline={originalPrice} />
                <div className="mt-1">
                  <GlobalMarketHint
                    card={globalMarketCard}
                    summaryLine={globalMarketSummaryLine(globalMarketCard)}
                    open={showGlobalMarketDetail}
                    onToggle={() => setShowGlobalMarketDetail((v) => !v)}
                  />
                </div>
              </div>

              {/* ② 한국 시장 경쟁가격 — 화면에서 비교가 일어나는 유일한 자리.
                  ①의 🇰🇷 줄(이 판매처가 한국에서 받는 값)과 국내 비교상품(다른
                  한국 판매자들이 받는 값)을 나란히 놓는다. 두 값은 끝까지 서로
                  다른 builder가 만들고, 여기서는 결과만 짝짓는다.

                  MI-SIMPLIFY-1 — 비교할 국내 상품이 없으면 블록 자체가 없다
                  (빈 칸으로 남기지 않는다). 빈 칸은 정보가 아니라 질문이라,
                  셀러는 조회가 고장났는지 자기가 뭘 안 했는지를 스스로 추론해야
                  했다. 그 사실은 사라지지 않고 "왜 이렇게 판단했나요?" 안에서
                  판정의 일부로 말한다(NO_DOMESTIC_COMPARABLE_NOTE). 무엇이
                  "비교상품이 있다"인지는 화면이 아니라 buildMarketComparison이
                  정한다 — 여기서 다시 세면 블록은 숨겼는데 판정은 비교한 것으로
                  나오는 날이 온다.

                  MI-POLISH-2(CEO 지시, 2026-09-12) — 그 게이트가 여기 있던
                  `{...hasComparable && (…)}`에서 **뷰 안**으로 들어갔다. 조건이
                  호출부에 있으면 이 뷰를 한 번 더 쓰는 사람이 게이트를 빠뜨릴
                  수 있고, 무엇보다 "빈 카드가 아니라 카드 없음"을 렌더 결과로
                  증명할 수가 없다. 이제 렌더가 빈 문자열이라는 것을 테스트가
                  직접 확인한다(mi-polish.test.ts). */}
              <MarketComparisonView
                comparison={marketComparison}
                context={marketContext}
                stockNote={
                  /* MI-STOCK-CLARITY-1(CPO 지시, 2026-09-10) — 국내 비교상품
                     가격이 어떤 재고 상태 위에 서 있는지. UX 2.4.1에서 이 문장을
                     그 가격 옆으로 옮겼다(전에는 카드 밑단에 혼자 있어서 어느
                     숫자에 대한 단서인지 읽히지 않았다). 집계 방식은 그대로다. */
                  (domesticCompetition.stockCounts?.unknown ?? 0) > 0 ? (
                    <p className="mt-0.5 text-[10px] text-text-tertiary">
                      {PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE} 가격은 재고 상태를 확인하지 못한{" "}
                      {domesticCompetition.stockCounts?.unknown}건을 포함합니다
                      {(domesticCompetition.stockCounts?.onSale ?? 0) > 0 &&
                        ` (판매중 확인 ${domesticCompetition.stockCounts?.onSale}건)`}
                      {(domesticCompetition.stockCounts?.soldOut ?? 0) > 0 &&
                        ` · 품절 ${domesticCompetition.stockCounts?.soldOut}건은 제외됨`}.
                    </p>
                  ) : null
                }
              />

              {/* ③ 수익성 — 착지원가 → 내 판매가격 → 예상 수익 → 예상 마진,
                  그리고 판정 한 줄. 네 줄이 답하는 것은 "내 원가 기준 얼마에
                  팔면 수익이 나는가" 하나다.

                  MI/PRICE-1(CEO 지시, 2026-09-12) — 여기가 "왜 143,500원인가"에
                  답하는 자리가 됐다. 예전에는 이 블록 아래 별도의 "가격 계산"
                  카드가 원가·배송비·수수료·마진·권장 판매가격을 처음부터 다시
                  말했고, 셀러 눈에는 같은 가격이 두 번 계산되는 것처럼 보였다.
                  이제 그 사슬은 아래 접힘 **하나** 안에만 있다.

                  MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 이 블록은 **판정**이지
                  계산서가 아니다. 사슬 아래 있던 dl 한 칸(추천가 + 예상 마진
                  문장 + 참고치 경고 + 추천가 없음 사유)이 조건마다 다른 문장을
                  조립하면서, 결론이어야 할 자리가 설명 문단이 되어 있었다.
                  그 네 갈래를 판정 배지 한 줄로 접는다(mi-market-case.ts).
                  숫자도 문구도 새로 만들지 않는다 — marketCase와 recommendedPrice는
                  서버 값 그대로이고, 지운 설명은 아래 "왜 이렇게 판단했나요?"에
                  그대로 있다. */}
              <div id={PRICE_CALCULATION_ANCHOR_ID} className="scroll-mt-4">
                {/* MI-POLISH-2 — "— 얼마에 사서 얼마 남는가"는 제목의 뜻풀이라
                    title로 내렸다. 세 블록의 제목이 전부 한 줄짜리 명사가 되면
                    본문은 제목 셋과 숫자 몇 개로만 읽힌다. */}
                <p
                  className="mb-1 text-[11px] font-medium text-text-tertiary"
                  title="얼마에 사서 얼마 남는가"
                >
                  {PRICE_SECTION_TITLE.PROFITABILITY}
                </p>
                <PriceChainView rows={priceChain} />

                {/* 판정 배지. CASE A/B/C/D는 여기서 **문구로만** 나온다 —
                    내부 이름이 화면에 닿는 경로가 mi-market-case.ts 한 곳뿐이라
                    "CASE B" 같은 글자가 새어 나갈 자리가 없다. A/B/C의 아이콘과
                    제목은 서버의 SELLER_FACING_COPY 그대로라, 카드 맨 위 헤드라인과
                    같은 어휘를 쓴다(판정 하나에 어휘가 두 벌이 되지 않는다). */}
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[11px]">
                  <span className="font-semibold text-text-primary">
                    {profitVerdict.icon} {profitVerdict.note}
                  </span>
                  {/* 권장 판매가는 이 판정이 가리키는 **행동**이라 배지와 한 줄에
                      선다. CASE C/D는 억지 추천가를 만들지 않으므로 이 칸 자체가
                      없다 — "추천가 없음"이라고 적던 자리이고, 왜 없는지는 바로
                      왼쪽 배지가 이미 말한다(같은 사실을 두 번 쓰지 않는다). */}
                  {recommendation?.recommendedPrice != null && (
                    <span className="text-text-secondary">
                      🏷 최종 추천 판매가 ₩{recommendation.recommendedPrice.toLocaleString()}
                    </span>
                  )}
                  {/* 추천 판정 자체가 아직 없는 상품(국내 관측 전)은 원가에서
                      역산한 제안가만 있다. 라벨이 위와 다른 이유가 그것이다 —
                      시장 경쟁력을 본 값이 아니라 내 원가에서 나온 값이라,
                      같은 이름을 쓰면 근거의 강도가 화면에서 뭉개진다. */}
                  {!recommendation && cost && (
                    <span className="text-text-secondary">
                      🏷 추천 판매가 ₩{cost.suggestedPriceKrw.toLocaleString()}
                    </span>
                  )}
                </p>

                {/* MI/PRICE-1(CEO 지시, 2026-09-12) — ③의 **유일한** 접힘.
                    제품 전체에서 상세 계산이 그려지는 자리가 여기 하나다.

                    MI-SIMPLIFY-1 — 이름 앞에 ⓘ가 붙고 "보기"가 빠졌다. 이 자리가
                    맡는 층이 바뀌었기 때문이다: 본문은 판단에 필요한 숫자, ⓘ는
                    그 숫자의 근거, 펼침은 원자료. title 속성이 그 근거를 한 줄로
                    먼저 말하므로(공식의 모양) 셀러는 펼치지 않고도 "무엇으로
                    만든 값인지"를 안다. 숫자는 적지 않는다 — 적는 순간 그 값은
                    computePriceBreakdown이 낸 값의 사본이 된다.

                    토글이 ③의 맨 아래에 있는 이유: 위 네 줄과 판정이 결론이고,
                    이건 그 결론이 어떻게 나왔는지다. 결론을 근거 아래에 두면
                    카드를 다 읽어야 답이 나온다(PHASE 3.2에서 확인한 순서). */}
                {priceCalculationDetail && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowPriceDetail((v) => !v)}
                      title={PRICE_BASIS_TOOLTIP}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      ⓘ 가격 계산 기준 {caret(showPriceDetail)}
                    </button>
                    {showPriceDetail && (
                      <div className="mt-1 rounded-md border border-current/20 bg-background/40 px-2.5 pb-2.5 pt-0.5">
                        {priceCalculationDetail}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* MI-STOCK-CLARITY-1의 재고 문장은 UX 2.4.1에서 ② 한국 시장
                경쟁가격 블록 안으로 옮겼다 — 그 문장이 설명하는 숫자가 거기
                있기 때문이다. 사본을 만들지 않았다(집계·문구 그대로 이동). */}
          </div>
        )}

        {/* ── MI-POLISH-2(CEO 지시, 2026-09-12) — 본문의 바닥 한 줄 ─────────────
            본문이 끝나는 곳에는 딱 두 가지만 선다: **되물음 하나**와
            **행동 하나**.

            되물음(「왜 이렇게 판단했나요?」)이 판정 바로 아래가 아니라 여기로
            내려온 이유는 읽는 순서다. 셀러는 판정 → ① 원본 → ② 한국 경쟁 →
            ③ 수익성을 다 읽고 나서야 "정말?"을 묻는다. 버튼이 맨 위에 있으면
            아직 묻지도 않은 질문의 답이 본문 한가운데서 펼쳐진다.

            행동은 하나다. 예전에는 이 자리에 👉 안내 문장 하나, cta.hint 설명
            한 줄, 버튼 하나가 세로로 쌓여 있었다 — 셋 다 같은 곳
            (onRequestPriceReview)으로 데려가면서 화면만 세 줄 길어졌다.
            👉 문장은 「왜 이렇게 판단했나요?」 안으로 내려가고("왜 그것을
            하는가"는 판정의 설명이다), cta.hint는 버튼의 title이 된다
            ("눌렀을 때 무슨 화면이 열리는가"는 그 버튼의 근거다).

            ── MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 판정 카드 **밖**으로 ──
            이 줄이 카드 안에 있는 동안에는, 판단할 근거가 하나도 없는 상태
            (hasAnyData === false)에서 카드째 사라졌다. 그래서 그때 화면에 남는
            유일한 행동이었던 「🔄 다시 확인」은 접힘에 넣을 수가 없었고, 결국
            본문에 상시 노출된 채로 남았다 — 첫 화면에서 지워야 할 "반복 작업
            상태"가 살아남은 경로가 정확히 이것이다. 되물음을 카드 밖으로 꺼내면
            두 상태가 같은 구조를 갖고, 접힘이 화면 전체에 하나만 남는다. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowMarketDetail((v) => !v)}
            className="text-left text-[11px] text-primary hover:underline"
          >
            {caret(showMarketDetail)} 왜 이렇게 판단했나요?
          </button>
          {onRequestPriceReview && (
            <button
              type="button"
              onClick={onRequestPriceReview}
              title={verdictCta.hint || undefined}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary-soft"
            >
              {verdictCta.label}
            </button>
          )}
        </div>

        {showMarketDetail && (
          <div className="rounded-md border border-border bg-background p-3 text-text-secondary">
            {/* MI-TEXT-1(CEO 지시, 2026-09-12) — 첫 화면에서 내려온 두 문장.
                판정을 설명하는 말이므로 상세의 **첫 줄**이어야 한다 — 근거
                목록이나 숫자 뒤에 두면 "왜 이렇게 판단했나요?"를 눌러 놓고도
                답을 찾아 스크롤해야 한다. 문구는 서버 값 그대로다. */}
            <p className="mt-1.5 text-text-secondary">{representativeVerdict.description}</p>
            {/* MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 본문에서 내려온 두 문장.
                ② 한국 시장 경쟁가격 블록이 통째로 사라졌을 때, 그 사실이 가는
                자리가 여기다. 블록을 숨기는 것과 "판단하지 않았다"를 말하지 않는
                것은 다르다 — 비교 근거가 없다는 사실은 판정의 일부라서, 빠지면
                셀러는 가격 경쟁력까지 확인된 판정으로 읽는다.
                추천가가 국내 동일상품 없이 나온 참고치라는 사실(BRAND_MEDIAN)도
                같은 이유로 남긴다: 근거의 강도는 본문의 숫자가 아니라 판정의
                근거이고, 지우면 그 값이 확정 시장가로 읽힌다. */}
            {!marketComparison.hasComparable && (
              <p className="mt-1 text-[11px] text-text-tertiary">{NO_DOMESTIC_COMPARABLE_NOTE}</p>
            )}
            {recommendation?.competitiveBasis === "BRAND_MEDIAN" && (
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                💡 국내 동일상품 가격이 확인되지 않아 참고 기준으로 산정된 값입니다
              </p>
            )}
            {sellerDecision.downgradedByMarket && (
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                가격 경쟁력은 {FINAL_VERDICT_COPY[sellerDecision.priceVerdict].title} 수준이지만, 종합 시장 신호가 불리해
                한 단계 낮췄습니다
              </p>
            )}
            {/* MI-ACTION-1 / MI-FLOW-2 — "다음에 무엇을 하면 되는가" 한 문장.
                서버가 sellingGuidance와 같은 facts로 만든 값이라 다른 숫자를
                말할 수 없다. 구버전 응답이면 렌더하지 않는다.

                MI-POLISH-2(CEO 지시, 2026-09-12) — 본문에서 내려왔다. 이 문장이
                말하는 행동은 카드 맨 아래 버튼 하나가 이미 갖고 있고(같은
                onRequestPriceReview), 추천가가 붙은 경우에는 ③이 그 숫자를 이미
                보여준다 — 본문에 상자로 서 있는 동안 같은 행동이 한 화면에 두
                번, 같은 가격이 세 번 떠 있었다. 문장은 지우지 않는다: 버튼은
                무엇을 할지만 말하고, 이 줄은 왜 그것을 하는지를 말한다. */}
            {sellingSummary && (
              <p className="mt-1 text-[11px] text-text-secondary">👉 {sellingSummary.action}</p>
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

            {/* UX-1C L2 — "왜 이 판단인가". 판정 엔진이 이미 낸 reasons를 그대로
                쓴다(문구를 새로 지어내면 판정 의미를 바꾸는 셈이라 금지).
                MI-FLOW-2 — 자체 토글을 없앴다. 같은 화면에 "왜"를 묻는 접힘이
                넷(왜 추천인가 / 왜 이렇게 판단했나요 / 왜 이런 판단인가 / 상세
                계산)이나 있어서, 셀러가 근거 하나를 보려고 몇 번을 눌러야 하는지
                알 수 없었다. 이제 바깥 토글 하나에 전부 들어간다. */}
            {representativeVerdict.reasons.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-medium text-text-tertiary">
                  왜 {FINAL_VERDICT_COPY[sellerDecision.finalVerdict].title}인가
                </p>
                <ul className="mt-1 space-y-0.5 text-text-secondary">
                  {representativeVerdict.reasons.map((reason, i) => (
                    <li key={i}>✓ {reason}</li>
                  ))}
                </ul>
              </div>
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
                  {caret(showCalcDetail)} 상세 계산
                </button>
                {showCalcDetail && (
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-current/20 bg-background/40 p-2 sm:grid-cols-3">
                    {/* UX 2.3 — 현재 구매가 칸(💰, cost.costKrw)과 착지원가 칸
                        (📦, cost.landedCostKrw)을 없앤다. 둘 다 위 가격 사슬에
                        원화 환산 / 착지원가로 이미 있고, 사슬에서는 그 사이에
                        무엇이 더해졌는지(국제배송비)까지 보인다. 언제 확인된
                        가격인지(costSource)는 사슬의 첫 줄 기준 문장이 그대로
                        들고 있다 — 정보를 지운 것이 아니라 한 곳으로 모았다. */}
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
            {/* MI 2.0 PHASE 1.3(CPO 지시, 2026-09-09) — 브랜드 시장 중앙값 블록을
                판매자 화면에서 제거했다.

                이 값은 SELLER_ORIGIN 관측(해외 원본가를 환산한 값)의 분포라
                국내 시장가가 아니다. 그런데 화면에서는 국내 가격 근처에
                놓여 있어서 "국내 시장이 이 가격대"로 읽혔다 — 판매 판단에
                도움이 되지 않으면서 오해만 만드는 숫자였다.

                brandMarketProfile / brandMedianPriceKrw 계산과 CASE D의
                referencePrice 산출은 그대로 둔다(서버 로직 무변경) — 노출만
                제거한다. BRAND_MARKET_CONFIDENCE_LABEL도 다른 곳에서 쓰지
                않으면 사용처가 없어지지만, 상수 자체는 남겨 둔다. */}
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
                {/* MI-FLOW-2(CEO 지시, 2026-09-11) — 여기부터는 원래 "📊 국내 시장
                    신호"라는 별도 카드에 있던 내용이다. 그 카드는 자기만의
                    🟢/🟡/🔴 헤드라인(sellingSummary)을 한 번 더 갖고 있어서,
                    같은 상품에 대한 판정이 한 화면에 두 개 떠 있었다 — 셀러가
                    "어느 쪽이 결론이지?"에서 멈추는 지점이 정확히 여기였다.
                    카드를 없애고 내용은 전부 이 상세 안으로 옮긴다(삭제 아님).
                    P-29 원칙은 그대로다: 시장 신호는 marketCase를 다시 계산하지
                    않고, 신호가 좋아도 위 판매 판정을 바꾸지 않는다. */}
                {sellingSummary && (
                  <div className={`mt-2 rounded border px-2.5 py-2 ${MI_SUMMARY_TONE[sellingSummary.tone].box}`}>
                    <p className={`text-xs font-semibold ${MI_SUMMARY_TONE[sellingSummary.tone].text}`}>
                      {MI_SUMMARY_TONE[sellingSummary.tone].icon} {sellingSummary.headline}
                    </p>
                    {sellingSummary.numbers && (
                      <p className="mt-1 text-sm font-semibold text-text-primary">{sellingSummary.numbers}</p>
                    )}
                  </div>
                )}
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

                {/* ④ 판단 근거 — MI 2.0 PHASE 1의 4축 레이더와, UX 2.4.1이 본문에
                    세워 뒀던 별점 목록이 여기서 하나가 된다.

                    MI-POLISH-2(CEO 지시, 2026-09-12) — 지금까지 이 둘은 서로 다른
                    층에 있었다: 별점 목록(MiAxisStars)은 본문 ④ 블록에, 레이더
                    그림은 이 상세 안에. 그런데 MiRadar는 자기 그림 아래에 같은
                    MiAxisStars를 이미 그린다 — 상세를 펼치면 같은 네 축이 한
                    화면에 두 번 떠 있었고, 접으면 판단 근거가 본문에서 카드 하나
                    분량을 차지했다. 근거는 근거의 자리에 한 벌만 둔다.

                    그림을 못 그리는 경우(등급 매겨진 축이 0개)에도 목록은 남는다 —
                    결측 축의 사유까지 들고 있는 쪽이 목록이기 때문이다. 모순 문장은
                    MiRadarSummary가 이미 그리므로 여기서 다시 쓰지 않는다(모순은
                    등급이 매겨진 축 둘 사이에서만 생겨서, 그림이 없는 상태에서는
                    radar.contradiction이 구조적으로 null이다 — packages/pricing의
                    deriveContradiction이 SCORED 축만 본다). */}
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-text-primary">
                    {PRICE_SECTION_TITLE.DECISION_EVIDENCE}
                  </p>
                  {radar.scoredCount > 0 ? (
                    <div className="rounded-md border border-border bg-surface p-3">
                      <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="min-w-[240px] flex-1 basis-[300px]">
                          <MiRadar radar={radar} />
                        </div>
                        {(radarNotes.length > 0 || radar.contradiction != null) && (
                          <div className="min-w-[200px] flex-1 basis-[240px]">
                            <MiRadarSummary radar={radar} notes={radarNotes} />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <MiAxisStars radar={radar} />
                  )}
                </div>

                {/* P-2-3 ⑤(대표님 지시, 2026-08-28) — sellerAction의 signals/reasons.
                    MI-FLOW-2 — 원래 "왜 이런 판단인가?"라는 자기 토글을 가진 별도
                    카드였다. 바로 위 "왜 이렇게 판단했나요?"와 사실상 같은 질문이라
                    셀러에게는 같은 버튼이 두 번 나온 셈이었다 — 토글만 없애고 내용은
                    그대로 이 상세 안에 둔다. */}
                {(sellerAction.signals.length > 0 || sellerAction.reasons.length > 0) && (
                  <div className={`mt-3 rounded-md border p-2.5 ${SELLER_ACTION_STYLE[sellerAction.status]}`}>
                    {sellerAction.signals.length > 0 && (
                      <ul className="space-y-1 text-text-secondary">
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
                  </div>
                )}

                {/* UX-2(CEO 지시, 2026-09-05) — "상세보기 하면 아래 탭쪽으로 이동이
                    되어 국내/해외 비교 및 결론 내용 참고할 수 있게". 판단의 원본
                    근거인 국내/해외 가격비교 섹션은 같은 탭 아래쪽에 이미 있다.
                    새 화면을 만들지 않고 기존 섹션으로 스크롤만 연결한다.
                    앵커가 없으면(탭 전환 등) 아무 일도 하지 않는다. */}
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(PRICE_COMPARISON_ANCHOR_ID)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="mt-3 w-full rounded border border-current/20 bg-background/40 px-2 py-1.5 text-[11px] font-medium text-primary hover:underline"
                >
                  {/* UX 2.4.1 — 아래 접힘 섹션의 새 이름과 같은 말을 쓴다.
                      버튼 이름과 도착지 제목이 다르면 눌렀을 때 "여기가 맞나?"가 된다. */}
                  📊 시장 가격 비교 원본 보기 ↓
                </button>

                {/* ── MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 여기부터 다섯 덩어리 ──
                    아래 다섯은 지금까지 판정 카드 **밖**, 접힘 **밖**에 서 있었다:
                    🔄 다시 확인(+결과 문장) · 💡 기회 · 🇰🇷 국내 비교상품 ·
                    동일상품 근거 · 안내 두 문단. 하나하나는 짧지만 전부 합쳐
                    첫 화면의 절반을 차지했고, 어떤 토글에도 속하지 않아서
                    "본문을 줄였다"는 지금까지의 측정이 이 영역을 보지 못했다
                    (테스트가 판정 카드만 잘라 보고 있었다 — 그게 "테스트는
                    통과하는데 화면은 길다"의 정확한 실체다).

                    전부 근거이거나 작업 상태다: 다시 확인은 반복 작업, 기회와
                    국내 비교상품과 동일상품 근거는 판정의 근거, 안내 두 문단은
                    이 판정이 보지 않는 범위의 설명. 지운 것은 하나도 없고
                    층만 내렸다 — 이 파일이 계속 지켜온 규칙 그대로다. */}

                {/* 가격 재조회 — "다시 확인"은 판단을 갱신하는 행동이라 판단의
                    근거와 같은 층에 둔다. MI-UI-1 — 아이콘이 "다시"를 말하므로
                    "가격"까지 반복하지 않는다. 진행 중 문구는 그대로 둔다. */}
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={onRecheck}
                    disabled={rechecking}
                    className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface disabled:opacity-50"
                  >
                    {rechecking ? "확인 중..." : "🔄 다시 확인"}
                  </button>
                </div>
                {recheckResult && (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {recheckResult.icon} {recheckResult.message}
                  </p>
                )}

        {/* STEP J-10 — "💡 기회"(있을 때만, computeSellerAction이 이미 계산).
            MI-FLOW-2 — 판단 바로 아래로 올렸다. 이건 근거가 아니라 행동 제안이라
            근거 목록(아래 한국 시장/해외 시장) 사이에 끼면 읽히지 않는다.
            MI-UX-FINAL-REVIEW — "행동 제안"은 판정이 이미 가리키는 행동의
            변주라, 본문에 카드로 서면 CTA 버튼과 같은 말을 두 번 한다. */}
        {sellerAction.opportunity && (
          <div className="rounded-md border border-primary/30 bg-primary-soft p-2.5 text-text-secondary">
            <p className="font-medium text-text-primary">
              {sellerAction.opportunity.icon} {sellerAction.opportunity.title}
            </p>
            <p className="mt-1">{sellerAction.opportunity.detail}</p>
          </div>
        )}

        {/* ── 여기부터는 판단의 근거다. MI-FLOW-2(CEO 지시, 2026-09-11)가 정한
            순서: 🇰🇷 한국 시장(경쟁 상품·가격·매칭 상태) → 🌎 해외 시장(시장별
            관측). 판매 판단이 한국 기준이므로 근거도 한국부터 읽혀야 하고,
            한국이 아닌 관측을 같은 층위에 두지 않는다.

            MI-UX-8(2026-09-06)에서 없앤 "💰 가격 전략" 대형 블록은 되살리지
            않는다 — 그 값들은 아래 한국 시장 블록과 판단 카드 상세에 이미 있다.
            계산과 API 응답은 그때도 지금도 그대로다(없앤 것은 반복 UI뿐). */}

        {/* STEP J-6/J-11 — "🇰🇷 한국 시장" 블록. sampleListings는 verified 링크만
            가격이 저장되므로(run-domestic-price-check.ts STEP 2) 전부 동일상품
            확정건이다 — 행마다 ✓를 붙인다("몇 곳을 뒤졌는지"가 아니라 "검증된
            가격 몇 건인지"를 보여준다, STEP J-11).
            MI-FLOW-2(CEO 지시, 2026-09-11) — 판단 다음에 오는 근거의 첫 번째는
            항상 한국 시장이다(판매 판단이 한국 기준이므로). 최저/평균가를 여기로
            내렸다 — 헤드라인은 대표값 하나("한국 시장 가격")만 말하고, 분포는
            근거를 볼 때 본다. 새 계산 없음, 표시 위치만 바뀐다. */}
        {domesticCompetition.tier !== "NONE" && (
          <div className="rounded-md border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDomesticDetail((v) => !v)}
                className="font-medium text-text-primary hover:underline"
              >
                {/* MI-UI-1 — "상세보기 … 접기"를 캐럿으로 대신한다. 곳 수와
                    "참고가격(검증 전)"은 그대로 둔다 — 앞은 숫자고 뒤는 그
                    가격을 얼마나 믿어도 되는지를 가르는 상태 표시다. */}
                {/* UX 2.3 — 블록 제목을 "한국 시장"에서 "🇰🇷 한국 시장 · 국내
                    비교상품"으로 바꾼다. 이 목록에 있는 것은 한국 편집샵이 파는
                    가격(남의 판매가)이지 이 상품의 한국 시장 가격 일반이 아니다 —
                    제목이 "한국 시장"이면 위 사슬의 원본 판매자 한국 표시가와
                    같은 것으로 읽힌다. */}
                {caret(showDomesticDetail)} {KR_TARGET_MARKET.flag} {KR_TARGET_MARKET.shortLabel} ·{" "}
                {PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE} ({domesticCompetition.sellerCount}곳
                {domesticCompetition.tier === "SECONDARY" ? " · 참고가격(검증 전)" : ""})
              </button>
              <div className="flex items-center gap-2">
                <TrendBadge label="7일" trend={trend7d} />
                <TrendBadge label="30일" trend={trend30d} />
              </div>
            </div>
            {showDomesticDetail && (
              <>
            {/* P-19-B Sprint 7/9(CPO 지시, 2026-09-02) — 이 가격들이 "🟢 동일상품
                확인" 기준인지 "🟡 비교상품"(참고용) 기준인지 밝힌다. 새 계산 없음 —
                market-intelligence.ts가 이미 우선순위로 낸 domesticMarketSplit.basis를
                문구로 옮긴다. 이 한 줄이 위 숫자를 얼마나 믿을지를 가른다. */}
            {domesticMarketSplit.basis === "EXACT" && (
              <p className="mb-1 text-[10px] text-success">🟢 동일상품 가격 기준</p>
            )}
            {domesticMarketSplit.basis === "COMPARISON" && (
              <p className="mb-1 text-[10px] text-warning">🟡 동일상품 미확인 — 국내 비교상품 시장가격(참고용) 기준</p>
            )}
            <div className="mb-1.5 grid grid-cols-2 gap-2 border-b border-border pb-1.5">
              {/* UX 2.4(CEO 지시, 2026-09-11) — 평균가 칸을 최고가로 바꾼다.
                  평균가는 위 판단 카드의 "국내 비교상품" 대표값 그 자체라, 여기
                  한 번 더 그리면 같은 숫자가 한 화면에 두 번 뜬다(이번 지시의
                  "반복 표시" 항목). 대신 지금까지 응답에 있으면서 화면 어디에도
                  없던 highestPriceKrw를 쓴다 — 대표값은 카드가, 분포의 폭은
                  여기가 말한다. 집계는 서버 그대로이고 새 계산은 없다. */}
              <SummaryStat
                label={`${PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE} 최저가`}
                value={domesticCompetition.lowestPriceKrw}
              />
              <SummaryStat
                label={`${PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE} 최고가`}
                value={domesticCompetition.highestPriceKrw}
              />
            </div>
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
            {/* GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — 한 판매처가 여러 시장에
                동시에 있을 때(실측: Bobo Choses는 /en-kr ₩162,000 · /en-de €75 ·
                /en-int €84) 판매처를 먼저, 시장을 그 아래 둔다. 위 리스팅 목록은
                판단 시장(priceMarketCode) 하나의 가격만 보여주므로, 나머지 시장
                가격이 없어진 것처럼 보이지 않게 여기 그대로 남긴다. 시장 정보가
                없는 기존 데이터(market_code 전부 null)에서는 보탤 정보가 없으므로
                이 블록 자체가 나타나지 않는다 — 화면이 예전과 같다. */}
            {domesticSellerRows.length > 0 && (
              <div className="mt-1.5 border-t border-border pt-1.5">
                {/* UX 2.4 — 이 목록을 시장으로 미리 가르지 않는다. DOMESTIC_SHOP은
                    market_code를 저장하지 않아 전부 "시장 미확인"인데, 예전에는
                    그 null 때문에 이 판매처들이 판단 카드의 "🌎 해외 시장 참고"
                    블록으로 넘어가 있었다 — 국내 편집샵이 해외 시장으로 불리던
                    자리다. 행은 하나도 잃지 않고 맞는 제목 아래로 되돌린다. */}
                <p className="mb-1 text-[10px] text-text-tertiary">
                  판매처별 관측 가격 · 시장끼리 합산하지 않습니다
                </p>
                <ul className="space-y-0.5">
                  {domesticSellerRows.map((row) => (
                    <MarketPriceRow
                      key={`${row.sellerKey}-${row.marketCode ?? "unknown"}`}
                      sellerLabel={row.sellerLabel}
                      price={row.price}
                      isJudgingMarket={(domesticCompetition.priceMarketCode ?? null) === row.marketCode}
                      judgingBasis={domesticCompetition.priceMarketBasis ?? null}
                      // 여기는 이미 펼친 근거 영역이다 — 판매자 신고 국가를
                      // 보여줄 수 있는 유일한 자리(기본 화면에는 절대 없다).
                      showDeclaredCountry
                    />
                  ))}
                </ul>
                {/* 시장이 둘 이상인데 무엇이 이 분석의 시장인지 확정하지 못한
                    경우. 아무 시장이나 골라 최저가라고 말하지 않는다. */}
                {domesticCompetition.priceMarketBasis === "UNRESOLVED" && (
                  <p className="mt-1 rounded-md bg-warning-soft px-2 py-1 text-[10px] font-medium text-warning">
                    시장이 여러 개라 한국 기준 가격을 확정하지 못했습니다 — 위 최저/평균가는 비워 둡니다.
                  </p>
                )}
              </div>
            )}
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
                  {caret(showHistory)} 가격 변동 이력 ({historyRecords.length}건)
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

        {/* N-4.18-F STEP1/2/4(대표님 지시, 2026-08-25: "95%가 나왔다고 단순히 배지만
            보여주지 말고 왜 같은 상품인지 근거를 보여줘야 한다") — 서버의 기존
            matchReasons를 그대로 체크리스트로 옮긴다(새 판정 로직 없음). EXACT는
            가격비교에 이미 반영됨을, HIGH_CONFIDENCE는 확인 버튼을, REVIEW_REQUIRED는
            미반영 문구를 보여준다 — 확정 가격(위)과는 별도 블록으로 명확히 구분한다. */}
        {/* MI-UX-9(CPO 지시, 2026-09-07 §9) — 이 블록을 기본 숨김으로 바꾼다.
            셀러가 기본 화면에서 필요한 것은 "동일상품 / 가격 / 판매처"이지 매칭
            알고리즘의 상세 근거가 아니다. 근거 데이터(matchReasons/신호 누락 표시/
            "동일상품으로 확인" 버튼)는 하나도 지우지 않고 펼침 영역으로만 옮긴다 —
            위 "왜 이런 판단인가?"와 같은 토글 패턴을 그대로 쓴다. */}
        {candidates.length > 0 && (
          <div className="rounded-md border border-dashed border-border bg-background p-2">
            <button
              type="button"
              onClick={() => setShowMatchEvidence((v) => !v)}
              className="font-medium text-text-primary hover:underline"
            >
              {/* MI-UI-1(CEO 지시, 2026-09-11) — 블록은 유지하되(근거를 아예 못
                  보게 하지 않는다) 라벨만 줄인다. 접힌 줄에서 셀러가 알아야
                  하는 건 "여기에 근거가 몇 건 있다"이고, 건수는 그대로 남긴다. */}
              {caret(showMatchEvidence)} 동일상품 근거 ({candidates.length}건)
            </button>
            {showMatchEvidence && (
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
                        onClick={() => onConfirmSameProduct?.(c.id)}
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
            )}
          </div>
        )}

        {/* UX 2.4(CEO 지시, 2026-09-11) — "🌎 해외 시장 참고 N개" 블록은 이제
            없다. 그 블록이 실제로 들고 있던 것은 해외 시장이 아니라 market_code가
            비어 있는 **국내 편집샵** 관측이었고(DOMESTIC_SHOP은 market_code를
            저장하지 않는다), 그래서 국내 비교상품 판매처들이 "해외 시장"이라는
            이름 아래 서 있었다. 그 행들은 바로 위 "🇰🇷 국내 비교상품" 블록의
            판매처별 목록으로 되돌렸고, 판매자가 시장마다 실제로 낸 가격은 판단
            카드 안의 "🌎 판매자 글로벌 시장 가격"(SELLER_ORIGIN 관측)이 맡는다. */}

        {/* MI-FLOW-2(CEO 지시, 2026-09-11) — 무엇을 기준으로 한 판단인지.
            MI-UX-FINAL-REVIEW — 본문 맨 위에서 여기로 내려왔다. 판정 카드가
            이미 첫 줄에서 "🇰🇷 대한민국 시장 기준"이라고 말하므로 본문에서는
            같은 문장이 두 번이었고, 판단의 **기준**은 판단 숫자가 아니라 그
            숫자의 근거라 아래 두 안내 문단과 같은 자리에 선다. */}
        <div className="mt-3">
          <TargetMarketBanner />
        </div>

        {/* Beta RC(CPO 지시, 2026-09-05) — "판매 추천/조건부/비추천"이라는 표현이
            상표권·지식재산권·브랜드 판매 권한까지 검토된 결과로 오해될 수 있다.
            현재 판정이 실제로 보는 범위와 보지 않는 범위를 명시한다.
            MI-UX-FINAL-REVIEW — 이 두 문단은 첫 화면에 항상 떠 있었다. 사실은
            그대로 남기되(지우면 판정이 검토한 범위를 과장하게 된다) 판단의
            근거와 같은 자리로 내린다 — 셀러가 "정말?"을 묻는 순간 함께 읽힌다. */}
        <p className="mt-2 text-[10px] text-text-tertiary">
          현재 판매 판단은 가격 경쟁력, 경쟁 환경, 예상 수익성 및 KC·규제 정보를 기반으로 합니다. 상표권,
          지식재산권, 정품 여부 및 브랜드 판매 권한은 별도 확인이 필요합니다.
        </p>

        <p className="mt-1 text-[10px] text-text-tertiary">
          참고용 판단입니다 — 판매가는 자동으로 변경되지 않으며, 최종 결정은 직접 내려야 합니다. 가격경쟁력은
          등록 가능 여부와 무관합니다 — 마진이 낮거나 가격이 높아도 등록 자체는 막히지 않습니다.
        </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
