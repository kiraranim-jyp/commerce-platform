import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { computeMarketAlert, type AlertCategory } from "@commerce/pricing";
import { resolveMarketCategoryScopes } from "../../domestic-price-sources/_lib/category-scope";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { computeMarketIntelligence } from "../_lib/market-intelligence";
import { openAlertIfNotActive, resolveAlertsNotIn } from "../_lib/price-alerts";
import {
  MAX_SUPPLIED_CANDIDATE_URLS,
  runDomesticPriceCheck,
  type GeminiTransientEvidence,
} from "../_lib/run-domestic-price-check";
import { runPriceCheck } from "../_lib/run-price-check";
/** 🔴 WU-131 — 후보 «이력» 의 생산자. `domestic_product_links` 와 **다른 표** 다. */
/** 🔴 WU-132 ⑥ — 그 이력을 **다음 조회의 입력으로** 되돌리는 읽기 경로. */
import {
  listReviewedSameUrls,
  listSnapshotVerifiedSameKeys,
  recordSeenCandidates,
} from "../_lib/candidate-review";

/**
 * 🔴 요청 payload 경계 — 상한(`MAX_SUPPLIED_CANDIDATE_URLS`)보다 넉넉하게 받되
 *    무한히 받지 않는다. 초과분은 pool 이 `notFetchedOverLimit` 으로 **보고** 한다
 *    (조용히 버리지 않는다). 🔴 URL 길이도 막는다 — 로그/메모리 폭주 방지.
 */
const MAX_CANDIDATE_URL_PAYLOAD = MAX_SUPPLIED_CANDIDATE_URLS * 5;
const MAX_CANDIDATE_URL_LENGTH = 2048;

/**
 * N-4.01 Part I(대표님 지시) — 수동 "지금 확인" 트리거. daily cron
 * (/api/cron/daily-price-check)과 같은 runPriceCheck()를 그대로 호출한다.
 *
 * N-4.07 2차 — 국내 편집샵 동일상품 매칭+가격 관측(runDomesticPriceCheck)도 같이
 * 실행한다. 국내 파이프라인 실패가 해외 원가/네이버 결과를 지우면 안 되므로
 * try/catch로 격리하고, 실패해도 원래 result에 domesticShop 필드만 에러로
 * 채워서 반환한다(전체 실패로 만들지 않는다 — PART U 원칙과 동일).
 */
export async function POST(request: Request) {
  // BETA-SECURITY-2 §11/§12 — 크롤러와 외부 API를 돌리는 경로다. 인증과
  // 소유권 검사가 없으면 남의 스냅샷으로 비용을 발생시킬 수 있다.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { snapshotId?: string; candidateUrls?: unknown }
    | null;
  const snapshotId = body?.snapshotId;
  if (!snapshotId) {
    return NextResponse.json({ ok: false, error: "snapshotId가 필요합니다." }, { status: 400 });
  }

  /**
   * 🔴🔴 WU-024 — **Registry 밖 후보 URL 의 공급 진입점.**
   *
   * 🔴 여기서 하는 것은 **모양 검사뿐** 이다. 「공개 호스트인가 · 상품 페이지인가 ·
   *    자기참조인가 · 중복인가」는 `collectUrlCandidatePool` 의 입력 경계가 판단하고
   *    **이유까지 남긴다**(두 곳에서 같은 판단을 하면 갈라진다).
   * 🔴 상한 상수는 `run-domestic-price-check` 가 소유한다 — 이 라우트가 **그 값을
   *    import** 한다(두 곳이 다른 상한을 갖지 않는다).
   * 🔴 저장되지 않는다 — 이 URL 은 `domestic_product_links` 에도 등록부에도 가지 않는다.
   */
  let candidateUrls: string[] | undefined;
  if (body?.candidateUrls !== undefined) {
    if (!Array.isArray(body.candidateUrls)) {
      return NextResponse.json({ ok: false, error: "candidateUrls는 배열이어야 합니다." }, { status: 400 });
    }
    /** 🔴 요청 자체의 크기를 막는다(상한 자체는 아래 pool 이 적용하고 초과분을 «보고» 한다). */
    if (body.candidateUrls.length > MAX_CANDIDATE_URL_PAYLOAD) {
      return NextResponse.json(
        { ok: false, error: `candidateUrls는 최대 ${MAX_CANDIDATE_URL_PAYLOAD}개까지 보낼 수 있습니다.` },
        { status: 400 },
      );
    }
    candidateUrls = body.candidateUrls
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && u.length <= MAX_CANDIDATE_URL_LENGTH);
  }

  const snapshot = await getSnapshot(snapshotId, auth.user.workspaceId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 WU-132 ⑥ — **이전에 「동일상품」으로 판단한 후보를 다시 넣는다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * WU-118 이 측정한 공백이 이것이다 — 사람이 SAME 이라 한 URL 은 재투입하면
   * **19/19 가 후보로 살아남는데** 운영에 **되돌려 넣는 경로가 0** 이었다. 그래서
   * 매번 검색부터 시작하고, 같은 질문(「왜 또 못 찾나」)이 반복됐다.
   *
   * 🔴 `SAME` **만** 고른다(과거 DIFFERENT 자동 편입 금지 · CPO 명시).
   * 🔴 사람 판단을 MI 판정으로 **쓰지 않는다** — 넘기는 것은 **URL 뿐** 이고
   *    SAME/DIFFERENT 는 기존 판정기가 페이지를 열어 **처음부터 다시** 낸다.
   * 🔴 실패해도 가격확인을 멈추지 않는다(알림·이력과 같은 격리 원칙).
   * 🔴 상한은 붙여넣기 경로와 **같은 상수** 다 — 재투입이 fetch 비용이기 때문이다.
   */
  let reviewedSameUrls: string[] = [];
  try {
    const dnaForReuse = buildProductIdentityDna(product);
    reviewedSameUrls = await listReviewedSameUrls({
      snapshotId,
      originCode: dnaForReuse.brandModelCode ? dnaForReuse.brandModelCode.toUpperCase() : null,
      workspaceId: auth.user.workspaceId,
      limit: MAX_SUPPLIED_CANDIDATE_URLS,
    });
  } catch {
    /* 🔴 이력 조회 실패가 가격확인 자체를 깨뜨리지 않는다. */
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 CORE-2AA — **가격 자격 입력.** 위 재투입과 «범위가 다른» 별개 질의다
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **CPO 가 범위를 고정했다**(2026-10-25) — 「스냅샷 + 후보 URL 한정 ·
   *    URL 전역 SAME 으로 만들지 않습니다」. 그래서 `originCode` 를 **넘기지 않는다**
   *    (위 재투입은 넘긴다 — 그쪽 위험은 fetch 비용뿐이다).
   * 🔴 실패해도 가격확인을 멈추지 않는다 — 빈 집합이면 **오늘 동작 그대로** 다.
   * 🔴 verdict 문자열은 이 라우트로 **올라오지 않는다**(리더가 URL 키만 돌려준다).
   */
  let verifiedSameKeys: string[] = [];
  try {
    verifiedSameKeys = await listSnapshotVerifiedSameKeys({
      snapshotId,
      workspaceId: auth.user.workspaceId,
    });
  } catch {
    /* 🔴 자격 조회 실패는 «감점» 이 아니다 — 자동 tier 그대로 간다. */
  }

  const result = await runPriceCheck({
    snapshotId,
    sourceUrl: product.sourceUrl,
    originalPriceAmount: product.price.value.amount,
    originalCurrency: product.price.value.currency,
  });

  let domesticShop;
  try {
    domesticShop = await runDomesticPriceCheck({
      snapshotId,
      // GLOBAL-MARKET ③-2 — 이 판매자가 켜 둔 편집샵만 검색한다.
      workspaceId: auth.user.workspaceId,
      dna: buildProductIdentityDna(product),
      description: product.description.value || undefined,
      // TTAEJYO 2.0 — 이 상품 카테고리에 맞는 편집샵만 뒤진다. 스냅샷을 통째로
      // 갖고 있는 경로라 breadcrumb/권장연령까지 근거로 쓸 수 있다(검색 라우트는
      // 그 둘이 없어 더 자주 null이 된다 — 판정 함수는 둘이 같은 것을 쓴다).
      //
      // MARKET-CATEGORY-1(CEO 확정, 2026-09-15) — 셀러가 상품 검색 시작 시 고른
      // 카테고리가 스냅샷에 남아 있으면 그것이 이긴다. "지금 확인"이 첫 조사와
      // **같은 사이트 집합**을 뒤지게 하는 자리다 — 여기가 자동 추정으로 되돌아가면
      // 같은 상품의 1차 조사와 재확인이 서로 다른 곳을 뒤진 결과를 나란히 보여준다.
      categoryScopes: resolveMarketCategoryScopes(product, snapshot.workspace.marketCategoryProfileId),
      /** 🔴 WU-024 — 안 보내면 `undefined` 이고 그 경로는 **한 줄도 돌지 않는다**(기존 동작). */
      candidateUrls,
      /** 🔴 WU-132 ⑥ — 비어 있으면 그 경로도 **한 줄도 돌지 않는다**(기존 동작 유지). */
      reviewedSameUrls: reviewedSameUrls.length > 0 ? reviewedSameUrls : undefined,
      /**
       * 🔴🔴 CORE-2AA — **가격 자격만** 넘긴다(발견 입력과 다른 칸 · 다른 범위).
       *    비어 있으면 `priceTierFromLink` 산출 그대로다 ⟹ 기존 국내 수집 결과 불변.
       */
      verifiedSameUrlKeys: verifiedSameKeys.length > 0 ? verifiedSameKeys : undefined,
      /**
       * 🔴🔴 CORE-2R-4 STEP 2 — **여기서만 켠다.** 셀러가 「지금 확인 / 🔄 다시 분석」을
       *    누른 경로다. 🔴 일괄 cron(`trigger-domestic-price-check`)은 **켜지 않는다** —
       *    그쪽은 전 상품을 매일 돌아 사이트당 HTTP 가 상품 수만큼 곱해진다.
       */
      domesticListingHop: true,
    });
  } catch (error) {
    domesticShop = {
      linksCreatedOrUpdated: 0,
      pricesRecorded: 0,
      sourceErrors: [error instanceof Error ? error.message : "국내 가격비교 확인 실패"],
    };
  }

  // N-4.18-K STEP K-2/K-4/K-9(대표님 지시, 2026-08-26: "알림을 만들기 위해
  // 다시 전체 검색하지 않는다", "같은 상태가 유지되는 동안은 최초 1회만") —
  // 이 라우트(수동 "지금 확인" 또는 daily cron)가 실제로 가격을 재조회한
  // 시점에만 알림을 갱신한다. 새 검색을 추가로 하지 않고, 방금 계산한
  // computeMarketIntelligence()의 sellerAction/변화값을 그대로 재사용한다.
  // price_alerts 테이블이 아직 없으면(마이그레이션 039 미실행) openAlertIfNotActive/
  // resolveAlertsNotIn이 조용히 no-op이므로 이 블록이 실패해도 위 result는
  // 그대로 반환된다.
  /**
   * 🔴🔴 WU-049 — **MI 가 낸 해외 참고가격을 응답에 싣는다.**
   *
   * 지금까지 `intelligence` 는 `computeMarketAlert` 를 부르는 데만 쓰이고 **버려졌다**.
   * 그래서 MI 가 이미 계산한 `candidateOverseasPrice` 를 화면이 **영원히 볼 수 없었다**
   * (WU-049 추적: GET 경로는 transient 를 안 넘겨 항상 비어 있다).
   *
   * 🟢 **새로 계산하지 않는다** — 이미 만든 값을 한 칸 더 내보낼 뿐이다.
   * 🔴 국내 최저가·판매판정·등록 payload 는 한 글자도 건드리지 않는다.
   */
  let intelligence: Awaited<ReturnType<typeof computeMarketIntelligence>> = null;
  try {
    /* 🔴 MI-GEMINI-009 — 방금 돈 Gemini 판정 근거를 **런타임으로** 넘긴다.
     *    저장하지 않았으므로 DB 에서는 읽을 수 없다(§5). 🔴 아래 계산에 영향이
     *    없는 별도 칸으로만 실린다 — Gemini 가 기존 판정을 바꾸지 않는다. */
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔴🔴 WU-039 — **직접 공급한 URL 후보도 같은 자리로 넘긴다.**
     * ══════════════════════════════════════════════════════════════════════
     *
     * WU-024 가 transient 싱크를 **둘로 갈랐는데**(`geminiEvidence` ↔
     * `urlCandidateEvidence` — 화면이 「웹 검색」과 「직접 입력」을 구분해야 해서),
     * 여기서는 **`geminiEvidence` 만** 넘기고 있었다. 그래서 직접 입력한 후보는
     * SAME 이고 가격이 `VERIFIED_CURRENT` 여도 **가격비교에 영원히 들어가지
     * 못했다**(WU-038 실측: 입력 5 → MI SAME 4 → VERIFIED 3 → 가격비교 **0**).
     *
     * 🟢 **저장은 하지 않는다.** `market-intelligence.ts:239` 가 받는 것은
     *    런타임 배열이고 `price_observations`/`domestic_product_links` 에
     *    쓰지 않는다 — Registry 도 `source_id` FK 도 건드리지 않는다.
     * 🟢 **환산도 하지 않는다.** `market !== "KR"` 이면 해외 축(`overseasEvidence`)
     *    으로 가고 통화별로만 모인다(WU-020 §2).
     * 🟢 **미검증 가격은 들어가지 못한다.** `priceKrw` 는
     *    `priceStatus === "VERIFIED_CURRENT" && currency === "KRW"` 일 때만 채워지고
     *    (run-domestic-price-check.ts), null 이면 `droppedNoPrice` 로 빠진다.
     *
     * 🔴 **응답의 두 배열은 그대로 둔다** — 화면의 출처 구분(WU-028)을 깨지 않는다.
     *    합치는 것은 **MI 입력 한 곳** 뿐이다.
     */
    /**
     * 🔴🔴 WU-130 — **해외 자동검색 후보도 같은 자리로 넘긴다.**
     *
     * 그 후보들은 지금까지 화면(`/api/comparison/search`)에서만 살아서 MI 의 해외 금액
     * 집계(`candidateOverseasPrice`)에 **한 번도 들어가지 못했다** — 「🧾 해외 동일상품
     * 참고가격」이 셀러가 URL 을 붙여넣을 때만 채워진 이유다.
     *
     * 🟢 **저장 0 · 환산 0 · 새 계산 0** — 위 두 배열과 완전히 같은 성질이다
     *    (`market !== "KR"` 이면 해외 축으로 가고 통화별로만 모인다 · WU-020 §2).
     * 🔴 **응답의 세 배열은 그대로 둔다** — 화면의 출처 구분(WU-028)을 깨지 않는다.
     *    합치는 것은 **MI 입력 한 곳** 뿐이다.
     */
    /**
     * 🔴🔴 WU-132 — **재투입 후보도 같은 자리로 넘긴다.** 그러지 않으면 이전에
     *    동일상품으로 확인한 판매처의 가격이 집계에 **영원히 못 들어간다** —
     *    그것이 이 재투입의 목적이다. 🟢 저장 0 · 환산 0 · 새 계산 0(위 셋과 동일).
     */
    /**
     * 🔴🔴 CORE-2R-4 — **국내 목록 탐색 후보도 같은 자리로 넘긴다.** 그러지 않으면
     *    우리가 직접 찾아낸 국내 판매처의 가격이 집계에 **영원히 못 들어간다** —
     *    그것이 이 생산자의 목적이다. 🟢 저장 0 · 환산 0 · 새 계산 0(위 넷과 동일).
     */
    const transientEvidence =
      domesticShop.geminiEvidence ||
      domesticShop.urlCandidateEvidence ||
      domesticShop.overseasAutoEvidence ||
      domesticShop.reviewedSameEvidence ||
      domesticShop.domesticListingEvidence
        ? [
            ...(domesticShop.geminiEvidence ?? []),
            ...(domesticShop.urlCandidateEvidence ?? []),
            ...(domesticShop.overseasAutoEvidence ?? []),
            ...(domesticShop.reviewedSameEvidence ?? []),
            ...(domesticShop.domesticListingEvidence ?? []),
          ]
        : null;
    intelligence = await computeMarketIntelligence(
      snapshotId,
      auth.user.workspaceId,
      transientEvidence,
    );
    if (intelligence) {
      const alert = computeMarketAlert({
        sellerAction: intelligence.sellerAction,
        domesticChange: intelligence._alertInputs.domesticChange,
        originChange: intelligence._alertInputs.originChange,
      });
      const stillActive: AlertCategory[] = alert ? [alert.category] : [];
      if (alert) {
        await openAlertIfNotActive({
          snapshotId,
          category: alert.category,
          severity: alert.severity,
          title: alert.title,
          detail: alert.detail,
        });
      }
      await resolveAlertsNotIn(snapshotId, stillActive);
    }
  } catch {
    // 알림 갱신 실패가 가격 확인 자체의 성공/실패를 뒤집지 않는다(PART U 원칙).
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 WU-131 — **이번에 본 후보를 「검토 이력」으로 남긴다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 지금까지 후보는 transient 라 **검색이 끝나면 사라졌다** — 다음 조회에 다시
   * 걸리지 않으면 셀러가 이전에 본 후보를 **영영 다시 볼 수 없었다**(WU-131 §2 ⒞).
   *
   * 🟢 **`domestic_product_links` 에 쓰지 않는다** — 그 표는 가격·판정 경로이고
   *    일시 샵 가드가 여전히 막는다. 여기는 **별 표**(`candidate_reviews`)다.
   * 🔴 **사람 판단을 건드리지 않는다** — `recordSeenCandidates` 는 `human_verdict` 를
   *    쓰지 않으므로 이미 판단한 후보가 재조회로 **초기화되지 않는다**.
   * 🔴 실패해도 가격확인 결과를 뒤집지 않는다(알림 갱신과 같은 격리 원칙).
   * 🔴 가격은 **표시용** 으로만 실린다 — 집계·판정·alert 에 들어가지 않는다.
   */
  /**
   * 🔴🔴 WU-132 — **`reviewedSameEvidence` 는 여기에 «넣지 않는다».**
   *
   * 이유가 둘이고 둘 다 데이터 사실이다:
   * ```
   * ⒜ 그 행은 **이미 이 표에 있다** — 재투입 URL 의 출처가 바로 이 표다.
   * ⒝ 🔴 `source` check constraint 에 `REVIEWED_SAME` 이 **없다**(079 migration).
   *    기존 값(SELLER_URL 등)으로 적으면 upsert 가 그 행의 **원래 출처를 덮어쓴다** —
   *    「이 후보가 어디서 처음 왔는가」가 영구히 사라진다.
   * ```
   * 🔴 그래서 **쓰지 않는다**(새 enum 값 추가 = migration 이고 이번 범위 밖이다).
   * 🟢 화면에서 잃는 것은 없다 — 그 후보는 이번 조회의 「🔁 이전 확인 후보」 구역에
   *    **새 판정과 함께** 서고, 📚 이력 구역에도 그 행이 그대로 있다.
   */
  /**
   * 🔴🔴 CORE-2R-4 — **`domesticListingEvidence` 도 여기에 «넣지 않는다».**
   *
   * 이유는 WU-132 와 **같다** — 079 migration 의 `source` check constraint 가
   * 다섯 값(`OVERSEAS_AUTO` · `DOMESTIC_REGISTRY` · `SELLER_URL` · `GEMINI` ·
   * `GT_IMPORT`)뿐이고 `DOMESTIC_LISTING` 이 **없다**. 🔴 기존 값으로 적으면
   * 「이 후보가 어디서 처음 왔는가」가 **영구히 거짓** 이 된다(upsert 가 덮는다).
   * 🔴 새 enum 값 추가는 **migration** 이고 이번 범위 밖이다(CPO 가 schema 를 닫았다).
   * 🟢 화면에서 잃는 것은 없다 — 그 후보는 이번 조회의 후보 구역에 **새 판정과 함께** 선다.
   */
  try {
    const dna = buildProductIdentityDna(product);
    const seen = [
      ...(domesticShop.overseasAutoEvidence ?? []).map((e: GeminiTransientEvidence) => ({ e, source: "OVERSEAS_AUTO" as const })),
      ...(domesticShop.geminiEvidence ?? []).map((e: GeminiTransientEvidence) => ({ e, source: "GEMINI" as const })),
      ...(domesticShop.urlCandidateEvidence ?? []).map((e: GeminiTransientEvidence) => ({ e, source: "SELLER_URL" as const })),
    ];
    if (seen.length > 0) {
      await recordSeenCandidates({
        snapshotId,
        originCode: dna.brandModelCode ? dna.brandModelCode.toUpperCase() : null,
        workspaceId: auth.user.workspaceId,
        candidates: seen.map(({ e, source }) => ({
          candidateUrl: e.discoveredUrl,
          candidateDomain: e.domain,
          candidateTitle: e.title,
          priceAmount: e.priceAmount,
          priceCurrency: e.priceCurrency,
          market: e.market,
          /** 🟢 MI 산출을 **그대로** 보관한다 — 가공하지 않는다. */
          systemVerdict: e.crossSellerVerdict,
          matchTruth: e.matchTruth,
          priceTier: e.priceTier,
          blockers: [...e.crossSellerBlockers, ...e.crossSellerConflicts],
          source,
        })),
      });
    }
  } catch {
    /* 🔴 이력 저장 실패가 가격확인 자체의 성공/실패를 뒤집지 않는다(PART U 원칙). */
  }

  return NextResponse.json({
    ...result,
    domesticShop,
    /**
     * 🔴 **참고 축이다.** 통화별 최저가만 담고 환산하지 않는다.
     *    값이 없으면 `null` — 「0건」으로 적지 않는다.
     */
    overseasReference: intelligence?.candidateOverseasPrice ?? null,
    /**
     * 🔴🔴 WU-056 — **국내 축도 같은 자리로 내보낸다.**
     *
     * WU-055 가 국내 가격 evidence 를 `VERIFIED_CURRENT` 까지 올렸지만, 집계는
     * 화면에 닿지 않았다 — 패널이 POST 직후 `loadPriceHistory()`(GET)로 덮어쓰고
     * GET 경로는 transient 를 넘기지 않기 때문이다(Panel:2093 · WU-049 와 같은 구조).
     *
     * 🟢 **새 계산 0** — MI 가 이미 만든 값을 한 칸 더 내보낼 뿐이다.
     * 🔴 `domesticCompetition`(권위 집계)·판매판정·국내 최저가는 **건드리지 않는다**.
     *    이 칸은 「이번 확인으로 들어온 국내 가격」만 담는 **참고 축** 이다.
     */
    domesticReference: intelligence?.candidateDomesticPrice ?? null,
  });
}
