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
export function selectVisualCheckCandidates(rows: CandidateWithShop[]): CandidateWithShop[] {
  const order = (t: MatchDisplayTier) => VISUAL_CHECK_TIER_ORDER.indexOf(t);
  return rows.filter((r) => isVisualCheckTier(r.tier)).sort((a, b) => order(a.tier) - order(b.tier));
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

  // 🔴 0건을 «침묵» 으로 두지 않는다. 그게 이번 사고 직전의 화면이었다 —
  //    셀러는 판정이 없었던 것인지 자기가 못 본 것인지 알 수 없었다.
  if (selected.length === 0) {
    return (
      <section className="rounded-md border border-border bg-surface p-3">
        <h4 className="text-xs font-semibold text-text-primary">{marketLabel} 동일상품 후보</h4>
        <p className="mt-1 text-[11px] text-text-tertiary">동일상품 후보가 없습니다.</p>
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
                {origin.brand && <p className="text-[10px] text-text-tertiary">{origin.brand}</p>}
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
    </section>
  );
}
