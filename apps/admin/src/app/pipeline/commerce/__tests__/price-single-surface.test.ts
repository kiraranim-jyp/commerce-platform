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

/**
 * PHASE 3.2(CPO 확정, 2026-09-11) — ②가 말하는 것이 한 단계 바뀌었다.
 *
 * UX 2.5의 ②는 "채널 화면은 판매가를 읽기만 한다"였다. 그 근거는 데이터에
 * 채널별 가격이라는 개념이 없다는 사실이었고, 그건 그때 사실이었다. 이번에
 * 바뀐 것은 화면이 아니라 데이터 모델이다 — CanonicalProduct.channelPriceOverrides가
 * 생겼고, 채널마다 다른 등록가를 실제로 저장한다.
 *
 * 그래서 이 블록이 지키는 것은 이제 "읽기 전용"이 아니라 **역할 분리**다:
 * 채널 화면은 그 채널의 최종 등록가격만 만질 수 있고, 상품의 기준가를 고치는
 * 통로(PriceEditor와 그 setter 넷)는 여전히 여기 없다. 그 통로가 하나라도
 * 돌아오면 셀러는 다시 "가격을 채널마다 관리한다"고 읽는다.
 */
describe("② 채널 화면은 그 채널의 최종 등록가격만 만지고, readiness가 갈 곳은 그대로 있다", () => {
  const channelPriceSection = read("../ChannelPriceSection.tsx");

  it("등록에 쓰일 그 값(listing.priceKrw)을 그대로 보여준다 — 따로 계산하지 않는다", () => {
    // 채널 화면이 그리는 숫자는 어댑터가 이미 해석해 넘긴 값 하나뿐이다.
    expect(platformPreview).toContain("priceKrw={listing.priceKrw}");
    expect(channelPriceSection).toContain("formatKrw(priceKrw)");
    // UNRESOLVED일 때 0을 "판매가격"이라고 부르지 않는다(어댑터가 0으로 채우는 자리다).
    expect(channelPriceSection).toContain('priceOrigin === "UNRESOLVED"');
    expect(channelPriceSection).toContain('"미확정"');
    // 계산기가 쓰던 입력(마진율/수수료율/배송비)을 여기서 다시 그리지 않는다.
    expect(platformPreview).not.toContain("computePriceBreakdown");
    expect(channelPriceSection).not.toContain("computePriceBreakdown");
  });

  it("기본은 읽기 전용이고, [수정]을 눌러야만 이 채널 전용 값이 생긴다", () => {
    // 편집창이 처음부터 펼쳐져 있으면 UX 2.5 이전으로 돌아간다 —
    // 셀러가 채널마다 가격을 따로 정해야 한다고 읽는 화면이다.
    expect(channelPriceSection).toContain("const [editing, setEditing] = useState(false);");
    expect(channelPriceSection).toContain("상품정보 가격을 사용합니다");
    expect(channelPriceSection).toContain("이 채널만");
    expect(channelPriceSection).toContain("※ 이 채널(");
    // 되돌릴 길이 반드시 있어야 한다 — 한 번 고치면 못 돌아오는 값이 아니다.
    expect(channelPriceSection).toContain("상품정보 가격 사용");
    expect(channelPriceSection).toContain("onUpdateChannelPrice(null)");
  });

  it("채널 화면에서 상품정보 가격으로 가는 길이 남아 있다", () => {
    expect(channelPriceSection).toContain("상품정보 가격 계산 →");
    expect(channelPriceSection).toContain("onClick={onRequestPriceReview}");
    expect(platformPreview).toContain("onRequestPriceReview={onRequestPriceReview}");
  });

  it("채널 가격 변경 경로에 서버 호출이 하나도 없다 — MI가 다시 돌 이유가 생기지 않는다", () => {
    expect(channelPriceSection).not.toContain("fetch(");
    const at = workspace.indexOf("function updateChannelPriceKrw");
    expect(at).toBeGreaterThan(-1);
    const body = workspace.slice(at, workspace.indexOf("\n  }", at));
    expect(body).toContain("setProduct(");
    expect(body).not.toContain("fetch(");
    // 상품의 기준가를 같이 건드리지 않는다 — 이 한 줄이 UX 불변식의 전부다.
    expect(body).not.toContain("priceOverrideKrw");
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

/**
 * PHASE 3.2 추가지시(CPO, 2026-09-11) — 가격 계산 카드의 순서를 원래대로 되돌린다.
 *
 * UX 2.5에서는 계산 사슬이 카드의 본문이었고 최종 판매가격이 그 아래였다.
 * CPO가 옛 화면과 나란히 두고 확인한 결론은 반대다: 셀러가 이 카드에 오는
 * 이유는 "그래서 얼마에 팔 건가"이고, 그 답이 스크롤 끝에 있으면 카드를 다
 * 읽어야 답이 나온다. 결론을 맨 위에 두고 근거를 그 아래 순서대로 둔다.
 *
 * 계산은 한 줄도 바뀌지 않았다 — computePriceBreakdown() 하나가 여전히 유일한
 * 산식이다. 바뀐 것은 읽는 순서뿐이다.
 */
describe("④ 가격 계산 카드는 결론(최종 판매가격) → 근거(가격 계산 상세) 순이다", () => {
  const editor = read("../PriceEditor.tsx");
  const finalPriceAt = editor.indexOf("최종 판매가격\n            {product.priceOverrideKrw && (");
  const detailAt = editor.indexOf("{detailOpen && (");
  const chainAt = editor.indexOf('<Row label="원본 가격"');

  it("최종 판매가격이 카드 맨 위에 있고, 계산 상세는 그 아래다", () => {
    expect(finalPriceAt).toBeGreaterThan(-1);
    expect(finalPriceAt).toBeLessThan(detailAt);
    expect(chainAt).toBeGreaterThan(detailAt);
    // 결론 옆에는 "적용" 버튼과 저장 여부 안내만 있다 — 계산 입력이 올라오지 않는다.
    expect(editor).toContain("최종 판매가격에 적용");
    expect(editor).toContain("아직 저장된 값이 없어 권장 판매가격을 보여주고 있습니다");
  });

  it("상세는 기본으로 펼쳐져 있다 — 보러 온 것을 한 번 더 접지 않는다", () => {
    expect(editor).toContain("const [detailOpen, setDetailOpen] = useState(true);");
    expect(editor).toContain('detailOpen ? "▾ 가격 계산 상세" : "▸ 가격 계산 상세"');
    // open prop으로 "요약만 그리기" 분기를 다시 만들지 않는다.
    expect(editor).not.toContain("if (!open)");
  });

  it("상세 안의 순서는 계산 순서 그대로다 — 원본 가격 → 환율 → 원화 환산 → 국제배송비 → 착지원가 → 예상 수수료 → 목표 마진 → 권장 판매가격 → 수수료 금액 → 예상 이익", () => {
    const order = [
      '<Row label="원본 가격"',
      '<Row label="환율">',
      "<Row label={PRICE_LINE_LABEL.SOURCE_PRICE_KRW}>",
      "<Row label={PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING}>",
      "{PRICE_LINE_LABEL.LANDED_COST}",
      '<Row label="예상 수수료">',
      '<Row label="목표 마진">',
      "권장 판매가격\n              <ValueBadge kind=\"aiSuggested\" />",
      '<Row label="예상 수수료 금액">',
      "예상 이익(최종 판매가격 기준)",
    ].map((needle) => editor.indexOf(needle));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 전부 상세 안이다 — 결론 옆에 계산 입력이 새지 않는다.
    expect(order[0]).toBeGreaterThan(detailAt);
  });

  it("수수료(%)는 결론 옆이 아니라 상세 안에 있다 — 채널이 둘인데 한 줄로 적을 수 없다", () => {
    expect(editor.indexOf('<Row label="예상 수수료">')).toBeGreaterThan(detailAt);
    expect(editor.indexOf('<Row label="예상 수수료 금액">')).toBeGreaterThan(detailAt);
    // 그렇다고 계산에서 빠진 것은 아니다 — 공식은 그대로다.
    expect(editor).toContain("feePercent: n");
  });

  it("라벨은 판단 카드의 사슬과 같은 표에서 나온다", () => {
    // 같은 숫자를 두 화면이 다른 이름으로 부르면 셀러는 다른 값이라고 읽는다.
    // CPO 목업의 "상품 원가"/"랜드드 코스트"를 그대로 쓰지 않는 이유가 이것이다 —
    // 그 이름은 판단 카드 ④ 수익성 사슬의 "원화 환산"/"착지원가"와 같은 숫자를
    // 가리키면서 다르게 불러, 이 저장소가 반복해서 고쳐 온 라벨 표류를 되살린다.
    expect(editor).toContain('import { PRICE_LINE_LABEL, PRICE_SECTION_TITLE } from "./price-hierarchy";');
    expect(editor).not.toContain('<Row label="상품 원가">');
    expect(editor).not.toContain("랜드드 코스트");
  });

  it("시장 정보는 이 카드에 없다 — 링크 한 줄로만 나간다", () => {
    // 시장 비교표/타국 표시가는 ②·③으로 돌아갔다. 블록이 아니라 링크여야
    // 한다 — 블록이 되는 순간 계산 카드가 다시 비교 카드가 된다.
    //
    // 막는 것은 조회와 렌더다(주석에서 "왜 내렸는지"를 설명하는 것은 괜찮다 —
    // 위 "채널 화면은 편집기를 import조차 하지 않는다"와 같은 규칙).
    expect(editor).not.toContain("/api/price-intelligence");
    expect(editor).not.toContain("sellerIntel");
    expect(editor).not.toContain("expandedIntel");
    expect(editor).not.toContain("function CountryPriceTable");
    expect(editor).not.toContain("<CountryPriceTable");
    expect(editor).toContain("onOpenMarketComparison");
    expect(editor).toContain("PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET");
    expect(editor).toContain("PRICE_SECTION_TITLE.DOMESTIC_COMPETITION");
    // 도착지는 이미 존재하는 근거 영역이다 — 새 화면을 만들지 않았다.
    expect(workspace).toContain("function handleOpenMarketComparison()");
    expect(workspace).toContain("onOpenMarketComparison={handleOpenMarketComparison}");
  });

  it("원본 가격은 지금까지처럼 직접 고칠 수 있다 — 편집 가능 여부를 이번에 바꾸지 않았다", () => {
    // 원본가 provenance(USER_EDITED 태깅)는 CommerceWorkspace.updateOriginalPrice가
    // 그대로 맡는다. 이 카드는 그 setter가 있을 때만 입력칸을 그린다.
    expect(editor).toContain("{onUpdateOriginalPrice ? (");
    expect(workspace).toContain("onUpdateOriginalPrice={updateOriginalPrice}");
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
