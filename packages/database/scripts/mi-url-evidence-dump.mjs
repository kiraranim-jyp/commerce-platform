/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-URL-EVIDENCE STEP 1 — **조사 대상과 기존 기준선을 «덤프» 한다**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 작업지시(§1·§3) — 후보군을 **임의로 추리지 않는다.** `candidate_reviews` 에
 *    실제로 등록된 URL **전수** 를 그대로 낸다.
 * 🔴 DB **읽기만** — 쓰기 0 · migration 0 · GT 수정 0.
 * 🟢 STEP 2(라이브 방문)는 이 파일의 산출을 입력으로 받는다 — 같은 모집단을 쓴다.
 *
 * 🔴🔴 **왜 두 단계인가** — `factsFromProductUrl` 은 확장자 없는 상대 import 를 쓰는
 *    깊은 모듈이라 plain node 로 못 불린다(실측). 그래서 DB 덤프는 여기서 하고
 *    라이브 방문은 vitest 리졸버 아래에서 한다. 🟢 모집단은 이 파일이 고정한다.
 *
 * 출력: %TEMP%/mi-url-evidence/step1-targets.json
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const p = new PrismaClient();
const q = (s) => p.$queryRawUnsafe(s);

/* ── ① 후보 전수 + 기존 기준선 ──────────────────────────────────────────── */
const rows = await q(`
  select cr.origin_code, cr.candidate_url, cr.candidate_domain, cr.candidate_title,
         cr.system_verdict, cr.match_truth, cr.price_tier, cr.market,
         cr.blockers::text blockers_json, cr.match_reasons::text reasons_json,
         cr.image_url, cr.price_amount, cr.price_currency, cr.price_status,
         cr.human_verdict, cr.human_note, cr.source, cr.snapshot_id,
         cr.first_seen_at, cr.last_seen_at
    from candidate_reviews cr
   order by cr.origin_code nulls last, cr.candidate_domain`);

/* ── ② 원상품 사실 — 후보가 가리키는 스냅샷에서 읽는다 ─────────────────── */
const origins = await q(`
  select ps.id snapshot_id, ps.source_url origin_url,
         ps.workspace->'canonicalProduct'->'title'->>'value'        origin_title,
         ps.workspace->'canonicalProduct'->'brand'->>'value'        origin_brand,
         ps.workspace->'canonicalProduct'->'sku'->>'value'          origin_sku,
         ps.workspace->'canonicalProduct'->'modelName'->>'value'    origin_model,
         ps.workspace->'canonicalProduct'->'description'->>'value'  origin_description,
         ps.workspace->'canonicalProduct'->'color'->>'value'        origin_color
    from product_snapshots ps
   where ps.id in (select distinct snapshot_id from candidate_reviews where snapshot_id is not null)`);

const J = (s) => { try { const v = JSON.parse(s ?? "null"); return Array.isArray(v) ? v : []; } catch { return []; } };
const originById = new Map(origins.map((o) => [o.snapshot_id, o]));

const targets = rows.map((r) => ({
  originCode: r.origin_code,
  snapshotId: r.snapshot_id,
  origin: originById.get(r.snapshot_id) ?? null,
  candidateUrl: r.candidate_url,
  candidateDomain: r.candidate_domain,
  /** 🔴 기존 기준선(작업 B) — **재현값이 아니라 저장된 값** 이다. */
  baseline: {
    systemVerdict: r.system_verdict,
    matchTruth: r.match_truth,
    priceTier: r.price_tier,
    market: r.market,
    /** 🔴 writer 가 blockers+conflicts 를 **합쳐** 저장한다 — 되가를 수 없다(한계). */
    blockersMerged: J(r.blockers_json),
    matchReasons: J(r.reasons_json),
    candidateTitle: r.candidate_title,
    imageUrl: r.image_url,
    priceAmount: r.price_amount == null ? null : String(r.price_amount),
    priceCurrency: r.price_currency,
    priceStatus: r.price_status,
    source: r.source,
    firstSeenAt: r.first_seen_at,
  },
  /** 🔴 **분류 입력이 아니다** — 보존·대조 전용(CEO GT 는 수정하지 않는다). */
  ceoGt: r.human_verdict,
  ceoNote: r.human_note,
}));

const uniqueUrls = [...new Set(targets.map((t) => t.candidateUrl))];
const out = {
  generatedFor: "MI-URL-EVIDENCE STEP 1",
  counts: {
    rows: targets.length,
    uniqueCandidateUrls: uniqueUrls.length,
    originCodes: new Set(targets.map((t) => t.originCode).filter(Boolean)).size,
    snapshotsWithOriginFacts: origins.length,
    withCeoGt: targets.filter((t) => t.ceoGt != null).length,
    /** 🔴 시장별 — 국내 P0 를 이 모집단으로 측정할 수 있는지가 여기서 갈린다. */
    byMarket: targets.reduce((a, t) => ((a[t.baseline.market ?? "(null)"] = (a[t.baseline.market ?? "(null)"] ?? 0) + 1), a), {}),
    bySource: targets.reduce((a, t) => ((a[t.baseline.source] = (a[t.baseline.source] ?? 0) + 1), a), {}),
    /** 🔴 기존 판정이 **없는** 행 — 기존 결과 재현이 구조적으로 불가능한 분모다. */
    baselineNotReproduced: targets.filter((t) => t.baseline.systemVerdict == null).length,
  },
  uniqueUrls,
  targets,
};

const dir = path.join(os.tmpdir(), "mi-url-evidence");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "step1-targets.json");
writeFileSync(file, JSON.stringify(out, null, 1), "utf8");

console.log("═══ MI-URL-EVIDENCE STEP 1 — 조사 대상 확정(read-only) ═══");
console.log(JSON.stringify(out.counts, null, 1));
console.log(`\n🟢 산출: ${file}`);
console.log(`🔴 원상품 사실이 붙은 스냅샷 ${origins.length} — 붙지 않은 후보는 원상품 대조가 «측정불가» 다.`);
await p.$disconnect();
