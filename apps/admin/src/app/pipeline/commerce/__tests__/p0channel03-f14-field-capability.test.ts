import { describe, expect, it } from "vitest";
import { COMMERCE_ORDER, type CommerceId } from "../commerce-registry";
import { CHANNEL_CAPABILITY } from "../channel-lifecycle";
import {
  FIELD_ORDER,
  canSubmitEdit,
  channelEditScope,
  detectFieldChanges,
  fieldCapability,
  fieldCapabilityNote,
} from "../channel-field-capability";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-2 · F-14-4 — **수정 가능 목록과 수정 버튼**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 둘:
 *   ① 물음표를 ○ 로 만들지 않는다 — UNKNOWN 은 「수정 가능」이 아니다.
 *   ② 두 번째 진실을 만들지 않는다 — capability 표에서 «파생» 된다.
 */

describe("① 🔴 물음표를 ○ 로 만들지 않는다", () => {
  it("SmartStore — 일반 필드는 수정 가능(update 가 확인됐다)", () => {
    for (const field of FIELD_ORDER.filter((f) => f !== "category")) {
      expect(fieldCapability("smartstore", field)).toBe("EDITABLE");
    }
  });

  it.each(["coupang", "lotteon"] as const)("%s — 일반 필드는 UNKNOWN (수정 가능이 «아니다»)", (id) => {
    for (const field of FIELD_ORDER.filter((f) => f !== "category")) {
      expect(fieldCapability(id, field)).toBe("UNKNOWN");
    }
  });

  it("🔴 어느 채널에서도 카테고리는 수정 가능이 아니다 — 재등록이다", () => {
    for (const id of COMMERCE_ORDER) {
      expect(fieldCapability(id, "category")).toBe("RECREATE_ONLY");
    }
  });

  it("🔴 UNKNOWN 을 「안 됩니다」로 말하지 않는다", () => {
    expect(fieldCapabilityNote("UNKNOWN")).toContain("확인되지 않았습니다");
    expect(fieldCapabilityNote("UNKNOWN")).not.toContain("없습니다");
  });
});

describe("② 🔴 capability 표에서 «파생» 된다 — 두 번째 진실이 없다", () => {
  it("update 가 SUPPORTED 인 채널에서만 일반 필드가 EDITABLE 이다", () => {
    for (const id of COMMERCE_ORDER as readonly CommerceId[]) {
      const supported = CHANNEL_CAPABILITY[id].update === "SUPPORTED";
      expect(fieldCapability(id, "salePrice") === "EDITABLE").toBe(supported);
    }
  });

  it("세 묶음이 서로 겹치지 않고 전부를 덮는다", () => {
    for (const id of COMMERCE_ORDER) {
      const scope = channelEditScope(id);
      const all = [...scope.editable, ...scope.recreateOnly, ...scope.unknown];
      expect(all.sort()).toEqual([...FIELD_ORDER].sort());
      expect(new Set(all).size).toBe(FIELD_ORDER.length);
    }
  });
});

describe("③ F-14-4 변경 감지 — 하나라도 달라지면 열린다", () => {
  const before = { name: "A 상품", salePrice: 157100, stockQuantity: 10 };

  it("변경 없음 → 버튼 닫힘", () => {
    const changes = detectFieldChanges("smartstore", before, { ...before });
    expect(changes).toEqual([]);
    expect(canSubmitEdit(changes)).toBe(false);
  });

  it("상품명 하나만 바꿔도 열린다", () => {
    const changes = detectFieldChanges("smartstore", before, { ...before, name: "B 상품" });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ label: "상품명", from: "A 상품", to: "B 상품" });
    expect(canSubmitEdit(changes)).toBe(true);
  });

  it("가격만 바꿔도 열린다", () => {
    expect(canSubmitEdit(detectFieldChanges("smartstore", before, { ...before, salePrice: 156900 }))).toBe(true);
  });

  it("🔴 바꿨다가 «되돌리면» 다시 닫힌다", () => {
    const edited = { ...before, name: "B 상품" };
    expect(canSubmitEdit(detectFieldChanges("smartstore", before, edited))).toBe(true);
    const reverted = { ...edited, name: "A 상품" };
    expect(canSubmitEdit(detectFieldChanges("smartstore", before, reverted))).toBe(false);
  });

  it("🔴 빈 문자열과 «값 없음» 을 같게 본다 — 거짓 변경을 만들지 않는다", () => {
    expect(detectFieldChanges("smartstore", { name: "" }, { name: undefined })).toEqual([]);
  });

  it("🔴 고칠 수 «없는» 항목의 변화는 세지 않는다", () => {
    /* 카테고리를 바꿔 놓고 수정 버튼이 열리면, 그 변경은 나가지도 않는데
       셀러는 반영됐다고 믿는다. */
    const changes = detectFieldChanges("smartstore", { category: "50000167" }, { category: "50000168" });
    expect(changes).toEqual([]);
    expect(canSubmitEdit(changes)).toBe(false);
  });

  it("🔴 수정이 확인되지 않은 채널은 아무것도 열리지 않는다", () => {
    for (const id of ["coupang", "lotteon"] as const) {
      expect(detectFieldChanges(id, before, { ...before, name: "B 상품" })).toEqual([]);
    }
  });
});
