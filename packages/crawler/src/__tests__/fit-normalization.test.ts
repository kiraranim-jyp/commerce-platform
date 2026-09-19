import { describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import { compareCrossSellerProducts } from "../comparison-search/cross-seller";
import { productFactsFromShopifyProduct } from "../comparison-search/seller-facts";

/**
 * FIT 축 정책 — 두 단계가 함께 산다.
 *
 *  P0-A.17  `oversize fit` ↔ `oversized fit`  «항상» 같은 값 (표기 변형)
 *  P0-A.19  `loose fit`    ↔ `relaxed fit`    «R1 조건에서만» 같은 값
 *             = 브랜드 확인 + 품번 완전일치 + 교차판매처
 *
 * 🔴 이 파일이 재는 것의 절반은 «접히는가» 이고, 나머지 절반은 «접히지 않는가» 다.
 *    후자가 더 중요하다 — R1 은 예외 규칙이고, 예외가 새면 그게 곧 거짓 동일상품이다.
 */

interface Opts {
  fit: string;
  /** 품번은 handle 앞부분에서 나온다 — 다르면 compareModelCode 가 exact 를 못 낸다. */
  code?: string;
  brand?: string;
  title?: string;
  domain?: string;
}

function product({ fit, code = "b226ac010", brand = "Bobo Choses", title = "Booty Ghosts T-shirt", domain = "bobochoses.com" }: Opts): ProductFacts {
  return productFactsFromShopifyProduct(
    {
      title,
      handle: `${code}-booty-ghosts-t-shirt`,
      url: `/products/${code}-booty-ghosts-t-shirt`,
      body: `Heather grey t-shirt. Organic Cotton 100%. ${fit}. Responsibly made in Portugal.`,
      vendor: brand,
      type: "T-shirts",
      tags: "children, clothing, t-shirts",
    },
    domain,
  );
}

function verdictOf(left: Opts, right: Opts) {
  return compareCrossSellerProducts(
    product({ ...left, domain: left.domain ?? "bobochoses.com" }),
    product({ ...right, domain: right.domain ?? "junioredition.com" }),
  );
}

function fitResult(left: Opts, right: Opts): { blocked: boolean; axis: boolean; detail: string } {
  const m = verdictOf(left, right);
  const axis = m.axes.find((a) => a.axis === "FIT");
  const blocker = m.blockers.find((b) => b.blocker === "FIT");
  return { blocked: Boolean(blocker), axis: Boolean(axis), detail: axis?.detail ?? blocker?.detail ?? "(핏 축 없음)" };
}

/* ── P0-A.17 — 표기 변형은 조건 없이 접힌다 ──────────────────────────────── */

describe("P0-A.17 — oversize ↔ oversized 는 «항상» 같다", () => {
  it("R1 조건이 성립할 때", () => {
    expect(fitResult({ fit: "An oversize fit" }, { fit: "An oversized fit" }).blocked).toBe(false);
  });

  it("🔴 품번이 달라 R1 이 «안» 열려도 접힌다 — 이건 표기 변형이라 조건이 필요 없다", () => {
    expect(fitResult({ fit: "An oversize fit" }, { fit: "An oversized fit", code: "b226ac999" }).blocked).toBe(false);
  });

  it("원문 두 표현을 근거에 남긴다", () => {
    const r = fitResult({ fit: "An oversize fit" }, { fit: "An oversized fit" });
    expect(r.detail).toContain("oversize fit");
    expect(r.detail).toContain("oversized fit");
  });
});

/* ── P0-A.19 R1 — loose ↔ relaxed 는 «조건부» ──────────────────────────── */

describe("P0-A.19 R1 — loose ↔ relaxed 는 «세 조건이 모두» 성립할 때만 같다", () => {
  it("브랜드 확인 + 품번 완전일치 + 교차판매처 → 보류 없음", () => {
    const r = fitResult({ fit: "A loose fit" }, { fit: "A relaxed fit" });
    expect(r.blocked, "R1 조건이 다 맞는데 여전히 보류가 났다").toBe(false);
    expect(r.axis).toBe(true);
  });

  it("근거 문장에 «왜» 접었는지 남긴다 — 원문 두 표현과 조건을 함께", () => {
    const r = fitResult({ fit: "A loose fit" }, { fit: "A relaxed fit" });
    expect(r.detail).toContain("loose fit");
    expect(r.detail).toContain("relaxed fit");
    expect(r.detail).toContain("품번 완전일치");
  });

  it("양방향으로 같다", () => {
    expect(fitResult({ fit: "A relaxed fit" }, { fit: "A loose fit" }).blocked).toBe(false);
  });
});

describe("🔴 R1 이 «열리지 않는» 자리 — 여기가 새면 거짓 동일상품이 된다", () => {
  /* 🔴 여기서는 «FIT 보류가 있는가»가 아니라 «SAME 이 되지 않는가»를 잰다.
     품번/브랜드가 어긋나면 판정기가 그 자리에서 CONFLICT 로 끝내고 축을 아예
     계산하지 않는다(cross-seller.ts — 충돌이 있으면 점수를 보지도 않는다).
     그때 FIT 보류가 «없는» 것은 R1 이 샌 것이 아니라 더 강한 차단이 먼저 걸린
     것이다 — 보류 유무로 재면 그 구분을 놓친다. */

  it("품번이 다르면 → SAME 이 되지 않는다 (MODEL_CODE 충돌)", () => {
    const m = verdictOf({ fit: "A loose fit" }, { fit: "A relaxed fit", code: "b226ac999" });
    expect(m.verdict, "🔴 품번이 다른데 SAME 이 됐다").not.toBe("SAME");
    expect(m.conflicts.map((c) => c.conflict)).toContain("MODEL_CODE");
  });

  it("브랜드가 다르면 → SAME 이 되지 않는다 (P0-A.29-A 이후 «보류»)", () => {
    /* P0-A.29-A 에서 BRAND 를 충돌에서 보류로 내렸다(오탐 35 : 유용 43 이었다).
       그래서 여기서 재는 것이 바뀐다 — 「충돌 목록에 BRAND 가 있는가」가 아니라
       «SAME 이 되지 않는가» 다. 보류는 SAME 승격을 여전히 막고, 대신 Vision 이
       볼 기회는 남긴다(conflicts 가 비어야 Vision 후보가 된다). */
    const m = verdictOf({ fit: "A loose fit" }, { fit: "A relaxed fit", brand: "Mini Rodini" });
    expect(m.verdict, "🔴 브랜드가 다른데 SAME 이 됐다").not.toBe("SAME");
    expect(m.blockers.map((b) => b.blocker)).toContain("BRAND_MISMATCH");
    expect(m.conflicts.map((c) => String(c.conflict)), "브랜드 불일치는 더 이상 «충돌» 이 아니다").not.toContain("BRAND");
  });

  it("🔴 한쪽 브랜드를 «확인하지 못했으면» → 핏 보류가 그대로 남는다", () => {
    /* 브랜드가 «서로 달라서» 충돌하는 경우와 다르다. 한쪽이 비어 있으면 충돌이
       아니라 BRAND_UNCONFIRMED «보류» 라 축 계산이 그대로 돌고, 여기서 brandOk
       조건이 없으면 R1 이 열려 버린다 — R1 의 brandOk 조건이 실제로 일하는 자리다.
       (역증명: 호출부에서 brandOk 를 빼면 이 테스트만 빨개진다) */
    const r = fitResult({ fit: "A loose fit" }, { fit: "A relaxed fit", brand: "" });
    expect(r.blocked, "🔴 브랜드를 확인 못 했는데 핏 보류가 사라졌다 — R1 이 샜다").toBe(true);
  });

  it("🔴 품번 근거가 «없으면» → 핏 보류가 그대로 남는다 (R1 의 핵심 가드)", () => {
    // handle 에 품번 형식이 없으면 brandModelCode 가 null → compareModelCode 는
    // unavailable. 충돌이 아니므로 축 계산이 그대로 돌고, 여기서 R1 이 열리면 안 된다.
    const r = fitResult({ fit: "A loose fit", code: "plain-tee" }, { fit: "A relaxed fit", code: "plain-tee" });
    expect(r.blocked, "🔴 품번 근거가 없는데 핏 보류가 사라졌다 — R1 이 샜다").toBe(true);
    const m = verdictOf({ fit: "A loose fit", code: "plain-tee" }, { fit: "A relaxed fit", code: "plain-tee" });
    expect(m.verdict).not.toBe("SAME");
  });
});

describe("🔴 R1 은 loose ↔ relaxed 에만 열린다 — 뜻이 다른 조합은 그대로", () => {
  const stillBlocked: [string, string][] = [
    ["It fits true to size", "An oversized fit"],
    ["It fits true to size", "A loose fit"],
    ["It fits true to size", "A slim fit"],
    ["A slim fit", "A loose fit"],
    ["A regular fit", "A relaxed fit"],
    ["A slim fit", "A regular fit"],
    ["An oversized fit", "A loose fit"],
    ["An oversize fit", "A relaxed fit"],
  ];
  for (const [a, b] of stillBlocked) {
    it(`${a} ↔ ${b} → R1 조건이 맞아도 보류 유지`, () => {
      expect(fitResult({ fit: a }, { fit: b }).blocked, `🔴 ${a} 와 ${b} 가 접혔다 — 승인 범위를 넘었다`).toBe(true);
    });
  }
});

describe("기존 동작 회귀", () => {
  for (const phrase of ["A loose fit", "A relaxed fit", "A slim fit", "A regular fit", "It fits true to size"]) {
    it(`${phrase} 끼리는 일치하고 축이 붙는다`, () => {
      const r = fitResult({ fit: phrase }, { fit: phrase });
      expect(r.blocked).toBe(false);
      expect(r.axis).toBe(true);
    });
  }

  it("한쪽에 핏 문구가 없으면 «모른다» — 축도 보류도 없다", () => {
    const r = fitResult({ fit: "An oversized fit" }, { fit: "Made in Portugal" });
    expect(r.blocked).toBe(false);
    expect(r.axis).toBe(false);
  });
});
