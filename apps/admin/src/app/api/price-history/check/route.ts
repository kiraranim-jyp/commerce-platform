import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { computeMarketAlert, type AlertCategory } from "@commerce/pricing";
import { resolveMarketCategoryScopes } from "../../domestic-price-sources/_lib/category-scope";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { computeMarketIntelligence } from "../_lib/market-intelligence";
import { openAlertIfNotActive, resolveAlertsNotIn } from "../_lib/price-alerts";
import { MAX_SUPPLIED_CANDIDATE_URLS, runDomesticPriceCheck } from "../_lib/run-domestic-price-check";
import { runPriceCheck } from "../_lib/run-price-check";

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
    const transientEvidence =
      domesticShop.geminiEvidence || domesticShop.urlCandidateEvidence
        ? [...(domesticShop.geminiEvidence ?? []), ...(domesticShop.urlCandidateEvidence ?? [])]
        : null;
    const intelligence = await computeMarketIntelligence(
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

  return NextResponse.json({ ...result, domesticShop });
}
