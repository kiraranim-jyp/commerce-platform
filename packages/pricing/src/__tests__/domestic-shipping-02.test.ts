import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NO_SHIPPING_POLICY_DATA_SUMMARY,
  SHIPPING_POLICY_MEANINGS,
  SHIPPING_POLICY_STATUSES,
  describeShippingPolicy,
  isShippingPolicyStatus,
  resolveShippingPolicy,
  shippingPolicyAllowsAmount,
  type ShippingPolicyStatus,
} from "../shipping-policy";
import { DEFAULT_PRICE_BREAKDOWN_INPUT, computePriceBreakdown } from "../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DOMESTIC-SHIPPING-02 1단계(CEO 지시, 2026-09-16)
 * 「배송비를 모른다」와 「배송비가 무료다」가 영원히 섞이지 않는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 원문 그대로:
 *   "이번 작업의 값어치는 «칸을 만든 것»이 아니라 «모른다와 무료다를 영원히
 *    못 섞게 만든 것»이다. 그게 안 되면 칸만 늘어난 것이다."
 *
 * 그래서 이 파일은 칸이 생겼다는 것을 재지 않는다. 다섯 상태가 «서로 구분되는지»,
 * NULL 이 UNREAD 와 «다른지», 금액을 채울 수 있는 것이 FREE·FLAT «둘뿐»인지를
 * 실행으로 재고, 마지막으로 마이그레이션 파일 자체를 읽어 DEFAULT·backfill 이
 * 들어오지 못하게 막는다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_054 = path.resolve(
  HERE,
  "../../../database/prisma/migrations_manual/054_price_observations_shipping_policy.sql",
);
const MIGRATION_SQL = readFileSync(MIGRATION_054, "utf8");

/* ═══════════ ① 다섯 상태는 서로 «구분되는» 값이다 ═══════════ */

describe("DOMESTIC-SHIPPING-02 ①: 다섯 상태가 서로 구분된다", () => {
  it("어휘는 정확히 다섯 개다 — 늘거나 줄면 054 의 CHECK 와 어긋난다", () => {
    expect([...SHIPPING_POLICY_STATUSES]).toEqual([
      "FREE",
      "FLAT",
      "CONDITIONAL_FREE",
      "ORDER_TIME",
      "UNREAD",
    ]);
    expect(new Set(SHIPPING_POLICY_STATUSES).size).toBe(5);
  });

  /**
   * 🔴 이 테스트가 이 파일의 심장이다. 두 상태가 같은 (금액규칙 · 페이지에서
   * 알 수 있는가 · 무료를 주장하는가) 조합을 갖는 순간, 그 둘은 «시스템이
   * 구분하지 못하는 같은 값»이 된 것이다. 칸만 다섯 개인 상태가 된다.
   */
  it("🔴 다섯 상태의 의미 조합이 전부 다르다 — 둘이 같아지면 칸만 늘어난 것이다", () => {
    const fingerprints = SHIPPING_POLICY_STATUSES.map((s) => {
      const m = SHIPPING_POLICY_MEANINGS[s];
      return `${m.amountRule}|${m.policyConfirmed}|${m.knowableFromProductPage}|${m.assertsFreeShipping}`;
    });
    expect(new Set(fingerprints).size).toBe(SHIPPING_POLICY_STATUSES.length);
  });

  /**
   * 🔴 CEO 증명 요구 그대로: "ORDER_TIME 과 UNREAD 가 둘 다 amount=null 이면서
   * «다른 값»이라는 것."
   */
  it("🔴 ORDER_TIME 과 UNREAD — 둘 다 금액이 null 인데 서로 다른 사실이다", () => {
    const orderTime = describeShippingPolicy("ORDER_TIME");
    const unread = describeShippingPolicy("UNREAD");

    // 금액 쪽에서는 구분되지 않는다. 그래서 금액 칸만으로는 부족했던 것이다.
    expect(orderTime.amountRule).toBe("MUST_BE_NULL");
    expect(unread.amountRule).toBe("MUST_BE_NULL");
    expect(shippingPolicyAllowsAmount("ORDER_TIME")).toBe(false);
    expect(shippingPolicyAllowsAmount("UNREAD")).toBe(false);

    // 🔴 그런데 «다음에 해야 할 일»이 정반대다.
    //    UNREAD  → 파서를 고치면 알 수 있다.
    //    ORDER_TIME → 상품 페이지에 값 자체가 없다. 고쳐도 안 나온다.
    expect(unread.knowableFromProductPage).toBe(true);
    expect(orderTime.knowableFromProductPage).toBe(false);
    expect(orderTime.knowableFromProductPage).not.toBe(unread.knowableFromProductPage);
    expect(orderTime.summary).not.toBe(unread.summary);
    expect(orderTime.status).not.toBe(unread.status);
  });

  /**
   * 🔴 CEO 증명 요구 그대로: "NULL 이 UNREAD 와 «다르다»는 것."
   * UNREAD 는 "읽어봤다"는 주장이다. 054 이전 행에 대해 우리는 그 주장을 할
   * 근거가 없다 — 그래서 backfill 하지 않았고, 코드도 둘을 섞지 않는다.
   */
  it("🔴 NULL 은 UNREAD 가 아니다 — «읽어본 적 없음»과 «읽었는데 못 찾음»", () => {
    const none = describeShippingPolicy(null);
    const unread = describeShippingPolicy("UNREAD");

    expect(none.hasStatusData).toBe(false);
    expect(unread.hasStatusData).toBe(true);
    expect(none.status).toBeNull();
    expect(unread.status).toBe("UNREAD");
    expect(none.summary).toBe(NO_SHIPPING_POLICY_DATA_SUMMARY);
    expect(none.summary).not.toBe(unread.summary);

    // 🔴 null 은 "고치면 알 수 있다"는 작업 지시도 내지 않는다 — 확인하러 간
    //    적조차 없으므로 그 주장 자체를 할 수 없다.
    expect(none.knowableFromProductPage).toBe(false);
    expect(unread.knowableFromProductPage).toBe(true);

    // undefined(컬럼이 아예 안 온 세션)도 null 과 같은 취급이다 — UNREAD 가 아니다.
    expect(describeShippingPolicy(undefined)).toEqual(none);
  });

  /**
   * 🔴 이 축(policyConfirmed)은 처음에 «없었다». 위의 지문 유일성 테스트가
   * 먼저 깨지면서(CONDITIONAL_FREE 와 UNREAD 의 지문이 같았다) 드러난 구멍이다.
   * 그때의 모델에서는 「조건부 무료라고 확인한 행」과 「못 찾은 행」이 시스템에
   * 같은 값이었다 — 정확히 CEO 가 말한 "칸만 늘어난 것"이다.
   */
  it("🔴 CONDITIONAL_FREE 와 UNREAD — 확인한 것과 못 찾은 것은 같은 값이 아니다", () => {
    const conditional = describeShippingPolicy("CONDITIONAL_FREE");
    const unread = describeShippingPolicy("UNREAD");

    // 세 축에서는 같다 — 그래서 축이 하나 더 필요했다.
    expect(conditional.amountRule).toBe(unread.amountRule);
    expect(conditional.knowableFromProductPage).toBe(unread.knowableFromProductPage);
    expect(conditional.assertsFreeShipping).toBe(unread.assertsFreeShipping);

    // 🔴 가르는 축.
    expect(conditional.policyConfirmed).toBe(true);
    expect(unread.policyConfirmed).toBe(false);
  });

  it("🔴 «확인했다»고 말하는 상태는 넷이고, UNREAD 와 null 은 그 넷에 없다", () => {
    const confirmed = SHIPPING_POLICY_STATUSES.filter((s) => SHIPPING_POLICY_MEANINGS[s].policyConfirmed);
    expect(confirmed).toEqual(["FREE", "FLAT", "CONDITIONAL_FREE", "ORDER_TIME"]);
    expect(describeShippingPolicy("UNREAD").policyConfirmed).toBe(false);
    expect(describeShippingPolicy(null).policyConfirmed).toBe(false);
    // null 과 UNREAD 는 이 축에서 같지만 hasStatusData 가 둘을 가른다.
    expect(describeShippingPolicy(null).hasStatusData).not.toBe(describeShippingPolicy("UNREAD").hasStatusData);
  });

  it("🔴 «무료다»를 주장하는 상태는 FREE 하나뿐이다 — 나머지 넷과 null 은 아니다", () => {
    const asserting = SHIPPING_POLICY_STATUSES.filter((s) => SHIPPING_POLICY_MEANINGS[s].assertsFreeShipping);
    expect(asserting).toEqual(["FREE"]);
    expect(describeShippingPolicy(null).assertsFreeShipping).toBe(false);
    // CONDITIONAL_FREE 는 이름에 FREE 가 들어 있지만 무료를 주장하지 «않는다».
    expect(describeShippingPolicy("CONDITIONAL_FREE").assertsFreeShipping).toBe(false);
  });

  it("여섯 갈래(null + 다섯)가 모두 서로 다른 설명을 낸다", () => {
    const all = [null, ...SHIPPING_POLICY_STATUSES].map((s) => JSON.stringify(describeShippingPolicy(s)));
    expect(new Set(all).size).toBe(6);
  });
});

/* ═══════ ② 금액을 채울 수 있는 것은 FREE · FLAT 둘뿐이다 ═══════ */

describe("DOMESTIC-SHIPPING-02 ②: amount 를 채울 수 있는 건 FREE·FLAT 뿐이다", () => {
  it("🔴 shippingPolicyAllowsAmount — FREE·FLAT 만 true, 나머지 셋과 null 은 false", () => {
    const allowed = SHIPPING_POLICY_STATUSES.filter((s) => shippingPolicyAllowsAmount(s));
    expect(allowed).toEqual(["FREE", "FLAT"]);
    expect(shippingPolicyAllowsAmount(null)).toBe(false);
    expect(shippingPolicyAllowsAmount(undefined)).toBe(false);
  });

  it("🔴 CONDITIONAL_FREE · ORDER_TIME · UNREAD 에 금액을 넣으면 거절된다", () => {
    for (const status of ["CONDITIONAL_FREE", "ORDER_TIME", "UNREAD"] as const) {
      for (const amount of [0, 2500, 3000]) {
        const r = resolveShippingPolicy({ status, amount });
        expect(r.ok, `${status}/${amount}`).toBe(false);
        if (!r.ok) expect(r.error).toContain(status);
      }
      // 금액 없이는 통과한다 — 그리고 통과한 값은 반드시 null 이다.
      const ok = resolveShippingPolicy({ status });
      expect(ok.ok).toBe(true);
      if (ok.ok) expect(ok.value.amount).toBeNull();
    }
  });

  it("🔴 상태 없이 금액만 저장할 수 없다 — 그 숫자가 무엇을 뜻하는지 말할 수 없다", () => {
    const r = resolveShippingPolicy({ amount: 0 });
    expect(r.ok).toBe(false);
    const r2 = resolveShippingPolicy({ status: null, amount: 3000 });
    expect(r2.ok).toBe(false);
  });

  it("FREE 는 0원이라는 주장 그 자체다 — 0 이 아닌 값은 거절된다", () => {
    const omitted = resolveShippingPolicy({ status: "FREE" });
    expect(omitted.ok).toBe(true);
    if (omitted.ok) expect(omitted.value.amount).toBe(0);

    const zero = resolveShippingPolicy({ status: "FREE", amount: 0 });
    expect(zero.ok).toBe(true);

    const wrong = resolveShippingPolicy({ status: "FREE", amount: 3000 });
    expect(wrong.ok).toBe(false);
  });

  it("FLAT 은 금액이 «반드시» 있어야 한다 — 모르면 FLAT 이 아니라 UNREAD 다", () => {
    const missing = resolveShippingPolicy({ status: "FLAT" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("UNREAD");

    const zero = resolveShippingPolicy({ status: "FLAT", amount: 0 });
    expect(zero.ok).toBe(false); // 0원이면 FLAT 이 아니라 FREE 다

    const ok = resolveShippingPolicy({ status: "FLAT", amount: 3000 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.amount).toBe(3000);
  });

  it("어휘 밖 문자열은 상태로 승격되지 않는다(코드 쪽 문 — DB CHECK 와 이중)", () => {
    for (const bad of ["MAYBE_FREE", "free", "FREE_SHIPPING", "", "0", "UNKNOWN"]) {
      expect(isShippingPolicyStatus(bad), bad).toBe(false);
      const r = resolveShippingPolicy({ status: bad as unknown as ShippingPolicyStatus });
      expect(r.ok, bad).toBe(false);
    }
    for (const good of SHIPPING_POLICY_STATUSES) expect(isShippingPolicyStatus(good)).toBe(true);
  });

  it("note 는 원문 그대로 보존되고, 공백뿐이면 «근거를 적었다»로 치지 않는다", () => {
    const raw = "50,000원 이상 구매 시 무료배송 (제주/도서산간 추가)";
    const r = resolveShippingPolicy({ status: "CONDITIONAL_FREE", note: raw });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.note).toBe(raw);
      expect(r.value.amount).toBeNull(); // 🔴 조건을 숫자 한 칸에 욱여넣지 않는다
    }
    for (const empty of ["", "   ", "\n\t"]) {
      const e = resolveShippingPolicy({ status: "UNREAD", note: empty });
      expect(e.ok).toBe(true);
      if (e.ok) expect(e.value.note).toBeNull();
    }
  });
});

/* ═══════ ③ 마이그레이션 파일 자체를 읽어 지킨다 ═══════ */

describe("DOMESTIC-SHIPPING-02 ③: 054 는 DEFAULT 도 backfill 도 갖지 않는다", () => {
  it("🔴 CHECK 어휘가 코드의 SHIPPING_POLICY_STATUSES 와 «글자 그대로» 같다", () => {
    const check = MIGRATION_SQL.match(/shipping_policy_status in \(([^)]*)\)/i);
    expect(check, "054 에서 CHECK 의 in (...) 목록을 찾지 못했다").not.toBeNull();
    const fromSql = check![1]!.split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
    expect(fromSql).toEqual([...SHIPPING_POLICY_STATUSES]);
  });

  it("🔴 두 컬럼에 DEFAULT 가 없다 — DEFAULT 'FREE'/0 은 없는 사실을 1,073건 만든다", () => {
    const ddl = MIGRATION_SQL.split("\n").filter(
      (l) => !l.trimStart().startsWith("--") && /alter table|add column/i.test(l),
    );
    expect(ddl.length).toBeGreaterThan(0);
    for (const line of ddl) expect(line.toLowerCase(), line).not.toContain("default");
    for (const line of ddl) expect(line.toLowerCase(), line).not.toContain("not null");
  });

  it("🔴 기존 행을 건드리는 구문이 한 줄도 없다 — update · delete · backfill 금지", () => {
    const executable = MIGRATION_SQL.split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .toLowerCase();
    expect(executable).not.toMatch(/\bupdate\s+price_observations\b/);
    expect(executable).not.toMatch(/\bdelete\s+from\b/);
    expect(executable).not.toMatch(/\binsert\s+into\b/);
    expect(executable).not.toMatch(/\bdrop\s+column\b/); // 롤백은 주석 안에만 있다
  });

  it("관례 유지 — add column if not exists · NOTIFY pgrst (027/031 중복 실행 전례)", () => {
    expect(MIGRATION_SQL).toMatch(/add column if not exists shipping_policy_status text/i);
    expect(MIGRATION_SQL).toMatch(/add column if not exists shipping_policy_note text/i);
    expect(MIGRATION_SQL).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it("🔴 새 «금액» 컬럼을 만들지 않았다 — shipping_cost_amount 는 027 에 이미 있다", () => {
    const executable = MIGRATION_SQL.split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .toLowerCase();
    expect(executable).not.toContain("shipping_cost_amount");
    expect(executable).not.toContain("free_threshold");
    expect(executable).not.toContain("create table");
  });
});

/* ═══════ ④ 이번 단계가 «건드리지 않은 것» ═══════ */

describe("DOMESTIC-SHIPPING-02 ④: 가격 판정은 한 점도 움직이지 않았다", () => {
  /**
   * 🔴 CEO 완료 기준의 네 숫자. shipping-policy-01.test.ts 가 이미 고정하고
   * 있지만, 배송비 «상태»가 생긴 이 커밋에서도 같은 값인지 여기서 다시 잰다 —
   * 배송비를 만진 작업이 아동의류를 움직였는지 확인할 자리는 이 파일이다.
   */
  it("🔴 Kids 회귀 — Bobo Choses €75 → ₩111,000 · ₩12,000 · ₩123,000 · ₩175,714", () => {
    const b = computePriceBreakdown({
      originalAmount: 75,
      originalCurrency: "EUR",
      ...DEFAULT_PRICE_BREAKDOWN_INPUT,
    });
    expect(b.costKrw).toBe(111000);
    expect(b.landedCostKrw - b.costKrw).toBe(12000);
    expect(b.landedCostKrw).toBe(123000);
    expect(b.suggestedPriceKrw).toBe(175714);
  });

  it("배송비 상태는 계산기에 들어갈 «칸 자체»가 없다 — 2단계 전까지 새지 않는다", () => {
    const b = computePriceBreakdown({
      originalAmount: 75,
      originalCurrency: "EUR",
      ...DEFAULT_PRICE_BREAKDOWN_INPUT,
    });
    expect(Object.keys(b)).not.toContain("shippingPolicyStatus");
    expect(Object.keys(b)).not.toContain("shippingPolicyNote");
  });

  /**
   * 역방향 증명(45885bf 가 세운 방식 그대로) — 이 파일이 자기 소스를 읽어
   * "모르는 배송비를 상수로 메우는" 표현이 다시 들어오는지 본다. 동작만 재면
   * 부족하다: `?? 0` 이 들어와도 이 단계의 결론(계산에 안 쓴다)은 그대로라
   * 아무도 눈치채지 못한다.
   */
  it("🔴 역방향 — 배송비 null 을 상수로 메우는 표현이 shipping-policy.ts 에 없다", () => {
    const source = readFileSync(path.resolve(HERE, "../shipping-policy.ts"), "utf8");
    const code = source
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//") && !l.trimStart().startsWith("/*"))
      .join("\n");
    const offenders = [
      ...code.matchAll(/(amount|shippingCostAmount|shipping_cost_amount)\s*\?\?\s*(0|12000|19800)\b/g),
    ].map((m) => m[0]);
    expect(offenders).toEqual([]);
  });
});
