import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-036 — **3-Way 비교 집계** (CEO 육안 GT 가 도착한 «뒤» 에 돈다)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 판정하지 않는다. CEO 가 내려받은 `wu-036-human-gt.json` 을 읽어
 *    **CPO §8 의 3-Way 표와 §9 의 KPI 를 그대로** 만든다.
 *
 * 🔴 입력이 없으면 **SKIP** 이다 — 「0건」으로 적지 않는다(헌장 §5-B 「측정불가 ≠ 0%」).
 * 🔴 AI 0 · HTTP 0 · 비용 0 · 운영 코드 변경 0.
 *
 * 사용법:
 * ```
 * (CEO 가 내려받은 파일을) $TEMP/mi-p0-02/wu-036-human-gt.json 에 둔다
 * WU_036_ANALYZE=1 npx vitest run ...wu-036-human-gt-analysis.test.ts
 * ```
 */

const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const HUMAN = path.join(OUT, "wu-036-human-gt.json");
/**
 * 🔴 **압축 코드 경로** — 화면의 클립보드/다운로드가 iframe 에서 막혀서(실측)
 *    한 줄짜리 `WU036|C01=S C02=D …` 를 손으로 복사하는 경로를 만들었다.
 *    그 줄만 받아도 **P0 두 KPI(False SAME · SAME MISS)는 전부 계산된다** —
 *    🔴 다만 **판단 근거(humanReason)는 들어오지 않는다.** 그 사실을 보고서에 적는다.
 */
const COMPACT = path.join(OUT, "wu-036-human-gt.txt");
const LIVE = process.env.WU_036_ANALYZE === "1" && (existsSync(HUMAN) || existsSync(COMPACT));

interface HumanRow {
  id: string;
  searchId: string;
  candidateUrl: string;
  domain: string;
  aiProviders: string[];
  miVerdict: string | null;
  miBlockers: string[];
  priorGt: string;
  humanGt: "SAME" | "DIFFERENT" | "UNCERTAIN" | null;
  humanReason: string | null;
}

const maybe = LIVE ? it : it.skip;

describe("WU-036 — 사람 · MI · AI 3-Way 집계", () => {
  maybe("Human GT 기준으로 False SAME 과 SAME MISS 를 전수 분류한다", () => {
    /**
     * 🟢 입력은 둘 중 하나다 — 전체 JSON 이 있으면 그것을 쓰고, 없으면 압축 코드를
     *    **WU-036 데이터셋과 합쳐** 같은 모양으로 만든다.
     * 🔴 압축 경로에서는 `humanReason` 이 **null** 이다(없는 것을 지어내지 않는다).
     */
    let rows: HumanRow[];
    let inputMode: "FULL_JSON" | "COMPACT";
    if (existsSync(HUMAN)) {
      inputMode = "FULL_JSON";
      rows = JSON.parse(readFileSync(HUMAN, "utf8")) as HumanRow[];
    } else {
      inputMode = "COMPACT";
      const dataset = JSON.parse(
        readFileSync(path.join(OUT, "wu-036-review-dataset.json"), "utf8"),
      ) as {
        id: string;
        searchId: string;
        candidate: { url: string; domain: string };
        sealed: { aiProviders: string[]; miVerdict: string | null; miBlockers: string[]; priorGt: string };
      }[];
      const raw = readFileSync(COMPACT, "utf8").trim();
      const map: Record<string, HumanRow["humanGt"]> = {};
      for (const tok of raw.replace(/^WU036\|/, "").split(/\s+/)) {
        const [id, code] = tok.split("=");
        if (!id || !code) continue;
        map[id] =
          code === "S" ? "SAME" : code === "D" ? "DIFFERENT" : code === "U" ? "UNCERTAIN" : null;
      }
      /** 🔴 코드에 없는 id 가 있으면 조용히 넘기지 않는다 — 분모가 틀어진다. */
      const unknown = Object.keys(map).filter((id) => !dataset.some((d) => d.id === id));
      expect(unknown, `데이터셋에 없는 id: ${unknown.join(",")}`).toHaveLength(0);
      rows = dataset.map((d) => ({
        id: d.id,
        searchId: d.searchId,
        candidateUrl: d.candidate.url,
        domain: d.candidate.domain,
        aiProviders: d.sealed.aiProviders,
        miVerdict: d.sealed.miVerdict,
        miBlockers: d.sealed.miBlockers,
        priorGt: d.sealed.priorGt,
        humanGt: map[d.id] ?? null,
        humanReason: null,
      }));
    }
    // eslint-disable-next-line no-console
    console.log("[WU-036-INPUT]", inputMode);
    expect(rows.length, "후보 수가 51 이어야 한다").toBe(51);

    /** 🔴 미판정은 **분모에서 뺀다** — SAME/DIFFERENT 로 추정하지 않는다. */
    const judged = rows.filter((r) => r.humanGt);
    const unjudged = rows.length - judged.length;
    const same = (v: string | null) => v === "SAME";

    const hSame = judged.filter((r) => r.humanGt === "SAME");
    const hDiff = judged.filter((r) => r.humanGt === "DIFFERENT");
    const hUnsure = judged.filter((r) => r.humanGt === "UNCERTAIN");

    /* ── P0 둘 ────────────────────────────────────────────────── */
    const falseSame = hDiff.filter((r) => same(r.miVerdict));
    const sameMiss = hSame.filter((r) => !same(r.miVerdict));
    const agree = judged.filter(
      (r) => (r.humanGt === "SAME") === same(r.miVerdict) && r.humanGt !== "UNCERTAIN",
    );

    /* ── AI별 ─────────────────────────────────────────────────── */
    const providers = [...new Set(rows.flatMap((r) => r.aiProviders))].sort();
    const byProvider = Object.fromEntries(
      providers.map((p) => {
        const mine = judged.filter((r) => r.aiProviders.includes(p));
        return [
          p,
          {
            candidates: rows.filter((r) => r.aiProviders.includes(p)).length,
            judged: mine.length,
            humanSame: mine.filter((r) => r.humanGt === "SAME").length,
            humanDifferent: mine.filter((r) => r.humanGt === "DIFFERENT").length,
            humanUncertain: mine.filter((r) => r.humanGt === "UNCERTAIN").length,
            /** 🔴 분모가 AI마다 다르므로 **비율을 AI 간 직접 비교하지 않는다**(CPO §9). */
            usefulRate: mine.length ? +(mine.filter((r) => r.humanGt === "SAME").length / mine.length).toFixed(3) : null,
          },
        ];
      }),
    );

    /** 🔴 기존 라벨과 사람 판정이 갈린 건 — 어느 쪽이 맞는지 **단정하지 않는다**. */
    const priorVsHuman = judged.filter((r) => r.humanGt !== "UNCERTAIN" && r.humanGt !== r.priorGt);

    const summary = {
      total: rows.length,
      judged: judged.length,
      /** 🔴 「0」이 아니라 「미판정」이다. */
      unjudged,
      human: { SAME: hSame.length, DIFFERENT: hDiff.length, UNCERTAIN: hUnsure.length },
      mi: judged.reduce<Record<string, number>>((a, r) => {
        const k = String(r.miVerdict);
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, {}),
      P0_falseSame: falseSame.length,
      P0_sameMiss: sameMiss.length,
      agreement: judged.length - hUnsure.length ? +(agree.length / (judged.length - hUnsure.length)).toFixed(3) : null,
      byProvider,
      priorLabelDisagreement: priorVsHuman.length,
    };

    const detail = {
      falseSame: falseSame.map((r) => ({ id: r.id, domain: r.domain, mi: r.miVerdict, why: r.humanReason })),
      sameMiss: sameMiss.map((r) => ({
        id: r.id,
        domain: r.domain,
        mi: r.miVerdict,
        blockers: r.miBlockers,
        why: r.humanReason,
      })),
      uncertain: hUnsure.map((r) => ({ id: r.id, domain: r.domain, why: r.humanReason })),
      priorVsHuman: priorVsHuman.map((r) => ({ id: r.id, domain: r.domain, prior: r.priorGt, human: r.humanGt })),
    };

    writeFileSync(path.join(OUT, "wu-036-3way.json"), JSON.stringify({ summary, detail, rows }, null, 2));
    // eslint-disable-next-line no-console
    console.log("[WU-036-3WAY]", JSON.stringify(summary));
    // eslint-disable-next-line no-console
    console.log("[WU-036-DETAIL]", JSON.stringify(detail, null, 1));

    /**
     * 🔴🔴 **이 단언이 이 WU 의 최우선 KPI 다.** 깨지면 그것이 결과이고,
     *    테스트를 고쳐서 통과시키지 않는다 — 보고서에 FALSE SAME 으로 올린다.
     */
    expect(falseSame.length, `🔴 FALSE SAME ${falseSame.length}건 — ${JSON.stringify(detail.falseSame)}`).toBe(0);
  });
});
