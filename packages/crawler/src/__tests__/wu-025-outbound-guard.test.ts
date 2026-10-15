import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-025 — **SSRF 경계 공격 변형 음성대조**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **「테스트가 통과했다」를 증거로 쓰지 않는다.** 이 파일은 **공격 변형을
 *    실제로 먹여서** 막히는지 본다 — 주소 표기 12종 · 리다이렉트 · DNS 해석 ·
 *    해석 실패(fail-closed) · 포트 · scheme.
 *
 * 🔴 **네트워크를 쓰지 않는다.** DNS 와 `fetch` 는 모듈 모킹으로 대체하고, 검사 대상은
 *    **운영 함수 그대로** 다(`classifyOutboundUrl` · `assertPublicOutboundTarget` ·
 *    `guardedLookup` · `fetchWithDomainRateLimit`).
 *
 * 🔴 왜 로컬 서버를 띄워 리다이렉트를 재현하지 않는가 — **로컬 서버 자체가 사설이라
 *    첫 홉에서 막힌다.** 그래서 리다이렉트는 `fetch` 를 stub 해서 **우리 루프** 를
 *    직접 시험한다(시험 대상은 undici 가 아니라 우리 코드다).
 */

const lookupMock = vi.fn();
vi.mock("node:dns", () => ({
  lookup: (...args: unknown[]) => (lookupMock as (...a: unknown[]) => void)(...args),
}));

const {
  assertPublicOutboundTarget,
  classifyOutboundUrl,
  guardedLookup,
  isPublicIpv4,
  isPublicIpv6,
  OutboundBlockedError,
} = await import("../utils/outbound-guard");
const { fetchWithDomainRateLimit } = await import("../rate-limit/domain-rate-limiter");

/** 🟢 공개 IP 로 해석되는 «정상» DNS 응답. */
function resolvePublic(address = "93.184.216.34", family = 4) {
  lookupMock.mockImplementation((_host: string, _opts: unknown, cb: (e: unknown, a: unknown) => void) =>
    cb(null, [{ address, family }]),
  );
}
function resolveTo(addresses: { address: string; family: number }[]) {
  lookupMock.mockImplementation((_host: string, _opts: unknown, cb: (e: unknown, a: unknown) => void) =>
    cb(null, addresses),
  );
}
function resolveFails() {
  lookupMock.mockImplementation((_host: string, _opts: unknown, cb: (e: unknown, a: unknown) => void) =>
    cb(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }), []),
  );
}

beforeEach(() => {
  lookupMock.mockReset();
  resolvePublic();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/* ══════════════════ ① 문자열 층 — 주소 표기 공격 변형 ══════════════════ */

describe("① 🔴 문자열 층 — 내부 목적지 표기를 전부 거절한다", () => {
  it.each([
    ["http://localhost/products/x", "NON_PUBLIC_HOST_SHAPE", "점 없는 이름"],
    ["http://LOCALHOST/products/x", "NON_PUBLIC_HOST_SHAPE", "대문자"],
    ["http://foo.localhost/products/x", "NON_PUBLIC_HOST_SHAPE", "localhost 서브도메인"],
    ["http://svc.internal/products/x", "NON_PUBLIC_HOST_SHAPE", "내부 TLD"],
    ["http://db.local/products/x", "NON_PUBLIC_HOST_SHAPE", "mDNS"],
    ["http://box.lan/products/x", "NON_PUBLIC_HOST_SHAPE", "내부 TLD"],
    ["http://a.test/products/x", "NON_PUBLIC_HOST_SHAPE", "예약 TLD"],
    ["http://127.0.0.1/products/x", "NON_PUBLIC_HOST_SHAPE", "루프백"],
    ["http://127.1/products/x", "NON_PUBLIC_HOST_SHAPE", "축약 IPv4"],
    ["http://10.0.0.1/products/x", "NON_PUBLIC_HOST_SHAPE", "RFC1918"],
    ["http://172.16.0.1/products/x", "NON_PUBLIC_HOST_SHAPE", "RFC1918"],
    ["http://172.31.255.254/products/x", "NON_PUBLIC_HOST_SHAPE", "RFC1918 경계"],
    ["http://192.168.1.1/products/x", "NON_PUBLIC_HOST_SHAPE", "RFC1918"],
    ["http://169.254.169.254/products/x", "NON_PUBLIC_HOST_SHAPE", "링크로컬 = 클라우드 메타데이터"],
    ["http://169.254.169.254/latest/meta-data/products/x", "NON_PUBLIC_HOST_SHAPE", "IMDS 경로"],
    ["http://0.0.0.0/products/x", "NON_PUBLIC_HOST_SHAPE", "this-network"],
    ["http://100.64.0.1/products/x", "NON_PUBLIC_HOST_SHAPE", "CGNAT"],
    ["http://198.18.0.1/products/x", "NON_PUBLIC_HOST_SHAPE", "벤치마크"],
    ["http://239.255.255.250/products/x", "NON_PUBLIC_HOST_SHAPE", "멀티캐스트(SSDP)"],
    ["http://255.255.255.255/products/x", "NON_PUBLIC_HOST_SHAPE", "브로드캐스트"],
    ["http://2130706433/products/x", "NON_PUBLIC_HOST_SHAPE", "10진 IPv4"],
    ["http://017700000001/products/x", "NON_PUBLIC_HOST_SHAPE", "8진 IPv4"],
    ["http://0x7f000001/products/x", "NON_PUBLIC_HOST_SHAPE", "16진 IPv4"],
    ["http://0x7f.0.0.1/products/x", "NON_PUBLIC_HOST_SHAPE", "혼합 16진"],
    ["http://[::1]/products/x", "NON_PUBLIC_HOST_SHAPE", "IPv6 루프백"],
    ["http://[::]/products/x", "NON_PUBLIC_HOST_SHAPE", "IPv6 unspecified"],
    ["http://[fc00::1]/products/x", "NON_PUBLIC_HOST_SHAPE", "IPv6 ULA"],
    ["http://[fd12:3456::1]/products/x", "NON_PUBLIC_HOST_SHAPE", "IPv6 ULA"],
    ["http://[fe80::1]/products/x", "NON_PUBLIC_HOST_SHAPE", "IPv6 링크로컬"],
    ["http://[ff02::1]/products/x", "NON_PUBLIC_HOST_SHAPE", "IPv6 멀티캐스트"],
    ["http://[::ffff:127.0.0.1]/products/x", "NON_PUBLIC_HOST_SHAPE", "IPv4-mapped 우회"],
    ["http://[64:ff9b::7f00:1]/products/x", "NON_PUBLIC_HOST_SHAPE", "NAT64 우회"],
    ["https://example.com:8080/products/x", "NON_DEFAULT_PORT", "내부 포트 탐색"],
    ["https://example.com:22/products/x", "NON_DEFAULT_PORT", "SSH 포트"],
    ["file:///etc/passwd", "UNSUPPORTED_SCHEME", "scheme 우회"],
    ["gopher://example.com/products/x", "UNSUPPORTED_SCHEME", "scheme 우회"],
    ["ftp://example.com/products/x", "UNSUPPORTED_SCHEME", "scheme 우회"],
    ["data:text/html,<b>x</b>", "UNSUPPORTED_SCHEME", "data URI"],
    ["//example.com/products/x", "INVALID_URL", "scheme 없음"],
    /** 🔴 실측: Node 는 `http:///products/x` 의 host 를 **`"products"` 로 읽는다**
     *  (슬래시 셋을 빈 host 로 보지 않는다). 점이 없으므로 모양 층에서 막힌다 —
     *  「막힌다」는 같지만 **이유가 다르다**. 추측한 이유를 적지 않는다. */
    ["http:///products/x", "NON_PUBLIC_HOST_SHAPE", "host 가 점 없는 이름으로 읽힌다"],
  ])("%s → %s (%s)", (url, reason) => {
    const verdict = classifyOutboundUrl(url);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe(reason);
  });

  /**
   * 🟢🟢 **파서가 정규화하는 것을 손으로 다시 해석하지 않는다** — 실측으로 확정했다.
   *    `0x7f000001`·`2130706433`·`017700000001`·`0x7f.0.0.1`·`127.1` 는 **전부**
   *    `new URL()` 단계에서 `127.0.0.1` 이 되어 위 IPv4 규칙에 걸린다(위 표가 그것을 센다).
   * 🔴 반대로 `010.0.0.1` 은 `8.0.0.1` 로 정규화되고 그것은 **진짜 공개 주소** 다 —
   *    「선행 0 이니 수상하다」로 막으면 **정상 목적지를 막는 것** 이다.
   */
  it("🟢 파서 정규화 결과를 그대로 판단한다 — 010.0.0.1 은 8.0.0.1(공개)이다", () => {
    expect(new URL("http://010.0.0.1/").hostname).toBe("8.0.0.1");
    expect(classifyOutboundUrl("http://010.0.0.1/products/x").ok).toBe(true);
    expect(new URL("http://0177.0.0.1/").hostname).toBe("127.0.0.1");
    expect(classifyOutboundUrl("http://0177.0.0.1/products/x").ok).toBe(false);
  });

  /** 🟢 **정상 상품 URL 은 반드시 통과한다** — 이 줄이 깨지면 제품이 죽는다. */
  it.each([
    "https://biskuit.kr/product/bobo-b226ac009/8891/category/367/display/1/",
    "https://m.luxboy.com/product/A14338197CB8698CD92C86431CCE8D05",
    "https://m.web.mustit.co.kr/v2/m/product/product_detail/127093801?from_keyword=x",
    "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
    "https://www.donokids.com/shop/shopdetail.html?branduid=3362908",
    "https://bobochoses.com/en-kr/products/b226ac117-b-c-embossed-tracksuit-jacket",
    "https://www.junioredition.com/en-kr/products/x?_pos=1&_sid=a&_ss=r",
    "https://item.rakuten.co.jp/victoriagolf/108781680014/",
    "https://kidikidi.elandmall.co.kr/products/x",
    "https://example.co.uk/products/x",
    "http://xn--h32bi4v.xn--3e0b707e/products/x",
  ])("🟢 %s 는 통과한다", (url) => {
    expect(classifyOutboundUrl(url).ok).toBe(true);
  });

  it("IP 분류 단위 — 공개/사설 경계", () => {
    expect(isPublicIpv4("93.184.216.34")).toBe(true);
    expect(isPublicIpv4("172.15.0.1")).toBe(true); // RFC1918 «바깥»
    expect(isPublicIpv4("172.32.0.1")).toBe(true); // RFC1918 «바깥»
    expect(isPublicIpv4("172.16.0.1")).toBe(false);
    expect(isPublicIpv4("172.31.0.1")).toBe(false);
    expect(isPublicIpv4("256.1.1.1")).toBe(false);
    expect(isPublicIpv6("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
    expect(isPublicIpv6("::1")).toBe(false);
  });
});

/* ══════════════════ ② 이름 해석 층 — hostname → 사설 IP ══════════════════ */

describe("② 🔴🔴 정상 DNS 이름이 사설 IP 로 해석되면 막는다", () => {
  it("단일 사설 A 레코드 → RESOLVED_TO_PRIVATE_IP", async () => {
    resolveTo([{ address: "127.0.0.1", family: 4 }]);
    const v = await assertPublicOutboundTarget("https://evil.example.com/products/x");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("RESOLVED_TO_PRIVATE_IP");
  });

  /** 🔴 공개/사설을 **섞는** round-robin 수법 — 하나라도 사설이면 막는다. */
  it("공개+사설 혼합 응답 → 막는다", async () => {
    resolveTo([
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ]);
    const v = await assertPublicOutboundTarget("https://evil.example.com/products/x");
    expect(v.ok).toBe(false);
  });

  it("IPv6 사설 응답 → 막는다", async () => {
    resolveTo([{ address: "fd00::1", family: 6 }]);
    expect((await assertPublicOutboundTarget("https://evil.example.com/products/x")).ok).toBe(false);
  });

  /** 🔴🔴 **fail-closed** — 판단할 수 없으면 막는다. 「모르면 통과」를 만들지 않는다. */
  it("DNS 해석 실패 → DNS_UNRESOLVED 로 막는다(열어 주지 않는다)", async () => {
    resolveFails();
    const v = await assertPublicOutboundTarget("https://nope.example.com/products/x");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("DNS_UNRESOLVED");
  });

  it("빈 응답도 막는다", async () => {
    resolveTo([]);
    expect((await assertPublicOutboundTarget("https://nope.example.com/products/x")).ok).toBe(false);
  });

  it("🟢 공개로 해석되면 통과하고 주소를 보고한다", async () => {
    resolveTo([{ address: "93.184.216.34", family: 4 }]);
    const v = await assertPublicOutboundTarget("https://biskuit.kr/product/x");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.addresses).toEqual(["93.184.216.34"]);
  });

  it("🟢 IP 리터럴은 DNS 를 쓰지 않는다 — 불필요한 조회 0", async () => {
    lookupMock.mockReset();
    await assertPublicOutboundTarget("https://93.184.216.34/products/x");
    expect(lookupMock).not.toHaveBeenCalled();
  });
});

/* ══════════════════ ③ 연결 시점 층 — guardedLookup ══════════════════ */

describe("③ 🔴 connect 시점 훅 — 검사한 IP 로만 연결된다", () => {
  const call = (host: string, options: { all?: boolean } = {}) =>
    new Promise<{ err: NodeJS.ErrnoException | null; address: unknown }>((resolve) => {
      guardedLookup(host, options, (err, address) => resolve({ err, address }));
    });

  it("사설로 해석되면 EACCES 로 끊는다 — 소켓이 열리지 않는다", async () => {
    resolveTo([{ address: "10.1.2.3", family: 4 }]);
    const { err } = await call("evil.example.com");
    expect(err?.code).toBe("EACCES");
  });

  it("해석 실패는 그대로 전달한다", async () => {
    resolveFails();
    const { err } = await call("nope.example.com");
    expect(err?.code).toBe("ENOTFOUND");
  });

  it("빈 응답은 ENOTFOUND 로 막는다", async () => {
    resolveTo([]);
    const { err } = await call("nope.example.com");
    expect(err?.code).toBe("ENOTFOUND");
  });

  /** 🔴 호출부가 요구한 «모양» 을 바꾸지 않는다 — 바꾸면 node:http 가 깨진다. */
  it("🟢 공개면 통과하고 all 여부에 맞는 모양을 돌려준다", async () => {
    resolveTo([{ address: "93.184.216.34", family: 4 }]);
    const one = await call("example.com");
    expect(one.err).toBeNull();
    expect(one.address).toBe("93.184.216.34");
    const all = await call("example.com", { all: true });
    expect(all.address).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
});

/* ══════════════════ ④ 🔴🔴 리다이렉트 → 사설 목적지 ══════════════════ */

describe("④ 🔴🔴 리다이렉트로 내부망에 닿지 않는다", () => {
  /** 🔴 stub 하는 것은 **네트워크** 뿐이다. 시험 대상은 운영 함수의 추적 루프다. */
  function stubFetch(script: { status: number; location?: string }[]) {
    const seen: string[] = [];
    let i = 0;
    const bodyCancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        seen.push(String(url));
        /** 🔴 우리 루프가 **반드시** manual 로 요청해야 한다 — follow 면 undici 가 몰래 따라간다. */
        expect(init?.redirect).toBe("manual");
        const step = script[Math.min(i++, script.length - 1)];
        return {
          status: step.status,
          url: String(url),
          headers: new Headers(step.location ? { location: step.location } : {}),
          body: { cancel: bodyCancel },
          text: async () => "",
        } as unknown as Response;
      }),
    );
    return { seen, bodyCancel };
  }

  it("공개 → 302 → 링크로컬(IMDS)은 **두 번째 홉에서** 막힌다", async () => {
    const { seen } = stubFetch([{ status: 302, location: "http://169.254.169.254/latest/meta-data/" }]);
    resolvePublic();
    await expect(fetchWithDomainRateLimit("https://evil.example.com/products/x")).rejects.toBeInstanceOf(
      OutboundBlockedError,
    );
    /** 🔴 사설 목적지로는 요청이 **나가지 않았다**. */
    expect(seen).toEqual(["https://evil.example.com/products/x"]);
  });

  it("공개 → 302 → 정상 DNS 이름인데 사설로 해석되면 막힌다", async () => {
    const { seen } = stubFetch([{ status: 302, location: "https://inner.example.org/x" }]);
    lookupMock.mockImplementation((host: string, _o: unknown, cb: (e: unknown, a: unknown) => void) =>
      host === "inner.example.org"
        ? cb(null, [{ address: "192.168.0.9", family: 4 }])
        : cb(null, [{ address: "93.184.216.34", family: 4 }]),
    );
    await expect(fetchWithDomainRateLimit("https://shop.example.com/products/x")).rejects.toBeInstanceOf(
      OutboundBlockedError,
    );
    expect(seen).toEqual(["https://shop.example.com/products/x"]);
  });

  it("🟢 공개 → 공개 리다이렉트는 **그대로 따라간다**(정상 동작 보존)", async () => {
    const { seen, bodyCancel } = stubFetch([
      { status: 301, location: "https://shop.example.com/en-kr/products/x" },
      { status: 200 },
    ]);
    resolvePublic();
    const res = await fetchWithDomainRateLimit("https://shop.example.com/products/x");
    expect(res.status).toBe(200);
    expect(res.url).toBe("https://shop.example.com/en-kr/products/x");
    expect(seen).toEqual([
      "https://shop.example.com/products/x",
      "https://shop.example.com/en-kr/products/x",
    ]);
    /** 🔴 3xx 본문을 놓아 줘야 커넥션이 묶이지 않는다. */
    expect(bodyCancel).toHaveBeenCalled();
  });

  it("무한 리다이렉트는 상한에서 끊는다", async () => {
    stubFetch([{ status: 302, location: "https://shop.example.com/loop" }]);
    resolvePublic();
    await expect(fetchWithDomainRateLimit("https://shop.example.com/products/x")).rejects.toMatchObject({
      reason: "TOO_MANY_REDIRECTS",
    });
  });

  it("Location 이 없는 3xx 는 그 응답을 그대로 돌려준다(추측하지 않는다)", async () => {
    stubFetch([{ status: 304 }]);
    resolvePublic();
    const res = await fetchWithDomainRateLimit("https://shop.example.com/products/x");
    expect(res.status).toBe(304);
  });
});

/* ══════════════════ ⑤ 소스 계약 — 우회 경로가 남지 않았다 ══════════════════ */

describe("⑤ 🔴 검사 없는 outbound 경로가 남아 있지 않다", () => {
  const strip = (p: string) =>
    readFileSync(path.join(__dirname, "..", p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  const LIMITER = strip("rate-limit/domain-rate-limiter.ts");
  const DIRECT = strip("utils/direct-html-fetch.ts");

  it("rate limiter 의 모든 fetch 가 **가드 루프를 통해서만** 나간다", () => {
    /** 🔴 가드 루프 안의 1회를 뺀 나머지 `fetch(` 직접 호출이 **없어야** 한다. */
    const raw = LIMITER.match(/await fetch\(/g) ?? [];
    expect(raw).toHaveLength(1);
    const guardLoop = LIMITER.slice(LIMITER.indexOf("async function fetchGuarded"));
    expect(guardLoop).toContain("await fetch(target, { ...init, redirect: \"manual\" })");
    /** 🔴 요청 «전» 에 검사한다 — 뒤면 이미 나간 뒤다. */
    const assertAt = guardLoop.indexOf("assertPublicOutboundTarget(target)");
    const fetchAt = guardLoop.indexOf("await fetch(target");
    expect(assertAt).toBeGreaterThan(-1);
    expect(assertAt).toBeLessThan(fetchAt);
    /** 🔴 호출부는 가드 함수만 쓴다. */
    expect((LIMITER.match(/fetchGuarded\(url, init\)/g) ?? []).length).toBe(2);
  });

  it("node:https 스택이 guardedLookup 을 꽂는다", () => {
    expect(DIRECT).toContain("lookup: guardedLookup");
    /** 🔴 문자열 층도 통과해야 한다 — 리다이렉트 각 홉이 이 함수를 다시 탄다. */
    expect(DIRECT).toContain("if (!classifyOutboundUrl(url).ok) return null;");
  });

  it("🔴 사설 IP 판별 규칙의 소유자가 «하나» 다 — 사본이 없다", () => {
    /** 🔴🔴 **주석을 벗기고 본다.** 처음엔 날것으로 grep 해서 **설명 주석의
     *  `169.254.169.254` 에 내가 걸렸다** — 헌장 §5 가 「여덟 번 걸린 함정」이라고
     *  적어 둔 바로 그것이다(아홉 번째). */
    const pool = readFileSync(
      path.join(__dirname, "..", "..", "..", "..", "apps", "admin", "src", "app", "api", "price-history", "_lib", "url-candidate-pool.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    /** 🟢 admin 쪽은 호출만 한다 — 자기 IP 표를 들고 있지 않다. */
    expect(pool).toContain("return classifyOutboundUrl(raw).ok;");
    expect(pool).not.toMatch(/169\.254|127\.0\.0\.1|RFC1918|fc00|fe80|0x7f/);
  });
});
