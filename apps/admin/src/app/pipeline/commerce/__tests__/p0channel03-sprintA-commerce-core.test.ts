import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMERCE_ORDER } from "../commerce-registry";
import { CHANNEL_CAPABILITY } from "../channel-lifecycle";
import { CONTENT_BLIND_FIELDS, sameExternalProductId } from "../commerce-edit-adapter";
import { EDIT_ADAPTER_COMMERCE_IDS, editAdapterFor, editUnavailableNote } from "../edit-adapters";
import { buildChannelEditModel, editorFieldSchema } from "../channel-edit-model";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A — **Commerce Core: 새 커머스는 어댑터만 늘린다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 전략 고정(2026-09-26): Commerce 는 Product 의 주인이 아니라 마지막에 붙는
 * 판매/유통 어댑터다. 3개까지는 복붙으로도 빠르지만 10개가 되면 유지보수가
 * 무너진다 — 그래서 «무엇이 공통이고 무엇이 채널별인지» 를 코드가 지켜야 한다.
 *
 * 🔴 이 파일이 지키는 넷:
 *   ① Core 는 채널 API 모양을 «모른다»(네이버 타입이 새어 나오지 않는다).
 *   ② 커머스가 늘어나면 `edit-adapters/` 한 파일 + 등록 한 줄만 늘어난다.
 *   ③ 대조 불가 축은 «공통 정책» 이다 — 채널별로 따로 정하지 않는다.
 *   ④ 어댑터가 없는 커머스는 「확인되지 않았다」고 말한다 — 「안 된다」가 아니다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const COMMERCE_DIR = join(__dirname, "..");
const CORE_FILES = [
  "channel-edit-model.ts",
  "channel-field-capability.ts",
  "commerce-edit-adapter.ts",
  "ChannelEditPanel.tsx",
  "ChannelEditSummary.tsx",
];

describe("① 🔴 Core 는 채널 API 모양을 모른다", () => {
  it.each(CORE_FILES)("%s — 네이버 타입이 새어 나오지 않는다", (file) => {
    const source = codeOnly(readFileSync(join(COMMERCE_DIR, file), "utf8"));
    /* 🔴 이 이름이 Core 에 보이면, 쿠팡을 붙일 때 Core 를 고쳐야 한다는 뜻이다. */
    expect(source).not.toContain("NaverProductRegistrationPayload");
    expect(source).not.toContain("RegisteredProductSnapshot");
    expect(source).not.toContain("originProduct");
    expect(source).not.toContain("smartstoreChannelProduct");
  });

  it("Core 가 쓰는 통화는 «중립» 이다 — 채널이 번역해서 건넨다", () => {
    const model = codeOnly(readFileSync(join(COMMERCE_DIR, "channel-edit-model.ts"), "utf8"));
    expect(model).toContain("ChannelFieldValues");
    expect(model).toContain("values: ChannelFieldValues");
  });

  it("어댑터 안에서는 채널 타입을 쓴다 — 거기가 «끝나는 자리» 다", () => {
    const adapter = codeOnly(readFileSync(join(COMMERCE_DIR, "edit-adapters/smartstore.ts"), "utf8"));
    expect(adapter).toContain("NaverProductRegistrationPayload");
    expect(adapter).toContain("RegisteredProductSnapshot");
  });
});

describe("② 🔴 커머스가 늘어나면 어댑터만 늘어난다", () => {
  it("어댑터 폴더의 파일 수 = 등록된 커머스 수 + 등록표 하나", () => {
    const files = readdirSync(join(COMMERCE_DIR, "edit-adapters"));
    expect(files).toContain("index.ts");
    expect(files.filter((f) => f !== "index.ts").sort()).toEqual(
      EDIT_ADAPTER_COMMERCE_IDS.map((id) => `${id}.ts`).sort(),
    );
  });

  it("🔴 Core·UI 어디에도 커머스 «이름» 으로 갈라지는 분기가 없다", () => {
    for (const file of CORE_FILES) {
      const source = codeOnly(readFileSync(join(COMMERCE_DIR, file), "utf8"));
      for (const id of COMMERCE_ORDER) {
        expect(source, `${file} 이 ${id} 로 분기한다`).not.toContain(`"${id}"`);
      }
    }
  });

  it("등록표는 «부분» 이다 — 모든 커머스가 어댑터를 가질 필요가 없다", () => {
    expect(EDIT_ADAPTER_COMMERCE_IDS).toEqual(["smartstore"]);
    expect(editAdapterFor("smartstore")).toBeDefined();
    for (const id of ["coupang", "lotteon", "elevenst"] as const) {
      expect(editAdapterFor(id)).toBeUndefined();
    }
  });

  it("어댑터는 자기 커머스 id 를 «스스로» 말한다 — 표와 어긋날 수 없다", () => {
    for (const id of EDIT_ADAPTER_COMMERCE_IDS) {
      expect(editAdapterFor(id)?.commerceId).toBe(id);
    }
  });
});

describe("③ 🔴 대조 불가 축은 공통 정책이다", () => {
  it("이미지·옵션·고시 — 채널별로 따로 정하지 않는다", () => {
    expect([...CONTENT_BLIND_FIELDS]).toEqual(["images", "options", "providedNotice"]);
  });

  it("🔴 그 축을 «안전하다고 판정하지 않는다» — 문서가 그렇게 말한다", () => {
    const source = readFileSync(join(COMMERCE_DIR, "commerce-edit-adapter.ts"), "utf8");
    expect(source).toContain("안전하다고 «판정하지 않는다»");
    expect(source).toContain("조사가 먼저다");
  });

  it("등록 ID 는 문자열로만 다룬다 — 모양을 Core 가 해석하지 않는다", () => {
    expect(sameExternalProductId("13714803530", " 13714803530 ")).toBe(true);
    expect(sameExternalProductId("13714803530", "13714803531")).toBe(false);
    /* 🔴 없는 것을 같다고 하지 않는다. */
    expect(sameExternalProductId(null, null)).toBe(false);
    expect(sameExternalProductId("", "")).toBe(false);
  });
});

describe("④ 🔴 어댑터가 없으면 「확인되지 않았다」고 말한다", () => {
  it("SmartStore 는 안내가 없다 — 실제로 되기 때문이다", () => {
    expect(editUnavailableNote("smartstore")).toBeUndefined();
  });

  it.each(["coupang", "lotteon"] as const)("%s — 「안 됩니다」가 아니라 「확인되지 않았습니다」", (id) => {
    const note = editUnavailableNote(id);
    expect(note).toContain("확인되지 않았습니다");
    expect(note).not.toContain("없습니다");
    expect(note).not.toContain("불가");
    /* 🔴 그리고 그 판단의 근거는 capability 표다 — 여기서 새로 만들지 않는다. */
    expect(CHANNEL_CAPABILITY[id].update).toBe("UNKNOWN");
  });

  it("🔴 조사 부채를 구현 부채로 «위장하지» 않는다", () => {
    const registry = readFileSync(join(COMMERCE_DIR, "edit-adapters/index.ts"), "utf8");
    expect(registry).toContain("조사 부채");
    expect(registry).toContain("capability 근거가 아니다");
  });
});

describe("⑤ 🔴 Core 는 어느 커머스로도 같은 흐름을 돈다", () => {
  /** 🔴 «가짜 커머스» 의 값으로 Core 를 돌린다 — 네이버가 아니어도 도는지 본다. */
  const NEUTRAL = {
    name: "어느 커머스의 상품",
    salePrice: 12000,
    stockQuantity: 3,
    detailContent: "<p>내용</p>",
    imageCount: 5,
    optionCount: 2,
    hasProvidedNotice: true,
    categoryId: "CAT-1",
  };

  it("중립 통화만으로 기준값·항목 목록이 만들어진다", () => {
    const built = buildChannelEditModel(
      { kind: "CHANNEL_GET", commerceId: "coupang", externalProductId: "16394846257" },
      NEUTRAL,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const fields = editorFieldSchema(built.model);
    expect(fields).toHaveLength(8);
    expect(built.model.baseline.name).toEqual({ state: "OBSERVED", value: "어느 커머스의 상품" });
    /* 🔴 개수는 어댑터가 «합쳐서» 준 값을 그대로 쓴다 — Core 가 다시 더하지 않는다. */
    expect(built.model.baseline.images).toMatchObject({ state: "PARTIAL", value: "5" });
  });

  it("🔴 capability 가 UNKNOWN 인 커머스는 «수정 가능» 이라고 말하지 않는다", () => {
    const built = buildChannelEditModel(
      { kind: "CHANNEL_GET", commerceId: "coupang", externalProductId: "16394846257" },
      NEUTRAL,
    );
    if (!built.ok) throw new Error(built.message);
    expect(editorFieldSchema(built.model).every((f) => f.editable === false)).toBe(true);
  });
});
