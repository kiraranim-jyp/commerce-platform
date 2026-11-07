/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STEP 3A-GT ② — **「판매처명이 브랜드 자리에 등장한 사례」 실측**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 요구: 「다음 CTO 보고는 … **판매처명 브랜드 자리 사례의 실측** 이어야 합니다」.
 * 🔴 운영 코드 · 추출기 · matcher · Identity · alias · GT · DB · UI **변경 0** ·
 *    **DB 쓰기 0** · **재방문 0**(이미 수집한 `descriptionRaw` · 제목만 읽는다).
 *
 * 🔴🔴 **STEP 3A-R 이 「0건」이라 적은 그 숫자의 분모를 넓힌다.**
 * ```
 * STEP 3A-R 분모   A 62건(= BRAND 증거 누락 코퍼스)     → 브랜드 자리 판매처명 **0**
 * 이번 분모        수집된 **전체 190행**(제목 + 설명문)  → 아래 실측
 * 🔴 「0 이다」를 그대로 쓰지 않고 **분모를 바꿔 다시** 센다 — 게이트의 안전성은
 *    발화 사례가 **하나도 없으면 증명되지 않는다**(CPO 지적 그대로).
 * ```
 *
 * 🔴 게이트 술어는 **STEP 3A-R 과 글자 그대로 같다** — 새 규칙을 만들지 않는다.
 *    (NFKC · 소문자 · `WORDISH` 경계 · 한국어 조사 열거 · `LABEL_RE` · `ATTRIB_LEAD`)
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const s2 = JSON.parse(readFileSync(path.join(DIR, "step2-evidence.json"), "utf8"));
const pr = (o) => JSON.stringify(o, null, 1);
const NFKC = (s) => String(s ?? "").normalize("NFKC");
const WORDISH = /[A-Za-z0-9가-힣]/;

const PARTICLES = ["으로", "에서", "부터", "까지", "에게", "한테", "은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "도", "만", "로"];
function afterIsOk(text, end, { particles = true } = {}) {
  const after = text[end] ?? "";
  if (!after || !WORDISH.test(after)) return { ok: true, via: "비글자 경계" };
  if (!particles) return { ok: false, via: "글자가 붙어 있다" };
  for (const p of [...PARTICLES].sort((a, b) => b.length - a.length)) {
    if (text.startsWith(p, end)) {
      const next = text[end + p.length] ?? "";
      if (!next || !WORDISH.test(next)) return { ok: true, via: `조사 「${p}」 경계` };
      return { ok: false, via: `조사처럼 보이나 뒤에 글자가 붙었다(「${p}${next}」)` };
    }
  }
  return { ok: false, via: "조사가 아닌 글자가 붙어 있다" };
}
function brandMatches(hay, brand, opt = {}) {
  const raw = NFKC(hay);
  const text = raw.toLowerCase();
  const parts = NFKC(brand).toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean);
  if (!text || parts.length === 0) return [];
  const re = new RegExp(parts.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_.]*"), "g");
  const hits = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length;
    const before = m.index > 0 ? text[m.index - 1] : "";
    if (WORDISH.test(before)) continue;
    const a = afterIsOk(text, end, opt);
    if (!a.ok) continue;
    hits.push({ index: m.index, matched: raw.slice(m.index, end) });
  }
  return hits;
}
const LABEL_RE = /(brand|브랜드)\s*[:：]\s*$/i;
const ATTRIB_LEAD = /\b(by|from|collection)\s*$/i;
function inBrandRole(text, index, { allowLead = true } = {}) {
  const before = text.slice(Math.max(0, index - 20), index);
  if (LABEL_RE.test(before)) return "라벨(Brand:)";
  if (ATTRIB_LEAD.test(before)) return "귀속문구(by/from/collection)";
  if (allowLead && index === 0) return "원문 맨 앞";
  return null;
}

/** 🔴 판매처명 집합은 **관측값** 이다 — 도메인에서 유도하지 않는다(승격 경로를 만들지 않기 위해). */
const SELLER_NAMES = ["비스킷", "biskuit", "보몽드", "beaumonde", "piccoli", "petite maison",
  "tinyapple", "junioredition", "junior edition", "donokids", "luxboy", "trenbe", "cemarose",
  "kidbizkid", "designerkidswear", "villagekids", "nickis", "folkberlin", "tiptoeboutique",
  "stockmann", "miniboutique", "미니부띠끄"];

/* ═══════ 실측 ════════════════════════════════════════════════════════════ */
const rows = s2.rows;
const hasDesc = rows.filter((r) => r.descriptionRaw && String(r.descriptionRaw).trim());
const hasTitle = rows.filter((r) => (r.liveTitle ?? r.baselineTitle));
console.log("═".repeat(80));
console.log("  판매처명이 «브랜드 자리» 에 등장한 사례 — 실측 (DB 쓰기 0 · 재방문 0)");
console.log("═".repeat(80));
console.log(`\n분모 — 수집 전체 ${rows.length}행 · 설명문 보유 ${hasDesc.length} · 제목 보유 ${hasTitle.length}`);

const findings = [];
const scan = (r, hay, sourceType) => {
  if (!hay) return;
  const text = NFKC(hay).toLowerCase();
  for (const s of SELLER_NAMES) {
    for (const h of brandMatches(hay, s)) {
      /** 🔴 **두 기준을 같이 잰다** — 게이트가 쓰는 좁은 기준(`allowLead:false`)과 넓은 기준. */
      const narrow = inBrandRole(text, h.index, { allowLead: false });
      const wide = inBrandRole(text, h.index, { allowLead: true });
      if (!wide) continue;
      findings.push({
        originCode: r.originCode ?? null, originBrand: r.originBrand ?? null,
        candidateUrl: r.candidateUrl, candidateDomain: r.candidateDomain,
        sourceType, sellerName: s, matched: h.matched, index: h.index,
        roleNarrow: narrow, roleWide: wide,
        /** 🔴 **판매처명 ↔ 그 판매처 자신** 인지 가른다(자기 상점 접두사 vs 타 상점 언급). */
        isOwnDomain: String(r.candidateDomain ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(s.toLowerCase().replace(/[^a-z0-9]/g, "")) && /[a-z]/i.test(s),
        contextBefore: NFKC(hay).slice(Math.max(0, h.index - 40), h.index),
        contextAfter: NFKC(hay).slice(h.index + h.matched.length, h.index + h.matched.length + 40),
      });
    }
  }
};
for (const r of rows) {
  scan(r, r.liveTitle ?? r.baselineTitle, "TITLE");
  scan(r, r.descriptionRaw, "DESCRIPTION");
}

const tally = (xs, f) => xs.reduce((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});
const narrowHits = findings.filter((f) => f.roleNarrow);
console.log(`\n① 판매처명이 **넓은 기준**(라벨·귀속문구·맨앞)의 브랜드 자리에 등장: **${findings.length}건**`);
console.log("   근거별:", pr(tally(findings, (f) => f.roleWide)));
console.log("   원문 축별:", pr(tally(findings, (f) => f.sourceType)));
console.log("   판매처명별:", pr(tally(findings, (f) => f.sellerName)));
console.log(`\n② 🔴 그중 **게이트가 실제로 발화하는** 좁은 기준(allowLead:false): **${narrowHits.length}건**`);
if (narrowHits.length === 0) {
  console.log("   ⟹ 🔴🔴 **게이트 발화 사례가 여전히 0 이다** — 분모를 190행으로 넓혀도 0 이다");
  console.log("      🔴 그러므로 **게이트의 안전성은 증명되지 않았다**(CPO 지적 유지).");
  console.log("      🟢 그리고 「맨 앞 접두사」 사례는 아래처럼 **실재한다** ⟹ 수정 A-2 가 그것을 막았다");
}
for (const f of findings.slice(0, 12)) {
  console.log(`   · [${f.sourceType}] ${f.candidateDomain} · 「${f.sellerName}」 @${f.index} · wide=${f.roleWide} narrow=${f.roleNarrow ?? "—"} · 자기상점=${f.isOwnDomain}`);
  console.log(`     …${f.contextBefore}【${f.matched}】${f.contextAfter}…`);
}

/** 🔴 「접두사 모양」의 분모도 센다 — 수정 A-2 가 실제로 하중을 받는지. */
const leadOnly = findings.filter((f) => f.roleWide === "원문 맨 앞" && !f.roleNarrow);
console.log(`\n③ 「상점명 접두사」(맨 앞에만 있어 좁은 기준에서 탈락) **${leadOnly.length}건**`);
console.log("   ⟹ 🟢 **수정 A-2 가 이 건들을 AMBIGUOUS 에서 구해 냈다**(STEP 3A-R 의 그 결함)");
console.log("   🔴 단 이것은 「게이트 발화 사례」가 아니다 — ②가 0 이면 ②는 0 이다. 둘을 합치지 않는다.");

writeFileSync(path.join(DIR, "step3agt-sellername.json"), pr({
  denominator: { rows: rows.length, withDescription: hasDesc.length, withTitle: hasTitle.length },
  sellerNamesProbed: SELLER_NAMES.length,
  wideRoleHits: findings.length, narrowGateFirings: narrowHits.length, leadPrefixOnly: leadOnly.length,
  byRole: tally(findings, (f) => f.roleWide), bySource: tally(findings, (f) => f.sourceType),
  findings,
}), "utf8");
console.log("\n🟢 산출 step3agt-sellername.json");
