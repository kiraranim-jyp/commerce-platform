import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6(CEO 실측, 2026-10-09) — **모든 탭에서 2중 스크롤**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 기존 가드가 왜 못 잡았는가 ─────────────────────────────────────────
 * `p0kc07-kc-section-coherence` ④ 가 「세로 스크롤은 하나다」를 이미 박아 뒀고
 * 지금도 통과한다. 그 가드가 보는 것은 **AppShell 두 줄** 이다 —
 *
 *   div.h-dvh.overflow-hidden            바깥은 안 움직인다
 *   main.min-h-0.flex-1.overflow-y-auto  여기서만 스크롤
 *
 * 그 둘은 맞았다. 틀린 것은 그 «바깥» 이었다 — `layout.tsx` 의 html·body.
 * `html.h-full` + `body.min-h-full` 이고 어느 쪽에도 overflow 가 없었다.
 * `min-h-full` 은 «최소» 높이라 body 가 더 커질 수 있고, 안의 `h-dvh`(동적
 * 뷰포트)가 `h-full`(=100%)보다 커지는 순간 body 가 자기 스크롤바를 만든다.
 *
 * 🔴 교훈: 「스크롤 컨테이너가 하나인가」를 재려면 **문서 루트까지** 봐야 한다.
 *    한 컴포넌트만 보는 가드는 그 컴포넌트가 맞은 채로 화면이 틀릴 수 있다
 *    (p0kc07 자신이 「한 파일만 검사하면 못 잡는다」를 적어 둔 그 함정이다).
 */

const ROOT = join(__dirname, "../../..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("🔴 페이지 스크롤 컨테이너는 «하나» 다 — 문서 루트부터", () => {
  const LAYOUT = strip(read("src/app/layout.tsx"));

  it("html 이 뷰포트에 «고정» 돼 있다", () => {
    expect(LAYOUT, "html 에 h-dvh 가 없다").toContain("h-dvh");
    const html = LAYOUT.slice(LAYOUT.indexOf("<html"), LAYOUT.indexOf("<body"));
    expect(html, "html 이 자기 스크롤을 만들 수 있다").toContain("overflow-hidden");
  });

  it("🔴 body 가 «최소» 높이가 아니다 — min-h-full 이 그 증상의 원인이었다", () => {
    const body = LAYOUT.slice(LAYOUT.indexOf("<body"), LAYOUT.indexOf("</html>"));
    expect(body, "body 가 뷰포트보다 커질 수 있다").not.toContain("min-h-full");
    expect(body, "body 에 h-dvh 가 없다").toContain("h-dvh");
    expect(body, "body 가 자기 스크롤을 만들 수 있다").toContain("overflow-hidden");
  });

  it("AppShell 의 두 줄은 «그대로» 다 — 그쪽은 맞았다", () => {
    const shell = strip(read("src/components/layout/AppShell.tsx"));
    expect(shell).toContain('<div className="flex h-dvh flex-col overflow-hidden">');
    expect(shell).toContain('<main className="min-h-0 flex-1 overflow-y-auto">');
  });

  it("🔴 globals.css 가 body 에 min-height 를 다시 주지 않는다", () => {
    const css = read("src/app/globals.css");
    const at = css.indexOf("body {");
    expect(at).toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    for (const bad of ["min-height", "height:", "overflow"]) {
      expect(rule, `globals.css 의 body 규칙이 ${bad} 를 정한다 — layout.tsx 와 두 벌이 된다`).not.toContain(
        bad,
      );
    }
  });

  it("🔴 파이프라인 안에 «또 하나의» 페이지 스크롤이 없다 — pre 뷰어만 예외", () => {
    /* 스크롤 컨테이너를 쓰려면 max-h 로 «자기 높이를 제한한» 뷰어여야 한다.
       높이 제한 없는 overflow-y-auto 는 페이지 스크롤을 한 겹 더 만든다. */
    const files = [
      "src/app/pipeline/CommerceWorkspace.tsx",
      "src/app/pipeline/commerce/ChannelRegistrationFrame.tsx",
      "src/app/pipeline/commerce/StageBody.tsx",
      "src/app/pipeline/commerce/PlatformPreview.tsx",
      "src/app/pipeline/commerce/LotteOnRegistrationPanel.tsx",
      "src/app/pipeline/page.tsx",
    ];
    for (const rel of files) {
      const src = strip(read(rel));
      for (const line of src.split("\n")) {
        if (!/overflow-y-auto|overflow-y-scroll/.test(line)) continue;
        expect(
          /max-h-|h-\d|h-\[/.test(line),
          `${rel} 에 높이 제한 없는 세로 스크롤이 있다 — 페이지 스크롤이 둘이 된다:\n${line.trim()}`,
        ).toBe(true);
      }
    }
  });
});
