// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  defaultDetailBlocks,
  mergeProductDetailBlocks,
  resolveDetailBlocks,
  type DetailPageBlock,
  type ProductDetailOverride,
} from "@commerce/listing";
import { ProductDetailBlocksPanel } from "../ProductDetailBlocksPanel";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-INFO-UX-06 ⑤ — **마운트한 DOM** 으로 확인한다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Render PASS ≠ 소스 PASS. 이 저장소는 「코드상 그렇다」로 여러 번 틀렸다.
 * 그래서 버튼을 «실제로 눌러» override 가 어떻게 기록되는지 본다.
 *
 * 🔴 그리고 가장 중요한 것 — **아무것도 누르지 않으면 override 가 undefined 다.**
 * 패널을 여는 것만으로 빈 껍데기가 생기면 payload 동일성이 깨진다.
 *
 * 🔴 `.test.tsx` 가 아니라 `.test.ts` 다 — vitest include 가 `*.test.ts` 만
 * 잡는다(저장소 관례). 그래서 JSX 대신 createElement 를 쓴다.
 */
const SELLER: DetailPageBlock[] = [
  { id: "default-0", kind: "COMMON_IMAGE", position: "top", enabled: false },
  { id: "default-1", kind: "PRODUCT_IMAGES", enabled: true },
  { id: "default-2", kind: "AI_DESCRIPTION", enabled: true },
  { id: "default-3", kind: "TEMPLATE_SECTION", section: "shipping", enabled: false },
];

/** 패널을 띄우고, 바뀐 override 를 한 칸에 모은다. */
const PRODUCT_IMAGES = ["https://cdn.example.com/own/1.jpg", "https://cdn.example.com/own/2.jpg"];

function mount(initial?: ProductDetailOverride, productImageUrls: string[] = PRODUCT_IMAGES) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const state: { override: ProductDetailOverride | undefined; calls: number } = {
    override: initial,
    calls: 0,
  };

  function render() {
    act(() => {
      root.render(
        createElement(ProductDetailBlocksPanel, {
          sellerDefaultBlocks: SELLER,
          productImageUrls,
          override: state.override,
          onChange: (next) => {
            state.override = next;
            state.calls += 1;
            render();
          },
        }),
      );
    });
  }
  render();

  const all = (sel: string) => Array.from(host.querySelectorAll(sel)) as HTMLElement[];
  const byText = (sel: string, text: string) => all(sel).find((el) => el.textContent?.trim() === text) ?? null;
  const click = (el: HTMLElement | null) => {
    if (!el) throw new Error("클릭 대상이 DOM 에 없다");
    act(() => el.click());
  };
  /* 🔴 토글 버튼의 textContent 는 「이 상품의 상세페이지…펼치기」 전체다 —
     「펼치기」는 자식 span 이라 정확히 일치하지 않는다(처음에 그렇게 짜서 헛되이
     실패했다). 섹션의 «첫» 버튼이 토글이다. */
  const open = () => click(all("button")[0]);

  return { host, state, all, byText, click, open, text: () => host.textContent ?? "" };
}

describe("① 🔴 아무것도 누르지 않으면 override 가 «생기지 않는다»", () => {
  it("마운트만 해도 onChange 가 불리지 않는다", () => {
    const p = mount();
    expect(p.state.calls).toBe(0);
    expect(p.state.override).toBeUndefined();
  });

  it("🔴 펼치기만 해도 override 가 안 생긴다 — 빈 껍데기가 payload 를 흔들면 안 된다", () => {
    const p = mount();
    p.open();
    expect(p.state.calls).toBe(0);
    expect(p.state.override).toBeUndefined();
    /* 실제로 펼쳐졌는지도 확인한다 — 안 펼쳐졌으면 위 단정이 공허하다. */
    expect(p.all("ol > li").length).toBeGreaterThan(0);
  });

  it("접힌 상태에서 「공통 설정 그대로」라고 말한다", () => {
    const p = mount();
    expect(p.text()).toContain("공통 설정 그대로");
    expect(p.text()).not.toContain("곳 변경");
  });
});

describe("② 실제로 보이는 목록이 merge 결과와 같다", () => {
  it("셀러 블록 4개가 모두 그려진다 — 꺼진 것도 «보인다»", () => {
    const p = mount();
    p.open();
    expect(p.all("ol > li")).toHaveLength(SELLER.length);
    /* 🔴 꺼진 블록이 사라지면 다시 켤 방법이 없다(N-4.09 와 같은 이유).
       TEMPLATE_SECTION 의 라벨은 섹션별 이름이다 — "안내 문구" 가 아니라
       "배송안내"(detailBlockLabel 실측). */
    expect(p.text()).toContain("배송안내");
  });

  it("override 가 있으면 그 결과 순서로 그려진다", () => {
    const ov: ProductDetailOverride = { order: ["AI_DESCRIPTION", "PRODUCT_IMAGES"] };
    const p = mount(ov);
    p.open();
    const items = p.all("ol > li");
    expect(items).toHaveLength(mergeProductDetailBlocks(SELLER, ov).length);
    expect(items[0].textContent).toContain("AI 생성 설명");
  });
});

describe("③ 체크박스 — 「삭제」가 enabled:false 로 기록된다", () => {
  it("사용 체크를 끄면 patch 가 하나 생긴다", () => {
    const p = mount();
    p.open();
    const boxes = p.all('input[type="checkbox"]');
    expect(boxes).toHaveLength(SELLER.length);
    /* 2번째 블록(PRODUCT_IMAGES)은 켜져 있다 — 그것을 끈다. */
    act(() => (boxes[1] as HTMLInputElement).click());
    expect(p.state.override?.patches).toEqual({ PRODUCT_IMAGES: { enabled: false } });
    /* 🔴 블록이 목록에서 사라지지 않았다. */
    expect(p.all("ol > li")).toHaveLength(SELLER.length);
  });

  it("🔴 식별자가 block.id 가 아니다 — patch 키에 default- 가 없다", () => {
    const p = mount();
    p.open();
    act(() => (p.all('input[type="checkbox"]')[1] as HTMLInputElement).click());
    const keys = Object.keys(p.state.override?.patches ?? {});
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).not.toContain("default-");
  });
});

describe("④ 추가 — 텍스트 블록이 added 로 들어간다", () => {
  it("[+ 텍스트] 가 CUSTOM_TEXT 를 customTextId 와 함께 추가한다", () => {
    const p = mount();
    p.open();
    p.click(p.byText("button", "+ 직접 입력 텍스트"));
    expect(p.state.override?.added).toHaveLength(1);
    const added = p.state.override!.added![0];
    expect(added.kind).toBe("CUSTOM_TEXT");
    expect(added.kind === "CUSTOM_TEXT" && added.customTextId).toBeTruthy();
    /* 목록이 한 줄 늘고 textarea 가 생긴다. */
    expect(p.all("ol > li")).toHaveLength(SELLER.length + 1);
    expect(p.all("textarea")).toHaveLength(1);
  });

  it("🔴 이미 목록에 있는 종류를 누르면 «추가» 가 아니라 «켜기» 다", () => {
    const p = mount({ patches: { PRODUCT_IMAGES: { enabled: false } } });
    p.open();
    p.click(p.byText("button", "+ 상품 상세이미지"));
    expect(p.state.override?.added ?? []).toHaveLength(0);
    expect(p.state.override?.patches?.PRODUCT_IMAGES).toEqual({ enabled: true });
    expect(p.all("ol > li")).toHaveLength(SELLER.length);
  });

  it("🔴 추가 버튼의 이름이 목록 행의 이름과 «같다» — 같은 블록을 두 이름으로 부르지 않는다", () => {
    const p = mount();
    p.open();
    /* 🔴 같은 블록을 추가 버튼과 목록 행에서 다르게 부르면 셀러가 같은 것을
       둘로 센다(실제로 그렇게 짰다가 테스트가 잡았다). */
    p.click(p.byText("button", "+ 직접 입력 텍스트"));
    expect(p.all("ol > li").at(-1)?.textContent).toContain("직접 입력 텍스트");
  });

  it("🔴 「이미지」와 「이미지+텍스트」를 «두 버튼» 으로 만들지 않았다 — kind 가 하나다", () => {
    const p = mount();
    p.open();
    const addButtons = p.all("button").map((b) => b.textContent?.trim() ?? "");
    /* caption 유무로 갈리므로 버튼은 하나다. 둘로 쪼개면 조립기에 같은 분기가
       두 벌 생기고 셀러도 무엇을 고를지 헷갈린다. */
    expect(addButtons).toContain("+ 이 상품 이미지");
    expect(addButtons).not.toContain("+ 이미지+텍스트");

    /* 🔴 「이미지 아래에 넣을 문구」는 고르기 화면이 아니라 «추가된 행» 의
       placeholder 다(처음에 고르기 화면에서 찾다가 헛되이 실패했다). 이미지를
       한 장 넣으면 그 한 행에 미리보기와 문구 칸이 «같이» 생긴다 — 그래서 블록
       둘이 필요하지 않다. */
    const q = mount({
      added: [{ id: "p0", kind: "CUSTOM_IMAGE", url: PRODUCT_IMAGES[0], enabled: true, customImageId: "ci-0" }],
    });
    q.open();
    const row = q.all("ol > li").at(-1)!;
    expect(row.querySelector("img")).not.toBeNull();
    expect(row.querySelector("textarea")?.getAttribute("placeholder")).toContain("이미지 아래에 넣을 문구");
  });
});

describe("⑤ 🔴 초기화 — override 가 undefined 로 «완전히» 사라진다", () => {
  it("편집 후 「공통 설정으로 초기화」를 누르면 undefined 다", () => {
    const p = mount();
    p.open();
    p.click(p.byText("button", "+ 직접 입력 텍스트"));
    act(() => (p.all('input[type="checkbox"]')[1] as HTMLInputElement).click());
    expect(p.state.override).toBeDefined();

    p.click(p.byText("button", "공통 설정으로 초기화"));
    /* 🔴 빈 객체가 아니라 undefined 다 — 빈 껍데기를 남기면 payload 비교가 흔들린다. */
    expect(p.state.override).toBeUndefined();
    expect(p.text()).toContain("공통 설정 그대로");
  });

  it("되돌리기로 마지막 patch 를 지우면 undefined 가 된다", () => {
    const p = mount({ patches: { AI_DESCRIPTION: { enabled: false } } });
    p.open();
    p.click(p.byText("button", "되돌리기"));
    expect(p.state.override).toBeUndefined();
  });
});

describe("⑥ 순서 변경", () => {
  it("↓ 를 누르면 order 가 식별자 «전체» 목록으로 기록된다", () => {
    const p = mount();
    p.open();
    p.click(p.all('button[aria-label="아래로"]')[0]);
    expect(p.state.override?.order).toEqual([
      "PRODUCT_IMAGES",
      "COMMON_IMAGE:top",
      "AI_DESCRIPTION",
      "TEMPLATE_SECTION:shipping",
    ]);
    /* 🔴 일부만 담으면 나머지 순서가 불확정이 된다. */
    expect(p.state.override?.order).toHaveLength(SELLER.length);
  });
});

describe("⑦ 🔴 패널이 블록 배열을 상태로 들고 있지 않다", () => {
  const codeOnly = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
  const SRC = codeOnly(readFileSync(join(__dirname, "../ProductDetailBlocksPanel.tsx"), "utf8"));

  it("useState 로 DetailPageBlock[] 를 들지 않는다 — merge 로 «계산» 한다", () => {
    expect(SRC).toContain("mergeProductDetailBlocks(sellerDefaultBlocks, override)");
    expect(SRC).not.toMatch(/useState<DetailPageBlock\[\]>/);
  });

  it("🔴 셀러 기본값을 수정하지 않는다 — 다른 상품이 함께 바뀌면 안 된다", () => {
    const before = JSON.stringify(SELLER);
    const p = mount();
    p.open();
    p.click(p.byText("button", "+ 직접 입력 텍스트"));
    p.click(p.all('button[aria-label="아래로"]')[0]);
    expect(JSON.stringify(SELLER)).toBe(before);
  });

  it("기본 9블록으로도 중복 key 없이 그려진다", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(ProductDetailBlocksPanel, {
          sellerDefaultBlocks: defaultDetailBlocks(),
          override: undefined,
          onChange: () => {},
        }),
      );
    });
    act(() => (host.querySelector("button") as HTMLElement).click());
    expect(host.querySelectorAll("ol > li")).toHaveLength(defaultDetailBlocks().length);
  });
});

describe("⑧ 🔴 패널이 상품정보(source) 탭에 «한 번만» 마운트된다", () => {
  const WORKSPACE = readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

  it("한 자리에만 있다", () => {
    expect((WORKSPACE.match(/<ProductDetailBlocksPanel/g) ?? []).length).toBe(1);
  });

  it("상품정보(source) 탭 안이다 — 채널 탭이 아니다", () => {
    const sourceTabStart = WORKSPACE.indexOf('tab === "source" &&');
    expect(sourceTabStart).toBeGreaterThan(-1);
    expect(WORKSPACE.indexOf("<ProductDetailBlocksPanel")).toBeGreaterThan(sourceTabStart);
  });

  it("🔴 서버가 기준선을 안 내려주면 패널을 그리지 않는다 — 기본값을 추측해 그리지 않는다", () => {
    expect(WORKSPACE).toContain("sellerDefaultDetailBlocks && (");
  });

  it("override 가 스냅샷으로 미러링된다 — categoryMappings 와 같은 방식", () => {
    expect(WORKSPACE).toContain("onDetailOverrideChange?.(detailOverride)");
    const page = readFileSync(join(__dirname, "../../page.tsx"), "utf8");
    expect(page).toContain("detailOverride,");
    expect(page).toContain("setDetailOverride(ws.detailOverride ?? undefined)");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ⑨ SELLER-UX-FINAL — 상품별 이미지 추가 흐름 (마운트한 DOM)
   ══════════════════════════════════════════════════════════════════════════ */
describe("⑨ 이미지 추가 — 외부 주소를 적는 칸이 «없다»", () => {
  it("[+ 이 상품 이미지] 가 고르기 화면을 연다 — 누르자마자 블록이 생기지 «않는다»", () => {
    const p = mount();
    p.open();
    p.click(p.byText("button", "+ 이 상품 이미지"));
    /* 🔴 URL 을 고르기 «전» 에는 override 가 안 생긴다 — 빈 URL 블록은 조립에서
       조용히 사라져 「추가했는데 안 나온다」가 된다. */
    expect(p.state.override).toBeUndefined();
    expect(p.text()).toContain("이미지 고르기");
  });

  it("🔴 URL 을 직접 입력하는 칸이 없다 — 외부 사이트 이미지를 적어 넣을 수 없다", () => {
    const p = mount();
    p.open();
    p.click(p.byText("button", "+ 이 상품 이미지"));
    const textInputs = p.all('input[type="text"], input[type="url"]');
    expect(textInputs).toHaveLength(0);
    /* 받는 입력은 파일 하나뿐이다. */
    expect(p.all('input[type="file"]')).toHaveLength(1);
    expect(p.text()).toContain("외부 사이트 이미지 주소를 직접 넣을 수는");
  });

  it("이 상품의 수집된 이미지를 골라 넣는다", () => {
    const p = mount();
    p.open();
    p.click(p.byText("button", "+ 이 상품 이미지"));
    const thumbs = p.all("img");
    expect(thumbs.length).toBeGreaterThanOrEqual(PRODUCT_IMAGES.length);
    p.click(thumbs[0].parentElement as HTMLElement);

    const added = p.state.override?.added ?? [];
    expect(added).toHaveLength(1);
    expect(added[0].kind).toBe("CUSTOM_IMAGE");
    expect(added[0].kind === "CUSTOM_IMAGE" && added[0].url).toBe(PRODUCT_IMAGES[0]);
    expect(added[0].kind === "CUSTOM_IMAGE" && added[0].customImageId).toBeTruthy();
    /* 고르면 화면이 닫힌다. */
    expect(p.text()).not.toContain("이미지 고르기");
  });

  it("추가된 이미지 행에 미리보기와 문구 칸이 함께 있다", () => {
    const p = mount({
      added: [
        { id: "p0", kind: "CUSTOM_IMAGE", url: PRODUCT_IMAGES[0], enabled: true, customImageId: "ci-0" },
      ],
    });
    p.open();
    const row = p.all("ol > li").at(-1)!;
    expect(row.querySelector("img")).not.toBeNull();
    expect(row.querySelector("textarea")).not.toBeNull();
    /* 문구가 비면 「이미지」, 차면 「이미지+문구」로 이름이 갈린다. */
    expect(row.textContent).toContain("이 상품 이미지");
    expect(row.textContent).not.toContain("이미지+문구");
  });

  it("🔴 문구를 적으면 라벨이 「이미지+문구」로 바뀐다 — 블록은 여전히 하나다", () => {
    const p = mount({
      added: [
        { id: "p0", kind: "CUSTOM_IMAGE", url: PRODUCT_IMAGES[0], enabled: true, customImageId: "ci-0" },
      ],
    });
    p.open();
    const before = p.all("ol > li").length;
    p.click(p.byText("button", "되돌리기")); // 추가 블록은 되돌리면 빠진다
    expect(p.state.override).toBeUndefined();

    const q = mount({
      added: [
        {
          id: "p0",
          kind: "CUSTOM_IMAGE",
          url: PRODUCT_IMAGES[0],
          caption: "착용 사진",
          enabled: true,
          customImageId: "ci-0",
        },
      ],
    });
    q.open();
    expect(q.all("ol > li")).toHaveLength(before);
    expect(q.all("ol > li").at(-1)!.textContent).toContain("이미지+문구");
  });

  it("이미지 블록도 순서 변경·끄기·되돌리기가 된다", () => {
    const p = mount({
      added: [
        { id: "p0", kind: "CUSTOM_IMAGE", url: PRODUCT_IMAGES[0], enabled: true, customImageId: "ci-0" },
      ],
    });
    p.open();
    /* 끄기 */
    const boxes = p.all('input[type="checkbox"]');
    act(() => (boxes[boxes.length - 1] as HTMLInputElement).click());
    expect(p.state.override?.patches?.["CUSTOM_IMAGE:ci-0"]).toEqual({ enabled: false });
    /* 위로 올리기 */
    p.click(p.all('button[aria-label="위로"]').at(-1)!);
    expect(p.state.override?.order).toContain("CUSTOM_IMAGE:ci-0");
  });

  it("🔴 라이브러리를 «펼칠 때만» 읽는다 — 패널을 열기만 해서는 요청이 없다", () => {
    const src = readFileSync(join(__dirname, "../ProductDetailBlocksPanel.tsx"), "utf8");
    expect(src).toContain("if (!picking || assets !== null) return;");
    /* 업로드는 상품정보 탭이 쓰는 그 라우트다 — 새 경로를 만들지 않았다. */
    expect(src).toContain('fetch("/api/pipeline/upload-image"');
    expect(src).toContain('fetch("/api/assets")');
  });
});

describe("⑩ 🔴 P0 — 진입점이 «네이버와 무관하게» 항상 보인다 (CEO 실측 2026-10-04)", () => {
  /* 🔴 주석을 «벗기지 않는다». 아래 단정이 찾는 것은 `data.detailPage.
     sellerDefaultDetailBlocks` 같은 «정확한 코드 체인» 이고, 그 체인은 설명
     주석에 나오지 않는다(주석은 「네이버 resolve 에서 받고 있었다」로만 쓴다).
     주석 제거 정규식을 세 번 깨뜨린 뒤 내린 결론이다 — 필요 없는 가공을 하지
     않는 쪽이 더 안전하다. */
  const WS = readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8");

  /* 🔴 CEO 가 Production 에서 상세페이지 편집 진입점을 찾을 수 없었다. 원인은
     기준선(sellerDefaultDetailBlocks)을 네이버 resolve 응답에서 받고 있었고, 그
     effect 는 `tab === "smartstore"` 일 때만 돌기 때문이다 — 패널은 «상품정보»
     탭에 있으니 그 값이 영원히 null 이었다. 네이버 연결 실패도 같은 결과였다.
     상세페이지 블록은 애초에 네이버와 무관하다(coupang_seller_profiles). */

  it("🔴 기준선을 네이버 resolve 에서 받지 «않는다»", () => {
    expect(WS).not.toContain("data.detailPage.sellerDefaultDetailBlocks");
  });

  it("설정 프로필 라우트에서 직접 읽는다 — 새 엔드포인트를 만들지 않았다", () => {
    expect(WS).toContain('fetch("/api/settings/coupang/profiles")');
    expect(WS).toContain("setSellerDefaultDetailBlocks(resolveDetailBlocks(");
  });

  it("🔴 그 effect 가 탭·카테고리·자격증명에 «묶이지 않는다» — deps 가 비어 있다", () => {
    const at = WS.indexOf('fetch("/api/settings/coupang/profiles")');
    expect(at).toBeGreaterThan(-1);
    /* 🔴 그 fetch 를 품은 useEffect «블록만» 떼어 본다. 처음에 앞 900자를
       뭉텅이로 봤는데 그 범위에 «다른» effect 의 `tab === "smartstore"` 가
       들어와 거짓 실패했다 — 파일에 그 문자열이 여러 번 나온다. */
    const effectStart = WS.lastIndexOf("useEffect(", at);
    const effectEnd = WS.indexOf("}, []);", at);
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(at);
    const block = WS.slice(effectStart, effectEnd + 7);

    /* 빈 deps = 마운트 한 번 — 탭·카테고리·자격증명과 무관하다. */
    expect(block).toContain("}, []);");
    /* 🔴 그 블록 안에 탭/네이버 조건이 «하나도» 없다. */
    for (const gate of ['tab === "smartstore"', "smartStoreValidationEligible", "leafCategoryId", "accessToken"]) {
      expect(block, gate).not.toContain(gate);
    }
  });

  it("🔴 조회가 실패해도 편집기를 «열어 둔다» — 코드 상수 폴백", () => {
    const at = WS.indexOf('fetch("/api/settings/coupang/profiles")');
    const after = WS.slice(at, at + 1400);
    expect(after).toContain("catch");
    expect(after).toContain("setSellerDefaultDetailBlocks(resolveDetailBlocks(null))");
  });

  it("🔴 셀러가 설정을 저장한 적 없어도 폴백으로 열린다 — resolveDetailBlocks 규칙 그대로", () => {
    /* resolveDetailBlocks 는 null·빈 배열에 코드 상수 9블록을 돌려준다. */
    expect(resolveDetailBlocks(null).length).toBeGreaterThan(0);
    expect(resolveDetailBlocks([]).length).toBeGreaterThan(0);
  });

  it("패널은 여전히 상품정보(source) 탭에 «한 번만» 마운트된다", () => {
    expect((WS.match(/<ProductDetailBlocksPanel/g) ?? []).length).toBe(1);
    const sourceTab = WS.indexOf('tab === "source" &&');
    expect(WS.indexOf("<ProductDetailBlocksPanel")).toBeGreaterThan(sourceTab);
  });
});
