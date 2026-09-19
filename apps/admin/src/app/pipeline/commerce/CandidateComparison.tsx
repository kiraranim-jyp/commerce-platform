"use client";

import { formatMoney } from "@/lib/price-truth";

/**
 * P0-A.29-C(CEO 지시, 2026-09-19) — **자동 판정이 못 쓴 후보를 사람이 눈으로 볼 수
 * 있게 한다.**
 *
 * 지금까지 이 자리에는 「국내 5곳에서 5건을 찾았지만, 같은 상품이라고 볼 근거가
 * 부족해 가격 비교에 쓰지 않았습니다」한 문장뿐이었다. 셀러는 그 5건이 무엇이었는지
 * 볼 방법이 없었고, 그래서 판정을 «믿는 수밖에» 없었다.
 *
 * ── 🔴 이 컴포넌트가 하지 않는 것 ───────────────────────────────────────────
 * 자동 가격비교에 «아무 영향도» 주지 않는다. matchTruth · priceTier · EXACT ·
 * COMPARISON · 가격관측 어느 것도 이 화면 때문에 바뀌지 않는다. 여기서 하는 일은
 * 이미 계산된 값을 «그리는 것» 뿐이고, 판정을 다시 하지 않는다.
 *
 * ── 왜 국내/해외 공통인가 ───────────────────────────────────────────────────
 * 두 검색의 Candidate 모양이 이미 같다(title · url · price · imageUrl ·
 * matchTruth · crossSellerVerdict). 화면을 두 벌로 만들면 한쪽만 고치는 일이
 * 반드시 생긴다 — REWORK-10 이 커머스 세 탭에서 겪은 것과 같은 자리다.
 */

export interface ComparableCandidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  matchTruth?: string;
  crossSellerVerdict?: string;
  matchReasons?: string[];
  confidence?: number;
  /** P0-A.29-B 의 관측 원점수. 🔴 null 이면 «아무것도 표시하지 않는다» —
   *  0 으로 그리면 「낮음」이라는 없는 사실을 말하게 된다. */
  visionScore?: number | null;
}

export interface CandidateWithShop {
  shopName: string;
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
 * 🔴 matchReasons 원문을 그대로 쏟지 않는다. 그 배열에는 판정방법·판정근거 같은
 *    긴 진단 문장이 섞여 있어 셀러가 읽을 물건이 아니다. 그렇다고 없는 근거를
 *    지어내지도 않는다 — 실제 문장에 있는 것만 골라 짧게 다시 쓴다.
 */
function summarizeReasons(reasons: string[] | undefined): string[] {
  if (!reasons?.length) return [];
  const out: string[] = [];
  const joined = reasons.join(" | ");
  if (/품번|모델코드|modelCode/i.test(joined)) out.push("상품 코드 근거 있음");
  if (/브랜드/.test(joined)) out.push("브랜드 일치");
  if (/색상/.test(joined)) out.push("색상 일치");
  if (/소재/.test(joined)) out.push("소재 일치");
  if (/상품군|카테고리/.test(joined)) out.push("상품군 일치");
  if (/핵심 상품명|모델명 유사도/.test(joined)) out.push("상품명 일치");
  return out;
}

/** 🔴 «확정» 이라는 말을 쓰지 않는다. 이 화면은 후보를 보여줄 뿐이다. */
function tierLabel(c: ComparableCandidate): { text: string; tone: string } {
  if (c.matchTruth === "EXACT_IDENTIFIER" || c.matchTruth === "STRONG_IDENTIFIER" || c.crossSellerVerdict === "SAME") {
    return { text: "🟢 가장 유력", tone: "bg-success-soft text-success" };
  }
  if (c.crossSellerVerdict === "PRESUMED_SAME") return { text: "🟡 유력", tone: "bg-warning-soft text-warning" };
  return { text: "⚪ 확인 필요", tone: "bg-background text-text-tertiary" };
}

/**
 * 육안 확인 대상만 남긴다.
 *
 * 🔴 이것은 «동일상품 판정» 이 아니라 «화면 노출 필터» 다. 자동 가격비교는 여전히
 *    priceTierFromLink 가 정하고, 여기서 남긴다고 가격에 들어가지 않는다.
 */
export function selectVisualCheckCandidates(rows: CandidateWithShop[]): CandidateWithShop[] {
  const rank = (c: ComparableCandidate): number => {
    if (c.matchTruth === "CONFLICT" || c.matchTruth === "INSUFFICIENT_EVIDENCE") return -1;
    if (c.crossSellerVerdict === "CONFLICT") return -1;
    if (c.matchTruth === "EXACT_IDENTIFIER" || c.matchTruth === "STRONG_IDENTIFIER" || c.crossSellerVerdict === "SAME") return 2;
    if (c.crossSellerVerdict === "PRESUMED_SAME") return 1;
    return 0;
  };
  return rows
    .map((r) => ({ r, score: rank(r.candidate) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || (b.r.candidate.confidence ?? 0) - (a.r.candidate.confidence ?? 0))
    .map((x) => x.r);
}

export interface OriginProduct {
  title: string;
  brand?: string;
  imageUrl: string | null;
  price: { amount: number; currency: string } | null;
  sourceUrl?: string;
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
  if (selected.length === 0) return null;

  return (
    <section className="space-y-2 rounded-md border border-border bg-surface p-3">
      <div>
        <h4 className="text-xs font-semibold text-text-primary">동일상품 유력 후보 {selected.length}건</h4>
        <p className="text-[11px] text-text-tertiary">
          자동 가격비교에는 아직 사용하지 않습니다 — 직접 보시고 판단하시라고 열어 둔 화면입니다.
        </p>
      </div>

      {selected.map(({ shopName, candidate }, index) => {
        const badge = tierLabel(candidate);
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
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.tone}`}>{badge.text}</span>
                  <span className="text-[10px] text-text-tertiary">{marketLabel} 후보</span>
                </div>
                <ProductImage url={candidate.imageUrl} alt={candidate.title} />
                <p className="line-clamp-2 text-[11px] text-text-primary">{candidate.title}</p>
                <p className="text-[10px] text-text-tertiary">{shopName}</p>
                {candidate.price && (
                  <p className="text-[11px] font-medium text-text-primary">
                    {formatMoney(candidate.price.amount, candidate.price.currency)}
                  </p>
                )}
              </div>
            </div>

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
