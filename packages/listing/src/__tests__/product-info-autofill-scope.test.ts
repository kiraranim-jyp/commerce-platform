import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SELLER-UX-FINAL PHASE 2 — 상품정보 자동 활용 «범위» 를 고정한다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 「상품정보에 있는 데이터를 채널 필드에 자동으로 쓰자」는 요구를 세 번째로
 * 조사했다. 결론은 **대부분 이미 되어 있고, 안 하는 것은 이유가 있다** 였다.
 * 그 결론을 테스트로 박아 네 번째 조사를 막는다.
 *
 * 🔴 이 파일은 «원문 근거» 를 확인한다. 「이미 된다」는 말을 믿지 않고 그 코드가
 * 실제로 그 자리에 있는지 본다 — 조사 보고가 세 건 중 둘을 틀렸다(아래 참고).
 */
const ROOT = join(__dirname, "../../../..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

describe("A) 🔴 쿠팡 attributes 의 색상·소재 자동 매핑은 «이미» 있다", () => {
  /* 조사는 「attributes[] 가 항상 빈 배열」이라고 보고했다 — 틀렸다.
     그것은 categoryMeta 가 «없을 때» 의 분기이고, 있으면 아래 4단 우선순위가 돈다. */
  const SRC = codeOnly(read("packages/listing/src/coupang/build-payload.ts"));

  it("attributes 조립이 matchProductFieldDetailed 를 부른다", () => {
    expect(SRC).toContain("matchProductFieldDetailed(attr.attributeTypeName, context)");
  });

  it("🔴 색상·소재 동의어 규칙이 그 함수 안에 있다", () => {
    const fn = SRC.slice(SRC.indexOf("function matchProductFieldDetailed"), SRC.indexOf("return { status: \"NO_RULE\" }"));
    expect(fn).toContain("COLOR_SYNONYMS, productFields.color");
    expect(fn).toContain("MATERIAL_SYNONYMS, productFields.material");
  });

  it("🔴 값이 없으면 NO_VALUE 다 — 지어내지 않는다", () => {
    const fn = SRC.slice(SRC.indexOf("function matchProductFieldDetailed"), SRC.indexOf("export type ComplianceFieldSource"));
    expect(fn).toContain('return value ? { status: "MATCHED", value } : { status: "NO_VALUE" };');
  });

  it("우선순위가 사용자 입력 → 옵션값 → 상품필드 → 자리표시자 순이다", () => {
    const order = ["userOverrides?.[attr.attributeTypeName]", "matchOptionValue(attr.attributeTypeName", "matchProductFieldDetailed(attr.attributeTypeName"];
    let prev = -1;
    for (const needle of order) {
      const at = SRC.indexOf(needle);
      expect(at, needle).toBeGreaterThan(prev);
      prev = at;
    }
  });

  it("🔴 그래서 «추가 구현이 없다» — 새 매핑 함수를 만들지 않았다", () => {
    expect(SRC).not.toContain("matchColorAttribute");
    expect(SRC).not.toContain("matchMaterialAttribute");
  });
});

describe("B) 🔴 네이버 modelName 연결은 «이미» 있고, 조건이 «완전하다»", () => {
  const NAVER = codeOnly(read("packages/listing/src/naver/build-payload.ts"));

  it("원문 추출 1순위 · 사용자 입력 2순위로 연결된다 (N-4.11 STEP7)", () => {
    expect(NAVER).toContain("resolveModelNameFromDescription(product.description.value) ||");
    expect(NAVER).toContain('product.modelName.source === "USER_EDITED"');
  });

  /* 🔴 「ORIGINAL 로 수집된 모델명이 떨어진다」고 의심했다. 확인 결과 **수집
     파이프라인은 modelName 을 채우지 않는다** — 항상 REQUIRED(빈 값)로 시작한다.
     그래서 USER_EDITED 조건에 빠진 것이 없다. 이 사실이 바뀌면(수집이 모델명을
     뽑기 시작하면) 이 테스트가 깨져서 조건을 다시 보게 된다. */
  it("🔴 수집은 modelName 을 채우지 않는다 — 그래서 ORIGINAL 누락이 없다", () => {
    const pipeline = read("apps/admin/src/app/api/pipeline/canonical-product.ts");
    expect(pipeline).toContain('modelName: { value: "", source: "REQUIRED", confidence: 0 }');
  });

  it("🔴 모델명을 «지어내는» 생성기를 만들지 않았다", () => {
    expect(NAVER).not.toContain("generateModelName");
    /* 원문 추출기는 하나뿐이다. */
    expect((NAVER.match(/function resolveModelNameFromDescription/g) ?? []).length).toBe(1);
  });
});

describe("C) 🔴 쿠팡 searchTags ← keywords 는 «하지 않는다» — 근거가 없다", () => {
  /* 조사는 「의도적 미사용인지 누락인지 불명」이라고 했다. 재 보니 답은 셋째였다:
     **연결해도 얻는 것이 없다.** `keywords` 는 실제로 채워지지 않는다. */
  it("🔴 수집이 keywords 를 «빈 배열» 로 둔다", () => {
    const pipeline = read("apps/admin/src/app/api/pipeline/canonical-product.ts");
    expect(pipeline).toContain('keywords: { value: [], source: "ORIGINAL", confidence: 0 }');
  });

  it("🔴 keywords 를 채우는 유일한 경로가 «비활성» content 탭이다", () => {
    const ws = codeOnly(read("apps/admin/src/app/pipeline/CommerceWorkspace.tsx"));
    /* generateContent 가 keywords 를 채우는 그 함수다.
       P5.6 Phase 4(2026-10-09) — 그 줄이 mergeKeywords 로 감싸졌다. 요지는
       「keywords 를 채우는 경로가 여기 하나뿐」이고 그것은 그대로다. 그래서
       «생성기 호출» 과 «병합» 을 둘 다 확인한다 — 느슨해지지 않는다. */
    expect(ws).toContain("mockProductContentProvider.generateKeywords(prev)");
    expect(ws, "기존 태그를 덮지 않고 병합하는지").toContain("mergeKeywords(prev.keywords.value");
    /* 🔴 P5.6 P1-6(2026-10-09) — 이 탭은 «여전히» disabled 다. 한 번 열었다가
       되돌렸다: URGENT ④(CPO, 2026-10-03)가 「이 탭은 LLM 이 아니라 결정론적
       템플릿이라 「AI」 라벨이 셀러를 오해시킨다」는 이유로 준비중을 결정했고,
       그 판단이 여전히 유효하다.
       🔴 그래서 태그는 «이 탭을 여는 것» 이 아니라 상품정보 화면에 칸을 내어
          푼다(그것이 CPO P1-6 의 요구다 — 「상품정보에서 조회/수정」).
       🔴 그 전까지 keywords 는 비어 있고, 쿠팡 searchTags 는 «빈 배열» 이 된다.
          옵션 이름으로 채우지 않는다 — 없는 것을 다른 것으로 채우는 것이
          이 저장소가 반복해 고친 실수다. */
    expect(ws).toContain('<TabButton active={tab === "content"} disabled');
  });

  it("🔴 ④ 상세설명 버튼도 keywords 를 건드리지 않는다 — 일부러 그렇게 좁혔다", () => {
    const ws = codeOnly(read("apps/admin/src/app/pipeline/CommerceWorkspace.tsx"));
    const wrapper = ws.slice(ws.indexOf("function generateDescriptionOnly()"), ws.indexOf("\n  }", ws.indexOf("function generateDescriptionOnly()")));
    expect(wrapper).not.toContain("keywords");
  });

  it("🔴 P5.6 P1-6 — searchTags 는 «태그» 다. 옵션 이름이 아니다", () => {
    const SRC = codeOnly(read("packages/listing/src/coupang/build-payload.ts"));
    /* 🔴 여기 들어가던 listing.options 는 옵션 «축 이름»("사이즈")이었다.
       검색태그 자리에 그것을 보내면 쿠팡 검색에 쓸모없는 말이 올라간다.
       전제(「태그는 항상 비어 있다」)는 같은 커밋에서 탭을 열며 사라졌다. */
    expect(SRC, "옵션 이름이 다시 검색태그로 간다").not.toContain("searchTags: listing.options");
    expect(SRC).toContain("searchTags: product.keywords.value");
    /* 🔴 비면 «빈 배열» 이다 — 없는 것을 다른 값으로 채우지 않는다. */
    expect(SRC).toContain('.map((t) => t.trim()).filter(Boolean)');
  });

  /* 🔴 다만 «별건의 결함» 으로 기록해 둔다: listing.options 는 옵션 그룹 «이름»
     이다(product-types.ts 의 @deprecated 주석이 그렇게 적어 뒀다). 즉 지금
     쿠팡 검색태그로 「Size」 같은 그룹 이름이 나간다. 그것을 무엇으로 채울지는
     상품 데이터로 정할 수 없는 «정책» 이라 이번 범위에서 고치지 않는다. */
  it("🔴 options 가 옵션 그룹 «이름» 이라는 사실을 기록해 둔다 — 별건의 결함", () => {
    const types = read("packages/shared/src/product-types.ts");
    expect(types).toContain("@deprecated optionGroups[].name으로 대체됐다");
    expect(types).toContain("검색태그");
  });
});

describe("D) 🔴 「일부러 안 하는」 결정을 뒤집지 않았다", () => {
  it("importer 는 상품 데이터로 채우지 않는다 — 참조만 허용", () => {
    const naver = read("packages/listing/src/naver/build-payload.ts");
    expect(naver).toContain('resolveNoticeFieldValue("importer", product.importer)');
    /* 구매대행이라고 해서 판매자가 법적으로 수입자인 것은 아니다(N-3.45 STEP8). */
    expect(naver).toContain("수입자");
  });

  it("itemName·weight 는 bulk 참조 대상이고 자동 «생성» 이 아니다", () => {
    const bulk = read("packages/listing/src/notice/bulk-reference.ts");
    expect(bulk).toContain('"itemName"');
    expect(bulk).toContain('"weight"');
    /* 값을 지어내지 않고 source 로만 표시한다. */
    expect(bulk).toContain('value: ""');
  });

  it("🔴 롯데ON 원산지는 채널 공통코드만 쓴다 — 상품 값을 임의 매핑하지 않았다", () => {
    const lotteon = codeOnly(read("packages/listing/src/lotteon/build-payload.ts"));
    expect(lotteon).not.toContain("originCode: product.countryOfOrigin");
  });

  it("🔴 제조사는 bulk 전체적용에서 제외된 상태 그대로다", () => {
    const bulk = read("packages/listing/src/notice/bulk-reference.ts");
    expect(bulk).toContain('export const BULK_REFERENCE_EXCLUDED_FIELDS = ["manufacturer"] as const');
  });
});
