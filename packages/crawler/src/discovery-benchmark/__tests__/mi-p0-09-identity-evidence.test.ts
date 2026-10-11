/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-09 — Identity Evidence Sufficiency (CPO 지시, 2026-10-11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. Production 코드를 바꾸지 않는다.
 *
 * **전략 질문:** 현재 Identity 가 SAME 을 놓치는 «실제» 원인은 무엇인가.
 * 🔴 `NO_TITLE_OVERLAP = 개선해야 한다` 고 가정하지 않는다(CPO 금지).
 *
 * ── 🟢 SAME 조건이 코드에서 «완전히» 분해된다 (cross-seller.ts:995-1001) ───────
 *     if (conflicts.length > 0)                       → CONFLICT (점수 계산 전 반환)
 *     const blocked = blockers.length > 0
 *     if (!blocked && brandOk && corePoints >= 5)     → SAME
 *     if (totalPoints >= 3 && !sameSellerWithoutIdentity) → PRESUMED_SAME
 *     if (totalPoints >= 1)                           → SIMILAR
 *     else                                            → UNKNOWN
 *
 *   🔴 즉 **blocker 가 하나라도 있으면 SAME 은 구조적으로 불가능하다.**
 *      그래서 「어느 blocker 가 SAME 을 막았나」는 추측이 아니라 계산이다.
 *
 *   🟢 `brandOk` 는 반환값에서 «정확히» 복원된다 — `brandKnown=false` 면
 *      `BRAND_UNCONFIRMED`, `brandKnown && !brandOk` 면 `BRAND_MISMATCH` 가
 *      반드시 push 되므로(cross-seller.ts brandsCompatible 블록),
 *      `brandOk === !(BRAND_UNCONFIRMED || BRAND_MISMATCH)` 다.
 *
 * ── 🔴 circular test 를 피하는 게이트 (② 금지 ⑥) ────────────────────────────
 *   위 식을 하니스에 복제하면 「같은 함수로 expected 와 actual 을 만드는」 함정에
 *   빠진다. 그래서 **먼저 복제식이 실제 verdict 를 100% 재현하는지 확인** 하고,
 *   재현되지 않으면 **측정을 무효로 만든다**(expect 로 고정). 재현이 확인된
 *   뒤에만 counterfactual 에 쓴다. 재현식은 판정을 «만들지» 않고 민감도만 본다.
 *
 * ── 🔴🔴 1차 측정이 틀렸다 — 운영 경로를 건너뛰었다 (2026-10-11 자체 발견) ────
 *   1차 하니스는 `compareCrossSellerProducts` 를 **직접** 불렀다. 그런데 그 함수의
 *   **Production 호출부는 단 하나** 다 — `match.ts:525`, `withConfidence` «안» 이다.
 *   그리고 거기서는 날 `c.facts` 가 아니라 **품번이 주입된 `candidateFacts`** 로 부른다:
 *
 *     candidateFacts = c.facts.brandModelCode === null && query.facts?.brandModelCode
 *       ? { ...c.facts, brandModelCode: confirmBrandCodeInTitle(query.facts.brandModelCode, c.title) }
 *       : c.facts                                              (MI-DISCOVERY-P5.3)
 *
 *   🔴 즉 국내 판매처가 **제목에 적어 둔 해외 품번** 을 운영 경로는 읽는다. 직접
 *      호출은 읽지 못한다. `product-url-facts.ts:57` 이 그것을 명시해 뒀다 —
 *      「기존 MI 가 그대로 먹는 모양. `withConfidence(query, [candidate])` 로 넘긴다.」
 *
 *   🔴 그래서 이 파일은 **`withConfidence` 를 판정 owner 로 쓴다.** 복제식은
 *      counterfactual 민감도에만 쓰고, 두 게이트로 운영값과 일치를 먼저 증명한다.
 *
 * ── 측정 축 ────────────────────────────────────────────────────────────────
 *   ① blocker 전수 분포 + **동시발생(co-occurrence)**
 *   ② blocker 별 귀속 counterfactual — 「그것 «하나만» 없애면 SAME 이 되는가」
 *      vs 「blocker 를 «전부» 없애면 SAME 이 되는가」(상한)
 *   ③ `NO_TITLE_OVERLAP` 원인 분해 — 증거 없음 / 전부 유형어 / 실제로 다른 말
 *   ④ 독립 증거 라벨 — 품번·slug 가 title 축과 «무관하게» SAME 을 말하는가
 *   ⑤ origin facts 폴백 2 arm (Light Fetch 단독 ↔ universalExtract 폴백)
 *   ⑥ host 별 편차 · 비용
 *   ⑦ CTO 수동 라벨용 원문 덤프 — 두 상품명을 «그대로» 남긴다
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../../comparison-search/cross-seller";
// 🔴 `withConfidence` 가 운영 판정 owner 다. `extractCategoryTaxon` 과 같은 모듈에 있다.
import { extractCategoryTaxon, withConfidence } from "../../comparison-search/match";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { productFactsFromShopifyProduct } from "../../comparison-search/seller-facts";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import { universalExtract } from "../../universal-extractor";
import type { ComparisonCandidate, ComparisonQuery } from "../../comparison-search/types";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 cross-seller.ts 의 상수를 «읽어서» 적는다. 다른 값을 쓰면 재현 게이트가 깬다. */
const SAME_MIN_AXES = 5;
const PRESUMED_SAME_MIN_AXES = 3;

type Arm = "LIGHT_FETCH" | "WITH_FALLBACK";
interface Golden { host: string; url: string; brand: string; title: string; code: string | null }
interface Rec { url: string; level: string; discovered: { url: string; title: string | null }[] }

/** 🔴 MI-P0-05 와 같은 폴백. 새 추출기를 만들지 않는다. */
async function originFacts(url: string, host: string, arm: Arm): Promise<{ facts: ProductFacts | null; via: string }> {
  const lf = await factsFromProductUrl(url);
  if (lf.candidate?.facts) return { facts: lf.candidate.facts, via: "LIGHT_FETCH" };
  if (arm === "LIGHT_FETCH") return { facts: null, via: `NONE(${lf.status})` };
  try {
    const ue = await universalExtract(url);
    const p = ue.productData;
    if (!p?.title) return { facts: null, via: "NONE(ue-no-title)" };
    return {
      facts: productFactsFromShopifyProduct(
        { title: p.title, url, description: p.description, vendor: p.brand, type: p.shopifyProductType,
          tags: p.shopifyTags, options: (p.optionGroups ?? []).map((g) => ({ name: g.name, values: g.values })),
          images: ue.images.map((i) => i.url).filter(Boolean) },
        host,
      ),
      via: "UNIVERSAL_EXTRACT",
    };
  } catch (e) {
    return { facts: null, via: `NONE(ue-${e instanceof Error ? e.name : "?"})` };
  }
}

/**
 * 🔴 `NO_TITLE_OVERLAP` 의 원인을 가른다. cross-seller.ts 가 쓰는 것과 «같은»
 *    두 함수(`coreTitleTokens` 칸 · `extractCategoryTaxon`)로만 계산한다 —
 *    새 토크나이저를 만들면 그 숫자는 production 과 무관해진다.
 */
function titleCause(x: ProductFacts, y: ProductFacts) {
  const distinctive = (t: string[]) => [...new Set(t.filter((v) => extractCategoryTaxon(v) === null))];
  const dx = distinctive(x.coreTitleTokens);
  const dy = distinctive(y.coreTitleTokens);
  const emptyReason = (raw: string[], dist: string[]) =>
    raw.length === 0 ? "NO_CORE_TOKENS" : dist.length === 0 ? "ALL_TAXON" : null;
  const rx = emptyReason(x.coreTitleTokens, dx);
  const ry = emptyReason(y.coreTitleTokens, dy);
  const cause =
    rx && ry ? `EMPTY_BOTH(${rx}/${ry})`
    : rx ? `EMPTY_ORIGIN(${rx})`
    : ry ? `EMPTY_CANDIDATE(${ry})`
    : "DISJOINT";
  return { cause, originDistinctive: dx, candidateDistinctive: dy };
}

/** 🔴 title 축과 «무관한» 독립 증거만 본다 — 라벨을 title 로 만들면 순환이다. */
function independentEvidence(x: ProductFacts, y: ProductFacts) {
  const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cx = norm(x.brandModelCode), cy = norm(y.brandModelCode);
  const codeExact = !!cx && !!cy && cx === cy;
  const codePartial = !!cx && !!cy && !codeExact && (cx.startsWith(cy) || cy.startsWith(cx));
  const slugX = norm(x.urlSlug) + norm(x.sourceUrl);
  const slugY = norm(y.urlSlug) + norm(y.sourceUrl);
  // 🔴 4자 미만 코드는 slug 에 우연히 들어간다 — 독립 증거로 쓰지 않는다.
  const slugCarries = (slug: string, code: string) => code.length >= 4 && slug.includes(code);
  const slugEvidence = (!!cy && slugCarries(slugX, cy)) || (!!cx && slugCarries(slugY, cx));
  return {
    originCode: x.brandModelCode, candidateCode: y.brandModelCode,
    codeExact, codePartial, slugEvidence,
    label: codeExact || slugEvidence ? "INDEPENDENT_SAME"
         : codePartial ? "INDEPENDENT_PARTIAL"
         : !cx || !cy ? "🔴 UNLABELABLE(한쪽이라도 품번 없음)"
         : "INDEPENDENT_DIFF(품번이 다르다)",
  };
}

describe.skipIf(!LIVE)("🔴 MI-P0-09 — Identity 가 SAME 을 놓치는 실제 원인", () => {
  it(
    "blocker 귀속 counterfactual + NO_TITLE_OVERLAP 원인 분해 + 독립 증거 라벨",
    async () => {
      const lp = path.join(OUT_DIR, "mi-p0-03-levels.json");
      if (!existsSync(lp)) throw new Error(`선행 측정 없음: ${lp}`);
      const { golden, recs } = JSON.parse(readFileSync(lp, "utf8")) as { golden: Golden[]; recs: Rec[] };
      const det = new Map((JSON.parse(readFileSync(path.join(OUT_DIR, "mi-p0-03-candidate-quality.json"), "utf8")) as
        { details: { url: string; crawlerUrl: string | null; readable: boolean }[] }).details.map((d) => [d.url, d]));

      /* ── 후보를 한 번만 만든다. 🔴 `facts` 만 뽑지 않고 **ComparisonCandidate 전체**
       *    를 보관한다 — `withConfidence` 는 `c.title` 로 품번을 확인하므로 facts 만
       *    넘기면 운영 경로를 또 건너뛴다. ── */
      const candById = new Map<string, ComparisonCandidate | null>();
      const candUrls = [...new Set(recs.flatMap((r) => (r.discovered ?? []).map((d) => d.url)))];
      for (const u of candUrls) {
        const d = det.get(u);
        if (!d?.readable || !d.crawlerUrl) { candById.set(u, null); continue; }
        const r = await factsFromProductUrl(d.crawlerUrl);
        candById.set(u, r.candidate?.facts ? r.candidate : null);
      }
      const readableCands = [...candById.values()].filter(Boolean).length;

      interface Pair {
        arm: Arm; originHost: string; originBrand: string; originVia: string;
        originTitle: string; candidateUrl: string; candidateTitle: string;
        ownerVerdict: string | null; codeInjected: boolean;
        /** 🔴 운영 matchTruth/priceTier 계산에 필요한 입력. owner 는 `apps/admin` 에 있어
         *  여기서 tier 를 «계산하지 않는다** — 경계를 넘지 않고 입력만 덤프한다. */
        matchLevel: string | null; originColorText: string | null; candidateColorText: string | null;
        /** 🔴 MI-P0-10 독립 라벨러(Vision)용. 대표 이미지 1장 + 보유 장수. */
        originImageUrl: string | null; candidateImageUrl: string | null;
        originImageCount: number; candidateImageCount: number;
        verdict: string; axes: { axis: string; points: number }[]; blockers: string[]; conflicts: string[];
        corePoints: number; totalPoints: number; brandOk: boolean;
        /** 🔴 SAME 이 안 된 «이유 전부». 하나만 적으면 동시발생이 사라진다. */
        sameUnmet: string[];
        titleCause: string | null; originDistinctive: string[] | null; candidateDistinctive: string[] | null;
        independent: ReturnType<typeof independentEvidence>;
        /** counterfactual — 그 blocker «하나만» 없앴을 때 */
        soleBlockerRemovalYieldsSame: string | null;
        allBlockersRemovedYieldsSame: boolean;
      }
      const pairs: Pair[] = [];
      let replicationChecked = 0, replicationMismatch = 0;
      const mismatchSamples: unknown[] = [];

      /** 🔴 운영 판정 owner 와 직접 호출이 갈린 건수 — 1차 측정의 오류 크기다. */
      let ownerGateChecked = 0, ownerGateMismatch = 0, codeInjectedPairs = 0;
      const ownerMismatchSamples: unknown[] = [];

      for (const arm of ["LIGHT_FETCH", "WITH_FALLBACK"] as Arm[]) {
        for (const g of golden) {
          const of_ = await originFacts(g.url, g.host, arm);
          if (!of_.facts) continue;

          /* ── 🟢 운영 경로 그대로: query 를 만들고 후보 전체를 한 번에 넘긴다 ── */
          const seen = new Set<string>();
          const batch: ComparisonCandidate[] = [];
          for (const r of recs.filter((x) => x.url === g.url)) {
            for (const d of r.discovered ?? []) {
              if (seen.has(d.url)) continue;
              seen.add(d.url);
              if (isSelfReferenceCandidate(g.url, d.url)) continue;
              const c = candById.get(d.url);
              if (c) batch.push(c);
            }
          }
          if (batch.length === 0) continue;
          const query: ComparisonQuery = {
            title: of_.facts.title, brand: of_.facts.brand ?? undefined,
            sourceUrl: g.url, facts: of_.facts,
          };
          // 🔴 판정은 이 함수가 한다. 하니스가 verdict 를 «만들지» 않는다.
          const scored = withConfidence(query, batch);

          for (const sc of scored) {
            const cf = sc.facts;
            if (!cf) continue;
            /**
             * 🟢 게이트 ①(owner) — `withConfidence` 가 낸 verdict 와, 그것이 «실제로
             *    쓴» facts 로 다시 부른 결과가 같아야 한다. 같으면 아래 축 분해가
             *    운영 판정과 동일한 입력 위에 있다는 뜻이다.
             */
            const m = compareCrossSellerProducts(of_.facts, cf);
            ownerGateChecked++;
            if (sc.crossSellerVerdict && sc.crossSellerVerdict !== m.verdict) {
              ownerGateMismatch++;
              if (ownerMismatchSamples.length < 5) {
                ownerMismatchSamples.push({ owner: sc.crossSellerVerdict, direct: m.verdict, url: sc.url });
              }
            }
            // 🔴 운영 경로가 «제목에서» 품번을 채워 넣은 쌍 — 직접 호출은 못 보는 것
            const raw = candById.get(sc.url);
            const codeInjected = !!cf.brandModelCode && !raw?.facts?.brandModelCode;
            if (codeInjected) codeInjectedPairs++;

              const blockers = m.blockers.map((b) => b.blocker);
              const corePoints = m.axes
                .filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1))
                .reduce((s, a) => s + a.points, 0);
              const totalPoints = m.axes.reduce((s, a) => s + a.points, 0);
              const brandOk = !blockers.includes("BRAND_UNCONFIRMED") && !blockers.includes("BRAND_MISMATCH");
              const hasIdent = m.axes.some((a) => a.axis === "TITLE" || a.axis === "MODEL_CODE");
              const sameSellerNoIdent = !hasIdent && blockers.includes("SAME_SELLER_DISTINCT_LISTING");

              /* ── 🔴 재현 게이트 — 복제식이 실제 verdict 를 재현하는가 ── */
              const replicate = (bl: string[], bOk: boolean): string => {
                if (m.conflicts.length > 0) return "CONFLICT";
                if (bl.length === 0 && bOk && corePoints >= SAME_MIN_AXES) return "SAME";
                if (totalPoints >= PRESUMED_SAME_MIN_AXES && !sameSellerNoIdent) return "PRESUMED_SAME";
                if (totalPoints >= 1) return "SIMILAR";
                return "UNKNOWN";
              };
              replicationChecked++;
              const replicated = replicate(blockers, brandOk);
              if (replicated !== m.verdict) {
                replicationMismatch++;
                if (mismatchSamples.length < 5) {
                  mismatchSamples.push({ expected: m.verdict, replicated, blockers, corePoints, totalPoints,
                                         brandOk, conflicts: m.conflicts.map((c) => c.conflict),
                                         axes: m.axes.map((a) => `${a.axis}:${a.points}`) });
                }
              }

              /* ── SAME 이 안 된 이유 «전부» ── */
              const unmet: string[] = [];
              if (m.conflicts.length > 0) unmet.push(`CONFLICT(${m.conflicts.map((c) => c.conflict).join("+")})`);
              if (blockers.length > 0) unmet.push(`BLOCKERS(${blockers.join("+")})`);
              if (!brandOk) unmet.push("BRAND_NOT_OK");
              if (corePoints < SAME_MIN_AXES) unmet.push(`CORE_POINTS(${corePoints}<${SAME_MIN_AXES})`);

              /* ── counterfactual ── */
              let sole: string | null = null;
              for (const b of new Set(blockers)) {
                const rest = blockers.filter((x) => x !== b);
                const bOk = !rest.includes("BRAND_UNCONFIRMED") && !rest.includes("BRAND_MISMATCH");
                if (replicate(rest, bOk) === "SAME") { sole = b; break; }
              }
              const allRemoved = replicate([], true) === "SAME";

              const tc = blockers.includes("NO_TITLE_OVERLAP") ? titleCause(of_.facts, cf) : null;
              pairs.push({
                arm, originHost: g.host, originBrand: g.brand, originVia: of_.via,
                originTitle: of_.facts.title, candidateUrl: sc.url, candidateTitle: cf.title,
                /** 🟢 운영 owner(`withConfidence`)가 낸 값. 하니스가 만든 값이 아니다. */
                ownerVerdict: sc.crossSellerVerdict ?? null,
                matchLevel: sc.matchLevel ?? null,
                originColorText: of_.facts.colorText, candidateColorText: cf.colorText,
                originImageUrl: of_.facts.imageUrls[0] ?? null, candidateImageUrl: cf.imageUrls[0] ?? null,
                originImageCount: of_.facts.imageUrls.length, candidateImageCount: cf.imageUrls.length,
                /** 🔴 운영 경로가 제목에서 품번을 채운 쌍인가 — 1차 측정이 놓친 칸 */
                codeInjected,
                verdict: m.verdict, axes: m.axes.map((a) => ({ axis: a.axis, points: a.points })),
                blockers, conflicts: m.conflicts.map((c) => c.conflict),
                corePoints, totalPoints, brandOk, sameUnmet: unmet,
                titleCause: tc?.cause ?? null,
                originDistinctive: tc?.originDistinctive ?? null,
                candidateDistinctive: tc?.candidateDistinctive ?? null,
                independent: independentEvidence(of_.facts, cf),
                soleBlockerRemovalYieldsSame: sole,
                allBlockersRemovedYieldsSame: allRemoved,
              });
          }
        }
      }

      /* ── 집계 ── */
      const count = <T>(xs: T[], key: (x: T) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[key(x)] = (t[key(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const summarize = (arm: Arm) => {
        const ps = pairs.filter((p) => p.arm === arm);
        const blockerCensus: Record<string, number> = {};
        const coOccur: Record<string, Record<string, number>> = {};
        for (const p of ps) {
          for (const b of new Set(p.blockers)) {
            blockerCensus[b] = (blockerCensus[b] ?? 0) + 1;
            coOccur[b] ??= {};
            for (const o of new Set(p.blockers)) if (o !== b) coOccur[b][o] = (coOccur[b][o] ?? 0) + 1;
            coOccur[b].__ALONE__ = (coOccur[b].__ALONE__ ?? 0) + (new Set(p.blockers).size === 1 ? 1 : 0);
          }
        }
        const nto = ps.filter((p) => p.blockers.includes("NO_TITLE_OVERLAP"));
        return {
          judgedPairs: ps.length,
          origins: new Set(ps.map((p) => p.originHost + p.originBrand)).size,
          verdicts: count(ps, (p) => p.verdict),
          blockerCensus: Object.fromEntries(Object.entries(blockerCensus).sort((a, b) => b[1] - a[1])),
          blockerCoOccurrence: coOccur,
          /** 🔴 핵심 — 「그 blocker 하나만 없애면 SAME」 인 쌍 수. 없으면 그 blocker 는 단독 병목이 아니다. */
          soleBarrierYieldingSame: count(ps.filter((p) => p.soleBlockerRemovalYieldsSame), (p) => p.soleBlockerRemovalYieldsSame!),
          sameNow: ps.filter((p) => p.verdict === "SAME").length,
          codeInjected: ps.filter((p) => p.codeInjected).length,
          /** 🔴 품번이 주입된 쌍만 따로 — 그 쌍들이 어떤 판정을 받았는가 */
          verdictsAmongCodeInjected: count(ps.filter((p) => p.codeInjected), (p) => p.verdict),
          sameIfAllBlockersRemoved: ps.filter((p) => p.allBlockersRemovedYieldsSame).length,
          sameUnmetCombos: count(ps.filter((p) => p.verdict !== "SAME"), (p) => p.sameUnmet.map((u) => u.split("(")[0]).join(" + ")),
          noTitleOverlap: {
            pairs: nto.length,
            causeSplit: count(nto, (p) => p.titleCause ?? "?"),
            independentLabel: count(nto, (p) => p.independent.label),
            /** 🔴 title 말고 다른 것도 같이 막고 있는가 */
            alsoBlockedByOther: nto.filter((p) => new Set(p.blockers).size > 1).length,
            soleBarrier: nto.filter((p) => p.soleBlockerRemovalYieldsSame === "NO_TITLE_OVERLAP").length,
          },
          byHost: count(ps, (p) => p.originHost),
        };
      };

      /* ── 🔴 CTO 수동 라벨용 — NO_TITLE_OVERLAP 쌍의 원문을 그대로 남긴다 ── */
      const labelDump = pairs
        .filter((p) => p.arm === "WITH_FALLBACK" && p.blockers.includes("NO_TITLE_OVERLAP"))
        .map((p) => ({
          originHost: p.originHost, originTitle: p.originTitle, candidateTitle: p.candidateTitle,
          candidateUrl: p.candidateUrl, verdict: p.verdict, cause: p.titleCause,
          originDistinctive: p.originDistinctive, candidateDistinctive: p.candidateDistinctive,
          blockers: p.blockers, independentLabel: p.independent.label,
          soleBarrier: p.soleBlockerRemovalYieldsSame,
        }));

      const report = {
        scope: {
          note: "🔴 전수가 아니다. origin 은 MI-P0-03 의 층화 sample N=7 · 후보는 그 7개가 만든 전체 후보다.",
          originSampleN: golden.length, candidateUrlsTotal: candUrls.length, candidateReadable: readableCands,
        },
        /**
         * 🔴 게이트 둘. 둘 중 하나라도 깨지면 아래 숫자 전부 무효다.
         *   ownerGate      — 운영 owner(`withConfidence`)와 축 분해 입력이 같은가
         *   replicationGate — 복제식이 실제 verdict 를 재현하는가(counterfactual 전제)
         */
        ownerGate: { checked: ownerGateChecked, mismatch: ownerGateMismatch, mismatchSamples: ownerMismatchSamples },
        replicationGate: { checked: replicationChecked, mismatch: replicationMismatch, mismatchSamples },
        /** 🔴 1차 측정이 놓친 것의 크기 — 운영 경로가 제목에서 품번을 채운 쌍 수 */
        codeInjectedByProductionPath: codeInjectedPairs,
        armLightFetch: summarize("LIGHT_FETCH"),
        armWithFallback: summarize("WITH_FALLBACK"),
        labelDump,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-09-identity-evidence.json"), JSON.stringify(report, null, 1), "utf8");
      writeFileSync(path.join(OUT_DIR, "mi-p0-09-pairs.json"), JSON.stringify(pairs, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, labelDump: `(${labelDump.length}건 — 파일 참조)` }, null, 2));

      // 🔴 재현되지 않으면 측정을 무효로 만든다. 숫자를 그냥 적지 않는다.
      expect(ownerGateMismatch).toBe(0);
      expect(replicationMismatch).toBe(0);
      expect(pairs.length).toBeGreaterThan(0);
    },
    240 * 60 * 1000,
  );
});
