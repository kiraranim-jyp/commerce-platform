/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UXC-국내공급 — **한국 로케일 «한정» 예외**(CPO ⒜ 승인 2026-11-14)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 원인(실측) — 요청에 로케일이 **아예 없어** Google 이 actor 데이터센터 기준
 *    (사실상 미국)으로 답했다 ⟹ 국내 상품 페이지가 상위에 거의 오르지 않는다.
 *    최근 성공 실행 organic **2건이 둘 다 해외** · 국내 링크 **0행**.
 *
 * 🟢 **Actor 지원을 먼저 확인했다**(공개 input schema · 토큰 0 · 비용 0) —
 *    `countryCode`("Country"=gl) · `languageCode`("Interface language"=hl) 지원.
 *    🔴 `searchLanguage`("Search language"=lr)는 **의미가 다르고 계속 금지** 다.
 *
 * 🔴 이 파일이 잠그는 것 — ⒜ 예외는 **그 둘뿐** ⒝ **비용 축 불변** ⒞ 로케일을
 *    **시장 분류 근거로 쓰지 않는다** ⒟ 실패 구분이 그대로다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_SEARCHES_PER_PRODUCT,
  SEARCH_LANGUAGE_CODE,
} from "../web-search-pool";

const SRC = readFileSync(join(__dirname, "../web-search-pool.ts"), "utf8")
  .split(String.fromCharCode(13))
  .join("");
/** 🔴 **주석을 벗기고** 본다 — 이 리포가 여덟 번 밟은 함정이다. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const BODY = CODE.slice(
  CODE.indexOf("body: JSON.stringify({"),
  CODE.indexOf("}),", CODE.indexOf("body: JSON.stringify({")),
);

describe("UXC-⒜ 한국 로케일 한정 예외", () => {
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 **STEP A 롤백(2026-11-14)** — `countryCode` 는 **전송하지 않는다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 실측 A/B — 같은 상품(`b226tc174`) · 같은 질의 · 배포 전후:
   * ```
   * 로케일 전   organic **2**   (11-14 03:50:05)
   * 로케일 후   organic **0**   (06:49:42 · 06:50:33 · 둘 다 failed=false)
   * ```
   * 🔴 「국내가 늘어난다」는 내 가설이 **반증됐다** — 따옴표 둘로 이미 좁은 질의에
   *    한국 색인 제한이 겹쳐 **전체가 0** 이 됐다.
   * 🔵 `languageCode` 는 **임의로 결정하지 않는다**(CPO 명시) — 유지한 채 두고
   *    **별도 비교 측정** 대상으로 남긴다.
   */
  it("A-1 🔴 국가 코드는 **보내지 않는다** · 언어 코드만 남는다", () => {
    expect(BODY, "🔴 국가 코드가 되살아났다 — organic 이 0 이 된다").not.toContain("countryCode");
    expect(BODY).toContain("languageCode: SEARCH_LANGUAGE_CODE");
    expect(SEARCH_LANGUAGE_CODE).toBe("ko");
  });

  it("A-2 🔴🔴 **예외는 그 둘뿐** — 나머지 지역/언어 파라미터는 계속 금지", () => {
    for (const banned of [
      "countryCode",
      "locationUule",
      "searchLanguage",
      "mobileResults",
      "gl:",
      "hl:",
      "cr:",
      "lr:",
    ]) {
      expect(BODY, `🔴 금지 파라미터가 들어왔다: ${banned}`).not.toContain(banned);
    }
  });

  it("A-3 🔴🔴 **비용 축이 그대로다** — 질의 수 1 · 페이지 2 · 호출 지점 하나", () => {
    expect(MAX_SEARCHES_PER_PRODUCT, "🔴 상품당 질의 수가 늘었다(비용 증가)").toBe(1);
    expect(CODE, "🔴 페이지 상한이 바뀌었다(비용 증가)").toContain("const MAX_PAGES_PER_QUERY = 2;");
    /** 🔴 선언 1 + 호출 1 = 2. 2차 질의·재시도가 들어오면 FAIL 한다. */
    expect((CODE.match(/apifySearch\(/g) ?? []).length, "🔴 검색 호출 지점이 늘었다").toBe(2);
  });

  it("A-4 🔴🔴 로케일을 **시장 분류 근거로 쓰지 않는다**(해외를 국내로 만들지 않는다)", () => {
    expect(CODE, "🔴 검색 파일이 시장 분류를 하기 시작했다").not.toContain("classifyCandidateMarket");
    for (const banned of ['market: "KR"', "isDomestic", "forceDomestic"]) {
      expect(CODE, `🔴 로케일로 시장을 단정한다: ${banned}`).not.toContain(banned);
    }
  });

  it("A-5 🟢 **질의 문자열은 바뀌지 않았다** — 바뀐 것은 «어느 시장 기준으로 묻는가» 뿐", () => {
    expect(CODE, "🔴 질의를 둘로 쪼갰다").not.toContain("domesticQuery");
    expect(CODE, "🔴 질의 생성 owner 가 갈렸다").toContain("buildCompositeDiscoveryQuery");
  });

  it("A-6 🔴 **실패 구분은 그대로다** — 로케일 추가가 그것을 흐리지 않는다", () => {
    expect(CODE).toContain('metrics.skipped = "NOT_CONFIGURED"');
    expect(CODE).toContain('metrics.skipped = "NO_MODEL_CODE"');
    expect(CODE, "🔴 공급자 오류 분류 코드 수집이 사라졌다").toContain("readErrorType(res)");
  });
});
