import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoupangEdits, type CoupangRegisteredProduct } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-WIRE-01 Phase 3 — **CREATE ≠ UPDATE, 그리고 Master 는 전문이 아니다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일이 지키는 셋:
 *   ① UPDATE 경로에 `buildCoupangPayload` 가 «없다» — 구조로 없다.
 *   ② 상품명 하나를 고치려고 나머지 27칸을 다시 계산하지 않는다.
 *   ③ 열린 축은 상품명 하나다 — capability 가 닫은 축은 서버도 거부한다.
 */

const hoisted = vi.hoisted(() => ({
  baseline: null as CoupangRegisteredProduct | null,
  fetchOk: true,
  fetchMessage: "쿠팡 서버에 연결할 수 없습니다.",
  /** 🔴 실제로 PUT 까지 갔는지 «세어» 본다. 「막혔다」를 말로만 믿지 않는다. */
  updateCalls: [] as { sellerProductId: string; edits: unknown }[],
  fetchCalls: [] as string[],
}));

vi.mock("../_lib/update-product", () => ({
  fetchCoupangBaseline: async (_c: unknown, sellerProductId: string) => {
    hoisted.fetchCalls.push(sellerProductId);
    return hoisted.fetchOk
      ? { ok: true as const, baseline: hoisted.baseline }
      : { ok: false as const, message: hoisted.fetchMessage };
  },
  updateCoupangProduct: async (
    _c: unknown,
    sellerProductId: string,
    edits: unknown,
  ) => {
    hoisted.updateCalls.push({ sellerProductId, edits });
    return { ok: true as const, sellerProductId };
  },
}));

const { executeCoupangUpdate } = await import("../_lib/update-execution");

/** 실측 모양을 줄여서 옮긴 baseline — 공식 필드 + 쿠팡이 «덧붙인» 칸들. */
function baselineFixture(): CoupangRegisteredProduct {
  return {
    sellerProductId: 16394846257,
    status: "SAVED",
    statusName: "임시저장",
    sellerProductName: "등록 당시 상품명",
    displayProductName: "등록 당시 노출명",
    displayCategoryCode: 80126,
    /* 🔴 쿠팡이 관리하는 칸 — 빌더가 만들지 못한다. 그래서 baseline 이 날라야 한다. */
    mdId: "md-001",
    productOrigin: null,
    exchangeType: "RETURN",
    certifications: [{ certificationType: "NOT_REQUIRED", certificationCode: "" }],
    items: [
      {
        sellerProductItemId: 111,
        vendorItemId: 222,
        itemName: "블루/90",
        salePrice: 10000,
        maximumBuyCount: 7,
        certifications: [{ certificationType: "NOT_REQUIRED" }],
      },
      {
        sellerProductItemId: 333,
        vendorItemId: 444,
        itemName: "블루/100",
        salePrice: 11000,
        maximumBuyCount: 5,
        certifications: [],
      },
    ],
  };
}

const CREDENTIALS = { accessKey: "a", secretKey: "b", vendorId: "A00000000" } as never;

beforeEach(() => {
  hoisted.baseline = baselineFixture();
  hoisted.fetchOk = true;
  hoisted.updateCalls = [];
  hoisted.fetchCalls = [];
});

/* ════════════════════════════════════════════════════════════════════════════
   ① 구조 — UPDATE 경로에 CREATE 빌더가 «없다»
   ════════════════════════════════════════════════════════════════════════════ */

const API_DIR = join(__dirname, "..");
function codeOnly(source: string): string {
  /* 🔴 주석을 벗기고 센다 — 이 저장소가 여덟 번 걸린 함정이다. 주석에 이름이
     적혀 있다고 「호출한다」가 되지도, 「안 한다」가 되지도 않는다. */
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("① 🔴 CREATE ≠ UPDATE — 빌더는 UPDATE 경로에 없다", () => {
  it("실행부(update-execution)에 buildCoupangPayload 가 없다", () => {
    const source = codeOnly(readFileSync(join(API_DIR, "_lib/update-execution.ts"), "utf8"));
    expect(source).not.toContain("buildCoupangPayload");
    expect(source).not.toContain("CoupangPayload");
  });

  it("전송부(update-product)에도 없다 — 전문은 GET 에서만 나온다", () => {
    const source = codeOnly(readFileSync(join(API_DIR, "_lib/update-product.ts"), "utf8"));
    expect(source).not.toContain("buildCoupangPayload");
  });

  it("🔴 register 라우트에서 UPDATE 분기가 buildCoupangPayload «보다 앞» 이다", () => {
    const source = codeOnly(readFileSync(join(API_DIR, "register/route.ts"), "utf8"));
    const branch = source.indexOf("executeCoupangUpdate({");
    const builder = source.indexOf("buildCoupangPayload(");
    expect(branch, "UPDATE 분기가 없다").toBeGreaterThan(-1);
    expect(builder, "CREATE 빌더가 없다").toBeGreaterThan(-1);
    /* 🔴 순서가 곧 안전장치다. 빌더 «뒤» 로 내려가면 UPDATE 요청도 CREATE payload
       를 조립하게 되고, 그 다음 누군가 그것을 PUT 한다. */
    expect(branch).toBeLessThan(builder);
  });

  it("🔴 어댑터의 Outgoing 은 baseline 이지 빌더 산출물이 아니다", () => {
    const adapter = codeOnly(
      readFileSync(join(API_DIR, "../../pipeline/commerce/edit-adapters/coupang.ts"), "utf8"),
    );
    /* 🔴 `CommerceEditAdapter<Registered, Outgoing>` 의 «두 인자가 같다».
       Outgoing 이 baseline 모양이라는 뜻이고, 빌더 산출물(`CoupangPayload`)을
       넣으려 하면 타입에서 걸린다 — 형식이 아니라 «의미» 로 센다. */
    const generics = adapter.match(
      /CommerceEditAdapter<\s*([A-Za-z]+)\s*,\s*([A-Za-z]+)\s*>/,
    );
    expect(generics, "어댑터가 CommerceEditAdapter 계약을 쓰지 않는다").toBeTruthy();
    expect(generics?.[1]).toBe("CoupangRegisteredProduct");
    expect(generics?.[2]).toBe("CoupangRegisteredProduct");
    expect(adapter).not.toContain("buildCoupangPayload");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ② Master leakage — 상품명 하나를 위해 27칸을 다시 계산하지 않는다
   ════════════════════════════════════════════════════════════════════════════ */

describe("② 🔴 Master 는 «변경값의 출처» 이지 «전문의 출처» 가 아니다", () => {
  it("상품명만 바뀌고 나머지는 baseline 그대로다", () => {
    const baseline = baselineFixture();
    const outgoing = applyCoupangEdits(baseline, { name: "새 상품명" });

    expect(outgoing.sellerProductName).toBe("새 상품명");
    /* 쿠팡은 노출명을 따로 들고 있다 — 한쪽만 바꾸면 셀러센터에 옛 이름이 남는다. */
    expect(outgoing.displayProductName).toBe("새 상품명");

    /* 🔴 나머지 «전부» 가 baseline 과 같다. 한 칸이라도 빌더가 손대면 여기서 깨진다. */
    const { sellerProductName: _a, displayProductName: _b, ...restOut } = outgoing;
    const { sellerProductName: _c, displayProductName: _d, ...restBase } = baseline;
    expect(restOut).toEqual(restBase);
  });

  it("🔴 items 와 sellerProductItemId 가 «개수도 순서도» 그대로다", () => {
    const baseline = baselineFixture();
    const outgoing = applyCoupangEdits(baseline, { name: "새 상품명" });
    expect(outgoing.items).toHaveLength(2);
    expect(outgoing.items?.map((i) => i.sellerProductItemId)).toEqual([111, 333]);
    /* 배열에서 빠지면 쿠팡은 그 옵션을 «삭제» 한다(공식). */
    expect(outgoing.items).toEqual(baseline.items);
  });

  it("🔴 certifications 를 «만들지도 줄이지도» 않는다", () => {
    const baseline = baselineFixture();
    const outgoing = applyCoupangEdits(baseline, { name: "새 상품명" });
    expect(outgoing.certifications).toEqual(baseline.certifications);
    expect(outgoing.items?.[0]?.certifications).toEqual(baseline.items?.[0]?.certifications);
    expect(outgoing.items?.[1]?.certifications).toEqual([]);
  });

  it("🔴 쿠팡이 «덧붙인» 칸(mdId·exchangeType·productOrigin)이 살아 있다", () => {
    const outgoing = applyCoupangEdits(baselineFixture(), { name: "새 상품명" });
    expect(outgoing.mdId).toBe("md-001");
    expect(outgoing.exchangeType).toBe("RETURN");
    expect("productOrigin" in outgoing).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ③ 실행 게이트 — 하나라도 어긋나면 PUT 하지 않는다
   ════════════════════════════════════════════════════════════════════════════ */

describe("③ 🔴 UPDATE 안전 순서 — 막히면 «보내지 않는다»", () => {
  it("연결이 없으면 NOT_LINKED — GET 도 PUT 도 0회", async () => {
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: null,
      editedFields: ["name"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("NOT_LINKED");
    expect(hoisted.fetchCalls).toHaveLength(0);
    expect(hoisted.updateCalls).toHaveLength(0);
  });

  it("🔴 화면이 보던 번호와 다르면 PRODUCT_MISMATCH — GET 조차 하지 않는다", async () => {
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      expectedExternalProductId: "99999999999",
      editedFields: ["name"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("PRODUCT_MISMATCH");
    expect(hoisted.fetchCalls).toHaveLength(0);
    expect(hoisted.updateCalls).toHaveLength(0);
  });

  it("GET 이 실패하면 FETCH — baseline 없이 전체 교체를 보내지 않는다", async () => {
    hoisted.fetchOk = false;
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      editedFields: ["name"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("FETCH");
    expect(hoisted.updateCalls).toHaveLength(0);
  });

  it("🔴 승인이 진행된 상품이면 STATUS — 확인한 범위 밖이다", async () => {
    hoisted.baseline = { ...baselineFixture(), status: "APPROVED" };
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      editedFields: ["name"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure).toBe("STATUS");
      /* 「안 됩니다」가 아니라 「확인되지 않았습니다」로 말한다. */
      expect(r.message).toContain("확인되지 않았습니다");
    }
    expect(hoisted.updateCalls).toHaveLength(0);
  });

  it("상태를 읽지 못하면 STATUS — 모르면 막는다", async () => {
    hoisted.baseline = { ...baselineFixture(), status: null };
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      editedFields: ["name"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("STATUS");
    expect(hoisted.updateCalls).toHaveLength(0);
  });

  it("🔴 불러왔지만 고친 것이 없으면 «보내지 않는다» — CREATE 로도 흐르지 않는다", async () => {
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      editedFields: [],
      title: "등록 당시 상품명",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("NO_EDITABLE_CHANGE");
    expect(hoisted.updateCalls).toHaveLength(0);
  });

  it("🔴 capability 가 닫은 축만 고쳤으면 서버도 거부한다", async () => {
    /* 화면이 UNKNOWN 으로 그리는 축이라 여기 올 수 없지만, 와도 막힌다 —
       화면과 서버가 «같은 표» 를 본다는 것이 요점이다. */
    for (const field of ["detailContent", "images", "options", "providedNotice", "salePrice", "stockQuantity"]) {
      const r = await executeCoupangUpdate({
        credentials: CREDENTIALS,
        sellerProductId: "16394846257",
        editedFields: [field],
        title: "새 상품명",
      });
      expect(r.ok, `${field} 가 통과했다`).toBe(false);
      if (!r.ok) expect(r.failure).toBe("NO_EDITABLE_CHANGE");
    }
    expect(hoisted.updateCalls).toHaveLength(0);
  });

  it("모르는 이름이 와도 조용히 통과하지 않는다", async () => {
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      editedFields: ["nam", "sellerProductName", "__proto__"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("NO_EDITABLE_CHANGE");
    expect(hoisted.updateCalls).toHaveLength(0);
  });
});

describe("④ 🔴 통과하는 경우 — 상품명 하나만, 값은 Master 에서", () => {
  it("SAVED × name 이면 PUT 한 번, edits 는 상품명 하나뿐이다", async () => {
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      expectedExternalProductId: "16394846257",
      editedFields: ["name"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sellerProductId).toBe("16394846257");
      expect(r.changed).toEqual(["name"]);
    }
    expect(hoisted.fetchCalls).toEqual(["16394846257"]);
    expect(hoisted.updateCalls).toHaveLength(1);
    /* 🔴 서버로 가는 edits 에 «상품명 말고는 아무것도» 없다. */
    expect(hoisted.updateCalls[0]?.edits).toEqual({ name: "새 상품명" });
  });

  it("🔴 UNKNOWN 축이 섞여 와도 상품명만 남는다", async () => {
    const r = await executeCoupangUpdate({
      credentials: CREDENTIALS,
      sellerProductId: "16394846257",
      editedFields: ["name", "salePrice", "detailContent", "images"],
      title: "새 상품명",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.changed).toEqual(["name"]);
    expect(hoisted.updateCalls[0]?.edits).toEqual({ name: "새 상품명" });
  });
});
