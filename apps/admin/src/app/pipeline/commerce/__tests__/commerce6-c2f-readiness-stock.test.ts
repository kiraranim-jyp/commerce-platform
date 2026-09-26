import { describe, expect, it } from "vitest";
import { buildLotteOnMissingInfo, lotteOnFixLocationToMissingKind } from "../lotteon-channel-form";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2F — **Readiness 오류 세 가지만 본다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   A 실제 필수인데 READY                     → C-2D/E 에서 재고로 고쳤다
 *   B 선택인데 BLOCKED                         → UNKNOWN 이 막지 않는지 본다
 *   C 셀러가 해결할 수 «없는» 내부 사실을
 *     「여기서 입력하세요」로 안내             → 이번에 찾은 것
 *
 * 🔴 C 가 실제로 있었다. C-2E 가 롯데ON 에 `itmStkQty` 판정을 새로 만들었는데
 * LOTTEON_FIX_GUIDE 에 자리가 없어 FALLBACK(`where: "LOTTEON_TAB"`)으로
 * 떨어졌다 — 화면이 「롯데ON 탭에서 채우세요」라고 말했다. 원본 상품의 재고는
 * 셀러가 그 탭에서 적을 수 있는 값이 아니다.
 */

const snapshot = (fields: { field: string; label: string; status: "READY" | "MISSING" | "BLOCKED"; reason?: string }[]) =>
  ({
    ok: fields.every((f) => f.status === "READY"),
    fields,
    readyCount: fields.filter((f) => f.status === "READY").length,
    missingCount: fields.filter((f) => f.status === "MISSING").length,
    blockedCount: fields.filter((f) => f.status === "BLOCKED").length,
  }) as Parameters<typeof buildLotteOnMissingInfo>[0];

function stockItem(status: "MISSING" | "BLOCKED" = "BLOCKED") {
  const items = buildLotteOnMissingInfo(
    snapshot([{ field: "itmStkQty", label: "재고", status, reason: "원본 상품의 재고가 없어 등록할 수 없습니다." }]),
  );
  return items.find((i) => i.key === "itmStkQty");
}

describe("🔴 C — 셀러가 해결할 수 없는 사실을 «여기서 고치라» 고 하지 않는다", () => {
  it("재고는 롯데ON 탭이 아니라 «상품정보» 로 보낸다", () => {
    expect(stockItem()?.where).toBe("COMMON_PRODUCT");
  });

  it("FALLBACK 으로 떨어지지 않는다 — 전용 안내가 있다", () => {
    const item = stockItem()!;
    expect(item.what).not.toContain("아래 등록 정보 확인 결과의 사유를 확인해 주세요");
    expect(item.what).toContain("상품정보");
  });

  /* 🔴 「입력하세요」가 아니라 사실 + 다음 행동을 말한다. 판단은 셀러가 한다
     (CEO: 판매 여부와 판매가격은 셀러가 결정한다). */
  it("판매 판단을 대신하지 않는다", () => {
    const item = stockItem()!;
    expect(item.what).toContain("직접 판단");
    expect(item.what).not.toContain("판매하지");
  });

  it("서버가 준 사유가 안내에 함께 남는다", () => {
    expect(stockItem()?.why).toContain("원본 상품의 재고가 없어");
  });
});

describe("차단 표시는 그대로 유지된다", () => {
  it("BLOCKED 는 blocking, MISSING 은 아니다", () => {
    expect(stockItem("BLOCKED")?.blocking).toBe(true);
    expect(stockItem("MISSING")?.blocking).toBe(false);
  });

  /* COMMON_PRODUCT 는 INPUT 이다 — 셀러가 «우리 화면에서» 고칠 수 있는 값이라는
     뜻이고, 상품정보 탭의 재고 칸이 실제로 그렇다. SELLER_CENTER(우리 화면으로
     해결 안 됨)와 구분된다. */
  it("MissingKind 축을 새로 만들지 않았다", () => {
    expect(lotteOnFixLocationToMissingKind("COMMON_PRODUCT")).toBe("INPUT");
    expect(lotteOnFixLocationToMissingKind("LOTTEON_SELLER_CENTER")).toBe("SELLER_CENTER");
  });
});

describe("🔴 죽은 항목이 없다 — 눌렀을 때 갈 곳이 있다", () => {
  /* REWORK-7 ①(이미지 형식) · N-3.55(판매가)가 겪은 것과 같은 결함이다:
     라벨은 보이는데 sectionId 가 없어 눌러도 아무 데도 가지 않는다.
     🔴 자리는 확인하고 적었다 — 재고 입력칸은 PlatformPreview 의 가격 섹션
     안에 있다(FieldRow label="재고"). */
  it("쿠팡 체크리스트의 재고가 갈 곳을 갖는다", async () => {
    const mod = await import("../readiness");
    const summary = mod.computeChecklistReadiness(
      [{ field: "stock", label: "재고", status: "ERROR", message: "재고 수량이 없거나 0 이하입니다." }],
      { state: "CONFIRMED", candidate: null } as never,
    );
    const item = summary.items.find((i) => i.label === "재고");
    expect(item?.sectionId).toBe("section-price");
  });

  it("스마트스토어 재고도 같은 자리로 간다", async () => {
    const mod = await import("../readiness");
    const summary = mod.computeNaverPayloadReadiness({
      ok: false,
      fields: [
        { field: "originProduct.stockQuantity", label: "재고", status: "MISSING", reason: "재고 수량이 없거나 0 이하입니다." },
      ],
    } as never);
    const item = summary.items.find((i) => i.label === "재고");
    expect(item?.sectionId).toBe("section-price");
  });
});
