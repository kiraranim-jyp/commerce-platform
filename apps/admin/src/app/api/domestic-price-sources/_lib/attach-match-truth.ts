import {
  compareModelCode,
  confirmBrandCodeInTitle,
  deriveMatchTruth,
  fetchDomesticModelCode,
  isColorUnverified,
  isSelfReferenceCandidate,
  supportsDomesticIdentifierExtraction,
  type ComparisonCandidate,
  type ComparisonSearchResult,
} from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02 후속(CPO 지시, 2026-10-11) — **이 함수는 `search/route.ts` 안에
 * 있었다. 로직은 한 줄도 바뀌지 않았다 — 자리만 옮겼다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 옮겼는가. MI-P0-02 측정에서 Identity 를 `crossSellerVerdict` 로 쟀다가
 *    틀렸다. 그 값은 **최종 판정이 아니라 `deriveMatchTruth` 의 입력 하나** 다.
 *    운영의 최종 판정은 아래가 내는 `matchTruth` 이고, 그것이 `route.ts` 안의
 *    비공개 함수라 **하니스가 운영 판정을 부를 방법이 없었다.** 그래서 측정이
 *    입력을 결과로 보고했다.
 *
 * 🔴 하니스가 이 합성을 «다시 구현하면» expected 와 actual 을 같은 손으로 만드는
 *    circular test 가 된다(MI-P0-02 금지 ⑥ — 실제로 한 번 걸렸다). 그래서
 *    재구현하지 않고 **이 파일을 부른다.**
 *
 * 🔴 `_lib` 에 둔 이유: Next.js App Router 의 `route.ts` 는 HTTP 메서드 외의
 *    export 를 허용하지 않는다. 이 저장소가 이미 쓰는 `_lib/` 패턴을 따른다.
 *
 * ── 아래는 옮겨 온 원문 주석이다 ────────────────────────────────────────────
 *
 * MI-DISCOVERY-P5.2(CPO 지시, 2026-10-07) — **실시간 검색 화면과 저장 파이프라인이
 * 서로 다른 상품 진실 판정 기준을 가지면 안 된다.**
 *
 * decision.ts 맨 위의 P-7-C 원칙이 바로 그것인데, 이 라우트는 `deriveMatchTruth` 를
 * **인자 셋** 으로만 불렀다. 그래서 그 뒤에 추가된 보호장치들이 화면에서 발화하지
 * 않았다(실측 확인, 2026-10-07):
 *
 *   blockers   미전달 → MI-3/P0-1 「같은 판매처가 둘로 진열」 보류가 사라진다
 *   conflicts  미전달 → P4 변경 B 「같은 모델·색상만 다름」 이 CONFLICT 로 남는다
 *
 * 🔴 CEO 가 색상 변형을 눈으로 가르는 자리가 이 화면이다. 여기서 발화하지 않으면
 *    「화면에서 확인한다」가 성립하지 않는다.
 * 🔴 새 판정 로직이 아니다 — 저장 경로가 이미 넘기고 있는 값을 같이 넘기는 것뿐이다.
 */

/** P-28 — 상위 N개까지만 실제 추출 시도(비용 제한). */
export const MAX_MODEL_CODE_FETCH_PER_SHOP = 3;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02b(2026-10-11 실측) — **자기참조를 「국내 동일상품」으로 내보내지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 저장 파이프라인은 이미 이것을 걸러 왔다
 * (`run-domestic-price-check.ts:630` — 같은 `isSelfReferenceCandidate`).
 * **실시간 검색 라우트에만 그 가드가 없었다.** 그래서 두 경로가 갈렸고, 그것은
 * `search/route.ts` 머리 주석이 「실시간 검색 화면과 저장 파이프라인이 서로 다른
 * 상품 진실 판정 기준을 가지면 안 된다」고 적어 둔 바로 그 원칙 위반이다.
 *
 * 실측(2026-10-11): 원상품이 `bobochoses.com/products/b226ac114-…` 일 때 국내
 * 검색이 **같은 URL**(쿼리파라미터만 다름)을 2건 돌려주고, 품번이 글자까지 같으니
 * `attachMatchTruth` 가 그것을 `EXACT_IDENTIFIER` 로 올린다. 결과:
 *
 *     셀러 화면   자기가 사 온 그 페이지를 「국내 동일상품 168,000원」으로 본다
 *     KPI        그 2건이 분모·분자에 들어가 「확보율 100%」라는 거짓 숫자가 된다
 *                (MI-P0-02b 측정에서 실제로 그렇게 나왔다)
 *
 * 🔴 **threshold 를 건드리지 않는다.** 판정 기준은 한 글자도 바뀌지 않는다 —
 *    「외부 판매처를 찾았다」가 아닌 것을 후보에서 빼는 것뿐이다.
 * 🔴 **조용히 버리지 않는다.** 뺀 건수를 돌려줘 호출부가 로그에 남긴다.
 * 🔴 **`status` 를 바꾸지 않는다.** 후보가 전부 자기참조여서 0건이 되는 것은
 *    `ok` + 0건이다 — 「검색을 못 했다」가 아니다.
 */
export function excludeSelfReference(
  results: ComparisonSearchResult[],
  sourceUrl: string | undefined,
): { results: ComparisonSearchResult[]; excluded: number } {
  const before = results.reduce((n, r) => n + r.candidates.length, 0);
  const filtered = results.map((r) =>
    r.status === "ok"
      ? { ...r, candidates: r.candidates.filter((c) => !isSelfReferenceCandidate(sourceUrl, c.url)) }
      : r,
  );
  const after = filtered.reduce((n, r) => n + r.candidates.length, 0);
  return { results: filtered, excluded: before - after };
}

export async function attachMatchTruth(
  results: ComparisonSearchResult[],
  foreignModelCode: string | null,
  foreignColor: string | null,
): Promise<ComparisonSearchResult[]> {
  /** 저장 경로(selectDomesticCandidate)와 «같은 순서» 로 품번을 정한다 — 제목에서
   *  확인되면 그것, 아니면 도메인 추출기. 두 경로가 다른 품번을 쓰면 화면과 DB가
   *  갈린다. */
  const truthOf = (c: ComparisonCandidate, domesticModelCode: string | null) =>
    deriveMatchTruth(
      c.matchLevel!,
      compareModelCode(foreignModelCode, domesticModelCode),
      c.crossSellerVerdict,
      c.crossSellerBlockers,
      c.crossSellerConflicts,
      isColorUnverified(foreignColor, c.facts?.colorText),
    );

  return Promise.all(
    results.map(async (result) => {
      if (result.status !== "ok" || result.candidates.length === 0) return result;
      // 🔴 P5.2 Step 1 — 제목 확인은 HTTP 가 없으므로 추출기 등록 여부와 무관하게
      //    모든 도메인에서 먼저 시도한다. 확인되지 않으면 예전과 똑같이 null 이고,
      //    deriveMatchTruth 가 이를 정직하게 TEXT_CONFIRMED/SIMILAR 로 처리한다 —
      //    "식별자가 없다"를 "다른 상품이다"로 지어내지 않는다.
      if (!supportsDomesticIdentifierExtraction(result.domain)) {
        const candidates = result.candidates.map((c) => ({
          ...c,
          matchTruth: c.matchLevel ? truthOf(c, confirmBrandCodeInTitle(foreignModelCode, c.title)) : undefined,
        }));
        return { ...result, candidates };
      }
      // 상위 N개까지만 실제 추출 시도(비용 제한, run-domestic-price-check.ts의
      // MAX_EVIDENCE_CANDIDATES와 같은 원칙) — 나머지는 modelCode 비교 없이 텍스트
      // 등급만으로 matchTruth를 매긴다(추측 금지 — 추출 안 한 건 "확인 안 함"이지
      // "충돌"이 아니다).
      const candidates = await Promise.all(
        result.candidates.map(async (c, i) => {
          if (!c.matchLevel) return c;
          const confirmed = confirmBrandCodeInTitle(foreignModelCode, c.title);
          const domesticModelCode =
            confirmed ??
            (i < MAX_MODEL_CODE_FETCH_PER_SHOP ? await fetchDomesticModelCode(result.domain, c.url) : null);
          return { ...c, matchTruth: truthOf(c, domesticModelCode) };
        }),
      );
      return { ...result, candidates };
    }),
  );
}

/**
 * 원본 URL 자체에서 모델코드를 뽑는다 — 설명문에 코드 표기가 없는 자사몰용
 * 폴백이다. 국내 후보에 쓰는 레지스트리를 그대로 재사용하므로, 지원 도메인이
 * 늘어나면 이 경로도 함께 늘어난다(도메인 분기를 여기에 만들지 않는다).
 *
 * 🔴 `route.ts` 에서 그대로 옮겨 왔다 — `foreignModelCode` 를 정하는 두 갈래 중
 *    하나이고, 하니스가 운영과 «같은» 품번을 써야 하므로 같이 공개한다.
 */
export async function extractModelCodeFromSourceUrl(sourceUrl: string | undefined): Promise<string | null> {
  if (!sourceUrl) return null;
  let domain: string;
  try {
    domain = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!supportsDomesticIdentifierExtraction(domain)) return null;
  return fetchDomesticModelCode(domain, sourceUrl).catch(() => null);
}
