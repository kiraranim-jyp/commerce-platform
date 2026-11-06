/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 — **기존 CEO 검수 HTML 의 이미지를 HIGH 48건에 연결**(CPO ⒜ 승인)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 승인 조건을 **글자 그대로** 지킨다:
 * ```
 * ✅ 기존 HTML 내부 이미지 자료 «만» 사용        ❌ 사이트 재접속 · 재추출 · 신규 수집
 * ✅ 후보 URL 과 HTML 기록 URL **완전 일치**     ❌ 유사 URL · 상품명 · 브랜드 추정 연결
 * ✅ 원본·출처 보존                             ❌ 판정(CONFIRMED/REJECTED)
 * ```
 *
 * 🟢 **연결 규칙이 기계적이다**(추정이 아니다 · 실측 구조):
 *    생성된 검수 HTML 은 카드 하나가 `<img src="data:…">` → … → `<a href="후보URL">`
 *    순서다. ⟹ `<img` 로 자른 **같은 조각 안의 첫 http href** 가 그 이미지의 후보다.
 *    🔴 그 href 가 후보 URL 과 **완전히 같지 않으면 연결하지 않는다.**
 *
 * 🔴 DB 쓰기 0 · HTTP 0 · 판정 0.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { classifySellerProbability } from "../../../apps/admin/src/app/pipeline/commerce/seller-probability.ts";
import { splitEvidenceReasons } from "../../../apps/admin/src/app/pipeline/commerce/blocker-text.ts";

const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select cr.origin_code, cr.candidate_domain, cr.candidate_url, cr.candidate_title,
         cr.human_verdict, cr.system_verdict, cr.match_truth, cr.price_amount, cr.price_currency,
         cr.price_status, cr.price_tier, cr.market, cr.image_url, cr.source,
         cr.blockers::text blk, cr.match_reasons::text rsn,
         ps.source_url origin_url,
         ps.workspace->'canonicalProduct'->'title'->>'value' origin_title,
         ps.workspace->'canonicalProduct'->'brand'->>'value' origin_brand
    from candidate_reviews cr
    left join product_snapshots ps on ps.id = cr.snapshot_id`);

const J = (s) => { try { const v = JSON.parse(s ?? "null"); return Array.isArray(v) ? v : []; } catch { return []; } };
const pad = (s, n) => String(s ?? "-").padEnd(n);

const A = rows.map((r) => {
  const ag = splitEvidenceReasons(J(r.rsn));
  const res = classifySellerProbability({ crossSellerBlockers: J(r.blk), crossSellerConflicts: null, matchTruth: r.match_truth, agreement: ag });
  return { r, res, ag };
});
const HIGH = A.filter((a) => a.res.probability === "HIGH");

/* ── ① HTML 12종에서 (후보 URL → 이미지) 색인을 만든다 ─────────────────── */
const IMG_RE = /<img\b/gi;
const HREF_RE = /href="(https?:\/\/[^"]+)"/i;
const SRC_RE = /src="(data:image\/[a-z+]*;base64,[A-Za-z0-9+/=]+)"/i;

const index = new Map(); // url -> { file, bytes }
const files = readdirSync("docs").filter((f) => f.endsWith(".html"));
let totalCards = 0;
console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 — HTML 이미지 연결 (완전 일치 · 추정 연결 0)");
console.log("══════════════════════════════════════════════════════════════════\n");
console.log("── ① HTML 색인 ──");
for (const f of files) {
  const s = readFileSync(path.join("docs", f), "utf8");
  /** 🟢 `<img` 경계로 잘라 **같은 조각 안의** 첫 href 와 첫 data: src 만 본다. */
  const parts = s.split(IMG_RE);
  let cards = 0;
  let linked = 0;
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const src = SRC_RE.exec(seg.slice(0, 400_000));
    if (!src) continue;
    cards++;
    const href = HREF_RE.exec(seg);
    if (!href) continue;
    const u = href[1];
    if (!index.has(u)) {
      index.set(u, { file: f, bytes: src[1].length });
      linked++;
    }
  }
  totalCards += cards;
  console.log(`  ${pad(f, 36)} 이미지 카드 ${String(cards).padStart(4)} · 새 URL 색인 ${linked}`);
}
console.log(`  🟢 총 이미지 카드 ${totalCards} · 고유 URL 색인 **${index.size}**`);

/* ── ② HIGH 48건 연결 ──────────────────────────────────────────────────── */
console.log("\n── ② HIGH 48건 이미지 연결(완전 일치) ──");
const link = HIGH.map(({ r, res, ag }) => {
  const hit = index.get(r.candidate_url) ?? null;
  return {
    r, res, ag,
    htmlFile: hit?.file ?? null,
    htmlUrl: hit ? r.candidate_url : null,
    exact: Boolean(hit),
    bytes: hit?.bytes ?? 0,
    fail: hit ? null : "HTML 색인에 **완전 일치 URL 없음**",
  };
});
const ok = link.filter((x) => x.exact);
console.log(`  🟢 연결 성공 **${ok.length} / ${HIGH.length}**   🔴 실패 ${HIGH.length - ok.length}`);
const byFile = new Map();
for (const x of ok) byFile.set(x.htmlFile, (byFile.get(x.htmlFile) ?? 0) + 1);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`     ${pad(f, 36)} ${n}건`);
if (ok.length < HIGH.length) {
  console.log("  🔴 실패 후보(전수 · 추정 연결하지 않았다):");
  for (const x of link.filter((y) => !y.exact).slice(0, 12))
    console.log(`     ${pad(x.r.candidate_domain, 26)} ${String(x.r.candidate_url).slice(0, 62)}`);
}

/* ── ③ 근거 충분성 — CPO 정정 기준(모든 축 필수 ❌) ────────────────────── */
console.log("\n── ③ 근거 충분성 재평가(🔴 모든 축 필수 조건을 «적용하지 않는다») ──");
let judgeable = 0, strongConf = 0, review = 0;
for (const x of link) {
  const hasImage = x.exact;
  const hasReason = x.ag.agree.length > 0 || x.ag.hold.length > 0;
  const axes = x.res.findings.filter((f) => f.state !== "UNKNOWN").length;
  if (x.res.strongMismatchCount > 0) { strongConf++; x.sufficiency = "강한 불일치 표시"; }
  else if (hasImage || (hasReason && axes >= 2)) { judgeable++; x.sufficiency = "CPO 판단 가능"; }
  else { review++; x.sufficiency = "CPO_REVIEW 제안"; }
}
console.log(`  🟢 **CPO 판단 가능 ${judgeable}**(이미지 연결됨 ‖ 근거문장+축 2개 이상)`);
console.log(`  🟡 강한 불일치 표시 ${strongConf}   🔴 CPO_REVIEW 제안 ${review}`);
console.log(`  🔴 근거문장 미확보 ${link.filter((x) => x.ag.agree.length === 0 && x.ag.hold.length === 0).length}건 — **문장을 지어내지 않았다**`);

/* ── ④ 가격·원상품 연결 ───────────────────────────────────────────────── */
const ver = link.filter((x) => x.r.price_status === "VERIFIED_CURRENT" && x.r.price_amount != null && x.r.origin_code && x.r.origin_url);
console.log(`\n── ④ 가격 ──\n  확정 가격 × 원상품 연결 **${ver.length}건**`);
const cur = new Map();
for (const x of ver) {
  const k = x.r.price_currency ?? "?";
  const v = Number(x.r.price_amount);
  const c = cur.get(k);
  if (!c || v < c.v) cur.set(k, { v, dom: x.r.candidate_domain, origin: x.r.origin_code, img: x.exact });
}
for (const [k, x] of cur)
  console.log(`  🟢 ${pad(k, 5)} 최저 ${String(x.v).padStart(8)}  ${pad(x.dom, 26)} 원상품 ${x.origin}  이미지 ${x.img ? "🟢연결" : "🔴없음"}`);

/* ── ⑤ CPO 제출 패키지 ────────────────────────────────────────────────── */
const dir = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const head = [
  "원상품식별자", "원상품명", "원상품브랜드", "원상품URL",
  "후보상품명", "후보판매처", "후보URL", "시장",
  "1차판정", "BRAND", "PRODUCT_NAME", "DETAIL_IDENTIFIER", "관측축수",
  "핵심일치근거", "핵심불일치근거", "보조근거",
  "이미지_HTML파일", "이미지_URL완전일치", "이미지_바이트", "이미지_연결실패사유",
  "가격", "통화", "가격검증상태", "원상품연결",
  "근거충분성(CTO제안)", "CPO_2차판정(공란)", "CPO_판정사유(공란)",
].join("\t");
const body = link.map((x) => [
  x.r.origin_code, x.r.origin_title, x.r.origin_brand, x.r.origin_url,
  x.r.candidate_title, x.r.candidate_domain, x.r.candidate_url, x.r.market,
  x.res.probability, ...x.res.findings.map((f) => f.state), x.res.findings.filter((f) => f.state !== "UNKNOWN").length,
  x.ag.agree.join(" | "), x.ag.hold.join(" | "), x.res.supporting.join(" | "),
  x.htmlFile, x.exact ? "완전일치" : "", x.bytes, x.fail,
  x.r.price_amount, x.r.price_currency, x.r.price_status,
  x.r.origin_code && x.r.origin_url ? "연결됨" : "🔴 연결없음",
  x.sufficiency, "", "",
].map((v) => String(v ?? "").replace(/[\t\n]/g, " ")).join("\t"));
writeFileSync(path.join(dir, "mls2-HIGH48-with-images.tsv"), [head, ...body].join("\n"), "utf8");

/** 🟢 CPO 가 **눈으로** 볼 수 있게 — 연결된 이미지를 그대로 담은 자립형 HTML. */
const cards = link.filter((x) => x.exact).map((x) => {
  const i = index.get(x.r.candidate_url);
  const seg = readFileSync(path.join("docs", i.file), "utf8");
  const at = seg.indexOf(x.r.candidate_url);
  const back = seg.slice(Math.max(0, at - 400_000), at);
  const m = [...back.matchAll(/src="(data:image\/[a-z+]*;base64,[A-Za-z0-9+/=]+)"/g)].pop();
  return `<div class="c"><img src="${m ? m[1] : ""}" alt=""><div><b>${x.r.candidate_title ?? "(제목 없음)"}</b><br>
    <span class="s">${x.r.candidate_domain} · 원상품 ${x.r.origin_code ?? "🔴 연결없음"} · ${x.r.price_amount ?? "-"} ${x.r.price_currency ?? ""} ${x.r.price_status ?? ""}</span><br>
    <span class="a">일치: ${x.ag.agree.join(" / ") || "(근거문장 미확보)"}</span><br>
    <span class="h">보류: ${x.ag.hold.join(" / ") || "-"}</span><br>
    <span class="s">축 — ${x.res.findings.map((f) => `${f.axis}:${f.state}`).join(" · ")}</span><br>
    <a href="${x.r.candidate_url}" target="_blank" rel="noreferrer">링크 ↗</a>
    <span class="s"> · 이미지 출처 ${i.file}</span></div></div>`;
});
writeFileSync(
  path.join(dir, "mls2-HIGH48-review.html"),
  `<meta charset="utf-8"><title>MLS2 HIGH48 — CPO 2차 검증</title><style>
body{font:14px system-ui;margin:16px}.c{display:flex;gap:12px;border:1px solid #ddd;border-radius:8px;padding:10px;margin:8px 0}
.c img{width:120px;height:120px;object-fit:contain;background:#fafafa}.s{color:#666;font-size:12px}.a{color:#0a0}.h{color:#a60}
h1{font-size:18px}</style><h1>MLS2 HIGH48 — CPO 2차 검증용 (이미지 연결 ${cards.length}건)</h1>
<p class="s">🔴 CTO 는 판정하지 않았습니다. 이미지는 기존 검수 HTML 에서 <b>URL 완전 일치</b>로만 연결했습니다(추정 연결 0).</p>
${cards.join("\n")}`,
  "utf8",
);
console.log(`\n🟢 CPO 제출 — ${path.join(dir, "mls2-HIGH48-with-images.tsv")}  (${body.length}행 · 27칸)`);
console.log(`🟢 CPO 제출 — ${path.join(dir, "mls2-HIGH48-review.html")}  (이미지 ${cards.length}건 · 자립형)`);
console.log("🔴 `CPO_2차판정` 칸은 **공란** 이다 — CTO 가 판정하지 않았다.");
console.log("\n🔴 읽기만 했다 — 사이트 접속 0 · 재추출 0 · 추정 연결 0 · DB 쓰기 0 · 판정 0.");
await p.$disconnect();
