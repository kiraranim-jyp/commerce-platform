/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STEP 3A-GT — **GT 확대 «대상 단위·분포» 확정**(CPO 승인 범위)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **신규 GT 행을 만들지 않는다** — CPO: 「신규 GT 행 추가 = CEO 직접 판정 후 허용」.
 *    DB **쓰기 0** · UPDATE **0** · GT 변경 **0** · 운영 코드/추출기/matcher/UI/schema **0** · 재방문 **0**.
 *
 * 🔴🔴 **판정 «단위» 를 행 수로 세면 틀린다 — 이 파일의 핵심이다.**
 * ```
 * A 62건 중 GT 없는 «행»              58
 * 그 행의 고유 후보 URL                19   ← 같은 후보가 여러 스냅샷에 붙어 있다
 * 고유 (원상품URL, 후보URL) 조합       22   ← 🟢 **GT 의 진짜 단위**
 * 그중 이미 GT 가 있는 조합             1
 * ⟹ 🟢 **신규 판정 대상 = 21 조합**(58 이 아니다)
 * 원인 — 같은 원상품을 반복 분석한 스냅샷이 쌓였다(제목 1개가 38행) ·
 *        메모 `same-product-splits-by-store-and-query` 와 같은 성질
 * ```
 *
 * 🔴 CPO 실행 조건 대조 — **둘이 충족되지 않는다**:
 * ```
 * ① 기존 GT 4건 수정·덮어쓰기 0   🟢 읽기만 한다
 * ② 기존에 없는 (원상품,후보URL) 조합만
 *                                 🔴 **58행은 전부 «이미 있는 행» 이다**(그 행에서 뽑았다) ·
 *                                    🟢 단 그 행에 `human_verdict` 는 **없다**(60/62) ⟹ §4
 * ③ 시스템 판정·규칙 상태 선노출 금지
 *                                 🔴 **기존 화면이 못 지킨다** — §5 실측
 * ④ 기존 4상태 사용               🟢 `HUMAN_VERDICTS` 그대로 · 새 상태 0
 * ⑦ 기존 행 UPDATE 0             🔴 **같은 자리**(②와 하나의 사안) ⟹ §4
 * ```
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const J = (f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8"));
const pr = (o) => JSON.stringify(o, null, 1);
const p = new PrismaClient();
const q = (s) => p.$queryRawUnsafe(s);
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const tally = (xs, f) => xs.reduce((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});

/**
 * 🔴 두 산출의 행 정렬을 **확인하고** 쓴다 — 인덱스로 라벨을 붙이지 않는다(WU-095 교훈).
 *   `step3ar-revised` 는 originCode 칸이 **없고** `step25-brand-reclassify` 에 있다.
 */
const ar = J("step3ar-revised.json").rows;
const rc = J("step25-brand-reclassify.json").rows;
const s2 = J("step2-evidence.json").rows;
if (ar.length !== rc.length) throw new Error("정렬 불가 — 행 수 불일치");
for (let i = 0; i < ar.length; i += 1) {
  if (ar[i].url !== rc[i].url || ar[i].domain !== rc[i].domain || ar[i].originBrand !== rc[i].originBrand) {
    throw new Error(`정렬 불가 — ${i} 번째 행이 다르다`);
  }
}

const rowsNoGt = rc
  .map((r, i) => ({ ...r, afterStatus: ar[i].afterStatus, role: ar[i].role ?? null, sourceType: ar[i].sourceType, ceoGt: ar[i].ceoGt }))
  .filter((r) => !r.ceoGt);

console.log("═".repeat(80));
console.log("  STEP 3A-GT — GT 확대 대상 준비 (DB 쓰기 0 · GT 변경 0)");
console.log("═".repeat(80));

/* ── §1 단위 확정 ────────────────────────────────────────────────────────── */
const urls = [...new Set(rowsNoGt.map((r) => r.url))];
const db = await q(`
  select cr.id, cr.snapshot_id, cr.origin_code, cr.candidate_url, cr.source,
         cr.human_verdict, cr.system_verdict, cr.price_tier, cr.match_truth, cr.blockers,
         cr.candidate_title, cr.price_amount, cr.price_currency, cr.image_url,
         ps.source_url origin_url, ps.title origin_title, ps.product_id
    from candidate_reviews cr join product_snapshots ps on ps.id = cr.snapshot_id
   where cr.candidate_url in (${urls.map(lit).join(",")})`);

const combo = (r) => `${r.origin_url} >> ${r.candidate_url}`;
const byCombo = new Map();
for (const r of db) {
  const k = combo(r);
  const cur = byCombo.get(k);
  /** 🔴 같은 조합의 여러 스냅샷 중 **GT 가 있는 행을 우선** 보존한다(덮지 않기 위해). */
  if (!cur || (!cur.human_verdict && r.human_verdict)) byCombo.set(k, r);
  if (cur) (cur.dupes ??= []).push(r.snapshot_id);
}
const comboRows = [...byCombo.values()];
const fresh = comboRows.filter((r) => !r.human_verdict);

console.log(`\n§1 판정 단위`);
console.log(`   A 62건 중 GT 없는 «행»        ${rowsNoGt.length}`);
console.log(`   그 행의 고유 후보 URL          ${urls.length}`);
console.log(`   고유 (원상품URL, 후보URL) 조합 ${comboRows.length}`);
console.log(`   그중 이미 GT 있는 조합          ${comboRows.length - fresh.length}`);
console.log(`   🟢 **신규 판정 대상 = ${fresh.length} 조합**  (🔴 58 이 아니다)`);
console.log(`   🔴 신규 GT 판정 **완료 0** · **미완료 ${fresh.length}**`);

/* ── §2 분포 ─────────────────────────────────────────────────────────────── */
const metaOf = (r) => rowsNoGt.find((x) => x.url === r.candidate_url) ?? {};
const enriched = fresh.map((r) => {
  const m = metaOf(r);
  const ev = s2.find((x) => x.candidateUrl === r.candidate_url) ?? {};
  const sameHost = (() => {
    try { return new URL(r.origin_url).hostname.replace(/^www\./, "") === new URL(r.candidate_url).hostname.replace(/^www\./, ""); }
    catch { return null; }
  })();
  return {
    originTitle: r.origin_title, originUrl: r.origin_url, originBrand: m.originBrand ?? null,
    candidateUrl: r.candidate_url, candidateDomain: m.domain ?? null,
    /** 🔴 같은 판매처의 다른 리스팅은 동일성 축이 다르다(`sameSellerDistinctListing`). */
    sameHostAsOrigin: sameHost,
    snapshotId: r.snapshot_id, source: r.source, snapshotDupes: (r.dupes ?? []).length + 1,
    /** 🔴 **판정자에게 가릴** 칸 — 조건 ③. */
    _hidden_systemVerdict: r.system_verdict, _hidden_priceTier: r.price_tier,
    _hidden_matchTruth: r.match_truth, _hidden_blockers: r.blockers,
    _hidden_ruleStatus: m.afterStatus ?? null, _hidden_ruleRole: m.role ?? null,
    /** 🟢 판정자에게 **보여줄** 근거 — 🔴 DB 값을 우선한다(조사 캐시는 보조). */
    candidateTitle: r.candidate_title ?? ev.liveTitle ?? ev.baselineTitle ?? null,
    imageUrl: r.image_url ?? ev.imageUrl ?? null,
    priceAmount: r.price_amount ?? null, priceCurrency: r.price_currency ?? null,
    hasDescription: ev.hasDescription ?? null, descriptionLength: ev.descriptionLength ?? null,
  };
});

console.log("\n§2 분포(신규 21 조합)");
console.log("  원상품 브랜드:", pr(tally(enriched, (x) => x.originBrand ?? "(미상)")));
console.log("  후보 판매처:", pr(tally(enriched, (x) => x.candidateDomain ?? "(미상)")));
console.log("  규칙 상태(가림 대상):", pr(tally(enriched, (x) => x._hidden_ruleStatus ?? "(없음)")));
console.log("  설명문 보유:", pr(tally(enriched, (x) => (x.hasDescription ? "있다" : "없다"))));
console.log("  🔴 원상품 호스트 == 후보 호스트:", enriched.filter((x) => x.sameHostAsOrigin).length,
  "건 ⟹ 「같은 판매처 다른 리스팅」 축이라 판정 기준이 다르다");
const bt = tally(enriched, (x) => x.originBrand ?? "(미상)");
const top = Math.max(...Object.values(bt));
console.log(`  🔴 편향 — 최다 브랜드 ${top}/${enriched.length} = ${Math.round((top / enriched.length) * 100)}%`);
console.log("  🟢 층화 — 브랜드×판매처 조합당 상한: cap1", (() => {
  const s = {}; let n = 0;
  for (const x of enriched) { const k = `${x.originBrand}|${x.candidateDomain}`; s[k] = (s[k] ?? 0) + 1; if (s[k] <= 1) n += 1; }
  return n;
})(), "· cap2", (() => {
  const s = {}; let n = 0;
  for (const x of enriched) { const k = `${x.originBrand}|${x.candidateDomain}`; s[k] = (s[k] ?? 0) + 1; if (s[k] <= 2) n += 1; }
  return n;
})());

/* ── §3 기준선 — 「변경 0」 대조용 ───────────────────────────────────────── */
const base = await q(`select count(*)::int rows,
  count(*) filter (where human_verdict is not null)::int gt_rows,
  count(distinct human_verdict)::int states from candidate_reviews`);
const gtCombos = await q(`select count(distinct ps.source_url || ' >> ' || cr.candidate_url)::int c
  from candidate_reviews cr join product_snapshots ps on ps.id=cr.snapshot_id
 where cr.human_verdict is not null`);
console.log(`\n§3 기준선(이 세션 «변경 0» 대조용)`);
console.log(`   candidate_reviews 행 ${base[0].rows} · GT 행 ${base[0].gt_rows} · GT 조합 ${gtCombos[0].c}`);
console.log(`   🔴 기존 GT 변경/UPDATE 발생: **0** (이 파일은 SELECT 만 한다)`);

/* ── §4 조건 ②⑦ — 「신규 조합」인데 「기존 행」이다 ──────────────────────── */
const hasRow = fresh.length;
console.log(`\n§4 조건 ②⑦ 실측`);
console.log(`   신규 판정 대상 ${fresh.length} 조합 중 **candidate_reviews 에 행이 이미 있는 것 ${hasRow}** (= 전부)`);
console.log(`   그 행의 human_verdict: 전건 **null** · system_* 칸은 채워져 있다`);
console.log(`   ⟹ 🔴 판정을 저장하면 그 행의 **UPDATE** 가 된다`);
console.log(`   🟢 단 079 계약이 그 쓰기를 **설계된 경로** 로 규정한다 —`);
console.log(`      「system_* 와 human_verdict 는 서로 덮지 않는다」 · WU-141-R1 이 저장 경로를`);
console.log(`      「조회 → update(id) / insert」로 고쳤다 ⟹ seen 행에 GT 를 더하는 것이 정상 경로다`);
console.log(`   🔴 ⟹ 조건 ⑦ 을 «문자 그대로» 보면 대상이 **0건** 이다. CTO 가 판정하지 않는다 — CPO 사안`);

/* ── §5 조건 ③ — 기존 화면이 선노출한다 ─────────────────────────────────── */
const uiPath = path.join(process.cwd(), "..", "..", "apps", "admin", "src", "app", "pipeline", "commerce", "GeminiTransientCandidates.tsx");
const ui = readFileSync(uiPath, "utf8");
const stripped = ui.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const probes = {
  "gt-verdict(시스템 판정)": /data-testid="gt-verdict"/.test(stripped),
  "gt-display-state(규칙 상태)": /data-testid="gt-display-state"/.test(stripped),
  "gt-display-reason(규칙 근거)": /data-testid="gt-display-reason"/.test(stripped),
  "gt-blockers(차단 사유)": /data-testid="gt-blockers"/.test(stripped),
  "사람 판정 버튼(onReview)": /onReview/.test(stripped),
};
console.log(`\n§5 조건 ③ 실측 — 기존 검토 화면(${path.basename(uiPath)})`);
for (const [k, v] of Object.entries(probes)) console.log(`   ${v ? "🔴 렌더한다" : "🟢 없다"}  ${k}`);
console.log("   ⟹ 🔴🔴 판정 버튼과 시스템 판정이 **같은 카드** 에 있다 ⟹ 조건 ③ **미충족**");
console.log("   🟢 리포 선례 — 통제 노출 GT 수집은 `apps/admin` «밖» 자립 HTML 로 했다");
console.log("      (`docs/wu-093-gt-review.html` · `wu-112-candidate-list.html` · `core-desc-evidence-review.html`)");
console.log("   🔴 어느 쪽으로 갈지 **CTO 가 고르지 않았다** — 화면 변경은 미승인이다");

/* ── 산출 ────────────────────────────────────────────────────────────────── */
writeFileSync(path.join(DIR, "step3agt-targets.json"), pr({
  unit: { rowsNoGt: rowsNoGt.length, uniqueCandidateUrls: urls.length, combos: comboRows.length, newTargets: fresh.length },
  newGtCompleted: 0, newGtPending: fresh.length,
  baseline: { rows: base[0].rows, gtRows: base[0].gt_rows, gtCombos: gtCombos[0].c, changedByThisStep: 0 },
  conditions: { c2_allRowsAlreadyExist: hasRow, c3_uiHidesSystemVerdict: !probes["gt-verdict(시스템 판정)"], c7_wouldRequireUpdate: hasRow },
  sellerNameInBrandRole: 0,
  targets: enriched,
}), "utf8");
const cols = ["originTitle", "originBrand", "originUrl", "candidateDomain", "candidateTitle", "priceAmount", "priceCurrency", "hasDescription", "sameHostAsOrigin", "candidateUrl"];
writeFileSync(path.join(DIR, "step3agt-targets.csv"),
  [cols.join(","), ...enriched.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n"), "utf8");
console.log(`\n🟢 산출 step3agt-targets.json / .csv — 🔴 \`_hidden_*\` 칸은 판정자에게 가린다`);
await p.$disconnect();
