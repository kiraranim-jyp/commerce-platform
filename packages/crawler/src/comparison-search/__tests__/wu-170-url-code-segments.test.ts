import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import { compareCrossSellerProducts } from "../cross-seller";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-170 — **URL 품번을 «세그먼트별» 로 찾는 변경의 준비 계약**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 변경은 적용되지 «않았다».** CPO 성공조건(「Biskuit 이 운영 MI 에서 **SAME**
 * 으로 회수」 + 「전체 regression green」)이 **미충족** 이라 **되돌렸다**(WU-170 보고).
 *
 * ── 실측으로 확인된 것(변경을 켠 상태에서) ─────────────────────────────────
 * ```
 * 🟢 변경은 **발화한다** — biskuit 후보의 `identifierConfirmed` 🔴 → **🟢** ·
 *    축 합계 **1 → 4** · verdict **SIMILAR → PRESUMED_SAME**
 * 🔴 그런데 `SAME_MIN_AXES = 5` 라 **1점 부족** 하다 ⟹ SAME 아님
 * 🔴 브랜드까지 고쳐도(WU-164 CF-A 재측정) blocker 가 **`NO_TITLE_OVERLAP` 하나** 남고
 *    점수는 그대로다 ⟹ 남은 1점은 **TITLE 축**(= 한글 제목 문제 · WU-166/167)
 * 🔴 그리고 기존 CF 측정 기록 **4건** 이 움직였다(WU-063/064/065/068) —
 *    🟢 셋은 **안전한 방향**(WU-063 의 금지 완화가 Human DIFFERENT C23·C24 를 더는 올리지 않는다)
 *    🔴 하나는 **미규명**(C47 의 CF 승격이 사라졌다 · baseline 은 불변)
 * ```
 *
 * ── 🟢 이 파일의 역할 ──────────────────────────────────────────────────────
 * ```
 * ① **현재(미수정) 동작을 고정** 한다 — 쿠팡 고시 선례와 같은 모양이다.
 *    수정이 들어가면 그 단언이 **FAIL 로 뒤집히고 그것이 수정의 증거** 다.
 * ② 수정이 적용되면 A~F 가 **자동으로 켜진다**(`APPLIED` 감지).
 * 🔴 그래서 이 파일은 **되돌린 상태에서도 green** 이고 **적용하면 즉시 계약이 된다**.
 * ```
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, "..", "cross-seller.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** 🟢 변경이 적용됐는지 **소스로** 감지한다 — 사람이 플래그를 맞춰 줄 필요가 없다. */
const APPLIED = /function\s+urlCodeHaystacks/.test(SRC);

const facts = (over: Partial<ProductFacts>): ProductFacts => ({
  sourceUrl: "https://example.com/products/thing",
  urlSlug: null,
  brand: "Bobo Choses",
  brandModelCode: null,
  sellerSku: null,
  title: "Hug Hairy Monster T-shirt",
  coreTitleTokens: ["hug", "hairy", "monster"],
  categoryText: "t-shirt",
  colorText: null,
  materialText: null,
  fitText: null,
  ageRangeText: null,
  sizeLabels: [],
  audienceSignals: [],
  imageUrls: [],
  ...over,
});

const ORIGIN = facts({
  sourceUrl: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
  brandModelCode: "B226AC009",
});
const confirmed = (candidate: ProductFacts) => compareCrossSellerProducts(ORIGIN, candidate).identifierConfirmed;

/** 🔴 비스킷의 **실제** URL(WU-163 이 페이지네이션에서 회수한 그것). */
const BISKUIT_SHAPE =
  "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/70/display/1/";

describe("WU-170 Z — 🔴 현재(미수정) 동작을 고정한다", () => {
  /**
   * 🔴🔴 **이것이 결함의 고정이다.** URL 에 `b226ac009` 가 **분명히 있는데** 찾지 못한다 —
   *    `extractUrlSlug` 가 Cafe24 꼬리표 `…/display/1/` 의 `"1"` 만 보기 때문이다.
   * 🟢 수정이 들어가면 이 단언이 **FAIL 로 뒤집히고 그것이 수정의 증거** 다.
   */
  it.runIf(!APPLIED)("Z-1 🔴 중간 세그먼트의 품번을 **놓친다**(고정된 결함)", () => {
    expect(BISKUIT_SHAPE.toLowerCase()).toContain("b226ac009");
    expect(confirmed(facts({ sourceUrl: BISKUIT_SHAPE })), "🟢 수정이 들어가면 이 단언이 뒤집힌다").toBe(false);
  });

  /** 🟢 마지막 세그먼트에 있으면 **지금도** 찾는다 — 결함의 범위를 좁혀 둔다. */
  it("Z-2 🟢 마지막 세그먼트에 있으면 지금도 찾는다(트렌비 모양)", () => {
    expect(
      confirmed(
        facts({
          sourceUrl:
            "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
        }),
      ),
    ).toBe(true);
  });

  /** 🟢 DIFFERENT 방어는 **지금도** 산다(luxboy 모양) — 수정 전/후 **둘 다** 지켜야 한다. */
  it("Z-3 🟢 URL 에 품번이 없으면 찾지 않는다(luxboy 모양 · 수정 전후 불변)", () => {
    expect(
      confirmed(
        facts({
          sourceUrl: "https://m.luxboy.com/goods/A14338197CB8698CD92C86431CCE8D05",
          title: "보보쇼즈 키즈 긴팔티셔츠 B226AC009 451",
        }),
      ),
    ).toBe(false);
  });

  /** 🟢 비교 규칙은 **지금** 이대로여야 한다(수정 범위 밖임을 잠근다). */
  it("Z-4 🟢 비교 규칙·문턱 상수가 그대로다", () => {
    expect(SRC).toMatch(/code\.length\s*<\s*4/);
    expect(SRC).toMatch(/SAME_MIN_AXES\s*=\s*5/);
    expect(SRC).toMatch(/PRESUMED_SAME_MIN_AXES\s*=\s*3/);
    expect(SRC).toMatch(/slugCarriesCode\(x,\s*y\.brandModelCode\)/);
    expect(SRC).toMatch(/slugCarriesCode\(y,\s*x\.brandModelCode\)/);
  });
});

describe("WU-170 A — 적용되면: 중간 세그먼트를 회수한다", () => {
  it.runIf(APPLIED)("A-1 🟢 Cafe24 꼬리표 뒤에 있어도 찾는다(비스킷 모양)", () => {
    expect(confirmed(facts({ sourceUrl: BISKUIT_SHAPE }))).toBe(true);
  });
  it.runIf(APPLIED)("A-2 🟢 디코딩된 한글 경로에서도 찾는다", () => {
    expect(confirmed(facts({ sourceUrl: "https://biskuit.kr/product/보보쇼즈-허그-b226ac009/8891/display/1/" }))).toBe(
      true,
    );
  });
  it.runIf(APPLIED)("A-3 🟢 저장된 `urlSlug` 경로도 그대로 본다", () => {
    expect(confirmed(facts({ sourceUrl: "https://shop.example.com/x", urlSlug: "b226ac009-hug" }))).toBe(true);
  });
});

describe("WU-170 D — 적용되면: 🔴🔴 세그먼트 경계를 넘지 않는다", () => {
  /**
   * 🔴🔴 **이 계약이 이 변경의 가장 중요한 안전장치다.** `pathname` 을 통째로 이어붙이면
   *    아래가 `b226ac009` 로 합쳐져 **거짓 일치** 한다 — WU-169 의 1차 반사실이 실제로
   *    그 오탐을 만들었고, 음성 대조 M2 에서 **3 FAIL** 로 확인됐다.
   */
  it.runIf(APPLIED)("D-1 🔴 `/b226/ac009/` 는 거짓 일치가 아니다", () => {
    expect(confirmed(facts({ sourceUrl: "https://shop.example.com/b226/ac009/item" }))).toBe(false);
  });
  it.runIf(APPLIED)("D-2 🔴 세 조각으로 나뉘어도 합쳐지지 않는다", () => {
    expect(confirmed(facts({ sourceUrl: "https://shop.example.com/b/226/ac009" }))).toBe(false);
  });
  it.runIf(APPLIED)("D-3 🔴 전체 pathname 을 한 덩어리로 만들지 않는다(소스 앵커)", () => {
    expect(SRC).toMatch(/pathname\s*\.?\s*split\(\s*["']\/["']\s*\)/);
    expect(SRC).not.toMatch(/pathname\s*\.replace\(\s*\/\[\^a-z0-9\]\/g/);
  });
  it.runIf(APPLIED)("D-4 🔴 숫자-only 경로는 identifier 가 아니다", () => {
    expect(confirmed(facts({ sourceUrl: "https://shop.example.com/8891/category/70/display/1/" }))).toBe(false);
  });
});
