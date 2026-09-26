import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RegisteredProductSnapshot } from "@commerce/listing";
import { COMMERCE_ORDER } from "../commerce-registry";
import {
  buildChannelEditModel,
  describeChange,
  editorFieldSchema,
  evaluateEditGate,
  type ChannelEditModel,
} from "../channel-edit-model";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-5(CTO 작업지시서, 2026-09-26) — **우측 수정 요약**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 다섯:
 *   ① 새 판단을 만들지 않는다 — capability·기준값·변경감지 결과를 «연결» 만 한다.
 *   ② 기준값은 Editor 와 «같은 것» 이다 — 요약이 Snapshot/별도 API 를 읽지 않는다.
 *   ③ 수정 버튼은 evaluateEditGate 결과 하나로만 열린다.
 *   ④ 개발용 낱말은 앞면에 없고, 근거는 접힘 안에 «남아 있다».
 *   ⑤ 기존 등록 요약을 대체하지 않는다 — 그 아래에 «따로» 선다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SUMMARY = codeOnly(readFileSync(join(__dirname, "../ChannelEditSummary.tsx"), "utf8"));
const FRAME = codeOnly(readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8"));
const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

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

function model(commerceId: (typeof COMMERCE_ORDER)[number] = "smartstore"): ChannelEditModel {
  const built = buildChannelEditModel(
    { kind: "CHANNEL_GET", commerceId, externalProductId: "13714803530" },
    READ_ALL,
  );
  if (!built.ok) throw new Error(built.message);
  return built.model;
}

/** 아무것도 고치지 않은 초안 — 기준값과 같은 단위·같은 값. */
const SAME = { name: "테스트 상품", salePrice: 157100, stockQuantity: 10, detailContent: "<p>상세</p>", images: 4, options: 2, providedNotice: { a: 1 } };

describe("① 🔴 새 판단을 만들지 않는다", () => {
  it("항목 목록은 editorFieldSchema, 게이트는 evaluateEditGate 가 준다", () => {
    expect(SUMMARY).toContain("editorFieldSchema(model)");
    expect(SUMMARY).toContain("evaluateEditGate(model, draft, touched)");
  });

  it("🔴 capability 를 요약이 다시 판단하지 않는다", () => {
    expect(SUMMARY).not.toContain("fieldCapability(");
    expect(SUMMARY).not.toContain("CHANNEL_CAPABILITY");
    expect(SUMMARY).not.toContain("detectFieldChanges");
    /* 「고칠 수 있는가」는 schema 의 editable 만 본다. */
    expect(SUMMARY).toContain("fields.filter((field) => field.editable)");
  });

  it("🔴 F-14-7 — 「수정할 수 있는 항목」 목록을 «지웠다»", () => {
    /* 같은 사실이 왼쪽 편집 영역에 이미 있다. 두 번 말하면 정작 봐야 할
       변경사항이 아래로 밀린다(CTO 지시 §1). */
    expect(SUMMARY).not.toContain("수정할 수 있는 항목");
    expect(SUMMARY).not.toContain("editable.map(");
    for (const label of ["상품명\"", "판매가격\"", "재고\"", "상세설명\""]) {
      expect(SUMMARY, `라벨을 요약이 다시 적었다: ${label}`).not.toContain(label);
    }
  });

  it("🔴 그래도 capability 는 «그대로» 쓴다 — 지운 것은 목록 UI 뿐이다", () => {
    /* 고칠 수 있는 항목이 하나도 없는 채널(Coupang·LotteON)은 그 사실을 한 줄로
       말한다. 목록을 지웠다고 「수정할 수 있다」로 보이면 안 된다. */
    expect(SUMMARY).toContain("editable.length === 0");
    expect(SUMMARY).toContain("others[0]?.note");
  });
});

describe("② 🔴 기준값은 Editor 와 같은 것이다", () => {
  it("요약은 «읽지» 않는다 — model 을 받아서만 그린다", () => {
    expect(SUMMARY).not.toContain("fetch(");
    expect(SUMMARY).not.toContain("buildChannelEditModel");
    expect(SUMMARY).not.toContain("useEffect");
  });

  it("🔴 Snapshot 을 요약 기준으로 쓰지 않는다", () => {
    expect(SUMMARY).not.toContain("RegisteredProductSnapshot");
    expect(SUMMARY).not.toContain("snapshotId");
  });

  it("좌·우가 «한 번 만든 같은 초안» 을 본다", () => {
    /* 두 화면이 각자 투영하면 한쪽만 옛 payload 를 쥔 순간이 생긴다. */
    expect(WORKSPACE).toContain("const channelEditInput = useMemo(");
    expect(WORKSPACE).toContain("draft={channelEditInput.draft}");
    expect(WORKSPACE).toContain("touched={channelEditInput.touched}");
    const panelMount = WORKSPACE.slice(WORKSPACE.indexOf("<ChannelEditPanel"));
    expect(panelMount).toContain("channelEditInput.draft");
  });

  it("같은 값을 «같은 함수» 로 그린다 — 두 자리에서 다른 숫자가 되지 않는다", () => {
    expect(SUMMARY).toContain("describeChange(change)");
    /* 🔴 가격에만 천 단위 구분을 넣는다. 카테고리 코드는 숫자처럼 생겼을 뿐이다. */
    expect(describeChange({ field: "salePrice", label: "판매가격", from: "157100", to: "156900" })).toEqual({
      label: "판매가격",
      from: "157,100",
      to: "156,900",
    });
    /* 상세설명을 그대로 쏟지 않는다 — 요약이 본문으로 덮인다. */
    expect(describeChange({ field: "detailContent", label: "상세설명", from: "<p>0123456789</p>" }).from).toBe("17자");
  });
});

describe("③ 🔴 수정 버튼 — CTO 회귀 목록", () => {
  const gate = (draft: Record<string, unknown>, id: (typeof COMMERCE_ORDER)[number] = "smartstore") =>
    evaluateEditGate(model(id), draft);

  it("변경 없음 → 비활성", () => {
    expect(gate(SAME).canSubmit).toBe(false);
  });

  it("가격 변경 → 활성", () => {
    expect(gate({ ...SAME, salePrice: 156900 }).canSubmit).toBe(true);
  });

  it("상품명 변경 → 활성", () => {
    expect(gate({ ...SAME, name: "다른 상품" }).canSubmit).toBe(true);
  });

  it("🔴 변경 후 원복 → 비활성", () => {
    expect(gate({ ...SAME, salePrice: 156900 }).canSubmit).toBe(true);
    expect(gate({ ...SAME, salePrice: 157100 }).canSubmit).toBe(false);
  });

  it("🔴 지원하지 않는 항목만 변경 → 비활성", () => {
    expect(gate({ ...SAME, category: "50000168" }).canSubmit).toBe(false);
  });

  it("🔴 UNKNOWN 을 「수정 가능」으로 표시하지 않는다", () => {
    for (const id of ["coupang", "lotteon"] as const) {
      const fields = editorFieldSchema(model(id));
      expect(fields.every((field) => field.editable === false)).toBe(true);
      /* 🔴 UNKNOWN 은 「확인되지 않았다」로 말한다. 카테고리는 그 축이 아니다 —
         RECREATE_ONLY 이므로 「다시 등록해야 한다」가 맞는 말이고, 둘을 한
         문구로 뭉개면 둘 중 하나는 거짓이 된다. */
      const unknown = fields.filter((field) => field.capability === "UNKNOWN");
      expect(unknown.length).toBeGreaterThan(0);
      expect(unknown.every((field) => field.note.includes("확인되지 않았"))).toBe(true);
      expect(fields.filter((field) => field.capability === "RECREATE_ONLY").map((f) => f.field)).toEqual([
        "category",
      ]);
      /* 그리고 그 채널에서는 버튼이 열리지 않는다. */
      expect(gate({ ...SAME, salePrice: 156900 }, id).canSubmit).toBe(false);
    }
  });

  it("버튼은 게이트 결과 하나만 본다", () => {
    expect(SUMMARY).toContain("disabled={busy || !gate.canSubmit}");
    expect(SUMMARY).toContain("변경사항 없음");
  });

  it("🔴 PARTIAL 의 blind 의미가 유지된다 — 손댔다는 사실로만 연다", () => {
    /* 장수가 같은 이미지 교체는 대조로 0개다. 손댔다는 신호가 있을 때만 열린다. */
    expect(evaluateEditGate(model(), SAME, []).canSubmit).toBe(false);
    expect(evaluateEditGate(model(), SAME, ["images"]).canSubmit).toBe(true);
  });
});

describe("④ 🔴 개발용 낱말은 앞면에 없고, 근거는 남아 있다", () => {
  const front = SUMMARY.slice(SUMMARY.indexOf("<div"), SUMMARY.indexOf("<details"));

  it.each([
    "ChangeSet",
    "Data Loss",
    "OBSERVED",
    "comparedEverything",
    "NOT_COMPARED",
    "capability",
    "payload",
    "Snapshot",
  ])("앞면에 「%s」가 없다", (word) => {
    expect(front).not.toContain(word);
  });

  it("🔴 GET/PUT 을 앞면에 쓰지 않는다", () => {
    expect(front).not.toContain("GET");
    expect(front).not.toContain("PUT");
  });

  it("🔴 근거는 «접어서» 남긴다 — 없애지 않는다", () => {
    expect(SUMMARY).toContain("<details");
    expect(SUMMARY).toContain("자세히 보기");
    /* 못 읽은 이유와 못 보는 축이 접힘 안에 그대로 있다. */
    expect(SUMMARY).toContain("field.baseline.reason");
    expect(SUMMARY).toContain("field.baseline.blind");
    expect(SUMMARY).toContain("원인을 찾는 근거");
  });

  it("대조하지 못한 항목을 「바뀝니다」로 단정하지 않는다", () => {
    expect(SUMMARY).toContain("고치셨습니다");
    expect(SUMMARY).toContain("미리 보여드리지는 못하지만 그대로 반영됩니다");
  });
});

describe("⑤ 🔴 기존 등록 흐름을 대체하지 않는다", () => {
  it("등록 요약 «아래» 에 따로 선다 — 카드를 합치지 않는다", () => {
    expect(FRAME).toContain("{editSummary}");
    const iRegistration = FRAME.indexOf("<ChannelRegistrationSummary");
    const iEdit = FRAME.indexOf("{editSummary}");
    expect(iRegistration).toBeLessThan(iEdit);
  });

  it("등록 요약의 입력은 하나도 바뀌지 않았다", () => {
    for (const prop of [
      "state={registrationState}",
      "required={readinessSummary.required}",
      "allRequiredPassed={readinessSummary.allRequiredPassed}",
      "onRegister={onOpenListingModal}",
    ]) {
      expect(FRAME).toContain(prop);
    }
  });

  it("🔴 SmartStore 에만 연결한다 — Coupang·LotteON 은 억지로 붙이지 않는다", () => {
    expect(WORKSPACE).toContain('tab === "smartstore" && channelEdit && channelEditInput');
  });

  it("불러오지 않았으면 요약이 서지 않는다", () => {
    expect(WORKSPACE).toContain(") : undefined");
    expect(FRAME).toContain("editSummary?: ReactNode");
  });
});

describe("⑥ 🔴 CTO 자체 검토에서 찾은 두 구멍", () => {
  it("보냈으면 기준값을 «버린다» — 같은 수정이 두 번 나가지 않는다", () => {
    /* 수정이 나간 순간 채널의 현재값은 우리가 들고 있던 기준값이 아니다.
       그대로 두면 요약은 계속 「변경사항 1건」이라 하고 버튼도 열려 있다. */
    expect(WORKSPACE).toContain(
      'if (platform === "smartstore" && result.status === "SUBMITTED" && channelEdit) {',
    );
    expect(WORKSPACE).toContain("수정을 보냈습니다.");
    const after = WORKSPACE.slice(WORKSPACE.indexOf('result.status === "SUBMITTED" && channelEdit'));
    expect(after).toContain("setChannelEdit(null);");
  });

  it("🔴 자동으로 다시 읽지 않는다 — 검수 중이면 옛 값이 온다", () => {
    const after = WORKSPACE.slice(
      WORKSPACE.indexOf('result.status === "SUBMITTED" && channelEdit'),
      WORKSPACE.indexOf("void refreshAttempts();"),
    );
    expect(after).not.toContain("loadChannelEdit");
    expect(WORKSPACE).toContain("[등록된 내용 불러오기]를 다시 눌러주세요");
  });

  it("권한 게이트가 «준 사유» 를 삼키지 않는다", () => {
    /* requireRegistrationAccess 는 error 키로, 이 라우트는 message 키로 답한다.
       message 만 읽으면 해결 방법이 분명한 사유가 「읽지 못했습니다」로 뭉개진다. */
    expect(WORKSPACE).toContain("data.message ?? data.error ??");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⑦ P0-CHANNEL-03 F-14-7b — **스크롤해도 우측 요약이 사라지지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 좌측 상세를 내려 편집하는 동안 「무엇이 바뀌는지」와 [상품 수정]이 화면에서
 * 사라지면, 셀러는 자기가 무엇을 보내는지 모르는 채로 버튼을 찾으러 올라간다.
 */
describe("⑦ 🔴 F-14-7b — 우측 기둥이 고정된다", () => {
  const FRAME = codeOnly(readFileSync(join(__dirname, "../ChannelRegistrationFrame.tsx"), "utf8"));

  it("sticky 가 «기둥» 에 걸려 있다 — 카드 안쪽이 아니다", () => {
    const column = FRAME.slice(FRAME.indexOf('className="order-1 lg:order-2'));
    expect(column).toContain("lg:sticky");
    expect(column).toContain("lg:top-4");
  });

  it("🔴 카드 안쪽의 sticky 는 «걷어냈다» — 겹쳐 걸면 둘 다 어긋난다", () => {
    const card = FRAME.slice(FRAME.indexOf('data-summary="channel-registration"'));
    expect(card).not.toContain("lg:sticky");
  });

  it("🔴 기둥이 화면보다 길어지면 «기둥 안에서» 스크롤된다", () => {
    /* 위만 붙어 있으면 아래쪽 [상품 수정]에 손이 닿지 않는다. */
    const column = FRAME.slice(FRAME.indexOf('className="order-1 lg:order-2'));
    expect(column).toContain("lg:overflow-y-auto");
    expect(column).toContain("lg:max-h-");
    expect(column).toContain("lg:self-start");
  });

  it("🔴 `fixed` 로 만들지 않았다 — 스크롤 주인은 AppShell 의 main 이다", () => {
    expect(FRAME).not.toContain("fixed");
  });

  it("불러오기 전 카드도 «같은 기둥» 에 선다", () => {
    expect(SUMMARY).toContain("export function ChannelEditLoaderCard");
    expect(WORKSPACE).toContain("<ChannelEditLoaderCard");
    /* 불러오기 전/후가 «같은 자리»(editSummary 슬롯)에서 갈린다. */
    const iSlot = WORKSPACE.indexOf("editSummary={");
    const slot = WORKSPACE.slice(iSlot, WORKSPACE.indexOf("naverResolved=", iSlot));
    expect(slot).toContain("<ChannelEditSummary");
    expect(slot).toContain("<ChannelEditLoaderCard");
  });
});
