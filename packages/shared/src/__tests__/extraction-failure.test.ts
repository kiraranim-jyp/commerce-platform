import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyExtractionFailure,
  containsRawTechnicalDetail,
  siteNameFromUrl,
  type ExtractionFailureKind,
} from "../extraction-failure";
import { ERROR_CODE_INFO } from "../error-codes";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MARKET-RESEARCH-ERROR-UX-01 — CEO 실측 오류를 계약으로 고정한다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 재는 것은 「문구가 예쁜가」가 아니라 **「raw 기술 문구가 셀러 화면에 닿지
 * 않는가」** 와 **「재시도해도 되는 것과 안 되는 것을 가르는가」** 다.
 */

/** CEO 가 실제로 본 문구(2026-10-04). 한 글자도 바꾸지 않았다. */
const CEO_ACTUAL = `page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "https://www.zalando.de/some-product.html", waiting until "domcontentloaded"`;

const ZALANDO_URL = "https://www.zalando.de/some-product.html";

describe("① 🔴 CEO 가 본 그 오류가 TIMEOUT 으로 분류된다", () => {
  const f = classifyExtractionFailure(CEO_ACTUAL, ZALANDO_URL);

  it("kind 가 TIMEOUT 이다", () => {
    expect(f.kind).toBe("TIMEOUT");
  });

  it("🔴 재시도 «가능» 하다 — 전에는 EXT001(불가)로 떨어졌다", () => {
    expect(f.retryable).toBe(true);
    expect(f.code).toBe("EXT005");
    expect(ERROR_CODE_INFO.EXT005.autoRetryable).toBe(true);
  });

  it("사이트 이름을 말한다 — www 를 떼고 호스트만", () => {
    expect(f.siteName).toBe("zalando.de");
    expect(f.message).toContain("zalando.de");
  });

  it("🔴 무엇을 하면 되는지 말한다", () => {
    expect(f.resolution).toContain("다시 시도");
  });

  it("🔴🔴 raw 기술 문구가 «하나도» 섞이지 않았다", () => {
    for (const text of [f.message, f.resolution]) {
      expect(containsRawTechnicalDetail(text), text).toBe(false);
    }
    /* 원문에는 그것이 있다 — 즉 이 검사가 공허하지 않다. */
    expect(containsRawTechnicalDetail(CEO_ACTUAL)).toBe(true);
  });

  it("🔴 전체 URL 을 화면 문구에 넣지 않는다 — 호스트만", () => {
    expect(f.message).not.toContain("some-product.html");
    expect(f.message).not.toContain("https://");
  });
});

describe("② 🔴 TIMEOUT · BLOCKED · PARSE_FAILED 를 가른다 (CEO 지시 6)", () => {
  const CASES: [string, string, ExtractionFailureKind, boolean][] = [
    ["timeout", "Timeout 30000ms exceeded", "TIMEOUT", true],
    ["navigation timeout", "Navigation timeout of 30000 ms exceeded", "TIMEOUT", true],
    ["ETIMEDOUT", "connect ETIMEDOUT 1.2.3.4:443", "TIMEOUT", true],
    ["403", "Request failed with status 403", "BLOCKED", false],
    ["401", "HTTP 401 Unauthorized", "BLOCKED", false],
    ["robots", "robots.txt disallows this path", "BLOCKED", false],
    ["captcha", "captcha challenge detected", "BLOCKED", false],
    ["연결 거부", "connect ECONNREFUSED 127.0.0.1:443", "BLOCKED", false],
    ["상품명 없음", "상품명을 찾을 수 없습니다", "PARSE_FAILED", false],
    ["가격 없음", "가격 정보를 찾을 수 없습니다", "PARSE_FAILED", false],
  ];

  it.each(CASES)("%s → %s", (_label, raw, kind, retryable) => {
    const f = classifyExtractionFailure(raw, ZALANDO_URL);
    expect(f.kind).toBe(kind);
    expect(f.retryable).toBe(retryable);
  });

  it("🔴 차단을 timeout «보다 먼저» 본다 — 막힌 벽을 반복해 두드리게 하지 않는다", () => {
    /* 차단된 요청이 느리게 끝나며 두 문구가 함께 붙는 경우가 실제로 있다. */
    const both = classifyExtractionFailure("403 Forbidden — Timeout 30000ms exceeded", ZALANDO_URL);
    expect(both.kind).toBe("BLOCKED");
    expect(both.retryable).toBe(false);
  });

  it("🔴 모르면 UNKNOWN 이다 — timeout 으로 몰아넣지 않는다", () => {
    const f = classifyExtractionFailure("무언가 잘못됐습니다", ZALANDO_URL);
    expect(f.kind).toBe("UNKNOWN");
    expect(f.retryable).toBe(false);
    /* 기존 표의 문구를 그대로 쓴다 — 새 문장을 지어내지 않는다. */
    expect(f.message).toBe(ERROR_CODE_INFO.EXT001.defaultMessage);
  });

  it("🔴 네 종류 모두 raw 문구를 내보내지 않는다", () => {
    for (const [, raw] of CASES) {
      const f = classifyExtractionFailure(raw, ZALANDO_URL);
      expect(containsRawTechnicalDetail(f.message), raw).toBe(false);
      expect(f.message, raw).not.toContain(raw);
    }
  });
});

describe("③ 사이트 이름 — 지어내지 않는다", () => {
  it.each([
    ["https://www.zalando.de/x", "zalando.de"],
    ["https://shop.example.co.kr/a?b=1", "shop.example.co.kr"],
    ["https://danawa.com", "danawa.com"],
  ])("%s → %s", (url, expected) => {
    expect(siteNameFromUrl(url)).toBe(expected);
  });

  it("🔴 URL 이 없거나 깨졌으면 null 이다 — 추측하지 않는다", () => {
    for (const bad of [null, undefined, "", "not a url", "   "]) {
      expect(siteNameFromUrl(bad)).toBeNull();
    }
  });

  it("사이트를 모르면 문구가 「해당 사이트」다", () => {
    const f = classifyExtractionFailure("Timeout 30000ms exceeded", null);
    expect(f.siteName).toBeNull();
    expect(f.message).toContain("해당 사이트");
  });
});

describe("④ 🔴 timeout 값을 늘리지 «않았다» (CEO 지시 2·8)", () => {
  const EXTRACTOR = readFileSync(
    join(__dirname, "../../../crawler/src/universal-extractor.ts"),
    "utf8",
  );

  it("네비게이션 timeout 이 여전히 설정값 하나다 — 숫자를 박아 늘리지 않았다", () => {
    expect(EXTRACTOR).toContain("timeout: config.navigationTimeoutMs");
    for (const hardcoded of ["timeout: 60000", "timeout: 120000", "timeout: 90000"]) {
      expect(EXTRACTOR, hardcoded).not.toContain(hardcoded);
    }
  });

  it("🔴 2단 재시도가 «이미» 있었다 — 그래서 CEO 가 본 것은 두 번째 실패다", () => {
    expect(EXTRACTOR).toContain('waitUntil: "networkidle"');
    expect(EXTRACTOR).toContain('waitUntil: "domcontentloaded"');
    /* networkidle 이 먼저고 실패하면 domcontentloaded 로 재시도한다. */
    expect(EXTRACTOR.indexOf('waitUntil: "networkidle"')).toBeLessThan(
      EXTRACTOR.indexOf('waitUntil: "domcontentloaded"'),
    );
  });
});

describe("⑤ 🔴 새 ErrorCode 를 «하나» 만 더했다 — 기존 표를 흔들지 않았다", () => {
  it("EXT001~004 의 autoRetryable 이 그대로 false 다", () => {
    for (const code of ["EXT001", "EXT002", "EXT003", "EXT004"] as const) {
      expect(ERROR_CODE_INFO[code].autoRetryable, code).toBe(false);
    }
  });

  it("EXT005 만 true 다 — timeout 을 담을 칸이 없어서 만든 것이다", () => {
    expect(ERROR_CODE_INFO.EXT005.autoRetryable).toBe(true);
    expect(ERROR_CODE_INFO.EXT005.category).toBe("EXT");
  });

  it("🔴 기존 코드의 문구를 바꾸지 않았다", () => {
    expect(ERROR_CODE_INFO.EXT001.defaultMessage).toBe("상품 페이지에 접근할 수 없습니다.");
    expect(ERROR_CODE_INFO.EXT004.defaultMessage).toBe("지원하지 않는 사이트 구조입니다.");
  });
});
