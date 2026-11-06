/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STEP 3A — **브랜드 귀속 규칙 shadow 검증**(CPO 승인 · 검증만)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드 · `product-evidence.ts` · 추출기 · matcher · Identity · alias · GT · DB · UI
 *    **변경 0** · **운영 함수 호출 0** · **재방문 0**. 기존 산출 JSON 만 읽는다.
 * 🔴 `facts.brand` 로 승격하는 코드를 만들지 않는다 — 이 파일은 **status 를 계산해 세기만** 한다.
 *
 * 입력  step2-evidence.json(원문·evidence) · step25-brand-reclassify.json(A 62건)
 * 출력  step3a-shadow.json · step3a-shadow.csv · step3a-manual-sample.txt
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const s2 = JSON.parse(readFileSync(path.join(DIR, "step2-evidence.json"), "utf8"));
const s25 = JSON.parse(readFileSync(path.join(DIR, "step25-brand-reclassify.json"), "utf8"));
const pr = (o) => JSON.stringify(o, null, 1);

/* ═══════════ §1 매칭 규칙 — 설계 §1 그대로(새 정규화기 0) ════════════════ */
const NFKC = (s) => String(s ?? "").normalize("NFKC");
/** 🔴 경계 검사 — 양 끝이 «글자/숫자가 아니어야» 한다(brand-alias 의 WORDISH 재현). */
const WORDISH = /[A-Za-z0-9가-힣]/;
/** 🟢 브랜드 토큰 «사이» 에만 공백·구두점을 허용한다(품번의 `[-_./]?` 모양). */
function brandMatches(hay, brand, { boundary = true } = {}) {
  const text = NFKC(hay).toLowerCase();
  const parts = NFKC(brand).toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean);
  if (!text || parts.length === 0) return [];
  const re = new RegExp(parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_.]*"), "g");
  const hits = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const before = m.index > 0 ? text[m.index - 1] : "";
    const after = text[m.index + m[0].length] ?? "";
    if (boundary && (WORDISH.test(before) || WORDISH.test(after))) continue;
    hits.push({ index: m.index, matched: NFKC(hay).slice(m.index, m.index + m[0].length) });
  }
  return hits;
}

/* ═══════════ §4 오탐 방지 집합 — 실측 관측값만(사전 확대 0) ══════════════ */
const SELLER_NAMES = ["비스킷", "biskuit", "보몽드", "beaumonde", "piccoli", "petite maison",
  "tinyapple", "junioredition", "junior edition", "donokids", "luxboy", "trenbe", "cemarose",
  "kidbizkid", "designerkidswear", "villagekids", "nickis", "folkberlin", "tiptoeboutique", "stockmann"];
const BRANDS = [...new Set(s2.rows.flatMap((r) => [r.originBrand, r.liveBrand]).filter(Boolean).map(String))]
  .filter((b) => !SELLER_NAMES.some((s) => NFKC(b).toLowerCase() === NFKC(s).toLowerCase()));

/** 🔴 귀속 문맥 — 설계 §3 의 ①② 만. ④(독일어)는 **규칙에 넣지 않았다**(CPO 보류). */
const ATTRIB_LEAD = /\b(by|from|collection)\s*$/i;

/**
 * 🔴 게이트를 «개별로 끌 수 있게» 만든다 — §B 음성 대조가 그것을 요구한다.
 */
function resolve(hay, originBrand, { gateAttribution = true, gateSeller = true, gateOtherBrand = true, gateBoundary = true } = {}) {
  if (!originBrand) return { status: "ABSENT", why: "원상품 브랜드가 없다" };
  const hits = brandMatches(hay, originBrand, { boundary: gateBoundary });
  if (hits.length === 0) return { status: "ABSENT", why: "원문에 브랜드 문자열이 없다" };

  const text = NFKC(hay);
  const sellerSeen = gateSeller ? SELLER_NAMES.filter((s) => brandMatches(text, s, { boundary: false }).length > 0) : [];
  const otherSeen = gateOtherBrand
    ? BRANDS.filter((b) => {
        const nb = NFKC(b).toLowerCase(), no = NFKC(originBrand).toLowerCase();
        return !nb.includes(no) && !no.includes(nb) && brandMatches(text, b).length > 0;
      })
    : [];
  if (sellerSeen.length > 0 || otherSeen.length > 0) {
    return { status: "AMBIGUOUS", why: `동시 등장 — 판매처명[${sellerSeen.join("|")}] 다른브랜드[${otherSeen.join("|")}]`, hits, sellerSeen, otherSeen };
  }

  const attributed = hits.some((h) => h.index === 0 || ATTRIB_LEAD.test(text.slice(Math.max(0, h.index - 14), h.index)));
  if (!gateAttribution || attributed) {
    return { status: "ATTRIBUTED", why: attributed ? "귀속 문맥(by/from/collection 또는 맨 앞)" : "🔴 귀속 게이트 OFF", hits };
  }
  return { status: "MENTIONED", why: "문자열은 있으나 귀속 문맥이 아니다", hits };
}

const rowOf = (u, oc) => s2.rows.find((x) => x.candidateUrl === u && (oc == null || x.originCode === oc)) ?? s2.rows.find((x) => x.candidateUrl === u);
const ctx = (hay, i, n = 40) => (i == null || i < 0 ? null : `…${NFKC(hay).slice(Math.max(0, i - n), i + n + 20)}…`);

/* ═══════════ A. 62건 shadow 전수 ════════════════════════════════════════ */
const A62 = s25.rows.filter((x) => x.type === "A_TRUE_EXTRACTION_MISS");
const shadow = A62.map((x) => {
  const r = rowOf(x.url, x.originCode);
  const desc = r?.descriptionRaw ?? null;
  const title = r?.liveTitle ?? r?.baselineTitle ?? null;
  const d = resolve(desc ?? "", x.originBrand);
  const t = resolve(title ?? "", x.originBrand);
  /** 🔴 설명문을 먼저 본다(설계 §2) — 설명문이 ABSENT 면 제목 결과를 쓴다. */
  const pick = d.status !== "ABSENT" ? { src: "DESCRIPTION", ...d, hay: desc } : { src: "TITLE", ...t, hay: title };
  const h0 = pick.hits?.[0];
  /** 🔴 독일어 귀속 2건을 **별도 표시** 한다 — 검증되지 않은 문법으로 ATTRIBUTED 처리 금지(CPO A). */
  const germanLead = !!h0 && /\b(dieses|die|der|das)\s+$/i.test(NFKC(pick.hay ?? "").slice(Math.max(0, h0.index - 10), h0.index));
  return {
    domain: x.domain, url: x.url, originCode: x.originCode, originBrand: x.originBrand,
    status: pick.status, why: pick.why, sourceType: pick.src,
    charOffset: h0?.index ?? null, matchedText: h0?.matched ?? null,
    occurrences: pick.hits?.length ?? 0,
    contextBefore: h0 ? NFKC(pick.hay).slice(Math.max(0, h0.index - 40), h0.index) : null,
    contextAfter: h0 ? NFKC(pick.hay).slice(h0.index + (h0.matched?.length ?? 0), h0.index + (h0.matched?.length ?? 0) + 40) : null,
    titleStatus: t.status, descStatus: d.status,
    germanAttributionCandidate: germanLead,
    baseline: x.baseline, ceoGt: x.ceoGt,
    existingEvidenceBrand: r?.evidenceBrandSources ?? [],
  };
});
const tally = (xs, f) => xs.reduce((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});

console.log("═".repeat(82));
console.log("  STEP 3A — 브랜드 귀속 규칙 shadow 검증(운영 호출 0 · 재방문 0)");
console.log("═".repeat(82));
console.log("\n§A 62건 상태 분포");
console.log(pr(tally(shadow, (x) => x.status)));
console.log("출처:", pr(tally(shadow, (x) => x.sourceType)));
console.log("제목↔설명문 결과가 다른 행:", shadow.filter((x) => x.titleStatus !== x.descStatus).length);
console.log("🔴 독일어 귀속 후보(규칙 미적용 · 별도 표시):", shadow.filter((x) => x.germanAttributionCandidate).length);
console.log("🔴 기존 evidence 가 있는 행(0 이어야 한다):", shadow.filter((x) => x.existingEvidenceBrand.length > 0).length);
console.log("GT 보유:", shadow.filter((x) => x.ceoGt).length, "/", shadow.length);
console.log("🔴 표본 편향 — 원상품 브랜드:", pr(tally(shadow, (x) => x.originBrand)));

/* ═══════════ B. 음성 대조 — 게이트별 «실제 오탐 원문» ═══════════════════ */
console.log("\n" + "═".repeat(82));
console.log("  §B 음성 대조 — 게이트를 끄면 «무엇이» 잘못 올라오는가(원문 포함)");
console.log("═".repeat(82));
const GATES = [
  ["① 귀속 문맥 게이트 OFF", { gateAttribution: false }],
  ["② 판매처명 게이트 OFF", { gateSeller: false }],
  ["③ 경계 검사 OFF", { gateBoundary: false }],
];
const mutations = {};
for (const [label, opt] of GATES) {
  const changed = [];
  for (const x of A62) {
    const r = rowOf(x.url, x.originCode);
    const hay = r?.descriptionRaw ?? r?.liveTitle ?? "";
    const base = resolve(hay, x.originBrand);
    const off = resolve(hay, x.originBrand, opt);
    if (base.status !== off.status) changed.push({ domain: x.domain, url: x.url, from: base.status, to: off.status, why: off.why, excerpt: ctx(hay, off.hits?.[0]?.index ?? base.hits?.[0]?.index) });
  }
  mutations[label] = changed;
  console.log(`\n${label} → 상태가 바뀐 행 ${changed.length}`);
  for (const c of changed.slice(0, 5)) console.log(`   ${String(c.domain).padEnd(22)} ${c.from} → ${c.to}\n      ${c.excerpt}`);
  if (changed.length === 0) console.log("   🔴 변화 0 — 이 코퍼스에서는 그 게이트가 «발화하지 않는다»(안전하다는 뜻이 아니다)");
}

/* ═══════════ C. 역방향 대조 — 기존 BRAND 증거 6건 ══════════════════════ */
console.log("\n" + "═".repeat(82));
console.log("  §C 역방향 대조 — 기존 BRAND 증거 6건에 같은 규칙을 적용");
console.log("═".repeat(82));
const six = s2.rows.filter((r) => (r.evidenceBrandSources ?? []).length > 0);
const reverse = six.map((r) => {
  const hay = r.descriptionRaw ?? r.liveTitle ?? "";
  const byOrigin = resolve(hay, r.originBrand);
  /** 🔴 **판매처명으로 검색하면** 어떻게 되는가 — 게이트가 실제로 막는지 본다. */
  const sellerHit = SELLER_NAMES.filter((s) => brandMatches(hay, s).length > 0);
  const bySeller = sellerHit.length ? resolve(hay, sellerHit[0]) : { status: "n/a", why: "판매처명 미등장" };
  return {
    domain: r.candidateDomain, url: r.candidateUrl,
    originBrand: r.originBrand, liveBrand: r.liveBrand,
    existingEvidence: r.evidenceBrandSources,
    statusByOriginBrand: byOrigin.status, whyOrigin: byOrigin.why,
    sellerNameSeen: sellerHit, statusIfSearchedBySellerName: bySeller.status, whySeller: bySeller.why,
    excerpt: ctx(hay, byOrigin.hits?.[0]?.index ?? -1),
  };
});
for (const x of reverse) {
  console.log(`\n   ${String(x.domain ?? "(null)").padEnd(22)} 기존증거 ${x.existingEvidence.join("+")}`);
  console.log(`      원상품 「${x.originBrand ?? "-"}」 → **${x.statusByOriginBrand}** (${x.whyOrigin})`);
  console.log(`      🔴 판매처명 검색 시 [${x.sellerNameSeen.join("|") || "없음"}] → ${x.statusIfSearchedBySellerName}`);
  if (x.excerpt) console.log(`      ${x.excerpt}`);
}

/* ═══════════ D. 수동 검증 표본 — 위험 축으로 층화 ══════════════════════ */
const pickBy = (f, n) => shadow.filter(f).slice(0, n);
const sample = [
  ...pickBy((x) => /\b(by)\s*$/i.test(x.contextBefore ?? ""), 4).map((x) => ({ risk: "① by {BRAND}", ...x })),
  ...pickBy((x) => x.charOffset === 0, 2).map((x) => ({ risk: "② 설명문 첫 문장", ...x })),
  ...pickBy((x) => x.status === "AMBIGUOUS", 3).map((x) => ({ risk: "③ 판매처명/다른브랜드 동시", ...x })),
  ...pickBy((x) => x.germanAttributionCandidate, 2).map((x) => ({ risk: "④ 다른 상품/다국어 문맥", ...x })),
  ...pickBy((x) => x.titleStatus !== x.descStatus, 3).map((x) => ({ risk: "⑤ 제목↔설명문 불일치", ...x })),
  ...pickBy((x) => x.status === "MENTIONED", 2).map((x) => ({ risk: "⑥ MENTIONED", ...x })),
];
const uniq = [...new Map(sample.map((x) => [x.risk + x.url, x])).values()];
console.log("\n" + "═".repeat(82));
console.log(`  §D 수동 검증 표본 ${uniq.length}건 — 위험 축으로 층화(임의 추출 아님)`);
console.log("═".repeat(82));
const lines = [];
for (const x of uniq) {
  const block = `[${x.risk}] ${x.domain} · ${x.status} · ${x.sourceType} · GT ${x.ceoGt ?? "-"}\n` +
    `   원상품 「${x.originBrand}」 · offset ${x.charOffset} · 등장 ${x.occurrences}회\n` +
    `   …${x.contextBefore}【${x.matchedText}】${x.contextAfter}…\n` +
    `   판정 근거: ${x.why}\n   질문: 이 문맥은 «이 상품의 제조사 브랜드» 를 말하는가?  [ 예 / 아니오 / 모르겠다 ]\n`;
  lines.push(block);
  console.log(block);
}

writeFileSync(path.join(DIR, "step3a-shadow.json"), pr({
  statusTally: tally(shadow, (x) => x.status), rows: shadow, mutations, reverse, manualSample: uniq,
}), "utf8");
const cols = ["domain", "originCode", "originBrand", "status", "sourceType", "charOffset", "occurrences", "matchedText", "titleStatus", "descStatus", "germanAttributionCandidate", "baseline", "ceoGt", "url", "why"];
writeFileSync(path.join(DIR, "step3a-shadow.csv"),
  [cols.join(","), ...shadow.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n"), "utf8");
writeFileSync(path.join(DIR, "step3a-manual-sample.txt"), lines.join("\n"), "utf8");
console.log(`\n🟢 산출: step3a-shadow.json · .csv · step3a-manual-sample.txt`);
