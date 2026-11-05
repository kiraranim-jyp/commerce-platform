/** @vitest-environment jsdom */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  CANDIDATE_EVIDENCE_FOLD_LABEL,
  CANDIDATE_GROUP_LABEL,
  CANDIDATE_LIST_HEADING,
  CANDIDATE_PRICE_UNKNOWN,
  CANDIDATE_PRICE_UNVERIFIED,
} from "../mi-same-candidates";
import { EVIDENCE_SUMMARY_LABEL } from "../GeminiTransientCandidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 2 — **운영이 방금 낸 «실제 후보 행» 을 화면에 붙인다**(실용성 축)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 이 파일이 따로 있나** — 기존 마운트 계약 28건은 **손으로 만든 행** 을 쓴다.
 *    그것은 「화면이 그 모양을 그릴 수 있다」를 증명하지만 「**운영이 실제로 내는
 *    행** 을 그린다」를 증명하지 못한다. 🔴 이 트랙에서 그 둘을 섞어 두 번 틀렸다.
 * 🟢 그래서 `sprint2-e2e-live` 가 남긴 **운영 러너 산출** 을 읽어 그대로 마운트한다.
 *
 * 🔴 CPO 가 엄격히 보겠다고 한 셋을 단언으로 박는다:
 * ```
 * ① 「가격 관측 있음」과 「가격 비교 집계 자격 있음」을 **혼동하지 않는다**
 * ② **`PRESUMED_SAME` 을 «검증된 동일상품 가격» 으로 표시하지 않는다**
 * ③ 한두 성공 사례로 전체를 주장하지 않는다 ⟹ **상품별로** 돌고 **전건** 을 적는다
 * ```
 * 🔴 라이브 덤프가 없으면 **SKIP** 한다 — 「0건 통과」로 적지 않는다(측정불가 ≠ PASS).
 * 🔴 네트워크 0 · 운영 코드 변경 0.
 */

const DUMP = path.join(process.env.TEMP ?? ".", "mi-p0-02", "sprint2-e2e-rows.json");
const READY = existsSync(DUMP);

interface Bundle {
  host: string;
  snapshot: string;
  rows: GeminiTransientRow[];
}

const load = (): Bundle[] =>
  (JSON.parse(readFileSync(DUMP, "utf8")) as { rowsDump: Bundle[] }).rowsDump ?? [];

const mount = (rows: GeminiTransientRow[]) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows,
        snapshotId: "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2",
      } as never),
    );
  });
  return {
    text: host.textContent ?? "",
    doc: host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

describe.runIf(READY)("SPRINT2-SCREEN — 운영 실제 행으로 화면 검증", () => {
  it("S-1 🟢 상품마다 화면이 그려지고 «국내/해외» 축이 갈린다", () => {
    const bundles = load();
    expect(bundles.length, "🔴 라이브 행 번들이 0 — 측정불가").toBeGreaterThan(0);
    /* eslint-disable no-console */
    for (const b of bundles) {
      const m = mount(b.rows);
      /** 🔴 두 시장 제목이 **둘 다** 선다(한쪽이 0건이어도 「조회 안 함」으로 보이지 않게). */
      expect(m.text, `🔴 ${b.host} — 🇰🇷 축 제목이 없다`).toContain(CANDIDATE_LIST_HEADING.KR);
      expect(m.text, `🔴 ${b.host} — 🌎 축 제목이 없다`).toContain(CANDIDATE_LIST_HEADING.OVERSEAS);
      console.log(
        `  ${b.host} — 행 ${b.rows.length} · KR ${b.rows.filter((r) => r.market === "KR").length} · ` +
          `OVERSEAS ${b.rows.filter((r) => r.market === "OVERSEAS").length}`,
      );
      m.cleanup();
    }
    /* eslint-enable no-console */
  });

  it("S-2 🔴🔴 `PRESUMED_SAME` 은 **「동일상품 추정」** 으로 선다 — 확정으로 단정하지 않는다", () => {
    const bundles = load();
    let checked = 0;
    for (const b of bundles) {
      const presumed = b.rows.filter((r) => r.crossSellerVerdict === "PRESUMED_SAME");
      if (presumed.length === 0) continue;
      const m = mount(b.rows);
      checked += 1;
      /** 🟢 그 군의 라벨이 화면에 있다(owner 상수 = `ccl-01` 이 글자를 잠근 그 값). */
      expect(m.text, `🔴 ${b.host} — 추정 군 라벨이 없다`).toContain(CANDIDATE_GROUP_LABEL.PRESUMED);
      /**
       * 🔴🔴 **CPO ② 그 자체** — 추정 후보가 있는 화면에 「검증된 동일상품」류의
       *    확정 어휘가 **서지 않는다**. 🔴 이 단언이 깨지면 셀러가 추정가를
       *    확정가로 읽는다.
       */
      for (const banned of ["검증된 동일상품", "확인된 동일상품 가격", "동일상품 확정"]) {
        expect(m.text, `🔴 ${b.host} — 확정 어휘가 노출됐다: ${banned}`).not.toContain(banned);
      }
      m.cleanup();
    }
    /** 🔴 표본이 없으면 **PASS 로 적지 않는다** — 그 사실을 남긴다. */
    if (checked === 0) {
      /* eslint-disable-next-line no-console */
      console.log("  🔴 PRESUMED_SAME 표본 0 — **측정불가**(PASS 로 적지 않는다)");
    }
  });

  it("S-3 🔴 가격에는 **검증 상태** 가 함께 선다 — 관측과 자격을 섞지 않는다(CPO ①)", () => {
    const bundles = load();
    let seen = 0;
    for (const b of bundles) {
      /** 🔴 가격이 **있는데 확인되지 않은** 행 — 그 행이 가장 위험하다. */
      const risky = b.rows.filter((r) => r.priceAmount != null && r.priceStatus !== "VERIFIED_CURRENT");
      if (risky.length === 0) continue;
      const m = mount(b.rows);
      seen += 1;
      /** 🟢 화면이 「확인 필요」 또는 「상세 검증 전」 중 하나를 **말한다**. */
      const says =
        m.text.includes(CANDIDATE_PRICE_UNKNOWN) || m.text.includes(CANDIDATE_PRICE_UNVERIFIED);
      expect(says, `🔴 ${b.host} — 미확인 가격이 상태 없이 숫자만 섰다`).toBe(true);
      m.cleanup();
    }
    if (seen === 0) {
      /* eslint-disable-next-line no-console */
      console.log("  🟡 미확인 가격 표본 0 — 측정불가");
    }
  });

  it("S-4 🟢 판매자(도메인)와 Evidence 상세가 **행마다** 선다", () => {
    const bundles = load();
    for (const b of bundles) {
      if (b.rows.length === 0) continue;
      const m = mount(b.rows);
      /** 🟢 판매처 도메인이 화면에 있다(판매자·출처 축). */
      const anyDomain = b.rows.some((r) => m.text.includes(r.domain));
      expect(anyDomain, `🔴 ${b.host} — 판매처 도메인이 화면에 없다`).toBe(true);
      /**
       * 🟢 Evidence 접힘이 있다(「왜 같은 상품인가」를 열 수 있다).
       * 🔴🔴 **1차에 틀렸다** — 이 표면(`MarketPriceComparison`)의 owner 는
       *    `CANDIDATE_EVIDENCE_FOLD_LABEL`(「근거 확인」)이고, 내가 다른 표면
       *    (`GeminiTransientCandidates`)에 새로 적은 「판단 근거」로 단언해 FAIL 했다.
       *    🟢 그 FAIL 이 **두 화면이 같은 뜻을 다른 말로 부르고 있다** 는 사실을 드러냈고,
       *       그래서 `EVIDENCE_SUMMARY_LABEL` 을 **이 owner 로 모았다**(새 어휘 폐기).
       * 🟢 이제 두 상수가 **같은 글자** 라 어느 쪽으로 단언해도 같다 — owner 로 적는다.
       */
      expect(m.text, `🔴 ${b.host} — Evidence 접힘이 없다`).toContain(CANDIDATE_EVIDENCE_FOLD_LABEL);
      expect(EVIDENCE_SUMMARY_LABEL, "🔴 두 표면의 근거 접힘 어휘가 갈라졌다").toBe(
        CANDIDATE_EVIDENCE_FOLD_LABEL,
      );
      m.cleanup();
    }
  });

  it("S-5 🔴🔴 **내부 토큰이 화면에 노출되지 않는다** — 실제 행 전수로 본다", () => {
    const bundles = load();
    for (const b of bundles) {
      if (b.rows.length === 0) continue;
      const m = mount(b.rows);
      for (const banned of [
        "BRAND_MISMATCH",
        "NO_TITLE_OVERLAP",
        "PRESUMED_SAME",
        "VERIFIED_CURRENT",
        "UNVERIFIED_SEARCH",
        "CROSS_SELLER_AXES",
        "TEXT_CONFIRMED",
        "EXCLUDED",
      ]) {
        expect(m.text, `🔴 ${b.host} — 내부 토큰 노출: ${banned}`).not.toContain(banned);
      }
      m.cleanup();
    }
  });
});
