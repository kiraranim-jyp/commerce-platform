import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalizeProductUrl,
  compareCrossSellerProducts,
  confirmBrandCodeInEvidence,
  withConfidence,
} from "@commerce/crawler";
import {
  backfillCanonicalProduct,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
  type ProductFacts,
} from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-037 §9 — **개선안 반사실 측정** (구현 전 · 운영 코드 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO §11: `False SAME` 은 **1 을 넘으면 불채택** · `Precision 0.900 미만 금지`.
 * 그래서 어떤 안도 **구현 전에 전수 51건으로 ΔSAME · ΔFalseSAME 을 먼저 잰다.**
 *
 * 🔴 AI 0 · HTTP 0(캐시) · 비용 0. 기본 SKIP — `WU_037_CF=1`.
 */

const LIVE = process.env.WU_037_CF === "1";
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

/**
 * 🔴 **등록 가능 도메인의 «라벨»** 만 뽑는다 — `bobochoses.co.jp` · `bobochoses.com`
 *    둘 다 `bobochoses` 다. 🔴 사전도 Registry 도 아니다 — **입력 URL 두 개를
 *    서로 비교할 뿐** 이고 새 데이터가 0 이다.
 * 🔴 `co.jp` · `com.au` 처럼 2단 공용 접미사를 감안해 뒤에서 센다.
 */
function registrableLabel(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^(www|m|mobile|global|shop|store)\./, "");
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  /** `co.jp` · `com.au` · `co.kr` … 처럼 두 번째 조각이 공용 접미사면 한 칸 더 간다. */
  const isPublicSecond = second.length <= 3 && last.length <= 3;
  const idx = isPublicSecond ? parts.length - 3 : parts.length - 2;
  return idx >= 0 ? parts[idx] : null;
}

const maybe = LIVE ? it : it.skip;

describe("WU-037 §9 — 개선안 반사실", () => {
  maybe(
    "전수 51건에서 ΔSAME 과 ΔFalseSAME 을 같이 잰다",
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
      const rows: {
        id: string;
        humanGt: string | null;
        domain: string;
        sameLabel: boolean;
        base: string | null;
        fixB: string | null;
      }[] = [];

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

        const base = compareCrossSellerProducts(of_, cf)?.verdict ?? null;

        /**
         * ── 안 B — **같은 등록 도메인 라벨이면 브랜드 확인이 «필요 없다»** ──
         *
         * 🔴 브랜드를 «주입» 하는 것이 아니다(WU-034 가 그것을 부작용 3건으로 탈락시켰다).
         *    두 페이지가 **같은 등록 도메인 이름** 위에 있으면 브랜드가 다를 수 «없다».
         *    그래서 한쪽이 비어 있을 때만 다른 쪽 값을 그 자리에 둔다.
         * 🔴 Registry 아님 · 사전 아님 · 새 데이터 0 — 입력 URL 두 개의 비교다.
         */
        const lo = registrableLabel(of_.sourceUrl);
        const lc = registrableLabel(cf.sourceUrl);
        const sameLabel = !!lo && lo === lc;
        /**
         * 🔴🔴 **구현 «후» 에는 시뮬레이션이 아니라 운영 경로를 부른다.**
         *    `withConfidence` 가 WU-004 의 품번 보강과 WU-037 의 브랜드 확인을
         *    «둘 다» 안에서 수행한다 — 그래서 이것이 진짜 E2E 다.
         */
        const scored = withConfidence(
          { title: of_.title, brand: of_.brand ?? undefined, sourceUrl: of_.sourceUrl, facts: of_ },
          [
            {
              title: cf0.title,
              url: cf0.sourceUrl,
              price: null,
              imageUrl: null,
              confidence: 0,
              brand: cf0.brand ?? undefined,
              facts: cf0,
            } as never,
          ],
        )[0];
        const fixB = (scored?.crossSellerVerdict as string | null) ?? null;

        rows.push({ id: h.id, humanGt: h.humanGt, domain: h.domain, sameLabel, base, fixB });
      }

      const kpi = (pick: (r: (typeof rows)[number]) => string | null) => {
        const same = rows.filter((r) => pick(r) === "SAME");
        const tp = same.filter((r) => r.humanGt === "SAME").length;
        const fp = same.filter((r) => r.humanGt === "DIFFERENT").length;
        const humanSame = rows.filter((r) => r.humanGt === "SAME").length;
        return {
          miSame: same.length,
          truePositive: tp,
          falseSame: fp,
          sameMiss: humanSame - tp,
          precision: same.length ? +(tp / same.length).toFixed(3) : null,
          recall: +(tp / humanSame).toFixed(3),
        };
      };

      const before = kpi((r) => r.base);
      const afterB = kpi((r) => r.fixB);
      const changed = rows.filter((r) => r.base !== r.fixB);

      const out = {
        rows: rows.length,
        sameLabelPairs: rows.filter((r) => r.sameLabel).length,
        before,
        afterFixB: afterB,
        delta: {
          same: afterB.miSame - before.miSame,
          falseSame: afterB.falseSame - before.falseSame,
          sameMiss: afterB.sameMiss - before.sameMiss,
        },
        changedRows: changed.map((r) => ({ id: r.id, domain: r.domain, from: r.base, to: r.fixB, human: r.humanGt })),
      };
      writeFileSync(path.join(OUT, "wu-037-counterfactual.json"), JSON.stringify(out, null, 2));
      // eslint-disable-next-line no-console
      console.log("[WU-037-CF]", JSON.stringify(out));

      /** 🔴 CONTROL — before 가 WU-036 확정값과 같아야 한다. */
      expect(before.miSame).toBe(10);
      expect(before.falseSame).toBe(1);
      expect(before.sameMiss).toBe(18);
      /** 🔴🔴 CPO §11 — False SAME 증가는 **불채택** 조건이다. */
      expect(afterB.falseSame).toBeLessThanOrEqual(1);
      expect(afterB.precision ?? 0).toBeGreaterThanOrEqual(0.9);

      /* ── 🔴 CPO §12 필수 CONTROL — 이름으로 고정한다 ──────────────────── */
      const by = (id: string) => rows.find((r) => r.id === id)!;
      /** 자기동일 4쌍은 **전부 SAME** 이어야 한다. C48 이 그동안 이것을 어기고 있었다. */
      for (const id of ["C09", "C12", "C17", "C48"]) {
        expect(by(id).fixB, `${id} 자기동일 쌍`).toBe("SAME");
      }
      /** C06 — Human DIFFERENT. 🔴 **절대 SAME 이 되면 안 된다**(고정 오류 사례). */
      expect(by("C06").humanGt).toBe("DIFFERENT");
      /** 🔴 S4 `AW26MS185` 색상 변형은 SAME 금지 — Human 전부 DIFFERENT 다. */
      for (const id of ["C19", "C20", "C23", "C24", "C25", "C26"]) {
        expect(by(id).humanGt, `${id} Human`).toBe("DIFFERENT");
        expect(by(id).fixB, `${id} 색상 변형`).not.toBe("SAME");
      }
    },
    10 * 60_000,
  );
});
