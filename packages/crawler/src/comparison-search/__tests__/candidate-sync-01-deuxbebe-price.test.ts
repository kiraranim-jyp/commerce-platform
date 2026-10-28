import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-SYNC-01 §13 — **`117,000` 이 `117` 로 저장되던 결함**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Production 실측(`price_observations` · DEUXBEBE · product_no=18285 · 같은 URL):
 * ```
 * 2026-10-08  price_krw = 117,000   ✅
 * 2026-10-28  price_krw =     117   🔴  ← 그 값이 domesticLowestPriceKrw 를 117 로 만들었다
 * ```
 * 원인 — `DETAIL_PRICE_RE` 의 캡처가 `([0-9]+)` 라 **콤마에서 멈췄다**.
 *
 * ── 🔴 규칙을 **복제하지 않는다** ──────────────────────────────────────────
 * 기대값을 손으로 적으면 동어반복이 된다. 그래서 **운영 소스에서 정규식 리터럴을
 * 읽어** 그대로 돌린다 — 운영이 바뀌면 이 계약이 **같이** 움직인다.
 */

const SRC = readFileSync(join(__dirname, "../deuxbebe.ts"), "utf8").replace(/\r\n/g, "\n");

/** 🟢 운영 리터럴을 **읽어서** RegExp 로 되살린다(사본 금지). */
function operatingPriceRe(): RegExp {
  const m = /const DETAIL_PRICE_RE = \/(.+?)\/;/.exec(SRC);
  expect(m, "DETAIL_PRICE_RE 를 소스에서 찾지 못했다 — 이름/모양이 바뀌었다").toBeTruthy();
  return new RegExp(m![1]!);
}

/** 🟢 운영 `parsePrice` 와 **같은 정규화**(그 함수는 export 되지 않는다 · 소스로 확인). */
function parseLikeOperating(raw: string | null): number | null {
  expect(SRC, "parsePrice 의 비숫자 제거가 사라졌다").toContain('raw.replace(/[^0-9]/g, "")');
  if (!raw) return null;
  const n = Number(raw.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const html = (shown: string) =>
  `<div><span id="span_product_price_text" class="x">${shown}</span></div>`;

describe("CANDIDATE-SYNC-01 §13 — deuxbebe 상세 가격", () => {
  it("D-1 🔴🔴 **콤마가 있는 표기** 가 온전히 읽힌다 — `117,000` → `117000`", () => {
    const re = operatingPriceRe();
    const got = parseLikeOperating(re.exec(html("117,000"))?.[1] ?? null);
    expect(got, "콤마에서 잘려 117 이 됐다 — Production 결함의 재발이다").toBe(117000);
  });

  it("D-2 🟢 **콤마가 없는 표기** 도 그대로 읽힌다(기존 동작 보존)", () => {
    const re = operatingPriceRe();
    expect(parseLikeOperating(re.exec(html("117000"))?.[1] ?? null)).toBe(117000);
  });

  it("D-3 🟢 원화 기호·공백·꼬리 글자가 섞여도 금액만 남는다", () => {
    const re = operatingPriceRe();
    expect(parseLikeOperating(re.exec(html("  134,000원"))?.[1] ?? null)).toBe(134000);
  });

  /** 🔴 **거짓 금액을 만들지 않는다** — 숫자가 없으면 null 이어야 한다. */
  it("D-4 🔴 금액이 없으면 **지어내지 않는다**", () => {
    const re = operatingPriceRe();
    expect(re.exec(html("품절"))).toBeNull();
    expect(parseLikeOperating(null)).toBeNull();
  });

  /**
   * 🔴 이 파일 주석이 한때 「이 도메인만 콤마가 없다」고 단정했고 **그 전제가 깨졌다**.
   *    같은 단정이 되돌아오지 못하게 잠근다.
   */
  it("D-5 🔴 「콤마가 없다」는 단정을 다시 적지 않는다", () => {
    const at = SRC.indexOf("const DETAIL_PRICE_RE");
    expect(at).toBeGreaterThan(0);
    expect(SRC.slice(at, at + 200)).not.toMatch(/콤마가 없다|콤마 미포함/);
  });
});
