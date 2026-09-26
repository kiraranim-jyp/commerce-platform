import { describe, expect, it } from "vitest";
import type { NaverProductRegistrationPayload, RegisteredProductSnapshot } from "@commerce/listing";
import { FIELD_ORDER } from "../channel-field-capability";
import {
  buildChannelEditModel,
  channelEditDraft,
  channelEditDraftFromNaverPayload,
  editedFieldsSinceLoad,
  editorFieldSchema,
  evaluateEditGate,
  localTouchSignals,
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

describe("⑤ 🔴 초안은 «보낼 payload» 에서 온다 — 화면과 전송이 갈리지 않는다", () => {
  /** 기준값 READ_ALL 과 «똑같은 것» 을 보내는 payload. 아무것도 고치지 않은 상태다. */
  const SAME_PAYLOAD = {
    originProduct: {
      name: READ_ALL.name,
      salePrice: READ_ALL.salePrice,
      stockQuantity: READ_ALL.stockQuantity,
      detailContent: READ_ALL.detailContent,
      leafCategoryId: READ_ALL.leafCategoryId,
      images: {
        representativeImage: { url: "https://shop-phinf.pstatic.net/new.jpg" },
        optionalImages: [{ url: "1" }, { url: "2" }, { url: "3" }],
      },
      detailAttribute: {
        productInfoProvidedNotice: { wear: {} },
        optionInfo: { optionCombinations: [{}, {}] },
      },
    },
  } as unknown as NaverProductRegistrationPayload;

  it("🔴 아무것도 고치지 않았으면 버튼이 «닫혀 있다» — 단위 계약이 맞다는 증거다", () => {
    /* 이 테스트가 깨지면 기준값과 초안의 단위가 어긋난 것이다. 그 상태에서는
       셀러가 수정 화면을 열자마자 버튼이 열려 있고, 아무 이유 없이 상품 전체가
       다시 등록된다(네이버 수정은 전체 교체다). */
    const gate = evaluateEditGate(model(), channelEditDraftFromNaverPayload(SAME_PAYLOAD));
    expect(gate.changes).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });

  it("🔴 대표이미지 URL 이 달라도 「바뀜」이 아니다 — 매번 재업로드된다", () => {
    /* 위 payload 의 대표이미지 URL 은 기준값과 «다르다». 그래도 장수가 같으니
       변경으로 세지 않는다 — 이것이 F-13 표의 「감지 ✗」 축이다. */
    const draft = channelEditDraftFromNaverPayload(SAME_PAYLOAD);
    expect(draft.images).toBe(4);
    expect(evaluateEditGate(model(), draft).changes).toEqual([]);
  });

  it("초안의 상품명은 payload 의 «보낼» 이름이다 — 원본 title 이 아니다", () => {
    const derived = { ...SAME_PAYLOAD, originProduct: { ...SAME_PAYLOAD.originProduct, name: "테스트 상품 (정품)" } } as NaverProductRegistrationPayload;
    const gate = evaluateEditGate(model(), channelEditDraftFromNaverPayload(derived));
    expect(gate.changes).toHaveLength(1);
    expect(gate.changes[0]).toMatchObject({ label: "상품명", to: "테스트 상품 (정품)" });
  });

  it("payload 가 비어 있으면 «거짓 변경» 을 만들지 않는다", () => {
    const empty = { originProduct: {} } as NaverProductRegistrationPayload;
    const gate = evaluateEditGate(model(), channelEditDraftFromNaverPayload(empty));
    /* 🔴 개수 축은 0 으로 떨어지므로 「이미지 4 → 0」은 «진짜» 변경이다 —
       실제로 이미지 없는 payload 를 보내면 이미지가 없어진다.
       값 축(상품명·가격)과 존재 축(고시)은 undefined 이므로 «사라졌다고 말하지
       않는다» — 화면이 담지 않은 것이지 셀러가 비운 것이 아니다. 그 payload 가
       실제로 나가려 하면 detectUpdateDataLoss 가 PUT 직전에 막는다(F-2). */
    expect(gate.changes.map((c) => c.field).sort()).toEqual(["images", "options"]);
  });
});

describe("⑥ 🔴 대조 못 하는 축은 «우리 payload 끼리» 비교해 손댔는지 안다", () => {
  const base = {
    originProduct: {
      images: {
        representativeImage: { url: "https://x/a.jpg" },
        optionalImages: [{ url: "https://x/b.jpg" }],
      },
      detailAttribute: {
        optionInfo: { optionCombinations: [{ optionName1: "빨강" }] },
        productInfoProvidedNotice: { wear: { material: "면" } },
      },
    },
  } as unknown as NaverProductRegistrationPayload;

  const edit = (mutate: (draft: Record<string, unknown>) => void): NaverProductRegistrationPayload => {
    const copy = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    mutate(copy);
    return copy as unknown as NaverProductRegistrationPayload;
  };

  it("아무것도 고치지 않았으면 신호가 없다", () => {
    expect(localTouchSignals(base, edit(() => {}))).toEqual([]);
  });

  it("🔴 대표이미지를 «같은 장수로» 교체하면 잡힌다 — 개수로는 안 잡히는 축이다", () => {
    const after = edit((draft) => {
      const origin = draft.originProduct as { images: { representativeImage: { url: string } } };
      origin.images.representativeImage.url = "https://x/NEW.jpg";
    });
    expect(localTouchSignals(base, after)).toEqual(["images"]);
    /* 그리고 그 신호가 버튼을 연다 — 장수(4장)가 그대로라 개수 대조로는 0개다. */
    const gate = evaluateEditGate(model(), { images: 4 }, localTouchSignals(base, after));
    expect(gate.changes).toEqual([]);
    expect(gate.canSubmit).toBe(true);
  });

  it("옵션 «내용» 만 바꿔도 잡힌다", () => {
    const after = edit((draft) => {
      const origin = draft.originProduct as {
        detailAttribute: { optionInfo: { optionCombinations: { optionName1: string }[] } };
      };
      origin.detailAttribute.optionInfo.optionCombinations[0].optionName1 = "파랑";
    });
    expect(localTouchSignals(base, after)).toEqual(["options"]);
  });

  it("고시 «항목의 값» 만 바꿔도 잡힌다", () => {
    const after = edit((draft) => {
      const origin = draft.originProduct as {
        detailAttribute: { productInfoProvidedNotice: { wear: { material: string } } };
      };
      origin.detailAttribute.productInfoProvidedNotice.wear.material = "폴리에스터";
    });
    expect(localTouchSignals(base, after)).toEqual(["providedNotice"]);
  });

  it("🔴 대조 «가능한» 축은 이 신호에 들어가지 않는다 — 되돌리면 닫혀야 한다", () => {
    const after = edit((draft) => {
      (draft.originProduct as { name?: string }).name = "다른 이름";
    });
    expect(localTouchSignals(base, after)).toEqual([]);
  });
});

describe("⑦ 🔴 물음표를 ○ 로 만들지 않는다 — capability 는 F-14-2 가 정한다", () => {
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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⑧ P0-CHANNEL-03 F-14-7 — **고치지 않은 것은 변경사항이 아니다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production 사고 재현: 셀러가 상품명에 「!」 하나를 붙였는데 재고 7 → 999,
 * 상세설명 1907자 → 1835자가 같이 「변경사항」으로 떴다.
 *
 * 🔴 원인은 초안을 payload 그대로 쓴 것이다. 그 안에는 셀러가 건드린 적 없는
 * Master 값이 전부 들어 있고, 채널 값과 대조하면 그것이 몽땅 변경이 된다.
 * 「고쳤다」의 기준은 «수정 화면을 연 뒤 우리 화면에서 달라졌는가» 여야 한다.
 */
describe("⑧ 🔴 F-14-7 — 상품명만 고치면 상품명만 바뀐다", () => {
  /** 지금 채널에 나가 있는 것. */
  const CHANNEL: RegisteredProductSnapshot = {
    name: "Bobo Choses Tag Woven Pants",
    salePrice: 157100,
    stockQuantity: 7,
    detailContent: "가".repeat(1907),
    representativeImageUrl: "https://shop-phinf.pstatic.net/a.jpg",
    optionalImageCount: 7,
    optionCombinationCount: 6,
    hasProvidedNotice: true,
    leafCategoryId: "50000167",
  };

  /** 우리 빌더가 만드는 것 — 전부 Master 값이다(재고 999 · 상세설명 1835자). */
  const master = (over: Record<string, unknown> = {}): NaverProductRegistrationPayload =>
    ({
      originProduct: {
        name: "Bobo Choses Tag Woven Pants",
        salePrice: 157100,
        stockQuantity: 999,
        detailContent: "나".repeat(1835),
        leafCategoryId: "50000167",
        images: {
          representativeImage: { url: "https://shop-phinf.pstatic.net/NEW.jpg" },
          optionalImages: Array.from({ length: 7 }, () => ({ url: "x" })),
        },
        detailAttribute: {
          productInfoProvidedNotice: { productInfoProvidedNoticeType: "WEAR" },
          optionInfo: { optionCombinations: Array.from({ length: 6 }, () => ({})) },
        },
        ...over,
      },
    }) as unknown as NaverProductRegistrationPayload;

  const channelModel = model(CHANNEL);
  /** 수정 화면을 연 뒤 지금까지의 변경을 그대로 태운다. */
  const gateFor = (now: NaverProductRegistrationPayload) => {
    const base = master();
    const edited = editedFieldsSinceLoad(base, now);
    return {
      edited,
      gate: evaluateEditGate(channelModel, channelEditDraft(channelModel, now, edited), localTouchSignals(base, now)),
    };
  };

  it("Case 5. 아무것도 고치지 않으면 «변경사항 없음» 이고 버튼이 닫혀 있다", () => {
    /* 🔴 Master 의 재고·상세설명이 채널과 다르지만 셀러는 건드린 적이 없다. */
    const { edited, gate } = gateFor(master());
    expect(edited).toEqual([]);
    expect(gate.changes).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });

  it("Case 1. 🔴 상품명만 고치면 «상품명 하나» 만 나온다", () => {
    const { edited, gate } = gateFor(master({ name: "Bobo Choses Tag Woven Pants !" }));
    expect(edited).toEqual(["name"]);
    expect(gate.changes.map((c) => c.field)).toEqual(["name"]);
    expect(gate.changes[0]).toMatchObject({
      label: "상품명",
      from: "Bobo Choses Tag Woven Pants",
      to: "Bobo Choses Tag Woven Pants !",
    });
    expect(gate.canSubmit).toBe(true);
  });

  it("Case 2. 재고만 고치면 재고 하나만 나온다 — 채널의 7 을 기준으로 센다", () => {
    const { gate } = gateFor(master({ stockQuantity: 12 }));
    expect(gate.changes.map((c) => c.field)).toEqual(["stockQuantity"]);
    expect(gate.changes[0]).toMatchObject({ from: "7", to: "12" });
  });

  it("Case 3. 상세설명만 고치면 상세설명 하나만 나온다", () => {
    const { gate } = gateFor(master({ detailContent: "다".repeat(2000) }));
    expect(gate.changes.map((c) => c.field)).toEqual(["detailContent"]);
  });

  it("Case 6. 🔴 고쳤다가 원래대로 되돌리면 버튼이 닫힌다", () => {
    const edited = gateFor(master({ name: "Bobo Choses Tag Woven Pants !" }));
    expect(edited.gate.canSubmit).toBe(true);
    const reverted = gateFor(master());
    expect(reverted.gate.canSubmit).toBe(false);
    expect(reverted.gate.changes).toEqual([]);
  });

  it("🔴 고치지 않은 축의 초안값은 «채널 값» 이다 — 그래서 대조가 조용하다", () => {
    const draft = channelEditDraft(channelModel, master({ name: "다른 이름" }), ["name"]);
    expect(draft.stockQuantity).toBe("7");
    expect(String(draft.detailContent)).toHaveLength(1907);
    expect(draft.name).toBe("다른 이름");
  });

  it("🔴 이미지를 «같은 장수로» 교체한 것은 여전히 잡힌다 — 손댄 사실로 연다", () => {
    const swapped = master({
      images: {
        representativeImage: { url: "https://shop-phinf.pstatic.net/SWAP.jpg" },
        optionalImages: Array.from({ length: 7 }, () => ({ url: "x" })),
      },
    });
    const { gate } = gateFor(swapped);
    expect(gate.changes).toEqual([]);
    expect(gate.touched).toEqual(["images"]);
    expect(gate.canSubmit).toBe(true);
  });
});
