import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PREPARE_SURFACE_LABEL, prepareSurfaceOf } from "../stage-focus";
import { MARKET_SIGNAL_NOT_STARTED, resolveWorkflow, type WorkflowInput } from "../workflow";

/**
 * UX 2.5(CEO 지시, 2026-09-11) — 판매가격을 고치는 화면은 하나다.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 데이터 계층에서는 이미 "채널별 가격"이라는 개념이 없었다. 모든 어댑터가
 * resolveListingPrice() 하나를 부르고, 스마트스토어와 쿠팡이 같은 숫자를
 * 받는다는 사실은 packages/marketplace/src/__tests__/listing-price-contract.test.ts가
 * 못박고 있다. 그런데 **화면**은 그렇게 말하지 않았다: PriceEditor가 채널
 * 화면(PlatformPreview) 안에 있어서, 탭을 옮길 때마다 가격 편집기가 하나씩
 * 따로 떠 있었다. 셀러 눈에는 "쿠팡 가격"과 "스마트스토어 가격"이 따로 있는
 * 것처럼 보였고, 그건 데이터에 존재하지도 않는 구분이다.
 *
 * ── 왜 소스 텍스트를 검사하는가 ──────────────────────────────────────────
 * single-action-center.test.ts / price-display-layout.test.ts와 같은 이유다.
 * 이건 계산 규칙이 아니라 **배치 규칙**이라 순수 함수로 표현할 수가 없는데,
 * 깨지는 방식은 늘 똑같다: 누군가 "쿠팡 탭에서도 바로 가격을 고칠 수 있으면
 * 편한데"라며 편집기를 한 벌 더 렌더한다. 그 순간 이 지시 전체가 되돌아간다.
 *
 * 이 테스트가 실패하면 고쳐야 할 것은 테스트가 아니라 배치다.
 */
/** 줄바꿈은 정규화한다 — 이 저장소의 작업 트리는 CRLF라, 여러 줄짜리 배치
 * 검사를 그냥 하면 "코드가 맞는데 테스트만 실패"하는 위장 실패가 난다. */
function read(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
}

const workspace = read("../../CommerceWorkspace.tsx");
const platformPreview = read("../PlatformPreview.tsx");
const stageBody = read("../StageBody.tsx");

/** apps/admin/src 전체에서 `<PriceEditor` JSX 사용처를 센다(import/정의 제외). */
function priceEditorMountFiles(): string[] {
  const srcRoot = fileURLToPath(new URL("../../../..", import.meta.url));
  const files = readdirSync(srcRoot, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `${srcRoot}/${name}`);
  return files.filter((file) => /<PriceEditor\b/.test(readFileSync(file, "utf8")));
}

describe("① 가격 편집기는 상품정보 ③ 등록 준비에만 있다", () => {
  it("<PriceEditor> 마운트 지점이 코드 전체에서 정확히 하나다", () => {
    const mounts = priceEditorMountFiles();
    expect(mounts).toHaveLength(1);
    expect(mounts[0].replace(/\\/g, "/")).toMatch(/\/pipeline\/CommerceWorkspace\.tsx$/);
  });

  it("그 하나가 ③ 등록 준비의 작업면(surfaces.price)으로 들어간다", () => {
    // StageBody가 받는 surfaces 객체 안이라는 것이, 곧 "③에서 열리는 화면"이라는 뜻이다.
    const mountAt = workspace.indexOf("<PriceEditor");
    const surfacesAt = workspace.indexOf("surfaces={{");
    const surfacesEndAt = workspace.indexOf("archive={", surfacesAt);
    expect(surfacesAt).toBeGreaterThan(-1);
    expect(mountAt).toBeGreaterThan(surfacesAt);
    expect(mountAt).toBeLessThan(surfacesEndAt);
    // 작업면 이름은 stage-focus.ts의 PrepareSurface와 1:1이다.
    expect(stageBody).toContain('if (surface === "PRICE") return <>{surfaces.price}</>;');
    expect(prepareSurfaceOf("price")).toBe("PRICE");
    expect(PREPARE_SURFACE_LABEL.PRICE).toBe("가격 계산");
  });

  it("채널 화면은 편집기를 import조차 하지 않는다", () => {
    // 주석에서 "왜 내렸는지"를 설명하는 것은 괜찮다 — 막는 것은 import와 렌더다.
    expect(platformPreview).not.toContain('from "./PriceEditor"');
    expect(platformPreview).not.toMatch(/<PriceEditor\b/);
    // 값을 바꿀 수 있는 통로 자체를 남기지 않는다 — prop이 남아 있으면 언젠가
    // 두 번째 편집 UI가 그 prop을 타고 되살아난다.
    for (const setter of [
      "onUpdateSalePriceKrw",
      "onUpdateOriginalPrice",
      "onUpdatePriceBreakdown",
      "onUpdateCustomsCost",
    ]) {
      expect(platformPreview).not.toContain(setter);
    }
  });
});

describe("② 채널 화면은 판매가를 읽기만 하고, readiness가 갈 곳은 그대로 있다", () => {
  it("등록에 쓰일 그 값(listing.priceKrw)을 그대로 보여준다 — 따로 계산하지 않는다", () => {
    expect(platformPreview).toContain("formatKrw(listing.priceKrw)");
    // UNRESOLVED일 때 0을 "판매가격"이라고 부르지 않는다(어댑터가 0으로 채우는 자리다).
    expect(platformPreview).toContain('listing.priceSource === "UNRESOLVED" ? "미확정"');
    // 계산기가 쓰던 입력(마진율/수수료율/배송비)을 여기서 다시 그리지 않는다.
    expect(platformPreview).not.toContain("computePriceBreakdown");
  });

  it("읽기전용이라는 사실과 고치러 갈 길을 화면이 직접 말한다", () => {
    expect(platformPreview).toContain("가격은 상품정보에서 관리됩니다");
    expect(platformPreview).toContain("가격 수정하기");
    expect(platformPreview).toContain("onClick={onRequestPriceReview}");
  });

  it('id="section-price"가 살아 있다 — readiness의 스크롤 경로가 끊기지 않는다', () => {
    // readiness.ts의 LABEL_TO_SECTION["판매가격"]과 naverFieldSection(
    // "originProduct.salePrice")이 둘 다 이 id로 데려간다. 섹션을 지우면
    // readiness.test.ts의 "갈 곳 없는 required 항목은 없다" 계약이 조용히 깨진다.
    expect(platformPreview).toContain('sectionProps("section-price")');
    const readiness = read("../readiness.ts");
    expect(readiness).toContain('판매가격: "section-price"');
    expect(readiness).toContain('if (field === "originProduct.salePrice") return "section-price";');
  });
});

describe("③ 가격으로 가는 길은 전부 같은 한 곳으로 모인다", () => {
  const input: WorkflowInput = {
    collection: { running: false, percent: 100, productReady: true, imageCount: 8, failedImageCount: 0 },
    market: MARKET_SIGNAL_NOT_STARTED,
    prepare: {
      categoryVerified: false,
      productInfoOk: true,
      productInfoMissing: null,
      optionGroupCount: 1,
      imageCount: 8,
      detailReady: true,
      priceResolved: true,
      priceKrw: 143500,
      requiredFieldBlockingCount: 0,
    },
    register: { channels: [] },
  };

  it("③ 체크리스트의 '판매가격' 항목이 price로 데려간다", () => {
    const price = resolveWorkflow(input).steps[2].subSteps.find((s) => s.key === "price");
    expect(price).toBeDefined();
    expect(price!.label).toBe("판매가격");
    expect(price!.target).toBe("price");
    // 숫자는 화면이 새로 계산한 값이 아니라 신호로 받은 그 값이다.
    expect(price!.message).toContain("143,500");
    expect(price!.status).toBe("DONE");
  });

  it("원본 가격을 못 읽으면 ⚠지만, 그것도 새 게이트가 아니다", () => {
    // resolveListingPrice()가 UNRESOLVED를 내는 바로 그 상태 = 어댑터의 "판매가격"
    // 검증이 이미 ERROR인 상태다. 화면이 막는 시점과 등록이 막히는 시점이 같다.
    const unresolved = resolveWorkflow({
      ...input,
      prepare: { ...input.prepare, priceResolved: false, priceKrw: null },
    });
    const price = unresolved.steps[2].subSteps.find((s) => s.key === "price");
    expect(price!.status).toBe("ATTENTION");
    expect(price!.target).toBe("price");
  });

  it('navigateWorkflow("price")와 [가격 수정하기]가 같은 함수 하나로 모인다', () => {
    expect(workspace).toContain('if (target === "price") {\n      handleRequestPriceReview();');
    expect(workspace).toContain("onRequestPriceReview={handleRequestPriceReview}");
  });

  it("그 함수는 채널 탭이 아니라 상품정보로 데려간다", () => {
    const fnAt = workspace.indexOf("function handleRequestPriceReview()");
    const body = workspace.slice(fnAt, workspace.indexOf("\n  }", fnAt));
    expect(body).toContain('setTab("source")');
    // 예전 동작(첫 번째 등록 가능 채널 탭으로 점프)이 남아 있지 않다.
    expect(body).not.toContain("PLATFORM_ORDER");
    expect(body).toContain("PRICE_SURFACE_ANCHOR_ID");
    // 앵커는 편집기 노드 자체에 붙어 있어서, ③에서 펼치든 아래 접힘에서 열든 따라간다.
    expect(workspace).toContain("<div id={PRICE_SURFACE_ANCHOR_ID}");
  });

  it("③이 현재 단계가 아니어도 열 수 있다 — 두 번째 편집기를 만들지 않고서", () => {
    // ②에서 [가격/마진 확인]을 누르는 것이 가장 흔한 경로다. 그때 ③ 체크리스트는
    // 그려지지도 않으므로, 아래 "언제든 열어볼 수 있는 것"의 같은 노드를 펼친다.
    expect(stageBody).toContain('expandedSurface !== "PRICE" && (');
    expect(stageBody).toContain("openPriceSurfaceRequest");
    // 두 자리가 동시에 그려지지 않는다 — surfaces.price 사용처는 정확히 둘이고
    // 서로 배타적인 분기 안에 있다(이미지와 같은 규칙).
    expect(stageBody.match(/\{surfaces\.price\}/g) ?? []).toHaveLength(2);
  });
});

describe("④ 가격 계산 카드의 주 사슬에는 수수료가 없다", () => {
  const editor = read("../PriceEditor.tsx");
  const chainAt = editor.indexOf('<Row label="원본 가격"');
  const suggestedAt = editor.indexOf("권장 판매가격\n            <ValueBadge kind=\"aiSuggested\" />");
  const detailAt = editor.indexOf("{detailOpen && (");

  it("사슬은 원본 가격 → 원화 환산 → 국제배송비 → 착지원가 → 기본 마진율 → 권장 판매가격 순이다", () => {
    // CEO가 그려 준 카드 그대로다. 순서가 바뀌면 "무엇을 더해서 이 값이 됐는지"를
    // 읽을 수 없게 된다.
    const order = [
      '<Row label="원본 가격"',
      "<Row label={PRICE_LINE_LABEL.SOURCE_PRICE_KRW}>",
      "<Row label={PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING}>",
      "{PRICE_LINE_LABEL.LANDED_COST}",
      '<Row label="기본 마진율">',
    ].map((needle) => editor.indexOf(needle));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(suggestedAt).toBeGreaterThan(order[order.length - 1]);
  });

  it("사슬이 접혀 있지 않다 — 보러 온 것을 한 번 더 접지 않는다", () => {
    expect(chainAt).toBeGreaterThan(-1);
    expect(chainAt).toBeLessThan(detailAt);
    // open prop으로 "요약만 그리기" 분기를 다시 만들지 않는다.
    expect(editor).not.toContain("if (!open)");
  });

  it("수수료(%)는 사슬이 아니라 상세 안에 있다 — 채널이 둘인데 한 줄로 적을 수 없다", () => {
    const feeAt = editor.indexOf('<Row label="예상 수수료">');
    expect(feeAt).toBeGreaterThan(detailAt);
    expect(editor.indexOf('<Row label="예상 수수료 금액">')).toBeGreaterThan(detailAt);
    // 그렇다고 계산에서 빠진 것은 아니다 — 공식은 그대로다.
    expect(editor).toContain("feePercent: n");
    expect(editor).toContain("채널 수수료는 이 사슬에 표시하지 않습니다");
  });

  it("라벨은 판단 카드의 사슬과 같은 표에서 나온다", () => {
    // 같은 숫자를 두 화면이 다른 이름으로 부르면 셀러는 다른 값이라고 읽는다.
    expect(editor).toContain('import { PRICE_LINE_LABEL } from "./price-hierarchy";');
    expect(editor).not.toContain('<Row label="상품 원가">');
    expect(editor).not.toContain("랜드드 코스트");
  });
});

describe("⑤ 가격을 고쳐도 시장 분석이 다시 돌지 않는다", () => {
  it("가격 커밋 경로에는 서버 호출이 하나도 없다", () => {
    // PriceEditor는 blur에서 이 setter들만 부른다. 여기에 fetch가 들어오는 순간
    // 숫자 하나 고칠 때마다 10~20초짜리 재분석이 붙는다.
    for (const setter of ["function updateSalePriceKrw", "function updatePriceBreakdown", "function updateOriginalPrice"]) {
      const at = workspace.indexOf(setter);
      expect(at).toBeGreaterThan(-1);
      const body = workspace.slice(at, workspace.indexOf("\n  }", at));
      expect(body).toContain("setProduct(");
      expect(body).not.toContain("fetch(");
    }
  });

  it("시장 분석 재조회는 스냅샷 교체와 자동 가격확인 종료에서만 일어난다", () => {
    const panel = read("../DomesticPriceIntelligencePanel.tsx");
    // runAnalysis()를 부르는 effect의 의존성은 이 둘뿐이다 — 상품 가격이 아니다.
    expect(panel).toContain("runAnalysis();\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [snapshotId]);");
    expect(panel).toContain("shouldRefetchAfterAutoCheck(was, Boolean(autoChecking))");
    // 패널은 product를 통째로 받지 않는다(가격이 바뀌어도 다시 그릴 이유가 없다).
    const mountAt = workspace.indexOf("<DomesticPriceIntelligencePanel");
    const mountBlock = workspace.slice(mountAt, workspace.indexOf("/>", mountAt));
    expect(mountBlock).not.toContain("product={product}");
  });
});
