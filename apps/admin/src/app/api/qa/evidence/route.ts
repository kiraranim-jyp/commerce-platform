import { NextResponse } from "next/server";
import { factsFromProductUrl } from "@commerce/crawler";
import { explainEvidence } from "@commerce/crawler/src/comparison-search/evidence-explain";
import type { ProductFacts } from "@commerce/shared";
import { requireUser } from "@/lib/auth/require-user";
import { computeMarketIntelligence } from "../../price-history/_lib/market-intelligence";
import { summarizeJudgmentReadiness } from "../../price-history/_lib/judgment-readiness";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-FINAL-VISUAL-01 — **TEST/QA 전용 X-Ray 엔드포인트**(CPO GO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 화면은 이 라우트를 부르지 않는다.** 내부 Evidence 는 **여기서만** 나간다
 *    (계약이 운영 컴포넌트의 호출 0 을 잠근다).
 *
 * 🔴 **새 판단을 만들지 않는다**(CPO §2 · §7 · §8):
 * ```
 * URL        → 기존 `factsFromProductUrl`(운영 경로 그대로) → 기존 evidence → 설명만
 * snapshotId → 기존 `computeMarketIntelligence`(운영 GET 과 **같은 함수**) → 상태만 분류
 * ```
 * ⟹ 여기서 계산되는 Identity · 가격 · MI · 권장가가 **하나도 없다**.
 *
 * 🔴 `requireUser` 를 그대로 쓴다 — QA 라고 인증을 느슨하게 하지 않는다.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { url?: string; snapshotId?: string };
  const url = body.url?.trim();
  const snapshotId = body.snapshotId?.trim();
  if (!url && !snapshotId) {
    return NextResponse.json({ ok: false, error: "url 또는 snapshotId 가 필요합니다." }, { status: 400 });
  }

  const response: Record<string, unknown> = { ok: true };

  /* ── ① 상품 URL → Evidence X-Ray(기존 운영 추출 경로 그대로) ── */
  if (url) {
    try {
      const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
      const facts = ((r.candidate as Record<string, unknown> | undefined)?.facts as ProductFacts) ?? null;
      response.extraction = {
        status: String(r.status ?? "?"),
        fetchPath: String(r.fetchPath ?? "?"),
        httpCalls: r.httpCalls ?? null,
      };
      /** 🔴 facts 를 못 얻으면 **지어내지 않는다** — 상태만 돌려준다. */
      response.explanation = facts ? explainEvidence(facts) : null;
    } catch (error) {
      response.extraction = { status: "THREW", error: error instanceof Error ? error.message : "알 수 없는 오류" };
      response.explanation = null;
    }
  }

  /* ── ② snapshotId → 기존 MI 결과를 «읽어» READY/LIMITED/HOLD 로 분류 ── */
  if (snapshotId) {
    const mi = (await computeMarketIntelligence(snapshotId, auth.user.workspaceId)) as
      | (Record<string, unknown> & {
          domesticMarketSplit?: { exact?: { sellerCount?: number; lowestPriceKrw?: number | null } };
          domesticCompetition?: { sellerCount?: number; lowestPriceKrw?: number | null };
          candidateOverseasPrice?: { byCurrency?: Record<string, { lowest?: number }> } | null;
          sellerFacingVerdict?: string | null;
          cost?: { suggestedPriceKrw?: number | null } | null;
          recommendation?: { recommendedPrice?: number | null } | null;
        })
      | null;
    if (!mi) {
      response.judgment = null;
      response.judgmentError = "스냅샷을 찾을 수 없습니다.";
    } else {
      /** 🔴 **읽기만** 한다 — 아래 어느 줄도 값을 «계산» 하지 않는다. */
      const exact = mi.domesticMarketSplit?.exact ?? mi.domesticCompetition ?? {};
      const byCurrency = mi.candidateOverseasPrice?.byCurrency ?? {};
      const firstCurrency = Object.keys(byCurrency)[0] ?? null;
      const readiness = summarizeJudgmentReadiness({
        /** 🔴 Identity 는 MI 가 이미 고른 대표 판정을 그대로 읽는다. */
        identityVerdict: (mi.sellerDecision as { identity?: string } | undefined)?.identity ?? null,
        priceTier: null,
        domesticReferenceCount: Number(exact.sellerCount ?? 0),
        domesticLowestKrw: (exact.lowestPriceKrw as number | null) ?? null,
        overseasLowest:
          firstCurrency && byCurrency[firstCurrency]?.lowest != null
            ? { amount: Number(byCurrency[firstCurrency]!.lowest), currency: firstCurrency }
            : null,
        sellerFacingVerdict: (mi.sellerFacingVerdict as string | null) ?? null,
        recommendedPriceKrw:
          mi.recommendation?.recommendedPrice ?? (mi.cost?.suggestedPriceKrw as number | null) ?? null,
      });
      response.judgment = readiness;
      /** 🟢 기존 결과를 **그대로** 같이 보낸다(재계산 0) — CEO 가 원본 값을 본다. */
      response.existing = {
        sellerFacingVerdict: mi.sellerFacingVerdict ?? null,
        domesticMarketSplit: mi.domesticMarketSplit ?? null,
        candidateOverseasPrice: mi.candidateOverseasPrice ?? null,
        recommendation: mi.recommendation ?? null,
      };
    }
  }

  return NextResponse.json(response);
}
