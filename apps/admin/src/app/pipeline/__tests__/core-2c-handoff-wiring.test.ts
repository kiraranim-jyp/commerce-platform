import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildBookmarkletForSnapshot,
  collectFromResultLinks,
  MAX_HANDOFF_URLS,
  parseSuppliedUrlsParam,
  SUPPLIED_URL_PARAM,
} from "../supplied-url-handoff";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2C — **핸드오프 배선 계약**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **순수 함수만 단언하면 배선을 못 본다** — 이 저장소에서 WU-110 이 그 함정을
 *    기록했다(「판정 함수를 직접 부르는 테스트는 배선을 못 본다 — `price:` 를 `null` 로
 *    되돌려도 0 failed 였다」). 그래서 **소스 앵커를 같이** 둔다.
 *
 * 🔴 네트워크 0 · DOM 0 · 운영 동작 변경 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const PAGE = strip(readFileSync(path.join(HERE, "..", "page.tsx"), "utf8"));
const MODULE_PATH = path.join(HERE, "..", "supplied-url-handoff.ts");
const MODULE = strip(readFileSync(MODULE_PATH, "utf8"));

describe("CORE-2C A — 파라미터 파서", () => {
  it("A-1 🟢 줄바꿈으로 나눠 읽는다(북마크릿이 그 모양으로 보낸다)", () => {
    const q = `?${SUPPLIED_URL_PARAM}=${encodeURIComponent("https://a.example/products/1\nhttps://b.example/products/2")}`;
    expect(parseSuppliedUrlsParam(q)).toEqual([
      "https://a.example/products/1",
      "https://b.example/products/2",
    ]);
  });

  it("A-2 🔴 `http(s)` 가 아니면 버린다 — 서버에 쓰레기를 보내지 않는다", () => {
    const bad = ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "file:///etc/passwd", "ftp://x/y"];
    const q = `?${SUPPLIED_URL_PARAM}=${encodeURIComponent([...bad, "https://ok.example/products/z"].join("\n"))}`;
    expect(parseSuppliedUrlsParam(q)).toEqual(["https://ok.example/products/z"]);
  });

  it("A-3 🔴 중복을 제거한다(같은 상품을 두 번 fetch 하지 않는다)", () => {
    const u = "https://a.example/products/1";
    const q = `?${SUPPLIED_URL_PARAM}=${encodeURIComponent([u, u, u].join("\n"))}`;
    expect(parseSuppliedUrlsParam(q)).toEqual([u]);
  });

  it("A-4 🔴 상한을 지킨다 · 북마크릿과 **같은 숫자** 다", () => {
    const many = Array.from({ length: MAX_HANDOFF_URLS + 20 }, (_, i) => `https://s.example/products/p${i}`);
    const q = `?${SUPPLIED_URL_PARAM}=${encodeURIComponent(many.join("\n"))}`;
    expect(parseSuppliedUrlsParam(q)).toHaveLength(MAX_HANDOFF_URLS);
    expect(
      buildBookmarkletForSnapshot("https://x", "s"),
      "🔴 두 상한이 갈라지면 조용히 잘린다",
    ).toContain(`slice(0,${MAX_HANDOFF_URLS})`);
  });

  it("A-5 🟢 파라미터가 없으면 빈 배열이다(아무 일도 일어나지 않는다)", () => {
    expect(parseSuppliedUrlsParam("")).toEqual([]);
    expect(parseSuppliedUrlsParam("?resume=abc")).toEqual([]);
    expect(parseSuppliedUrlsParam(`?${SUPPLIED_URL_PARAM}=`)).toEqual([]);
  });

  it("A-6 🔴 깨진 URL 은 버린다", () => {
    const q = `?${SUPPLIED_URL_PARAM}=${encodeURIComponent("https://\nhttps://good.example/p/1")}`;
    expect(parseSuppliedUrlsParam(q)).toEqual(["https://good.example/p/1"]);
  });
});

describe("CORE-2C B — 북마크릿 생성", () => {
  it("B-1 🔴 상품(스냅샷)에 묶인다 — `resume` 이 박혀 있다", () => {
    const b = buildBookmarkletForSnapshot("https://ttaejyo.vercel.app", "snap-42");
    expect(b).toContain("/pipeline?resume=snap-42");
    expect(b).toContain(`${SUPPLIED_URL_PARAM}=`);
  });

  it("B-2 🔴 `fetch`/XHR 를 쓰지 않는다 — CSP `connect-src` 와 쿠키 `SameSite=Lax` 를 피한다", () => {
    const b = buildBookmarkletForSnapshot("https://x", "s");
    expect(b).not.toContain("fetch(");
    expect(b).not.toContain("XMLHttpRequest");
    expect(b, "🔴 top-level 내비게이션이어야 인증이 유지된다").toContain("location.href=");
  });

  it("B-3 🔴 origin 끝 슬래시를 두 번 붙이지 않는다", () => {
    expect(buildBookmarkletForSnapshot("https://x/", "s")).toContain("https://x/pipeline?resume=s");
  });

  it("B-4 🔴 snapshotId 를 URL 인코딩한다(주입 방지)", () => {
    expect(buildBookmarkletForSnapshot("https://x", "a&b=c")).toContain("resume=a%26b%3Dc");
  });
});

describe("CORE-2C C — 🔴🔴 배선(소스 앵커 — 순수 함수만으로는 못 본다)", () => {
  it("C-1 🔴 페이지가 **owner 모듈** 에서 파서를 가져온다(사본 금지)", () => {
    expect(PAGE).toContain('from "./supplied-url-handoff"');
    expect(PAGE).toContain("parseSuppliedUrlsParam(window.location.search)");
  });

  it("C-2 🔴🔴 받은 URL 이 **실제로 `/check` body 에 실린다**", () => {
    expect(PAGE).toContain("candidateUrls: suppliedUrls");
    /** 🔴 같은 블록 안이어야 한다 — 파싱만 하고 안 보내면 아무 일도 안 일어난다. */
    const parsed = PAGE.indexOf("parseSuppliedUrlsParam(window.location.search)");
    const sent = PAGE.indexOf("candidateUrls: suppliedUrls");
    expect(parsed, "🔴 파싱 지점을 찾지 못했다").toBeGreaterThan(-1);
    expect(sent, "🔴 전송 지점을 찾지 못했다").toBeGreaterThan(parsed);
    /**
     * 🔴 파싱과 전송 사이의 `/check` 호출은 **정확히 하나** 여야 한다 —
     *    그것이 「받은 URL 을 싣는 그 호출」이다.
     * 🔴🔴 1차 단언이 「사이에 `check` 가 **없어야** 한다」였고 **내 단언이 틀렸다**
     *    (사이에 있는 것은 내가 넣은 바로 그 호출이다). 코드가 맞고 단언이 틀렸다.
     */
    const between = PAGE.slice(parsed, sent).split("price-history/check").length - 1;
    expect(between, "🔴 파싱과 전송 사이의 /check 호출이 하나가 아니다 — 배선이 갈라졌다").toBe(1);
  });

  it("C-3 🔴 `resume` 복원 **뒤** 에 있어야 snapshotId 를 안다", () => {
    const restored = PAGE.indexOf("snapshotIdRef");
    const resumeRead = PAGE.indexOf('get("resume")');
    const parsed = PAGE.indexOf("parseSuppliedUrlsParam(window.location.search)");
    expect(resumeRead).toBeGreaterThan(-1);
    expect(parsed, "🔴 핸드오프가 resume 파싱보다 앞에 있으면 스냅샷을 모른다").toBeGreaterThan(resumeRead);
    expect(restored).toBeGreaterThan(-1);
  });

  it("C-4 🔴 **빈 목록이면 호출하지 않는다** — 쓸데없는 조사/과금을 만들지 않는다", () => {
    expect(PAGE).toContain("if (suppliedUrls.length > 0)");
  });

  it("C-5 🔴 한 번 쓰고 **URL 에서 지운다**(새로고침 재조사 방지)", () => {
    expect(PAGE).toContain("searchParams.delete(SUPPLIED_URL_PARAM)");
  });

  it("C-6 🔴🔴 **셀러 입력칸을 되살리지 않았다** · 새 UI 를 만들지 않았다", () => {
    /** 🔴 flag owner 의 기본값이 바뀌면 WU-130 ③ 이 숨긴 입력칸이 돌아온다. */
    const panel = strip(
      readFileSync(path.join(HERE, "..", "commerce", "DomesticPriceIntelligencePanel.tsx"), "utf8"),
    );
    expect(panel).toContain('process.env.NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT === "true"');
    /**
     * 🔴 이 모듈이 화면 요소를 만들지 않는다.
     * 🔴🔴 1차 단언이 `not.toContain("<")` 였고 **내 단언이 틀렸다** —
     *    `for(var i=0;i<a.length;…)` 의 비교 연산자를 JSX 로 읽었다.
     * 🟢 구조적 보장으로 바꿨다 — 파일 확장자가 **`.ts`** 면 JSX 가 존재할 수 없다.
     */
    expect(MODULE_PATH.endsWith(".ts"), "🔴 `.tsx` 가 되면 화면 요소를 만들 수 있다").toBe(true);
    expect(MODULE).not.toContain("React");
    expect(MODULE).not.toContain("</");
    expect(MODULE).not.toContain("useState");
  });

  it("C-7 🔴 MI·가격·threshold 어휘가 이 모듈에 **없다**(경계를 넘지 않는다)", () => {
    for (const banned of ["SAME", "threshold", "priceTier", "matchTruth", "judgeDomestic", "Registry"]) {
      expect(MODULE, `🔴 "${banned}" 가 생겼다 — 이 모듈은 전송만 한다`).not.toContain(banned);
    }
  });

  it("C-8 🔴 서버 검증을 **복제하지 않는다**(규칙 owner 는 route 다)", () => {
    for (const banned of ["MAX_CANDIDATE_URL_LENGTH", "MAX_SUPPLIED_CANDIDATE_URLS", "2048"]) {
      expect(MODULE, `🔴 "${banned}" 를 복제했다 — 갈라지면 둘이 다른 말을 한다`).not.toContain(banned);
    }
  });
});

describe("CORE-2C D — 추출 로직 owner 가 하나다", () => {
  it("D-1 🟢 북마크릿 본체와 `collectFromResultLinks` 가 같은 성질을 갖는다", () => {
    const b = buildBookmarkletForSnapshot("https://x", "s");
    /** 🔴 다섯 성질 — 둘 중 하나만 바뀌면 이 단언이 깨진다. */
    expect(b).toContain("uddg");
    expect(b).toContain("u.origin===o");
    expect(b).toContain("s[h]");
    expect(collectFromResultLinks(["https://a/x", "https://a/x"], "https://b")).toHaveLength(1);
    expect(collectFromResultLinks(["https://b/self"], "https://b")).toHaveLength(0);
  });
});
