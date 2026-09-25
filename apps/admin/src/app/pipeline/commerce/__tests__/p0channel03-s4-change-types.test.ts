import { describe, expect, it } from "vitest";
import { resolveLifecycle, type ChangeSet } from "../channel-lifecycle";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 §4 — **SmartStore: 무엇을 고쳤느냐에 따라 길이 갈린다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CTO 명시: 「카테고리 변경을 무조건 UPDATE 라고 가정하지 않는다」.
 * 이 파일이 그 가정을 코드에 심지 못하게 막는다.
 *
 * 🔴 「이미지만 바꿨다」가 실제로 어떻게 보이는지도 함께 못 박는다. 이미지는
 * 구조적으로 비교할 수 없어서(매번 재업로드돼 URL 이 바뀐다) changedFields 에
 * 잡히지 않는다 — 그래서 `comparedEverything:false` 로 흘러가 «전체를 다시
 * 보낸다». 이것이 의도된 동작이고, NOOP 으로 삼켜지지 않는 것이 핵심이다.
 */

/** 비교 가능한 축이 잡힌 경우(가격·상품명·옵션 개수 등). */
const compared = (fields: string[]): ChangeSet => ({
  fields,
  category: false,
  categoryUnknown: false,
  /* 🔴 현실에서는 notCompared 가 비지 않아 항상 false 다 — 그 사실을 그대로 쓴다. */
  comparedEverything: false,
});

describe("§4 변경 유형별 lifecycle — SmartStore", () => {
  it.each([
    ["가격 변경", ["판매가격"]],
    ["상세설명 변경", ["상세설명"]],
    ["상품명 변경", ["상품명"]],
    ["옵션 개수 변경", ["옵션 개수(4 → 5)"]],
  ])("%s → UPDATE", (_label, fields) => {
    const d = resolveLifecycle("smartstore", true, compared(fields));
    expect(d.operation).toBe("UPDATE");
    expect(d.needsAttention).toBe(false);
  });

  it("🔴 이미지만 바꾼 경우 — 비교에 안 잡히지만 NOOP 으로 «삼켜지지» 않는다", () => {
    /* 이미지는 등록마다 재업로드돼 URL 이 항상 새 것이라 비교 대상이 아니다.
       그래서 changedFields 는 비지만, comparedEverything:false 가 「전수로 보지
       못했다」를 말하므로 전체를 다시 보낸다 — 셀러의 이미지 교체가 사라지지 않는다. */
    const d = resolveLifecycle("smartstore", true, compared([]));
    expect(d.operation).toBe("UPDATE");
    expect(d.reason).toContain("전부 확인하지는 못해");
  });

  it("🔴 카테고리 변경 — UPDATE 가 «아니다». 미확인이라고 말하고 RECREATE 를 제안한다", () => {
    const d = resolveLifecycle("smartstore", true, {
      fields: [],
      category: true,
      categoryUnknown: false,
      comparedEverything: false,
    });
    expect(d.operation).not.toBe("UPDATE");
    expect(d.operation).toBe("RECREATE");
    expect(d.reason).toContain("확인되지 않았습니다");
    expect(d.needsAttention).toBe(true);
  });

  it("🔴 카테고리 + 가격 동시 변경 — 카테고리가 «이긴다»", () => {
    /* 가격도 바뀌었다고 UPDATE 로 처리하면 카테고리 변경이 조용히 무시된 채 나간다. */
    const d = resolveLifecycle("smartstore", true, {
      fields: ["판매가격"],
      category: true,
      categoryUnknown: false,
      comparedEverything: false,
    });
    expect(d.operation).toBe("RECREATE");
  });

  it("🔴 변경 없음 — «전수로 봤을 때만» NOOP 이다", () => {
    const partial = resolveLifecycle("smartstore", true, compared([]));
    expect(partial.operation).not.toBe("NOOP");
    const full = resolveLifecycle("smartstore", true, {
      fields: [],
      category: false,
      categoryUnknown: false,
      comparedEverything: true,
    });
    expect(full.operation).toBe("NOOP");
  });
});
