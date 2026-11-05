/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IPES STEP 1 — **기존 후보군 · Evidence · CEO 육안 판정 «회수»**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시(IDENTICAL PRODUCT EVIDENCE STANDARD · STEP 1) —
 *    「기존 자료의 **위치 · 작성 시점 · 관련 커밋 · 데이터 출처** 부터 확인한다」.
 *
 * 🔴🔴 **원본을 가공하지 않는다.** 이 스크립트는 **읽고 세기만** 한다 —
 *    정답에 맞춘 수정 0 · 병합 0 · 추론으로 채우기 0 · DB 쓰기 0 · 새 검색 0.
 * 🟢 Evidence 칸은 **네 상태로 갈라** 센다(CPO 요구):
 *    실제 수집된 값 / 수집되지 않은 값 / 서로 충돌하는 값 / 시스템이 추론한 값
 *    🔴 「출처가 불분명한 값」은 **파일이 출처를 적지 않은 것** 으로만 센다(추측 금지).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve("apps/admin/src/app/api/price-history/_lib/__tests__/fixtures");
const HUMAN_VERDICTS = new Set(["SAME", "SIMILAR", "DIFFERENT", "UNDECIDED", "UNCERTAIN"]);
const VALUE_LABELS = new Set(["USEFUL", "NOISE", "UNSURE"]);

/** 🔴 중첩 구조가 파일마다 다르다 — **깊이 우선으로 「판정이 붙은 노드」를 센다**. */
function harvest(node, out, depth = 0) {
  if (depth > 8 || node == null) return;
  if (Array.isArray(node)) {
    for (const x of node) harvest(x, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const keys = Object.keys(node);
  /** 🟢 사람 판정으로 보이는 칸을 **글자로** 찾는다(이름을 추측해 지어내지 않는다). */
  const vKey = keys.find((k) => /^(humanVerdict|human|verdict|ceo|ceoVerdict|label|value)$/i.test(k));
  const v = vKey ? node[vKey] : undefined;
  const isVerdict = typeof v === "string" && (HUMAN_VERDICTS.has(v.toUpperCase()) || VALUE_LABELS.has(v.toUpperCase()));
  if (isVerdict) {
    const url = keys.find((k) => /url|link/i.test(k));
    out.rows.push({
      verdict: String(v).toUpperCase(),
      url: url ? String(node[url]) : null,
      domain: node.domain ?? node.candidateDomain ?? node.host ?? null,
      note: node.note ?? node.reason ?? node.basis ?? node.memo ?? null,
      origin: node.origin ?? node.originCode ?? node.snapshot ?? null,
      keys,
    });
  }
  for (const k of keys) harvest(node[k], out, depth + 1);
}

const EVIDENCE_KEYS = [
  "brand",
  "brandModelCode",
  "modelCode",
  "title",
  "color",
  "colorText",
  "material",
  "fit",
  "garmentForm",
  "category",
  "audience",
  "size",
  "imageUrl",
  "price",
  "priceAmount",
  "priceCurrency",
  "priceStatus",
  "market",
];

console.log("══════════════════════════════════════════════════════════════════");
console.log("  IPES STEP 1 — 기존 후보군 / Evidence / CEO 육안 판정 인벤토리");
console.log("══════════════════════════════════════════════════════════════════\n");

/* ── ① fixture 전수 ─────────────────────────────────────────────────────── */
console.log("── ① GT / 후보 리스팅 fixture (apps/admin/.../__tests__/fixtures) ──\n");
const files = existsSync(ROOT) ? readdirSync(ROOT).filter((f) => f.endsWith(".json")) : [];
const fixSummary = [];
for (const f of files) {
  const p = path.join(ROOT, f);
  let json;
  try {
    json = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    console.log(`  🔴 ${f} — JSON 파싱 실패(건드리지 않았다)`);
    continue;
  }
  const out = { rows: [] };
  harvest(json, out);
  if (out.rows.length === 0) continue;
  const dist = out.rows.reduce((a, r) => {
    a[r.verdict] = (a[r.verdict] ?? 0) + 1;
    return a;
  }, {});
  const withNote = out.rows.filter((r) => r.note != null && String(r.note).trim() !== "").length;
  const withUrl = out.rows.filter((r) => r.url).length;
  /** 🟢 Evidence 칸 보유율 — **키가 있는가** 로만 센다(값 품질을 판정하지 않는다). */
  const evKeys = new Set();
  for (const r of out.rows) for (const k of r.keys) if (EVIDENCE_KEYS.includes(k)) evKeys.add(k);
  fixSummary.push({ file: f, rows: out.rows.length, dist, withUrl, withNote, ev: [...evKeys].sort() });
  console.log(`  ${f}`);
  console.log(`     판정 행 ${out.rows.length} · 분포 ${JSON.stringify(dist)}`);
  console.log(`     URL 보유 ${withUrl}/${out.rows.length} · 근거/비고 보유 ${withNote}/${out.rows.length}`);
  console.log(`     Evidence 칸 ${evKeys.size > 0 ? [...evKeys].sort().join(", ") : "(이 파일엔 없음)"}`);
  console.log(`     크기 ${statSync(p).size}B`);
  console.log("");
}

/* ── ② CEO 육안 검토 «화면» 산출물 ───────────────────────────────────────── */
console.log("── ② CEO 육안 검토 화면 산출물(docs/*.html · 자립형) ──\n");
for (const f of readdirSync("docs").filter((x) => x.endsWith(".html"))) {
  const p = path.join("docs", f);
  console.log(`  ${f}  ${statSync(p).size}B`);
}

/* ── ③ 운영 DB — candidate_reviews(사람 판정의 «운영» 저장소) ────────────── */
const p = new PrismaClient();
console.log("\n── ③ 운영 DB `candidate_reviews` — 사람 판정 보존 현황 ──\n");
const agg = await p.$queryRawUnsafe(`
  select human_verdict, count(*)::int n,
         count(*) filter (where candidate_url is not null)::int with_url,
         count(*) filter (where human_note is not null and human_note <> '')::int with_note,
         count(*) filter (where price_amount is not null)::int with_price,
         count(*) filter (where jsonb_typeof(match_reasons)='array')::int with_reasons,
         count(*) filter (where jsonb_typeof(blockers)='array' and jsonb_array_length(blockers)>0)::int with_blockers,
         count(distinct snapshot_id)::int snaps
    from candidate_reviews group by 1 order by 2 desc`);
for (const r of agg)
  console.log(
    `  human_verdict=${String(r.human_verdict ?? "(null)").padEnd(10)} n=${String(r.n).padStart(4)} ` +
      `url ${r.with_url} · 비고 ${r.with_note} · 가격 ${r.with_price} · reasons ${r.with_reasons} · ` +
      `blockers ${r.with_blockers} · 스냅샷 ${r.snaps}`,
  );

/** 🔴 Evidence 칸의 **네 상태** — 「없다」와 「0」을 섞지 않는다. */
const ev = await p.$queryRawUnsafe(`
  select count(*)::int total,
         count(*) filter (where candidate_title is null or candidate_title='')::int no_title,
         count(*) filter (where image_url is null)::int no_image,
         count(*) filter (where price_amount is null)::int no_price,
         count(*) filter (where price_status is null)::int no_price_status,
         count(*) filter (where market is null or market='UNKNOWN')::int no_market,
         count(*) filter (where system_verdict is null)::int no_sys_verdict,
         count(*) filter (where match_truth is null)::int no_match_truth,
         count(*) filter (where jsonb_typeof(match_reasons)<>'array')::int no_reasons
    from candidate_reviews where human_verdict is not null`);
console.log("\n  🔴 사람 판정이 붙은 행의 Evidence **미수집** 칸 수:");
console.log(`  ${JSON.stringify(ev[0])}`);

/** 🟢 원상품(origin) 축 — 어느 상품의 후보인지. */
const byOrigin = await p.$queryRawUnsafe(`
  select origin_code, count(*)::int n,
         count(*) filter (where human_verdict='SAME')::int same,
         count(*) filter (where human_verdict='SIMILAR')::int similar,
         count(*) filter (where human_verdict='DIFFERENT')::int different,
         count(*) filter (where human_verdict='UNDECIDED')::int undecided
    from candidate_reviews where human_verdict is not null
   group by 1 order by 2 desc`);
console.log("\n  원상품(origin_code)별 사람 판정:");
for (const r of byOrigin)
  console.log(
    `    ${String(r.origin_code ?? "(null)").padEnd(14)} n=${String(r.n).padStart(3)} ` +
      `SAME ${r.same} · SIMILAR ${r.similar} · DIFFERENT ${r.different} · UNDECIDED ${r.undecided}`,
  );

/** 🔴 시스템 판정과 사람 판정의 **대조 가능 분모** — 둘 다 있는 행만. */
const both = await p.$queryRawUnsafe(`
  select human_verdict, system_verdict, count(*)::int n
    from candidate_reviews
   where human_verdict is not null and system_verdict is not null
   group by 1,2 order by 3 desc`);
console.log("\n  🟢 사람 ↔ 시스템 **대조 가능** 조합(둘 다 있는 행):");
for (const r of both)
  console.log(`    human=${String(r.human_verdict).padEnd(10)} system=${String(r.system_verdict).padEnd(14)} n=${r.n}`);

console.log("\n🔴 이 스크립트는 **읽기만** 했다 — 수정 0 · 병합 0 · 추론 0 · DB 쓰기 0.");
await p.$disconnect();
