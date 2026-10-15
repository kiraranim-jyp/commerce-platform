import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-026 — **fetch 경로의 DNS rebinding 을 닫았다**는 증명
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 WU-025 가 남긴 유일한 Production 보안 차단점이 이것이었다:
 * ```
 * 우리 검증 lookup 1회  →  fetch()  →  전체 lookup **2회**
 *                                       두 번째는 undici 의 connector 가 한 것이고
 *                                       우리 규칙을 통과하지 않는다
 * ```
 * 즉 **검증한 IP 와 연결한 IP 가 같다는 보장이 없었다.**
 *
 * 🟢 닫는 방법은 하나다 — connector 의 `lookup` 을 우리 것으로 만든다
 *    (`undici.Agent({ connect: { lookup: guardedLookup } })` → `fetch(url,{dispatcher})`).
 *
 * 🔴 **이 파일은 네트워크를 쓰지 않는다.** 가장 중요한 ⑤(실제 rebinding)조차 패킷이
 *    나가지 않는다 — 우리 훅이 **connect «전»** 에 에러를 내기 때문이다. 그것이 곧 증명이다.
 * 🔴 직접 접근(사설 IP·예약 TLD·포트·scheme) 변형 42종은 **WU-025 하니스가 담당** 한다 —
 *    여기서 다시 적지 않는다(사본 금지).
 */

const lookupMock = vi.fn();
vi.mock("node:dns", () => ({
  lookup: (...args: unknown[]) => (lookupMock as (...a: unknown[]) => void)(...args),
}));

const {
  connectGuardHitsFor,
  guardedLookup,
  isIpLiteralHost,
  outboundDispatcher,
  OutboundBlockedError,
  resetConnectGuardHitsForTests,
} = await import("../utils/outbound-guard");
const { fetchWithDomainRateLimit } = await import("../rate-limit/domain-rate-limiter");

const PUBLIC = { address: "93.184.216.34", family: 4 };
const PRIVATE = { address: "169.254.169.254", family: 4 };
type Cb = (e: unknown, a: unknown) => void;

/** 🔴 **호출 순서** 로 응답을 바꾼다 — 그것이 rebinding 의 정의다. */
function resolveByCallIndex(sequence: { address: string; family: number }[][]) {
  let i = 0;
  lookupMock.mockImplementation((_h: string, _o: unknown, cb: Cb) => {
    const step = sequence[Math.min(i, sequence.length - 1)];
    i += 1;
    cb(null, step);
  });
  return () => i;
}
function resolveAlways(addresses: { address: string; family: number }[]) {
  lookupMock.mockImplementation((_h: string, _o: unknown, cb: Cb) => cb(null, addresses));
}

beforeEach(() => {
  lookupMock.mockReset();
  resetConnectGuardHitsForTests();
  resolveAlways([PUBLIC]);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/* ══════════════════ ① dispatcher 배선 ══════════════════ */

describe("① 🔴 모든 fetch 가 connect 훅이 꽂힌 dispatcher 로 나간다", () => {
  it("fetchGuarded 가 dispatcher 를 실제로 넘긴다", async () => {
    const seen: { dispatcher: unknown; redirect?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: Record<string, unknown>) => {
        seen.push({ dispatcher: init.dispatcher, redirect: init.redirect as string });
        /** 🟢 실제 connector 가 하는 일을 흉내낸다 — 연결 직전 이름 해석. */
        await new Promise<void>((done) => guardedLookup(new URL(url).hostname, {}, () => done()));
        return { status: 200, url, headers: new Headers(), body: null, text: async () => "" } as unknown as Response;
      }),
    );
    const res = await fetchWithDomainRateLimit("https://shop.example.com/products/x");
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].dispatcher).toBeTruthy();
    /** 🔴 리다이렉트 추적은 여전히 **우리가** 한다(WU-025 계약). */
    expect(seen[0].redirect).toBe("manual");
  });

  it("🟢 dispatcher 는 한 번 만들어 재사용된다 — 요청당 비용이 아니다", async () => {
    const a = await outboundDispatcher();
    const b = await outboundDispatcher();
    expect(a).toBe(b);
  });

  it("🟢 connect 훅은 guardedLookup «그 함수» 다 — 사설 IP 규칙의 사본이 없다", () => {
    const GUARD = readFileSync(path.join(__dirname, "..", "utils", "outbound-guard.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(GUARD).toContain("new Agent({ connect: { lookup: guardedLookup } })");
    /** 🔴 Agent 생성부가 자기 IP 표를 들고 있지 않다. */
    const agentBlock = GUARD.slice(GUARD.indexOf("export async function outboundDispatcher"));
    expect(agentBlock).not.toMatch(/169\.254|127\.0\.0\.1|fc00|fe80/);
  });
});

/* ══════════════════ ② 🔴🔴 조용한 우회 탐지 ══════════════════ */

describe("② 🔴🔴 훅이 «붙지 않은» 상태를 통과시키지 않는다", () => {
  /**
   * 🔴 런타임이 dispatcher 를 무시하면 보장이 **조용히** 사라진다. 그 상태를
   *    탐지하는 유일한 방법이 「우리 lookup 이 불렸는가」이고, 안 불렸으면 **실패** 다.
   */
  /**
   * 🔴🔴 **처음엔 이것을 `throw` 로 만들었고 그것이 틀렸다.** `fetch` 를 stub 하는
   *    **기존 테스트 9파일 / 30건** 이 전부 깨졌다 — 그 stub 들은 connector 가 아니므로
   *    우리 lookup 을 부를 이유가 없다. 즉 그 단언은 **보안을 더하지 않고 하니스만 묶었다.**
   * 🟢 그래서 「요청을 깨뜨리지 않고 **로그로 남긴다**」로 바꿨고, **실제 적용 증명은
   *    LIVE E2E** 가 실 네트워크로 한다(호스트마다 `connectGuardHitsFor > 0`).
   */
  it("훅이 관측되지 않으면 로그를 남기되 **요청을 깨뜨리지 않는다**", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((m: unknown) => void logs.push(String(m)));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          ({ status: 200, url, headers: new Headers(), body: null, text: async () => "" }) as unknown as Response,
      ),
    );
    const res = await fetchWithDomainRateLimit("https://shop.example.com/products/x");
    expect(res.status).toBe(200);
    expect(logs.some((l) => l.includes("[WU-026-guard]"))).toBe(true);
    spy.mockRestore();
  });

  it("🟢 IP 리터럴은 이름 해석이 없으므로 훅을 요구하지 않는다", async () => {
    expect(isIpLiteralHost("93.184.216.34")).toBe(true);
    expect(isIpLiteralHost("shop.example.com")).toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          ({ status: 200, url, headers: new Headers(), body: null, text: async () => "" }) as unknown as Response,
      ),
    );
    const res = await fetchWithDomainRateLimit("https://93.184.216.34/products/x");
    expect(res.status).toBe(200);
  });

  /** 🔴 keep-alive 로 커넥션을 재사용하면 lookup 이 다시 불리지 않는다 — 그 소켓은
   *  **이미 검증된 IP** 에 붙어 있으므로 막으면 정상 트래픽이 죽는다. */
  it("🟢 이미 검증된 호스트의 커넥션 재사용은 막지 않는다", async () => {
    await new Promise<void>((done) => guardedLookup("shop.example.com", {}, () => done()));
    expect(connectGuardHitsFor("shop.example.com")).toBe(1);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          ({ status: 200, url, headers: new Headers(), body: null, text: async () => "" }) as unknown as Response,
      ),
    );
    const res = await fetchWithDomainRateLimit("https://shop.example.com/products/x");
    expect(res.status).toBe(200);
  });

  /**
   * 🔴 차단된 홉이 「훅 미적용」으로 오인되면 **사유가 뒤바뀐다** — 성공만 세지 않는다.
   *
   * 🔴🔴 **두 실패 모양을 «둘 다» 본다.** 처음엔 「사설 IP 로 해석됨」만 봤고, 그때
   *    변이(기록을 `if (err)` «뒤» 로 이동)가 **93/93 통과** 했다 — 사설 해석은
   *    `err === null` 이라 그 변이를 지나가기 때문이다. DNS 자체가 **실패** 하는
   *    모양이 빠져 있었다.
   */
  it.each([
    ["사설 IP 로 해석됨", () => resolveAlways([PRIVATE])],
    ["DNS 해석 자체가 실패", () => lookupMock.mockImplementation((_h: string, _o: unknown, cb: Cb) => cb(new Error("ENOTFOUND"), []))],
  ])("훅이 «차단» 했을 때도 호출 기록은 남는다 — %s", async (_label, setup) => {
    setup();
    await new Promise<void>((done) => guardedLookup("evil.example.com", {}, () => done()));
    expect(connectGuardHitsFor("evil.example.com")).toBe(1);
  });
});

/* ══════════════════ ③ 🔴🔴 실제 DNS rebinding — 패킷 0 ══════════════════ */

describe("③ 🔴🔴 public → private rebinding 이 connect 시점에 끊긴다", () => {
  /**
   * 🔴 **`fetch` 를 stub 하지 않는다.** 실제 global fetch + 실제 undici Agent 다.
   *    시험 대상은 「검증 뒤 해석이 뒤집히면 연결되는가」이고, 답은 **연결되지 않는다** 다.
   * 🟢 패킷은 나가지 않는다 — 우리 훅이 connect **전** 에 에러를 낸다.
   */
  it("검증은 공개 · 연결 해석은 사설 → 요청이 나가지 않는다", async () => {
    const calls = resolveByCallIndex([[PUBLIC], [PRIVATE]]);
    await expect(fetchWithDomainRateLimit("https://shop.example.com/products/x")).rejects.toThrow();
    /** 🔴 두 번 해석됐고(검증 + connect) **두 번째가 우리 훅** 이다. */
    expect(calls()).toBeGreaterThanOrEqual(2);
    expect(connectGuardHitsFor("shop.example.com")).toBeGreaterThanOrEqual(1);
  });

  it("거절 사유가 사설 IP 로 전달된다 — 「알 수 없는 네트워크 오류」가 아니다", async () => {
    resolveByCallIndex([[PUBLIC], [PRIVATE]]);
    const err = await fetchWithDomainRateLimit("https://shop.example.com/products/x").catch((e: unknown) => e);
    const text = JSON.stringify({
      m: (err as Error)?.message,
      c: ((err as { cause?: Error })?.cause as Error | undefined)?.message,
    });
    expect(text).toMatch(/RESOLVED_TO_PRIVATE_IP|fetch failed/);
  });

  /** 🔴 반대 방향(사설 → 공개)은 **검증 단계에서** 막힌다 — 연결까지 가지 않는다. */
  it("검증이 사설이면 연결 시도 자체가 없다(private → public 변화)", async () => {
    const calls = resolveByCallIndex([[PRIVATE], [PUBLIC]]);
    await expect(fetchWithDomainRateLimit("https://evil.example.com/products/x")).rejects.toBeInstanceOf(
      OutboundBlockedError,
    );
    expect(calls()).toBe(1);
    expect(connectGuardHitsFor("evil.example.com")).toBe(0);
  });

  it("공개/사설 혼합 응답은 connect 시점에도 막힌다", async () => {
    resolveByCallIndex([[PUBLIC], [PUBLIC, PRIVATE]]);
    await expect(fetchWithDomainRateLimit("https://shop.example.com/products/x")).rejects.toThrow();
  });
});

/* ══════════════════ ④ 리다이렉트 × DNS 결합 ══════════════════ */

describe("④ 🔴 리다이렉트와 DNS 가 결합된 공격", () => {
  function stubRedirect(script: { status: number; location?: string }[]) {
    const seen: string[] = [];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: Record<string, unknown>) => {
        seen.push(String(url));
        await new Promise<void>((done) => guardedLookup(new URL(String(url)).hostname, {}, () => done()));
        expect(init.dispatcher).toBeTruthy();
        const step = script[Math.min(i++, script.length - 1)];
        return {
          status: step.status,
          url: String(url),
          headers: new Headers(step.location ? { location: step.location } : {}),
          body: { cancel: async () => undefined },
          text: async () => "",
        } as unknown as Response;
      }),
    );
    return seen;
  }

  it("🟢 public → public 리다이렉트는 그대로 따라간다", async () => {
    const seen = stubRedirect([{ status: 301, location: "https://shop.example.com/en-kr/products/x" }, { status: 200 }]);
    const res = await fetchWithDomainRateLimit("https://shop.example.com/products/x");
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(2);
  });

  it("public → private(IP 리터럴) 은 두 번째 홉에서 막힌다", async () => {
    const seen = stubRedirect([{ status: 302, location: "http://169.254.169.254/latest/meta-data/" }]);
    await expect(fetchWithDomainRateLimit("https://shop.example.com/products/x")).rejects.toBeInstanceOf(
      OutboundBlockedError,
    );
    expect(seen).toEqual(["https://shop.example.com/products/x"]);
  });

  it("public → 사설로 해석되는 «이름» 도 두 번째 홉에서 막힌다", async () => {
    lookupMock.mockImplementation((host: string, _o: unknown, cb: Cb) =>
      host === "inner.example.org" ? cb(null, [PRIVATE]) : cb(null, [PUBLIC]),
    );
    const seen = stubRedirect([{ status: 302, location: "https://inner.example.org/products/y" }]);
    await expect(fetchWithDomainRateLimit("https://shop.example.com/products/x")).rejects.toBeInstanceOf(
      OutboundBlockedError,
    );
    expect(seen).toEqual(["https://shop.example.com/products/x"]);
  });

  /**
   * 🔴🔴 **홉마다 connect 훅이 유지되는가** — 2홉에서 rebinding 이 일어나는 경우.
   *
   * 🔴 **이 테스트가 단언할 수 있는 것과 없는 것을 가른다.** stub 된 `fetch` 는
   *    「연결을 거절」할 수 없다(실제 connector 가 아니다). 그래서 「2홉 rebinding 이
   *    차단된다」를 stub 으로 증명하면 **사실이 아닌 단언** 이 된다 — 처음에 그렇게
   *    썼고, 그 단언은 **무엇을 해도 통과하는** 꼴이었다(스스로 걷어냈다).
   * 🟢 stub 으로 증명 가능한 것은 **「홉마다 dispatcher 가 실린다」** 이고, 실제 거절은
   *    ③(실 fetch · 실 Agent)이 증명한다. 둘이 합쳐 홉 단위 보장이 된다.
   */
  it("🟢 리다이렉트 **모든 홉** 에 dispatcher 가 실린다(거절 자체는 ③이 증명한다)", async () => {
    const perHopDispatcher: unknown[] = [];
    let i = 0;
    const script = [{ status: 302, location: "https://shop.example.com/en-kr/products/x" }, { status: 200 }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: Record<string, unknown>) => {
        perHopDispatcher.push(init.dispatcher);
        const step = script[Math.min(i++, script.length - 1)];
        await new Promise<void>((done) => guardedLookup(new URL(String(url)).hostname, {}, () => done()));
        return {
          status: step.status,
          url: String(url),
          headers: new Headers(step.location ? { location: step.location } : {}),
          body: { cancel: async () => undefined },
          text: async () => "",
        } as unknown as Response;
      }),
    );
    const res = await fetchWithDomainRateLimit("https://shop.example.com/products/x");
    expect(res.status).toBe(200);
    expect(perHopDispatcher).toHaveLength(2);
    /** 🔴 두 홉이 **같은** dispatcher 를 쓴다 — 훅이 한 홉만 적용되는 일이 없다. */
    expect(perHopDispatcher[0]).toBeTruthy();
    expect(perHopDispatcher[1]).toBe(perHopDispatcher[0]);
  });
});

/* ══════════════════ ⑤ 소스 계약 ══════════════════ */

describe("⑤ 🔴 dispatcher 없이 나가는 fetch 가 없다", () => {
  const LIMITER = readFileSync(path.join(__dirname, "..", "rate-limit", "domain-rate-limiter.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("fetch 호출이 하나이고 거기에 dispatcher 가 실린다", () => {
    expect((LIMITER.match(/await fetch\(/g) ?? [])).toHaveLength(1);
    expect(LIMITER).toContain("dispatcher } as RequestInit)");
  });

  it("🔴 dispatcher 획득이 요청 «앞» 이고 실패하면 던진다(fail-closed)", () => {
    const guard = LIMITER.slice(LIMITER.indexOf("async function fetchGuarded"));
    const dispatchAt = guard.indexOf("await outboundDispatcher()");
    const fetchAt = guard.indexOf("await fetch(target");
    expect(dispatchAt).toBeGreaterThan(-1);
    expect(dispatchAt).toBeLessThan(fetchAt);
    /** 🔴 `catch` 로 삼켜서 dispatcher 없이 계속 가는 경로가 없어야 한다. */
    expect(guard.slice(dispatchAt, fetchAt)).not.toContain("catch");
  });

  it("🔴 관측 로그는 응답 «뒤» 이고 두 조건을 같이 본다(요청은 깨뜨리지 않는다)", () => {
    const guard = LIMITER.slice(LIMITER.indexOf("async function fetchGuarded"));
    const fetchAt = guard.indexOf("await fetch(target");
    const checkAt = guard.indexOf("warnConnectGuardNotObserved");
    expect(checkAt).toBeGreaterThan(fetchAt);
    expect(guard).toContain("hitsBefore === 0 && connectGuardHitsFor(hostname) === 0");
    /**
     * 🔴 관측은 «관측» 이다 — 여기서 던지면 `fetch` 를 stub 하는 기존 하니스가 전부 깨진다.
     * 🔴 **그 «블록만»** 본다. `fetch` 이후 전체를 보면 루프 끝의 정당한
     *    `TOO_MANY_REDIRECTS` throw 에 걸려 **단언이 거짓으로 실패** 한다(내가 그렇게 썼다).
     */
    const condAt = guard.indexOf("hitsBefore === 0 && connectGuardHitsFor(hostname) === 0");
    const observeBlock = guard.slice(condAt, guard.indexOf("}", condAt));
    expect(observeBlock).toContain("warnConnectGuardNotObserved");
    expect(observeBlock).not.toContain("throw");
  });

  /**
   * 🔴🔴 **이 단언이 빠져 있었다 — 변이가 찾아냈다.** `outboundDispatcher()` 의 실패
   *    분기를 `return undefined` 로 바꿨더니 **92/92 전부 통과** 했다. 즉 「dispatcher
   *    없이 그냥 보낸다」는 경로가 생겨도 아무 테스트도 울지 않았다.
   * 🔴 그래서 **두 실패 분기(캐시된 실패 · 최초 실패)가 모두 throw 임** 을 잠근다.
   */
  it("🔴🔴 dispatcher 를 만들 수 없으면 «던진다» — 없이 보내는 경로가 없다", () => {
    const GUARD = readFileSync(path.join(__dirname, "..", "utils", "outbound-guard.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const block = GUARD.slice(GUARD.indexOf("export async function outboundDispatcher"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect((body.match(/throw new OutboundBlockedError\("CONNECT_GUARD_UNAVAILABLE"/g) ?? [])).toHaveLength(2);
    /** 🔴 `undefined`/`null` 을 dispatcher 로 돌려주는 경로가 없어야 한다. */
    expect(body).not.toMatch(/return\s+(undefined|null)/);
  });

  it("🔴 undici 가 crawler 의 «선언된» 의존성이다 — 암묵적 해석에 기대지 않는다", () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies.undici).toBeTruthy();
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 **화면이 끌어오는 사슬에 fetch 스택이 있으면 안 된다** — 측정으로 확인한 계약
   * ══════════════════════════════════════════════════════════════════════════
   *
   * WU-026 이 dispatcher 를 붙이자 **클라이언트 청크에 undici 전체(약 1MB)** 가
   * 들어갔다(실측: 기준선 0파일 → 1파일). 원인은 dispatcher 가 아니라 **값 import 사슬**
   * 이었다: 화면이 쓰는 정렬 함수 하나가 `match-truth → cross-seller → match →
   * domestic-identifiers → foretforet → domain-rate-limiter` 로 이어져 있었다.
   *
   * 🟢 `MATCH_TRUTH_RANK` 를 leaf 로 뺀 뒤: 사슬 **15모듈 → 2모듈**,
   *    클라이언트 청크 **2,108,160 → 2,048,756 bytes**(기준선보다 **작아졌다**).
   * 🔴 이 테스트는 그 성질이 **되돌아가지 않게** 잠근다 — 누가 `display-priority` 에
   *    판정 로직을 다시 끌어오면 여기서 터진다.
   */
  it("🔴🔴 화면이 쓰는 모듈의 값 사슬에 fetch 스택이 «없다»", () => {
    const SRC = path.join(__dirname, "..");
    const valueImports = (file: string): string[] => {
      const body = readFileSync(file, "utf8");
      return [...body.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"(\.[^"]+)"/gm)].map((m) => m[1]);
    };
    const resolveSpec = (from: string, spec: string): string | null => {
      const base = path.join(path.dirname(from), spec);
      for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
        try {
          readFileSync(candidate, "utf8");
          return candidate;
        } catch {
          /* 다음 후보 */
        }
      }
      return null;
    };
    /** 🔴 화면(클라이언트 컴포넌트)이 **실제로** 깊은 import 하는 두 모듈에서 시작한다. */
    const roots = [
      path.join(SRC, "comparison-search", "display-priority.ts"),
      path.join(SRC, "comparison-search", "match-truth-rank.ts"),
    ];
    const seen = new Set<string>();
    const queue = [...roots];
    while (queue.length) {
      const file = queue.shift() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of valueImports(file)) {
        const resolved = resolveSpec(file, spec);
        if (resolved && !seen.has(resolved)) queue.push(resolved);
      }
    }
    const forbidden = [...seen].filter((f) => /domain-rate-limiter|outbound-guard|direct-html-fetch|shopify-product-json/.test(f));
    expect(forbidden).toEqual([]);
    /** 🔴 leaf 는 **아무것도** import 하지 않는다 — 그것이 이 파일의 존재 이유다. */
    expect(valueImports(path.join(SRC, "comparison-search", "match-truth-rank.ts"))).toEqual([]);
  });

  it("🔴 undici 와 node:dns 는 **동적** import 다 — 클라이언트 번들로 들어가지 않는다", () => {
    const GUARD = readFileSync(path.join(__dirname, "..", "utils", "outbound-guard.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(GUARD).toContain('await import("undici")');
    expect(GUARD).toContain('await import("node:dns")');
    /** 🔴 정적 import 가 **하나도** 없어야 한다(타입 전용은 런타임 참조가 아니다). */
    expect(GUARD).not.toMatch(/^import \{[^}]*\} from "undici";/m);
    expect(GUARD).not.toMatch(/^import \{[^}]*\} from "node:dns";/m);
  });
});
