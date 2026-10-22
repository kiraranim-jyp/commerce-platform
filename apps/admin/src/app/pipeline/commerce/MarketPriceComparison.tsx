"use client";

import type { JSX } from "react";
import { OverseasReferencePrice } from "./OverseasReferencePrice";
import {
  DOMESTIC_REFERENCE_NOTE,
  DOMESTIC_REFERENCE_SCOPE,
  DOMESTIC_REFERENCE_TITLE,
  type OverseasPriceSummary,
} from "./overseas-reference";
import {
  MI_SAME_AREA_SCOPE,
  MI_SAME_DOMESTIC_HEADING,
  MI_SAME_EMPTY,
  MI_SAME_EXCLUSION_TEXT,
  MI_SAME_OVERSEAS_HEADING,
  MI_DETAIL_FOLD_LABEL,
  MARKET_JUDGEMENT_NOTE,
  MARKET_JUDGEMENT_TITLE,
  MARKET_LABEL,
  /** 🔴 WU-145 ② — 결론 한 줄. **추천가가 아니라 «해석»** 이다(§00-B 가격 보류 유지). */
  MARKET_PRICE_JUDGEMENT_NOTE,
  /** 🔴 WU-140 — 시장 블록이 «먼저» 서고, 그 시장이 빈 «이유» 를 말한다(CPO 확정 순서). */
  MARKET_RESULT_HEADING,
  countMarketCandidates,
  countUnresolvedMarketCandidates,
  marketEmptyNote,
  marketUnresolvedNote,
  MARKET_TABLE_HEADERS,
  MARKET_VERDICT_TEXT,
  ON_SALE_SPLIT_PREFIX,
  /** 🔴 WU-139 — 가격 미확인 후보를 버리지 않고 링크로 주고, 1~2건으로 기준가를 안내한다. */
  PRICE_GUIDE_EMPTY,
  PRICE_GUIDE_RANGE_NOTE,
  PRICE_GUIDE_SINGLE_NOTE,
  PRICE_GUIDE_TITLE,
  PRICE_LINK_TEXT,
  buildPriceGuide,
  priceGuideCountNote,
  priceGuideHeadline,
  SALE_STATE_TEXT,
  buildMarketJudgement,
  onSaleCountNote,
  pendingNote,
  /** 🔴 WU-145 ① — 사유 분포는 **2차** 가 말한다(1차에서 «이동» · 삭제 아님). */
  pendingReasonNote,
  priceRangeScope,
  priceRangeText,
  selectMiSameCandidates,
  countPendingCandidates,
  type MarketJudgement,
  type MiSameSelection,
} from "./mi-same-candidates";
import { priceText, stockText, type GeminiTransientRow } from "./GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-132 ①②③ — **화면에 «하나뿐인» 동일상품 가격 비교 영역**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 영역이 생긴 이유는 「영역을 하나 더 만들기」가 아니다.**
 *
 * WU-132 전수검토가 찾은 구조적 사실:
 * ```
 * 「📊 시장 가격 비교」의 두 패널(DomesticShopSearch · ComparisonShopSearch)은
 * **클라이언트가 자기 검색을 돌려** `mayShowCandidate` 로 거른다 ⟹ `/check` 가 낸
 * **MI verdict 를 한 번도 보지 않는다.** 그래서 「MI 가 SAME 이라 판정한 후보」가
 * 가격 비교에 **구조적으로 닿지 못했다** — 그것이 이번에 고친 것이다.
 * ```
 * 🟢 그래서 이 컴포넌트는 그 접힘 **안쪽 맨 위** 에 서서 MI 산출을 공급하고,
 *    아래 두 패널은 그대로 **원자료 드릴다운** 으로 남는다(그 둘의 제목이 이미
 *    「… 의 원자료」라고 말한다 — 가격비교 영역이 둘이 되는 것이 아니다).
 *
 * ── 🔴 WU-130 ④ 영역을 «대체» 한다 (복제가 아니다) ─────────────────────────
 * ```
 * MI 패널 안의 `unified-price-comparison` 은 **제거됐고**, 그 안에 있던 두 참고가격
 * 블록(🇰🇷 국내 참고가격 · 🧾 해외 동일상품 참고가격)이 **이 영역으로 옮겨 왔다.**
 * 🔴 집계 계산은 한 글자도 바뀌지 않았다 — 같은 `OverseasReferencePrice` 에 같은
 *    `OverseasPriceSummary` 를 넘긴다(환산 0 · 통화별 · 합계 칸 없음).
 * ```
 *
 * ── 🔴 이 컴포넌트가 «하지 않는» 것 ────────────────────────────────────────
 * ```
 * ❌ 판정 — verdict/tier/threshold 를 만들지 않는다(`selectMiSameCandidates` 가 읽기만)
 * ❌ 집계 — 금액을 더하거나 최저가를 고르지 않는다(MI 가 낸 summary 를 그린다)
 * ❌ 환산 — 통화 그대로. 기호로 바꾸지도 않는다
 * ❌ 저장 — DB 를 모른다. 사람 판단 버튼도 여기 없다(④ 는 검토 구역의 몫)
 * ```
 */

export interface MarketPriceComparisonProps {
  /**
   * 🔴 `/check` 가 낸 **네 출처의 후보를 합친 배열.** 🟢 합치는 곳이 한 곳이어야
   *    같은 후보가 두 번 세어지지 않는다(출처 배지는 행이 계속 말한다).
   * 🔴 `null` = 조회가 아직 돌지 않았다. `[]` = 돌았는데 후보가 0 — **다른 사실** 이다.
   */
  rows?: readonly GeminiTransientRow[] | null;
  /** 🔴 MI 가 이미 낸 국내 참고가격 집계. 여기서 계산하지 않는다. */
  domesticReference?: OverseasPriceSummary | null;
  /** 🔴 MI 가 이미 낸 해외 참고가격 집계. 여기서 계산하지 않는다. */
  overseasReference?: OverseasPriceSummary | null;
}

export function MarketPriceComparison({
  rows,
  domesticReference,
  overseasReference,
}: MarketPriceComparisonProps): JSX.Element | null {
  const domestic = selectMiSameCandidates(rows, "KR");
  const overseas = selectMiSameCandidates(rows, "OVERSEAS");
  /**
   * 🔴🔴 WU-136 — **판매여부를 가격보다 먼저 계산한다**(CPO §B). 시장별로 나누기 «전» 에
   *    센다 — 셀러의 1순위 질문(「팔리고 있는가」)은 국내/해외로 갈리지 않는다.
   */
  const judgement = buildMarketJudgement(rows);
  /**
   * 🔴 WU-133 — **시장과 무관하게** 센다. 「국내/해외로 갈려서 안 보인다」가 아니라
   *    「판정이 보류돼서 안 보인다」가 사실이고, 그 사실은 시장별로 나누면 흐려진다.
   */
  const pendingSummary = countPendingCandidates(rows);
  const pending = pendingNote(pendingSummary);
  /**
   * 🔴🔴 WU-145 ① — **1차에서 내려온 사유 분포가 여기서 산다**(삭제가 아니라 이동).
   *
   * 🔴 **왜 `▸ 판단 근거`(패널) 가 아니라 `▸ MI 상세 분석`(이 영역) 인가** — CPO 지시의
   *    말은 「2차 근거로 격리」이고, 그 두 접힘은 **둘 다 2차** 다. 그런데 사유의 입력은
   *    `rows`(이 컴포넌트의 prop)이고 `▸ 판단 근거` 는 **다른 컴포넌트**
   *    (`DomesticPriceIntelligencePanel`)가 소유한다. 거기로 보내려면 **같은 집계를
   *    두 곳에서** 하거나 prop 을 새로 뚫어야 한다 ⟹ 🔴 같은 숫자의 owner 가 둘이 된다.
   * 🟢 `▸ MI 상세 분석` 은 **이 영역의 2차 접힘이고 이름 그대로 «MI 상세»** 다 —
   *    보류 축의 사유 분포가 사는 자리로 정확하다(새 prop 0 · 집계 0 · 중복 0).
   * 🔴 1차 노출 금지라는 **정책은 그대로 지켜진다** — 바뀐 것은 「어느 2차냐」뿐이다.
   */
  const pendingReasons = pendingReasonNote(pendingSummary);
  /** 🔴 WU-140 — 시장이 확정되지 않아 **두 블록 어디에도 안 들어간** 후보 수(실측 근거는 그 함수). */
  const unresolvedNote = marketUnresolvedNote(countUnresolvedMarketCandidates(rows));

  /**
   * 🔴🔴 **「조회가 돌았는가」가 렌더 조건이다**(WU-130 ② 가 세운 그 계약).
   *    「후보가 있는가」로 두면 후보 0 일 때 영역이 통째로 사라지고, 셀러는
   *    **「조회조차 안 했다」** 로 읽는다 — 그 둘은 다른 사실이다.
   */
  const checkRan = rows != null || !!domesticReference || !!overseasReference;
  if (!checkRan) return null;

  return (
    <section
      data-testid="market-price-comparison"
      className="rounded-md border border-border bg-surface/30 p-3"
    >
      <p className="text-[11px] font-medium text-text-secondary">{MARKET_JUDGEMENT_TITLE}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{MARKET_JUDGEMENT_NOTE}</p>

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 WU-140 ② — **시장 블록이 «먼저» 다** (CPO 확정 순서)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CPO 가 고정한 순서는 **🇰🇷 국내 → 🌎 해외 → 판매·가격 판단 결과 → 상세 근거**
       *    다. 내 초안은 `verdict → 시장 블록` 이었고 **CPO 가 그것을 뒤집었다** —
       *    셀러의 첫 질문은 「국내에 있나 / 해외에 있나」이고 `verdict` 는 그 **요약**
       *    이기 때문이다. 요약을 먼저 읽히게 두면 셀러는 그 한 줄만 보고 판단한다.
       *
       * 🔴🔴 **성공 기준이 「위로 올라갔다」가 아니다**(CPO): 「페이지를 열었을 때 셀러가
       *    **후보 목록을 읽지 않아도** 🇰🇷/🌎 의 동일상품 수 · 판매중 수 · 확인 가격 ·
       *    가격 확인 필요 여부를 **먼저** 이해할 수 있는가」.
       * 🟢 그래서 블록 **안쪽** 은 한 글자도 새로 계산하지 않는다 — `buildPriceGuide` 가
       *    이미 내는 시장별 수치를 그 자리로 **옮긴** 것이다(집계 0 · 판정 0 · 환산 0).
       */}
      <div data-testid="market-blocks" className="mt-2 grid gap-2 md:grid-cols-2">
        {(["KR", "OVERSEAS"] as const).map((mk) => (
          <MarketBlock key={mk} market={mk} judgement={judgement} rows={rows} />
        ))}
      </div>
      {/**
       * 🔴🔴 **두 블록 어디에도 안 들어간 후보를 조용히 없애지 않는다.**
       *    실측(B226AC010 · `beaumonde.co.kr`): 사람이 SAME 이라 한 `.kr` 후보가
       *    **가격이 없어서** 시장 축 `UNKNOWN` 으로 남는다 ⟹ 그 상태로 두면 🇰🇷 블록이
       *    「후보를 찾지 못했습니다」라고 **거짓** 을 말한다.
       * 🔴 시장을 **지어내지 않는다**(UNKNOWN → KR 승격 금지 · WU-020 §4 유지).
       */}
      {unresolvedNote && (
        <p data-testid="market-unresolved" className="mt-1 text-[11px] text-text-tertiary">
          {unresolvedNote}
        </p>
      )}

      {/**
       * 🔴🔴 WU-136 §A — **「팔아도 되는가」 한 줄.** 🔴 WU-140 에서 이 구간이 시장 블록
       *    «뒤» 로 내려왔다(CPO 확정). 🟢 **testid 는 전부 그대로** 다 —
       *    `market-verdict` · `market-sale-counts` · `market-split` ·
       *    `market-price-range` · `market-seller-table` 을 계약이 보고 있고,
       *    이름을 바꾸면 그 계약들이 **조용히** 통과해 버린다.
       * 🔴 네 결론을 **다른 문장** 으로 적는다 — 「없다」로 뭉치면 셀러가 할 행동이
       *    달라지는데 화면이 같은 말을 한다(§G).
       */}
      <div data-testid="market-judgement" className="mt-3 space-y-1">
        <p className="text-[11px] font-medium text-text-secondary">{MARKET_RESULT_HEADING}</p>
        <p data-testid="market-verdict" className="text-[12px] font-medium text-text-primary">
          {MARKET_VERDICT_TEXT[judgement.verdict]}
        </p>
        {judgement.sellers.length > 0 && (
          <>
            {/**
             * 🔴🔴 「판매중 N곳」은 **ON_SALE 만** 센 숫자다. 미확인·품절을 **같은 줄에**
             *    적어 그 분모를 숨기지 않는다 — 실측(호스트 9)에서 **7곳이 재고 칸을
             *    공개하지 않아** 미확인이고, 그것을 판매중에 넣으면 거짓이 된다.
             */}
            <p data-testid="market-sale-counts" className="text-[11px] text-text-secondary">
              {onSaleCountNote(judgement)}
            </p>
            {/**
             * 🔴🔴 CPO §3 — **「시장 전체 판매처」로 읽히게 두지 않는다.**
             *    수식어 없는 「🇰🇷 0곳 · 🌎 3곳」은 시장 전체 집계로 읽힌다. 🔴 그런데
             *    판매여부 신호는 현재 **Shopify 경로에서만** 확정되므로(실측 2/9) 이
             *    숫자는 **시장을 대표하지 않는다** — 「발견된 SAME 후보 중 판매중으로
             *    확인된 곳」이다. 🟢 그래서 접두사를 붙여 그 범위를 직접 말한다.
             */}
            {judgement.onSaleCount > 0 && (
              <p data-testid="market-split" className="text-[11px] text-text-secondary">
                {ON_SALE_SPLIT_PREFIX} — {MARKET_LABEL.KR} {judgement.domesticOnSale}곳 ·{" "}
                {MARKET_LABEL.OVERSEAS} {judgement.overseasOnSale}곳
              </p>
            )}
            {/* 🔴 통화별로만 · **환산 0**(기존 `overseas-reference` 계약과 같은 축). */}
            {judgement.byCurrency.length > 0 && (
              <ul data-testid="market-price-range" className="space-y-0.5">
                {judgement.byCurrency.map((r) => (
                  <li key={r.currency} className="text-[11px] text-text-secondary">
                    <span className="font-medium">{priceRangeText(r)}</span>{" "}
                    <span className="text-text-tertiary">({priceRangeScope(r)})</span>
                  </li>
                ))}
              </ul>
            )}
            {/**
             * ══════════════════════════════════════════════════════════════════
             * 🔴🔴🔴 WU-145 ② — **「판매가격 판단」 한 줄** (CPO STEP 2/4)
             * ══════════════════════════════════════════════════════════════════
             *
             * 🔴 **추천 판매가가 아니다.** 원가·수수료·마진이 없으므로(§00-B 가격 보류)
             *    「판매가는 ₩XX 로 하세요」를 **계산하지 않는다** — 지어내면 셀러가 그
             *    숫자로 실제 가격을 정한다. 이 줄이 하는 일은 **위 숫자의 «해석»** 이다.
             * 🔴🔴 **가격이 하나라도 확인됐을 때만 쓴다.** `byCurrency` 가 비었는데 이
             *    문장을 적으면 「기준이 있다」는 **거짓** 이 된다(그 조건이 이 자리다).
             * 🟢 그래서 `market-price-range` **바로 뒤** 다 — 해석은 근거 뒤에 온다.
             */}
            {judgement.byCurrency.length > 0 && (
              <p
                data-testid="market-price-judgement"
                className="text-[11px] font-medium text-text-secondary"
              >
                {MARKET_PRICE_JUDGEMENT_NOTE}
              </p>
            )}
            {/**
             * 🔴 WU-136 §C — **셀러가 읽는 네 칸.** 도메인·판매상태·현재가격까지
             *    한 줄에 있어야 「어디서 얼마에」가 한눈에 보인다.
             * 🔴 정렬은 **판매중 → 미확인 → 품절** 이다(술어가 그 순서를 들고 있다).
             */}
            <table data-testid="market-seller-table" className="mt-1 w-full text-[11px]">
              <thead>
                <tr className="text-text-tertiary">
                  {MARKET_TABLE_HEADERS.map((h) => (
                    <th key={h} className="py-0.5 text-left font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {judgement.sellers.map((s) => (
                  <tr key={s.row.discoveredUrl} data-testid="market-seller-row" className="align-top">
                    <td className="py-0.5 pr-2 whitespace-nowrap">{MARKET_LABEL[s.market]}</td>
                    <td className="py-0.5 pr-2">
                      <a
                        href={s.row.discoveredUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-text-secondary underline"
                      >
                        {s.row.domain}
                      </a>
                    </td>
                    <td
                      data-testid="market-seller-sale"
                      className="py-0.5 pr-2 whitespace-nowrap text-text-secondary"
                    >
                      {SALE_STATE_TEXT[s.sale]}
                    </td>
                    {/* 🔴 가격을 **지어내지 않는다** — 확인 못 했으면 그렇게 적는다. */}
                    <td
                      data-testid="market-seller-price"
                      className="py-0.5 whitespace-nowrap text-text-secondary"
                    >
                      {/**
                       * 🔴🔴 WU-139 — **가격을 못 가져온 후보를 «버리지 않는다»**(CPO 전략).
                       *    전까지는 「가격 확인 필요」라는 **글자** 였다. 🟢 이제 그 자리가
                       *    **판매처로 가는 링크** 다 — 셀러가 직접 확인할 수 있어야 그
                       *    후보가 실제 가치를 낸다. 🔴 가격을 **지어내지 않는다.**
                       */}
                      {s.price ? (
                        `${s.price.currency} ${s.price.amount}`
                      ) : (
                        <a
                          data-testid="market-seller-price-link"
                          href={s.row.discoveredUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline"
                        >
                          {PRICE_LINK_TEXT}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/**
       * 🔴🔴🔴 WU-133 — **「비었다」로 끝내지 않는다.**
       *
       * 전수 추적(human SAME 13건)이 측정한 것: 판정까지 간 7건이 **전부 보류/충돌** 이고
       * 그중 **6건은 가격까지 확보** 돼 있다. 🔴 그런데 WU-132 의 화면은 「동일상품으로
       * 판정되고 가격까지 확인된 후보가 아직 없습니다」만 말했다 — **그 아래에 그 6건이
       * 서 있는데** 말이다. 셀러에게는 「아무것도 못 찾았다」로 읽히고 그것은 **거짓** 이다.
       *
       * 🟢 그래서 **이미 계산된 보류 사유를 세어** 한 줄 적는다(집계 0 · 판정 0 · 완화 0).
       * 🔴 「동일상품이다」라고 **단정하지 않는다** — 「판정이 보류됐다」가 정확한 말이고
       *    판단은 셀러가 아래 검토 구역에서 사진으로 한다.
       */}
      {pending && (
        <p data-testid="mi-same-pending" className="mt-1 text-[11px] text-warning">
          {pending}
        </p>
      )}

      {/**
       * 🔴🔴🔴 WU-136 §E — **기술/참고 정보는 «지우지 않고» 접는다.**
       *
       * 🔴 CPO: 「정보를 삭제하는 것이 아니라 셀러의 시야에서 치우는 것」.
       *    그래서 ⒜ 두 시장의 참고가격 집계 ⒝ SAME 행 목록 ⒞ 제외 사유 목록이
       *    **한 글자도 사라지지 않았다** — 접힘 뒤로 옮겼을 뿐이다.
       * 🟢 그래서 `wu-056r1`(가격 구역 식별)과 `wu-132` 계약의 DOM 단언이 **그대로
       *    유효** 하다(React 는 `details` 가 닫혀 있어도 자식을 렌더한다).
       * 🔴 **`open` 을 붙이지 않는다** — 붙이면 셀러 시야에 다시 들어오고, 그것이
       *    2026-09-19 사고의 기전이다(WU-091 ① 과 같은 계약).
       */}
      <details data-testid="mi-detail-fold" className="mt-2">
        <summary className="cursor-pointer text-[11px] text-text-tertiary">
          ▸ {MI_DETAIL_FOLD_LABEL}
        </summary>
        {/* 🔴 「유사상품은 비교에 쓰지 않는다」를 영역이 **직접** 말한다(②의 절반). */}
        <p className="mt-1 text-[11px] text-text-tertiary">{MI_SAME_AREA_SCOPE}</p>
        {/**
         * 🔴🔴🔴 WU-145 ① — **1차에서 내려온 보류 사유 분포.** 「지우지 않는다」의 구현부다.
         *
         * 🔴 CPO: 「그 문장을 `▸ 판단 근거` 안으로 **옮긴다** · **지우지 않는다**(MI
         *    추적용이다)」. ⟹ 🟢 **한 건도 줄이지 않았다** — 정렬·건수·어휘 전부 그대로다.
         * 🔴 1차에 남은 것은 **건수 한 줄**(`mi-same-pending`)이고, 축의 **이름**
         *    (브랜드 미확인 · 품번 충돌 …)은 **이 접힘 안에서만** 보인다.
         * 🔴 사유가 없으면 **줄을 만들지 않는다** — 그 함수가 `null` 을 낸다(없는 말 금지).
         */}
        {pendingReasons && (
          <p data-testid="mi-same-pending-reasons" className="mt-1 text-[11px] text-text-tertiary">
            {pendingReasons}
          </p>
        )}
        {/* 🔴 국내를 해외 «앞» 에 둔다 — 셀러의 질문 순서가 그렇다(WU-056 과 같은 이유). */}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
        <MarketColumn
          testId="mi-same-domestic"
          heading={MI_SAME_DOMESTIC_HEADING}
          selection={domestic}
          reference={domesticReference}
          referenceProps={{
            title: DOMESTIC_REFERENCE_TITLE,
            note: DOMESTIC_REFERENCE_NOTE,
            scope: DOMESTIC_REFERENCE_SCOPE,
            icon: "🇰🇷",
            testId: "domestic-reference",
            amountTestId: "domestic-lowest",
          }}
        />
        <MarketColumn
          testId="mi-same-overseas"
          heading={MI_SAME_OVERSEAS_HEADING}
          selection={overseas}
          reference={overseasReference}
          /** 🔴 해외 블록의 제목·문구·🧾 아이콘은 **기본값 그대로** 다(`wu-056r1` 계약). */
          referenceProps={{}}
        />
        </div>
      </details>
    </section>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-140 ②③ — **한 시장의 결론 블록** (셀러가 «가장 먼저» 읽는 칸)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 요구한 것은 **네 상태를 셀러가 구분할 수 있는 것** 이다:
 * ```
 * ⒜ 검색 자체가 안 됨          후보 0            → 「후보를 찾지 못했습니다」
 * ⒝ SAME 판정 대기·보류         후보 N · SAME 0   → 「N곳 찾았지만 …」 (+ 사유)
 * ⒞ SAME 이지만 가격 확인 필요   → 건수 줄 + 🔗(판매처 표의 링크)
 * ⒟ 가격 확인 완료             → 기준가 + SINGLE/RANGE 문장
 * ```
 * 🔴🔴 전까지 ⒜ 와 ⒝ 가 화면에서 **같은 빈 칸** 이었다 — 셀러가 할 행동이 전혀 다른데
 *    (앞은 기다리는 것, 뒤는 **사진으로 직접 판단하는 것**) 화면이 같은 말을 했다.
 *
 * 🔴 **빈 틀을 만들지 않는다** — `sameCount === 0` 이면 가격 가이드(`price-guide-*`)를
 *    **렌더하지 않는다**(기존 계약 `wu-139 C-4`). 그 자리에 들어가는 것은 **기준가가
 *    아니라 이유** 다. 🔴 기준가를 **지어내지 않는다.**
 * 🔴 통화 **환산 0** · 추천 판매가 **계산 0**(§00-B 가격 보류).
 */
function MarketBlock({
  market,
  judgement,
  rows,
}: {
  market: "KR" | "OVERSEAS";
  judgement: MarketJudgement;
  rows?: readonly GeminiTransientRow[] | null;
}): JSX.Element {
  const g = buildPriceGuide(judgement, market);
  const head = priceGuideHeadline(g);
  const suffix = market === "KR" ? "domestic" : "overseas";
  return (
    <div
      data-testid={`market-block-${suffix}`}
      className="rounded border border-border/60 p-2"
    >
      {/* 🟢 라벨 owner 는 `MARKET_LABEL` 하나다 — 두 벌로 적지 않는다. */}
      <p className="text-[11px] font-medium text-text-primary">{MARKET_LABEL[market]}</p>
      {g.sameCount === 0 ? (
        /**
         * 🔴 ⒜ ↔ ⒝ 를 **가른다.** 🔴 「이 시장에 동일상품이 없다」로 적지 않는다 —
         *    부재와 미발견은 다르다(WU-091 어휘 계약).
         */
        <p data-testid={`market-empty-${suffix}`} className="text-[11px] text-text-tertiary">
          {marketEmptyNote(countMarketCandidates(rows, market), countPendingCandidates(rows, market))}
        </p>
      ) : (
        <div data-testid={`price-guide-${suffix}`}>
          <p className="text-[11px] font-medium text-text-secondary">{PRICE_GUIDE_TITLE[market]}</p>
          {/* 🟢 ⒞ 와 ⒟ 를 가르는 건수 줄 — 「동일상품 확인」과 「가격 확인」을 따로 적는다. */}
          <p data-testid="price-guide-counts" className="text-[11px] text-text-secondary">
            {priceGuideCountNote(g)}
          </p>
          {head ? (
            <>
              <p data-testid="price-guide-headline" className="text-[12px] font-medium text-text-primary">
                {head}
              </p>
              {/* 🔴 표본이 하나면 그 사실을 **문장으로** 말한다(1건 ≠ 시장 평균). */}
              <p data-testid="price-guide-note" className="text-[11px] text-text-tertiary">
                {g.basis === "SINGLE" ? PRICE_GUIDE_SINGLE_NOTE : PRICE_GUIDE_RANGE_NOTE}
              </p>
            </>
          ) : (
            <p data-testid="price-guide-empty" className="text-[11px] text-text-tertiary">
              {PRICE_GUIDE_EMPTY}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 한 시장(국내 ↔ 해외)의 칸.
 *
 * 🔴 두 시장이 **같은 컴포넌트** 를 쓴다 — 두 벌이 되면 한쪽만 고치는 날이 온다
 *    (`match-display.ts` 가 라벨을 하나로 모은 그 이유).
 */
function MarketColumn({
  testId,
  heading,
  selection,
  reference,
  referenceProps,
}: {
  testId: string;
  heading: string;
  selection: MiSameSelection;
  reference?: OverseasPriceSummary | null;
  referenceProps: {
    title?: string;
    note?: string;
    scope?: string;
    icon?: string;
    testId?: string;
    amountTestId?: string;
  };
}): JSX.Element {
  return (
    <div data-testid={testId} className="space-y-2">
      <p className="text-[11px] font-medium text-text-primary">{heading}</p>
      {/* 🟢 MI 가 이미 낸 집계. 🔴 환산 0 · 통화별로만(그 성질은 그 컴포넌트의 계약이다). */}
      <OverseasReferencePrice summary={reference} {...referenceProps} />
      {selection.priced.length === 0 ? (
        /** 🔴 「동일상품이 없다」로 적지 않는다 — 부재와 미발견은 다르다. */
        <p data-testid="mi-same-empty" className="text-[11px] text-text-tertiary">
          {MI_SAME_EMPTY}
        </p>
      ) : (
        <ul className="space-y-1">
          {selection.priced.map((row) => (
            <li
              key={row.discoveredUrl}
              data-testid="mi-same-row"
              className="rounded border border-border/60 p-2"
            >
              {row.title && <p className="truncate text-[11px] text-text-primary">{row.title}</p>}
              <div className="flex items-baseline justify-between gap-2">
                <a
                  href={row.discoveredUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-[11px] text-text-tertiary underline"
                >
                  {row.domain}
                </a>
                {/* 🔴 통화 그대로 · 환산 없음(그 함수가 owner 다). */}
                <span data-testid="mi-same-price" className="shrink-0 text-[11px] font-medium text-text-secondary">
                  {priceText(row)}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary">{stockText(row.soldOut)}</p>
            </li>
          ))}
        </ul>
      )}
      {/**
       * 🔴🔴 **「동일상품인데 빠진 것」을 조용히 버리지 않는다.**
       *    「동일상품이 없다」와 「동일상품인데 지금 가격을 확인하지 못했다」는 셀러가
       *    해야 할 행동이 **다르다**(앞은 기다리는 것, 뒤는 그 링크를 직접 보는 것).
       */}
      {selection.sameButExcluded.length > 0 && (
        <ul data-testid="mi-same-excluded" className="space-y-0.5">
          {selection.sameButExcluded.map(({ row, reason }) => (
            <li key={row.discoveredUrl} className="text-[11px] text-text-tertiary">
              {row.domain} — {MI_SAME_EXCLUSION_TEXT[reason]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
