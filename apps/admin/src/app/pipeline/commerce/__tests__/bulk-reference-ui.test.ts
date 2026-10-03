import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BULK_REFERENCE_FIELDS,
  NOTICE_REFERENCE_ELIGIBLE_FIELDS,
  NOTICE_KC_FIELDS_NEVER_REFERENCE_ELIGIBLE,
} from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ② UI 연결 — manufacturer 가 «어떤 bulk 경로에서도» 빠지는가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 확정 ⓐ: 패널 전체에서 manufacturer 제외. 참조를 넣으면
 * `resolveManufacturer` 의 5단 폴백이 멈추고, 브랜드 관리·판매자 기본값의 더
 * 정확한 제조사를 참조가 덮는다. **체크박스로 «고르는» 경우에도 위험은 같다.**
 *
 * 🔴 소스 검사는 주석을 벗기고 한다 — 이 파일들의 주석에는 설명을 위해
 * "manufacturer" 라는 글자가 여러 번 나온다([[source-scan-must-strip-comments]]).
 */
const DIR = __dirname;
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

const PANEL = codeOnly(readFileSync(join(DIR, "../MissingFieldsBulkPanel.tsx"), "utf8"));
const WORKSPACE = codeOnly(readFileSync(join(DIR, "../../CommerceWorkspace.tsx"), "utf8"));

describe("① 🔴 manufacturer 가 bulk 경로에서 빠진다", () => {
  it("패널이 BULK_REFERENCE_FIELDS(8개)를 순회한다 — 9개 화이트리스트를 직접 쓰지 않는다", () => {
    expect(PANEL).toContain("BULK_REFERENCE_FIELDS.filter");
    expect(PANEL, "9개 화이트리스트를 직접 순회하면 제조사가 다시 들어온다").not.toContain(
      "NOTICE_REFERENCE_ELIGIBLE_FIELDS.filter",
    );
  });

  it("🔴 패널 코드에 manufacturer 라는 «식별자» 가 남아 있지 않다", () => {
    expect(PANEL).not.toContain("manufacturer");
  });

  it("🔴 일괄 적용 함수의 타입이 8개로 «좁혀져» 있다 — 컴파일러가 막는다", () => {
    expect(WORKSPACE).toContain("function bulkSetFieldReference(keys: BulkReferenceField[])");
    expect(WORKSPACE).not.toContain("bulkSetFieldReference(keys: NoticeReferenceEligibleField[])");
  });

  it("상수 자체가 manufacturer 를 제외한다 — 목록이 두 벌로 갈리지 않는다", () => {
    expect(BULK_REFERENCE_FIELDS as readonly string[]).not.toContain("manufacturer");
    expect(NOTICE_REFERENCE_ELIGIBLE_FIELDS as readonly string[]).toContain("manufacturer");
    expect(BULK_REFERENCE_FIELDS).toHaveLength(NOTICE_REFERENCE_ELIGIBLE_FIELDS.length - 1);
  });
});

describe("② 🔴 제조사의 «개별» 참조 선택은 그대로다", () => {
  it("PlatformPreview 에 manufacturer 행의 onSetReference 가 살아 있다", () => {
    const preview = codeOnly(readFileSync(join(DIR, "../PlatformPreview.tsx"), "utf8"));
    expect(preview).toContain('onSetFieldReference?.("manufacturer"');
  });

  it("개별 setter 는 9개를 그대로 받는다 — 일괄만 좁혔다", () => {
    expect(WORKSPACE).toContain('"manufacturer" | "careInstructions"');
  });
});

describe("③ 전체 적용 버튼 — 규칙을 다시 쓰지 않는다", () => {
  it("버튼이 있고 문구가 지시 그대로다", () => {
    expect(PANEL).toContain("상세페이지 참조 전체 적용");
  });

  it("🔴 planProductBulkReference 가 판정한다 — 패널이 빈칸/멱등 규칙을 다시 구현하지 않는다", () => {
    expect(PANEL).toContain("planProductBulkReference(product)");
    /* 패널이 직접 source 를 쓰지 않는다 — 적용은 기존 onBulkApply(setProduct)다. */
    expect(PANEL).not.toContain("DETAIL_PAGE_REFERENCE");
  });

  it("결과 문구도 공통 함수가 만든다", () => {
    expect(PANEL).toContain("describeBulkReferencePlan(bulkPlan)");
  });

  it("🔴 기존 체크박스 경로가 «남아 있다» — 개별 선택 기능 유지", () => {
    expect(PANEL).toContain("전체 선택");
    expect(PANEL).toContain("onClick={apply}");
    expect(PANEL).toContain("onBulkApply(Array.from(checked))");
  });

  it("적용은 기존 일괄 setter 하나를 쓴다 — 개별 state 업데이트를 새로 만들지 않았다", () => {
    expect(PANEL).toContain("onBulkApply(bulkPlan.applied)");
  });
});

describe("④ KC 필드와 카탈로그 모델명은 올 수 없다", () => {
  it("🔴 KC 필드가 대상 상수에 없다", () => {
    for (const kc of NOTICE_KC_FIELDS_NEVER_REFERENCE_ELIGIBLE) {
      expect(BULK_REFERENCE_FIELDS as readonly string[]).not.toContain(kc);
      expect(PANEL, `${kc} 가 패널 코드에 있다`).not.toContain(kc);
    }
  });

  it("카탈로그 모델명은 CanonicalProduct 필드가 아니라 대상이 될 수 없다", () => {
    expect(PANEL).not.toContain("naverShoppingSearchInfo");
  });

  it("🔴 모델명이 «절반만» 채워진다는 경고가 남아 있다", () => {
    /* REWORK-8 ① — 이 경고를 지우면 셀러가 「처리했다」고 믿고 막다른 길로 간다. */
    expect(PANEL).toContain("「고시정보 모델명」만 채워집니다");
  });
});

describe("⑤ 위치와 중복", () => {
  it("패널이 «한 번만» 마운트된다 — 같은 기능이 두 자리에 생기지 않는다", () => {
    const occurrences = (WORKSPACE.match(/<MissingFieldsBulkPanel/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("상품정보(source) 탭 안에 있다", () => {
    const sourceTabStart = WORKSPACE.indexOf('tab === "source" &&');
    const panelAt = WORKSPACE.indexOf("<MissingFieldsBulkPanel");
    expect(sourceTabStart).toBeGreaterThan(-1);
    expect(panelAt).toBeGreaterThan(sourceTabStart);
  });

  it("쓰이지 않는 prop 을 남기지 않았다", () => {
    expect(PANEL).not.toContain("manufacturerResolution");
    expect(WORKSPACE).not.toContain("manufacturerResolution={manufacturerResolution}\n                  />");
  });
});

describe("⑥ 출처 표시는 기존 배지를 그대로 쓴다", () => {
  it("🔴 DEFAULT 를 세분화하지 않았다 — 「기본값」 하나다", () => {
    const badge = codeOnly(readFileSync(join(DIR, "../provenance.tsx"), "utf8"));
    expect(badge).toContain('DEFAULT: "기본값"');
    /* 🔴 지시 8: isCareLabelReferenceDefault 같은 신규 필드별 판정을 만들지 않는다. */
    expect(badge).not.toContain("isCareLabelReferenceDefault");
    expect(PANEL).not.toContain("isCareLabelReferenceDefault");
  });

  it("다섯 출처 라벨이 모두 있다", () => {
    const badge = codeOnly(readFileSync(join(DIR, "../provenance.tsx"), "utf8"));
    for (const label of ['ORIGINAL: "원본"', 'DEFAULT: "기본값"', 'DETAIL_PAGE_REFERENCE: "상세페이지 참조"']) {
      expect(badge).toContain(label);
    }
  });
});
