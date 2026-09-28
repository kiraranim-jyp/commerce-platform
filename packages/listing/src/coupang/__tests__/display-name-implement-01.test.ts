import { describe, expect, it } from "vitest";
import {
  COUPANG_INTENTIONAL_OMISSIONS,
  applyCoupangEdits,
  type CoupangRegisteredProduct,
} from "../registered-baseline";
import { detectCoupangUpdateLoss } from "../update-preflight";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-DISPLAY-NAME-IMPLEMENT-01 — **노출명은 쿠팡이 만든다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production 실측으로 확정된 계약(docs/COUPANG-DISPLAY-NAME-0{2,3}.md):
 *
 *     displayProductName = brand + " " + normalize(generalProductName)
 *     키를 «보내지 않으면» 쿠팡이 다시 만든다
 *     그 입력은 sellerProductName 이 «아니라» generalProductName 이다
 *
 * 그래서 상품명을 고칠 때 우리가 하는 일은 셋이다 —
 * seller 를 바꾸고, general 을 «같이» 바꾸고, display 를 **뺀다.**
 *
 * 🔴 이 파일이 지키는 것은 「빼는 칸이 하나뿐」이라는 사실이다. 목록이 넓어지는
 * 순간 그것은 「그 값을 지워도 좋다」는 선언이 되고, 전체 교체에서 그 선언은
 * 곧 실제 삭제다.
 */

function baseline(): CoupangRegisteredProduct {
  return {
    sellerProductId: 16394846257,
    status: "SAVED",
    brand: "main story",
    brandId: "KR-885022",
    sellerProductName: "Bubble Sweatshirt in Grey Melange by Main Story",
    generalProductName: "Bubble Sweatshirt in Grey Melange by Main Story",
    displayProductName: "main story Bubble Sweatshirt in Grey Melange by Main Story",
    displayCategoryCode: 85551,
    mdId: "md-001",
    exchangeType: "RETURN",
    items: [
      {
        sellerProductItemId: 38554512389,
        itemName: "Bubble Sweatshirt - 2 Years",
        salePrice: 147900,
        maximumBuyCount: 1,
        certifications: [],
      },
    ],
  };
}

const NEW_NAME = "고친 상품명";

/* ════════════════════════════════════════════════════════════════════════════
   ① Positive — 세 칸 계약
   ════════════════════════════════════════════════════════════════════════════ */

describe("① 🔴 상품명 수정 = seller 변경 · general 변경 · display 제거", () => {
  it("sellerProductName 과 generalProductName 이 «같은 새 이름» 이 된다", () => {
    const out = applyCoupangEdits(baseline(), { name: NEW_NAME });
    expect(out.sellerProductName).toBe(NEW_NAME);
    expect(out.generalProductName).toBe(NEW_NAME);
  });

  it("🔴 displayProductName 키가 «사라진다» — 값이 비는 것이 아니다", () => {
    const out = applyCoupangEdits(baseline(), { name: NEW_NAME });
    /* 🔴 `undefined` 로 두면 JSON 직렬화에서 빠지긴 하지만, 「키가 없다」와
       「키가 undefined 다」를 코드가 구분하지 못하게 된다. 지운다. */
    expect("displayProductName" in out).toBe(false);
  });

  it("🔴 우리가 노출명을 «만들지 않는다» — 어떤 형태로도 나가지 않는다", () => {
    const out = applyCoupangEdits(baseline(), { name: NEW_NAME });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("displayProductName");
    /* 브랜드를 앞에 붙인 문자열이 어디에도 생기지 않았다 — 합성하지 않았다는 뜻. */
    expect(serialized).not.toContain(`main story ${NEW_NAME}`);
  });

  it("손실 게이트를 통과한다 — 이 한 칸은 의도된 부재다", () => {
    const base = baseline();
    const out = applyCoupangEdits(base, { name: NEW_NAME });
    expect(detectCoupangUpdateLoss(base, out)).toEqual([]);
  });

  it("🔴 나머지 baseline 은 그대로다 — 이름 세 칸 말고는 손대지 않는다", () => {
    const base = baseline();
    const out = applyCoupangEdits(base, { name: NEW_NAME });
    const strip = (p: CoupangRegisteredProduct) => {
      const c = { ...p };
      delete c.sellerProductName;
      delete c.generalProductName;
      delete c.displayProductName;
      return c;
    };
    expect(strip(out)).toEqual(strip(base));
    expect(out.brand).toBe("main story");
    expect(out.brandId).toBe("KR-885022");
    expect(out.items).toEqual(base.items);
  });

  it("상품명을 고치지 «않으면» 노출명도 건드리지 않는다", () => {
    const base = baseline();
    const out = applyCoupangEdits(base, { items: {} });
    expect("displayProductName" in out).toBe(true);
    expect(out.displayProductName).toBe(base.displayProductName);
    expect(out.generalProductName).toBe(base.generalProductName);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ② Negative — 예외는 그 «한 칸» 에만 열린다
   ════════════════════════════════════════════════════════════════════════════ */

describe("② 🔴 다른 칸이 빠지면 여전히 막힌다", () => {
  it.each(["brand", "brandId", "displayCategoryCode", "mdId", "exchangeType", "generalProductName"])(
    "%s 하나가 빠지면 BLOCK",
    (field) => {
      const base = baseline();
      const out = applyCoupangEdits(base, { name: NEW_NAME });
      delete out[field];
      const risks = detectCoupangUpdateLoss(base, out);
      expect(risks.map((r) => r.field)).toContain(field);
    },
  );

  it("🔴 displayProductName «과 함께» 다른 칸이 빠져도 그 다른 칸은 잡힌다", () => {
    const base = baseline();
    const out = applyCoupangEdits(base, { name: NEW_NAME }); // display 는 이미 빠져 있다
    delete out.brand;
    const risks = detectCoupangUpdateLoss(base, out);
    expect(risks.map((r) => r.field)).toEqual(["brand"]);
    /* 🔴 「하나는 봐줬으니 하나 더」가 되지 않는다. */
    expect(risks.map((r) => r.field)).not.toContain("displayProductName");
  });

  it("items 와 sellerProductItemId 보호는 그대로다", () => {
    const base = baseline();
    const out = applyCoupangEdits(base, { name: NEW_NAME });
    out.items = [];
    expect(detectCoupangUpdateLoss(base, out).map((r) => r.field)).toContain("items");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ③ Mutation — 목록을 넓히면 «깨져야» 한다
   ════════════════════════════════════════════════════════════════════════════ */

describe("③ 🔴 의도적 부재 목록은 한 칸으로 못 박혀 있다", () => {
  it("내용이 정확히 displayProductName 하나다", () => {
    expect([...COUPANG_INTENTIONAL_OMISSIONS]).toEqual(["displayProductName"]);
  });

  it("🔴 길이가 1이다 — 한 칸이라도 늘면 여기서 깨진다", () => {
    expect(COUPANG_INTENTIONAL_OMISSIONS).toHaveLength(1);
  });

  /* 🔴 목록에 `brand` 를 더하는 변이를 넣으면 «이 테스트» 가 잡는다.
     위 두 테스트는 목록 자체를, 이 테스트는 «동작» 을 잡는다 — 둘 다 있어야
     「상수만 고치고 동작은 그대로」도 「동작만 고치고 상수는 그대로」도 막힌다. */
  it("🔴 brand 를 목록에 넣더라도 brand 소실은 여전히 BLOCK 이어야 한다", () => {
    const base = baseline();
    const out = applyCoupangEdits(base, { name: NEW_NAME });
    delete out.brand;
    expect(
      detectCoupangUpdateLoss(base, out).map((r) => r.field),
      "brand 가 의도적 부재 목록에 들어갔다 — 전체 교체에서 그것은 브랜드를 지운다",
    ).toContain("brand");
  });

  it("🔴 목록이 비면 지금 계약이 깨진다 — 정상 수정이 BLOCK 된다", () => {
    const base = baseline();
    const out = applyCoupangEdits(base, { name: NEW_NAME });
    /* 목록이 비어 있었다면 display 부재가 MISSING 으로 잡혔을 것이다.
       지금은 통과해야 한다 — 그 사실을 여기서 한 번 더 고정한다. */
    expect(detectCoupangUpdateLoss(base, out)).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ④ 🔴 normalize() 를 구현하지 않았다
   ════════════════════════════════════════════════════════════════════════════ */

describe("④ 🔴 노출명 생성 책임을 가져오지 않는다", () => {
  it("소스에 정규화 규칙이 없다 — \" - \" 치환 같은 것을 만들지 않았다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(__dirname, "..", "registered-baseline.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    /* 🔴 쿠팡이 한 정규화(pepe 의 " - " 축약)를 흉내 내는 코드가 없어야 한다. */
    expect(source).not.toContain('replace(" - "');
    expect(source).not.toMatch(/replace\(\/\s*-\s*\//);
    /* ══════════════════════════════════════════════════════════════════════
       🔴 «우리가 그 칸에 값을 넣지 않는다» 가 진짜 불변조건이다.

       처음에는 `brand + "…"` 같은 문자열 결합만 찾았는데, 템플릿 리터럴로
       합성하는 변이를 «놓쳤다»(음성 대조에서 드러났다). 합성 «방법» 을 열거하면
       빠뜨린 방법이 통과한다 — 그래서 방법이 아니라 «결과» 를 센다:
       이 파일은 `displayProductName` 에 **대입하지 않는다.**
       (`delete next.displayProductName` 는 대입이 아니라 제거다.) */
    expect(source).not.toMatch(/displayProductName\s*=[^=]/);
  });
});
