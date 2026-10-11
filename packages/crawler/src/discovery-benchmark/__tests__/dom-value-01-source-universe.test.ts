/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 SAME Coverage 사업가치 WU — Phase 1: Source Universe + 접근 정책
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 HTTP 를 쓴다.
 * 🔴 **robots.txt 만 받는다.** 상품 페이지를 긁지 않는다 — 접근 «가능성» 만 본다.
 *
 * ── 왜 이것이 먼저인가 (§8 · §9) ───────────────────────────────────────────
 *   지시서는 MANUAL 12개와 NOT_AVAILABLE 13개를 「사업적 잠재 source 조사군」으로
 *   평가하라고 한다. 🔴 그런데 그 조사는 **접근 정책을 넘지 않아야** 한다.
 *   그래서 먼저 `checkRobots` 로 전수를 가른다 — 막힌 source 는 §5(해외 품번
 *   가용성) 조사 대상에서 **구조적으로 제외** 된다.
 *
 * ── 🔴 owner 를 재구현하지 않는다 ──────────────────────────────────────────
 *   `utils/robots-gate.ts` 의 `checkRobots(targetUrl)` 가 이미 있고, 그 파일이
 *   규칙을 적어 뒀다:
 *     · 반환값이 `ALLOWED` 가 «아니라» `NOT_DISALLOWED` 다 — robots 허용 ≠ 약관 허용
 *     · `DISALLOWED` 면 받지 않는다. UA 를 바꿔 재시도하지 «않는다»
 *     · robots 를 못 읽으면 `UNKNOWN` 이고 **「허용」으로 읽지 않는다**
 *   🔴 이 하니스도 그 세 규칙을 그대로 따른다. 우회를 시도하지 않는다.
 *
 * ── 선행 확정 사실 (FULL POPULATION, 읽기 전용 SELECT) ─────────────────────
 *   등록부 34개 — AUTO_SCRAPE 7 · MANUAL 12 · NOT_AVAILABLE 13 · disabled 1 · 기타
 *   실제 링크를 만든 host 4개 (foretforet · bobochoses · deuxbebe · littleluna)
 *   🔴 자동 커버리지는 「품번을 읽을 수 있는 샵」에서만 생긴다(선행 WU 실측)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkRobots } from "../../utils/robots-gate";
import { CRAWLER_USER_AGENT } from "../../utils/user-agent";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

interface SrcRow {
  id: string; name: string; domain: string; url: string | null; currency: string | null;
  collection_strategy: string | null; enabled: boolean; status: string;
  access_status: string | null; category_scope: string[] | null; source_role: string | null;
  source_type: string | null; seller_type: string | null;
}

/** 🔴 「자동 후보 경로가 있는가」를 등록부 칸으로만 가른다. 추측하지 않는다. */
function lane(s: SrcRow): string {
  if (!s.enabled) return "DISABLED(등록부)";
  if (s.status !== "ACTIVE") return `NOT_AVAILABLE(${s.status})`;
  if (s.collection_strategy === "AUTO_SCRAPE") return "AUTO_SCRAPE";
  return `MANUAL(${s.collection_strategy ?? "null"})`;
}

describe.skipIf(!LIVE)("🔴 DOM-VALUE-01 — 국내 판매처 34개의 접근 정책 전수", () => {
  it(
    "checkRobots 로 전수를 가른다 — 막힌 source 는 조사 대상에서 제외된다",
    async () => {
      const p = path.join(OUT_DIR, "cov-sources.json");
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
      const sources = JSON.parse(readFileSync(p, "utf8")) as SrcRow[];

      interface Row {
        domain: string; name: string; lane: string; collectionStrategy: string | null;
        sourceRole: string | null; sellerType: string | null; registryUrl: string | null;
        probedUrl: string; robotsState: string; robotsDetail: string;
        crawlDelaySeconds: number | null;
        /** 🔴 조사 가능성 — robots 한 축만 본 결과다. 약관 판단이 아니다. */
        investigable: boolean;
      }
      const rows: Row[] = [];
      for (const s of sources) {
        // 🔴 등록부 url 이 있으면 그것을, 없으면 도메인 루트를 본다(경로를 지어내지 않는다).
        const probe = s.url && /^https?:\/\//.test(s.url) ? s.url : `https://${s.domain}/`;
        const v = await checkRobots(probe);
        rows.push({
          domain: s.domain, name: s.name, lane: lane(s),
          collectionStrategy: s.collection_strategy, sourceRole: s.source_role,
          sellerType: s.seller_type, registryUrl: s.url, probedUrl: probe,
          robotsState: v.state,
          robotsDetail: v.state === "DISALLOWED" ? `rule=${v.rule}` : v.state === "UNKNOWN" ? v.reason : v.evidence.slice(0, 80),
          crawlDelaySeconds: v.state === "NOT_DISALLOWED" ? v.crawlDelaySeconds : null,
          investigable: v.state === "NOT_DISALLOWED",
        });
        // eslint-disable-next-line no-console
        console.log(`${s.domain.padEnd(26)} ${lane(s).padEnd(22)} ${v.state}`);
      }

      const count = <T>(xs: T[], k: (x: T) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const report = {
        scope: {
          note: "🔴 FULL POPULATION — 등록부 34개 전수. robots.txt «만» 받았다(상품 페이지 미수집).",
          userAgent: CRAWLER_USER_AGENT.slice(0, 40) + "…",
          owner: "utils/robots-gate.ts checkRobots — 재구현하지 않았다",
          "🔴 해석 주의": "NOT_DISALLOWED 는 「약관상 허용」이 아니다. robots 한 축이다.",
        },
        byLane: count(rows, (r) => r.lane),
        byRobots: count(rows, (r) => r.robotsState),
        /** 🔴 핵심 교차표 — 어느 lane 이 조사 가능한가 */
        laneByRobots: count(rows, (r) => `${r.lane} × ${r.robotsState}`),
        /** 🟢 §5(해외 품번 가용성) 조사 대상 — robots 가 막지 않은 것만 */
        investigable: rows.filter((r) => r.investigable).map((r) => `${r.domain} [${r.lane}]`),
        /** 🔴 구조적으로 제외 — 우회하지 않는다 */
        excluded: rows.filter((r) => !r.investigable).map((r) => `${r.domain} [${r.lane}] ${r.robotsState}: ${r.robotsDetail}`),
        crawlDelays: rows.filter((r) => r.crawlDelaySeconds).map((r) => `${r.domain}=${r.crawlDelaySeconds}s`),
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domval-robots.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBe(sources.length);
    },
    60 * 60 * 1000,
  );
});
