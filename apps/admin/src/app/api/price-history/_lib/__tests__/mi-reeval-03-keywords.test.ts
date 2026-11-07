import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_AXES, CEO_EVIDENCE_MAP, compareAxis, extractKeywords,
  type AxisComparison, type Keyword, type KeywordAxis,
} from "./mi-reeval-shadow-keywords";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REEVAL **STEP 3** — 키워드 단위 증거 비교 **측정**(Shadow · CPO 추가 지시)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · matcher 0 · extractor 0 · alias 0 · GT 0 · DB 0 · 네트워크 0.**
 * 🔴 **최종 판정(SAME/SIMILAR/DIFFERENT/UNDECIDED)을 하지 않는다** — STEP 5 다.
 *
 * 🔴🔴 **CPO §4 — 네 지표를 «따로» 센다. 섞으면 숫자가 거짓이 된다**:
 * ```
 * ① 데이터 확보율    원문·필드가 존재하는가            (STEP 1 에서 쟀다)
 * ② 키워드 추출률    비교 가능한 키워드를 뽑았는가       ← 이번
 * ③ 키워드 일치율    양쪽 핵심 키워드의 의미가 같은가    ← 이번
 * ④ 속성 충돌률      실제로 다른 속성이 발견되는가       ← 이번
 * ⑤ 최종 판정 정확도  CEO GT ↔ MI 결과                 (STEP 5~6)
 * ```
 * 🔴 **②③④ 를 「동일성 확률」로 환산하지 않는다**(CPO 금지).
 */

const FIX = join(__dirname, "fixtures");
const OUT = join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..", "docs");

interface Pair {
  originUrl: string; originCode: string | null; candidateUrl: string; candidateDomain: string;
  baselineSystemVerdict: string | null; humanGt: string | null;
  origin: { title: string | null; description: string | null; descriptionKo: string | null; brand: string | null; color: string | null; material: string | null };
  candidate: { title: string | null; description: string | null };
}

describe("MI-REEVAL STEP 3 — 키워드 단위 증거 비교 측정(Shadow · 네트워크 0)", () => {
  const input = JSON.parse(readFileSync(join(FIX, "mi-reeval-03-keyword-input.json"), "utf8")) as { pairs: Pair[] };
  const pairs = input.pairs;

  const rows = pairs.map((p) => {
    const ok = extractKeywords({
      title: p.origin.title, description: p.origin.description, descriptionKo: p.origin.descriptionKo,
      brand: p.origin.brand, color: p.origin.color, material: p.origin.material, code: p.originCode,
    });
    const ck = extractKeywords({ title: p.candidate.title, description: p.candidate.description });
    const axes = ALL_AXES.map((a) => compareAxis(a, ok, ck));
    return { p, ok, ck, axes };
  });

  const tally = <T>(xs: T[], f: (x: T) => string) =>
    xs.reduce<Record<string, number>>((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {});
  const axisOf = (r: (typeof rows)[number], a: KeywordAxis): AxisComparison => r.axes.find((x) => x.axis === a)!;

  it("STEP 3 — 추출률 · 일치율 · 충돌률을 «따로» 센다", () => {
    const L = (s: string) => console.log(s);
    const N = pairs.length;
    L("\n" + "═".repeat(78));
    L("  MI-REEVAL STEP 3 — 키워드 단위 증거 비교(Shadow · 운영 변경 0)");
    L("═".repeat(78));

    /* ── ① 데이터 확보율 — 🔴 STEP 1 과 같은 사실을 전문 기준으로 다시 적는다 ── */
    L(`\n① 데이터 확보율(분모 ${N} 쌍) — 🔴 «전문» 기준이다(400자 발췌가 아니다)`);
    L(`   원본 제목 ${pairs.filter((p) => p.origin.title).length} · 후보 제목 ${pairs.filter((p) => p.candidate.title).length}`);
    L(`   원본 설명문 ${pairs.filter((p) => p.origin.description).length} · 후보 설명문 ${pairs.filter((p) => p.candidate.description).length}`);
    L(`   원본 번역문 ${pairs.filter((p) => p.origin.descriptionKo).length} · 🟢 설명문 둘 다 ${pairs.filter((p) => p.origin.description && p.candidate.description).length}`);

    /* ── ② 키워드 추출률 ── */
    L(`\n② 키워드 추출률 — 🔴 「확보」와 **다른 숫자** 다`);
    L(`   한 쌍에서 뽑힌 키워드 수(중복 제거 후) — 원본 중위 ${median(rows.map((r) => r.ok.length))} · 후보 중위 ${median(rows.map((r) => r.ck.length))}`);
    L(`   🔴 키워드를 **하나도** 못 뽑은 쌍 — 원본 ${rows.filter((r) => !r.ok.length).length} · 후보 ${rows.filter((r) => !r.ck.length).length}`);
    L("   축별 추출(양쪽 중 한쪽이라도 뽑힌 쌍 수):");
    for (const a of ALL_AXES) {
      const o = rows.filter((r) => r.ok.some((k) => k.axis === a)).length;
      const c = rows.filter((r) => r.ck.some((k) => k.axis === a)).length;
      const both = rows.filter((r) => r.ok.some((k) => k.axis === a) && r.ck.some((k) => k.axis === a)).length;
      L(`      ${a.padEnd(14)} 원본 ${String(o).padStart(3)} · 후보 ${String(c).padStart(3)} · 🟢 **양쪽 ${String(both).padStart(3)}**  ← 비교가 성립하는 분모`);
    }

    /* ── ③ 키워드 일치율 · ④ 속성 충돌률 ── */
    L(`\n③④ 축별 비교 결과 — 🔴 **분모는 「양쪽 추출」 쌍** 이다(전체 ${N} 이 아니다)`);
    L(`   ${"축".padEnd(14)} ${"분모".padStart(4)} ${"MATCH".padStart(6)} ${"MISMATCH".padStart(9)} ${"UNKNOWN".padStart(8)} ${"N/A".padStart(5)}`);
    for (const a of ALL_AXES) {
      const t = tally(rows, (r) => axisOf(r, a).status);
      const denom = (t.MATCH ?? 0) + (t.MISMATCH ?? 0);
      L(`   ${a.padEnd(14)} ${String(denom).padStart(4)} ${String(t.MATCH ?? 0).padStart(6)} ${String(t.MISMATCH ?? 0).padStart(9)} ${String(t.UNKNOWN ?? 0).padStart(8)} ${String(t.NOT_APPLICABLE ?? 0).padStart(5)}`);
    }

    /* ── 🔴 CPO 가 이름 붙인 위험 둘을 직접 센다 ── */
    const sleeve = rows.filter((r) => axisOf(r, "SLEEVE_FORM").status === "MISMATCH");
    L(`\n🔴 **소매 충돌**(CPO 예시의 그 모양) — ${sleeve.length} 쌍`);
    for (const r of sleeve.slice(0, 6)) {
      L(`      · ${String(r.p.originCode ?? "-").padEnd(11)} ${r.p.candidateDomain.padEnd(22)} ${axisOf(r, "SLEEVE_FORM").why.slice(0, 64)}`);
    }
    /**
     * 🔴🔴 **「다국어 연결」은 «한쪽이 한글, 다른 쪽이 영문» 일 때만 센다.**
     *    1차 측정이 `synonymBasis` 에 REGISTRY 가 있으면 다 세어 **17쌍** 이라는 거짓 숫자를
     *    냈다(영문 구조화 brand 까지 들어왔다). 🟢 실제 브리지는 아래처럼 **문자체계로** 가른다.
     */
    const hasKo = (s: string) => /[가-힣]/.test(s);
    const bridged = rows.filter((r) => {
      const o = r.ok.filter((k) => k.axis === "BRAND");
      const c = r.ck.filter((k) => k.axis === "BRAND");
      return o.some((x) => c.some((y) => x.normalized === y.normalized && hasKo(x.raw) !== hasKo(y.raw)));
    });
    const koCand = rows.filter((r) => r.ck.some((k) => k.axis === "BRAND" && hasKo(k.raw)));
    L(`\n🟢 **브랜드 다국어가 «실제로» 이어진 쌍** — ${bridged.length} 쌍`);
    L(`   🔴 한글 브랜드 표기가 추출된 쌍 자체가 — 원본 ${rows.filter((r) => r.ok.some((k) => k.axis === "BRAND" && hasKo(k.raw))).length} · 후보 ${koCand.length} 이다`);
    for (const r of bridged.slice(0, 6)) {
      const o = r.ok.find((k) => k.axis === "BRAND");
      const c = r.ck.find((k) => k.axis === "BRAND" && hasKo(k.raw));
      L(`      · ${String(r.p.candidateDomain).padEnd(22)} 원본「${o?.raw}」 ↔ 후보「${c?.raw}」 → ${c?.normalized}`);
    }
    L(`   🔴 그러므로 「다국어 연결이 많이 발화한다」로 적지 않는다 — 분모가 **${koCand.length}** 이다`);

    /* ── 🔴 문자열 완전 일치와의 «차이» — 이것이 CPO 지시의 핵심이다 ── */
    const norm = (s: string | null) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    const exactTitle = pairs.filter((p) => p.origin.title && p.candidate.title && norm(p.origin.title) === norm(p.candidate.title)).length;
    const kwDesignMatch = rows.filter((r) => axisOf(r, "DESIGN").status === "MATCH").length;
    L(`\n🔴🔴 **문자열 완전 일치 ↔ 키워드 비교**`);
    L(`   제목 문자열 완전 일치           **${exactTitle}** / ${N}`);
    L(`   DESIGN 키워드 의미 일치         **${kwDesignMatch}** / ${N}`);
    L(`   ⟹ 🟢 완전 일치로는 ${exactTitle} 쌍만 보이고, 키워드로는 ${kwDesignMatch} 쌍에서 근거가 보인다`);
    L(`   🔴 그러나 이 숫자를 **동일상품 수로 쓰지 않는다** — 판정은 STEP 5 다`);

    /* ── CEO 다섯 증거 ↔ 축 대응 ── */
    L(`\n⑤ CEO 다섯 증거별 — 🔴 **판정이 아니라 증거 상태** 다`);
    for (const [label, axes] of Object.entries(CEO_EVIDENCE_MAP)) {
      const any = (r: (typeof rows)[number], s: string) => axes.some((a) => axisOf(r, a).status === s);
      const m = rows.filter((r) => any(r, "MATCH")).length;
      const x = rows.filter((r) => !any(r, "MATCH") && any(r, "MISMATCH")).length;
      const u = rows.filter((r) => !any(r, "MATCH") && !any(r, "MISMATCH")).length;
      L(`   ${label.padEnd(18)} 일치 근거 있음 ${String(m).padStart(3)} · 충돌만 ${String(x).padStart(3)} · 근거 없음 ${String(u).padStart(3)}`);
    }

    /* ── 산출물 ── */
    const artifacts = rows.map((r) => ({
      originUrl: r.p.originUrl, originCode: r.p.originCode,
      candidateUrl: r.p.candidateUrl, candidateDomain: r.p.candidateDomain,
      baselineSystemVerdict: r.p.baselineSystemVerdict, humanGt: r.p.humanGt,
      originKeywords: r.ok.map(trim), candidateKeywords: r.ck.map(trim),
      axes: r.axes.map((a) => ({
        axis: a.axis, status: a.status, matched: a.matched,
        conflicting: a.conflicting, onlyOrigin: a.onlyOrigin, onlyCandidate: a.onlyCandidate,
        synonymBasis: a.synonymBasis, why: a.why,
      })),
      ceoEvidence: Object.fromEntries(Object.entries(CEO_EVIDENCE_MAP).map(([label, axes]) => [
        label,
        axes.map((a) => ({ axis: a, status: axisOf(r, a).status, why: axisOf(r, a).why })),
      ])),
      /** 🔴 **최종 판정 칸이 없다** — STEP 5 가 만든다. 비워 두지도 않았다(아예 없다). */
    }));
    writeFileSync(join(OUT, "MI-REEVAL-STEP3-KEYWORDS.json"), JSON.stringify({
      note: "🔴 Shadow 키워드 비교 산출 · 운영 변경 0 · **최종 판정 칸이 없다**(STEP 5)",
      pairs: artifacts.length, artifacts,
    }, null, 1), "utf8");
    L(`\n🟢 산출 docs/MI-REEVAL-STEP3-KEYWORDS.json — ${artifacts.length} 쌍(쌍별 키워드·충돌·동의어 근거·출처)`);

    /* ═══════ 계약 ═══════════════════════════════════════════════════════ */
    expect(pairs.length, "🔴 입력이 비면 STEP 3 이 성립하지 않는다").toBeGreaterThan(0);
    /** 🔴🔴 **CPO 금지 — 한쪽에만 있는 키워드를 MISMATCH 로 적지 않는다**. */
    for (const r of rows) {
      for (const a of r.axes) {
        if (a.status === "MISMATCH") {
          expect(a.onlyOrigin.length > 0 && a.onlyCandidate.length > 0,
            `🔴 ${a.axis}: 한쪽만 있는데 MISMATCH 다 — ${a.why}`).toBe(true);
        }
        if (a.status === "UNKNOWN") {
          expect(a.matched.length, `🔴 ${a.axis}: UNKNOWN 인데 matched 가 있다`).toBe(0);
        }
      }
    }
    /** 🔴 **점수·확률을 만들지 않았다** — 산출 JSON 에 비율 칸이 없다. */
    const json = readFileSync(join(OUT, "MI-REEVAL-STEP3-KEYWORDS.json"), "utf8");
    for (const banned of ["matchRate", "similarity", "probability", "score", "confidence"]) {
      expect(json.includes(`"${banned}"`), `🔴 산출에 ${banned} 가 있으면 일치율을 확률로 읽는다`).toBe(false);
    }
    /** 🔴 **최종 판정 어휘가 산출에 없어야** 한다(STEP 5 전에 판정하지 않았다). */
    for (const banned of ["shadowVerdict", "finalVerdict", "improvedVerdict"]) {
      expect(json.includes(`"${banned}"`), `🔴 STEP 3 산출에 ${banned} 가 있으면 범위를 넘었다`).toBe(false);
    }
    /** 🟢 동의어 근거가 **등급으로** 보존돼야 한다. */
    expect(json).toContain('"synonymBasis"');
    /** 🔴 **한글↔영문 브리지가 «실제로» 발화해야** 한다 — `REGISTRY` 라벨만 세지 않는다. */
    expect(bridged.length, "🔴 브랜드 다국어가 한 번도 이어지지 않으면 그 축이 죽어 있다").toBeGreaterThan(0);
    /** 🔴 영문 구조화 brand 가 `REGISTRY` 로 찍히면 「다국어 연결」 숫자가 거짓이 된다. */
    for (const r of rows) {
      for (const k of [...r.ok, ...r.ck]) {
        if (k.axis === "BRAND" && k.basis === "REGISTRY") {
          expect(hasKo(k.raw), `🔴 영문 「${k.raw}」 가 REGISTRY 로 찍혔다 — 다국어 연결이 아니다`).toBe(true);
        }
      }
    }
    /** 🔴 출처와 원문 위치가 보존돼야 한다(CPO §3). */
    expect(json).toContain('"where"');
    expect(json).toContain('"offset"');
    expect(json).toContain('"context"');
  });

  it("🔴 Shadow 비교기가 운영 코드에서 import 되지 않는다", () => {
    /**
     * 🔴🔴 이 계약이 「Shadow 가 조용히 운영이 되는 것」을 막는다.
     *    `__tests__` 밖에서 이 모듈을 부르면 **FAIL** 한다.
     */
    const roots = [
      join(__dirname, "..", "..", "..", "..", "..", "..", "pipeline"),
      join(__dirname, ".."),
    ];
    const hits: string[] = [];
    const walk = (dir: string) => {
      let entries: string[] = [];
      try {
        entries = require("node:fs").readdirSync(dir) as string[];
      } catch {
        return;
      }
      for (const e of entries) {
        const full = join(dir, e);
        let st;
        try { st = require("node:fs").statSync(full); } catch { continue; }
        if (st.isDirectory()) {
          if (e === "__tests__" || e === "node_modules") continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(e)) continue;
        const src = readFileSync(full, "utf8");
        if (src.includes("mi-reeval-shadow-keywords")) hits.push(full);
      }
    };
    for (const r of roots) walk(r);
    expect(hits, "🔴 Shadow 비교기가 운영 코드에서 import 됐다").toEqual([]);
  });
});

function trim(k: Keyword) {
  return { axis: k.axis, raw: k.raw, keyword: k.keyword, normalized: k.normalized, basis: k.basis, where: k.where, offset: k.offset, context: k.context };
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
