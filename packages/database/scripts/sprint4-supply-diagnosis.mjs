/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 4 — SEARCH SUPPLY DIAGNOSIS 판독기 (read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO PHASE B — 「Search 공급 부족이 **상시인가 간헐인가**」를 데이터로 판정한다.
 * 🔴 **새 검색 0 · 새 CEO 실행요청 0** — 자연 누적된 `workspace.searchRun` 만 읽는다.
 *
 * ── 🔴 이 스크립트가 «하지 않는» 것 ──────────────────────────────────────────
 * ```
 * ❌ 쓰기 · 외부 호출 · 정책 변경 · 질의 변경
 * ❌ N < 5 에서 「상시/간헐」을 **판정하지 않는다**(측정불가로 적는다)
 * ❌ 「query 칸 없음」과 「query = null」을 **같은 것으로 세지 않는다**
 *    (앞은 **구버전 실행**(영속화 배포 전) · 뒤는 **NO_MODEL_CODE** 로 질의를 안 만든 것)
 * ```
 * 🔴 토큰/비밀을 찍지 않는다 — `searchRun` 에는 그 자리가 없다(계약으로 잠겨 있다).
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

/** 🔴 상한을 걸지 않는다 — 분모를 자르면 「상시인가」를 답할 수 없다. */
const rows = await p.$queryRawUnsafe(`
  select id, title, source_url, updated_at,
         (workspace->'searchRun') as search_run
    from product_snapshots
   where workspace ? 'searchRun'
   order by updated_at desc
`);

const N = rows.length;
const pad = (s, n) => String(s ?? "-") + " ".repeat(Math.max(0, n - String(s ?? "-").length));
const padL = (s, n) => " ".repeat(Math.max(0, n - String(s ?? "-").length)) + String(s ?? "-");

console.log(`\n═══ SPRINT 4 — SEARCH SUPPLY DIAGNOSIS ═══`);
console.log(`searchRun 보유 스냅샷  N = ${N}\n`);

if (N === 0) {
  console.log("🔴 0건 — 배포 이후 분석 실행이 아직 없다(추정 금지 · 「공급 0」이 아니다)");
  await p.$disconnect();
  process.exit(0);
}

/* ── ③④⑤⑥ 상품별 표 ──────────────────────────────────────────────────── */
console.log("── 상품별 Search 실행 관측 ───────────────────────────────────────────");
console.log(
  `${pad("상품", 34)} ${padL("org", 4)} ${padL("pg", 3)} ${pad("perPage", 10)} ` +
    `${pad("failed", 7)} ${pad("timeout", 8)} ${pad("error", 26)} ${pad("producers(W/O/D/G)", 20)}`,
);

const stat = {
  withQueryField: 0,
  legacyNoQueryField: 0,
  queryNull: 0,
  failed: 0,
  timeout: 0,
  zeroSupply: 0,
  organics: [],
  pagesTwo: 0,
};

for (const r of rows) {
  const run = r.search_run ?? {};
  const s = run.search ?? null;
  const pr = run.producers ?? {};
  if (s == null) continue;

  /** 🔴 **칸 자체가 없는 것** 과 **null** 을 가른다. */
  const hasQueryField = Object.prototype.hasOwnProperty.call(s, "query");
  if (!hasQueryField) stat.legacyNoQueryField++;
  else if (s.query == null) stat.queryNull++;
  else stat.withQueryField++;

  if (s.failed) stat.failed++;
  if (s.timeout) stat.timeout++;
  if (!s.failed && s.organic === 0) stat.zeroSupply++;
  if (!s.failed && typeof s.organic === "number") stat.organics.push(s.organic);
  if ((s.pages ?? 0) >= 2) stat.pagesTwo++;

  const err = [s.errorName, s.errorStatus, s.errorCode].filter(Boolean).join("/") || "-";
  console.log(
    `${pad(String(r.title).slice(0, 33), 34)} ${padL(s.organic, 4)} ${padL(s.pages, 3)} ` +
      `${pad(JSON.stringify(s.perPage ?? null), 10)} ${pad(s.failed, 7)} ${pad(s.timeout, 8)} ` +
      `${pad(err, 26)} ${pad(`${pr.WEB_SEARCH ?? "-"}/${pr.OVERSEAS_AUTO ?? "-"}/${pr.DOMESTIC_LISTING ?? "-"}/${pr.GEMINI ?? "-"}`, 20)}`,
  );
}

/* ── ③ 질의 원문 ──────────────────────────────────────────────────────── */
console.log("\n── 상품별 실제 전달 query ────────────────────────────────────────────");
for (const r of rows) {
  const s = r.search_run?.search ?? null;
  if (s == null) continue;
  const hasQueryField = Object.prototype.hasOwnProperty.call(s, "query");
  const label = !hasQueryField
    ? "🔴 구버전 실행 — 영속화 배포(4c84c93) 전이라 칸이 없다(측정불가 · 「질의 없음」 아님)"
    : s.query == null
      ? "🔴 query = null — NO_MODEL_CODE(질의를 만들지 않았다)"
      : JSON.stringify(s.query);
  console.log(`\n  ${r.title}`);
  console.log(`  ${new Date(r.updated_at).toISOString()}`);
  console.log(`  ${label}`);
}

/* ── ⑦ 판정 ──────────────────────────────────────────────────────────── */
const ok = stat.organics.slice().sort((a, b) => a - b);
console.log("\n── 집계 ─────────────────────────────────────────────────────────────");
console.log(`  성공 실행 n=${ok.length}  합=${ok.reduce((a, b) => a + b, 0)}` +
  (ok.length ? `  최소=${ok[0]} 중위=${ok[Math.floor(ok.length / 2)]} 최대=${ok[ok.length - 1]}` : ""));
console.log(`  공급 0 건수 = ${stat.zeroSupply}   failed = ${stat.failed}   timeout = ${stat.timeout}`);
console.log(`  2페이지 이상 수신 = ${stat.pagesTwo} / ${N}`);
console.log(`  query 보유 = ${stat.withQueryField}   query=null(NO_MODEL_CODE) = ${stat.queryNull}   구버전(칸 없음) = ${stat.legacyNoQueryField}`);

console.log("\n── ⑦ Search supply 판정 ─────────────────────────────────────────────");
if (N < 5) {
  console.log(`  🔴 **MEASUREMENT UNAVAILABLE — N = ${N} < 5**`);
  console.log("     「상시 부족」도 「간헐 부족」도 「정상」도 적지 않는다(CPO 기준 N≥5).");
  console.log("     🟢 관측은 자연 누적된다 — 평소 분석이 돌면 이 표가 채워진다.");
} else {
  const lowShare = ok.filter((v) => v <= 3).length / Math.max(1, ok.length);
  const verdict =
    stat.failed / N >= 0.4
      ? "🔴 간헐 부족(실패 축) — 정상 run 과 실패 run 의 error/timeout 을 대조할 것"
      : lowShare >= 0.6
        ? "🔴 상시 부족 — provider / query parameter / page strategy 후보(🔴 변경은 CPO 결정)"
        : lowShare > 0
          ? "🟡 간헐 부족 — 낮은 run 과 정상 run 의 query 차이를 대조할 것"
          : "🟢 공급 정상 — 병목을 ranking / discovery quality / identity 로 이동(🔴 CPO 결정 전 코드 변경 금지)";
  console.log(`  ${verdict}`);
  console.log(`  (근거: 성공 n=${ok.length} · organic≤3 비율 ${(lowShare * 100).toFixed(0)}% · failed ${stat.failed}/${N})`);
}
console.log("");
await p.$disconnect();
