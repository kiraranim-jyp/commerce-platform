import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * WU-081 E2E(데이터 축) — **실제 국내 후보가 UI 행 모양까지 간다**
 *
 * 🔴 CPO §15: 「실제 국내 후보가 존재하는 fixture 를 사용. 가짜 UI mock 만으로
 *    완료 처리하지 않는다」.
 * 🟢 그래서 WU-063 이 운영 경로로 만든 **실측 표** 를 쓰고, 시장 판정은
 *    운영 owner `classifyCandidateMarket` 를 **그대로 불러** 재현한다.
 * 🔴 UI 상호작용은 `wu-081-domestic-review.test.ts`(마운트 DOM)가 본다 — 두 축을 가른다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const T63 = path.join(OUT, "wu-063-table.json");
const READY = existsSync(T63);

describe("WU-081 E2E — 실제 국내 후보 (캐시 필요)", () => {
  (READY ? it : it.skip)("국내 후보가 UI 구역 조건(market==='KR')을 만족한다", () => {
    type Row = { id: string; domain: string; currency: string | null; market: string; price: number | null; tier: string; basis: string };
    const T = JSON.parse(readFileSync(T63, "utf8")) as Row[];

    /** 🟢 §5-B CONTROL — 운영 owner 를 복제하지 않고 **호출** 해 표를 재현한다. */
    let mismatch = 0;
    for (const r of T) {
      const got = classifyCandidateMarket({
        domain: r.domain,
        currency: r.currency,
        isRegisteredDomesticShop: r.basis.includes("REGISTERED_SHOP"),
      });
      if (got.market !== r.market) mismatch += 1;
    }
    expect(mismatch).toBe(0);

    /** 🔴 UI 국내 구역의 조건은 **행의 `market === "KR"`** 하나다(패널 `isKr`). */
    const kr = T.filter((r) => r.market === "KR");
    // eslint-disable-next-line no-console
    console.log(`\n WU-081 E2E — market==="KR" 후보 **${kr.length}건** (이 행들이 🇰🇷 국내 후보 검토 구역에 선다)`);
    for (const r of kr)
      // eslint-disable-next-line no-console
      console.log(`   ${r.id.padEnd(4)} ${r.domain.padEnd(22)} ₩${String(r.price).padStart(8)} tier=${r.tier}`);

    /** 🔴🔴 **후보가 실재한다** — mock 이 아니라 운영 경로가 만든 행이다. */
    expect(kr.length).toBeGreaterThan(0);
    /** 🟢 전부 가격과 통화를 갖는다 — UI 가 「가격 미확인」으로 적지 않아도 된다. */
    for (const r of kr) {
      expect(r.currency).toBe("KRW");
      expect(r.price).not.toBeNull();
    }
    /** 🔴 그리고 **EXCLUDED 도 섞여 있다** — 구역은 그것을 숨기지 않는다(§12: 정책 불변). */
    expect(kr.some((r) => r.tier === "EXCLUDED")).toBe(true);
  });
});
