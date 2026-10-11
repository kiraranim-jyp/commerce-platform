/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-03 B — Discovery Effectiveness (CPO 승인, 2026-10-11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 Gemini 를 실제로 부른다.
 *
 * **질문:** 실제 상품에서 확보한 식별정보 중 무엇을 조합해야 Gemini 가 동일상품
 * 후보를 «가장 적은 비용으로» 정확히 찾는가.
 *
 * 🔴 A(Data Availability · 497건 전수)와 B(Discovery Effectiveness · 7건 층화)를
 *    **섞지 않는다**(CPO 명시). 이 파일은 B 만 측정한다.
 *    `L2 생성 가능 55.1%` 는 A 의 숫자이고, 아래는 L2 의 «검색 성능» 이다.
 *
 * ── 표본: 실제 Production snapshot 7건(층화) ────────────────────────────────
 *   junioredition 2 · bobochoses 2  → 🟢 brandModelCode 확보형
 *   smallable 2 · tennis-warehouse 1 → 🔴 미확보형
 *   🔴 bobochoses 2건의 brand 는 `"AW26"` 이다(낡은 snapshot). **고치지 않는다** —
 *      오염된 brand 가 Discovery 에 어떻게 작용하는지가 측정 대상이다.
 *
 * ── 🔴 Level 은 «정보량» 축이다. whitelist 는 끈다 ──────────────────────────
 *   `preferredDomains: []` 를 **명시** 한다. whitelist 효과가 섞이면 이 측정이
 *   정보량 실험이 아니라 두 변수 실험이 된다.
 *
 * 🔴 Gemini 후보를 SAME 으로 «취급하지 않는다». 이 파일은 후보 URL 과 비용만
 *    기록한다 — Identity 판정은 뒤 단계(Light Fetch → MI)가 한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGoogleDiscoveryProvider } from "../google-discovery";
import { matchSupportedDomain, supportedPriceSourceDomains } from "../supported-sellers";
import type { DiscoveredUrl, DiscoveryQuery, ProductIdentity, QueryId } from "../types";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");
const GOLDEN = process.env.MI_P0_03_GOLDEN ?? path.join(OUT_DIR, "mi-p0-03-golden7.json");
const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");

/** 🔴 `scripts/.env` 를 직접 읽는다 — vitest 가 자동 로드하지 않는다. 값은 로그에 내지 않는다. */
function loadGeminiKey(): void {
  if (process.env.GEMINI_API_KEY?.trim()) return;
  const p = path.join(REPO_ROOT, "scripts", ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const hit = /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (hit) process.env.GEMINI_API_KEY = hit[1].replace(/^["']|["']$/g, "");
  }
}

interface Golden {
  host: string; url: string; brand: string; title: string;
  code: string | null; sku: string | null; color: string | null; material: string; img: number;
}

type Level = "L0" | "L1" | "L2" | "L3" | "L4";

/**
 * 🔴 Level 별로 `ProductIdentity` 와 `query.text` 를 «같이» 통제한다.
 *    `buildPrompt` 는 `query.text` 외에 `identity.brand`·`identity.productCode` 를
 *    따로 싣는다(실측 확인) — identity 를 비우지 않으면 L0 에 품번이 새어 든다.
 */
function buildLevel(g: Golden, level: Level): { identity: ProductIdentity; query: DiscoveryQuery } | null {
  const base: ProductIdentity = {
    brand: null, productName: null, productType: null, genderAge: null,
    color: null, size: null, season: null, productCode: null,
    sourceUrl: g.url, sourceSite: g.host, sourceCountry: null, market: null,
  };
  const parts: string[] = [];
  const id = { ...base };
  if (!g.brand) return null;
  id.brand = g.brand; parts.push(g.brand);                                   // L0~
  if (level !== "L0") { id.productName = g.title; }
  if (level === "L1" || level === "L3" || level === "L4") parts.push(g.title);
  if (level === "L2" || level === "L3" || level === "L4") {
    if (!g.code) return null;                                               // 🔴 code 없으면 그 Level 은 «생성 불가»
    id.productCode = g.code; parts.push(g.code);
  }
  if (level === "L4") {
    // 🔴 보조 축은 «있는 것만» 넣는다. 없는 값을 지어내지 않는다.
    if (g.color) { id.color = g.color; parts.push(g.color); }
    const fabric = g.material?.trim();
    if (fabric) parts.push(fabric);
  }
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  // 🔴 QueryId 어휘를 새로 만들지 않는다 — 기존 Q1..Q8 중 하나를 라벨로 쓴다.
  const qid: Record<Level, QueryId> = { L0: "Q1", L1: "Q2", L2: "Q6", L3: "Q4", L4: "Q3" };
  return { identity: id, query: { id: qid[level], axis: level, text, usedFields: [] } };
}

interface Rec {
  host: string; url: string; level: Level; queryText: string | null;
  buildable: boolean; outcome: "OK" | "API_FAILURE" | "CONFIG_MISSING" | "NOT_BUILDABLE";
  failureDetail: string | null;
  discovered: DiscoveredUrl[];
  distinctHosts: string[];
  registryHits: string[];
  /** 🔴 응답이 보고한 토큰. 추정하지 않는다. */
  usage: { requests: number; promptTokens: number; candidatesTokens: number; thoughtsTokens: number; totalTokens: number };
}

const LEVELS: Level[] = ["L0", "L1", "L2", "L3", "L4"];

describe.skipIf(!LIVE)("🔴 MI-P0-03 B — Query 정보량 × 후보 품질 (7 × L0~L4)", () => {
  it(
    "35회 실측 — 후보 URL·호스트 분포·토큰을 그대로 기록한다",
    async () => {
      loadGeminiKey();
      const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Golden[];
      expect(golden.length).toBe(7);
      const registry = supportedPriceSourceDomains();
      const recs: Rec[] = [];

      for (const g of golden) {
        for (const level of LEVELS) {
          const built = buildLevel(g, level);
          if (!built) {
            recs.push({
              host: g.host, url: g.url, level, queryText: null, buildable: false,
              outcome: "NOT_BUILDABLE", failureDetail: "brandModelCode 없음",
              discovered: [], distinctHosts: [], registryHits: [],
              usage: { requests: 0, promptTokens: 0, candidatesTokens: 0, thoughtsTokens: 0, totalTokens: 0 },
            });
            // eslint-disable-next-line no-console
            console.log(`${g.host.padEnd(22)} ${level} → 🔴 생성불가(code 없음)`);
            continue;
          }
          // 🔴 whitelist 를 «끈다» — 정보량 단일 변수 실험이다.
          const provider = createGoogleDiscoveryProvider({ preferredDomains: [] });
          let rec: Rec = {
            host: g.host, url: g.url, level, queryText: built.query.text, buildable: true,
            outcome: "OK", failureDetail: null, discovered: [], distinctHosts: [], registryHits: [],
            usage: { requests: 0, promptTokens: 0, candidatesTokens: 0, thoughtsTokens: 0, totalTokens: 0 },
          };
          try {
            const discovered = await provider.discover(built.identity, built.query);
            // 🔴 grounding 의 web.title 은 «도메인» 이다(실측) — 그걸 호스트로 쓴다.
            const hosts = discovered.map((d) => (d.title ?? "").trim().toLowerCase()).filter(Boolean);
            rec = {
              ...rec, discovered,
              distinctHosts: [...new Set(hosts)],
              registryHits: [...new Set(hosts.map((h) => matchSupportedDomain(h, registry)).filter((x): x is string => !!x))],
            };
          } catch (e) {
            const name = e instanceof Error ? e.name : "unknown";
            rec = { ...rec, outcome: name === "GoogleDiscoveryConfigError" ? "CONFIG_MISSING" : "API_FAILURE",
                    failureDetail: e instanceof Error ? e.message : "unknown" };
          }
          rec.usage = provider.usage();
          recs.push(rec);
          // eslint-disable-next-line no-console
          console.log(
            `${g.host.padEnd(22)} ${level} → ${rec.outcome.padEnd(12)} 후보 ${String(rec.discovered.length).padStart(3)} · ` +
              `distinct호스트 ${String(rec.distinctHosts.length).padStart(2)} · registry ${rec.registryHits.length} · ` +
              `tok ${rec.usage.totalTokens} · q="${String(rec.queryText).slice(0, 56)}"`,
          );
        }
      }

      mkdirSync(OUT_DIR, { recursive: true });
      // 🔴 URL 을 자르지 않는다. 원문 그대로.
      writeFileSync(path.join(OUT_DIR, "mi-p0-03-levels.json"), JSON.stringify({ golden, recs }, null, 1), "utf8");

      const byLevel = (l: Level) => recs.filter((r) => r.level === l);
      const sum = (rs: Rec[], f: (r: Rec) => number) => rs.reduce((a, r) => a + f(r), 0);
      const summary = LEVELS.map((l) => {
        const rs = byLevel(l), ok = rs.filter((r) => r.outcome === "OK");
        return {
          level: l,
          buildable: rs.filter((r) => r.buildable).length,
          ok: ok.length,
          apiFailure: rs.filter((r) => r.outcome === "API_FAILURE").length,
          candidates: sum(ok, (r) => r.discovered.length),
          distinctHosts: sum(ok, (r) => r.distinctHosts.length),
          registryHits: sum(ok, (r) => r.registryHits.length),
          totalTokens: sum(rs, (r) => r.usage.totalTokens),
          thoughtsTokens: sum(rs, (r) => r.usage.thoughtsTokens),
        };
      });
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(summary, null, 2));
      writeFileSync(path.join(OUT_DIR, "mi-p0-03-levels-summary.json"), JSON.stringify(summary, null, 1), "utf8");

      // 🔴 결과 방향을 단언하지 «않는다». 35칸을 실제로 돌았다는 것만 단언한다.
      expect(recs.length).toBe(7 * 5);
    },
    120 * 60 * 1000,
  );
});
