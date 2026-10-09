import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { suggestLotteOnNoticeItemCode } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P2 잔여 4건(CPO, 2026-10-09)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   ① 원산지 공식 홈페이지 조회        → 🔴 재료가 «없다». 아래 ④ 블록에 기록
 *   ② SmartStore 태그 payload 연결      → 공식 스펙 경로로 구현
 *   ③ 롯데ON 고시 pd_itms_list          → 🔴 채널이 값을 «주지 않는다» → 제안으로 가름
 *   ④ 롯데ON 카테고리 전체 경로         → 데이터가 이미 있었다(저장만 안 했다)
 */

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel: string) => readFileSync(join(__dirname, "../../../../../../..", rel), "utf8");

describe("② 🔴 SmartStore 태그 — 공식 스펙 «그 경로» 로만 간다", () => {
  const TYPES = strip(read("packages/listing/src/naver/types.ts"));
  const BUILD = strip(read("packages/listing/src/naver/build-payload.ts"));

  it("seoInfo 가 detailAttribute «자식» 으로 선언됐다 — originProduct 최상위가 아니다", () => {
    const at = TYPES.indexOf("export interface NaverDetailAttribute {");
    expect(at).toBeGreaterThan(-1);
    expect(TYPES.slice(at, at + 400), "detailAttribute 안에 seoInfo 가 없다").toContain("seoInfo?: NaverSeoInfo;");

    /* 🔴 productCertificationInfos 가 이 위치를 틀려서 5차 연속 같은 거부를
       맞았다. 같은 축이므로 originProduct 쪽에 생기면 FAIL 한다. */
    const og = TYPES.indexOf("export interface NaverOriginProduct {");
    expect(og).toBeGreaterThan(-1);
    const end = TYPES.indexOf("}", og);
    expect(TYPES.slice(og, end), "seoInfo 가 originProduct 최상위에 있다").not.toContain("seoInfo");
  });

  it("빌더가 keywords 를 sellerTags 로 옮긴다 — 입력원을 새로 만들지 않았다", () => {
    expect(BUILD).toContain("seoInfo: { sellerTags: tags }");
    expect(BUILD).toContain("product.keywords.value");
  });

  it("🔴 값 형식이 {text} 객체 배열이다 — 문자열 배열이 아니다", () => {
    expect(BUILD).toContain(".map((text) => ({ text }))");
  });

  it("🔴 code 를 넣지 않는다 — 불일치 시 요청 «전체» 가 실패한다", () => {
    const at = BUILD.indexOf("seoInfo: { sellerTags: tags }");
    const region = BUILD.slice(Math.max(0, at - 600), at + 200);
    expect(region, "code 를 만들어 넣고 있다").not.toContain("code:");
  });

  it("🔴 태그가 없으면 seoInfo 자체를 보내지 «않는다» — 빈값은 기존 태그를 삭제한다", () => {
    expect(BUILD).toContain("tags.length > 0 ? { seoInfo: { sellerTags: tags } } : {}");
  });

  it("🔴 개수 상한을 상수로 박지 «않았다» — 공식 스펙에 maxItems 가 없다", () => {
    const at = BUILD.indexOf("seoInfo: { sellerTags: tags }");
    const region = BUILD.slice(Math.max(0, at - 800), at + 200);
    for (const bad of ["slice(0, 10", "slice(0,10", "MAX_SELLER_TAGS"]) {
      expect(region, `근거 없는 상한(${bad})이 들어갔다`).not.toContain(bad);
    }
  });

  it("기존 태그 보존·중복제거는 그대로다 — mergeKeywords 한 규칙", () => {
    const ws = strip(read("apps/admin/src/app/pipeline/CommerceWorkspace.tsx"));
    expect(ws).toContain("mergeKeywords(prev.keywords.value");
  });
});

describe("③ 🔴 롯데ON 고시 — 채널이 안 주므로 «제안» 한다", () => {
  it("의류 경로 → 01 을 제안한다", () => {
    const s = suggestLotteOnNoticeItemCode(["스포츠/레저", "테니스", "테니스의류", "테니스상의"]);
    expect(s.code).toBe("01");
    expect(s.reason).toContain("확인해 주세요");
  });

  it("🔴 유아동 의류 → 23 이 «먼저» 다 — 규제가 무거운 쪽이 이긴다", () => {
    const s = suggestLotteOnNoticeItemCode(["유아동패션", "유아동의류", "원피스"]);
    expect(s.code).toBe("23");
  });

  it("🔴 가방 경로에는 제안하지 않는다 — 「테니스 가방」을 의류로 신고하지 않게", () => {
    const s = suggestLotteOnNoticeItemCode(["가방/지갑", "남성가방", "가방"]);
    expect(s.code).toBeNull();
    expect(s.reason).toContain("직접 골라 주세요");
  });

  it("🔴 모르면 null 이고 그 사실을 숨기지 않는다", () => {
    expect(suggestLotteOnNoticeItemCode([]).code).toBeNull();
    expect(suggestLotteOnNoticeItemCode(["식품", "과자"]).code).toBeNull();
  });

  it("🔴 아는 스키마 둘만 제안한다 — notice-schema 가 아는 품목과 일치", () => {
    const schema = strip(read("packages/listing/src/lotteon/notice-schema.ts"));
    expect(schema).toContain('"01": NOTICE_ITEM_01_CLOTHING');
    expect(schema).toContain('"23": NOTICE_ITEM_23_CHILDREN');
    /* 제안 함수의 반환 타입이 그 둘로 «닫혀» 있어야 한다. */
    const suggest = strip(read("packages/listing/src/lotteon/notice-item-suggest.ts"));
    expect(suggest).toContain('code: "01" | "23" | null;');
  });

  it("🔴 화면이 «확정» 하지 않는다 — 셀러가 버튼을 눌러야 들어간다", () => {
    const panel = strip(read("apps/admin/src/app/pipeline/commerce/LotteOnRegistrationPanel.tsx"));
    expect(panel).toContain("suggestLotteOnNoticeItemCode(");
    expect(panel).toContain("로 설정");
    /* 셀러가 이미 그 값을 골랐으면 제안을 띄우지 않는다(잔소리 금지). */
    expect(panel).toContain("form.notice.itemCode.trim() === suggestion.code");
    /* 🔴 picker 는 그대로 남는다 — 제안이 셀러 선택을 대체하지 않는다. */
    expect(panel).toContain("<CommonCodePicker");
  });

  it("🔴 빈 응답의 «원인» 이 코드에 기록돼 있다 — 다음 세션이 재조사하지 않게", () => {
    const panel = read("apps/admin/src/app/pipeline/commerce/LotteOnRegistrationPanel.tsx");
    expect(panel).toContain("pd_itms_list");
    expect(panel).toContain("채널이 그 값을 주지 않는다");
  });
});

describe("④ 🔴 롯데ON 카테고리 전체 경로", () => {
  const PANEL = strip(read("apps/admin/src/app/pipeline/commerce/LotteOnRegistrationPanel.tsx"));
  const FORM = strip(read("apps/admin/src/app/pipeline/commerce/lotteon-channel-form.ts"));
  const TYPES = strip(read("packages/shared/src/product-types.ts"));

  it("선택 결과에 path 를 «저장» 한다 — 탭을 떠나도 남는다", () => {
    const at = TYPES.indexOf("export interface LotteOnSelectedCategoryFacts {");
    expect(at).toBeGreaterThan(-1);
    expect(TYPES.slice(at, at + 300)).toContain("path?: string[];");
    expect(FORM).toContain("...(path?.length ? { path: [...path] } : {})");
  });

  it("후보를 고를 때 경로를 «넘긴다» — 선언만 하고 안 넘긴 실수가 세 번 있었다", () => {
    expect(PANEL).toContain("applyCategory(candidate.category, candidate.path)");
  });

  it("세 자리 모두 전체 경로를 적는다 — 스마트스토어·쿠팡과 같은 표현", () => {
    expect(PANEL).toContain('path.join(" > ")');
    expect(PANEL).toContain("categoryPathText(selectedCategory)");
    expect(PANEL).toContain("selectedPathText");
  });

  it("🔴 경로를 모르면 이름으로 폴백한다 — 지어내지 않는다", () => {
    expect(PANEL).toContain('path.length > 0 ? path.join(" > ") : (selected?.name ?? "")');
  });

  it("🔴 추천 점수·선택 로직은 건드리지 않았다(CPO 명시)", () => {
    const scoring = strip(read("packages/category/src/candidate-scoring.ts"));
    expect(scoring).toContain("const APPAREL_CONFLICT");
    expect(scoring).toContain("conflict: true,");
  });

  it("🔴 저장 왕복에서 path 가 사라지지 않는다 — 직렬화 경로에도 있다", () => {
    expect(FORM).toContain("...(form.category.selected.path?.length ? { path: [...form.category.selected.path] } : {})");
  });
});

describe("① 🔴 원산지 공식 홈페이지 조회 — «재료가 없다» 를 기록한다", () => {
  /* 🔴 이 블록은 「안 했다」를 숨기지 않기 위한 것이다. 다음 세션이 「왜 안
     했지」로 재조사를 열지 않게, 막힌 지점을 코드로 고정한다. */

  it("브랜드 → 공식몰 도메인 역조회가 «없다»", () => {
    const facts = strip(read("packages/crawler/src/comparison-search/seller-facts.ts"));
    /* 있는 것은 도메인 → 브랜드 «단방향» 1건뿐이다. */
    expect(facts).toContain("OFFICIAL_STORE_BRANDS");
    expect(facts).toContain('"bobochoses.com"');
  });

  it("브랜드 프로필에 공식몰 URL 칸이 «없다»", () => {
    const bp = strip(read("apps/admin/src/app/api/coupang/_lib/brand-profile.ts"));
    const at = bp.indexOf("export interface BrandProfile {");
    const region = bp.slice(at, bp.indexOf("}", at));
    for (const k of ["officialUrl", "siteUrl", "homepage", "officialDomain"]) {
      expect(region, `공식몰 URL 칸(${k})이 생겼다 — 이 기록을 갱신해야 한다`).not.toContain(k);
    }
  });

  it("🔴 robots.txt 확인 함수가 «없다» — 수집을 늘리기 전에 그것이 먼저다", () => {
    const limiter = strip(read("packages/crawler/src/utils/direct-html-fetch.ts"));
    expect(limiter).not.toContain("robots");
  });

  it("🔴 manufacturingCountry 를 «만들지 않았다» — 기존 경계 가드가 살아 있다", () => {
    const shared = strip(read("packages/shared/src/product-types.ts"));
    expect(shared, "제조국 필드가 생겼다 — wire06 경계를 같이 갱신해야 한다").not.toContain(
      "manufacturingCountry",
    );
  });

  it("🟢 그 대신 한 것 — 폴백 «전» 에 원본을 세 곳에서 읽는다", () => {
    const cp = strip(read("apps/admin/src/app/api/pipeline/canonical-product.ts"));
    expect(cp).toContain("extractCountryOfOrigin(productData.description)");
    expect(cp).toContain("extractCountryOfOrigin(productData.material)");
    expect(cp).toContain("extractCountryOfOrigin(productData.title)");
  });
});
