import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

import { priceTierFromLink } from "../../domestic-price-sources/_lib/domestic-product-link";
import { computeMarketIntelligence } from "../../price-history/_lib/market-intelligence";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 S5-CASE-PROBE — **1회용 측정 라우트. 측정이 끝나면 삭제된다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 — `computeMarketIntelligence` 는 `getSupabaseAdmin()`(service-role)
 * 을 요구하고, 그 키는 **설계상 CTO 로컬에 내려오지 않는다**
 * (`next.config.ts:12` 「구조적으로 접근할 수 없다 … 의도된 동작」 · `vercel env pull`
 * 실측 EMPTY). ⟹ 운영 owner 를 «직접» 부르려면 **Production 안에서** 돌릴 수밖에 없다.
 * 🔴 CASE 로직을 SQL 로 복제하지 않기 위한 라우트다(§5-B 복제식 금지).
 *
 * 🔴 안전 설계(헌장 §10):
 *   ① 토큰 없으면 **404**(기존 debug 라우트와 같은 게이팅 — 존재 자체를 숨긴다)
 *   ② **읽기 전용** — DB 쓰기 0 · 외부 write 0
 *   ③ **집계만 반환** — 개별 상품 식별자·가격·URL 을 내보내지 않는다
 *   ④ 배치 호출(`from`/`size`)로 함수 시간 초과를 피한다
 *   ⑤ 측정 종료 즉시 토큰 폐기 → 이 파일 삭제 → 재배포
 */
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const expected = process.env.S5_CASE_PROBE_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "NO_SERVICE_ROLE" }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const from = Number(searchParams.get("from") ?? "0");
  const size = Math.min(Number(searchParams.get("size") ?? "10"), 25);

  /* 링크 보유 스냅샷 전수 — 분모를 «링크 보유» 로 고정한다(전체 스냅샷이 아니다). */
  const { data: linkRows, error: linkErr } = await admin
    .from("domestic_product_links")
    .select("snapshot_id, match_truth, verified");
  if (linkErr) return NextResponse.json({ error: "LINK_READ_FAILED", detail: linkErr.message }, { status: 200 });

  const links = (linkRows ?? []) as Array<{ snapshot_id: string; match_truth: string | null; verified: boolean }>;

  /* 🔴 §5-B CONTROL — 같은 운영 owner 로 tier 를 세어 CTO 로컬 측정과 대조한다.
     이 숫자가 어긋나면 이 라우트가 «다른 데이터» 를 보고 있다는 뜻이므로 측정 무효다. */
  const tierTally: Record<string, number> = {};
  const exactSnapshots = new Set<string>();
  for (const l of links) {
    const tier = priceTierFromLink({ matchTruth: l.match_truth as never, verified: l.verified });
    tierTally[tier] = (tierTally[tier] ?? 0) + 1;
    if (tier === "EXACT") exactSnapshots.add(l.snapshot_id);
  }

  const snapshotIds = [...new Set(links.map((l) => l.snapshot_id))].sort();
  const batch = snapshotIds.slice(from, from + size);

  const { data: snapRows } = await admin.from("product_snapshots").select("id, workspace_id").in("id", batch);
  const workspaceById = new Map((snapRows ?? []).map((r) => [r.id as string, r.workspace_id as string]));

  const caseTally: Record<string, number> = {};
  const basisTally: Record<string, number> = {};
  const verdictTally: Record<string, number> = {};
  let miNull = 0;
  let recommendedNotNull = 0;
  let marginNotNull = 0;
  /** 🔴 sellerAction 의 «실제» 키 — 이름을 추측했는지 보고서에서 검증하기 위해 싣는다. */
  let sellerActionKeys: string[] = [];
  const errors: string[] = [];

  for (const id of batch) {
    const ws = workspaceById.get(id);
    if (!ws) {
      miNull += 1;
      continue;
    }
    try {
      /* 🔴 운영 owner 를 «그대로» 부른다 — 복제 0. */
      /* 🔴 필드명을 «추측하지 않는다» — PriceRecommendationResult 실제 칸은
         `recommendedPrice`(KRW 접미사 없음)이고, sellerAction 하위 이름은
         아래에서 **실제 키를 그대로 수집**해 확인한다. */
      const mi = (await computeMarketIntelligence(id, ws)) as {
        domesticBasis?: string | null;
        recommendation?: { marketCase?: string | null; recommendedPrice?: number | null; estimatedMarginPercent?: number | null } | null;
        sellerAction?: Record<string, unknown> | null;
      } | null;
      if (!mi) {
        miNull += 1;
        continue;
      }
      const mc = mi.recommendation?.marketCase ?? "NO_RECOMMENDATION";
      caseTally[mc] = (caseTally[mc] ?? 0) + 1;
      const basis = mi.domesticBasis ?? "NULL";
      basisTally[basis] = (basisTally[basis] ?? 0) + 1;
      if (mi.sellerAction && sellerActionKeys.length === 0) sellerActionKeys = Object.keys(mi.sellerAction);
      const rawVerdict = mi.sellerAction?.["finalVerdict"];
      const verdict = typeof rawVerdict === "string" ? rawVerdict : rawVerdict == null ? "NULL" : "NON_STRING";
      verdictTally[verdict] = (verdictTally[verdict] ?? 0) + 1;
      if (mi.recommendation?.recommendedPrice != null) recommendedNotNull += 1;
      if (mi.recommendation?.estimatedMarginPercent != null) marginNotNull += 1;
    } catch (e) {
      // 🔴 개별 상품 식별자를 내보내지 않는다 — 오류 «종류» 만 센다.
      errors.push(String((e as Error).message).slice(0, 120));
    }
  }

  return NextResponse.json({
    denominator: { linkRows: links.length, linkedSnapshots: snapshotIds.length },
    control: { tierTally, exactSnapshots: exactSnapshots.size },
    batch: { from, size, measured: batch.length },
    result: { caseTally, basisTally, verdictTally, miNull, recommendedNotNull, marginNotNull },
    fieldCheck: { sellerActionKeys },
    errorKinds: [...new Set(errors)].slice(0, 5),
  });
}
