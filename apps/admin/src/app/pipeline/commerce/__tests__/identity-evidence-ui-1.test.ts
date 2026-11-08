// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  IdentityEvidencePanel,
  type IdentityEvidenceAxisRow,
  type IdentityEvidencePayload,
} from "../IdentityEvidencePanel";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-EVIDENCE-API-UI-1 — **마운트 DOM** 검증 (CPO 승인 2026-11-08)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 「Render PASS ≠ 소스 PASS」 — 화면은 **마운트한 DOM** 으로만 완료 선언한다(헌장 §5).
 * 🔴 네트워크 0 · DB 0.
 * 🔴 **파일 확장자가 `.test.ts` 다** — vitest `include` 가 `.test.tsx` 를 **수집하지 않는다**
 *    (메모 `local-toolchain-silent-noops`). 그래서 JSX 대신 `createElement` 를 쓴다.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const mount = async (identityEvidence: IdentityEvidencePayload | null) => {
  await act(async () => root.render(createElement(IdentityEvidencePanel, { identityEvidence })));
};
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const txt = (id: string) => q(id)?.textContent ?? "";
const clickDetail = async (axisName: string) => {
  const btn = q(`identity-detail-toggle-${axisName}`) as HTMLButtonElement | null;
  if (!btn) throw new Error(`토글 버튼이 없다: ${axisName}`);
  await act(async () => btn.click());
};

const axis = (over: Partial<IdentityEvidenceAxisRow>): IdentityEvidenceAxisRow => ({
  axis: "BRAND",
  observationOnly: false,
  originState: "PRESENT",
  candidateState: "PRESENT",
  comparison: "PRESENT",
  origin: [{ raw: "Bobo Choses", normalized: "bobo choses", source: "TITLE" }],
  candidate: [{ raw: "보보쇼즈", normalized: "보보쇼즈", source: "DESCRIPTION" }],
  originIndependentSources: 1,
  candidateIndependentSources: 1,
  conflictBasis: null,
  ...over,
});

const payload = (axes: IdentityEvidenceAxisRow[], url = "https://a.test/1"): IdentityEvidencePayload => ({
  candidates: [
    {
      candidateUrl: url,
      domain: new URL(url).host,
      axes,
      supply: { originHasEvidence: true, candidateHasEvidence: true, asymmetric: false },
    },
  ],
});

const ALL_AXES = [
  "BRAND",
  "PRODUCT_NAME",
  "MODEL_CODE",
  "FORM",
  "COLOR",
  "MATERIAL",
  "FIT",
  "COMPOSITION",
  "SET",
  "OPTION_SKU",
  "IMAGE",
] as const;

/* ════════════════════════════════════════════════════════════════════════════
 * §1 첫 화면 = 상태 / 상세 = 근거
 * ════════════════════════════════════════════════════════════════════════════ */

describe("IDENTITY-EVIDENCE-UI-1 §1 — 첫 화면/상세", () => {
  it("①-a 🟢 첫 화면에 **상태 세 칸** 이 선다(대조 · 원본 · 후보) · 상세는 **닫혀 있다**", async () => {
    await mount(payload([axis({})]));
    expect(q("identity-evidence-panel")).toBeTruthy();
    expect(q("identity-axis-BRAND")).toBeTruthy();
    expect(txt("identity-comparison-BRAND")).toContain("현재 근거상 충돌 없음");
    expect(txt("identity-origin-state-BRAND")).toContain("근거 확인");
    expect(txt("identity-candidate-state-BRAND")).toContain("근거 확인");
    /** 🔴 첫 화면이 근거 목록으로 덮이지 않는다. */
    expect(q("identity-detail-BRAND")).toBeNull();
  });

  it("①-b 🟢 상세를 열면 **원문 · 정규화 · 출처 · 독립 출처 수** 가 보인다", async () => {
    await mount(payload([axis({})]));
    await clickDetail("BRAND");
    const d = txt("identity-detail-BRAND");
    expect(d).toContain("Bobo Choses");
    expect(d).toContain("bobo choses");
    expect(d).toContain("TITLE");
    expect(d).toContain("보보쇼즈");
    expect(d).toContain("DESCRIPTION");
    expect(d).toContain("독립 출처 1곳");
  });

  it("①-c 🟡 **관측 전용 축** 을 숨기지 않는다", async () => {
    await mount(payload([axis({ axis: "IMAGE", observationOnly: true })]));
    expect(txt("identity-observation-only-IMAGE")).toContain("관측 전용");
  });

  it("①-d 🟢 CPO 지정 **축 11개** 가 전부 렌더된다", async () => {
    await mount(payload(ALL_AXES.map((a) => axis({ axis: a }))));
    for (const a of ALL_AXES) expect(q(`identity-axis-${a}`), a).toBeTruthy();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * §2 🔴 Negative control 10항 (CPO §3-3)
 * ════════════════════════════════════════════════════════════════════════════ */

describe("IDENTITY-EVIDENCE-UI-1 §2 — negative control 10", () => {
  it("②-1 양쪽 근거 있음 → 「충돌 없음」", async () => {
    await mount(payload([axis({})]));
    expect(txt("identity-comparison-BRAND")).toContain("충돌 없음");
  });

  it("②-2 🔴 **원본에만** 근거 → 후보는 「데이터는 있으나 근거 없음」 · 상세는 「—」", async () => {
    await mount(payload([axis({ candidate: [], candidateState: "MISSING", comparison: "MISSING" })]));
    expect(txt("identity-candidate-state-BRAND")).toContain("데이터는 있으나 근거 없음");
    await clickDetail("BRAND");
    /** 🔴 **없는 값을 지어내지 않는다.** */
    expect(txt("identity-detail-BRAND")).toContain("—");
  });

  it("②-3 🔴 **후보에만** 근거 → 원본은 「확인할 데이터 없음」", async () => {
    await mount(payload([axis({ origin: [], originState: "NOT_MEASURED", comparison: "NOT_MEASURED" })]));
    expect(txt("identity-origin-state-BRAND")).toContain("확인할 데이터 없음");
  });

  it("②-4 🔴 양쪽 모두 없음 → 「확인할 데이터 없음」 · **허위 값 0**", async () => {
    await mount(
      payload([
        axis({
          origin: [],
          candidate: [],
          originState: "NOT_MEASURED",
          candidateState: "NOT_MEASURED",
          comparison: "NOT_MEASURED",
          originIndependentSources: 0,
          candidateIndependentSources: 0,
        }),
      ]),
    );
    expect(txt("identity-comparison-BRAND")).toContain("확인할 데이터 없음");
    await clickDetail("BRAND");
    const d = txt("identity-detail-BRAND");
    expect(d).not.toContain("Bobo Choses");
    expect(d).toContain("독립 출처 0곳");
  });

  it("②-5 🔴 충돌 → 「근거 충돌」 + **충돌 근거** 가 상세에서 확인된다", async () => {
    await mount(
      payload([axis({ comparison: "CONFLICT", conflictBasis: '원본 ["Bobo Choses"] ↔ 후보 ["Konges Slojd"]' })]),
    );
    expect(txt("identity-comparison-BRAND")).toContain("근거 충돌");
    /** 🔴 충돌 근거는 **상세** 에 있다(첫 화면을 긴 문자열로 덮지 않는다). */
    expect(q("identity-conflict-BRAND")).toBeNull();
    await clickDetail("BRAND");
    expect(txt("identity-conflict-BRAND")).toContain("Konges");
  });

  it("②-6 🟢 BRAND 한글/영문 양립 → **충돌 표시 0** · 원문 둘 다 보존", async () => {
    await mount(payload([axis({})]));
    await clickDetail("BRAND");
    expect(q("identity-conflict-BRAND")).toBeNull();
    const d = txt("identity-detail-BRAND");
    expect(d).toContain("Bobo Choses");
    expect(d).toContain("보보쇼즈");
  });

  it("②-7 🔴 PRODUCT_NAME 이 서로 다른 상품 → 「근거 충돌」", async () => {
    await mount(
      payload([
        axis({
          axis: "PRODUCT_NAME",
          origin: [{ raw: "Hug Hairy Monster T-Shirt", normalized: "hug hairy monster t-shirt", source: "TITLE" }],
          candidate: [{ raw: "Booty Ghosts Bandana Skirt", normalized: "booty ghosts bandana skirt", source: "DESCRIPTION" }],
          comparison: "CONFLICT",
          conflictBasis: "원본 ↔ 후보 상품명 토큰 겹침 0",
        }),
      ]),
    );
    expect(txt("identity-comparison-PRODUCT_NAME")).toContain("근거 충돌");
  });

  it("②-8 🔴🔴 후보가 **여럿** 일 때 Evidence 가 섞이지 않는다", async () => {
    const a = payload([axis({})], "https://a.test/1").candidates[0]!;
    const b = payload([axis({ comparison: "CONFLICT", conflictBasis: "원본 ↔ 후보 다름" })], "https://b.test/2")
      .candidates[0]!;
    await mount({ candidates: [a, b] });
    const aText = txt("identity-candidate-https://a.test/1");
    const bText = txt("identity-candidate-https://b.test/2");
    expect(aText).toContain("현재 근거상 충돌 없음");
    expect(bText).toContain("근거 충돌");
    /** 🔴 A 쪽에 B 의 상태가 **섞이지 않는다**. */
    expect(aText).not.toContain("근거 충돌");
  });

  it("②-9 🔴 응답이 `null` → **영역 자체를 만들지 않는다**", async () => {
    await mount(null);
    expect(q("identity-evidence-panel")).toBeNull();
  });

  it("②-10 🔴 `{candidates: []}` → 영역은 서고 **「대조할 후보가 없었습니다」**", async () => {
    await mount({ candidates: [] });
    expect(q("identity-evidence-panel")).toBeTruthy();
    expect(txt("identity-evidence-empty")).toContain("대조할 후보가 없었습니다");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * §3 🔴🔴 wu-130 F-4 — **동일상품 확정으로 오해할 표현 0**
 * ════════════════════════════════════════════════════════════════════════════ */

describe("IDENTITY-EVIDENCE-UI-1 §3 — 판정 어휘 금지", () => {
  const REPO = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..");
  /** 🔴 주석을 벗긴다(여덟 번 걸린 함정) — JSX 주석 `{/* *\/}` 도 같이 벗긴다. */
  const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const SRC = strip(
    readFileSync(path.join(REPO, "apps/admin/src/app/pipeline/commerce/IdentityEvidencePanel.tsx"), "utf8"),
  );

  it("③-a 🔴 **마운트 DOM 에** 판정/가격 어휘가 없다(축 11개 전부 렌더한 상태)", async () => {
    await mount(payload(ALL_AXES.map((a) => axis({ axis: a }))));
    const text = container.textContent ?? "";
    for (const banned of ["동일상품", "SAME", "매칭 성공", "확정", "일치 판정", "적정가", "추천가", "수익"]) {
      expect(text, `🔴 화면에 「${banned}」가 있다`).not.toContain(banned);
    }
  });

  it("③-b 🔴 **소스에도** 그 어휘가 없다", () => {
    for (const banned of ["동일상품", "매칭 성공", "priceKrw", "priceTier", "verdict", "titleKo"]) {
      expect(SRC, `🔴 소스에 「${banned}」가 있다`).not.toContain(banned);
    }
  });

  it("③-c 🟢 **오독 방지 문장이 화면에 선다** — 지우면 이 단언이 FAIL 한다", async () => {
    await mount(payload([axis({})]));
    expect(txt("identity-evidence-scope")).toContain("같은 상품이라는 뜻은 아닙니다");
  });

  it("③-d 🔴 UI 가 브랜드/상품명 **양립 판정을 다시 구현하지 않는다**", () => {
    for (const banned of [
      "brandIdentitiesCompatible",
      "findBrandAliasMentions",
      "buildCoreTitleTokens",
      "normalizeFactText",
    ]) {
      expect(SRC, `🔴 UI 가 ${banned} 를 직접 쓴다`).not.toContain(banned);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * §4 🔴 패널 배선 — 두 경로 + 렌더 (이 파일이 네 번 밟은 함정)
 * ════════════════════════════════════════════════════════════════════════════ */

describe("IDENTITY-EVIDENCE-UI-1 §4 — 배선", () => {
  const REPO = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..");
  const PANEL = readFileSync(
    path.join(REPO, "apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx"),
    "utf8",
  )
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("④-a 🔴 **두 경로 모두** set 한다 — 자동 1회차 «그리고» 「🔄 다시 분석」", () => {
    expect(PANEL).toContain("setIdentityEvidence(j.identityEvidence ?? null)");
    expect(PANEL).toContain(").identityEvidence ?? null)");
    /** 🔴 `?? null` 이 **경로 미실행** 을 보존한다(빈 배열로 바꾸면 의미가 사라진다). */
    expect(PANEL).not.toContain("identityEvidence ?? { candidates: [] }");
  });

  it("④-b 🔴 자식까지 내려가고 **실제로 렌더** 된다", () => {
    expect(PANEL).toContain("identityEvidence={identityEvidence}");
    expect(PANEL).toContain("<IdentityEvidencePanel identityEvidence={identityEvidence} />");
  });

  it("④-c 🔴🔴 **표시 전용** 이다 — 판정/집계 인자에 넘기지 않는다", () => {
    expect(PANEL).not.toMatch(/miJudgement[^\n]*identityEvidence/);
    expect(PANEL).not.toMatch(/computeMarketIntelligence\([^)]*identityEvidence/);
  });
});
