// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * WU-112 — **GT 입력 폼이 실제로 동작하는지** 마운트한 DOM 으로 확인한다.
 *
 * 🔴 헌장 §5 — 「화면은 **마운트한 DOM** 으로만 완료 선언한다. Render PASS ≠ 소스 PASS」.
 *    선택지 27×3 개가 «있다» 는 것(소스 grep)으로는 **눌렀을 때 결과가 나오는지** 를 못 본다.
 * 🟢 `data:` 이미지는 **테스트에서만** 벗긴다(7.5MB 파싱을 피한다 · 로직과 무관).
 * 🔴 산출물 파일은 **고치지 않는다**.
 */
const HTML = readFileSync(path.join(__dirname, "../../../../../../../../docs/wu-112-candidate-list.html"), "utf8")
  .replace(/src="data:[^"]+"/g, 'src=""');

function mount() {
  document.documentElement.innerHTML = `<head></head><body>${HTML}</body>`;
  /** 🔴 jsdom 은 innerHTML 로 들어온 `<script>` 를 실행하지 않는다 — 직접 돌린다. */
  const code = [...document.querySelectorAll("script")].map((s) => s.textContent ?? "").join("\n");
  expect(code).toContain("wu112-gt");
  // eslint-disable-next-line no-new-func
  new Function(code)();
}

const sets = () => [...document.querySelectorAll<HTMLElement>(".gt")];
const out = () => document.querySelector<HTMLTextAreaElement>("#out")!;
const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));

describe("WU-112 GT 폼 — 마운트 DOM", () => {
  /**
   * 🔴 **1차에 3건이 실패했고 원인은 제품이 아니라 이 하니스였다** — 같은 jsdom 환경에서
   *    `localStorage` 가 테스트 사이에 **남아** 앞 테스트의 판정이 복원됐다
   *    (`prog` 가 '1' 이 아니라 '3'). 🟢 그것은 **자동 저장이 작동한다는 증거** 였다.
   * 🔴 「실패했으니 페이지가 잘못됐다」로 읽으면 틀린다 — 격리를 고치는 것이 맞다.
   */
  beforeEach(() => localStorage.clear());

  it("🟢 후보 27건 각각에 선택지 셋과 이유 칸이 있다", () => {
    mount();
    expect(sets()).toHaveLength(27);
    expect(document.querySelectorAll('.gt input[type="radio"]')).toHaveLength(81);
    expect(document.querySelectorAll(".gt input.why")).toHaveLength(27);
    expect(document.querySelector("#tot")!.textContent).toBe("27");
    expect(document.querySelector("#prog")!.textContent).toBe("0");
  });

  it("🟢🟢 «눌러서» 판정하면 결과 JSON 과 진행 수가 바뀐다", () => {
    mount();
    const f = sets()[0];
    const same = f.querySelector<HTMLInputElement>('input[value="SAME"]')!;
    same.checked = true;
    fire(same, "change");

    expect(document.querySelector("#prog")!.textContent).toBe("1");
    const j = JSON.parse(out().value);
    expect(j.judged).toBe(1);
    expect(j.counts).toEqual({ SAME: 1, DIFFERENT: 0, UNCERTAIN: 0 });

    const row = j.candidates.find((c: { url: string }) => c.url === f.dataset.url);
    expect(row.verdict).toBe("SAME");
    /** 🔴 **판정이 어느 후보의 것인지** 가 같이 실려야 쓸 수 있다(WU-095 교훈 — 인덱스 금지). */
    expect(row.domain).toBe(f.dataset.domain);
    expect(row.originCode).toBeTruthy();
    expect(row.url).toMatch(/^https?:\/\//);
  });

  it("🟢 이유를 적으면 그 후보 행에 들어간다", () => {
    mount();
    const f = sets()[1];
    const diff = f.querySelector<HTMLInputElement>('input[value="DIFFERENT"]')!;
    diff.checked = true;
    fire(diff, "change");
    const why = f.querySelector<HTMLInputElement>("input.why")!;
    why.value = "긴팔이다";
    fire(why, "input");

    const row = JSON.parse(out().value).candidates.find((c: { url: string }) => c.url === f.dataset.url);
    expect(row).toMatchObject({ verdict: "DIFFERENT", reason: "긴팔이다" });
  });

  it("🔴 안 누른 후보는 **null** 이다 — 「다른 상품」으로 채우지 않는다", () => {
    mount();
    const j = JSON.parse(out().value);
    expect(j.candidates).toHaveLength(27);
    expect(j.candidates.every((c: { verdict: null }) => c.verdict === null)).toBe(true);
    expect(j.judged).toBe(0);
  });

  it("🟢 입력은 자동 저장된다(중간에 닫아도 된다)", () => {
    mount();
    const f = sets()[2];
    const unc = f.querySelector<HTMLInputElement>('input[value="UNCERTAIN"]')!;
    unc.checked = true;
    fire(unc, "change");

    const saved = JSON.parse(localStorage.getItem("wu112-gt")!);
    expect(saved.find((x: { url: string }) => x.url === f.dataset.url).verdict).toBe("UNCERTAIN");

    /** 🟢 다시 열면 복원된다. */
    mount();
    const again = sets()[2].querySelector<HTMLInputElement>('input[value="UNCERTAIN"]')!;
    expect(again.checked).toBe(true);
    expect(document.querySelector("#prog")!.textContent).toBe("1");
  });

  it("🔴 CTO 가 미리 채워 둔 판정이 **없다**", () => {
    mount();
    expect(document.querySelectorAll(".gt input[type=radio][checked]")).toHaveLength(0);
    expect([...document.querySelectorAll<HTMLInputElement>("input.why")].every((i) => i.value === "")).toBe(true);
  });
});
