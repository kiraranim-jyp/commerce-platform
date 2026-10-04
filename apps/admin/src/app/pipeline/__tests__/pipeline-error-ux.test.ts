import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyExtractionFailure, containsRawTechnicalDetail } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MARKET-RESEARCH-ERROR-UX-01 — **배선** 계약 (CEO 지시 3·4·5·7·9)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 분류 함수가 옳아도 라우트가 raw 를 그대로 보내거나 화면이 그것을 찍으면
 * 아무 소용이 없다. 그 배선을 원문으로 확인한다.
 *
 * 🔴 소스 문자열 검사는 주석을 벗기고 한다 — 이 파일들의 주석에 `page.goto` 와
 * raw 문구가 «설명으로» 여러 번 나온다(아홉 번 걸린 함정).
 */
const HERE = __dirname;
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

const ROUTE = codeOnly(readFileSync(join(HERE, "../../api/pipeline/route.ts"), "utf8"));
const PAGE = codeOnly(readFileSync(join(HERE, "../page.tsx"), "utf8"));
const TYPES = codeOnly(readFileSync(join(HERE, "../../api/pipeline/response.types.ts"), "utf8"));

describe("① 🔴 라우트가 raw 메시지를 «그대로» 보내지 않는다", () => {
  it("분류기를 거친다", () => {
    expect(ROUTE).toContain("classifyExtractionFailure(message, url)");
  });

  it("🔴 error 칸에 분류된 문장이 들어간다 — raw message 가 아니다", () => {
    expect(ROUTE).toContain("error: failure.message");
    /* 예전 코드: `error: message, code: classifyPipelineError(message)` */
    expect(ROUTE).not.toContain('send({ type: "error", error: message');
  });

  it("해결 방법·재시도 가능 여부·사이트명을 함께 싣는다", () => {
    for (const field of ["resolution: failure.resolution", "retryable: failure.retryable", "siteName: failure.siteName"]) {
      expect(ROUTE, field).toContain(field);
    }
  });

  it("🔴 이미지/429 분류기는 «남겨» 뒀다 — 보는 것이 다르다", () => {
    expect(ROUTE).toContain("function classifyPipelineError(");
    expect(ROUTE).toContain('return "IMG001"');
  });
});

describe("② 🔴 화면이 raw 를 찍지 않고 세 가지를 갈라 말한다 (CEO 지시 4)", () => {
  it("분류된 실패를 상태로 받는다", () => {
    expect(PAGE).toContain("setFailure(event.failure ?? null)");
  });

  it("무엇을 하면 되는지 보여준다", () => {
    expect(PAGE).toContain("failure?.resolution");
  });

  it("🔴 재시도 «가능할 때만» 버튼을 보여준다", () => {
    expect(PAGE).toContain("failure?.retryable &&");
    expect(PAGE).toContain("다시 시도");
  });

  it("🔴 새 retry 시스템을 만들지 않았다 — 기존 runPipeline 을 그대로 부른다", () => {
    const at = PAGE.indexOf("다시 시도");
    const around = PAGE.slice(Math.max(0, at - 400), at);
    expect(around).toContain("onClick={runPipeline}");
    /* 새 엔드포인트를 만들지 않았다. */
    expect(PAGE).not.toContain("/api/pipeline/retry-timeout");
  });

  it("분석을 다시 시작하면 이전 실패가 지워진다", () => {
    expect(PAGE).toContain("setFailure(null)");
  });

  it("🔴 화면 코드에 Playwright 문구가 «한 글자도» 없다", () => {
    for (const needle of ["page.goto", "domcontentloaded", "networkidle", "Call log"]) {
      expect(PAGE, needle).not.toContain(needle);
    }
  });
});

describe("③ 🔴 타입이 서버와 화면에서 «같은 모양» 이다", () => {
  it("PipelineFailure 가 이름 있는 타입으로 export 된다", () => {
    expect(TYPES).toContain("export interface PipelineFailure");
  });

  it("화면이 그 타입을 그대로 재사용한다 — 자기 타입을 새로 만들지 않았다", () => {
    expect(PAGE).toContain('import type { PipelineFailure } from "@/app/api/pipeline/response.types"');
    expect(PAGE).not.toMatch(/interface\s+\w*Failure\s*\{/);
  });

  it("기존 error·code 칸을 그대로 뒀다 — 하위호환", () => {
    expect(TYPES).toContain("error: string;");
    expect(TYPES).toContain("code?: ErrorCode;");
    expect(TYPES).toContain("failure?: PipelineFailure;");
  });
});

describe("④ 🔴 한 사이트 실패가 전체 시장조사를 «실패시키지 않는다» (CEO 지시 5)", () => {
  const CRAWLER = readFileSync(
    join(HERE, "../../../../../../packages/crawler/src/comparison-search/index.ts"),
    "utf8",
  );

  it("국내·해외 모두 allSettled 로 «사이트별» 로 받는다 — 이미 그렇게 돼 있었다", () => {
    expect(CRAWLER).toContain("Promise.allSettled(shops.map((shop) => searchOneShop(shop, query)))");
    expect(CRAWLER).toContain(
      "Promise.allSettled(sources.map((source) => searchOneDomesticShop(source, query)))",
    );
  });

  it("🔴 Promise.all 로 바꾸지 않았다 — 하나가 reject 되면 전체가 날아간다", () => {
    const codeCrawler = codeOnly(CRAWLER);
    expect(codeCrawler).not.toMatch(/Promise\.all\((?!Settled)/);
  });

  it("🔴 시장조사는 Playwright 를 쓰지 «않는다» — Zalando timeout 과 무관하다", () => {
    const codeCrawler = codeOnly(CRAWLER);
    for (const needle of ["page.goto", "playwright", "chromium"]) {
      expect(codeCrawler.toLowerCase(), needle).not.toContain(needle);
    }
  });
});

describe("⑤ 🔴 음성 대조 — 분류를 지우면 raw 가 다시 새어 나간다", () => {
  it("분류를 거치지 않은 raw 는 실제로 기술 문구를 담고 있다", () => {
    const raw = 'page.goto: Timeout 30000ms exceeded. Call log: waiting until "domcontentloaded"';
    /* 이것이 전에 화면에 그대로 찍혔다. */
    expect(containsRawTechnicalDetail(raw)).toBe(true);
    /* 분류를 거치면 사라진다. */
    const f = classifyExtractionFailure(raw, "https://www.zalando.de/x");
    expect(containsRawTechnicalDetail(f.message)).toBe(false);
    expect(f.retryable).toBe(true);
  });

  it("🔴 모든 사이트가 timeout 이어도 분류는 사이트별로 각각 나온다", () => {
    const sites = ["https://www.zalando.de/a", "https://danawa.com/b", "https://shoppinghow.kakao.com/c"];
    const results = sites.map((u) => classifyExtractionFailure("Timeout 30000ms exceeded", u));
    expect(results.map((r) => r.siteName)).toEqual(["zalando.de", "danawa.com", "shoppinghow.kakao.com"]);
    /* 전부 재시도 가능이고, 문구가 각자 자기 사이트를 말한다. */
    for (const r of results) {
      expect(r.retryable).toBe(true);
      expect(r.message).toContain(r.siteName!);
    }
  });

  it("정상 응답 회귀 — 성공 경로는 failure 를 싣지 않는다", () => {
    /* complete 이벤트에는 failure 칸이 없다(유니온이 갈려 있다). */
    const completeBranch = TYPES.slice(TYPES.indexOf('{ type: "complete" }'), TYPES.indexOf('type: "error"'));
    expect(completeBranch).not.toContain("failure");
  });
});
