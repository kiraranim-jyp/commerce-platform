/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STEP 3A-R — **게이트 둘을 고치고 재검증한다**(CPO 승인 · 수정·재검증만)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드 · `product-evidence.ts` · 추출기 · matcher · Identity · alias · GT · DB · UI
 *    **변경 0** · **운영 함수 호출 0** · **재방문 0** · `facts.brand` 연결 **0**.
 *
 * 🔴 CPO 가 공식 기록한 결함 둘만 고친다:
 * ```
 * 결함 1  판매처명 게이트 범위가 너무 넓다 — 「Brand : BOBO CHOSES」가 있는데도
 *         판매처명이 원문 «어딘가» 있다는 이유로 AMBIGUOUS 가 됐다(trenbe)
 * 결함 2  한국어 조사와 브랜드 경계를 못 가른다 — 「BOBO CHOSES**의**」를 놓친다
 *         🔴 단 「보보쇼즈st」·「보보쇼즈풍」은 계속 막아야 한다
 * ```
 * 🔴 **새 정규화기 0 · alias 확대 0** — 기존 전처리(NFKC · 소문자 · 경계)에 얹는다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const s2 = JSON.parse(readFileSync(path.join(DIR, "step2-evidence.json"), "utf8"));
const s25 = JSON.parse(readFileSync(path.join(DIR, "step25-brand-reclassify.json"), "utf8"));
const pr = (o) => JSON.stringify(o, null, 1);
const NFKC = (s) => String(s ?? "").normalize("NFKC");
const WORDISH = /[A-Za-z0-9가-힣]/;

/* ═══════ 🟢 수정 B — 한국어 조사를 «경계» 로 인정한다 ══════════════════════
 * 🔴 조사를 **열거** 한다(모든 한글을 허용하면 「보보쇼즈풍」이 통과한다).
 * 🔴 그리고 조사 **뒤가 다시 글자면 막는다** — 「보보쇼즈가방」의 「가」를 조사로 읽지 않기 위해서다.
 */
const PARTICLES = ["으로", "에서", "부터", "까지", "에게", "한테", "은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "도", "만", "로"];
function afterIsOk(text, end, { particles = true } = {}) {
  const after = text[end] ?? "";
  if (!after || !WORDISH.test(after)) return { ok: true, via: "비글자 경계" };
  if (!particles) return { ok: false, via: "글자가 붙어 있다" };
  /** 🟢 긴 조사부터 본다(「으로」가 「로」보다 먼저). */
  for (const p of [...PARTICLES].sort((a, b) => b.length - a.length)) {
    if (text.startsWith(p, end)) {
      const next = text[end + p.length] ?? "";
      if (!next || !WORDISH.test(next)) return { ok: true, via: `조사 「${p}」 경계` };
      return { ok: false, via: `조사처럼 보이나 뒤에 글자가 붙었다(「${p}${next}」)` };
    }
  }
  return { ok: false, via: "조사가 아닌 글자가 붙어 있다(유사품 표기 가능)" };
}

function brandMatches(hay, brand, opt = {}) {
  const raw = NFKC(hay);
  const text = raw.toLowerCase();
  const parts = NFKC(brand).toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean);
  if (!text || parts.length === 0) return [];
  const re = new RegExp(parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_.]*"), "g");
  const hits = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length;
    const before = m.index > 0 ? text[m.index - 1] : "";
    if (opt.boundary !== false && WORDISH.test(before)) continue;
    const a = opt.boundary === false ? { ok: true, via: "경계검사 OFF" } : afterIsOk(text, end, opt);
    if (!a.ok) { hits.push({ index: m.index, matched: raw.slice(m.index, end), rejected: a.via }); continue; }
    hits.push({ index: m.index, matched: raw.slice(m.index, end), boundaryVia: a.via });
  }
  return hits;
}
const accepted = (hits) => hits.filter((h) => !h.rejected);

/* ═══════ 🟢 수정 A — 판매처명 게이트를 «브랜드 자리» 로 좁힌다 ════════════ */
const SELLER_NAMES = ["비스킷", "biskuit", "보몽드", "beaumonde", "piccoli", "petite maison",
  "tinyapple", "junioredition", "junior edition", "donokids", "luxboy", "trenbe", "cemarose",
  "kidbizkid", "designerkidswear", "villagekids", "nickis", "folkberlin", "tiptoeboutique", "stockmann", "miniboutique", "미니부띠끄"];
const BRANDS = [...new Set(s2.rows.flatMap((r) => [r.originBrand, r.liveBrand]).filter(Boolean).map(String))]
  .filter((b) => !SELLER_NAMES.some((s) => NFKC(b).toLowerCase() === NFKC(s).toLowerCase()));

/** 🟢 명시적 브랜드 라벨 — 「Brand : X」 · 「브랜드 : X」. 보호 대상이다. */
const LABEL_RE = /(brand|브랜드)\s*[:：]\s*$/i;
const ATTRIB_LEAD = /\b(by|from|collection)\s*$/i;
/**
 * 🔴 **「브랜드 자리」의 정의** — 라벨 바로 뒤 또는 귀속 문구 바로 뒤.
 *
 * 🔴🔴 **`allowLead`(원문 맨 앞)를 «원상품 브랜드에만» 쓴다.** 재검증 1차에서 찾은 결함:
 * ```
 * 「**미니부띠끄** | BOBO CHOSES의 감각적인 디자인 …」
 * ⟹ 판매처명이 offset 0 이라 「브랜드 자리」로 읽혀 AMBIGUOUS 가 됐다.
 * 🔴 그런데 상점명을 맨 앞에 붙이는 것은 **국내 판매처의 흔한 접두사** 이고
 *    「브랜드 역할」이 아니다 ⟹ 판매처명 게이트에서는 그 근거를 **빼야** 한다.
 * ```
 */
function inBrandRole(text, index, { allowLead = true } = {}) {
  const before = text.slice(Math.max(0, index - 20), index);
  if (LABEL_RE.test(before)) return "라벨(Brand:)";
  if (ATTRIB_LEAD.test(before)) return "귀속문구(by/from/collection)";
  if (allowLead && index === 0) return "원문 맨 앞";
  return null;
}

function resolve(hay, originBrand, opt = {}) {
  const { gateAttribution = true, gateSeller = true, gateOtherBrand = true, particles = true, boundary = true } = opt;
  if (!originBrand) return { status: "NOT_EVALUABLE", why: "🔴 원상품 브랜드가 null — 평가 자체가 성립하지 않는다" };
  const raw = NFKC(hay);
  const text = raw.toLowerCase();
  const all = brandMatches(hay, originBrand, { particles, boundary });
  const hits = accepted(all);
  if (hits.length === 0) {
    return { status: "ABSENT", why: all.length ? `문자열은 있으나 경계 거부(${all[0].rejected})` : "원문에 브랜드 문자열이 없다", rejectedHits: all };
  }
  const role = hits.map((h) => ({ h, role: inBrandRole(text, h.index) })).find((x) => x.role);

  /** 🟢🟢 **수정 A-1** — 명시적 라벨은 판매처명 게이트보다 **먼저** 보호한다. */
  if (role?.role === "라벨(Brand:)") {
    return { status: "ATTRIBUTED", why: "명시적 브랜드 라벨(판매처명 게이트 면제)", hits, role: role.role, labelProtected: true };
  }

  /** 🟢🟢 **수정 A-2** — 판매처명이 «브랜드 자리» 에 있을 때만 게이트가 발화한다. */
  /** 🔴 `allowLead: false` — 판매처명이 **맨 앞** 인 것은 상점 접두사이고 브랜드 역할이 아니다. */
  const sellerInRole = gateSeller
    ? SELLER_NAMES.filter((s) => accepted(brandMatches(hay, s, { particles })).some((h) => inBrandRole(text, h.index, { allowLead: false })))
    : [];
  const otherInRole = gateOtherBrand
    ? BRANDS.filter((b) => {
        const nb = NFKC(b).toLowerCase(), no = NFKC(originBrand).toLowerCase();
        if (nb.includes(no) || no.includes(nb)) return false;
        return accepted(brandMatches(hay, b, { particles })).some((h) => inBrandRole(text, h.index, { allowLead: false }));
      })
    : [];
  if (sellerInRole.length > 0 || otherInRole.length > 0) {
    return { status: "AMBIGUOUS", why: `브랜드 자리에 충돌 — 판매처명[${sellerInRole.join("|")}] 다른브랜드[${otherInRole.join("|")}]`, hits, sellerInRole, otherInRole };
  }
  if (!gateAttribution || role) {
    return { status: "ATTRIBUTED", why: role ? `귀속 문맥 — ${role.role}` : "🔴 귀속 게이트 OFF", hits, role: role?.role ?? null };
  }
  return { status: "MENTIONED", why: "문자열은 있으나 브랜드 자리가 아니다", hits };
}

/* ═══════ §1 한국어 조사 ↔ 유사품 — 합격 조건 직접 검증 ══════════════════ */
/**
 * 🔴 **1차 케이스 하나가 틀렸다** — 「BOBO CHOSES의 …」를 **한글 alias 「보보쇼즈」로**
 *    검색해 「차단」이 나왔다. 그것은 조사 문제가 아니라 **음역 문제** 이고 내 케이스 오류다.
 * 🟢 실제 코퍼스 모양대로 **검색어를 같이** 적는다(라틴 원문은 라틴 브랜드로 찾는다).
 */
const KO_CASES = [
  ["보보쇼즈의 감각적인 디자인", true, "보보쇼즈"], ["보보쇼즈는 스페인 브랜드", true, "보보쇼즈"],
  ["보보쇼즈가 만든 티셔츠", true, "보보쇼즈"], ["보보쇼즈를 좋아합니다", true, "보보쇼즈"],
  ["보보쇼즈에서 나온 신상", true, "보보쇼즈"],
  ["BOBO CHOSES의 감각적인 디자인", true, "Bobo Choses"],
  ["보보쇼즈st 티셔츠", false, "보보쇼즈"], ["보보쇼즈풍 디자인", false, "보보쇼즈"],
  ["보보쇼즈가방 세트", false, "보보쇼즈"], ["보보쇼즈스타일", false, "보보쇼즈"],
];
console.log("═".repeat(84));
console.log("  STEP 3A-R — 게이트 둘 수정 후 재검증(운영 변경 0 · 호출 0 · 재방문 0)");
console.log("═".repeat(84));
console.log("\n§1 한국어 조사 ↔ 유사품 표기 (합격 조건 직접 검증)");
let koPass = 0;
for (const [s, want, term] of KO_CASES) {
  const got = accepted(brandMatches(s, term)).length > 0;
  const all = brandMatches(s, term);
  const ok = got === want;
  if (ok) koPass += 1;
  console.log(`  ${ok ? "🟢" : "🔴"} 「${s}」 기대 ${want ? "인식" : "차단"} · 실제 ${got ? "인식" : "차단"}${all[0]?.boundaryVia ? ` (${all[0].boundaryVia})` : all[0]?.rejected ? ` (${all[0].rejected})` : ""}`);
}
console.log(`  ⟹ ${koPass}/${KO_CASES.length}`);

/* ═══════ §2 62건 전후 비교(행별 변화와 이유) ═══════════════════════════ */
const A62 = s25.rows.filter((x) => x.type === "A_TRUE_EXTRACTION_MISS");
const rowOf = (u, oc) => s2.rows.find((x) => x.candidateUrl === u && (oc == null || x.originCode === oc)) ?? s2.rows.find((x) => x.candidateUrl === u);
const hayOf = (r) => ({ desc: r?.descriptionRaw ?? null, title: r?.liveTitle ?? r?.baselineTitle ?? null });

const compare = A62.map((x) => {
  const r = rowOf(x.url, x.originCode); const { desc, title } = hayOf(r);
  const pickWith = (opt) => {
    const d = resolve(desc ?? "", x.originBrand, opt);
    return d.status !== "ABSENT" && d.status !== "NOT_EVALUABLE" ? { src: "DESCRIPTION", ...d } : { src: "TITLE", ...resolve(title ?? "", x.originBrand, opt) };
  };
  /** 🔴 BEFORE = STEP 3A 규칙(조사 미인정 · 판매처명 원문 전체) */
  const before = pickWith({ particles: false, sellerWholeText: true });
  const after = pickWith({});
  return { domain: x.domain, url: x.url, originBrand: x.originBrand, ceoGt: x.ceoGt,
    beforeStatus: before.status, afterStatus: after.status, changed: before.status !== after.status,
    afterWhy: after.why, role: after.role ?? null, sourceType: after.src, labelProtected: !!after.labelProtected };
});
const tally = (xs, f) => xs.reduce((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});
console.log("\n§2 62건 — 수정 후 상태 분포");
console.log(pr(tally(compare, (x) => x.afterStatus)));
console.log("귀속 근거:", pr(tally(compare, (x) => x.role ?? "(없음)")));
console.log("🔴 상태가 바뀐 행:", compare.filter((x) => x.changed).length);
for (const c of compare.filter((x) => x.changed)) console.log(`   ${String(c.domain).padEnd(22)} ${c.beforeStatus} → ${c.afterStatus} · ${c.afterWhy}`);

/* ═══════ §3 기존 BRAND 증거 6건 전수 ══════════════════════════════════ */
console.log("\n§3 기존 BRAND 증거 6건 — 전수 원문·결과");
const six = s2.rows.filter((r) => (r.evidenceBrandSources ?? []).length > 0);
const reverse = six.map((r) => {
  const hay = r.descriptionRaw ?? r.liveTitle ?? "";
  const res = resolve(hay, r.originBrand);
  const h = res.hits?.[0];
  /** 🔴 **게이트가 «필요한» 사례** — 판매처명이 브랜드 자리에 있는가(biskuit 「비스킷」 모양). */
  const sellerInBrandRole = SELLER_NAMES.filter((s) => accepted(brandMatches(hay, s)).some((x) => inBrandRole(NFKC(hay).toLowerCase(), x.index)));
  return { domain: r.candidateDomain, url: r.candidateUrl, originBrand: r.originBrand, liveBrand: r.liveBrand,
    existingEvidence: r.evidenceBrandSources, status: res.status, why: res.why, role: res.role ?? null,
    labelProtected: !!res.labelProtected, sellerInBrandRole,
    excerpt: h ? `…${NFKC(hay).slice(Math.max(0, h.index - 45), h.index + 55)}…` : null };
});
for (const x of reverse) {
  console.log(`\n   ${String(x.domain ?? "(null)").padEnd(20)} 기존증거 ${x.existingEvidence.join("+")} · 원상품 「${x.originBrand ?? "null"}」`);
  console.log(`      → **${x.status}**${x.labelProtected ? " 🟢라벨보호" : ""} (${x.why})`);
  if (x.sellerInBrandRole.length) console.log(`      🔴 판매처명이 «브랜드 자리» 에 있다: ${x.sellerInBrandRole.join("|")} ⟹ 게이트가 «필요한» 사례`);
  if (x.excerpt) console.log(`      ${x.excerpt}`);
}

/* ═══════ §4 귀속 게이트 제거 시 오탐 재현 ═════════════════════════════ */
console.log("\n§4 귀속 게이트 제거 — 오탐이 재현되는가");
let reproduced = 0;
for (const x of A62) {
  const r = rowOf(x.url, x.originCode); const { desc, title } = hayOf(r); const hay = desc ?? title ?? "";
  const on = resolve(hay, x.originBrand); const off = resolve(hay, x.originBrand, { gateAttribution: false });
  if (on.status === "MENTIONED" && off.status === "ATTRIBUTED") {
    reproduced += 1;
    const h = off.hits?.[0];
    console.log(`   🔴 ${x.domain} MENTIONED→ATTRIBUTED  …${NFKC(hay).slice(Math.max(0, (h?.index ?? 0) - 50), (h?.index ?? 0) + 50)}…`);
  }
}
console.log(`   ⟹ 재현 ${reproduced}건`);

const out = { koCases: KO_CASES.map(([s, w, t]) => ({ text: s, term: t, expect: w ? "인식" : "차단", got: accepted(brandMatches(s, t)).length > 0 ? "인식" : "차단" })),
  afterTally: tally(compare, (x) => x.afterStatus), roleTally: tally(compare, (x) => x.role ?? "(없음)"),
  changed: compare.filter((x) => x.changed), rows: compare, reverse, attributionGateReproduced: reproduced,
  gtCount: compare.filter((x) => x.ceoGt).length, unmeasurable: compare.filter((x) => !x.ceoGt).length };
writeFileSync(path.join(DIR, "step3ar-revised.json"), pr(out), "utf8");
const cols = ["domain", "originBrand", "beforeStatus", "afterStatus", "changed", "role", "sourceType", "labelProtected", "ceoGt", "url", "afterWhy"];
writeFileSync(path.join(DIR, "step3ar-revised.csv"),
  [cols.join(","), ...compare.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n"), "utf8");
console.log(`\n§5 GT 보유 ${out.gtCount} / 62 · 🔴 측정불가 ${out.unmeasurable}`);
console.log(`🟢 산출: step3ar-revised.json · .csv`);
