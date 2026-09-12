import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PREPARE_SURFACE_LABEL, prepareSurfaceOf } from "../stage-focus";
import { MARKET_SIGNAL_NOT_STARTED, resolveWorkflow, type WorkflowInput } from "../workflow";
import { stripComments } from "./source-text";

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

/** apps/admin/src 전체에서 주어진 컴포넌트의 JSX 사용처를 센다(import/정의 제외). */
function mountFiles(component: string): string[] {
  const srcRoot = fileURLToPath(new URL("../../../..", import.meta.url));
  const files = readdirSync(srcRoot, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `${srcRoot}/${name}`);
  return files.filter((file) => new RegExp(`<${component}\\b`).test(readFileSync(file, "utf8")));
}

describe("① 판매가격 확정 카드는 상품정보 ③ 등록 준비에만 있다", () => {
  it("<PriceEditor> 마운트 지점이 코드 전체에서 정확히 하나다", () => {
    const mounts = mountFiles("PriceEditor");
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
    // MI/PRICE-1(CEO 지시, 2026-09-12) — 이 작업면에서 계산이 사라졌으므로 이름도
    // 바뀐다. 접었을 때와 펼쳤을 때가 같은 말을 쓴다는 규칙은 그대로다.
    expect(PREPARE_SURFACE_LABEL.PRICE).toBe("💰 판매가격 확정");
    expect(read("../PriceEditor.tsx")).toContain("💰 판매가격 확정");
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
    // MI/PRICE-1 — 도착지 이름이 "가격 계산"에서 "판매가격 확정"으로 바뀌었다.
    // 길이 사라진 것이 아니라 그 카드가 하는 일이 바뀐 것이다.
    expect(channelPriceSection).toContain("상품정보 판매가격 확정 →");
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
 * MI/PRICE-1(CEO 지시, 2026-09-12) — **상세 계산은 제품 전체에서 한 컴포넌트뿐이다.**
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 가격이 두 번 계산되는 것처럼 보였다. 계산이 두 번 돈 적은 없다 — 갈라져 있던
 * 것은 정보의 소유권이다. MI가 원가·수익·마진을 말한 뒤, 바로 아래 "가격 계산"
 * 카드가 같은 것을 처음부터 다시 말했다. 셀러의 질문은 늘 같았다: "아까 MI에서
 * 가격 봤는데, 아래에서 왜 또 가격을 계산하지?"
 *
 * ── 이 블록이 지키는 규칙 ────────────────────────────────────────────────
 *   계산은 한 번, 표현은 두 번 이하.
 *   MI = 판단("왜 143,500원인가?")  ·  등록 준비 = 확정("143,500원으로 할 것인가?")
 *
 * PHASE 3.2에서 정한 "결론 먼저, 근거는 그 아래"는 그대로 유효하다 — 다만 그
 * 근거가 사는 카드가 바뀌었다. 계산은 한 줄도 바뀌지 않았다(산술 회귀는
 * price-judgement-card.test.ts가 실제 숫자로 고정한다).
 */
describe("④ 상세 계산은 MI ④ 수익성 한 곳에만 있고, ③ 등록 준비는 확정만 한다", () => {
  const editor = read("../PriceEditor.tsx");
  const detail = read("../PriceCalculationDetail.tsx");
  const panel = read("../DomesticPriceIntelligencePanel.tsx");
  /** 금지어 검사는 주석을 뺀 코드에만 건다 — 이 저장소는 "왜 내렸는지"를
   * 주석으로 길게 남기는 것이 규칙이라, 주석까지 막으면 근거를 지우게 된다. */
  const editorCode = stripComments(editor);

  it("<PriceCalculationDetail> 마운트 지점도 코드 전체에서 정확히 하나다", () => {
    // 상세 계산이 두 벌 생기면 이번 지시 이전으로 그대로 돌아간다. 마운트는
    // CommerceWorkspace 한 곳이고, MI는 그 노드를 슬롯으로 받기만 한다.
    const mounts = mountFiles("PriceCalculationDetail");
    expect(mounts).toHaveLength(1);
    expect(mounts[0].replace(/\\/g, "/")).toMatch(/\/pipeline\/CommerceWorkspace\.tsx$/);
    expect(workspace).toContain("priceCalculationDetail={priceCalculationDetail}");
    expect(panel).toContain("{priceCalculationDetail}");
  });

  it("계산 사슬은 ③ 등록 준비에 한 줄도 남아 있지 않다", () => {
    // 확정 카드가 답하는 질문은 하나다: "그래서 얼마로 팔 것인가."
    for (const banned of [
      "computePriceBreakdown",
      "국제배송비",
      "착지원가",
      "목표 마진",
      "환율",
      "원화 환산",
      "예상 수수료 금액",
      "관세",
      "부가세",
    ]) {
      expect(editorCode, `${banned}이(가) 확정 카드에 남아 있다`).not.toContain(banned);
    }
    // 계산 입력 setter도 통로째 없다 — prop이 남아 있으면 언젠가 두 번째 계산
    // UI가 그 prop을 타고 되살아난다(채널 화면에 적용한 규칙 그대로).
    for (const setter of ["onUpdateOriginalPrice", "onUpdatePriceBreakdown", "onUpdateCustomsCost"]) {
      expect(editorCode).not.toContain(setter);
    }
  });

  it("확정 카드에 남은 것은 권장가 · 최종가 · 적용 · 채널 안내 한 줄이다", () => {
    expect(editor).toContain("권장 판매가격");
    expect(editor).toContain("최종 판매가격에 적용");
    expect(editor).toContain("※ 적용한 가격은 채널 등록가격의 기본값으로 사용됩니다");
    // 권장가는 스스로 계산하지 않고 prop으로 받는다 — resolveListingPrice()가
    // 내는 그 값이라 확정 카드가 자기 산술을 가질 수 없다.
    expect(editor).toContain("recommendedPriceKrw: number | null;");
    expect(workspace).toContain("const recommendedPriceKrw = useMemo(");
    expect(workspace).toContain("priceOverrideKrw: null,");
    expect(workspace).toContain("recommendedPriceKrw={recommendedPriceKrw}");
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
      // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 두 줄의 라벨이 표에서 온다.
      // 같은 숫자를 수익성 요약과 이 사슬이 다른 이름으로 부르던 마지막 두 자리다.
      '{PRICE_MEANING_LABEL.RECOMMENDED_PRICE}\n          <ValueBadge kind="aiSuggested" />',
      '<Row label="예상 수수료 금액">',
      "{PRICE_MEANING_LABEL.EXPECTED_PROFIT}(최종 판매가격 기준)",
    ].map((needle) => detail.indexOf(needle));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("MI ④는 요약 넷 + 토글 하나다 — 계산이 펼치기 전에 새지 않는다", () => {
    const chainAt = panel.indexOf("<PriceChainView rows={priceChain} />");
    const toggleAt = panel.indexOf("ⓘ 가격 계산 기준 {caret(showPriceDetail)}");
    // MI-UX-FINAL-REVIEW — 패널이 둘로 갈리면서(바깥은 fetch, MiPanelView는
    // 렌더) `priceCalculationDetail={priceCalculationDetail}`라는 전달 줄이
    // 생겼고 그 줄이 이 marker를 먼저 문다. 슬롯이 실제로 그려지는 자리는
    // 토글 뒤에 있는 쪽이다.
    const slotAt = panel.indexOf("{priceCalculationDetail}", toggleAt);
    expect(chainAt).toBeGreaterThan(-1);
    expect(toggleAt).toBeGreaterThan(chainAt);
    expect(slotAt).toBeGreaterThan(toggleAt);
    // 슬롯은 토글 안에 있다(기본 접힘).
    expect(panel).toContain("{showPriceDetail && (");
  });

  it("수수료(%)는 요약이 아니라 상세 안에 있다 — 채널이 둘인데 한 줄로 적을 수 없다", () => {
    expect(detail).toContain('<Row label="예상 수수료">');
    expect(detail).toContain('<Row label="예상 수수료 금액">');
    expect(panel).not.toContain('<Row label="예상 수수료">');
    // 그렇다고 계산에서 빠진 것은 아니다 — 공식은 그대로다.
    expect(detail).toContain("feePercent: n");
  });

  it("라벨은 판단 카드의 사슬과 같은 표에서 나온다", () => {
    // 같은 숫자를 두 자리가 다른 이름으로 부르면 셀러는 다른 값이라고 읽는다.
    // CPO 목업의 "원상품 가격"/"기본 마진율"을 그대로 쓰지 않는 이유가 이것이다 —
    // 그 이름은 ④ 수익성 요약의 "착지원가"/"원화 환산"과 같은 숫자를 가리키면서
    // 다르게 불러, 이 저장소가 반복해서 고쳐 온 라벨 표류를 되살린다.
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 가져오는 표가 하나 늘었다. 권장
    // 판매가와 예상 이익도 이제 수익성 요약과 같은 문자열을 쓴다(같은 숫자를
    // 두 자리가 다른 이름으로 부르던 마지막 두 줄이었다). 반대로
    // PRICE_SECTION_TITLE은 더 이상 쓰지 않는다 — 그 이름을 쓰던 "다른 나라
    // 판매가…" 안내 문장이 사라졌기 때문이다.
    expect(detail).toContain('import { PRICE_LINE_LABEL, PRICE_MEANING_LABEL } from "./price-hierarchy";');
    expect(detail).not.toContain('<Row label="상품 원가">');
    expect(detail).not.toContain("랜드드 코스트");
  });

  it("시장 정보는 상세 계산에 없다 — 이제 링크 한 줄도 없다", () => {
    // 시장 비교표/타국 표시가는 판단 카드로 돌아갔다(PHASE 3.2).
    expect(detail).not.toContain("/api/price-intelligence");
    expect(detail).not.toContain("sellerIntel");
    expect(detail).not.toContain("expandedIntel");
    expect(detail).not.toContain("function CountryPriceTable");
    expect(detail).not.toContain("<CountryPriceTable");
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 그 자리에 남아 있던 "다른 나라
    // 판매가·한국 시장 경쟁가격은 …에서 확인하세요" 한 줄도 지웠다. 그 두
    // 블록은 이 접힘 **바로 위**에 있다 — 위로 올라가라고 시키는 문장은
    // 길잡이가 아니라 화면이 길어졌다는 신호다. 도착지 함수까지 함께 지운
    // 것이 장치다(부를 곳이 없으면 문장도 되살아나지 않는다).
    expect(stripComments(detail)).not.toContain("onOpenMarketComparison");
    expect(workspace).not.toContain("function handleOpenMarketComparison()");
    // 근거 영역의 앵커 자체는 그대로다 — MI 되물음 안의 버튼이 거기로 간다.
    expect(panel).toContain("PRICE_COMPARISON_ANCHOR_ID");
  });

  it("원본 가격은 지금까지처럼 직접 고칠 수 있다 — 편집 가능 여부를 이번에 바꾸지 않았다", () => {
    // 원본가 provenance(USER_EDITED 태깅)는 CommerceWorkspace.updateOriginalPrice가
    // 그대로 맡는다. 상세 계산은 그 setter가 있을 때만 입력칸을 그린다.
    expect(detail).toContain("{onUpdateOriginalPrice ? (");
    expect(workspace).toContain("onUpdateOriginalPrice={updateOriginalPrice}");
  });

  it("원본 가격을 못 읽었을 때 경고와 입력칸이 각각 한 곳에만 있다", () => {
    // 같은 경고가 두 카드에 뜨면 셀러는 문제가 둘인 줄 안다. 배너 원본과
    // 입력칸은 상세 계산이 갖고, 확정 카드는 "확정할 수 없다 + 여기로 가라"만
    // 말한다.
    expect(detail).toContain("function PriceUnresolvedBanner(");
    expect(detail).toContain("원본 가격 직접 입력");
    expect(editor).not.toContain("function PriceUnresolvedBanner(");
    expect(editor).not.toContain("원본 가격 직접 입력");
    expect(editor).toContain("원본 상품 가격을 확인할 수 없어 판매가격을 확정할 수 없습니다");
    // 가는 길은 실제로 있다(앵커 + 펼침 요청).
    expect(editor).toContain("onOpenPriceCalculation");
    expect(workspace).toContain("function handleOpenPriceCalculation()");
    expect(workspace).toContain("PRICE_CALCULATION_ANCHOR_ID");
    expect(workspace).toContain("openPriceDetailRequest={priceDetailRequest}");
  });

  it("[가격 계산 기준 보기]는 접힌 MI를 펼치고 간다 — 갈 곳이 없는 버튼이 아니다", () => {
    // ③④ 단계에서 MI는 결론 한 줄로 접힌다(stage-focus의 SUMMARY). 그 상태에서는
    // ④ 블록 자체가 렌더되지 않아, 펼치지 않고 스크롤만 하면 아무 일도 일어나지
    // 않는다. 이 세 줄이 한 세트로 있어야 길이 성립한다.
    const at = workspace.indexOf("function handleOpenPriceCalculation()");
    expect(at).toBeGreaterThan(-1);
    const body = workspace.slice(at, workspace.indexOf("\n  }", at));
    expect(body).toContain("setMarketDetailOpen(true)");
    expect(body).toContain("setPriceDetailRequest((n) => n + 1)");
    expect(body).toContain("PRICE_CALCULATION_ANCHOR_ID");
    // 그리고 이동일 뿐이다 — 여기서 계산하지도 조회하지도 않는다.
    expect(body).not.toContain("fetch(");
    expect(body).not.toContain("setProduct(");
  });
});

/**
 * MI/PRICE-1 — "같은 가격이 화면에 세 번 뜨지 않는다."
 *
 * 표현은 두 번까지 허용한다(판단하는 자리와 확정하는 자리). 세 번째가 생기는
 * 순간 그중 하나만 고쳐지는 날이 오고, 같은 상품이 화면 위아래에서 다른 값을
 * 말한다 — 이 저장소에서 반복된 버그 유형이다.
 */
describe("⑤ 한 가격은 두 자리까지만 그려진다", () => {
  /** 가격이 실제로 **숫자로** 그려질 수 있는 화면 전부. */
  const SURFACES = {
    확정카드: stripComments(read("../PriceEditor.tsx")),
    상세계산: stripComments(read("../PriceCalculationDetail.tsx")),
    MI패널: stripComments(read("../DomesticPriceIntelligencePanel.tsx")),
    채널가격: stripComments(read("../ChannelPriceSection.tsx")),
    ActionCenter: stripComments(read("../ActionCenter.tsx")),
  } as const;

  /** 라벨이 아니라 **값을 그리는 식**이 등장하는 화면 이름들. 라벨만 세면
   * "상품정보의 최종 판매가격은 바뀌지 않습니다" 같은 설명 문장까지 사본으로
   * 잡힌다 — 문제는 같은 라벨을 말하는 것이 아니라 같은 숫자를 세 번 그리는
   * 것이다. */
  function surfacesRendering(...valueExpressions: string[]): string[] {
    return Object.entries(SURFACES)
      .filter(([, source]) => valueExpressions.some((expr) => source.includes(expr)))
      .map(([name]) => name)
      .sort();
  }

  it("권장 판매가격의 값은 판단(상세 계산)과 확정(확정 카드) 두 자리뿐이다", () => {
    expect(
      surfacesRendering("formatKrw(recommendedPriceKrw)", "formatKrw(breakdown.suggestedPriceKrw)"),
    ).toEqual(["상세계산", "확정카드"]);
  });

  it("최종 판매가격의 값은 확정 카드(편집)와 채널 화면(읽기) 두 자리뿐이다", () => {
    // 채널 화면은 어댑터가 해석해 넘긴 listing.priceKrw를 읽기만 한다 —
    // 세 번째로 그리는 곳이 생기면 그중 하나만 고쳐지는 날이 온다.
    expect(surfacesRendering("String(finalPriceKrw)", "formatKrw(priceKrw)")).toEqual(["채널가격", "확정카드"]);
  });

  it("착지원가의 값은 ④ 요약과 상세 계산 두 자리뿐이다", () => {
    // ④ 요약은 price-hierarchy.ts가 만든 문자열 행(row.value)을 그대로 그리고,
    // 상세 계산은 같은 breakdown에서 자기 줄을 그린다. 둘 다 같은 산식
    // (computePriceBreakdown)에서 나오므로 갈릴 수 없다.
    expect(surfacesRendering("formatKrw(breakdown.landedCostKrw)", "{row.value}")).toEqual(["MI패널", "상세계산"]);
  });

  it("오른쪽 Action Center에는 어떤 가격도 그려지지 않는다", () => {
    // UX 2.4.1에서 정한 그대로 — 결론만 갖는다.
    expect(SURFACES.ActionCenter).not.toContain("formatKrw");
    expect(SURFACES.ActionCenter).not.toContain("₩");
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
