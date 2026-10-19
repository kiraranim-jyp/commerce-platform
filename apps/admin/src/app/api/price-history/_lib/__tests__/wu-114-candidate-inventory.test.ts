import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  searchDomesticShops,
  withConfidence,
  enrichCandidatePrices,
  isSelfReferenceCandidate,
  type ComparisonQuery,
} from "@commerce/crawler";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-114 — **국내/해외 동일상품 후보가 «실제로 몇 개 있는가»** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-19 — 「가격 작업 금지. 샵당 best 1건이 아니라 **CEO 가 육안으로 판단할
 *    후보 목록이 실제로 몇 개 존재하는지** 부터 확인한다. 운영 UI 에 다중 후보 구조를
 *    구현하라는 뜻이 아니다.」
 *
 * 🔴🔴 **국내 후보 생산자는 «둘» 이다** — WU-112 는 그중 하나만 쟀다:
 *    ⒜ **AI URL 풀**(`collectUrlCandidatePool`) — WU-112 가 측정(27건) · 여기서 재사용
 *    ⒝ **등록부 국내 검색**(`searchDomesticShops`) — 🔴 WU-112 **분모 밖** 이었다
 *    ⟹ 국내 후보 수를 ⒜ 만으로 답하면 **틀린다**. 이 하니스가 ⒝ 를 더한다.
 *
 * 🔴 `listDomesticPriceSources` 는 로컬에서 **조용히 `[]`** 를 준다(service-role 키 부재).
 *    🟢 그래서 운영 DB 에서 읽은 **AUTO_* + enabled + KIDS** 6곳을 그대로 쓴다(WU-092 와 같은 목록).
 *    🔴 이 목록을 **늘리지 않는다** — Registry 확대는 금지다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const AI_DUMP = path.join(OUT, "wu-112.json");

/** 🟢 2026-10-19 DB 실측 그대로(`domestic_price_sources` · AUTO_* AND enabled). */
const SHOPS = [
  { id: "1479ca9d-8a13-4cf2-813a-0e25ec3c9439", name: "CHOCO.EL(초코엘)", domain: "chocoel.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "03677bb2-da2d-4603-ba8c-67f673c8b245", name: "DEUXBEBE(듀베베)", domain: "deuxbebe.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "85b573b1-2f89-4a4f-a54c-40391d211800", name: "포레포레", domain: "foretforet.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "04e8aa1d-b430-4d4b-b453-1c9f7a808e23", name: "LITTLE LUNA(리틀루나)", domain: "littleluna.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "4de6b18e-cc58-4eb9-9def-b2fb96ef2350", name: "RULII(루리샵)", domain: "rulii.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
];

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

const tally = (xs: (string | null | undefined)[]) =>
  xs.reduce<Record<string, number>>((a, k) => ((a[String(k)] = (a[String(k)] ?? 0) + 1), a), {});

describe("WU-114 — 후보 재고 전수 (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "국내·해외 후보가 생산자별로 몇 개인지 센다",
    async () => {
      const ai = existsSync(AI_DUMP) ? JSON.parse(readFileSync(AI_DUMP, "utf8")) : null;
      const out: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const of_ = await factsFromProductUrl(c.origin);
        const q = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: of_.candidate!.facts,
        } as ComparisonQuery;

        /* ── ⒝ 등록부 국내 검색 — 운영 함수 그대로 ── */
        const results = await searchDomesticShops(q, SHOPS);
        const regRows: Record<string, unknown>[] = [];
        for (const r of results) {
          const notSelf = (r.candidates ?? []).filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          if (notSelf.length === 0) continue;
          const priced = await enrichCandidatePrices(withConfidence(q, notSelf), r.domain, q);
          const t = await attachMatchTruth(
            [{ ...r, candidates: priced }],
            q.facts?.brandModelCode ?? null,
            q.facts?.colorText ?? null,
          );
          const cands = t[0].candidates;
          const j = await judgeDomesticCandidate({
            domain: r.domain,
            candidates: cands,
            sourceUrl: q.sourceUrl,
            foreignModelCode: q.facts?.brandModelCode ?? null,
            foreignColor: q.facts?.colorText ?? null,
            fetchModelCode: async () => null,
          });
          const bestUrl = j.kind === "JUDGED" ? j.best.url : null;
          for (const x of cands)
            regRows.push({
              producer: "REGISTRY_SEARCH",
              domain: r.domain,
              url: x.url,
              title: x.title ?? null,
              imageUrl: (x as { imageUrl?: string | null }).imageUrl ?? null,
              verdict: (x as { crossSellerVerdict?: string | null }).crossSellerVerdict ?? null,
              truth: (x as { matchTruth?: string | null }).matchTruth ?? null,
              matchLevel: x.matchLevel ?? null,
              modelCode: x.facts?.brandModelCode ?? null,
              price: x.price?.amount ?? null,
              currency: x.price?.currency ?? null,
              shopJudgement: j.kind,
              dropGate: j.kind === "DROPPED" ? String(j.gate) : null,
              isShopBest: bestUrl != null && bestUrl === x.url,
              priceTier: bestUrl === x.url && j.kind === "JUDGED" ? j.priceTier : null,
            });
        }

        /* ── ⒜ AI URL 풀 — WU-112 산출을 그대로 쓴다(새 호출 0) ── */
        const aiRows: Record<string, unknown>[] = (
          (ai?.find((g: { sid: string }) => g.sid === c.sid)?.candidates ?? []) as Record<string, unknown>[]
        ).map((x) => ({ ...x, producer: "AI_URL_POOL", verdict: x.crossSellerVerdict, truth: x.matchTruth }));

        const all = [...aiRows, ...regRows];
        /** 🔴 국내/해외는 **운영 분류**(`market`)로 가른다 — 등록부 행은 KR 통화샵이라 KRW 기준. */
        const isKr = (x: Record<string, unknown>) =>
          x.producer === "REGISTRY_SEARCH" ? true : x.market === "KR";
        const dom = all.filter(isKr);
        const os = all.filter((x) => x.producer === "AI_URL_POOL" && x.market === "OVERSEAS");
        const unk = all.filter((x) => x.producer === "AI_URL_POOL" && x.market === "UNKNOWN");
        /** 🔴 **지금 화면에 서는 후보** = JUDGED 샵의 best 1건(운영 sink 규칙 · WU-109). */
        const shown = all.filter((x) => x.isShopBest);

        // eslint-disable-next-line no-console
        console.log(
          `\n════════ ${c.sid} / ${c.code} ════════\n` +
            `  후보 총 **${all.length}**  (AI URL 풀 ${aiRows.length} · 등록부 검색 **${regRows.length}**)\n` +
            `  🇰🇷 국내 ${dom.length}  (AI ${aiRows.filter((x) => x.market === "KR").length} + 등록부 ${regRows.length})\n` +
            `  🌎 해외 ${os.length} · ❔ 미확정 ${unk.length}\n` +
            `  🔴 **지금 화면에 서는 후보 ${shown.length}** (샵당 best 1건 · DROPPED 샵은 0)\n` +
            `  verdict 전체 ${JSON.stringify(tally(all.map((x) => x.verdict as string)))}\n` +
            `  verdict 국내 ${JSON.stringify(tally(dom.map((x) => x.verdict as string)))}\n` +
            `  등록부 샵 응답 ${JSON.stringify(tally(results.map((r) => r.status)))}`,
        );
        for (const r of results)
          // eslint-disable-next-line no-console
          console.log(`    ${r.domain.padEnd(20)} ${String(r.status).padEnd(10)} ${(r.candidates?.length ?? 0)}건 ${r.error ?? ""}`);
        for (const x of regRows)
          // eslint-disable-next-line no-console
          console.log(
            `    [등록부] ${String(x.domain).padEnd(18)} v=${String(x.verdict).padEnd(14)} ml=${String(x.matchLevel).padEnd(10)}` +
              ` code=${String(x.modelCode).padEnd(11)} ${String(x.currency ?? "")} ${String(x.price ?? "")}  ${String(x.title).slice(0, 44)}`,
          );

        out.push({
          sid: c.sid,
          code: c.code,
          originUrl: c.origin,
          originTitle: q.title ?? null,
          originColor: q.facts?.colorText ?? null,
          originCode: q.facts?.brandModelCode ?? null,
          counts: {
            total: all.length,
            aiPool: aiRows.length,
            registry: regRows.length,
            domestic: dom.length,
            overseas: os.length,
            unknown: unk.length,
            shownNow: shown.length,
          },
          registryShopStatus: tally(results.map((r) => r.status)),
          candidates: all,
        });
      }

      writeFileSync(path.join(OUT, "wu-114.json"), JSON.stringify(out, null, 1));
      expect(out).toHaveLength(2);
    },
    3_600_000,
  );
});
