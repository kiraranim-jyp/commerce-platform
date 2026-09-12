import { formatKrwAmount, formatOriginAmount } from "./mi-headline";
import { miEmptyState, type MiEmptyState } from "./mi-empty-state";
import type { MatchDisplayTier } from "./match-display";
// 제목은 가격 계층 표 한 곳에서만 나온다 — 이 파일이 자기 제목을 따로 들고
// 있으면 본문의 읽는 순서를 두 파일이 각각 주장하게 된다(global-market.ts와 같은 규칙).
import { PRICE_SECTION_TITLE, type MarketContext } from "./price-hierarchy";

/**
 * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — 판정은 강해졌는데 **시장 근거가
 * 약해졌다**.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 네 번의 단순화를 거치며 국내/해외 가격은 MI 밖(② 단계의 베타 패널 두 개)으로
 * 내려갔다. 그 결과 판정 카드에 남은 것은 원본 €50과 수익성 숫자 셋뿐이고,
 * 셀러가 묻는 순서의 가운데 두 칸이 비었다:
 *
 *   원본 €50 → 🇰🇷 한국에서 얼마에 팔리나? → 🌎 해외에서는? → 💰 얼마에 팔면 되나?
 *
 * 가운데가 비면 마지막 칸(판정)은 근거 없이 내려온 숫자로 읽힌다 — "AI가 임의로
 * 정했다"는 반응의 원인은 판정 문구가 아니라 **그 앞 두 칸의 부재**였다.
 *
 * ── 이 파일이 만드는 것 ──────────────────────────────────────────────────
 * 본문에 다시 세울 **요약 두 개**다. 예전의 전체 표가 아니다:
 *
 *   🇰🇷 국내 시장   대표 가격 · 근거의 두께와 등급 · ▸ 국내 가격 보기
 *   🌎 해외 시장   가격대     · 근거의 두께와 등급 · ▸ 해외 가격 보기
 *
 * ── 두 블록은 서로 다른 질문에 답한다(절대 합치지 않는다) ─────────────────
 *   국내  한국에서 **경쟁 가능한가** — 다른 한국 판매자들의 실제 판매가
 *   해외  이 상품이 해외에서 **어떤 가격대인가** — 다른 해외 판매처들의 가격
 *
 * 그래서 이 파일에는 두 값을 한 숫자로 접는 함수가 없다. 예전 화면의 `VS` 한
 * 칸이 정확히 그 합치기였고, 합치는 순간 "내가 경쟁할 값"과 "이 상품의 시세"가
 * 한 숫자가 되어 둘 중 아무것도 답하지 못했다.
 *
 * ── 계산하지 않는다 ─────────────────────────────────────────────────────
 * 평균도 차액도 환산도 없다. 국내 대표 가격은 서버가 이미 낸 집계
 * (domesticMarketSplit.resolved)를 고른 buildMarketContext의 결과를 그대로 받고,
 * 해외 가격대는 관측된 금액 중 **가장 낮은 것과 가장 높은 것 두 개를 고른다**
 * (둘 다 실제로 관측된 값이다 — 그 사이의 어떤 숫자도 만들지 않는다).
 *
 * ── 등급 없는 개수는 쓰지 않는다(CPO 추가 지시, 2026-09-12) ────────────────
 * "동일상품 3곳"만 적으면 셀러는 세 곳이 전부 확정된 동일상품이라고 읽는다.
 * 실제로는 1곳만 식별자로 확인되고 2곳은 추정일 수 있다 — Smallable/Bobo 오매칭이
 * 정확히 그 상태였다. 그래서 개수는 **언제나 등급과 함께** 나가고, 등급이 섞이면
 * 하나로 접지 않고 섞였다는 사실을 그대로 보여준다(tierCountsText).
 *
 * 매칭 판정 자체는 손대지 않는다. deriveMatchTruth/compareModelCode/P-10-F가 낸
 * 등급을 **그대로 세기만** 한다 — 숫자를 좋아 보이게 만들려고 등급을 올리는 일은
 * 이 파일이 없애려는 문제 그 자체다(Matching 2.0은 별도 과제다).
 */

/** 한 등급에 몇 곳인가. 등급을 하나로 접지 않기 위해 개수와 등급이 한 묶음이다. */
export interface MarketEvidenceTierCount {
  tier: MatchDisplayTier;
  icon: string;
  label: string;
  count: number;
}

/**
 * 본문에 서는 시장 요약 하나. 화면은 이 객체의 문자열만 쓴다 — 컴포넌트가 숫자를
 * 다시 포맷하거나 개수를 다시 세기 시작하면 요약과 드릴다운이 갈라진다.
 */
export interface MarketEvidenceSummary {
  /** "🇰🇷 국내 시장" / "🌎 해외 시장". 국기가 두 블록을 가르는 유일한 기호다. */
  title: string;
  /** 제목의 뜻풀이(title 속성). 이 블록이 답하는 질문 하나. */
  hint: string;
  /** 대표 숫자 한 줄. 없으면 null이고 그때는 절대 지어내지 않는다. */
  figure: string | null;
  /** 그 숫자가 무엇을 기준으로 한 값인지. 등급이 섞였을 때 특히 중요하다. */
  figureBasis: string | null;
  /** figure가 null인 이유. figure가 있으면 항상 null이다. */
  figureEmpty: MiEmptyState | null;
  /** 근거의 두께 — "비교상품 3곳" / "판매처 5곳 · 국가 3곳". 근거가 없으면 null. */
  scopeLabel: string | null;
  /** 등급 분포. 비어 있으면 근거가 하나도 없다는 뜻이다. */
  tiers: MarketEvidenceTierCount[];
  /**
   * 등급이 섞였을 때만 서는 한 줄. "전부 확정된 것은 아니다"를 요약만 읽고도
   * 알 수 있게 하는 자리다 — 없으면 null이고, 억지로 문장을 만들지 않는다.
   */
  mixedNote: string | null;
  /** 드릴다운 버튼에 쓰는 이름. 무엇이 열리는지를 이름이 말한다. */
  drillDownLabel: string;
  /** 근거가 한 건이라도 있는가. 화면이 다시 세지 않게 여기서 정한다. */
  hasEvidence: boolean;
}

/* ─────────────────────────── 등급 표시(공통) ─────────────────────────── */

/**
 * 화면에 쓰는 등급 이름. match-display.ts의 TIERS와 같은 어휘를 쓰되, 여기서는
 * **집계용 짧은 이름**만 필요하다(배지 note와 색은 드릴다운 표의 관심사다).
 *
 * 국내 서버 집계는 등급을 두 버킷(exact / comparison)으로만 나눈다. comparison
 * 버킷 안에는 TEXT_CONFIRMED(🟡 동일상품 추정)와 SIMILAR(⚪ 유사상품)가 함께
 * 들어 있어서(summarizeDomesticMarketSplit) 어느 쪽인지 서버 값만으로는 알 수
 * 없다 — 그래서 그 버킷은 **약한 쪽 어휘**로 부른다. 모르는 것을 강하게 부르지
 * 않는다는 이 저장소의 규칙 그대로다.
 */
const TIER_NAME: Record<MatchDisplayTier, { icon: string; label: string }> = {
  SAME: { icon: "🟢", label: "동일상품" },
  SAME_MODEL_OPTION_DIFF: { icon: "🔵", label: "동일 모델 · 옵션 다름" },
  PRESUMED_SAME: { icon: "🟡", label: "동일상품 추정" },
  SIMILAR: { icon: "⚪", label: "비교상품" },
  UNKNOWN: { icon: "⚪", label: "판단 불가" },
  CONFLICT: { icon: "🔴", label: "다른 상품 가능성" },
};

/** 요약에서 강한 등급이 항상 먼저 온다 — 정렬 결과에 기대지 않고 이 순서로 고정한다. */
const TIER_STRENGTH_ORDER: MatchDisplayTier[] = [
  "SAME",
  "SAME_MODEL_OPTION_DIFF",
  "PRESUMED_SAME",
  "SIMILAR",
  "UNKNOWN",
  "CONFLICT",
];

function countTiers(tiers: MatchDisplayTier[]): MarketEvidenceTierCount[] {
  const counts = new Map<MatchDisplayTier, number>();
  for (const tier of tiers) counts.set(tier, (counts.get(tier) ?? 0) + 1);
  return TIER_STRENGTH_ORDER.filter((tier) => (counts.get(tier) ?? 0) > 0).map((tier) => ({
    tier,
    ...TIER_NAME[tier],
    count: counts.get(tier)!,
  }));
}

/**
 * 등급 분포를 화면 한 줄로. **이 함수가 이번 추가 지시의 본체다.**
 *
 *   등급 하나   "🟢 동일상품 기준"          — 세 곳이 전부 같은 등급일 때만
 *   등급 여럿   "🟢 동일상품 1 · 🟡 동일상품 추정 2"
 *
 * 섞였을 때 "🟢 동일상품 기준"이라고 적으면 추정 2곳이 확정으로 포장된다 —
 * 이 작업이 고치려는 신뢰 문제 그 자체라 구조로 막는다. 개수를 붙이는 쪽이
 * 가장 짧으면서도 "이 3곳을 왜 믿을 수 있지?"에 요약만으로 답한다.
 */
export function tierCountsText(tiers: MarketEvidenceTierCount[]): string | null {
  if (tiers.length === 0) return null;
  if (tiers.length === 1) return `${tiers[0]!.icon} ${tiers[0]!.label} 기준`;
  return tiers.map((t) => `${t.icon} ${t.label} ${t.count}`).join(" · ");
}

/** 등급이 둘 이상이면 "전부 확정은 아니다"를 한 줄로. 하나면 null이다. */
function mixedTierNote(tiers: MarketEvidenceTierCount[], headlineTier: MatchDisplayTier | null): string | null {
  if (tiers.length < 2) return null;
  const headline = headlineTier ? TIER_NAME[headlineTier] : null;
  return headline
    ? `등급이 섞여 있습니다 — 위 가격은 ${headline.icon} ${headline.label}로 확인된 곳만으로 계산했습니다.`
    : "등급이 섞여 있습니다 — 확정된 동일상품만으로 이루어진 가격대가 아닙니다.";
}

/* ───────────────────────────── 🇰🇷 국내 시장 ───────────────────────────── */

export const DOMESTIC_MARKET_DRILL_DOWN = "국내 가격 보기";
export const DOMESTIC_MARKET_HINT = "한국의 다른 판매자들이 이 상품을 얼마에 파는가";

export interface DomesticMarketEvidenceInput {
  /** buildMarketContext의 결과. 대표 가격을 고르는 규칙을 두 곳에서 따로 정하지 않는다. */
  context: MarketContext;
  /** domesticMarketSplit.basis — 대표 가격이 어느 버킷에서 나왔는가. */
  basis: "EXACT" | "COMPARISON" | "NONE";
  /** domesticMarketSplit.exact.sellerCount — 식별자로 확인된 동일상품 판매처 수. */
  exactSellerCount: number;
  /** domesticMarketSplit.comparison.sellerCount — 동일상품으로 확정되지 않은 비교 관측. */
  comparisonSellerCount: number;
}

/**
 * 국내 요약. 숫자는 전부 서버 집계에서 온다(새 계산 없음).
 *
 * 등급 두 칸이 서버의 두 버킷과 1:1로 대응한다는 점이 중요하다 —
 * exact는 식별자 근거가 있는 관측만, comparison은 그렇지 않은 관측만 담는
 * **서로 겹치지 않는** 집합이다(summarizeDomesticMarketSplit). 그래서 두 수를
 * 그대로 나란히 적는 것이 곧 정확한 분포다.
 */
export function buildDomesticMarketEvidence(input: DomesticMarketEvidenceInput): MarketEvidenceSummary {
  const tiers = countTiers([
    ...Array<MatchDisplayTier>(Math.max(0, input.exactSellerCount)).fill("SAME"),
    ...Array<MatchDisplayTier>(Math.max(0, input.comparisonSellerCount)).fill("SIMILAR"),
  ]);
  // 대표 가격이 선 버킷. 서버는 동일상품이 한 곳이라도 있으면 그 버킷만으로
  // 집계하므로(resolved), 등급이 섞였을 때 "위 가격은 🟢만으로 계산했다"가 참이다.
  const headlineTier: MatchDisplayTier | null =
    input.basis === "EXACT" ? "SAME" : input.basis === "COMPARISON" ? "SIMILAR" : null;
  const comparable = input.context.comparable;
  const hasEvidence = tiers.length > 0;

  return {
    title: PRICE_SECTION_TITLE.DOMESTIC_COMPETITION,
    hint: DOMESTIC_MARKET_HINT,
    figure: comparable.value,
    figureBasis: comparable.value ? comparable.basis : null,
    // 비교상품이 0건이면 지어낸 숫자도 범위도 없다 — 없다는 사실만 말한다.
    figureEmpty: comparable.value ? null : (comparable.empty ?? miEmptyState("NO_SEARCH_DATA", null)),
    scopeLabel: hasEvidence ? input.context.sellerCount.label : null,
    tiers,
    mixedNote: mixedTierNote(tiers, headlineTier),
    drillDownLabel: DOMESTIC_MARKET_DRILL_DOWN,
    hasEvidence,
  };
}

/* ───────────────────────────── 🌎 해외 시장 ───────────────────────────── */

export const OVERSEAS_MARKET_DRILL_DOWN = "해외 가격 보기";
export const OVERSEAS_MARKET_HINT = "이 상품이 해외 판매처들에서 어떤 가격대인가";

/**
 * 해외 판매처 후보 한 건. 해외 가격비교(/api/comparison/search)가 이미 돌려준
 * 값을 옮기기만 한다 — 등급은 그 응답의 판정(productMatchTruth)에서 나오고,
 * 가격은 그 응답이 "현재 가격 확인됨"이라고 말한 건만 넘어온다(호출부가 거른다).
 */
export interface OverseasMarketCandidateInput {
  shopId: string;
  shopCountry: string | null;
  tier: MatchDisplayTier;
  /** 확인된 판매가. 검증되지 않았으면 null이고, 그러면 가격대 계산에 들어가지 않는다. */
  price: { amount: number; currency: string } | null;
}

export interface OverseasMarketEvidenceInput {
  candidates: OverseasMarketCandidateInput[];
}

/**
 * 해외 요약.
 *
 * ── 가격대를 어떻게 만드는가 ─────────────────────────────────────────────
 * 관측된 금액 중 **가장 낮은 것과 가장 높은 것**을 고른다. 평균이 아니다 —
 * 평균은 어느 판매처에도 존재하지 않는 숫자이고, 이 저장소는 그런 숫자를 화면에
 * 세우지 않는다(global-market.ts의 같은 규칙). 양끝은 둘 다 실제로 관측된 값이다.
 *
 * ── 통화가 섞이면 가격대를 만들지 않는다 ─────────────────────────────────
 * €45 ~ £52는 가격대가 아니다. 환율을 곱해 한 통화로 접으면 관측에 없던 숫자가
 * 생기므로, 그때는 가격대 자리를 비우고 이유를 말한다 — 등급과 판매처 수는
 * 그대로 남으므로 근거가 사라지는 것은 아니다.
 */
export function buildOverseasMarketEvidence(input: OverseasMarketEvidenceInput): MarketEvidenceSummary {
  const candidates = input.candidates;
  const tiers = countTiers(candidates.map((c) => c.tier));
  const hasEvidence = candidates.length > 0;

  const shopCount = new Set(candidates.map((c) => c.shopId)).size;
  // 국가는 판매처가 스스로 신고한 값이다(comparison_shops.country). 없는 행은
  // 세지 않는다 — "확인 불가"를 한 나라로 세면 나라 수가 늘어난다.
  const countryCount = new Set(
    candidates.map((c) => c.shopCountry?.trim()).filter((v): v is string => !!v),
  ).size;
  const scopeLabel = hasEvidence
    ? [`판매처 ${shopCount}곳`, countryCount > 0 ? `${countryCount}개 국가` : null].filter(Boolean).join(" · ")
    : null;

  const priced = candidates.filter((c) => c.price != null).map((c) => c.price!);
  const currencies = new Set(priced.map((p) => p.currency.toUpperCase()));
  const amounts = priced.map((p) => p.amount);

  let figure: string | null = null;
  let figureBasis: string | null = null;
  let figureEmpty: MiEmptyState | null = null;
  if (priced.length === 0) {
    figureEmpty = hasEvidence
      ? miEmptyState("UNVERIFIABLE", "해외 판매처 가격을 현재가로 확인하지 못했습니다")
      : miEmptyState("NO_SEARCH_DATA", null);
  } else if (currencies.size > 1) {
    // 환율로 접지 않는다 — 접는 순간 어느 판매처에도 없는 숫자가 대표값이 된다.
    figureEmpty = miEmptyState("UNVERIFIABLE", "관측 통화가 여러 개라 하나의 가격대로 묶지 않았습니다");
  } else {
    const currency = priced[0]!.currency;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    figure =
      min === max
        ? formatAmount(min, currency)
        : `${formatAmount(min, currency)} ~ ${formatAmount(max, currency)}`;
    figureBasis = `해외 판매처 ${priced.length}곳에서 확인된 판매가 중 최저·최고 · 평균이 아닙니다`;
  }

  return {
    title: PRICE_SECTION_TITLE.OVERSEAS_MARKET,
    hint: OVERSEAS_MARKET_HINT,
    figure,
    figureBasis,
    figureEmpty,
    scopeLabel,
    tiers,
    // 해외는 서버 집계가 없어 대표값이 특정 등급만으로 계산되지 않는다 —
    // 가격대에 들어간 등급을 하나로 지목할 수 없으므로 지목하지 않는다.
    mixedNote: mixedTierNote(tiers, null),
    drillDownLabel: OVERSEAS_MARKET_DRILL_DOWN,
    hasEvidence,
  };
}

/** 통화가 원화면 원화 포맷을, 아니면 원본 통화 포맷을 쓴다(두 곳이 다른 모양으로
 * 같은 금액을 적지 않게 이미 있는 두 포맷터만 쓴다 — 새 포맷터를 만들지 않는다). */
function formatAmount(amount: number, currency: string): string {
  return currency.toUpperCase() === "KRW" ? formatKrwAmount(amount) : formatOriginAmount(amount, currency);
}
