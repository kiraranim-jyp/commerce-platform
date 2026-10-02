import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProvenanceField } from "@commerce/shared";
import {
  CARE_LABEL_REFERENCE_TEXT,
  isCareLabelReferenceDefault,
  resolveCareInstructions,
  withCareLabelDefault,
} from "../care-instructions";
import { DETAIL_PAGE_REFERENCE_TEXT, resolveNoticeFieldValue } from "../reference-eligibility";
import { planProductBulkReference } from "../bulk-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ③ CARE-LABEL-REFERENCE (CPO 확정, 2026-10-01)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 재는 것은 「기본값이 들어가는가」가 아니라 **「들어가면 안 될 때 안 들어가는가」**다 —
 * 원본 우선 · 셀러 입력 보존 · ②와 충돌 없음 · 두 참조 문구 혼용 금지.
 */
const field = (value: string, source: ProvenanceField<string>["source"]): ProvenanceField<string> => ({
  value,
  source,
  confidence: source === "ORIGINAL" ? 0.7 : 0,
});

describe("① 문구 — 정확히 「케어라벨 참조」다", () => {
  it("확정 문구 그대로다", () => {
    expect(CARE_LABEL_REFERENCE_TEXT).toBe("케어라벨 참조");
  });

  it("🔴 「상품 상세페이지 참조」와 «다른» 문구다 — 혼용 금지", () => {
    expect(CARE_LABEL_REFERENCE_TEXT).not.toBe(DETAIL_PAGE_REFERENCE_TEXT);
    expect(CARE_LABEL_REFERENCE_TEXT).not.toContain("상세페이지");
  });
});

describe("② 우선순위 — 원본이 이긴다", () => {
  it("원본에 세탁정보가 있으면 원본을 쓴다", () => {
    const f = resolveCareInstructions("Machine wash at 30°C");
    expect(f.value).toBe("Machine wash at 30°C");
    expect(f.source).toBe("ORIGINAL");
  });

  it("공백만 있는 원본은 «없는 것» 으로 본다", () => {
    expect(resolveCareInstructions("   ").value).toBe(CARE_LABEL_REFERENCE_TEXT);
  });

  it("원본이 없으면 「케어라벨 참조」 · source=DEFAULT", () => {
    for (const empty of [null, undefined, ""]) {
      const f = resolveCareInstructions(empty);
      expect(f.value).toBe(CARE_LABEL_REFERENCE_TEXT);
      expect(f.source).toBe("DEFAULT");
    }
  });

  it("🔴 confidence 를 올리지 않는다 — 「라벨을 보라」는 말이고 «안다» 는 뜻이 아니다", () => {
    expect(resolveCareInstructions(null).confidence).toBe(0);
  });

  it("우리가 넣은 기본값인지 구분할 수 있다", () => {
    expect(isCareLabelReferenceDefault(resolveCareInstructions(null))).toBe(true);
    expect(isCareLabelReferenceDefault(resolveCareInstructions("찬물 세탁"))).toBe(false);
    /* 셀러가 «직접» 같은 문구를 입력한 경우는 기본값이 아니다 — source 가 다르다. */
    expect(isCareLabelReferenceDefault(field(CARE_LABEL_REFERENCE_TEXT, "USER_EDITED"))).toBe(false);
  });
});

describe("③ 🔴 기존 값을 덮지 않는다", () => {
  it("셀러가 입력한 값은 그대로 둔다", () => {
    const user = field("드라이클리닝만", "USER_EDITED");
    expect(withCareLabelDefault(user)).toBe(user); // 같은 객체 — 건드리지 않았다
  });

  it("원본 값도 그대로 둔다", () => {
    const original = field("Machine wash", "ORIGINAL");
    expect(withCareLabelDefault(original)).toBe(original);
  });

  it("🔴 셀러가 「상세페이지 참조」를 고른 상태를 덮지 않는다", () => {
    const referenced = field("", "DETAIL_PAGE_REFERENCE");
    expect(withCareLabelDefault(referenced)).toBe(referenced);
    /* 그 선택은 payload 에서 여전히 상세페이지 참조로 나간다. */
    expect(resolveNoticeFieldValue("careInstructions", referenced)).toBe(DETAIL_PAGE_REFERENCE_TEXT);
  });

  it("빈 칸일 때만 기본값이 들어간다", () => {
    expect(withCareLabelDefault(field("", "DEFAULT")).value).toBe(CARE_LABEL_REFERENCE_TEXT);
    expect(withCareLabelDefault(undefined).value).toBe(CARE_LABEL_REFERENCE_TEXT);
  });
});

describe("④ 🔴 ②(전체 참조 적용)와 충돌하지 않는다", () => {
  it("기본값이 들어간 뒤에는 전체 적용이 덮지 않는다", () => {
    const product = {
      itemName: field("", "DEFAULT"),
      modelName: field("", "DEFAULT"),
      weight: field("", "DEFAULT"),
      material: field("", "DEFAULT"),
      color: field("", "DEFAULT"),
      careInstructions: resolveCareInstructions(null), // ← 「케어라벨 참조」
      recommendedAge: field("", "DEFAULT"),
      importer: field("", "DEFAULT"),
    } as never;
    const plan = planProductBulkReference(product);
    expect(plan.applied).not.toContain("careInstructions");
    expect(plan.skipped.find((s) => s.field === "careInstructions")?.reason).toBe("HAS_VALUE");
    /* 나머지 7개는 정상 적용된다 — 하나 때문에 전체가 멈추지 않는다. */
    expect(plan.applied).toHaveLength(7);
  });

  it("🔴 그래서 payload 에 두 문구가 «섞이지» 않는다", () => {
    const care = resolveCareInstructions(null);
    expect(resolveNoticeFieldValue("careInstructions", care)).toBe(CARE_LABEL_REFERENCE_TEXT);
    expect(resolveNoticeFieldValue("careInstructions", care)).not.toBe(DETAIL_PAGE_REFERENCE_TEXT);
  });
});

describe("⑤ 🔴 payload 에 문자열을 «박아 넣지» 않았다", () => {
  const ROOT = join(__dirname, "../../../../..");
  const codeOnly = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

  it("채널 빌더가 「케어라벨 참조」를 직접 적지 않는다 — 한 곳에서만 만든다", () => {
    for (const rel of [
      "packages/listing/src/naver/build-payload.ts",
      "packages/listing/src/coupang/build-payload.ts",
      "packages/listing/src/lotteon/build-payload.ts",
    ]) {
      const code = codeOnly(readFileSync(join(ROOT, rel), "utf8"));
      expect(code, `${rel} 에 문구가 박혀 있다 — 세 곳이 갈라진다`).not.toContain(CARE_LABEL_REFERENCE_TEXT);
    }
  });

  it("수집 지점이 resolveCareInstructions 를 거친다", () => {
    const code = codeOnly(readFileSync(join(ROOT, "apps/admin/src/app/api/pipeline/canonical-product.ts"), "utf8"));
    expect(code).toContain("careInstructions: resolveCareInstructions(");
    /* 🔴 옛 인라인 삼항이 남아 있으면 두 경로가 생긴다. */
    expect(code).not.toContain('{ value: "", source: "DEFAULT", confidence: 0 },\n    options');
  });
});
