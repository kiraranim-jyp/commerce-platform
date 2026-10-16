import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeProductUrl, compareCrossSellerProducts, confirmBrandCodeInEvidence } from "@commerce/crawler";
import {
  backfillCanonicalProduct,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
  type ProductFacts,
} from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-048 ③④ — **baby/kids 품번 체계를 SAME 으로 허용하면 무엇이 깨지는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **구현 전 측정이다.** 운영 코드 변경 0 · AI 0 · HTTP 0(캐시) · 비용 0.
 *
 * ── 측정 설계 ────────────────────────────────────────────────────────────
 * 정책 B 는 「품번 충돌을 «없던 것» 으로 돌린다」이다. 그것을 가장 충실하게
 * 흉내내는 방법은 **양쪽 품번을 null 로 두는 것** 이다 —
 * `compareModelCode` 가 `unavailable` 을 내고, 충돌도 축도 생기지 않는다.
 * 🔴 「원상품 품번을 후보에 복사」하는 방식은 **축까지 얹어** 과대평가가 된다.
 *
 * ── 🔴 조건 조합을 함께 잰다 (CPO ④) ───────────────────────────────────
 * 품번 충돌 하나만 무시하는 것이 아니라, 무시할 **자격 조건** 을 바꿔 가며 잰다.
 */

const LIVE = process.env.WU_048_CF === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const CASES = path.join(OUT, "mi-017-e2e-cases.json");
const HUMAN = path.join(OUT, "wu-036-human-gt.json");

const SNAP: Record<string, string> = {
  S1: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
  S2: "cd93efd9-6c34-42a3-b733-d1178e968113",
  S3: "c5395889-7651-4272-aff5-dbeddd8d6199",
  S4: "c27d4727-2248-4fe0-9084-8c239737a889",
  S5: "32f7b651-29b9-4217-b8ce-46596f538306",
  S6: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
};
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

/** 🔴 **이미지 파일명의 품번** — WU-047 이 찾은 「후보 자신의 품번」 원천이다. */
const CODE_RE = /[A-Z]\d{3}[A-Z]{2}\d{3}/;
function candidateOwnCode(html: string): string | null {
  const img = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i.exec(html)?.[1];
  const m = img ? CODE_RE.exec(img.toUpperCase()) : null;
  return m ? m[0] : null;
}

/** 같은 브랜드 코드 체계 안에서 **라인 글자만** 다른가 (`B226A`**C**`010` ↔ `B226A`**B**`046`). */
function lineLetterOnlyDiffers(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (!CODE_RE.test(A) || !CODE_RE.test(B)) return false;
  /** 시즌 접두사 4자(`B226`)를 공유하고 **6번째 글자**(라인)가 다르다. */
  return A.slice(0, 5) === B.slice(0, 5) && A[5] !== B[5];
}
/** 시즌 접두사만 공유 — 라인·일련 전부 달라도 참(가장 느슨한 안). */
function sameSeasonPrefix(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  return CODE_RE.test(A) && CODE_RE.test(B) && A.slice(0, 4) === B.slice(0, 4);
}

const maybe = LIVE ? it : it.skip;

describe("WU-048 — 품번 체계 정책 반사실", () => {
  maybe(
    "정책 A(현재) ↔ 정책 B 변종들을 전수 51건으로 비교한다",
    () => {
      const cases = JSON.parse(readFileSync(CASES, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: unknown;
      }[];
      const human = JSON.parse(readFileSync(HUMAN, "utf8")) as {
        id: string;
        searchId: string;
        originUrl: string;
        candidateUrl: string;
        domain: string;
        humanGt: string | null;
      }[];

      const oc: Record<string, ProductFacts> = {};
      type Row = {
        id: string;
        domain: string;
        humanGt: string | null;
        originCode: string | null;
        candCode: string | null;
        verdicts: Record<string, string | null>;
      };
      const rows: Row[] = [];

      for (const h of human) {
        if (!SNAP[h.searchId]) continue;
        if (!oc[h.searchId]) {
          const s = cases.find((c) => c.id === SNAP[h.searchId])!;
          expect(canonicalizeProductUrl(s.source_url)).toBe(canonicalizeProductUrl(h.originUrl));
          oc[h.searchId] = productFactsFromIdentityDna(
            buildProductIdentityDna(backfillCanonicalProduct(s.canonical_product as never)),
          );
        }
        const of_ = oc[h.searchId];
        const file = path.join(CACHE, `${key(h.candidateUrl)}.facts.json`);
        if (!existsSync(file)) continue;
        const cf0 = (JSON.parse(readFileSync(file, "utf8")) as { candidate?: { facts?: ProductFacts } | null })
          .candidate?.facts;
        if (!cf0) continue;
        const htmlFile = path.join(CACHE, `${key(h.candidateUrl)}.html`);
        const html = existsSync(htmlFile) ? readFileSync(htmlFile, "utf8") : "";

        /** 🟢 운영 baseline 재현(WU-033 §1). */
        const cf: ProductFacts =
          cf0.brandModelCode === null && of_.brandModelCode
            ? {
                ...cf0,
                brandModelCode: confirmBrandCodeInEvidence(of_.brandModelCode, {
                  title: cf0.title,
                  url: cf0.sourceUrl,
                  sku: cf0.sellerSku ?? null,
                }),
              }
            : cf0;

        /** 🔴 후보 «자신» 의 품번 — 이것이 있으면 운영이 보는 것보다 더 많은 정보다. */
        const ownCode = cf.brandModelCode ?? candidateOwnCode(html);
        const base = compareCrossSellerProducts(of_, cf);
        const baseVerdict = base?.verdict ?? null;

        /** 후보 자신의 품번을 «넣었을 때» 의 운영 동작(정책 A 를 더 정확히 적용한 것). */
        const withOwn = ownCode ? compareCrossSellerProducts(of_, { ...cf, brandModelCode: ownCode }) : base;

        /** 정책 B — 자격이 되면 **양쪽 품번을 비운다**(충돌도 축도 없앤다). */
        const suppress = () => compareCrossSellerProducts({ ...of_, brandModelCode: null }, { ...cf, brandModelCode: null });
        const sameLine = lineLetterOnlyDiffers(of_.brandModelCode, ownCode);
        const sameSeason = sameSeasonPrefix(of_.brandModelCode, ownCode);
        const cmpFacts = (c: ReturnType<typeof compareCrossSellerProducts>) =>
          (c?.axes ?? []).map((a: { axis?: string } | string) => (typeof a === "string" ? a : (a.axis ?? "")));
        const axesOf = cmpFacts(withOwn);

        const verdicts: Record<string, string | null> = {
          A_현재: baseVerdict,
          A_후보품번반영: withOwn?.verdict ?? null,
          /** B1 — 라인 글자만 다르면 품번 충돌을 없앤다(가장 좁은 안). */
          B1_라인글자: sameLine ? (suppress()?.verdict ?? null) : (withOwn?.verdict ?? null),
          /** B2 — B1 + 상품형태(GARMENT_FORM) 가 불일치가 아닐 것. */
          B2_라인글자_형태: sameLine && !(withOwn?.blockers ?? []).some((b) => (typeof b === "string" ? b : b.blocker) === "GARMENT_FORM")
            ? (suppress()?.verdict ?? null)
            : (withOwn?.verdict ?? null),
          /** B3 — B2 + 제목 축이 서 있을 것. */
          B3_라인글자_형태_제목:
            sameLine &&
            !(withOwn?.blockers ?? []).some((b) => (typeof b === "string" ? b : b.blocker) === "GARMENT_FORM") &&
            axesOf.includes("TITLE")
              ? (suppress()?.verdict ?? null)
              : (withOwn?.verdict ?? null),
          /** B4 — 시즌 접두사만 공유해도 없앤다(가장 느슨한 안). */
          B4_시즌접두사: sameSeason ? (suppress()?.verdict ?? null) : (withOwn?.verdict ?? null),
        };

        rows.push({
          id: h.id,
          domain: h.domain,
          humanGt: h.humanGt,
          originCode: of_.brandModelCode,
          candCode: ownCode,
          verdicts,
        });
      }

      const humanSame = rows.filter((r) => r.humanGt === "SAME").length;
      const kpi = (name: string) => {
        const same = rows.filter((r) => r.verdicts[name] === "SAME");
        const tp = same.filter((r) => r.humanGt === "SAME").length;
        const fp = same.filter((r) => r.humanGt === "DIFFERENT").length;
        return {
          same: same.length,
          truePositive: tp,
          falseSame: fp,
          miss: humanSame - tp,
          precision: same.length ? +(tp / same.length).toFixed(3) : null,
          recall: +(tp / humanSame).toFixed(3),
          falseSameIds: same.filter((r) => r.humanGt === "DIFFERENT").map((r) => r.id),
        };
      };
      const names = Object.keys(rows[0].verdicts);
      const out: Record<string, unknown> = { rows: rows.length, humanSame };
      for (const n of names) out[n] = kpi(n);

      writeFileSync(path.join(OUT, "wu-048-cf.json"), JSON.stringify({ kpi: out, rows }, null, 2));
      // eslint-disable-next-line no-console
      console.log("[WU-048]", JSON.stringify(out));
      // eslint-disable-next-line no-console
      console.log("[WU-048-라인글자쌍]");
      for (const r of rows.filter((x) => lineLetterOnlyDiffers(x.originCode, x.candCode))) {
        // eslint-disable-next-line no-console
        console.log(
          `   ${r.id} ${r.domain.padEnd(22)} ${r.originCode} ↔ ${r.candCode}  human=${r.humanGt}  A=${r.verdicts.A_후보품번반영} B1=${r.verdicts.B1_라인글자}`,
        );
      }
      expect(rows.length).toBe(51);
    },
    10 * 60_000,
  );
});
