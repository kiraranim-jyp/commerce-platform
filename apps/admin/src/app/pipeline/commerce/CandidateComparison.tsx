"use client";

import { formatMoney, isPriceDisplayable, type PriceStatus } from "@/lib/price-truth";
import { isVisualCheckTier, tierDisplay, VISUAL_CHECK_TIER_ORDER, type MatchDisplayTier } from "./match-display";

/**
 * P0-A.29-C/D(CEO 지시, 2026-09-19) — **자동 판정이 낸 답을 사람이 눈으로 볼 수
 * 있게 한다.**
 *
 * ── 🔴 이 파일에는 «판정» 이 없다 ───────────────────────────────────────────
 * 처음 만들 때 여기에 자체 선별 규칙(selectVisualCheckCandidates)을 뒀다. 그게
 * 이번 사고의 원인이다: 그 규칙의 기본값이 「보여준다」여서, 국내에 동일상품이
 * 하나도 없는데도 후보 5건이 «가격까지 달고» 떴다(실사용 2026-09-19, Pèpè Lulu
 * T Bar Shoes). 판정기는 「없다」고 말하는데 화면은 「유력 후보 5건」이라고 말한
 * 것이다.
 *
 * 그래서 이 파일은 이제 등급을 «계산하지 않는다». 등급은 호출부가 이미 있는
 * domesticMatchDisplay / overseasMatchDisplay 로 매겨서 넘겨주고, 어느 등급을
 * 카드에 올릴지는 match-display.ts 의 isVisualCheckTier 하나가 정한다. 판정 의미가
 * 사는 곳은 한 곳뿐이어야 한다.
 *
 * ── 국내/해외 공통인 이유 ───────────────────────────────────────────────────
 * 두 검색의 후보 모양이 같다. 화면을 두 벌로 만들면 한쪽만 고치는 일이 반드시
 * 생긴다 — REWORK-10 이 커머스 세 탭에서 겪은 그 자리다.
 */

export interface ComparableCandidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  /**
   * 🔴 가격을 «숫자로» 보여줘도 되는지는 이 값만 정한다. 검색 목록에서 주운
   * 미검증 가격을 실제 판매가처럼 그리지 않는다는 기존 원칙(isPriceDisplayable)을
   * 카드도 똑같이 따른다 — 표에서는 못 보여주는 숫자가 카드에서는 보이면
   * 셀러는 둘 중 어느 쪽을 믿어야 할지 알 수 없다.
   */
  priceStatus?: PriceStatus;
  /**
   * P0-A.29-E ㉮ — 이 가격이 «어느 옵션» 의 가격인가. 🔴 OPTION_MISMATCH 는
   * 「옵션마다 값이 다른데 원상품이 고른 옵션을 못 찾았다」는 뜻이고, 그때는
   * 숫자를 보여주지 않는다 — 다른 사이즈의 가격을 동일 옵션 가격처럼 읽게
   * 만드는 것이 이번에 고치는 문제 그 자체다.
   */
  priceOptionMatch?: "SAME_OPTION" | "SINGLE_PRICE" | "OPTION_MISMATCH";
  priceOptionValues?: Record<string, string>;
  /** P0-A.29-E ⑤ — 무엇이 달라서 「동일 모델 · 옵션 다름」인가. `in` 뒤 문자열을
   *  «색상» 이라고 부르지 않는다(소재일 수도 있다) — 화면도 「옵션」이라 쓴다. */
  variantDifference?: { model: string; queryOption: string; candidateOption: string };
  matchReasons?: string[];
  /**
   * 🔴🔴 WU-091 — **상품코드.** 셀러가 「왜 동일상품이 아닌가」를 스스로 보려면
   *    품번이 보여야 한다. 🔴 **없으면 «없다» 고 적는다** — 지어내지 않는다
   *    (WU-083 이 Smallable 에서 품번을 만들지 않은 것과 같은 원칙).
   */
  modelCode?: string | null;
  /** P0-A.29-B 의 관측 원점수. 🔴 null 이면 «아무것도 표시하지 않는다» —
   *  0 으로 그리면 「낮음」이라는 없는 사실을 말하게 된다. */
  visionScore?: number | null;
}

export interface CandidateWithShop {
  shopName: string;
  /** 호출부가 기존 판정 표시 계층으로 매긴 등급. 이 파일은 읽기만 한다. */
  tier: MatchDisplayTier;
  candidate: ComparableCandidate;
}

/** 🔴 원본이 이미지를 안 주면 «빈칸» 이다. 다른 상품 사진으로 대체하지 않는다. */
function ProductImage({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded border border-border bg-background text-[11px] text-text-tertiary">
        이미지 없음
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="h-32 w-full rounded border border-border bg-background object-contain"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        /* 로드 실패도 «빈칸» 으로 떨어뜨린다 — 깨진 이미지 아이콘을 남기면
           셀러가 «상품이 없다» 로 읽는다. 실측(2026-09-19)에서는 국내·해외·원상품
           전부 200 이었고 Referer 를 붙여도 차단되지 않았지만, 판매처가 나중에
           핫링크를 막을 수 있어 폴백을 둔다. */
        const img = e.currentTarget;
        img.style.display = "none";
        img.insertAdjacentHTML(
          "afterend",
          '<div class="flex h-32 w-full items-center justify-center rounded border border-border bg-background text-[11px] text-text-tertiary">이미지 확인 불가</div>',
        );
      }}
    />
  );
}

/**
 * 판정 근거를 «짧은 줄» 로 요약한다.
 *
 * 🔴 matchReasons 원문을 그대로 쏟지 않는다. 그 배열에는 진단용 긴 문장이 섞여
 *    있어 셀러가 읽을 물건이 아니다. 그렇다고 없는 근거를 지어내지도 않는다 —
 *    실제 문장에 있는 것만 골라 짧게 다시 쓴다.
 */
function summarizeReasons(reasons: string[] | undefined): string[] {
  if (!reasons?.length) return [];
  const out: string[] = [];
  const joined = reasons.join(" | ");
  if (/품번|모델코드|modelCode|SKU 일치/i.test(joined)) out.push("상품 코드 근거 있음");
  if (/브랜드 일치/.test(joined)) out.push("브랜드 일치");
  if (/색상 일치/.test(joined)) out.push("색상 일치");
  if (/소재/.test(joined)) out.push("소재 일치");
  if (/상품군|카테고리 일치/.test(joined)) out.push("상품군 일치");
  if (/핵심 상품명|모델명 유사도/.test(joined)) out.push("상품명 일치");
  return out;
}

/**
 * 🔴 카드에 올릴 후보만 남긴다. **등급을 다시 매기지 않는다** — 이미 매겨진
 *    등급을 match-display 의 정책에 통과시킬 뿐이다.
 */
/**
 * 🔴🔴 WU-091 — **접힌 목록의 쌓는 순서.** 확정에 가까운 쪽이 위다.
 *    🔴 `DEFAULT_TIER_ORDER` 를 쓰지 않는다 — 거기에 `UNKNOWN`/`CONFLICT` 가
 *    **없어서** `indexOf` 가 -1 을 주고 **제외 후보가 맨 위로 올라온다**.
 */
const ALL_TIER_ORDER: MatchDisplayTier[] = [
  "SAME",
  "SAME_MODEL_OPTION_DIFF",
  "PRESUMED_SAME",
  "SIMILAR",
  "UNKNOWN",
  "CONFLICT",
];

/**
 * 🔴🔴 WU-091 — **카드에 못 올라간 나머지 후보.**
 *
 * ── 왜 필요한가 (CPO 지시 2026-10-19) ─────────────────────────────────────
 * 「시스템이 SAME 으로 인정하지 않은 후보도 보여주고, **왜 비교가격에 포함되지
 *  않았는지** 이해할 수 있게 만든다.」 지금까지 그 후보는 화면에서 통째로
 * 사라져서 셀러에게는 **「검색이 실패했다」와 구분되지 않았다.**
 *
 * ── 🔴🔴 그런데 2026-09-19 사고를 되살리면 안 된다 (이 파일 머리 주석) ──────
 * 그때의 문제는 「보여줬다」가 아니라 **「유력 후보처럼 보여줬다」** 였다 —
 * 기본으로 펼쳐져 있었고 **가격이 달려 있었고** 판정 라벨이 없었다.
 * 그래서 이번 목록은 **넷을 동시에** 지킨다:
 * ```
 * ① 기본 **접힘**(details 에 open 을 주지 않는다)
 * ② 머리에서 **「동일상품으로 확인된 후보가 없습니다」를 «먼저»** 말한다
 * ③ 행마다 **판정 라벨 + 그 판정의 note** 를 붙인다
 * ④ 구역에 **「가격비교에 사용되지 않습니다」** 를 명시한다
 * ```
 * 🔴 그리고 **등급을 다시 매기지 않는다** — isVisualCheckTier 정책은 **그대로** 다.
 */
export function selectOtherCandidates(rows: CandidateWithShop[]): CandidateWithShop[] {
  const order = (t: MatchDisplayTier) => ALL_TIER_ORDER.indexOf(t);
  return rows.filter((r) => !isVisualCheckTier(r.tier)).sort((a, b) => order(a.tier) - order(b.tier));
}

export function selectVisualCheckCandidates(rows: CandidateWithShop[]): CandidateWithShop[] {
  const order = (t: MatchDisplayTier) => VISUAL_CHECK_TIER_ORDER.indexOf(t);
  return rows.filter((r) => isVisualCheckTier(r.tier)).sort((a, b) => order(a.tier) - order(b.tier));
}

/**
 * 원상품 카드에 적을 «판매처» 이름.
 *
 * 🔴 브랜드가 아니라 판매처다. 후보 쪽이 `shopName`(판매처)을 적으므로 왼쪽도
 * 같은 축이어야 한다 — 축이 다르면 나란히 놓였을 때 원본과 후보가 뒤집혀
 * 읽힌다(S-12 에서 실제로 그랬다).
 *
 * 🔴 이름을 «지어내지 않는다». 주소에서 읽을 수 있는 것은 호스트뿐이고, 그
 * 호스트를 그대로 보여준다(`junioredition.com`). 첫 라벨만 떼어 대문자로
 * 바꾸면 「Junioredition」 같은 실제로 존재하지 않는 이름이 만들어진다.
 */
export function originSellerLabel(origin: { sourceUrl?: string }): string | null {
  if (!origin.sourceUrl) return null;
  try {
    return new URL(origin.sourceUrl).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export interface OriginProduct {
  title: string;
  brand?: string;
  imageUrl: string | null;
  price: { amount: number; currency: string } | null;
  sourceUrl?: string;
  /** P0-A.29-E ㉮ — 원상품 URL 이 «고른» 옵션(예: `29 EUR (UK 11)`). 가격 옆에
   *  이게 없으면 셀러는 그 숫자가 어느 사이즈의 값인지 알 수 없다. */
  optionNote?: string;
}

/**
 * 🔴 가격 한 칸. 검증된 가격만 숫자로 나온다.
 *
 * priceStatus 를 «안 주는» 호출부(국내)는 기존처럼 숫자를 그대로 쓴다 — 국내
 * 후보 가격은 검색 단계에서 이미 확정돼 오는 값이고, 여기서 없는 상태값을
 * 지어내 막으면 오늘 잘 보이던 가격이 이유 없이 사라진다.
 */
function CandidatePrice({ candidate }: { candidate: ComparableCandidate }) {
  if (candidate.priceStatus !== undefined && !isPriceDisplayable(candidate.priceStatus, candidate.price)) {
    return (
      <p className="text-[11px] text-text-tertiary">
        {candidate.priceStatus === "PRICE_UNAVAILABLE" ? "가격 확인 실패" : "가격 확인 필요"}
      </p>
    );
  }
  // 🔴 옵션마다 값이 다른데 같은 옵션을 못 찾았다 — 숫자를 내놓으면 셀러는 그것을
  //    「같은 옵션의 가격」으로 읽는다. 실측(junioredition 신발 45%)에서 한 상품이
  //    사이즈마다 £115/£119/£123 이었다.
  if (candidate.priceOptionMatch === "OPTION_MISMATCH") {
    return <p className="text-[11px] text-text-tertiary">동일 옵션 가격 확인 필요</p>;
  }
  if (!candidate.price) return null;
  return (
    <>
      <p className="text-[11px] font-medium text-text-primary">
        {formatMoney(candidate.price.amount, candidate.price.currency)}
      </p>
      {/* 어느 옵션의 가격인지 말한다. 말하지 않는 숫자는 조달 판단에 쓸 수 없다. */}
      {candidate.priceOptionMatch === "SAME_OPTION" && candidate.priceOptionValues && (
        <p className="text-[10px] text-text-tertiary">
          옵션 {Object.values(candidate.priceOptionValues).join(" / ")} 기준
        </p>
      )}
    </>
  );
}

/**
 * 🔴🔴 WU-091 — 구역 문구. **테스트가 이 상수를 단언** 하므로 화면과 계약이 갈리지 않는다.
 * 🔴 「후보 없음」과 「동일상품 없음」을 **다른 문장** 으로 가른다 — CPO 지시 §6 의 핵심이다
 *    (셀러에게 둘은 **전혀 다른 상황** 인데 지금까지 같은 말로 보였다).
 */
export const NO_CANDIDATE_AT_ALL = "🔎 비교 후보를 찾지 못했습니다.";
export const NO_SAME_BUT_CANDIDATES = "🟡 후보는 찾았지만 동일상품으로 확인된 판매처가 없습니다.";
export const OTHER_CANDIDATES_NOTICE =
  "아래 후보는 동일상품으로 확정되지 않아 가격비교에 사용되지 않습니다. 판정과 이유를 함께 보여 드립니다.";

/**
 * 🔴🔴 WU-091 — **접힌 후보 목록.** 기본은 닫힘이고, 펼쳐야 보인다.
 *
 * 🔴 details 를 쓴 이유 — 상태를 들고 있지 않아도 되고, **닫힘이 기본값** 이라
 *    2026-09-19 사고(「펼쳐진 채 가격이 달려 유력 후보처럼 보였다」)의 모양을
 *    **구조적으로** 못 만든다. open 속성을 주지 않는 한 접혀 있다.
 */
function OtherCandidates({ rows, marketLabel }: { rows: CandidateWithShop[]; marketLabel: string }) {
  if (rows.length === 0) return null;
  return (
    <details data-testid="cc-others" className="mt-2 rounded border border-border bg-background">
      <summary data-testid="cc-others-summary" className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-text-secondary">
        {marketLabel} 후보 {rows.length}건 보기
      </summary>
      <div className="space-y-1.5 border-t border-border px-2.5 py-2">
        <p data-testid="cc-others-notice" className="text-[10px] text-text-tertiary">
          {OTHER_CANDIDATES_NOTICE}
        </p>
        {rows.map(({ shopName, candidate, tier }, i) => {
          const d = tierDisplay(tier);
          const reasons = summarizeReasons(candidate.matchReasons);
          return (
            <div
              key={`${candidate.url}-${i}`}
              data-testid="cc-other-row"
              className="space-y-1 rounded border border-border bg-surface p-2"
            >
              <div className="flex flex-wrap items-center gap-1">
                {/* 🔴 **판정 라벨이 행마다 선다** — 이것이 없으면 「유력 후보」로 읽힌다. */}
                <span
                  data-testid="cc-other-verdict"
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${d.className}`}
                >
                  {d.icon} {d.label}
                </span>
                <span data-testid="cc-other-shop" className="text-[10px] text-text-tertiary">
                  {shopName}
                </span>
              </div>
              <p data-testid="cc-other-title" className="line-clamp-2 text-[11px] text-text-primary">
                {candidate.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <CandidatePrice candidate={candidate} />
                {/* 🔴 품번은 **있으면** 적고 없으면 «없음» 이라고 적는다 — 지어내지 않는다. */}
                <span data-testid="cc-other-code" className="text-[10px] text-text-tertiary">
                  상품코드 {candidate.modelCode ? candidate.modelCode : "없음"}
                </span>
              </div>
              {/* 🔴 **왜 비교가격에 안 들어갔는가** — 새 문장을 지어내지 않고 그 판정의 note 를 쓴다. */}
              <p data-testid="cc-other-note" className="text-[10px] text-text-secondary">
                {d.note}
              </p>
              {reasons.length > 0 && (
                <ul data-testid="cc-other-reasons" className="flex flex-wrap gap-x-2 text-[10px] text-text-secondary">
                  {reasons.map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              )}
              <a
                data-testid="cc-other-link"
                href={candidate.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[10px] font-medium text-text-primary underline"
              >
                상품 보기 ↗
              </a>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function CandidateComparison({
  origin,
  rows,
  marketLabel,
}: {
  origin: OriginProduct;
  rows: CandidateWithShop[];
  /** "국내" / "해외" — 데이터 모양은 같고 이 말만 다르다. */
  marketLabel: string;
}) {
  const selected = selectVisualCheckCandidates(rows);
  /** 🔴 WU-091 — 카드에 못 올라간 나머지. **거르지 않는다**(전부 들어온다). */
  const others = selectOtherCandidates(rows);
  const shopCount = new Set(rows.map((r) => r.shopName)).size;

  // 🔴 0건을 «침묵» 으로 두지 않는다. 그게 이번 사고 직전의 화면이었다 —
  //    셀러는 판정이 없었던 것인지 자기가 못 본 것인지 알 수 없었다.
  if (selected.length === 0) {
    return (
      <section data-testid="cc-section" className="rounded-md border border-border bg-surface p-3">
        <h4 className="text-xs font-semibold text-text-primary">{marketLabel} 후보</h4>
        {/* 🔴🔴 WU-091 — **「동일상품 없음」 ≠ 「후보 없음」.** 둘을 다른 문장으로 가른다.
            지금까지 둘 다 「동일상품 후보가 없습니다」여서 셀러에게 **같은 실패** 로 보였다. */}
        {others.length === 0 ? (
          <p data-testid="cc-empty" className="mt-1 text-[11px] text-text-tertiary">
            {NO_CANDIDATE_AT_ALL}
          </p>
        ) : (
          <>
            <p data-testid="cc-count" className="mt-1 text-[11px] text-text-secondary">
              {shopCount}곳 · {rows.length}건 검색됨
            </p>
            <p data-testid="cc-no-same" className="text-[11px] text-text-tertiary">
              {NO_SAME_BUT_CANDIDATES}
            </p>
            <OtherCandidates rows={others} marketLabel={marketLabel} />
          </>
        )}
      </section>
    );
  }

  const counts = VISUAL_CHECK_TIER_ORDER.map((tier) => ({
    tier,
    n: selected.filter((r) => r.tier === tier).length,
  })).filter((x) => x.n > 0);

  return (
    <section className="space-y-2 rounded-md border border-border bg-surface p-3">
      <div>
        <h4 className="text-xs font-semibold text-text-primary">{marketLabel} 동일상품 후보</h4>
        {/* 등급을 뭉개서 한 숫자로 말하지 않는다 — 「유력 후보 5건」이 이번 사고의 문장이었다. */}
        <p className="text-[11px] text-text-secondary">
          {counts.map(({ tier, n }) => `${tierDisplay(tier).icon} ${tierDisplay(tier).label} ${n}건`).join(" · ")}
        </p>
        <p className="text-[11px] text-text-tertiary">
          자동 가격비교에는 아직 사용하지 않습니다 — 직접 보시고 판단하시라고 열어 둔 화면입니다.
        </p>
      </div>

      {selected.map(({ shopName, candidate, tier }, index) => {
        const display = tierDisplay(tier);
        const reasons = summarizeReasons(candidate.matchReasons);
        return (
          <div key={`${candidate.url}-${index}`} className="space-y-2 rounded border border-border bg-background p-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-text-tertiary">원상품</p>
                <ProductImage url={origin.imageUrl} alt={origin.title} />
                <p className="line-clamp-2 text-[11px] text-text-primary">{origin.title}</p>
                {/* ══ 장기 스프린트 S-12(CEO 실화면 재현, 2026-09-27) ══

                    🔴 여기가 「원본과 후보가 뒤집혀 보인다」의 자리였다.
                    왼쪽(원상품)은 «브랜드»(Bobo Choses)를, 오른쪽(후보)은
                    «판매처»(Junior Edition)를 적고 있었다. 축이 다른 두 값이
                    나란히 서니 「원본 = Bobo Choses / 후보 = Junior Edition」
                    으로 읽혔다 — 실제로는 정반대다. 원본 판매처가 Junior
                    Edition 이고 Bobo Choses 는 그 상품의 «브랜드» 다.

                    🔴 코드가 틀린 값을 넣은 게 아니라 «다른 축» 을 나란히
                    놓았다. 그래서 서버 여섯 곳과 MI 카드를 다 뒤져도 원인이
                    안 나왔다(S-12 1차 조사). 대표님 화면 한 장이 답이었다.

                    이제 양쪽 다 «판매처» 를 적는다. 브랜드는 두 상품이 같으니
                    비교에 쓸모가 없다 — 판매처가 달라야 비교가 성립한다. */}
                {originSellerLabel(origin) && (
                  <p className="text-[10px] text-text-tertiary">{originSellerLabel(origin)}</p>
                )}
                {origin.price && (
                  <p className="text-[11px] font-medium text-text-primary">
                    {formatMoney(origin.price.amount, origin.price.currency)}
                  </p>
                )}
                {origin.optionNote && <p className="text-[10px] text-text-tertiary">옵션 {origin.optionNote} 기준</p>}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${display.className}`}>
                    {display.icon} {display.label}
                  </span>
                  <span className="text-[10px] text-text-tertiary">{marketLabel} 후보</span>
                </div>
                <ProductImage url={candidate.imageUrl} alt={candidate.title} />
                <p className="line-clamp-2 text-[11px] text-text-primary">{candidate.title}</p>
                <p className="text-[10px] text-text-tertiary">{shopName}</p>
                <CandidatePrice candidate={candidate} />
              </div>
            </div>

            {/* P0-A.29-E ⑤ — «무엇이» 다른지 말한다. 이미 계산된 문자열을 그대로
                쓴다(새 파싱 없음). 🔴 「색상」이라고 단정하지 않는다 — 이 자리에는
                소재가 들어오기도 한다. */}
            {tier === "SAME_MODEL_OPTION_DIFF" && candidate.variantDifference && (
              <p className="text-[10px] text-text-secondary">
                모델 {candidate.variantDifference.model} · 옵션 {candidate.variantDifference.queryOption} ↔{" "}
                {candidate.variantDifference.candidateOption}
              </p>
            )}
            {/* 🔴 옵션이 다른 후보는 «가격비교 대상이 아니다» 를 카드 안에서 말한다.
                같은 카드에 가격 숫자가 있으므로, 말하지 않으면 비교 가격으로 읽힌다. */}
            {tier === "SAME_MODEL_OPTION_DIFF" && (
              <p className="text-[10px] text-text-secondary">{display.note}</p>
            )}

            {reasons.length > 0 && (
              <ul className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-text-secondary">
                {reasons.map((r) => (
                  <li key={r}>✓ {r}</li>
                ))}
              </ul>
            )}

            {/* 🔴 값이 없으면 줄 자체를 그리지 않는다. null 을 0 으로 그리면 안 된다. */}
            {typeof candidate.visionScore === "number" && (
              <p className="text-[10px] text-text-tertiary">이미지 관측 점수 {candidate.visionScore} — 참고용(판정에 쓰이지 않습니다)</p>
            )}

            <a
              href={candidate.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block text-[11px] font-medium text-primary hover:text-primary-hover"
            >
              상품 원문 보기 →
            </a>
          </div>
        );
      })}

      {/* 🔴🔴 WU-091 — 동일상품을 찾았더라도 **나머지 후보를 숨기지 않는다.**
          🔴 그러나 여기서도 **접혀 있고** 「가격비교에 사용되지 않습니다」를 말한다 —
          카드(위)와 목록(아래)의 **의미 차이가 화면에서 보여야** 한다. */}
      <OtherCandidates rows={others} marketLabel={marketLabel} />
    </section>
  );
}
