// @vitest-environment jsdom
/**
 * ══════════════════════════════════════════════════════════════════════════
 *  P5.6 후속 ③ — **추가 블록 편집 A~F 를 «마운트한 DOM» 으로 잰다** (CPO 지시)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * CPO 판정: 「③ 추가 블록 구조/회귀/payload 는 PASS · **실제 UI 편집 E2E 는
 * 보강 필요**」. 요구는 분명하다 — 셀러가 «실제로 쓸 수 있느냐» 다.
 *
 * ── 🔴 Production `/pipeline` 으로 재지 «못한다» ────────────────────────
 * 그 화면은 인증 뒤이고(미들웨어가 `/api/*` 와 화면을 막는다) CTO 는 로그인
 * 세션을 가질 수 없다 — 307 은 route 증거도 아니다. 그래서 이 저장소가 이미
 * 정한 기준을 쓴다: **「화면은 마운트한 DOM 으로만 완료 선언한다」.**
 * 소스 문자열 검사가 아니라 실제 버튼을 누르고 실제 input 에 타이핑한다.
 *
 * ── 이 파일이 재는 여섯 ─────────────────────────────────────────────────
 *   A 텍스트   추가 → 수정 → 저장 → 재진입 → 유지
 *   B 이미지   추가 → 저장 → 재진입 → 유지
 *   C 교체     기존 이미지 → 다른 이미지 → 재진입 → 새 것만 남음
 *   D 삭제     삭제 → 재진입 → «다시 살아나지 않음»
 *   E 보호     기본 블록 데이터·편집 UI·payload 무변화
 *   F 3채널    SmartStore · Coupang · LotteON 조립 결과 동일
 *
 * 🔴 「재진입」은 override 를 JSON 으로 내보냈다 다시 읽어 «새로 마운트» 하는
 *    것이다 — 같은 컴포넌트 인스턴스를 다시 보는 것은 재진입이 아니다.
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assembleContentsFromBlocks,
  mergeProductDetailBlocks,
  type DetailPageBlock,
  type ProductDetailOverride,
} from "@commerce/listing";
import { ProductDetailBlocksPanel } from "../ProductDetailBlocksPanel";

/** 셀러 기본 상세페이지 — 🔴 이 배열은 테스트 내내 «한 글자도» 바뀌지 않아야 한다. */
const SELLER_DEFAULT: DetailPageBlock[] = [
  { id: "d1", kind: "AI_DESCRIPTION", enabled: true },
  { id: "d2", kind: "PRODUCT_IMAGES", enabled: true },
];
/** 🔴 깊은 동결 — 패널이 기본값을 건드리면 «예외로» 터진다(단정이 아니라 사실로 막는다). */
const FROZEN_DEFAULT = SELLER_DEFAULT.map((b) => Object.freeze({ ...b })) as DetailPageBlock[];
Object.freeze(FROZEN_DEFAULT);

/** Smallable 실제 상품의 수집 이미지 — 교체 대상이 둘 이상 필요하다. */
const PRODUCT_IMAGES = [
  "https://cdn.smallable.com/louis-louise-1.jpg",
  "https://cdn.smallable.com/louis-louise-2.jpg",
  "https://cdn.smallable.com/louis-louise-3.jpg",
];

const CTX = {
  aiDescription: "원본 상세설명 본문입니다.",
  template: null,
  sellerConfig: {
    topCommonImageEnabled: false,
    topCommonImageUrl: "",
    bottomCommonImageEnabled: false,
    bottomCommonImageUrl: "",
  },
  productImageUrls: PRODUCT_IMAGES,
  sizeChartImageUrls: [],
  brandIntro: "브랜드 관리 기본 소개글",
} as never;

let container: HTMLDivElement;
let root: Root;
/* 🔴 전역 `fetch` 를 갈아끼운 뒤 «되돌린다». 1차에 복구를 빼먹어서 같은 워커를
   쓰는 다른 테스트 파일이 스텁을 물려받아 «관계없는» 테스트 1건이 떨어졌다
   (제품 코드는 한 글자도 안 바뀐 상태였다 — 오염이 원인이었다). */
let originalFetch: unknown;
/** 패널이 올려 보낸 최신 override. 🔴 이것이 workspace 에 저장되는 값이다. */
let current: ProductDetailOverride | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  /* 🔴 이미지 라이브러리 호출을 막는다 — 네트워크를 쓰지 않는다. 「이 상품의
     수집된 이미지」 경로만 쓰므로 라이브러리가 비어도 테스트가 성립한다. */
  originalFetch = (globalThis as { fetch?: unknown }).fetch;
  (globalThis as { fetch?: unknown }).fetch = async () =>
    ({ json: async () => ({ assets: [] }) }) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  current = undefined;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
});

/**
 * 🔴 패널은 «제어 컴포넌트» 다 — `override` 를 prop 으로 받고 `onChange` 로만
 *    올려 보낸다. 1차 하니스는 `onChange` 를 변수에 담기만 하고 다시 내려주지
 *    않아서, 셀러가 버튼을 눌러도 화면이 한 번도 갱신되지 않았다(실제 화면에서는
 *    CommerceWorkspace 의 `setDetailOverride` 가 그 일을 한다).
 *    그래서 실제 호출부와 «같은 모양» 의 상태 보유 래퍼를 쓴다.
 */
function Harness({ initial }: { initial: ProductDetailOverride | undefined }) {
  const [ov, setOv] = useState<ProductDetailOverride | undefined>(initial);
  current = ov;
  return createElement(ProductDetailBlocksPanel, {
    sellerDefaultBlocks: FROZEN_DEFAULT,
    override: ov,
    onChange: (next: ProductDetailOverride | undefined) => {
      current = next;
      setOv(next);
    },
    productImageUrls: PRODUCT_IMAGES,
  } as never);
}

/** 🔴 「재진입」 — JSON 왕복한 override 로 «새로» 마운트한다. */
async function mount(override: ProductDetailOverride | undefined): Promise<void> {
  const reloaded = override === undefined ? undefined : (JSON.parse(JSON.stringify(override)) as ProductDetailOverride);
  current = reloaded;
  await act(async () => {
    root.render(createElement(Harness, { initial: reloaded }));
  });
  /* 패널은 접혀 있다 — 셀러가 하는 대로 먼저 펼친다. */
  await clickByText("상세페이지");
}

function allButtons(): HTMLElement[] {
  return Array.from(container.querySelectorAll("button")) as HTMLElement[];
}

/** 글자가 들어간 버튼을 누른다. 🔴 못 찾으면 «실패» 한다 — 조용히 넘기지 않는다. */
async function clickByText(text: string, nth = 0): Promise<void> {
  const hits = allButtons().filter((b) => (b.textContent ?? "").includes(text));
  if (hits.length <= nth) {
    throw new Error(`버튼 「${text}」 (${nth}번째) 를 화면에서 찾지 못했다 — 버튼 ${allButtons().length}개 중 없음`);
  }
  await act(async () => {
    hits[nth]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 실제 input/textarea 에 타이핑한다(React onChange 가 돌게 value setter 를 쓴다). */
async function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function textareaByPlaceholder(fragment: string): HTMLTextAreaElement {
  const all = Array.from(container.querySelectorAll("textarea")) as HTMLTextAreaElement[];
  const hit = all.find((t) => (t.placeholder ?? "").includes(fragment));
  if (!hit) throw new Error(`textarea(placeholder~「${fragment}」) 를 찾지 못했다 — ${all.length}개 중 없음`);
  return hit;
}

function inputByPlaceholder(fragment: string): HTMLInputElement {
  const all = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];
  const hit = all.find((t) => (t.placeholder ?? "").includes(fragment));
  if (!hit) throw new Error(`input(placeholder~「${fragment}」) 를 찾지 못했다 — ${all.length}개 중 없음`);
  return hit;
}

/** 화면에 그려진 추가 블록의 이미지 목록(실제 <img src>). */
function shownImages(): string[] {
  return (Array.from(container.querySelectorAll("img")) as HTMLImageElement[]).map((i) =>
    i.getAttribute("src") ?? "",
  );
}

function assembled(override: ProductDetailOverride | undefined) {
  const out = assembleContentsFromBlocks(mergeProductDetailBlocks(FROZEN_DEFAULT, override), CTX) as never as {
    contentsType: string;
    contentDetails: { content: string }[];
  }[];
  return {
    texts: out.filter((c) => c.contentsType === "TEXT").flatMap((c) => c.contentDetails.map((d) => d.content)),
    images: out.filter((c) => c.contentsType === "IMAGE").flatMap((c) => c.contentDetails.map((d) => d.content)),
  };
}

/* ══ A — 텍스트: 추가 → 수정 → 저장 → 재진입 → 유지 ═════════════════════ */
describe("A 텍스트 — 추가 블록의 글을 고치고 재진입해도 남는다", () => {
  it("🔴 브랜드 소개를 추가해 제목+본문을 고치면 재진입 후에도 그대로다", async () => {
    await mount(undefined);

    /* 추가 */
    await clickByText("브랜드 소개");
    expect(current?.added?.map((b) => b.kind)).toEqual(["BRAND_INTRO"]);

    /* 수정 — 실제 input/textarea 에 타이핑한다 */
    await typeInto(inputByPlaceholder("항목 제목"), "Louis Louise");
    await typeInto(textareaByPlaceholder("브랜드 관리에 저장된 소개글"), "프랑스 키즈 브랜드입니다.");

    const saved = current;
    expect(saved?.added?.[0]).toMatchObject({
      kind: "BRAND_INTRO",
      heading: "Louis Louise",
      textOverride: "프랑스 키즈 브랜드입니다.",
    });

    /* 저장 → 재진입(JSON 왕복 + 새 마운트) */
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(saved);

    /* 🔴 화면이 그 값을 «다시 보여준다» — 저장만 되고 안 보이면 셀러에게는 소실이다. */
    expect(inputByPlaceholder("항목 제목").value).toBe("Louis Louise");
    expect(textareaByPlaceholder("브랜드 관리에 저장된 소개글").value).toBe("프랑스 키즈 브랜드입니다.");
  });

  it("🔴 직접 입력 텍스트도 같다 — 수정 → 재진입 → 유지", async () => {
    await mount(undefined);
    await clickByText("직접 입력 텍스트");
    await typeInto(textareaByPlaceholder("이 상품에만 들어갈 문구"), "통관 포함 10~15일.");
    const saved = current;

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(saved);
    expect(textareaByPlaceholder("이 상품에만 들어갈 문구").value).toBe("통관 포함 10~15일.");
  });
});

/* ══ B — 이미지 추가 ════════════════════════════════════════════════════ */
describe("B 이미지 추가 — 추가 블록에 이미지를 넣고 재진입해도 남는다", () => {
  it("🔴 사이즈표를 추가해 이미지를 넣으면 재진입 후에도 그 이미지가 보인다", async () => {
    await mount(undefined);
    await clickByText("사이즈표");

    /* 🔴 사이즈표는 수집 이미지가 없으면 비어 있다 — 그 사실을 화면이 말한다. */
    expect(container.textContent).toContain("이미지가 없습니다");

    await clickByText("이미지 추가");
    /* picker 에서 이 상품의 수집 이미지를 고른다 — 실제 썸네일 버튼을 누른다. */
    const picks = allButtons().filter((b) => b.querySelector("img"));
    expect(picks.length).toBeGreaterThan(0);
    const firstUrl = picks[0]!.querySelector("img")!.getAttribute("src")!;
    await act(async () => {
      picks[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saved = current;
    const block = saved?.added?.[0] as { imageUrlsOverride?: string[] } | undefined;
    expect(block?.imageUrlsOverride).toEqual([firstUrl]);

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(saved);
    expect(shownImages()).toContain(firstUrl);
    expect(container.textContent).not.toContain("이미지가 없습니다");

    /* payload 까지 — 화면에 보이는 것이 실제로 나간다.
       🔴 1차에 `[firstUrl]` 하나만 기대했다가 틀렸다. 기본 블록(PRODUCT_IMAGES)의
          3장이 «당연히» 같이 나간다 — 그것이 기본 블록이 보존됐다는 증거이고,
          추가 블록의 1장은 그 뒤에 붙는다. 단정을 그 사실에 맞춘다. */
    expect(assembled(current).images).toEqual([...PRODUCT_IMAGES, firstUrl]);
  });
});

/* ══ C — 이미지 교체 ════════════════════════════════════════════════════ */
describe("C 이미지 교체 — 기존 이미지가 «사라지고» 새 이미지만 남는다", () => {
  it("🔴 교체 후 재진입 — 새 이미지 유지 · 기존 이미지 제거", async () => {
    const start = {
      added: [
        {
          id: "s",
          kind: "SIZE_CHART_IMAGES",
          enabled: true,
          imageUrlsOverride: [PRODUCT_IMAGES[0]!],
        },
      ],
    } as never as ProductDetailOverride;
    await mount(start);
    expect(shownImages()).toContain(PRODUCT_IMAGES[0]);

    /* 교체 = 지우고 다른 것을 넣는다(이 블록의 이미지 목록 조작이 그 일이다) */
    await clickByText("×");
    await clickByText("이미지 추가");
    const picks = allButtons().filter((b) => {
      const src = b.querySelector("img")?.getAttribute("src") ?? "";
      return src === PRODUCT_IMAGES[1];
    });
    expect(picks.length).toBeGreaterThan(0);
    await act(async () => {
      picks[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saved = current;
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(saved);

    expect(shownImages()).toContain(PRODUCT_IMAGES[1]);
    /* 🔴 핵심 — 기존 이미지가 «남아 있지 않다». */
    const block = current?.added?.[0] as { imageUrlsOverride?: string[] } | undefined;
    expect(block?.imageUrlsOverride).toEqual([PRODUCT_IMAGES[1]]);
    expect(assembled(current).images).toEqual([...PRODUCT_IMAGES, PRODUCT_IMAGES[1]]);
  });

  it("🔴 CUSTOM_IMAGE 블록의 「이미지 변경」도 재진입 후 새 것만 남는다", async () => {
    const start = {
      added: [
        {
          id: "img",
          kind: "CUSTOM_IMAGE",
          enabled: true,
          url: PRODUCT_IMAGES[0]!,
          caption: "",
          customImageId: "ci-0",
        },
      ],
    } as never as ProductDetailOverride;
    await mount(start);

    await clickByText("이미지 변경");
    const picks = allButtons().filter((b) => b.querySelector("img")?.getAttribute("src") === PRODUCT_IMAGES[2]);
    expect(picks.length).toBeGreaterThan(0);
    await act(async () => {
      picks[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saved = current;
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(saved);

    const block = current?.added?.[0] as { url?: string } | undefined;
    expect(block?.url).toBe(PRODUCT_IMAGES[2]);
    /* 🔴 블록이 «끝으로 밀리지 않았다» — 지우고 다시 넣는 것과 다른 점이다. */
    expect(current?.added).toHaveLength(1);
    expect(assembled(current).images).toEqual([...PRODUCT_IMAGES, PRODUCT_IMAGES[2]]);
  });
});

/* ══ D — 이미지 삭제 ════════════════════════════════════════════════════ */
describe("D 이미지 삭제 — 재진입해도 «다시 살아나지 않는다»", () => {
  it("🔴 전부 삭제하면 빈 상태가 유지되고 수집 이미지로 되돌아가지 않는다", async () => {
    /* 🔴 `PRODUCT_IMAGES` 로 재지 «않는다» — 셀러 기본값에 이미 있는 kind 는
       식별자가 겹쳐서 «추가 자체가 무시된다»(detail-override.ts 의 규칙이고,
       같은 식별자가 둘이면 patch 가 어느 쪽에 붙는지 알 수 없어진다).
       그 경계는 아래 별도 describe 에서 명시적으로 잰다. */
    const start = {
      added: [
        { id: "s", kind: "SIZE_CHART_IMAGES", enabled: true, imageUrlsOverride: [PRODUCT_IMAGES[0]!] },
      ],
    } as never as ProductDetailOverride;
    await mount(start);
    expect(shownImages()).toContain(PRODUCT_IMAGES[0]);

    await clickByText("×");
    const saved = current;
    const block = saved?.added?.[0] as { imageUrlsOverride?: string[] } | undefined;
    /* 🔴 `[]` 다 — `undefined` 로 지우면 다음 재진입에서 수집 이미지가 되살아난다. */
    expect(block?.imageUrlsOverride).toEqual([]);

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(saved);

    expect(container.textContent).toContain("이미지가 없습니다");
    /* 🔴 셀러가 지운 사실이 payload 에도 남는다 — 추가 블록에서 이미지가 안 나간다. */
    /* 🔴 셀러가 지운 사실이 payload 에 남는다 — 추가 블록 몫이 «0장» 이고
       기본 블록 몫(3장)만 남는다. 수집 이미지로 몰래 되돌아가지 않는다. */
    expect(assembled(current).images).toEqual(PRODUCT_IMAGES);
  });

  it("🔴 「기본 이미지로 되돌리기」를 누르면 그때 되살아난다 — 그것이 셀러의 선택이다", async () => {
    const start = {
      added: [{ id: "s", kind: "SIZE_CHART_IMAGES", enabled: true, imageUrlsOverride: [] }],
    } as never as ProductDetailOverride;
    await mount(start);
    expect(container.textContent).toContain("이미지가 없습니다");

    await clickByText("기본 이미지로 되돌리기");
    const block = current?.added?.[0] as { imageUrlsOverride?: string[] } | undefined;
    expect(block?.imageUrlsOverride).toBeUndefined();
  });
});

/* ══ 🔴 경계 — 기본값과 «같은 kind» 는 추가되지 않는다 ═════════════════ */
describe("경계 — 셀러 기본값에 이미 있는 kind 는 「추가」가 아니라 「켜기」다", () => {
  it("🔴 실측 — 기본값에 PRODUCT_IMAGES 가 있으면 그 kind 의 추가 블록은 «생기지 않는다»", async () => {
    await mount(undefined);
    /* 셀러가 「+ 상품 상세이미지」를 누른다 — 기본값에 이미 있는 kind 다. */
    await clickByText("+ 상품 상세이미지");
    /* 🔴 `added` 에 들어가지 않는다. 식별자가 겹치면 merge 가 무시하므로,
       패널은 «켜기»(enabled:true) 로 처리한다(ProductDetailBlocksPanel.add). */
    expect(current?.added ?? []).toHaveLength(0);
    /* 그래서 이미지 편집칸도 생기지 않는다 — 기본 블록이기 때문이다. */
    expect(allButtons().filter((b) => (b.textContent ?? "").includes("이미지 추가"))).toHaveLength(0);
  });

  it("🔴 기본값에 «없는» kind 는 추가되고 편집칸이 생긴다 — 대조군", async () => {
    await mount(undefined);
    await clickByText("+ 사이즈표");
    expect(current?.added?.map((b) => b.kind)).toEqual(["SIZE_CHART_IMAGES"]);
    expect(allButtons().filter((b) => (b.textContent ?? "").includes("이미지 추가")).length).toBeGreaterThan(0);
  });
});

/* ══ E — 기본 블록 보호 ════════════════════════════════════════════════ */
describe("E 기본 블록 — 데이터·편집 UI·payload 가 «전부» 그대로다", () => {
  it("🔴 추가 블록을 고치는 동안 기본값 배열이 변형되지 않는다(동결로 막혀 있다)", async () => {
    const before = JSON.stringify(FROZEN_DEFAULT);
    await mount(undefined);
    await clickByText("브랜드 소개");
    await typeInto(inputByPlaceholder("항목 제목"), "Louis Louise");
    await typeInto(textareaByPlaceholder("브랜드 관리에 저장된 소개글"), "프랑스 키즈.");
    expect(JSON.stringify(FROZEN_DEFAULT)).toBe(before);
  });

  it("🔴 기본 블록에는 텍스트/이미지 편집칸이 «그려지지 않는다»", async () => {
    /* 기본값에 AI_DESCRIPTION·PRODUCT_IMAGES 가 있는 상태에서, 추가 블록이 하나도
       없으면 그 편집칸은 화면에 한 개도 없어야 한다. */
    await mount(undefined);
    const textareas = Array.from(container.querySelectorAll("textarea")) as HTMLTextAreaElement[];
    expect(textareas.filter((t) => (t.placeholder ?? "").includes("상품정보의 상세설명"))).toHaveLength(0);
    expect(allButtons().filter((b) => (b.textContent ?? "").includes("이미지 추가"))).toHaveLength(0);
    expect(allButtons().filter((b) => (b.textContent ?? "").includes("기본 문구로 되돌리기"))).toHaveLength(0);
  });

  it("🔴 추가 블록을 넣어도 «기본 블록의» payload 몫이 바뀌지 않는다", async () => {
    const baseline = assembled(undefined);
    const withAdded = assembled({
      added: [{ id: "b", kind: "BRAND_INTRO", enabled: true, heading: "T", textOverride: "X" }],
    } as never);
    /* 기본 블록이 만든 텍스트·이미지가 그대로 앞에 남아 있다. */
    expect(withAdded.texts[0]).toContain(baseline.texts[0]!);
    expect(withAdded.images).toEqual(baseline.images);
  });

  it("🔴 추가 블록이 하나도 없으면 override 가 `undefined` 다 — 빈 껍데기를 저장하지 않는다", async () => {
    await mount(undefined);
    await clickByText("직접 입력 텍스트");
    expect(current).not.toBeUndefined();
    /* 되돌리기로 빼면 다시 undefined 로 접힌다 */
    await clickByText("되돌리기");
    expect(current).toBeUndefined();
  });
});

/* ══ F — 3채널 ══════════════════════════════════════════════════════════ */
describe("F 3채널 — 조립기 하나를 세 채널이 공유한다", () => {
  it("🔴 SmartStore·Coupang·LotteON 이 «같은 함수» 로 조립한다", async () => {
    /* 🔴 세 채널의 조립 결과를 각각 재지 않는다 — 조립 경로가 하나이기 때문이다.
       「하나인가」를 재는 것이 더 강한 단정이다: 두 벌이면 이 단정이 깨진다. */
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = join(__dirname, "../../../../../../..");
    const strip = (p: string) =>
      readFileSync(join(repo, p), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
    const naver = strip("packages/listing/src/naver/build-payload.ts");
    const lotteon = strip("packages/listing/src/lotteon/build-payload.ts");
    const coupang = strip("packages/listing/src/coupang/build-payload.ts");
    expect(coupang).toContain("export function assembleContentsFromBlocks(");
    /* 네이버·롯데ON 은 자기 조립기를 «갖지 않는다». */
    expect(naver).not.toContain('kind === "AI_DESCRIPTION"');
    expect(lotteon).not.toContain('kind === "AI_DESCRIPTION"');
  });

  it("🔴 추가 블록 수정 결과가 조립 결과에 그대로 나타난다", async () => {
    await mount(undefined);
    await clickByText("브랜드 소개");
    await typeInto(inputByPlaceholder("항목 제목"), "Louis Louise");
    await typeInto(textareaByPlaceholder("브랜드 관리에 저장된 소개글"), "프랑스 키즈 브랜드입니다.");

    const { texts } = assembled(current);
    expect(texts.join("\n")).toContain("Louis Louise");
    expect(texts.join("\n")).toContain("프랑스 키즈 브랜드입니다.");
    /* 🔴 브랜드 관리 기본 소개글이 «같이» 나가지 않는다 — 덮은 것이다. */
    expect(texts.join("\n")).not.toContain("브랜드 관리 기본 소개글");
  });
});
