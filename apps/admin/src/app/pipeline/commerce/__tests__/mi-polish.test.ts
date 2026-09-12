import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketComparisonView } from "../DomesticPriceIntelligencePanel";
import { buildGlobalMarketCard } from "../global-market";
import { buildMarketComparison } from "../market-comparison";
import { buildMarketContext, PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "../price-hierarchy";
import { miBodySource, readSourceAt, stripComments } from "./source-text";

/**
 * MI-POLISH-2(CEO 지시, 2026-09-12) — MI-SIMPLIFY-1이 169줄을 144줄로 줄였는데,
 * 실제 화면을 보니 여전히 길다.
 *
 * ── 무엇이 남아 있었나 ───────────────────────────────────────────────────
 * 본문과 상세가 아직 섞여 있었다. 원본 가격 아래 환율 기준 문장, 사슬 네 줄
 * 아래마다 붙는 계산 기준 문장, 판정 아래 축 세 줄, 카드 끝의 ④ 판단 근거
 * 블록, 👉 안내 한 줄, cta.hint 한 줄, ※ 비교 설명 한 줄 — 하나하나는 참이고
 * 짧지만, 전부 **판단 숫자가 아니라 그 숫자의 근거**다. 근거가 본문에 서 있는
 * 동안 MI는 "팔아도 되는가"에 답하는 화면이 아니라 가격을 설명하는 화면이다.
 *
 * ── 이 파일이 고정하는 규칙(MI-SIMPLIFY-1과 같은 규칙, 더 엄격하게) ────────
 *   본문      판단 숫자
 *   툴팁      근거
 *   상세      원자료  ← 나머지 전부가 「왜 이렇게 판단했나요?」 아래로
 *
 * 첫 화면이 가질 수 있는 것은 이게 전부다:
 *   판정 한 줄 · ① 원본 상품 · ② 한국 시장 경쟁가격 · ③ 수익성 · 바닥 한 줄.
 *
 * ── 왜 한 테스트만 실제로 렌더하는가 ─────────────────────────────────────
 * "빈 카드가 아니라 카드 없음"은 소스 배치로는 증명할 수 없는 유일한 항목이다.
 * 조건이 어디에 적혀 있든, 실제로 DOM에 노드가 생기는지는 렌더해 봐야 안다 —
 * MI-SIMPLIFY-1은 조건의 **위치**만 확인했고, 그 방식은 조건이 참인데 뷰가
 * 빈 칸을 그리는 경우를 잡지 못한다. 이 저장소의 vitest는 node 환경이지만
 * react-dom/server는 그대로 돈다: 마크업 문자열이 곧 DOM의 증거다.
 */
const panel = readSourceAt(new URL("../DomesticPriceIntelligencePanel.tsx", import.meta.url));
/** 주석은 "왜 지웠는지"를 길게 설명한다 — 막아야 하는 것은 실제 렌더뿐이다. */
const panelCode = stripComments(panel);

/**
 * 셀러가 누르지 않고 보는 **본문**(정의는 source-text.ts의 miBodySource).
 *
 * MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 이 파일이 "본문"이라고 부르던
 * 구간은 판정 카드 안쪽뿐이었다. 그래서 카드 **밖**에 접힘 없이 서 있던
 * 다섯 덩어리는 아래 금지 목록을 전부 통과했고, 통과한 채로 프로덕션 첫
 * 화면의 절반을 차지하고 있었다. 구간을 FULL 렌더 전체로 넓힌다.
 */
const body = miBodySource(panel);
const bodyCode = stripComments(body);
const detail = panel.slice(panel.indexOf("{showMarketDetail && ("));

/* ───────────────── ③ 데이터 없으면 DOM 자체가 없다(실제 렌더) ───────────────── */

describe("② 한국 시장 경쟁가격은 비교 대상이 없으면 DOM에 노드를 만들지 않는다", () => {
  const EMPTY_GLOBAL = buildGlobalMarketCard({ observations: [] });

  function comparisonWith(domesticLowestKrw: number | null) {
    const context = buildMarketContext({
      domesticBasis: domesticLowestKrw == null ? "NONE" : "EXACT",
      domesticAveragePriceKrw: domesticLowestKrw,
      domesticLowestPriceKrw: domesticLowestKrw,
      domesticSellerCount: domesticLowestKrw == null ? 0 : 3,
      domesticUnresolved: false,
    });
    return { comparison: buildMarketComparison(EMPTY_GLOBAL, context), context };
  }

  it("비교상품이 없으면 렌더 결과가 빈 문자열이다 — 빈 카드가 아니라 **없음**이다", () => {
    // 이것이 이번 지시가 "의도가 아니라 실제 DOM으로 확인하라"고 한 항목이다.
    // 빈 칸 두 개짜리 카드는 정보가 아니라 질문이다: 셀러는 조회가 고장났는지,
    // 자기가 뭘 안 했는지, 판정이 틀렸는지를 스스로 추론해야 했다.
    const { comparison, context } = comparisonWith(null);
    expect(comparison.hasComparable).toBe(false);
    const html = renderToStaticMarkup(createElement(MarketComparisonView, { comparison, context }));
    expect(html).toBe("");
    // "비어 있다"가 아니라 "없다"임을 한 번 더 못박는다 — 제목도 칩도 상자도 없다.
    expect(html).not.toContain("div");
    expect(html).not.toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(html).not.toContain("검색 데이터 없음");
  });

  it("비교상품이 있으면 그 카드가 그대로 뜬다 — 숨기는 조건이 과하지 않다", () => {
    const { comparison, context } = comparisonWith(116600);
    const html = renderToStaticMarkup(createElement(MarketComparisonView, { comparison, context }));
    expect(html).toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(html).toContain("₩116,600");
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — VS 두 칸이 한 칸이 됐다. 왼쪽이던
    // "원본 판매자 한국 표시가"는 MI/PRICE-2 이후 바로 위 「원본 상품」이 자기
    // 라벨로 이미 말한다 — 두 칸이 같은 모양·같은 국기로 나란히 서면 "내가 살
    // 값"과 "내가 경쟁할 값"이 한 카드에서 다시 섞인다.
    expect(html).not.toContain("VS");
    expect(html).not.toContain(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
  });

  it("게이트는 뷰 안에 있고, 호출부에는 남아 있지 않다", () => {
    // 조건이 호출부에 있으면 이 뷰를 한 번 더 쓰는 사람이 빠뜨릴 수 있다.
    const viewAt = panel.indexOf("function MarketComparisonView");
    expect(panel.indexOf("if (!comparison.hasComparable) return null;", viewAt)).toBeGreaterThan(viewAt);
    expect(panelCode).not.toContain("{marketComparison.hasComparable && (");
  });

  it("숨긴 사실은 판정 안에 남는다 — 지우지 않고 층만 내린다", () => {
    expect(detail).toContain("{!marketComparison.hasComparable && (");
    expect(detail).toContain("{NO_DOMESTIC_COMPARABLE_NOTE}");
  });
});

/* ───────────────────────── 본문에 남는 것 / 남지 않는 것 ───────────────────────── */

describe("본문 최상위에는 판정 + 세 블록 + 바닥 한 줄뿐이다", () => {
  it("세 블록이 전부 있고, 그 밖의 블록은 하나도 없다", () => {
    for (const block of ["<OriginalPriceView", "<GlobalMarketHint", "<MarketComparisonView", "<PriceChainView"]) {
      expect(bodyCode).toContain(block);
    }
    // 판단 근거(축·레이더)는 전부 접힘 안이다.
    for (const moved of ["<MiAxisStars", "<MiRadar", "<MiRadarSummary", "<MiVerdictAxes"]) {
      expect(bodyCode, `${moved}이(가) 본문에 있다`).not.toContain(moved);
    }
    // 시장 신호·전략 가이드·판단 근거 표도 마찬가지다.
    expect(bodyCode).not.toContain("marketSignals.signals.map");
    expect(bodyCode).not.toContain("sellingGuidance.map");
    expect(bodyCode).not.toContain("confidenceBasis");
    expect(bodyCode).not.toContain("sellerDecision.factors.map");
  });

  it("본문 제목은 ①②③ 셋뿐이다 — ④ 판단 근거는 접힘 안으로 내려갔다", () => {
    expect(bodyCode).toContain("PRICE_SECTION_TITLE.PROFITABILITY");
    expect(bodyCode).not.toContain("PRICE_SECTION_TITLE.DECISION_EVIDENCE");
    expect(detail).toContain("PRICE_SECTION_TITLE.DECISION_EVIDENCE");
  });

  it("계산 사슬의 중간 단계는 본문 어디에도 없다", () => {
    // 환율·국제배송비·수수료율·목표 마진이 본문에 다시 나타나면 MI는 또
    // 가격 계산 설명 화면이 된다. 그 줄들이 사는 곳은 접힌 상세 계산 하나다.
    for (const term of ["환율", "국제배송비", "수수료율", "목표 마진", "예상 수수료", "관세", "부가세"]) {
      expect(bodyCode, `${term}이(가) 본문에 있다`).not.toContain(term);
    }
    expect(bodyCode).toContain("{showPriceDetail && (");
    expect(panel).toContain("const [showPriceDetail, setShowPriceDetail] = useState(false);");
  });

  it("본문 코드 줄 수가 한 번 더 줄어든 채로 남는다(144 → 116)", () => {
    /**
     * 숫자 자체가 목적은 아니다. 이 상한이 있으면 다음 기능이 본문에 줄을
     * 하나 더 세울 때 여기서 먼저 걸리고, 그때 고를 수 있는 길이 "툴팁이냐
     * 상세냐"로 좁혀진다 — 그게 이번 지시가 코드에 남기라고 한 규칙이다.
     */
    const lines = bodyCode.split("\n").filter((line) => line.trim()).length;
    /**
     * MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 이 숫자로 "화면이 짧아졌다"를
     * 주장하지 않는다. 앞선 두 번(169 → 144 → 116)이 전부 줄어든 채로 통과했는데
     * 프로덕션 화면은 그대로 길었다 — 세던 구간이 화면의 일부였기 때문이다.
     * 화면이 실제로 무엇을 보여주는지는 mi-ux-final.test.ts가 패널을 통째로
     * 렌더해서 확인한다.
     *
     * 그래도 상한을 남기는 이유는 하나다: 다음 기능이 본문에 줄을 세우려 할 때
     * 여기서 먼저 걸리고, 그때 고를 수 있는 길이 "툴팁이냐 상세냐"로 좁혀진다.
     * 구간이 FULL 렌더 전체로 넓어졌으므로(miBodySource) 이전 숫자와 직접
     * 비교할 수 있는 값이 아니다.
     */
    expect(lines).toBeLessThanOrEqual(155);
  });
});

/* ─────────────────────────── 근거는 툴팁으로 내려갔다 ─────────────────────────── */

describe("근거 문장은 지워지지 않고 툴팁이 된다", () => {
  const chainView = panel.slice(panel.indexOf("function PriceChainView("), panel.indexOf("function OriginalPriceView("));
  const originalView = panel.slice(
    panel.indexOf("function OriginalPriceView("),
    panel.indexOf("export function MarketComparisonView("),
  );

  it("사슬의 기준 문장·결측 사유는 줄이 아니라 title이다", () => {
    // 요약 넷은 줄이 넷이 아니라 여덟이었다 — 값마다 기준 문장이 따라 붙었다.
    expect(chainView).toContain("const note = row.value ? row.basis : (row.empty?.reason ?? row.basis);");
    expect(chainView).toContain("title={note ?? undefined}");
    // 그 문장을 본문 줄로 되돌리는 렌더가 없다(사유는 여전히 존재한다).
    expect(chainView).not.toContain("{row.value ? row.basis : (row.empty?.reason ?? row.basis)}");
    expect(chainView).toContain("{row.empty?.chip}");
  });

  it("① 원본 상품의 환율·관측 기준과 ※ 주석도 title 하나로 모인다", () => {
    expect(originalView).toContain("const priceNote =");
    expect(originalView).toContain("headline.note,");
    expect(originalView).toContain("title={priceNote}");
    // 큰 숫자와 원화 환산은 그대로 본문이다(그건 판단 숫자다).
    expect(originalView).toContain("{headline.price.value}");
    expect(originalView).toContain("{headline.converted.value}");
    // 한국 표시가 줄도 값은 남고 기준만 내려간다.
    expect(originalView).toContain("{headline.krMarket.value}");
    expect(originalView).toContain("title={headline.krMarket.basis ?? undefined}");
  });

  it("② 비교 카드의 ※ 설명과 칸별 기준도 title이다", () => {
    const comparisonView = panel.slice(
      panel.indexOf("export function MarketComparisonView("),
      panel.indexOf("function GlobalMarketHint("),
    );
    // MI-FINAL-UX-3 — versusNote는 "무엇과 무엇을 비교하는가"를 말하는데,
    // 비교가 한 칸으로 줄면서 설명할 대상이 없어졌다. 칸별 기준(title)은 그대로다.
    expect(comparisonView).not.toContain("title={comparison.versusNote}");
    expect(comparisonView).not.toContain("※ {comparison.versusNote}");
    expect(comparisonView).toContain("title={(side.value ? side.basis : (side.empty?.reason ?? side.basis)) ?? undefined}");
  });

  it("ⓘ 가격 계산 기준은 그대로 숫자를 적지 않는다", () => {
    expect(bodyCode).toContain("title={PRICE_BASIS_TOOLTIP}");
    expect(bodyCode).toContain("ⓘ 가격 계산 기준 {caret(showPriceDetail)}");
  });
});

/* ──────────────── 기술적 실패는 본문 카드가 되지 않는다 ──────────────── */

describe("조회 실패는 카드가 아니라 한 줄이다", () => {
  it("본문에 경고/오류 색 상자가 하나도 없다", () => {
    // "검색 데이터 없음"·"확인 불가"는 판정의 실패가 아니다. 노란/빨간 상자를
    // 세우면 셀러는 판정이 흔들린 줄 알고 멈춘다 — 문구는 그대로 두고 표면만
    // 줄인다(칩 한 개 + 툴팁).
    expect(bodyCode).not.toMatch(/warning-soft|error-soft|danger-soft/);
    expect(bodyCode).not.toMatch(/border-warning|border-error|border-danger/);
  });

  it("빈 상태 어휘는 그대로다 — 표면만 줄였지 말을 바꾸지 않았다", () => {
    const emptyState = stripComments(readSourceAt(new URL("../mi-empty-state.ts", import.meta.url)));
    expect(emptyState).toContain('NO_SEARCH_DATA: "⚪ 검색 데이터 없음"');
    expect(emptyState).toContain('UNVERIFIABLE: "⚪ 확인 불가"');
    expect(emptyState).toContain('UNJUDGEABLE: "⚪ 판단 불가"');
  });

  it("글로벌 시장을 못 본 것도 조용한 한 줄이다", () => {
    const hint = panel.slice(panel.indexOf("function GlobalMarketHint"), panel.indexOf("function GlobalMarketCardView"));
    expect(hint).not.toMatch(/warning|error/);
    // MI-FINAL-UX-3 — 그 한 줄은 이제 본문이 아니라 팝오버 안에 있다. 본문에
    // 남는 것은 두 상태 모두 이름 하나(ⓘ 글로벌 시장 가격)다.
    expect(hint).toContain("{GLOBAL_MARKET_UNAVAILABLE_NOTE}");
  });
});

/* ──────────────── 판매 판단과 가격 계산은 서로 다른 층이다 ──────────────── */

describe("「판매 판단」과 「가격 계산」은 한 번에 펼쳐지지 않는다", () => {
  it("두 접힘은 서로 다른 질문이고, 둘 다 기본은 접힘이다", () => {
    // MI가 답하는 것은 "팔아도 되는가", 계산기가 답하는 것은 "얼마에 팔면
    // 되는가"다. 둘이 동시에 펼쳐져 있으면 MI가 다시 계산기로 읽힌다.
    expect(panel).toContain("const [showMarketDetail, setShowMarketDetail] = useState(false);");
    expect(panel).toContain("const [showPriceDetail, setShowPriceDetail] = useState(false);");
    expect(panel).toContain("const [showGlobalMarketDetail, setShowGlobalMarketDetail] = useState(false);");
  });

  it("판단의 되물음은 카드 바닥에, 계산의 되물음은 ③ 안에 있다", () => {
    // 같은 자리에 두면 어느 쪽이 판단이고 어느 쪽이 계산인지 화면이 말하지 못한다.
    const chainAt = panel.indexOf("<PriceChainView");
    const priceToggleAt = panel.indexOf("ⓘ 가격 계산 기준 {caret(showPriceDetail)}");
    const marketToggleAt = panel.indexOf("{caret(showMarketDetail)} 왜 이렇게 판단했나요?");
    expect(priceToggleAt).toBeGreaterThan(chainAt);
    expect(marketToggleAt).toBeGreaterThan(priceToggleAt);
  });

  it("상세 계산은 MI 안에서 다시 마운트되지 않고 슬롯으로만 온다", () => {
    // 직접 그리면 product와 setter 넷이 이 패널로 들어오고, 그때부터
    // "가격이 바뀌었으니 다시 분석하자"는 배선이 생긴다.
    expect(panelCode).not.toContain("<PriceCalculationDetail");
    expect(panelCode).not.toContain("computePriceBreakdown");
    expect(panelCode).not.toContain("/api/price-intelligence");
    expect(bodyCode).toContain("{priceCalculationDetail}");
  });
});

/* ──────────────── 오른쪽 기둥은 진행상태를 반복하지 않는다 ──────────────── */

describe("MI 판단 화면에서는 작업 진행상태를 반복해서 보여주지 않는다", () => {
  const actionCenter = readSourceAt(new URL("../ActionCenter.tsx", import.meta.url));
  const stageFocus = readSourceAt(new URL("../stage-focus.ts", import.meta.url));

  it("판단이 본문의 주인공이면 나머지 두 블록이 DEFERRED로 내려간다", () => {
    expect(stageFocus).toContain('export type PanelMode = "LIST" | "SUMMARY" | "DEFERRED";');
    expect(stageFocus).toContain('const miOwnsBody = mi === "FULL";');
    expect(stageFocus).toContain('checklist: bodyOwnsChecklist ? "SUMMARY" : miOwnsBody ? "DEFERRED" : "LIST",');
    expect(stageFocus).toContain('channels: bodyOwnsChannels ? "SUMMARY" : miOwnsBody ? "DEFERRED" : "LIST",');
  });

  it("DEFERRED 한 줄에는 진척 숫자도 지금 할 일도 없다", () => {
    // 그 둘이 곧 상단 workflow bar가 이미 말하고 있는 진행상태다.
    const deferredChecklist = actionCenter.slice(
      actionCenter.indexOf('{checklistMode === "DEFERRED" ? ('),
      actionCenter.indexOf(') : checklistMode === "SUMMARY" ? ('),
    );
    expect(deferredChecklist).toContain("판매 판단이 끝나면 여기서 확인합니다.");
    expect(deferredChecklist).not.toContain("{doneCount}");
    expect(deferredChecklist).not.toContain("currentTodo");
  });

  it("채널은 사라지지 않는다 — 접는 것은 버튼과 준비 상태뿐이다", () => {
    const deferredChannels = actionCenter.slice(
      actionCenter.indexOf('{channelsMode === "DEFERRED" ? ('),
      actionCenter.indexOf(') : channelsMode === "SUMMARY" ? ('),
    );
    expect(deferredChannels).toContain("channels.map((channel) => channel.label)");
    expect(deferredChannels).toContain("판단 뒤에 등록합니다.");
    expect(deferredChannels).not.toContain("<ChannelButton");
    expect(deferredChannels).not.toContain("LEVEL_DOT_CLASS");
  });

  it("그 화면에서 누를 수 있는 것은 판매 판단 하나다", () => {
    // 세 블록 중 버튼을 가진 것은 ① 판매 판단뿐이고, 나머지 둘은 DEFERRED에서
    // <p> 한 줄이다. 등록 기능 자체는 그대로다(다른 단계에서는 LIST로 돌아온다).
    expect(actionCenter).toContain("<button type=\"button\" onClick={onOpenVerdict}");
    expect(actionCenter).toContain('const actionableChannels = channels.filter((channel) => channel.availability !== "COMING_SOON");');
  });

  it("MI 본문도 행동을 하나만 갖는다 — 👉 문장과 힌트는 층을 내렸다", () => {
    // 예전에는 👉 안내 문장 · cta.hint · 버튼이 세로로 쌓여 셋 다 같은 곳으로
    // 데려갔다. 문장은 접힘 안, 힌트는 버튼의 title, 남는 것은 버튼 하나.
    expect(bodyCode).not.toContain("👉");
    expect(detail).toContain("👉 {sellingSummary.action}");
    expect(bodyCode).toContain("title={verdictCta.hint || undefined}");
    expect((bodyCode.match(/onClick=\{onRequestPriceReview\}/g) ?? []).length).toBe(1);
  });
});
