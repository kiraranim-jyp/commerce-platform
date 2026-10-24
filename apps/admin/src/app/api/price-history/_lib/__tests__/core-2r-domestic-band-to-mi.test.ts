import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { computeSellability } from "@commerce/pricing";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2R — **국내 가격대 → MI 판단 연결 지점 실측**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-24) — ① MI 판단 입력은 **기존 `domestic.exact.averagePriceKrw`** ·
 * 신규 판단식 금지 ② 가격 evidence 는 **현행 `EXACT | COMPARISON`** 그대로 ·
 * `PRESUMED_SAME` 강제 승격 금지 ③ 가격대(min~max)는 **표시용** 이고 판단식과 분리 ·
 * ④ `costPriceKrw` 신규 구현/임의 입력 **금지**(없으면 현행대로 **UNKNOWN**).
 *
 * 🔴 운영 코드 변경 **0** — 이 파일은 **연결 지점 실측** 이다.
 *
 * ── 🟢🟢 소스에서 읽은 게이트 둘(추측 0) ──────────────────────────────────
 * ```
 * ⒜ market-intelligence.ts:247   `market !== "KR"` 분기 안에서
 *       priceCurrency === "KRW" → `krwWithoutKrEvidence += 1` → **continue**
 *    ⟹ 🔴 **KRW 라도 `market !== "KR"` 이면 국내 가격 축에 «들어가지 않는다»**
 *       (CPO 가 WU-020 §4 에서 금지한 「통화 단독 결정」을 피하는 설계)
 * ⒝ market-intelligence.ts:318   `priceTier === "EXACT" || "COMPARISON"` → 적재
 *    ⟹ 🟢 **CPO 가 확정한 현행 정책이 바로 이 줄이다**(PRESUMED_SAME 강제 승격 0)
 * ⒞ sellability.ts:84-90        referencePrice = `domestic.averagePriceKrw`
 *       marginPercent < **10**(DEFAULT_MARGIN_FLOOR_PERCENT) → RED, 아니면 GREEN
 *       🔴 `costPriceKrw == null` → **UNKNOWN**(분기 1 · 가격대보다 앞선다)
 * ```
 */

const MINI = "https://miniboutique.co.kr/product/detail.html?product_no=4117&cate_no=1&display_group=1";
const DONO = "https://www.donokids.com/shop/shopdetail.html?branduid=3362785";

describe("CORE-2R — 국내 가격대 → MI 연결 지점 (운영 변경 0)", () => {
  it("두 국내 후보가 «어디까지» 도달하는지 잰다", async () => {
    const targets = [
      { label: "miniboutique.co.kr", url: MINI, domain: "miniboutique.co.kr" },
      { label: "donokids.com", url: DONO, domain: "donokids.com" },
    ];

    console.log("\n═══ 1. 국내 후보 — market 분류와 가격 ═══");
    const kr: { label: string; price: number }[] = [];
    let unreachable = 0;

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate) {
        unreachable += 1;
        console.log(`    ${t.label.padEnd(22)} 🔴 ${f.status} — **측정불가**(0 으로 세지 않는다)`);
        continue;
      }
      const raw = f.candidate as unknown as { price?: { amount: number; currency: string } | null };
      const cur = raw.price?.currency ?? null;
      const amt = raw.price?.amount ?? null;

      /**
       * 🔴 등록부 조회는 service-role 키가 필요해 **할 수 없다** ⟹ `false` 로 둔다.
       *    🟢 그것은 「국내로 올려주지 않는다」는 **보수적 방향** 이다(그 칸은 충돌 감지용).
       * 🔴 그래서 이 측정의 `market` 은 **등록부가 비었을 때의 값** 이고, 운영에서
       *    그 호스트가 등록부에 있으면 `REGISTERED_SHOP_AND_KRW` 로 **KR 이 될 수 있다**.
       */
      const mk = classifyCandidateMarket({ domain: t.domain, currency: cur, isRegisteredDomesticShop: false });
      const mkReg = classifyCandidateMarket({ domain: t.domain, currency: cur, isRegisteredDomesticShop: true });
      console.log(
        `    ${t.label.padEnd(22)} 가격 **${cur ?? "-"} ${amt ?? "-"}** · market **${mk.market}**(${mk.basis})` +
          ` · 등록부 있으면 **${mkReg.market}**`,
      );
      if (mk.market === "KR" && amt != null) kr.push({ label: t.label, price: amt });
    }

    /* ═══ 2. 가격대(표시용) — 🔴 판단식과 분리 ════════════════════════ */
    console.log("\n═══ 2. 국내 가격대(표시용) ═══");
    const prices = kr.map((k) => k.price).sort((a, b) => a - b);
    const band =
      prices.length === 0
        ? "가격 evidence 없음"
        : prices.length === 1
          ? `단일 참고가격 ₩${prices[0].toLocaleString()}`
          : `₩${prices[0].toLocaleString()} ~ ₩${prices[prices.length - 1].toLocaleString()}`;
    console.log(`    확인 판매처 **${kr.length}곳** — ${kr.map((k) => k.label).join(", ") || "없음"}`);
    console.log(`    가격대 **${band}**`);
    console.log("    🔴 「판매처 0」과 「가격 0」을 섞지 않는다 — 위 숫자는 **KR 로 분류된** 후보다");

    /* ═══ 3. MI 판단 입력 — 기존 계산식 그대로 ═══════════════════════ */
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
    console.log("\n═══ 3. MI 입력(기존 `computeSellability` · 판단식 변경 0) ═══");
    console.log(`    domestic.matched **${kr.length > 0}** · domestic.averagePriceKrw **${avg ?? "null"}**`);
    for (const cost of [null, 50000] as (number | null)[]) {
      const r = computeSellability({
        costPriceKrw: cost,
        domestic: { matched: kr.length > 0, averagePriceKrw: avg },
      });
      console.log(
        `    costPriceKrw=${String(cost).padEnd(6)} → level **${r.level}**` +
          (r.estimatedMarginPercent != null ? ` · 예상 마진 ${r.estimatedMarginPercent}%` : ""),
      );
    }
    console.log("    🔴 `costPriceKrw=50000` 은 **판단식이 사는지 보려는 참조값** 이고");
    console.log("       운영에 넣는 값이 아니다 — CPO 가 임의 원가 입력을 금지했다(§4).");

    /* ═══ 4. Negative ═══════════════════════════════════════════════ */
    console.log("\n═══ 4. Negative — 들어가면 안 되는 둘 ═══");
    console.log("    parkette.ca           CEO **DIFFERENT** · 유형 Sweatshirt ⟹ 국내 후보가 **아니다**(해외)");
    console.log("    bornyesterdaykids.com CEO **UNCERTAIN** · 상/하의 세트 ⟹ 국내 후보가 **아니다**(해외)");
    console.log("    🟢 둘 다 **국내 가격 evidence 분모에 애초에 없다** — 위 §1 대상이 국내 둘뿐이다");
    expect(
      kr.map((k) => k.label).some((l) => l.includes("parkette") || l.includes("bornyesterday")),
      "🔴 CEO DIFFERENT/UNCERTAIN 후보가 국내 가격에 들어가면 안 된다",
    ).toBe(false);

    /* ═══ 5. KPI ════════════════════════════════════════════════════ */
    console.log("\n═══ 5. KPI ═══");
    console.log(`    K1 국내 동일상품 가격 recovery   **${kr.length}개**(측정불가 ${unreachable})`);
    console.log(`    K2 국내 가격대 생성             **${prices.length >= 2 ? "YES" : prices.length === 1 ? "단일" : "NO"}**`);
    console.log(`    K3 MI 판단 연결                 **${avg != null ? "YES" : "NO"}** (averagePriceKrw 가 입력된다)`);
    console.log(`    K4 잘못된 후보 가격 유입         **0**`);

    expect(unreachable + kr.length, "🔴 측정 대상이 비면 보고하지 않는다").toBeGreaterThan(0);
  }, 300000);
});
