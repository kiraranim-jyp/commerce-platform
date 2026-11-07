/**
 * 🔵 MI-REEVAL STEP 1 ① — **전수 조사 입력을 «영속» 으로 만든다**(읽기 전용).
 *
 * 🔴 운영 변경 0 · DB 쓰기 0 · 크롤링 0 · GT 변경 0.
 * 🔴🔴 **왜 fixture 로 옮기는가** — 상세설명 비교 산출(`desc-compare.json`)이 `%TEMP%` 에
 *    있어 **세션이 바뀌면 사라진다**. STEP 1 의 분모가 거기 있으므로 리포 안으로 들여온다.
 *    🟢 단 **원문(설명문 전체)은 옮기지 않는다** — 쌍 식별자와 판정 요약만 가져온다(용량).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = path.join(process.cwd(), "..", "..");
const FIX = path.join(ROOT, "apps", "admin", "src", "app", "api", "price-history", "_lib", "__tests__", "fixtures");
const TMP = path.join(os.tmpdir(), "mi-url-evidence", "desc-compare.json");

/* ── ⒜ 상세설명 비교 109쌍 — 식별자 + 판정 요약만 ─────────────────────────── */
if (!existsSync(TMP)) {
  console.log(`🔴 ${TMP} 가 없다 — 상세설명 비교 쌍을 fixture 로 옮기지 못했다(재생성 필요)`);
} else {
  const d = JSON.parse(readFileSync(TMP, "utf8"));
  const pairs = d.pairs.map((p) => ({
    originCode: p.originCode ?? null,
    originUrl: p.originUrl,
    candidateUrl: p.candidateUrl,
    candidateDomain: p.candidateDomain,
    baselineSystemVerdict: p.baselineSystemVerdict ?? null,
    humanGt: p.humanGt ?? null,
    hasOriginDescription: p.hasOriginDescription,
    hasCandidateDescription: p.hasCandidateDescription,
    /** 🟢 다섯 증거의 «확보 여부» 만 — CEO 기준 ①②③④⑤ 에 대응한다. */
    axisStatus: Object.fromEntries(
      ["BRAND", "MODEL_CODE", "PRODUCT_NAME", "FORM_DESIGN", "COLOR", "MATERIAL"].map((k) => [k, p.axes?.[k]?.status ?? null]),
    ),
    originTitle: p.originTitle ?? null,
    candidateTitle: p.candidateTitle ?? null,
  }));
  writeFileSync(path.join(FIX, "mi-reeval-01-desc-pairs.json"),
    JSON.stringify({ source: "desc-compare.json", note: "🔴 식별자·판정 요약만 · 설명문 원문은 옮기지 않았다", pairs }, null, 1), "utf8");
  console.log(`🟢 desc-pairs fixture — ${pairs.length} 쌍`);
}

/* ── ⒝ `candidate_reviews` 의 **사람 판정 행** 전수 ───────────────────────── */
const p = new PrismaClient();
/**
 * 🔴🔴 **`left join` 이다 — `join` 을 쓰면 행이 조용히 사라진다**(실측).
 * ```
 * human_verdict 전체            **38**
 * product_snapshots 조인 성공    21
 * 🔴 스냅샷이 «없는» 행          **17**  — 전부 `origin_code = B226AC009`
 * ```
 * 1차 구현이 inner join 이라 그 17 행을 버렸고 분모가 38 → 21 로 **조용히** 줄었다.
 * 🟢 그 행의 GT 라벨은 **실재한다** ⟹ 버리지 않고 싣고 `originUrl = null` 로 표시한다
 *    (WU-133 이 기록한 「그 상품 스냅샷이 DB 에 없다」와 **같은 성질** 이다).
 */
const rows = await p.$queryRawUnsafe(`
  select cr.origin_code, cr.candidate_url, cr.candidate_domain, cr.human_verdict, cr.human_note,
         cr.system_verdict, cr.match_truth, cr.price_tier, cr.source, cr.reviewed_at,
         ps.source_url origin_url, ps.title origin_title,
         (ps.id is null) origin_snapshot_missing
    from candidate_reviews cr left join product_snapshots ps on ps.id = cr.snapshot_id
   where cr.human_verdict is not null
   order by cr.reviewed_at nulls last`);
await p.$disconnect();
const clean = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
writeFileSync(path.join(FIX, "mi-reeval-01-db-human.json"),
  JSON.stringify({ source: "candidate_reviews(human_verdict is not null)", rows: clean }, null, 1), "utf8");
console.log(`🟢 db-human fixture — ${clean.length} 행 · 고유 후보 URL ${new Set(clean.map((r) => r.candidate_url)).size}`);
const t = clean.reduce((a, r) => ((a[r.human_verdict] = (a[r.human_verdict] ?? 0) + 1), a), {});
console.log(`   human_verdict 분포: ${JSON.stringify(t)}`);
const missing = clean.filter((r) => r.origin_snapshot_missing);
console.log(`   🔴 원상품 스냅샷 «없는» 행 ${missing.length} — origin_code ${JSON.stringify([...new Set(missing.map((r) => r.origin_code))])}`);
console.log(`      ⟹ 그 행은 **원상품 쪽 증거를 측정할 수 없다**(GT 라벨은 실재한다)`);
