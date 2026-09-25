import { describe, expect, it } from "vitest";
import type { RegisteredProductSnapshot } from "@commerce/listing";
import { FIELD_ORDER } from "../channel-field-capability";
import {
  buildChannelEditModel,
  editorFieldSchema,
  evaluateEditGate,
  toComparable,
  type ChannelEditModel,
  type ChannelEditSource,
} from "../channel-edit-model";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-3 — **수정 화면의 기준값은 «채널에서 읽은 것» 뿐이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 넷:
 *   ① Snapshot 을 기준값으로 쓰지 않는다 — 출처 없이는 모델이 만들어지지 않는다.
 *   ② 「읽지 못했다」를 「값이 없다」로 만들지 않는다.
 *   ③ 대표이미지 비대칭 — 감지 ✗ 인 항목이 셀러를 «막지» 않는다.
 *   ④ 단위가 어긋나 «거짓 변경» 이 생기지 않는다.
 */

const SOURCE: ChannelEditSource = {
  kind: "CHANNEL_GET",
  commerceId: "smartstore",
  externalProductId: "13713593585",
};

/** GET 이 전부 읽힌 경우. 🔴 fetchRegisteredProduct 가 실제로 내는 모양이다. */
const READ_ALL: RegisteredProductSnapshot = {
  name: "테스트 상품",
  salePrice: 157100,
  stockQuantity: 10,
  detailContent: "<p>상세</p>",
  representativeImageUrl: "https://shop-phinf.pstatic.net/a.jpg",
  optionalImageCount: 3,
  optionCombinationCount: 2,
  hasProvidedNotice: true,
  leafCategoryId: "50000167",
};

function model(snapshot: RegisteredProductSnapshot = READ_ALL, source = SOURCE): ChannelEditModel {
  const built = buildChannelEditModel(source, snapshot);
  if (!built.ok) throw new Error(built.message);
  return built.model;
}

describe("① 🔴 Snapshot 을 기준값으로 쓰지 않는다", () => {
  it("모델은 «어디서 읽었는지» 를 들고 있다 — 출처 없이 만들 수 없다", () => {
    expect(model().source).toEqual(SOURCE);
    expect(model().source.kind).toBe("CHANNEL_GET");
  });

  it("🔴 RegisteredProductSnapshot 은 ChannelEditModel 자리에 들어가지 않는다(타입 수준)", () => {
    const snapshot: RegisteredProductSnapshot = READ_ALL;
    const misuse = () =>
      // @ts-expect-error — Snapshot 을 편집 기준값으로 재사용하면 여기서 막힌다.
      editorFieldSchema(snapshot);
    /* 🔴 위 한 줄이 불변조건 ③ 이다. @ts-expect-error 가 「쓸모없다」고 실패하는
       순간 두 타입이 섞였다는 뜻이다. 런타임에서도 조용히 되지 않는다. */
    expect(misuse).toThrow();
  });

  it("🔴 어느 상품인지 모르면 화면을 열지 않는다", () => {
    const built = buildChannelEditModel({ ...SOURCE, externalProductId: "  " }, READ_ALL);
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.message).toContain("어느 상품");
  });

  it("항목 목록은 FIELD_ORDER 를 그대로 따른다 — 채널마다 순서가 다르지 않다", () => {
    expect(editorFieldSchema(model()).map((f) => f.field)).toEqual([...FIELD_ORDER]);
  });
});

describe("② 🔴 「읽지 못했다」를 「값이 없다」로 만들지 않는다", () => {
  const EMPTY: RegisteredProductSnapshot = {};

  it("응답에 없던 항목은 UNREAD 다 — 「없음」이 아니다", () => {
    const baseline = model(EMPTY).baseline;
    for (const field of FIELD_ORDER) {
      expect(baseline[field].state).toBe("UNREAD");
    }
  });

  it("🔴 셀러에게 「없습니다」가 아니라 「읽지 못했습니다」라고 말한다", () => {
    const name = editorFieldSchema(model(EMPTY)).find((f) => f.field === "name");
    expect(name?.note).toContain("읽지 못했습니다");
    expect(name?.baseline.state).toBe("UNREAD");
  });

  it("🔴 개수를 읽지 못한 것을 0 으로 적지 않는다", () => {
    /* 0 으로 적으면 아무것도 안 고친 셀러에게 「이미지가 없어집니다」가 된다. */
    expect(model({ representativeImageUrl: "https://x/a.jpg" }).baseline.images.state).toBe("UNREAD");
  });

  it("가격을 숫자로 읽지 못하면 «현재가격» 을 지어내지 않는다", () => {
    expect(model({ ...READ_ALL, salePrice: null }).baseline.salePrice.state).toBe("UNREAD");
  });

  it("읽지 못한 항목은 대조하지 않는다 — 그래도 입력은 반영된다고 말한다", () => {
    const gate = evaluateEditGate(model(EMPTY), { name: "새 상품명" });
    expect(gate.changes).toEqual([]);
    const note = editorFieldSchema(model(EMPTY)).find((f) => f.field === "name")?.note;
    expect(note).toContain("반영됩니다");
  });
});

describe("③ 🔴 대표이미지 비대칭 — 감지 ✗ 가 셀러를 막지 않는다", () => {
  it("이미지·옵션·고시는 PARTIAL 이고 «무엇이 안 보이는지» 를 적어 둔다", () => {
    const schema = editorFieldSchema(model());
    for (const field of ["images", "options", "providedNotice"] as const) {
      const entry = schema.find((f) => f.field === field);
      expect(entry?.baseline.state).toBe("PARTIAL");
      if (entry?.baseline.state === "PARTIAL") expect(entry.baseline.blind).not.toBe("");
      expect(entry?.touchCounts).toBe(true);
      expect(entry?.note).toContain("반영됩니다");
    }
  });

  it("🔴 같은 장수로 교체하면 대조로는 안 잡힌다 — 그래도 버튼은 열린다", () => {
    const m = model();
    const draft = { images: [1, 2, 3, 4] }; // 대표 1 + 추가 3 = 4장 그대로
    expect(evaluateEditGate(m, draft).changes).toEqual([]);
    /* 손댄 사실이 없으면 닫혀 있고 */
    expect(evaluateEditGate(m, draft).canSubmit).toBe(false);
    /* 손댔다면 열린다 — 대조하지 못한 것을 「안 바뀌었다」로 쓰지 않는다. */
    const touched = evaluateEditGate(m, draft, ["images"]);
    expect(touched.touched).toEqual(["images"]);
    expect(touched.canSubmit).toBe(true);
  });

  it("장수가 달라지면 대조로 잡히고, 손댄 항목으로 «또» 세지 않는다", () => {
    const gate = evaluateEditGate(model(), { images: [1, 2] }, ["images"]);
    expect(gate.changes.map((c) => c.field)).toEqual(["images"]);
    expect(gate.touched).toEqual([]);
    expect(gate.canSubmit).toBe(true);
  });

  it("🔴 대조 가능한 항목은 손댔다고 열리지 않는다 — 되돌리면 닫혀야 한다", () => {
    const gate = evaluateEditGate(model(), { name: READ_ALL.name }, ["name"]);
    expect(gate.changes).toEqual([]);
    expect(gate.touched).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });
});

describe("④ 🔴 단위가 어긋나 거짓 변경이 생기지 않는다", () => {
  it("개수 축은 목록을 받아 «개수로» 맞춘다", () => {
    expect(toComparable("COUNT", [1, 2, 3])).toBe("3");
    expect(toComparable("COUNT", 3)).toBe("3");
    /* 🔴 셀 수 없는 것을 0 으로 적지 않는다. */
    expect(toComparable("COUNT", undefined)).toBeUndefined();
  });

  it("존재 축은 기준값과 «같은 말» 을 쓴다", () => {
    const notice = model().baseline.providedNotice;
    /* 🔴 UNREAD 에는 `value` 가 «없다» — 그것을 읽으려 하면 타입이 막는다. */
    if (notice.state !== "PARTIAL") throw new Error("기준값이 PARTIAL 이 아니다");
    expect(toComparable("PRESENCE", { a: 1 })).toBe(notice.value);
    expect(toComparable("PRESENCE", null)).toBe("없음");
    expect(toComparable("PRESENCE", [])).toBe("없음");
    /* 🔴 화면이 담지 않은 것은 「없음」이 아니다. */
    expect(toComparable("PRESENCE", undefined)).toBeUndefined();
  });

  it("🔴 화면이 아직 담지 않은 항목은 「사라졌다」가 아니다", () => {
    /* draft 가 비어 있으면 아무 변경도 없어야 한다 — 이 한 줄이 없으면 수정
       화면을 «열자마자» 버튼이 열려 있다. */
    const gate = evaluateEditGate(model(), {});
    expect(gate.changes).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });

  it("옵션 내용만 바꾸면(개수 같음) 대조로는 안 잡힌다", () => {
    expect(evaluateEditGate(model(), { options: ["A", "B"] }).changes).toEqual([]);
  });

  it("가격 한 칸만 바꾸면 그 한 칸만 잡힌다", () => {
    const gate = evaluateEditGate(model(), {
      name: READ_ALL.name,
      salePrice: 156900,
      stockQuantity: 10,
      detailContent: READ_ALL.detailContent,
      images: [1, 2, 3, 4],
      options: ["A", "B"],
      providedNotice: { x: 1 },
    });
    expect(gate.changes).toHaveLength(1);
    expect(gate.changes[0]).toMatchObject({ label: "판매가격", from: "157100", to: "156900" });
    expect(gate.canSubmit).toBe(true);
  });
});

describe("⑤ 🔴 물음표를 ○ 로 만들지 않는다 — capability 는 F-14-2 가 정한다", () => {
  it("카테고리는 읽어도 «고칠 수 있다» 고 말하지 않는다", () => {
    const category = editorFieldSchema(model()).find((f) => f.field === "category");
    expect(category?.baseline).toEqual({ state: "OBSERVED", value: "50000167" });
    expect(category?.editable).toBe(false);
    expect(category?.note).toContain("다시 등록");
  });

  it("카테고리를 바꿔도 수정 버튼은 열리지 않는다", () => {
    const gate = evaluateEditGate(model(), { category: "50000168" }, ["category"]);
    expect(gate.changes).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });

  it.each(["coupang", "lotteon"] as const)("%s — 아무 항목도 고칠 수 없고, 손대도 열리지 않는다", (id) => {
    const m = model(READ_ALL, { ...SOURCE, commerceId: id });
    const schema = editorFieldSchema(m);
    expect(schema.every((f) => f.editable === false)).toBe(true);
    expect(schema.filter((f) => f.capability === "UNKNOWN").every((f) => f.note.includes("확인되지 않았"))).toBe(true);
    const gate = evaluateEditGate(m, { name: "다른 이름", images: [1] }, ["images"]);
    expect(gate.changes).toEqual([]);
    expect(gate.touched).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });
});
