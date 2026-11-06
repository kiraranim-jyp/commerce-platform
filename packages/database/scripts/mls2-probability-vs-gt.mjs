/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 §3 검증 — **고확률 분류 ↔ CEO 육안 판정 대조**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 지시: 「기존 CEO 판정과 시스템 판정은 독립적으로 유지한다」 ·
 *    「CEO 가 검토한 라벨은 **원래 의미와 근거를 보존해** 비교한다」.
 *    ⟹ 🔴 라벨을 번역하거나 고치지 않는다. **대조표만** 만든다.
 *
 * 🔴 분모는 **운영 DB `candidate_reviews` 의 사람 판정 행** 이다(IPES DOSSIER §3 과
 *    같은 분모). 🔴 `DB_EXPORT` 중복을 섞지 않는다.
 * 🔴 DB 쓰기 0 · HTTP 0 · 판정 변경 0.
 */
import { PrismaClient } from "@prisma/client";
import { classifySellerProbability } from "../../../apps/admin/src/app/pipeline/commerce/seller-probability.ts";
import { splitEvidenceReasons } from "../../../apps/admin/src/app/pipeline/commerce/blocker-text.ts";

const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select origin_code, candidate_domain, candidate_title, human_verdict, system_verdict,
         match_truth, price_amount, price_currency, price_status, price_tier, market,
         blockers::text blk, match_reasons::text rsn
    from candidate_reviews
   where human_verdict is not null
   order by origin_code, candidate_domain`);

console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 §3 — 고확률 분류 ↔ CEO 육안 판정 대조");
console.log("══════════════════════════════════════════════════════════════════\n");
console.log(`사람 판정 행 ${rows.length}(운영 DB 단독 분모)\n`);

const J = (s) => {
  try {
    const v = JSON.parse(s ?? "null");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const grid = new Map();
const highRows = [];
const missed = [];

for (const r of rows) {
  const res = classifySellerProbability({
    crossSellerBlockers: J(r.blk),
    /** 🔴 `candidate_reviews` 에 conflicts 칸이 «없다» ⟹ MODEL_CODE 충돌 축은 **이 분모에서 측정불가** 다(0 으로 세지 않는다). */
    crossSellerConflicts: null,
    matchTruth: r.match_truth,
    agreement: splitEvidenceReasons(J(r.rsn)),
  });
  const key = `${r.human_verdict} ↔ ${res.probability}`;
  grid.set(key, (grid.get(key) ?? 0) + 1);
  if (res.probability === "HIGH") highRows.push({ r, res });
  /** 🔴 **놓침** — 사람이 SAME 이라 했는데 고확률이 아니다. 숨기지 않는다. */
  if (r.human_verdict === "SAME" && res.probability !== "HIGH") missed.push({ r, res });
}

console.log("── 교차표(사람 ↔ 고확률 분류) ──");
for (const [k, n] of [...grid.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(34)} ${n}`);

const humanSame = rows.filter((r) => r.human_verdict === "SAME").length;
const humanDiff = rows.filter((r) => r.human_verdict === "DIFFERENT").length;
const highSame = highRows.filter((x) => x.r.human_verdict === "SAME").length;
const highDiff = highRows.filter((x) => x.r.human_verdict === "DIFFERENT").length;

console.log("\n── 🟢 고확률(HIGH) 의 품질 ──");
console.log(`  HIGH ${highRows.length}건 = 사람 SAME ${highSame} · 사람 DIFFERENT ${highDiff}`);
console.log(`  🔴 사람 SAME ${humanSame}건 중 고확률 ${highSame} · **놓침 ${missed.length}**`);
console.log(`  🔴 사람 DIFFERENT ${humanDiff}건 중 고확률로 새어 든 것 **${highDiff}**`);

if (highDiff > 0) {
  console.log("\n🔴 고확률인데 사람이 DIFFERENT 라 한 행(전수 · 숨기지 않는다):");
  for (const { r, res } of highRows.filter((x) => x.r.human_verdict === "DIFFERENT"))
    console.log(
      `    ${String(r.origin_code)} ↔ ${String(r.candidate_domain).padEnd(26)} ` +
        `일치 ${res.matchedCount} 미확인 ${res.unknownCount} · ${res.findings.map((f) => `${f.axis}:${f.state}`).join(" ")}`,
    );
}

console.log("\n🟢 고확률 전수(사람 라벨 같이 적는다):");
for (const { r, res } of highRows)
  console.log(
    `    [${String(r.human_verdict).padEnd(9)}] ${String(r.origin_code)} ↔ ${String(r.candidate_domain).padEnd(26)}` +
      ` sys=${String(r.system_verdict ?? "-").padEnd(14)} ${r.price_amount ?? "-"} ${r.price_currency ?? ""}`,
  );

if (missed.length > 0) {
  console.log(`\n🔴 사람 SAME 인데 고확률이 «아닌» ${missed.length}건 — 왜 그런지 축까지 적는다:`);
  for (const { r, res } of missed.slice(0, 14))
    console.log(
      `    ${String(r.origin_code)} ↔ ${String(r.candidate_domain).padEnd(26)} ${res.probability.padEnd(12)}` +
        ` ${res.findings.map((f) => `${f.axis}:${f.state}`).join(" ")}`,
    );
}

/** 🔴 기존 Identity 판정과의 «차이» 를 같이 적는다(CPO: 「차이를 명시한다」). */
console.log("\n── 🔵 기존 Identity 판정 ↔ 새 표현 분류 ──");
const vs = new Map();
for (const r of rows) {
  const res = classifySellerProbability({
    crossSellerBlockers: J(r.blk),
    /** 🔴 `candidate_reviews` 에 conflicts 칸이 «없다» ⟹ MODEL_CODE 충돌 축은 **이 분모에서 측정불가** 다(0 으로 세지 않는다). */
    crossSellerConflicts: null,
    matchTruth: r.match_truth,
    agreement: splitEvidenceReasons(J(r.rsn)),
  });
  const k = `${r.system_verdict ?? "(없음)"} → ${res.probability}`;
  vs.set(k, (vs.get(k) ?? 0) + 1);
}
for (const [k, n] of [...vs.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(38)} ${n}`);

console.log("\n🔴 읽기만 했다 — DB 쓰기 0 · 라벨 번역 0 · 판정 변경 0.");
await p.$disconnect();
