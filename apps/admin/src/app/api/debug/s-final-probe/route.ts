import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

import { priceTierFromLink } from "../../domestic-price-sources/_lib/domestic-product-link";
import { computeMarketIntelligence } from "../../price-history/_lib/market-intelligence";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 S-FINAL-PROBE — **1회용 측정 라우트. 측정이 끝나면 삭제된다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 — `computeMarketIntelligence` 는 `getSupabaseAdmin()`(service-role)을
 * 요구하고 그 키는 **설계상 CTO 로컬에 내려오지 않는다**(`next.config.ts:12` ·
 * `vercel env pull` 실측 EMPTY) ⟹ 운영 owner 를 «직접» 부르려면 Production 안에서
 * 돌릴 수밖에 없다. 🔴 E2E 를 SQL 로 복제하지 않기 위한 라우트다(§5-B 복제식 금지).
 *
 * 🔴 안전 설계(헌장 §10) — 직전 `s5-case-probe`(2e07bc2c) 와 **같은 모양**:
 *   ① 토큰 없으면 **404**(존재 자체를 숨긴다)
 *   ② **읽기 전용** — DB 쓰기 0 · 외부 write 0 · live 검색 0
 *      🔴 그래서 `runDomesticPriceCheck` 는 **부르지 않는다** — 그 함수는
 *         `linksCreatedOrUpdated`/`pricesRecorded` 를 내는 **쓰기 경로** 다.
 *         ⟹ S1-b(여섯 배열 live overlap)는 이 라우트의 범위가 **아니다**(CPO 보류).
 *   ③ **집계만 반환** — 개별 상품 식별자·가격·URL 을 내보내지 않는다
 *   ④ 배치(`from`/`size`)로 60초 초과를 피한다
 *   ⑤ 측정 종료 즉시 토큰 폐기 → 이 파일 삭제 → 재배포 → 삭제 증명
 *
 * 🔴 **필드명을 추측하지 않는다**(이 트랙이 반복해 밟은 함정) — `mode=shape` 가
 *    실제 키를 그대로 수집해 돌려주므로 **재배포 없이** 이름을 확정할 수 있다.
 *    확인된 것: `currentPrice.costBasis`(ORIGIN_FX↔KR_MARKET) · `cost.landedCostKrw` ·
 *    `recommendation` · 🔴 `rateDate` 는 MI 반환에 **없다**(`fx` 는 rate/isEstimate).
 */
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const expected = process.env.S_FINAL_PROBE_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

type Bag = Record<string, unknown>;

/** 중첩 칸을 «추측 없이» 안전하게 읽는다 — 없으면 undefined. */
function at(root: unknown, ...path: string[]): unknown {
  let cur: unknown = root;
  for (const k of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Bag)[k];
  }
  return cur;
}

function bump(t: Record<string, number>, k: string): void {
  t[k] = (t[k] ?? 0) + 1;
}

/** 분류 라벨 — 값이 아니라 «상태» 로만 센다(식별자·금액 반출 금지). */
function label(v: unknown): string {
  if (v == null) return "NULL";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? "NUMBER" : "NON_FINITE";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "NON_SCALAR";
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
  const mode = searchParams.get("mode") ?? "e2e-domestic";
  const from = Number(searchParams.get("from") ?? "0");
  const size = Math.min(Number(searchParams.get("size") ?? "10"), 25);

  /* ──────────────────────────────────────────────────────────────────────────
   * 🔴 §5-B CONTROL — 운영 owner `priceTierFromLink` 로 tier 를 세어 CTO 로컬
   *    실측과 대조한다. 기대값 {EXACT 58 · COMPARISON 14 · REFERENCE 18}.
   *    어긋나면 이 라우트가 «다른 데이터» 를 보고 있다는 뜻이므로 **측정 무효** 다.
   * ────────────────────────────────────────────────────────────────────────── */
  const { data: linkRows, error: linkErr } = await admin
    .from("domestic_product_links")
    .select("snapshot_id, match_truth, verified");
  if (linkErr) {
    return NextResponse.json({ error: "LINK_READ_FAILED", detail: linkErr.message }, { status: 200 });
  }
  const links = (linkRows ?? []) as Array<{ snapshot_id: string; match_truth: string | null; verified: boolean }>;

  const tierTally: Record<string, number> = {};
  for (const l of links) {
    bump(tierTally, priceTierFromLink({ matchTruth: l.match_truth as never, verified: l.verified }));
  }
  const linkedSnapshotIds = [...new Set(links.map((l) => l.snapshot_id))].sort();
  const control = { tierTally, linkedSnapshots: linkedSnapshotIds.length };

  /* 모집단 — `linked`(링크 보유) ↔ `all`(전체 스냅샷).
     🔴 해외 원상품은 링크가 없을 수 있으므로 해외 축은 `all` 을 쓴다. */
  const wantAll = mode === "e2e-overseas" || searchParams.get("pop") === "all";
  let population: string[];
  if (wantAll) {
    const { data: allRows, error: allErr } = await admin
      .from("product_snapshots")
      .select("id")
      .order("id", { ascending: true });
    if (allErr) {
      return NextResponse.json({ error: "SNAP_READ_FAILED", detail: allErr.message }, { status: 200 });
    }
    population = (allRows ?? []).map((r) => r.id as string);
  } else {
    population = linkedSnapshotIds;
  }

  const batch = population.slice(from, from + size);
  const { data: snapRows } = await admin
    .from("product_snapshots")
    .select("id, workspace_id, workspace")
    .in("id", batch);
  const metaById = new Map(
    (snapRows ?? []).map((r) => [
      r.id as string,
      { ws: r.workspace_id as string, category: label(at(r.workspace, "marketCategoryProfileId")) },
    ]),
  );

  /* ── mode=shape — 실제 키만 수집한다(값 반출 0). 재배포 없이 이름을 확정한다. ── */
  if (mode === "shape") {
    for (const id of batch) {
      const meta = metaById.get(id);
      if (!meta) continue;
      const mi = (await computeMarketIntelligence(id, meta.ws)) as Bag | null;
      if (!mi) continue;
      const keysOf = (...p: string[]) => {
        const v = at(mi, ...p);
        return v && typeof v === "object" ? Object.keys(v as Bag) : label(v);
      };
      return NextResponse.json({
        control,
        shape: {
          top: Object.keys(mi),
          currentPrice: keysOf("currentPrice"),
          fx: keysOf("fx"),
          cost: keysOf("cost"),
          recommendation: keysOf("recommendation"),
          sellerDecision: keysOf("sellerDecision"),
          sellerAction: keysOf("sellerAction"),
          domesticCompetition: keysOf("domesticCompetition"),
          domesticMarketSplit: keysOf("domesticMarketSplit"),
        },
      });
    }
    return NextResponse.json({ control, shape: null, note: "NO_MI_IN_BATCH" });
  }

  /* ── 측정 엔진 — 세 mode 가 **같은 코드** 를 쓴다(복제 0). ── */
  const caseTally: Record<string, number> = {};
  const verdictTally: Record<string, number> = {};
  const costBasisTally: Record<string, number> = {};
  const originCurrencyTally: Record<string, number> = {};
  const byCategory: Record<string, Record<string, number>> = {};
  let miNull = 0;
  let noWorkspace = 0;
  let recommendedNotNull = 0;
  let marginNotNull = 0;
  let landedCostNotNull = 0;
  let fxNotNull = 0;
  let domesticSellerCountPositive = 0;
  let overseasPricePresent = 0;
  let fxKeys: string[] = [];
  const errors: string[] = [];

  for (const id of batch) {
    const meta = metaById.get(id);
    if (!meta) {
      noWorkspace += 1;
      continue;
    }
    try {
      /* 🔴 운영 owner 를 «그대로» 부른다 — 복제 0 · 쓰기 0. */
      const mi = (await computeMarketIntelligence(id, meta.ws)) as Bag | null;
      if (!mi) {
        miNull += 1;
        continue;
      }

      const costBasis = label(at(mi, "currentPrice", "costBasis"));
      const marketCase = label(at(mi, "recommendation", "marketCase"));
      const verdict = label(at(mi, "sellerDecision", "finalVerdict"));
      const originCurrency = label(at(mi, "priceHistory", "origin", "records", "0", "currency"));

      bump(costBasisTally, costBasis);
      bump(caseTally, marketCase === "NULL" ? "NO_RECOMMENDATION" : marketCase);
      bump(verdictTally, verdict);
      bump(originCurrencyTally, originCurrency);

      /* 🔴 카테고리 축 — 공통 엔진 하나가 돌았는지 보는 것이 목적이다. */
      const slot = (byCategory[meta.category] ??= {});
      bump(slot, `case:${marketCase === "NULL" ? "NO_RECOMMENDATION" : marketCase}`);
      bump(slot, "measured");

      if (at(mi, "recommendation", "recommendedPrice") != null) recommendedNotNull += 1;
      if (at(mi, "recommendation", "estimatedMarginPercent") != null) marginNotNull += 1;
      if (at(mi, "cost", "landedCostKrw") != null) landedCostNotNull += 1;
      const fx = at(mi, "fx");
      if (fx != null) {
        fxNotNull += 1;
        if (fxKeys.length === 0 && typeof fx === "object") fxKeys = Object.keys(fx as Bag);
      }
      const sellerCount = at(mi, "domesticCompetition", "sellerCount");
      if (typeof sellerCount === "number" && sellerCount > 0) domesticSellerCountPositive += 1;
      const overseas = at(mi, "candidateOverseasPrice", "byCurrency");
      if (overseas && typeof overseas === "object" && Object.keys(overseas as Bag).length > 0) {
        overseasPricePresent += 1;
      }
    } catch (e) {
      // 🔴 개별 상품 식별자를 내보내지 않는다 — 오류 «종류» 만 센다.
      errors.push(String((e as Error).message).slice(0, 120));
    }
  }

  return NextResponse.json({
    mode,
    denominator: { linkRows: links.length, population: population.length, pop: wantAll ? "all" : "linked" },
    control,
    batch: { from, size, measured: batch.length },
    result: {
      caseTally,
      verdictTally,
      costBasisTally,
      originCurrencyTally,
      miNull,
      noWorkspace,
      recommendedNotNull,
      marginNotNull,
      landedCostNotNull,
      fxNotNull,
      domesticSellerCountPositive,
      overseasPricePresent,
    },
    byCategory: mode === "category" ? byCategory : undefined,
    fieldCheck: { fxKeys },
    errorKinds: [...new Set(errors)].slice(0, 5),
  });
}
