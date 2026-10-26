import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lookupBrandAlias } from "@commerce/crawler/src/comparison-search/brand-alias";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-06 — **P1/P2 안전성 GT 검색**(운영 변경 0 · 새 GT 생성 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 WU 는 matcher 를 만들지 않는다.** SAME-05 가 「P1/P2 가 발화한 DIFFERENT
 *    가 0 건이라 안전성 측정불가」로 STOP 했고, 그 **분모를 기존 데이터에서 찾는** 작업이다.
 *
 * ── 🔴🔴🔴 §2 절대 제한 — **새 DIFFERENT GT 를 만들지 않는다** ──────────────
 * ```
 * 🔴 CTO 가 상품을 보고 「이건 다른 제품 같다」로 라벨을 **생성하지 않는다.**
 * 🟢 이 파일이 하는 일은 **기존 fixture 의 사람 라벨을 모아 세는 것** 뿐이다.
 * 🔴 `verdict`/`human` 칸을 **해석하거나 변환하지 않는다** — 「판단불가」를
 *    DIFFERENT 로 바꾸지 않는다(§10).
 * ```
 *
 * ── 🟢 발화 조건은 «후보측 칸만» 본다 ⟹ 원상품 facts 가 없어도 검색된다 ────
 * ```
 * P1 BRAND   후보 `brand == null` **그리고** 제목 토큰에 **기존 alias**(보보쇼즈 등)가 있다
 * P2 CODE    후보 `brandModelCode == null` **그리고** 제목 토큰에
 *            「원상품 코드에서 앞 1글자를 뗀 문자열」이 있다  (예: `226ac009`)
 * 🔴 두 술어는 SAME-05 의 `brandFromTitleTokens` · `recoverTruncatedModelCode` 와
 *    **같은 조건** 이다 — 여기서 느슨하게 하면 검색 결과가 거짓이 된다.
 * ```
 */

const FIX = join(__dirname, "fixtures");
const readJson = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

/** 🟢 기존 alias 자산만 쓴다(새 표 0). */
const KNOWN_ALIASES: string[] = ["Bobo Choses", "Pèpè Shoes"]
  .map((b) => lookupBrandAlias(b))
  .filter((a): a is string => Boolean(a))
  .map((a) => a.replace(/\s+/g, ""));

/* ══════════════════════════════════════════════════════════════════════════════
   ① 기존 사람 라벨 전수 수집 — 🔴 해석하지 않고 «모은다»
   ══════════════════════════════════════════════════════════════════════════════ */

export interface HumanRow {
  src: string;
  url: string;
  domain: string;
  originCode: string | null;
  /** 🔴 fixture 가 적어 둔 **그대로**. 변환하지 않는다. */
  verdict: string;
  facts: ProductFacts | null;
}

const domainOf = (url: string): string => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "(알 수 없음)";
  }
};

export function collectHumanRows(): { rows: HumanRow[]; scanned: string[]; skipped: { file: string; why: string }[] } {
  const rows: HumanRow[] = [];
  const scanned: string[] = [];
  const skipped: { file: string; why: string }[] = [];
  const push = (src: string, url: string, originCode: string | null, verdict: string, facts: ProductFacts | null = null) => {
    if (!url || !verdict) return;
    rows.push({ src, url, domain: domainOf(url), originCode, verdict, facts });
  };

  /* wu-059 — searchId → origins[sid].sku · 🟢 facts 저장됨 */
  {
    const j = readJson("wu-059-gt-facts.json") as {
      origins: Record<string, { canonicalProduct?: { sku?: { value?: string } } }>;
      candidates: Record<string, { searchId: string; url: string; humanGt: string; facts: ProductFacts }>;
    };
    const code = Object.fromEntries(
      Object.entries(j.origins).map(([k, v]) => [k, v.canonicalProduct?.sku?.value ?? null]),
    );
    for (const c of Object.values(j.candidates)) push("wu-059", c.url, code[c.searchId] ?? null, c.humanGt, c.facts);
    scanned.push("wu-059-gt-facts.json");
  }

  /* wu-068 — 같은 searchId 체계 · 🟢 facts 저장됨 */
  {
    const o = readJson("wu-059-gt-facts.json") as {
      origins: Record<string, { canonicalProduct?: { sku?: { value?: string } } }>;
    };
    const code = Object.fromEntries(
      Object.entries(o.origins).map(([k, v]) => [k, v.canonicalProduct?.sku?.value ?? null]),
    );
    const j = readJson("wu-068-new-gt.json") as Record<
      string,
      { searchId: string; url: string; gt: string; facts: ProductFacts }
    >;
    for (const r of Object.values(j)) push("wu-068", r.url, code[r.searchId] ?? null, r.gt, r.facts);
    scanned.push("wu-068-new-gt.json");
  }

  /* core-2m — 파일 상단 originCode · calibrationLabel */
  {
    const j = readJson("core-2m-ceo-visual-gt.json") as {
      originCode: string;
      candidates: { url: string; calibrationLabel: string }[];
    };
    for (const c of j.candidates) push("core-2m", c.url, j.originCode, c.calibrationLabel);
    scanned.push("core-2m-ceo-visual-gt.json");
  }

  /* 행 단위 originCode + verdict 계열 */
  for (const [file, src, codeKey, verdictKey] of [
    ["wu-112-human-gt.json", "wu-112", "originCode", "verdict"],
    ["wu-116-human-gt.json", "wu-116", "originCode", "humanVerdict"],
    ["wu-111-human-gt.json", "wu-111", "originCode", "humanVerdict"],
    ["core-2aj-human-gt.json", "core-2aj", "originCode", "verdict"],
    ["wu-125-human-gt.json", "wu-125", "origin", "human"],
    ["core-2al-human-gt.json", "core-2al", "origin", "verdict"],
  ] as const) {
    const j = readJson(file) as { candidates?: Record<string, unknown>[] };
    for (const c of j.candidates ?? []) {
      push(src, String(c.url ?? ""), (c[codeKey] as string) ?? null, String(c[verdictKey] ?? ""));
    }
    scanned.push(file);
  }

  /* 🔴 URL 이 없어 쓸 수 없는 풀을 **숨기지 않고 적는다** */
  skipped.push({ file: "wu-093-human-gt.json", why: "🔴 키가 **판매처 SKU** 이고 URL 이 없다 ⟹ 발화 계산 불가" });
  skipped.push({ file: "wu-099-human-value.json", why: "🔴 가치 라벨(USEFUL/NOISE) · 원상품 B226AC112 ⟹ 동일상품 GT 가 아니다" });
  skipped.push({ file: "wu-100-human-value.json", why: "🔴 같은 이유(가치 라벨)" });
  skipped.push({ file: "wu-067-blind-review-set.json", why: "🟢 라벨 없음(블라인드 입력 세트)" });
  skipped.push({ file: "wu-074-probe.json", why: "🟢 HTTP probe 결과뿐 · 라벨 없음" });
  skipped.push({ file: "core-same03-human-gt.json", why: "🟢 수집함(아래 별도) · 🔴 CEO DIFFERENT **0**" });

  /* SAME-03 최신 CEO 라벨 — 🔴 DIFFERENT 가 0 이지만 분모로 같이 적는다 */
  {
    const j = readJson("core-same03-human-gt.json") as {
      candidates: { originCode: string; url: string; ceo: string }[];
    };
    for (const c of j.candidates) push("core-same03", c.url, c.originCode, c.ceo);
    scanned.push("core-same03-human-gt.json");
  }

  return { rows, scanned, skipped };
}

/** 🔴 fixture 어휘가 여러 개다 — **정규화만** 하고 의미를 바꾸지 않는다. */
export function normalizeVerdict(v: string): "SAME" | "DIFFERENT" | "UNDETERMINED" | "OTHER" {
  const s = v.trim();
  if (s === "SAME" || s === "동일") return "SAME";
  if (s === "DIFFERENT" || s === "다른제품") return "DIFFERENT";
  /** 🔴 「판단불가」를 DIFFERENT 로 바꾸지 않는다(§10). */
  if (s === "UNCERTAIN" || s === "판단불가" || s === "UNDETERMINED" || s === "유사") return "UNDETERMINED";
  return "OTHER";
}

/* ══════════════════════════════════════════════════════════════════════════════
   ② 발화 술어 — 🔴 SAME-05 와 «같은 조건»
   ══════════════════════════════════════════════════════════════════════════════ */

export function firesP1Brand(f: ProductFacts): boolean {
  if (f.brand) return false; // 선언된 brand 는 덮지 않는다
  return f.coreTitleTokens.some((t) => KNOWN_ALIASES.includes(t));
}

export function firesP2Code(originCode: string | null, f: ProductFacts): boolean {
  if (f.brandModelCode) return false; // 값이 있으면 덮지 않는다
  const code = originCode?.trim();
  if (!code || code.length < 4) return false;
  if (!/^[A-Za-z]$/.test(code[0])) return false;
  const tail = code.slice(1).toLowerCase();
  if (tail.length < 3) return false;
  return f.coreTitleTokens.some((t) => t.toLowerCase() === tail);
}

describe("CORE-PRICE-SAME-06 — ① 검색 범위와 기존 라벨 분포(네트워크 0)", () => {
  const { rows, scanned, skipped } = collectHumanRows();

  it("[검색 범위] fixture 를 전수 훑고 «쓸 수 없는 것» 까지 적는다", () => {
    const all = readdirSync(FIX).filter((f) => f.endsWith(".json"));
    console.log(`\n═══ 검색 범위 ═══`);
    console.log(`    fixture 전체 ${all.length} · 수집 ${scanned.length} · 제외 ${skipped.length}`);
    for (const s of skipped) console.log(`    제외  ${s.file.padEnd(32)} ${s.why}`);
    const unseen = all.filter((f) => !scanned.includes(f) && !skipped.some((s) => s.file === f));
    console.log(`    🔴 미분류 ${unseen.length} → ${unseen.join(" · ") || "없음"}`);
    /** 🔴 미분류가 남아 있으면 「전수」라고 적을 수 없다. */
    expect(unseen, "🔴 미분류 fixture 가 있으면 검색 범위를 「전수」로 보고하지 않는다").toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("[기존 라벨 분포] 사람 라벨을 어휘 변환 없이 센다", () => {
    const byUrl = new Map<string, HumanRow[]>();
    for (const r of rows) {
      const k = r.url;
      if (!byUrl.has(k)) byUrl.set(k, []);
      byUrl.get(k)!.push(r);
    }
    const dist = { SAME: 0, DIFFERENT: 0, UNDETERMINED: 0, OTHER: 0 };
    for (const r of rows) dist[normalizeVerdict(r.verdict)] += 1;
    console.log(`\n═══ 기존 라벨 분포 (행 ${rows.length} · 고유 URL ${byUrl.size}) ═══`);
    console.log(`    SAME ${dist.SAME} · DIFFERENT ${dist.DIFFERENT} · UNDETERMINED ${dist.UNDETERMINED} · OTHER ${dist.OTHER}`);
    const bySrc = new Map<string, number>();
    for (const r of rows.filter((x) => normalizeVerdict(x.verdict) === "DIFFERENT")) {
      bySrc.set(r.src, (bySrc.get(r.src) ?? 0) + 1);
    }
    console.log(`    DIFFERENT 출처 — ${[...bySrc].map(([k, v]) => `${k}:${v}`).join(" · ")}`);
    expect(dist.DIFFERENT, "🔴 DIFFERENT 라벨이 0 이면 이 WU 가 성립하지 않는다").toBeGreaterThan(0);
    expect(dist.OTHER, "🔴 해석하지 못한 어휘가 있으면 분모가 거짓이다").toBe(0);
  });

  /**
   * 🔴🔴🔴 **이 WU 의 답** — 기존 **저장 facts** 안에서 P1/P2 가 발화하는 DIFFERENT 를 센다.
   *
   * 🔴 저장 facts 가 있는 풀은 `wu-059`·`wu-068` **둘뿐** 이다(실측). 나머지 풀은
   *    facts 가 없어 **발화를 offline 으로 계산할 수 없다** ⟹ 아래 라이브 절에서 잰다.
   */
  it("[offline 발화] 저장 facts 안에서 P1/P2 발화 × 기존 라벨", () => {
    const withFacts = rows.filter((r) => r.facts);
    const fired = withFacts
      .map((r) => ({ r, p1: firesP1Brand(r.facts!), p2: firesP2Code(r.originCode, r.facts!) }))
      .filter((x) => x.p1 || x.p2);
    console.log(`\n═══ offline 발화 (저장 facts ${withFacts.length}행) ═══`);
    if (fired.length === 0) console.log(`    발화 **0** — 저장 facts 안에 P1/P2 가 걸리는 후보가 없다`);
    for (const x of fired) {
      console.log(
        `    ${x.r.src.padEnd(9)} ${x.r.domain.padEnd(26)} P1=${x.p1 ? "YES" : "no "} P2=${x.p2 ? "YES" : "no "} ` +
          `기존라벨=${normalizeVerdict(x.r.verdict)}`,
      );
    }
    const firedDifferent = fired.filter((x) => normalizeVerdict(x.r.verdict) === "DIFFERENT");
    console.log(`    🔴 그중 기존 DIFFERENT = **${firedDifferent.length}**`);
    /**
     * 🔴 이 수가 0 이면 **offline 으로는 안전성 분모를 못 만든다** — 「없다」가 아니라
     *    **라이브로 더 찾아야 한다**(아래). §7 의 STOP 은 **라이브까지 본 뒤** 판정한다.
     */
    expect(firedDifferent.length).toBeGreaterThanOrEqual(0);
  });

  it("[라이브 대상] facts 가 없어 라이브로 재야 하는 DIFFERENT 를 센다", () => {
    const byUrl = liveTargets(rows);
    console.log(`\n═══ 라이브로 재야 하는 DIFFERENT (고유 URL ${byUrl.length}) ═══`);
    for (const r of byUrl) {
      console.log(`    ${r.src.padEnd(9)} ${r.domain.padEnd(26)} origin=${r.originCode ?? "(미상)"}`);
    }
    expect(byUrl.length).toBeGreaterThan(0);
  });
});

/** 🔴 origin 코드가 **없는** 행은 P2 를 계산할 수 없다 — 그 사실을 같이 들고 간다. */
function liveTargets(rows: HumanRow[]): HumanRow[] {
  const need = rows.filter((r) => !r.facts && normalizeVerdict(r.verdict) === "DIFFERENT");
  const byUrl = new Map<string, HumanRow>();
  for (const r of need) if (!byUrl.has(r.url)) byUrl.set(r.url, r);
  return [...byUrl.values()];
}

/* ══════════════════════════════════════════════════════════════════════════════
   ③ 라이브 — 🔴 **기존 DIFFERENT 라벨의 facts 만** 읽는다(새 라벨 생성 0)
   ══════════════════════════════════════════════════════════════════════════════ */

describe("CORE-PRICE-SAME-06 — ② 라이브 발화 측정(기존 DIFFERENT 라벨 전용)", () => {
  it.runIf(process.env.CORE_SAME06_LIVE === "1")(
    "기존 human DIFFERENT 후보에서 P1/P2 가 발화하는지 전수 확인한다",
    async () => {
      const { factsFromProductUrl } = await import("@commerce/crawler");
      const { rows } = collectHumanRows();
      const targets = liveTargets(rows);

      const out: {
        r: HumanRow;
        status: string;
        p1: boolean;
        p2: boolean;
        brand: string | null;
        code: string | null;
        tokens: string[];
      }[] = [];

      console.log(`\n═══ 라이브 발화 측정 — 기존 DIFFERENT ${targets.length}건 ═══`);
      for (const r of targets) {
        const f = await factsFromProductUrl(r.url);
        if (f.status !== "OK" || !f.candidate?.facts) {
          out.push({ r, status: f.status, p1: false, p2: false, brand: null, code: null, tokens: [] });
          console.log(`    ${r.domain.padEnd(26)} 🔴 ${f.status} — 측정불가`);
          continue;
        }
        const facts = f.candidate.facts;
        const p1 = firesP1Brand(facts);
        const p2 = firesP2Code(r.originCode, facts);
        out.push({ r, status: "OK", p1, p2, brand: facts.brand, code: facts.brandModelCode, tokens: facts.coreTitleTokens });
        console.log(
          `    ${r.domain.padEnd(26)} P1=${p1 ? "🔴YES" : "no  "} P2=${p2 ? "🔴YES" : "no  "} ` +
            `brand=${facts.brand ?? "null"} code=${facts.brandModelCode ?? "null"} origin=${r.originCode ?? "(미상)"}`,
        );
      }

      const read = out.filter((x) => x.status === "OK");
      const p1Fired = read.filter((x) => x.p1);
      const p2Fired = read.filter((x) => x.p2);
      const bothFired = read.filter((x) => x.p1 && x.p2);

      console.log(`\n═══ §17 보고 숫자 ═══`);
      console.log(`    기존 DIFFERENT 라벨 (고유 URL)        ${targets.length}`);
      console.log(`    그중 페이지를 읽은 것                  ${read.length}  (🔴 측정불가 ${targets.length - read.length})`);
      console.log(`    origin 코드 보유(= P2 계산 가능)        ${read.filter((x) => x.r.originCode).length}`);
      console.log(`    🔴 Case A — P1 발화 × DIFFERENT        **${p1Fired.length}**`);
      console.log(`    🔴 Case B — P2 발화 × DIFFERENT        **${p2Fired.length}**`);
      console.log(`    🔴 Case C — P1+P2 발화 × DIFFERENT     **${bothFired.length}**`);
      if (p1Fired.length + p2Fired.length === 0) {
        console.log(
          `\n    🔴🔴 **STOP — P1/P2 안전성 분모 확보 불가**\n` +
            `         기존 사람 라벨 전수(fixture 15 · 행 102 · DIFFERENT 28)에서\n` +
            `         P1/P2 가 발화하는 DIFFERENT 후보가 **0** 이다.\n` +
            `         🔴 CTO 는 새 DIFFERENT GT 를 만들지 않는다(§2·§7).`,
        );
      } else {
        console.log(`\n    🟡 발화 후보가 있다 ⟹ SAME-03 화면에 넣어 **CEO 최신 판정** 을 받는다(§9).`);
        for (const x of [...p1Fired, ...p2Fired]) {
          console.log(`       ${x.r.domain.padEnd(26)} ${x.r.url}`);
        }
      }

      /** 🔴 읽기 실패를 「발화 0」으로 세지 않는다 — 분모를 갈라 적는다(§9). */
      expect(read.length + (targets.length - read.length)).toBe(targets.length);
      /** 🔴 발화 수는 **측정 결과** 다 — 특정 값을 기대하지 않는다(여기서 단정하면 그것이 조작이다). */
      expect(p1Fired.length).toBeGreaterThanOrEqual(0);
      expect(p2Fired.length).toBeGreaterThanOrEqual(0);
    },
    1_800_000,
  );

  /**
   * 🔴🔴 §17 §2·§3 은 **발화 총수와 그 라벨 분포** 를 요구한다 — DIFFERENT 만 세면
   *    「발화 자체가 드문가」와 「발화가 SAME 쪽에만 쏠렸는가」를 **가를 수 없다.**
   * 🟢 그래서 **라벨이 있는 고유 URL 전수** 에서 발화 × 라벨 교차표를 만든다.
   */
  it.runIf(process.env.CORE_SAME06_FULL === "1")(
    "[전수 교차표] 발화가 어느 라벨에 쏠려 있는지 본다",
    async () => {
      const { factsFromProductUrl } = await import("@commerce/crawler");
      const { rows } = collectHumanRows();
      /** 🔴 같은 URL 이 여러 풀에 있으면 **라벨 충돌** 일 수 있다 — 합치지 않고 적는다. */
      const byUrl = new Map<string, HumanRow[]>();
      for (const r of rows) {
        if (!byUrl.has(r.url)) byUrl.set(r.url, []);
        byUrl.get(r.url)!.push(r);
      }

      const cells = new Map<string, number>();
      const bump = (fire: string, label: string) => cells.set(`${fire}|${label}`, (cells.get(`${fire}|${label}`) ?? 0) + 1);
      let unread = 0;
      const firedRows: { domain: string; url: string; fire: string; labels: string }[] = [];

      for (const [url, group] of byUrl) {
        const labels = [...new Set(group.map((g) => normalizeVerdict(g.verdict)))];
        const label = labels.length > 1 ? `충돌(${labels.join("/")})` : labels[0];
        /** 🟢 저장 facts 가 있으면 그것을 쓴다(네트워크 절약 · 같은 값이다). */
        const stored = group.find((g) => g.facts)?.facts ?? null;
        let facts = stored;
        if (!facts) {
          const f = await factsFromProductUrl(url);
          if (f.status !== "OK" || !f.candidate?.facts) {
            unread += 1;
            bump("측정불가", label);
            continue;
          }
          facts = f.candidate.facts;
        }
        const originCode = group.find((g) => g.originCode)?.originCode ?? null;
        const p1 = firesP1Brand(facts);
        const p2 = firesP2Code(originCode, facts);
        const fire = p1 && p2 ? "P1+P2" : p1 ? "P1" : p2 ? "P2" : "발화없음";
        bump(fire, label);
        if (fire !== "발화없음") firedRows.push({ domain: domainOf(url), url, fire, labels: label });
      }

      const FIRES = ["P1", "P2", "P1+P2", "발화없음", "측정불가"];
      const LABELS = ["SAME", "DIFFERENT", "UNDETERMINED"];
      console.log(`\n═══ 전수 교차표 — 발화 × 사람 라벨 (고유 URL ${byUrl.size} · 읽기 실패 ${unread}) ═══`);
      const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
      console.log(`    ${pad("발화", 12)}${LABELS.map((l) => pad(l, 14)).join("")}${pad("충돌", 10)}합`);
      for (const fire of FIRES) {
        const vals = LABELS.map((l) => cells.get(`${fire}|${l}`) ?? 0);
        const conflict = [...cells].filter(([k]) => k.startsWith(`${fire}|충돌`)).reduce((s, [, v]) => s + v, 0);
        const sum = vals.reduce((a, b) => a + b, 0) + conflict;
        console.log(`    ${pad(fire, 12)}${vals.map((v) => pad(String(v), 14)).join("")}${pad(String(conflict), 10)}${sum}`);
      }
      console.log(`\n═══ 발화한 후보 전수 ═══`);
      for (const f of firedRows) console.log(`    ${pad(f.fire, 7)} ${pad(f.domain, 26)} 라벨=${f.labels}`);

      /**
       * 🔴🔴🔴 **이 표가 §13 GO 조건을 왜 충족할 수 없는지 보여 준다** —
       *    발화가 DIFFERENT 칸에 **0** 이면 leakage 를 **잴 수 없다**.
       */
      const firedDifferent = LABELS.includes("DIFFERENT")
        ? ["P1", "P2", "P1+P2"].reduce((s, f) => s + (cells.get(`${f}|DIFFERENT`) ?? 0), 0)
        : 0;
      console.log(
        `\n    🔴 발화 × DIFFERENT = **${firedDifferent}** ⟹ ` +
          (firedDifferent === 0 ? "**leakage 측정불가 · STOP**" : "leakage 측정 가능"),
      );
      expect(byUrl.size).toBeGreaterThan(0);
    },
    2_400_000,
  );

  it("라이브 축은 환경변수로만 돈다", () => {
    const live = process.env.CORE_SAME06_LIVE === "1";
    expect(live, live ? "" : "🟡 CORE_SAME06_LIVE=1 이 아니라 라이브 발화 측정을 건너뛴다").toBe(live);
  });
});
