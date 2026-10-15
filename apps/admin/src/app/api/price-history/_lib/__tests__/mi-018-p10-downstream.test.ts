/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-018-P10 — **그 `PRESUMED_SAME` 하나가 가격/판매/등록까지 가는가** (범위 1건)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **기본 SKIP.** `MI_018_LIVE=1` 일 때만 실제 판매처에 요청한다.
 * 🔴 AI 0 · Gemini 0 · 외부 검색 API 0 · 키 0 · 결제 0 · DB 쓰기 0 · schema 0 ·
 *    UI 0 · threshold 0 · **색상 사전 0** · 보류 정책 0 · Registry 0 · 배포 0.
 * 🔴 **P10 하나만** 본다 — 정확도 문제를 확장하지 않는다(CPO 범위 지정).
 * 🔴 WU-015A/016 에서 확정된 구조는 **다시 조사하지 않는다.** 여기서 보는 것은
 *    **새 AI URL 경로** 에서 P10 이 어느 단계까지 전달되는가 하나다.
 *
 * P10 (운영 DB 실데이터):
 * ```
 * 원상품  AW26MS185 Bubble Sweatshirt **Grey Melange** (Main Story)
 * 후보    deuxbebe 「AW26MS185 - Bubble Sweatshirt - **Rose Shadow**」
 * WU-018  crossSellerVerdict = PRESUMED_SAME · blockers [] · colorText **없음**
 * ```
 *
 * 🔴 **복제식을 쓰지 않는다.** 운영 `judgeDomesticCandidate`(run-domestic-price-check.ts:619)
 *    와 `priceTierFromLink`(domestic-product-link.ts:86)를 **그대로** 부른다.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { factsFromProductUrl, fetchDomesticModelCode, withConfidence } from "@commerce/crawler";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

const LIVE = process.env.MI_018_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

const P10_URL = "https://www.deuxbebe.com/product/detail.html?product_no=18285&cate_no=293&display_group=1";
const P10_DOMAIN = "deuxbebe.com";
const ORIGIN_PREFIX = "c27d4727";

const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-018-P10 — downstream trace (실제 HTTP · 쌍 1건)", () => {
  it(
    "PRESUMED_SAME 이 tier / 가격 / 판매판정에 들어가는가",
    async () => {
      const casesPath = path.join(OUT_DIR, "mi-017-e2e-cases.json");
      if (!existsSync(casesPath)) throw new Error(`선행 덤프 없음: ${casesPath}`);
      const rows = JSON.parse(readFileSync(casesPath, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: Record<string, unknown>;
      }[];
      const row = rows.find((r) => String(r.id).slice(0, 8) === ORIGIN_PREFIX);
      if (!row) throw new Error(`원상품 덤프 없음: ${ORIGIN_PREFIX}`);

      /* ① 운영 owner 로 query 를 만든다(복제 0). */
      const dna = buildProductIdentityDna(row.canonical_product as never);
      const query = {
        title: dna.title.replace(/^\s*\[[^\]]*\]\s*/, "").trim(),
        brand: dna.brand.value || undefined,
        sourceUrl: dna.sourceUrl,
        sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
        facts: productFactsFromIdentityDna(dna),
      };

      /* ② 새 AI 경로가 만드는 그 후보를 그대로 만든다. */
      const facts = await factsFromProductUrl(P10_URL);
      expect(facts.status, "P10 후보 facts 가 OK 가 아니면 이 trace 는 성립하지 않는다").toBe("OK");
      const scored = withConfidence(query, [facts.candidate!]);
      const candidate = scored[0]!;

      /* ③ 🔴 **운영 판정 함수를 그대로** 부른다 — Gemini 경로가 쓰는 그 호출 모양이다
       *    (run-domestic-price-check.ts:1071). fetchModelCode 도 운영과 같은 함수. */
      let fetchCount = 0;
      const judgement = await judgeDomesticCandidate({
        domain: P10_DOMAIN,
        candidates: scored,
        sourceUrl: query.sourceUrl,
        foreignModelCode: dna.brandModelCode,
        foreignColor: dna.color,
        fetchModelCode: (url) => {
          fetchCount += 1;
          return fetchDomesticModelCode(P10_DOMAIN, url);
        },
      });

      console.log(`\n── WU-018-P10 downstream trace`);
      console.log(`  원상품      sku=${query.sku} brand=${query.brand} color=${dna.color} modelCode=${dna.brandModelCode}`);
      console.log(`  후보        "${candidate.title}"`);
      console.log(`  MI 판정      crossSeller=${candidate.crossSellerVerdict} matchLevel=${candidate.matchLevel} conf=${candidate.confidence}`);
      console.log(`  후보 facts   colorText=${JSON.stringify(candidate.facts?.colorText)} brandModelCode=${JSON.stringify(candidate.facts?.brandModelCode)}`);
      console.log(`  judgement   kind=${judgement.kind}${judgement.kind === "DROPPED" ? ` gate=${judgement.gate}` : ""}`);

      if (judgement.kind === "JUDGED") {
        const tier = priceTierFromLink({ matchTruth: judgement.matchTruth, verified: judgement.verified });
        console.log(`  matchTruth  ${judgement.matchTruth} · verified=${judgement.verified}`);
        console.log(`  🔴 tier      ${tier}   (priceTierFromLink)`);
        console.log(`  후보 가격    ${JSON.stringify(candidate.price)} priceStatus=${candidate.priceStatus}`);
        console.log(`  modelCode   evidence=${judgement.modelCodeEvidence} domestic=${JSON.stringify(judgement.domesticModelCode)}`);
        console.log(`  fetchModelCode 호출 ${fetchCount}회`);

        /**
         * 🔴🔴 **이 WU 의 단 하나의 질문** — 「동일상품 가격」 등급(EXACT)에 들어가는가.
         *
         * 🟢 리포에 **이 품번을 근거로 만든 방어장치가 이미 있다**(match-truth.ts:
         *    MI-DISCOVERY-P5.2 Step 2 — 「품번이 같다 + 색상을 읽지 못했다」는 확정
         *    근거가 못 된다 · 실측 근거가 `AW26MS185` 4색상이다).
         * 🔴 그 방어가 **이 경로에서도** 발화하는지를 여기서 고정한다.
         */
        expect(tier, "🔴 색상 미확인 후보가 EXACT(동일상품 가격)로 올라갔다").not.toBe("EXACT");
      }

      /* 🔴 「가격 숫자가 있다」와 「그 시장의 가격이다」를 섞지 않는다 — 값만 기록한다. */
      expect(["OK"]).toContain(facts.status);
    },
    20 * 60 * 1000,
  );
});

/* ═══════════ SKIP 상태에서도 **구조** 는 검사한다 (HTTP 0 · 비용 0) ═══════════ */
describe("WU-018-P10 구조 — 새 AI 경로에 downstream 이 «있는가»", () => {
  it("🔴🔴 `collectAiAnswerCandidatePool` 의 **운영 호출부가 0** 이다 — 지금은 crossing 자체가 불가능하다", () => {
    const root = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..");
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSafe(dir)) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (["node_modules", ".next", "dist", ".git", "__tests__"].includes(e.name)) continue;
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        const src = readFileSync(p, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        /* 🔴 정의/재노출 두 줄은 호출부가 아니다 — 호출 형태만 센다. */
        if (/collectAiAnswerCandidatePool\s*\(/.test(src) && !/export (async )?function collectAiAnswerCandidatePool/.test(src)) {
          hits.push(path.relative(root, p));
        }
      }
    };
    walk(path.join(root, "apps", "admin", "src"));
    walk(path.join(root, "packages"));
    expect(hits, `운영 호출부가 생겼다 — 생기면 P10 trace 를 다시 돌린다: ${hits.join(", ")}`).toEqual([]);
  });
});

function readdirSafe(dir: string): { name: string; isDirectory: () => boolean }[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require("node:fs") as typeof import("node:fs")).readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
