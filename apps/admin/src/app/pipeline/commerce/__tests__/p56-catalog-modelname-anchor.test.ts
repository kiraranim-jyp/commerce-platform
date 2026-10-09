import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG_MODEL_NAME_ANCHOR, CATALOG_MODEL_NAME_LABEL } from "../SourceDataView";
import { REGISTRATION_FIELD_ANCHOR, registrationFieldAnchor } from "../readiness-state";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P0-1(CEO 실측, 2026-10-09) — **「입력하기」가 그 칸으로 가야 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측: SmartStore 등록이 「네이버 쇼핑 카탈로그 모델명」 하나로 막혔는데
 * 안내의 이동 버튼을 눌러도 **입력 위치를 찾지 못했다.**
 *
 * 원인: 이동 장치(goToSection(sectionId, fieldAnchorId))는 이미 앵커 기반인데
 * 앵커 표에 «원산지 두 줄» 뿐이라 이 칸은 앵커가 없어 섹션 첫 칸(상품명)으로
 * 떨어졌다.
 *
 * 🔴 1차 시도에서 입력칸을 <div> 로 감쌌다가 3열 격자 계약이 깨져
 *    rework12 가드에 잡혔다 — 원복하고 FieldRow «root» 에 다는 방식으로 고쳤다.
 *    그래서 DOM 구조는 한 바이트도 바뀌지 않는다(anchorId 가 없으면 undefined).
 */
const PREVIEW = readFileSync(new URL("../PlatformPreview.tsx", import.meta.url), "utf8");
const FIELDS = readFileSync(new URL("../registration-fields.tsx", import.meta.url), "utf8");
const DEF = readFileSync(new URL("../SourceDataView.tsx", import.meta.url), "utf8");

describe("🔴🔴 ① 안내가 그 칸의 앵커를 찾는다", () => {
  it("라벨로 앵커를 찾을 수 있다", () => {
    expect(REGISTRATION_FIELD_ANCHOR[CATALOG_MODEL_NAME_LABEL]).toBe(CATALOG_MODEL_NAME_ANCHOR);
  });

  it("화면 라벨(모델명(고시 + 카탈로그))로도 찾힌다 — 셀러가 보는 이름이다", () => {
    expect(REGISTRATION_FIELD_ANCHOR["모델명(고시 + 카탈로그)"]).toBe(CATALOG_MODEL_NAME_ANCHOR);
  });

  it("우선순위 항목으로 찾힌다", () => {
    const item = { label: CATALOG_MODEL_NAME_LABEL, sourceItems: [] } as never;
    expect(registrationFieldAnchor(item)).toBe(CATALOG_MODEL_NAME_ANCHOR);
  });

  it("🔴 원산지 앵커가 그대로다 — 회귀 없음", () => {
    expect(REGISTRATION_FIELD_ANCHOR["원산지"]).toBe("field-countryOfOrigin");
  });
});

describe("🔴🔴 ② 앵커가 «모델명 칸» 에 실제로 달린다", () => {
  it("호출부가 그 칸에 anchorId 를 준다", () => {
    const at = PREVIEW.indexOf("anchorId={CATALOG_MODEL_NAME_ANCHOR}");
    expect(at, "모델명 칸에 anchorId 가 없다").toBeGreaterThan(-1);
    expect(PREVIEW.slice(Math.max(0, at - 1500), at)).toContain("field={product.modelName}");
  });

  it("ReferenceEligibleFieldRow 가 FieldRow 로 «내려보낸다» — 받고 버리지 않는다", () => {
    expect(PREVIEW).toContain("anchorId={anchorId}");
  });

  it("FieldRow root 가 그 id 를 단다", () => {
    expect(FIELDS).toContain('<div id={anchorId} className="flex h-full min-w-0 flex-col">');
  });

  it("🔴 바깥을 <div> 로 감싸지 «않았다» — 3열 격자 계약을 지킨다", () => {
    expect(PREVIEW).not.toContain("<div id={CATALOG_MODEL_NAME_ANCHOR}");
  });
});

describe("🔴 ③ id 문자열을 한 곳에만 적는다", () => {
  it("정의는 SourceDataView 한 곳", () => {
    expect((DEF.match(/"field-catalogModelName"/g) ?? []).length).toBe(1);
  });
  it("화면·표는 리터럴을 쓰지 않는다", () => {
    expect(PREVIEW).not.toContain('"field-catalogModelName"');
    expect(FIELDS).not.toContain('"field-catalogModelName"');
  });
});

describe("🔴 ④ 차단 문구와 라벨이 같은 말을 쓴다", () => {
  it("검증기 문장이 이 라벨을 포함한다", () => {
    const validator = readFileSync(
      new URL("../../../../../../../packages/listing/src/naver/validate-payload.ts", import.meta.url),
      "utf8",
    );
    expect(validator).toContain(CATALOG_MODEL_NAME_LABEL);
  });
});
