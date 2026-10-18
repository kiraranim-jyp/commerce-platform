import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBrandIdentity, brandIdentitiesCompatible } from "@commerce/shared/src/brand-identity";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-080 — **BRAND 증거의 정확성** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「BRAND 보호축을 푸는 것이 목표가 아니다. blocker 가 **잘못 생성되는
 *    구조적 원인** 이 있는지만 조사한다」 · BRAND/MI/시장/가격/AI 전부 변경 금지.
 *
 * ── 🟢 owner 확정 (코드 위치 · 추정 0) ──────────────────────────────────────
 * ```
 * 원상품 brand   product_snapshots.workspace->canonicalProduct->brand  {value, source}
 *                (`brand-resolver.ts` 의 SEASON_CODE 규칙이 "AW26" 을 버린다)
 * 후보   brand   product-url-facts.ts `brandFromHtml`
 *                  = og:brand ?? product:brand ?? JSON-LD "brand"."name"
 *                  ?? extractMicrodataFromHtml(html)?.brand
 *                Shopify 경로는 `vendor`
 * 정규화         packages/shared/src/brand-identity.ts `resolveBrandIdentity`
 *                  (SEASON_CODE_ONLY · stripTrailingNoise · normalizeFactText)
 * 비교           `brandIdentitiesCompatible` — **단어 부분수열 포함**
 * blocker        cross-seller.ts:751-753  brandKnown = Boolean(x.brand && y.brand)
 *                                          brandOk    = brandKnown && brandsCompatible
 *                :999                      !brandKnown ⟹ BRAND_UNCONFIRMED
 * ```
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const T63 = path.join(OUT, "wu-063-table.json");
const G36 = path.join(OUT, "wu-036-3way.json");
const READY = existsSync(T63) && existsSync(G36);
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

describe("WU-080 — BRAND 증거 (캐시 필요)", () => {
  (READY ? it : it.skip)("① 전수 분포 · ② 원인 · ③ CF-1~3 · ④ downstream", () => {
    type Row = { id: string; human: string; domain: string; tier: string; blockers: unknown; priceKrw: number | null; market: string };
    const T = JSON.parse(readFileSync(T63, "utf8")) as Row[];
    const G = (JSON.parse(readFileSync(G36, "utf8")) as { rows: { candidateUrl: string }[] }).rows;

    const candBrand = (id: string): string | null => {
      const u = G[Number(id.slice(1)) - 1]?.candidateUrl;
      if (!u) return null;
      const f = path.join(CACHE, `${key(u)}.facts.json`);
      if (!existsSync(f)) return null;
      return (JSON.parse(readFileSync(f, "utf8")) as { candidate?: { facts?: { brand?: string | null } } }).candidate?.facts?.brand ?? null;
    };
    const has = (r: Row, b: string) => JSON.stringify(r.blockers ?? []).includes(b);
    const rows = T.map((r) => ({ ...r, cand: candBrand(r.id), mm: has(r, "BRAND_MISMATCH"), uc: has(r, "BRAND_UNCONFIRMED") }));
    const brandRows = rows.filter((r) => r.mm || r.uc);

    /* ── ① 전수 분포 ── */
    const dist: Record<string, number> = {};
    for (const r of rows) dist[`${r.mm ? "MISMATCH" : r.uc ? "UNCONFIRMED" : "없음"} / ${r.human}`] = (dist[`${r.mm ? "MISMATCH" : r.uc ? "UNCONFIRMED" : "없음"} / ${r.human}`] ?? 0) + 1;
    console.log(`\n════════ WU-080 — BRAND blocker 전수 (N=${rows.length}) ════════`);
    for (const [k, v] of Object.entries(dist).sort()) console.log(`   ${k.padEnd(28)} ${v}`);

    /* ── ② 원인: 후보 brand 가 «있는데도» UNCONFIRMED 인가 ── */
    const ucWithCand = brandRows.filter((r) => r.uc && r.cand);
    console.log(`\n ── ② 🔴 후보 brand 가 **있는데도** UNCONFIRMED: ${ucWithCand.length}건 ──`);
    console.log("   id   human      도메인                 후보 brand");
    for (const r of ucWithCand) console.log(`   ${r.id.padEnd(4)} ${r.human.padEnd(10)} ${r.domain.slice(0, 20).padEnd(21)} ${JSON.stringify(r.cand)}`);
    console.log(`   ⟹ \`brandKnown = Boolean(x.brand && y.brand)\` 이므로 **원상품(x) 쪽이 null** 이다`);

    /* ── ③ CF-3: 원상품 brand 를 "Bobo Choses" 로 «복구» 하면 ── */
    const ORIGIN = "Bobo Choses";
    const oid = resolveBrandIdentity(ORIGIN);
    console.log(`\n ── ③ CF-3 원상품 brand 를 "${ORIGIN}" 로 복구하면 (운영 owner 직접 호출) ──`);
    console.log("   id   human      후보 brand                    정규화                    → 결과");
    const cf3: { id: string; human: string; outcome: string }[] = [];
    for (const r of brandRows) {
      let outcome: string;
      if (!r.cand) outcome = "UNCONFIRMED 유지"; /* 후보도 없으면 그대로다 */
      else outcome = brandIdentitiesCompatible(oid, resolveBrandIdentity(r.cand)) ? "🟢 BRAND OK" : "🔴 MISMATCH";
      cf3.push({ id: r.id, human: r.human, outcome });
      console.log(`   ${r.id.padEnd(4)} ${r.human.padEnd(10)} ${JSON.stringify(r.cand).slice(0, 28).padEnd(29)} ${JSON.stringify(resolveBrandIdentity(r.cand ?? "").value).slice(0, 24).padEnd(25)} ${outcome}`);
    }
    const okRows = cf3.filter((c) => c.outcome === "🟢 BRAND OK");
    const worse = cf3.filter((c) => c.outcome === "🔴 MISMATCH");
    console.log(`   ⟹ 🟢 BRAND OK ${okRows.length}(SAME ${okRows.filter((c) => c.human === "SAME").length} · 🔴 DIFFERENT ${okRows.filter((c) => c.human === "DIFFERENT").length})`);
    console.log(`   ⟹ 🔴 UNCONFIRMED → **MISMATCH 로 악화** ${worse.length}건 (SAME ${worse.filter((c) => c.human === "SAME").length})`);

    /* ── ④ CF-1 / CF-2 재현 (blocker 제거 가정 · 운영 변경 0) ── */
    const cf1 = rows.filter((r) => r.mm);
    const cf2 = rows.filter((r) => r.uc);
    console.log(`\n ── ④ CF-1 (BRAND_MISMATCH 제거) 영향 ${cf1.length}건: SAME ${cf1.filter((r) => r.human === "SAME").length} · DIFFERENT ${cf1.filter((r) => r.human === "DIFFERENT").length}`);
    console.log(` ── ④ CF-2 (BRAND_UNCONFIRMED 제거) 영향 ${cf2.length}건: SAME ${cf2.filter((r) => r.human === "SAME").length} · 🔴 DIFFERENT ${cf2.filter((r) => r.human === "DIFFERENT").length}`);

    /* ── ⑤ downstream — 국내 버킷 자격이 있는 것만 ── */
    const bucketable = (r: (typeof rows)[number]) => r.market === "KR" && r.priceKrw != null && (r.tier === "EXACT" || r.tier === "COMPARISON");
    const cf2Bucket = cf2.filter(bucketable);
    console.log(`\n ── ⑤ downstream: CF-2 영향 중 **국내 버킷 자격** ${cf2Bucket.length}건 ` + JSON.stringify(cf2Bucket.map((r) => `${r.id}:${r.human}`)));

    writeFileSync(path.join(OUT, "wu-080.json"), JSON.stringify({ dist, ucWithCand: ucWithCand.map((r) => r.id), cf3, cf1: cf1.length, cf2: cf2.length }, null, 1));

    /* ══════════════════ 🔴 계약 ══════════════════ */

    /** ① 🔴 BRAND blocker 는 **14건** 이고 MISMATCH 는 **1건뿐** 이다. */
    expect(brandRows).toHaveLength(14);
    expect(rows.filter((r) => r.mm)).toHaveLength(1);
    expect(rows.filter((r) => r.uc)).toHaveLength(13);

    /** ② 🔴🔴 **원인은 후보가 아니라 원상품이다** — 후보 brand 가 있는데도 UNCONFIRMED 가 6건. */
    expect(ucWithCand.length).toBeGreaterThanOrEqual(6);

    /**
     * ③ 🔴🔴 **원상품 브랜드를 복구해도 대부분 «악화» 된다** —
     *    UNCONFIRMED(보류)가 **MISMATCH(충돌)** 로 바뀐다. 한글/일본어 표기와
     *    **샵 이름(「비스킷」)** 이 `brandIdentitiesCompatible` 를 통과하지 못한다.
     */
    expect(worse.length).toBeGreaterThan(okRows.length);
    /** ③ 🔴 그리고 열리는 것 중 Human DIFFERENT 가 **있다**. */
    expect(okRows.filter((c) => c.human === "DIFFERENT").length).toBeGreaterThan(0);

    /** ③ 🟢 정규화 owner 의 성질을 **직접** 잠근다(운영 함수 호출). */
    expect(resolveBrandIdentity("AW26").value).toBeNull(); /* SEASON_CODE 는 브랜드가 아니다 */
    expect(resolveBrandIdentity("BOBO CHOSES").value).toBe(resolveBrandIdentity("Bobo Choses").value);
    /** 🔴 한글 표기는 **같은 브랜드로 인정되지 않는다**(사전이 없다 · 정상 동작). */
    expect(brandIdentitiesCompatible(resolveBrandIdentity("Bobo Choses"), resolveBrandIdentity("보보쇼즈"))).toBe(false);
    /** 🔴 샵 이름은 당연히 브랜드와 불일치한다 — 「비스킷」은 **판매처** 다. */
    expect(brandIdentitiesCompatible(resolveBrandIdentity("Bobo Choses"), resolveBrandIdentity("비스킷"))).toBe(false);
  });
});
