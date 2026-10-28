import { describe, expect, it } from "vitest";
import {
  countStrongKrSellerSignals,
  extractMarketEvidence,
  hasCompositeKrSellerEvidence,
} from "@commerce/crawler/src/comparison-search/market-evidence";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 MARKET-ATTRIB-01 — **`UNKNOWN + KRW` 를 국내로 귀속시킬 «기존» 증거가 있는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 조사 전용 — 운영 코드 변경 **0** · `classifyCandidateMarket` 수정 **0** ·
 *    도메인 예외 **0** · Registry **0** · Identity/MI/UI **0**.
 * 🔴 **「KRW 하나로 KR」 보호계약을 그대로 두고** 되는지만 본다(WU-020 §4).
 *
 * 🔴 실제 페이지를 여는 블록은 `MA01_LIVE=1` 에서만 돈다(기본 회귀는 HTTP 0).
 */

const LIVE = process.env.MA01_LIVE === "1";

/** 🔴 E2E-06 이 운영 runner 에서 실제로 받은 그 후보다. */
const DANAWA = "https://m.danawa.com/product/product.html?code=123688298";
/**
 * 🔴🔴 **반례** — WU-051/077 이 실측한 그 모양이다(해외 사이트가 한국 방문자에게
 *    KRW 를 보여준다). 여기가 뚫리면 「국내 최저가」가 해외 표시가로 둔갑한다.
 */
const OVERSEAS_KRW = "https://www.junioredition.com/en-kr/collections/bobo-choses";

const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function evidenceOf(url: string) {
  const res = await fetch(url, { headers: { "user-agent": ua }, signal: AbortSignal.timeout(25_000) });
  const html = await res.text();
  const ev = extractMarketEvidence(html);
  return { status: res.status, bytes: html.length, ev };
}

describe("MARKET-ATTRIB-01 — UNKNOWN + KRW 의 시장 귀속 증거", () => {
  it("🟢 기존 증거 축이 **이미 일반적** 이다 — 도메인/등록부가 아니다", () => {
    /** 🔴 강한 증거는 **셋** 이고 전부 «사이트가 스스로 적은 사실» 이다. */
    const strong = { businessRegistration: true, mailOrderRegistration: true, personalCustomsCode: false };
    expect(countStrongKrSellerSignals({ ...strong, domesticShipping: false, domesticPayment: false })).toBe(2);
    expect(hasCompositeKrSellerEvidence({ ...strong, domesticShipping: false, domesticPayment: false })).toBe(true);
    /** 🔴 보조 증거(배송·결제)만으로는 **못 넘는다** — 「한국어 페이지 = KR」 방지. */
    expect(
      hasCompositeKrSellerEvidence({
        businessRegistration: false,
        mailOrderRegistration: false,
        personalCustomsCode: false,
        domesticShipping: true,
        domesticPayment: true,
      }),
    ).toBe(false);
  });

  it("🔴 보호계약 — 증거가 있어도 **KRW 가 아니면** KR 이 되지 않는다", () => {
    const ev = {
      businessRegistration: true,
      mailOrderRegistration: true,
      personalCustomsCode: true,
      domesticShipping: true,
      domesticPayment: true,
    };
    /** 외화 + KR 증거 ⟹ **충돌** 이고 UNKNOWN 이다(해외 표시가 둔갑 방지). */
    const foreign = classifyCandidateMarket({
      domain: "example.com",
      currency: "USD",
      isRegisteredDomesticShop: false,
      marketEvidence: ev,
    });
    expect(foreign.market).toBe("UNKNOWN");
    /** 🔴 KRW «단독» 은 여전히 UNKNOWN 이다 — 이 줄이 WU-020 §4 다. */
    const krwOnly = classifyCandidateMarket({
      domain: "example.com",
      currency: "KRW",
      isRegisteredDomesticShop: false,
      marketEvidence: null,
    });
    expect(krwOnly.market).toBe("UNKNOWN");
    expect(krwOnly.basis).toBe("KRW_WITHOUT_DOMAIN_EVIDENCE");
  });

  it.runIf(LIVE)(
    "🔴🔴 실제 페이지 — danawa 와 **반례(해외 한국 표시가)** 를 같이 잰다",
    async () => {
      for (const [label, url] of [
        ["danawa(UNKNOWN+KRW 후보)", DANAWA],
        ["junioredition(해외 · 한국 표시가)", OVERSEAS_KRW],
      ] as const) {
        try {
          const { status, bytes, ev } = await evidenceOf(url);
          const n = countStrongKrSellerSignals(ev);
          /* eslint-disable no-console */
          console.log(
            `[MA01] ${label.padEnd(34)} HTTP ${status} ${String(bytes).padStart(7)}B ` +
              `강한신호 ${n} ${JSON.stringify(ev)} → KRW 와 종합 시 ${
                hasCompositeKrSellerEvidence(ev) ? "KR" : "UNKNOWN"
              }`,
          );
        } catch (e) {
          console.log(`[MA01] ${label} — 🔴 열지 못했다: ${(e as Error).name}`);
        }
      }
      expect(true).toBe(true);
    },
    120_000,
  );
});
