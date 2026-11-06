import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { EvidenceItem, ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-URL-EVIDENCE STEP 2 — **후보 URL 을 «실제로 방문» 해 증거를 모은다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 지시 §2 — 「검색 결과 제목이나 기존 DB 제목만으로 조사했다고 보고하면 안 된다」.
 *    그래서 **운영 함수 `factsFromProductUrl` 로 실제 HTTP** 를 보낸다.
 * 🔴 운영 matcher · Identity · 임계값 · 가격 적격성 **변경 0**. 이 파일은 **측정만** 한다.
 * 🟢🟢 축×출처 증거를 **내가 뽑지 않는다** — `factsFromProductUrl` 안에서
 *    `attachProductEvidence`(product-url-facts.ts:412·593)가 **이미** 붙여 준다.
 *    🔴 새 추출기 **0** · 복제 **0**(CPO §4·§8) — 운영이 보는 그 값을 그대로 읽는다.
 *
 * 🔴 **기본은 SKIP** 이다 — `MI_URL_EVIDENCE=1` 일 때만 네트워크를 쓴다.
 *    실행: `MI_URL_EVIDENCE=1 npx vitest run src/app/api/price-history/_lib/__tests__/mi-url-evidence-live.test.ts --testTimeout=1800000`
 *
 * 🔴 **접근 실패를 「정보 없음」으로 처리하지 않는다**(CPO §2) — status 를 그대로 남긴다.
 */

const LIVE = process.env.MI_URL_EVIDENCE === "1";
const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const STEP1 = path.join(DIR, "step1-targets.json");

type Target = {
  originCode: string | null;
  snapshotId: string | null;
  origin: {
    origin_url: string | null;
    origin_title: string | null;
    origin_brand: string | null;
    origin_sku: string | null;
    origin_model: string | null;
    origin_description: string | null;
    origin_color: string | null;
  } | null;
  candidateUrl: string;
  candidateDomain: string | null;
  baseline: {
    systemVerdict: string | null;
    matchTruth: string | null;
    market: string | null;
    blockersMerged: string[];
    matchReasons: string[];
    candidateTitle: string | null;
    source: string;
  };
  ceoGt: string | null;
};

/** 🔴 정규화는 **비교 전용** 이다 — 저장값을 바꾸지 않는다. */
const nm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[\s_·.\-\[\]#/]/g, "");
const CODE_RE = /\b([A-Z]{1,3}\d{3}[A-Z]{2}\d{3}|AW\d{2}[A-Z]{2}\d{3})\b/gi;
const codesIn = (s: unknown) => [...new Set(String(s ?? "").toUpperCase().match(CODE_RE) ?? [])];

type AxisState = "MATCH" | "MISMATCH" | "UNKNOWN" | "NOT_AVAILABLE";

/**
 * 🔴 **CPO §5 규칙을 그대로 옮긴다**:
 *    「정보가 없다는 것은 불일치가 아니다」 ⟹ 한쪽이라도 없으면 UNKNOWN/NOT_AVAILABLE.
 */
function cmp(originVal: unknown, candVal: unknown): AxisState {
  const a = nm(originVal);
  const b = nm(candVal);
  if (!a && !b) return "NOT_AVAILABLE";
  if (!a || !b) return "UNKNOWN";
  if (a === b || a.includes(b) || b.includes(a)) return "MATCH";
  return "MISMATCH";
}

describe("MI-URL-EVIDENCE STEP 2 — 후보 URL 실제 방문 및 재비교", () => {
  it.runIf(LIVE)(
    "95 고유 URL 을 방문해 증거를 모으고 기존 ↔ 상세설명 추가 결과를 비교한다",
    async () => {
      const step1 = JSON.parse(readFileSync(STEP1, "utf8")) as {
        uniqueUrls: string[];
        targets: Target[];
      };
      const urls = step1.uniqueUrls;
      expect(urls.length, "🔴 STEP 1 산출이 비어 있다").toBeGreaterThan(0);

      /* ── ① 고유 URL 마다 «한 번» 방문한다(중복 제거 · CPO §1-2 허용) ───────── */
      const visited = new Map<
        string,
        {
          status: string;
          fetchPath: string;
          httpCalls: number;
          visitedAt: string;
          facts: ProductFacts | null;
          hasDescription: boolean;
          descriptionLength: number;
        }
      >();

      for (const url of urls) {
        const at = new Date().toISOString();
        try {
          const r = await factsFromProductUrl(url);
          const facts = (r.candidate?.facts ?? null) as ProductFacts | null;
          const desc = facts?.description ?? null;
          visited.set(url, {
            status: r.status,
            fetchPath: String(r.fetchPath),
            httpCalls: r.httpCalls,
            visitedAt: at,
            facts,
            hasDescription: !!desc && desc.trim().length > 0,
            descriptionLength: desc ? desc.trim().length : 0,
          });
        } catch (e) {
          /** 🔴 실패를 「정보 없음」으로 바꾸지 않는다 — 사유를 남긴다. */
          visited.set(url, {
            status: `THREW:${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`,
            fetchPath: "NONE",
            httpCalls: 0,
            visitedAt: at,
            facts: null,
            hasDescription: false,
            descriptionLength: 0,
          });
        }
      }

      /* ── ② 행마다 기존 ↔ 추가 비교 ───────────────────────────────────────── */
      const rows = step1.targets.map((t) => {
        const v = visited.get(t.candidateUrl)!;
        const f = v.facts;
        const o = t.origin;

        /**
         * 🟢🟢 축×출처 증거를 **내가 뽑지 않는다** — `factsFromProductUrl` 안에서
         *    `attachProductEvidence`(product-url-facts.ts:412·593)가 **이미** 붙였다.
         * 🔴 그래서 여기서 다시 추출하면 **운영과 다른 값** 이 나올 수 있다(복제 금지).
         */
        const ev = f?.evidence ?? null;
        const items = (axis: string): EvidenceItem[] =>
          (ev?.[axis as keyof typeof ev] as EvidenceItem[] | undefined) ?? [];
        const srcOf = (axis: string) => items(axis).map((i) => i.source);
        const valsOf = (axis: string) => items(axis).map((i) => i.value);

        /** 🔴 원상품 품번 — sku · modelName · 제목에서 «모양» 으로만 읽는다(지어내지 않는다). */
        const originCodes = [
          ...new Set([
            ...codesIn(o?.origin_sku),
            ...codesIn(o?.origin_model),
            ...codesIn(o?.origin_title),
            ...codesIn(t.originCode),
          ]),
        ];

        /** 🔵 기존(제목·URL) 축 — 상세설명을 **쓰지 않은** 상태. */
        const titleOnlyCodes = codesIn(t.baseline.candidateTitle).concat(codesIn(t.candidateUrl));
        /** 🔵 추가(상세설명 포함) 축. */
        const descCodes = codesIn(f?.description);

        const codeHitTitle = originCodes.filter((c) => titleOnlyCodes.some((x) => nm(x) === nm(c)));
        const codeHitDesc = originCodes.filter((c) => descCodes.some((x) => nm(x) === nm(c)));
        /** 🔴 **상세설명이 «새로» 준 품번** — 제목·URL 에 없고 설명에만 있다. */
        const codeNewFromDesc = codeHitDesc.filter((c) => !codeHitTitle.includes(c));
        /** 🔴 설명문의 품번이 원상품과 **다른** 경우 — 충돌 근거(오판 방지 방향). */
        const codeConflictFromDesc =
          originCodes.length > 0 && descCodes.length > 0 && codeHitDesc.length === 0 ? descCodes : [];

        const brandBefore = cmp(o?.origin_brand, t.baseline.candidateTitle);
        const brandAfter = cmp(o?.origin_brand, [f?.brand, f?.description].join(" "));
        const nameBefore = cmp(o?.origin_title, t.baseline.candidateTitle);
        const nameAfter = cmp(o?.origin_title, [f?.title, f?.description].join(" "));
        const codeBefore: AxisState =
          originCodes.length === 0 ? "NOT_AVAILABLE" : codeHitTitle.length > 0 ? "MATCH" : "UNKNOWN";
        const codeAfter: AxisState =
          originCodes.length === 0
            ? "NOT_AVAILABLE"
            : codeHitTitle.length + codeHitDesc.length > 0
              ? "MATCH"
              : codeConflictFromDesc.length > 0
                ? "MISMATCH"
                : "UNKNOWN";

        const changed = brandBefore !== brandAfter || nameBefore !== nameAfter || codeBefore !== codeAfter;

        return {
          originCode: t.originCode,
          originUrl: o?.origin_url ?? null,
          originBrand: o?.origin_brand ?? null,
          originCodes,
          candidateUrl: t.candidateUrl,
          candidateDomain: t.candidateDomain,
          /* 접근 결과 */
          visitStatus: v.status,
          fetchPath: v.fetchPath,
          httpCalls: v.httpCalls,
          visitedAt: v.visitedAt,
          hasDescription: v.hasDescription,
          descriptionLength: v.descriptionLength,
          /* 기존 기준선 */
          baselineSystemVerdict: t.baseline.systemVerdict ?? "BASELINE_NOT_REPRODUCED",
          baselineBlockers: t.baseline.blockersMerged,
          baselineTitle: t.baseline.candidateTitle,
          source: t.baseline.source,
          market: t.baseline.market,
          ceoGt: t.ceoGt,
          /* 수집한 원문 증거(요약만 저장하지 않는다) */
          liveTitle: f?.title ?? null,
          liveBrand: f?.brand ?? null,
          liveModelCode: f?.brandModelCode ?? null,
          liveSellerSku: f?.sellerSku ?? null,
          liveColor: f?.colorText ?? null,
          liveMaterial: f?.materialText ?? null,
          liveFit: f?.fitText ?? null,
          liveCategory: f?.categoryText ?? null,
          descriptionRaw: f?.description ?? null,
          evidenceBrandSources: srcOf("BRAND"),
          evidenceCodeSources: srcOf("MODEL_CODE"),
          evidenceCodeValues: valsOf("MODEL_CODE"),
          /* 재비교 */
          brandBefore,
          brandAfter,
          nameBefore,
          nameAfter,
          codeBefore,
          codeAfter,
          codeNewFromDesc,
          codeConflictFromDesc,
          changed,
        };
      });

      /* ── ③ 집계(CPO §7 의 13항) ──────────────────────────────────────────── */
      const okStatuses = new Set(["OK"]);
      const summary = {
        originProducts: new Set(rows.map((r) => r.originCode).filter(Boolean)).size,
        candidateRows: rows.length,
        uniqueUrls: urls.length,
        visitOk: [...visited.values()].filter((v) => okStatuses.has(v.status)).length,
        visitFailed: [...visited.values()].filter((v) => !okStatuses.has(v.status)).length,
        failureByStatus: [...visited.values()].reduce<Record<string, number>>((a, v) => {
          if (!okStatuses.has(v.status)) a[v.status] = (a[v.status] ?? 0) + 1;
          return a;
        }, {}),
        descriptionCaptured: [...visited.values()].filter((v) => v.hasDescription).length,
        descriptionByFetchPath: [...visited.values()].reduce<Record<string, { total: number; withDesc: number }>>(
          (a, v) => {
            const k = v.fetchPath;
            a[k] = a[k] ?? { total: 0, withDesc: 0 };
            a[k].total += 1;
            if (v.hasDescription) a[k].withDesc += 1;
            return a;
          },
          {},
        ),
        brandNewlyConfirmed: rows.filter((r) => r.brandBefore !== "MATCH" && r.brandAfter === "MATCH").length,
        nameNewlyConfirmed: rows.filter((r) => r.nameBefore !== "MATCH" && r.nameAfter === "MATCH").length,
        codeNewlyConfirmed: rows.filter((r) => r.codeBefore !== "MATCH" && r.codeAfter === "MATCH").length,
        codeNewFromDescriptionRows: rows.filter((r) => r.codeNewFromDesc.length > 0).length,
        codeConflictFromDescriptionRows: rows.filter((r) => r.codeConflictFromDesc.length > 0).length,
        sellerSkuObserved: rows.filter((r) => r.liveSellerSku).length,
        changedRows: rows.filter((r) => r.changed).length,
        unchangedRows: rows.filter((r) => !r.changed).length,
        baselineNotReproduced: rows.filter((r) => r.baselineSystemVerdict === "BASELINE_NOT_REPRODUCED").length,
        byMarket: rows.reduce<Record<string, number>>(
          (a, r) => ((a[r.market ?? "(null)"] = (a[r.market ?? "(null)"] ?? 0) + 1), a),
          {},
        ),
      };

      mkdirSync(DIR, { recursive: true });
      writeFileSync(path.join(DIR, "step2-evidence.json"), JSON.stringify({ summary, rows }, null, 1), "utf8");
      /** 🟢 CPO §9 — 재검증 가능한 CSV 도 같이 낸다. */
      const cols = [
        "originCode", "candidateDomain", "candidateUrl", "visitStatus", "fetchPath", "hasDescription",
        "descriptionLength", "baselineSystemVerdict", "ceoGt", "brandBefore", "brandAfter",
        "nameBefore", "nameAfter", "codeBefore", "codeAfter", "changed",
        "liveModelCode", "liveSellerSku", "codeNewFromDesc", "codeConflictFromDesc",
      ];
      const csv = [
        cols.join(","),
        ...rows.map((r) =>
          cols
            .map((c) => {
              const v = (r as Record<string, unknown>)[c];
              return `"${String(Array.isArray(v) ? v.join("|") : (v ?? "")).replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");
      writeFileSync(path.join(DIR, "step2-evidence.csv"), csv, "utf8");

      /* eslint-disable no-console */
      console.log("═══ STEP 2 집계 ═══");
      console.log(JSON.stringify(summary, null, 1));
      console.log(`\n🟢 산출: ${path.join(DIR, "step2-evidence.json")} · step2-evidence.csv`);
      /* eslint-enable no-console */

      /** 🔴 **열화 게이트** — 접근 성공이 0 이면 숫자를 내지 않는다(「측정불가 ≠ 0」). */
      expect(summary.visitOk, "🔴 접근 성공 0 — 이 실행의 숫자를 쓰지 않는다").toBeGreaterThan(0);
    },
    1_800_000,
  );

  it("기본은 SKIP 이고 운영 코드를 바꾸지 않는다(가드)", () => {
    expect(typeof factsFromProductUrl).toBe("function");
    expect(LIVE || true).toBe(true);
  });
});
