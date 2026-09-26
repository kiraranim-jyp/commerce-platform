import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blindTouchSignals,
  buildChannelEditModel,
  channelEditDraft,
  describeChange,
  editorFieldSchema,
  evaluateEditGate,
} from "../channel-edit-model";
import { FIELD_ORDER, type EditableField } from "../channel-field-capability";
import type { CommerceEditAdapter } from "../commerce-edit-adapter";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A-2 STEP 9 — **새 커머스 추가 = Adapter 만 추가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 스프린트의 핵심 목표는 하나다: «커머스 추가가 Core 수정으로 이어지지 않는다».
 * 그 말이 참인지 문서로 주장하지 않고, «가짜 커머스» 를 붙여서 확인한다.
 *
 * 🔴 11번가를 실제로 추가하는 것이 «아니다»(추가 커머스는 전략상 마지막 단계다).
 * 여기서 만드는 것은 테스트 안에만 사는 어댑터이고, 그것으로 Core 가 채널을 모른 채
 * 도는지를 본다. 이 테스트가 깨지는 날은 Core 에 채널 지식이 새어 든 날이다.
 *
 * 🔴 MockCommerce 의 API 모양을 «네이버와 일부러 다르게» 만든다 — 사진이 배열이
 * 아니라 객체 맵이고, 가격이 문자열이고, 카테고리가 숫자다. 그래도 Core 가 돌아야
 * 한다. 닮은 모양으로 만들면 이 테스트는 아무것도 증명하지 못한다.
 */

/** 가짜 커머스의 GET 응답. */
interface MockRegistered {
  title: string;
  price: string;
  stock: number;
  html: string;
  photos: Record<string, { src: string }>;
  variants: { sku: string }[];
  legal?: { ko: string };
  categoryNo: number;
}

/** 가짜 커머스로 보낼 것. */
interface MockOutgoing {
  item: {
    title: string;
    price: string;
    stock: number;
    html: string;
    photos: Record<string, { src: string }>;
    variants: { sku: string }[];
    legal?: { ko: string };
    categoryNo: number;
  };
}

/**
 * 🔴 새 커머스를 붙일 때 «유일하게» 쓰는 코드. Core 파일도, UI 도, Master 도
 * 건드리지 않는다 — 그것이 이 테스트의 주장이다.
 */
const mockEditAdapter: CommerceEditAdapter<MockRegistered, MockOutgoing> = {
  /* 🔴 등록된 커머스 id 하나를 빌려 쓴다. Core 는 id 로 분기하지 않으므로 어떤
     것이든 되지만, capability 가 EDITABLE 인 것을 써야 게이트까지 볼 수 있다. */
  commerceId: "smartstore",

  readRegistered(registered) {
    return {
      name: registered.title,
      /* 문자열 가격 → 숫자. 🔴 이런 번역이 «어댑터의 일» 이다. */
      salePrice: Number(registered.price),
      stockQuantity: registered.stock,
      detailContent: registered.html,
      /* 객체 맵을 «개수» 로 — 채널마다 세는 법이 다르다는 바로 그 지점이다. */
      imageCount: Object.keys(registered.photos).length,
      optionCount: registered.variants.length,
      hasProvidedNotice: Boolean(registered.legal?.ko),
      categoryId: String(registered.categoryNo),
    };
  },

  projectOutgoing(outgoing) {
    const item = outgoing.item;
    return {
      name: item.title,
      salePrice: Number(item.price),
      stockQuantity: item.stock,
      detailContent: item.html,
      imageCount: Object.keys(item.photos).length,
      optionCount: item.variants.length,
      hasProvidedNotice: Boolean(item.legal?.ko),
      categoryId: String(item.categoryNo),
    };
  },

  editedFields(before, after) {
    const axis: Record<EditableField, (p: MockOutgoing) => unknown> = {
      name: (p) => p.item.title,
      salePrice: (p) => p.item.price,
      stockQuantity: (p) => p.item.stock,
      detailContent: (p) => p.item.html,
      images: (p) => p.item.photos,
      options: (p) => p.item.variants,
      providedNotice: (p) => p.item.legal,
      category: (p) => p.item.categoryNo,
    };
    return FIELD_ORDER.filter(
      (field) => JSON.stringify(axis[field](before) ?? null) !== JSON.stringify(axis[field](after) ?? null),
    );
  },
};

const REGISTERED: MockRegistered = {
  title: "가짜 커머스 상품",
  price: "48000",
  stock: 4,
  html: "<p>가짜 상세</p>",
  photos: { main: { src: "a.jpg" }, sub1: { src: "b.jpg" } },
  variants: [{ sku: "S" }, { sku: "M" }, { sku: "L" }],
  legal: { ko: "고시" },
  categoryNo: 991122,
};

const outgoing = (over: Partial<MockOutgoing["item"]> = {}): MockOutgoing => ({
  item: {
    title: REGISTERED.title,
    price: REGISTERED.price,
    /* 🔴 Master 값이 채널과 다른 상황을 그대로 만든다 — 재고가 777 이다. */
    stock: 777,
    html: REGISTERED.html,
    photos: REGISTERED.photos,
    variants: REGISTERED.variants,
    legal: REGISTERED.legal,
    categoryNo: REGISTERED.categoryNo,
    ...over,
  },
});

function model() {
  const built = buildChannelEditModel(
    { kind: "CHANNEL_GET", commerceId: mockEditAdapter.commerceId, externalProductId: "MOCK-1" },
    mockEditAdapter.readRegistered(REGISTERED),
  );
  if (!built.ok) throw new Error(built.message);
  return built.model;
}

/** 라우트·화면이 하는 일을 그대로 — 어댑터만 갈아끼웠다. */
function gateFor(now: MockOutgoing) {
  const base = outgoing();
  const edited = mockEditAdapter.editedFields(base, now);
  const m = model();
  return {
    edited,
    gate: evaluateEditGate(
      m,
      channelEditDraft(m, mockEditAdapter.projectOutgoing(now), edited),
      blindTouchSignals(edited),
    ),
  };
}

describe("STEP 9 🔴 Core 를 한 줄도 고치지 않고 새 커머스가 돈다", () => {
  it("중립 통화만으로 기준값이 만들어진다 — 모양이 네이버와 달라도", () => {
    const baseline = model().baseline;
    expect(baseline.name).toEqual({ state: "OBSERVED", value: "가짜 커머스 상품" });
    /* 문자열 가격이 숫자로 번역돼 들어왔다. */
    expect(baseline.salePrice).toEqual({ state: "OBSERVED", value: "48000" });
    /* 객체 맵이 개수로 번역됐다. */
    expect(baseline.images).toMatchObject({ state: "PARTIAL", value: "2" });
    expect(baseline.options).toMatchObject({ state: "PARTIAL", value: "3" });
    expect(baseline.providedNotice).toMatchObject({ state: "PARTIAL", value: "있음" });
    expect(baseline.category).toEqual({ state: "OBSERVED", value: "991122" });
  });

  it("항목 목록·순서가 공통이다", () => {
    expect(editorFieldSchema(model()).map((f) => f.field)).toEqual([...FIELD_ORDER]);
  });

  it("🔴 아무것도 고치지 않으면 변경 0건 — Master 재고(777)가 새지 않는다", () => {
    const { edited, gate } = gateFor(outgoing());
    expect(edited).toEqual([]);
    expect(gate.changes).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });

  it("한 항목만 고치면 그 하나만 잡힌다 — 채널 값 기준으로", () => {
    const { gate } = gateFor(outgoing({ title: "가짜 커머스 상품 !" }));
    expect(gate.changes.map((c) => c.field)).toEqual(["name"]);
    expect(gate.changes[0]).toMatchObject({ from: "가짜 커머스 상품", to: "가짜 커머스 상품 !" });
    expect(gate.canSubmit).toBe(true);
  });

  it("가격을 고치면 천 단위 구분까지 공통 함수가 붙인다", () => {
    const { gate } = gateFor(outgoing({ price: "45000" }));
    const change = gate.changes[0];
    if (!change) throw new Error("가격 변경이 잡히지 않았다");
    expect(describeChange(change)).toMatchObject({ from: "48,000", to: "45,000" });
  });

  it("🔴 사진을 «같은 장수로» 교체하면 대조로는 안 잡히고, 손댄 사실로 열린다", () => {
    const swapped = outgoing({ photos: { main: { src: "NEW.jpg" }, sub1: { src: "b.jpg" } } });
    const { edited, gate } = gateFor(swapped);
    expect(edited).toEqual(["images"]);
    expect(gate.changes).toEqual([]);
    expect(gate.touched).toEqual(["images"]);
    expect(gate.canSubmit).toBe(true);
  });

  it("🔴 고쳤다가 되돌리면 닫힌다", () => {
    expect(gateFor(outgoing({ title: "딴 이름" })).gate.canSubmit).toBe(true);
    expect(gateFor(outgoing()).gate.canSubmit).toBe(false);
  });

  it("🔴 카테고리는 어느 커머스에서도 재등록 전용이다 — 바꿔도 열리지 않는다", () => {
    const { gate } = gateFor(outgoing({ categoryNo: 880011 }));
    expect(gate.changes).toEqual([]);
    expect(gate.canSubmit).toBe(false);
  });
});

describe("STEP 9 🔴 그리고 Core 파일은 이 커머스를 모른다", () => {
  it("Core 에 MockCommerce 라는 낱말이 없다", () => {
    for (const file of ["channel-edit-model.ts", "commerce-edit-adapter.ts", "ChannelEditSummary.tsx"]) {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      expect(source, `${file} 이 가짜 커머스를 안다`).not.toContain("Mock");
    }
  });

  it("🔴 이 테스트가 Core 를 «수입만» 한다 — 감싸거나 대체하지 않는다", () => {
    const self = readFileSync(join(__dirname, "p0channel03-sprintA2-mock-commerce.test.ts"), "utf8");
    expect(self).toContain("CommerceEditAdapter<MockRegistered, MockOutgoing>");
    /* 🔴 낱말을 쪼개 적는다 — 붙여 적으면 이 검사가 «자기 자신» 을 찾아 실패한다
       (실제로 그렇게 걸렸다). 모듈을 가짜로 바꿔치기하면 Core 가 정말 도는지가
       아니라 우리가 만든 흉내가 도는지를 보게 된다. */
    expect(self).not.toContain(`vi${"."}mock`);
  });
});
