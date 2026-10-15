import type { LookupAddress, LookupOptions } from "node:dns";

/**
 * 🔴🔴 **`node:dns` 를 «동적으로» 불러온다 — 정적 import 로 쓰면 `next build` 가 깨진다.**
 *
 * 실측(WU-025): 이 모듈은 `domain-rate-limiter` → `universal-extractor` → … 를 통해
 * **클라이언트 번들 그래프에 닿는다**(기존 구조 · 이 WU 가 만든 것이 아니다). 그리고
 * `node:https`/`node:http` 와 달리 **`node:dns` 에는 브라우저 shim 이 없다**:
 * ```
 * the chunking context (unknown) does not support external modules (request: node:dns)
 * ```
 * 🔴 이 저장소에 **같은 계열의 선례가 이미 적혀 있다** — `DomesticPriceIntelligencePanel`
 *    머리 주석(P-9-A): 「루트 배럴로 import 하면 Node 전용 모듈(tls/fs)이 브라우저
 *    번들에 끌려 들어와 next build 가 깨진다」. `dns` 는 `tls`·`fs` 와 같은 쪽이다.
 *
 * 🟢 **동적 import 는 그 chunk 참조를 만들지 않는다 — 측정으로 확인했다**(정적 → 실패,
 *    동적 → `node:dns` 에러 0). 🔴 그래서 「서버 전용 파일로 옮기면 된다」가 **해법이
 *    아니다**: 깨뜨린 자리는 서버 전용 파일(`domain-rate-limiter`)이었다.
 * 🔴 모듈 핸들은 한 번만 받고 캐시한다 — 요청마다 `import()` 를 되풀이하지 않는다.
 */
type DnsLookup = typeof import("node:dns").lookup;
let cachedLookup: DnsLookup | null = null;
async function nodeDnsLookup(): Promise<DnsLookup> {
  if (!cachedLookup) cachedLookup = (await import("node:dns")).lookup;
  return cachedLookup;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-025 — **outbound 목적지 경계** (SSRF)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 이 파일이 생겼나.** WU-024 가 「셀러가 준 URL」을 입력으로 받는 경로를
 *    열었다. 그 순간 **사용자 문자열이 우리 서버의 outbound HTTP 목적지가 된다.**
 *    기존 입력 경계(`classifyUrlShape` · `extractCandidateUrlsFromAiAnswer`)는
 *    **URL 의 «모양»** 만 본다 — `http://169.254.169.254/products/x` 는 경로에
 *    `/products/` 가 있으므로 `PRODUCT_PAGE` 로 분류된다.
 *
 * 🔴🔴 **문자열 차단만으로는 닫히지 않는다.** 그래서 이 파일은 **세 층** 이다:
 * ```
 * ① 문자열          scheme · 포트 · host 모양(숫자/비표준 표기/내부 TLD)   — 순수
 * ② 이름 해석        host → **실제 IP 전부** 가 공개 대역인가               — DNS
 * ③ 연결 시점        node:http(s) 의 `lookup` 훅 — 리다이렉트 **각 홉** 이
 *                   같은 검사를 통과해야 연결된다                          — connect
 * ```
 * 🔴 ①만 있으면 `127.0.0.1.nip.io`(정상 DNS 이름 · 루프백으로 해석)가 통과한다.
 *    ②가 그것을 잡는다. 🔴 ②만 있으면 **리다이렉트** 가 통과한다(`evil.com` →
 *    302 → `http://10.0.0.5/`). ③과 호출부의 홉별 검사가 그것을 잡는다.
 *
 * ── 🔴 닫지 못하는 것을 숨기지 않는다 ───────────────────────────────────────
 *    **DNS rebinding(TOCTOU)** — ②의 검사와 실제 connect 사이에 DNS 응답이 바뀌면
 *    `fetch` 경로는 다른 IP 로 연결될 수 있다. ③의 `lookup` 훅은 `node:http(s)`
 *    경로에만 꽂을 수 있고, `fetch`(undici)에 같은 훅을 꽂으려면 `dispatcher` 가
 *    필요하다(= `undici` 를 이 패키지의 의존성으로 올리는 일).
 *    🟢 **그 기전이 동작한다는 것은 실측했다**(WU-025 probe: 외부 undici `Agent` 를
 *       global `fetch` 의 `dispatcher` 로 넘기면 `connect.lookup` 이 호출되고,
 *       그 훅이 에러를 내면 요청이 **나가지 않는다**).
 *    🔴 이번에는 **채택하지 않았다** — 패키지 의존성 추가는 이 WU 의 범위를 넘고,
 *       리다이렉트/재바인딩 중 **리다이렉트가 실제 공격면이고 재바인딩은 창이 좁다.**
 *       🔴 그래서 이 한계를 보고서에 적고 CPO 판정으로 남긴다.
 *
 * 🔴 **차단은 fail-closed 다** — 판단할 수 없으면(DNS 실패 등) **막는다.** 열어
 *    두면 「모르면 통과」가 되고, 그것이 이 경계의 존재 이유를 지운다.
 */

/** 🔴 막힌 이유. **어휘를 뭉치지 않는다** — 「사설 IP」와 「포트」와 「DNS 실패」는 다른 사실이다. */
export type OutboundBlockReason =
  | "INVALID_URL"
  | "UNSUPPORTED_SCHEME"
  | "NON_DEFAULT_PORT"
  | "NON_PUBLIC_HOST_SHAPE"
  | "RESOLVED_TO_PRIVATE_IP"
  | "DNS_UNRESOLVED"
  | "TOO_MANY_REDIRECTS"
  /**
   * 🔴🔴 WU-026 — connect 시점 훅을 **붙일 수 없다**(undici dispatcher 사용 불가).
   *
   * 🔴 이것이 **유일한 fail-closed 사유** 다 — 우리가 «행동할 수 있는» 자리이기 때문이다.
   * 🔴 반대로 「dispatcher 를 넘겼는데 런타임이 무시했다」는 **환경 사실** 이라 코드가
   *    고칠 수 없다. 그래서 그쪽은 어휘를 만들지 않고 **로그 한 줄**(`[WU-026-guard]`)로
   *    남기고, **적용된다는 증명은 LIVE E2E** 가 실 네트워크로 한다.
   *    처음엔 그것도 `throw` 로 썼는데, `fetch` 를 stub 하는 **기존 테스트 9파일/30건** 이
   *    전부 깨졌다 — 보안을 더하지 않고 하니스만 묶는 단언이었다(걷어냈다).
   */
  | "CONNECT_GUARD_UNAVAILABLE";

export class OutboundBlockedError extends Error {
  constructor(
    readonly reason: OutboundBlockReason,
    readonly target: string,
  ) {
    /** 🔴 응답 본문이나 헤더를 메시지에 담지 않는다 — 비밀값이 로그로 새지 않게. */
    super(`outbound blocked (${reason})`);
    this.name = "OutboundBlockedError";
  }
}

/** 🔴 리다이렉트 상한. 기존 `fetchHtmlDirect` 의 `MAX_REDIRECTS`(3)보다 넉넉하되 유한하다. */
export const MAX_GUARDED_REDIRECTS = 5;

/* ─────────────────────────── ① 문자열 층 (순수) ─────────────────────────── */

/**
 * 🔴 **host 모양을 allowlist 로 본다.** 허용하는 것은 둘뿐이다 — **점을 가진 DNS
 *    이름** 또는 **점 4개 IPv4**.
 *
 * 🟢🟢 **비표준 IP 표기는 «파서» 가 이미 정규화한다 — 실측했다**(WU-025):
 * ```
 * new URL("http://0x7f000001/")   → hostname "127.0.0.1"
 * new URL("http://2130706433/")   → hostname "127.0.0.1"
 * new URL("http://017700000001/") → hostname "127.0.0.1"
 * new URL("http://0x7f.0.0.1/")   → hostname "127.0.0.1"
 * new URL("http://127.1/")        → hostname "127.0.0.1"
 * new URL("http://010.0.0.1/")    → hostname "8.0.0.1"   ← 🔴 이것은 **진짜 공개 주소** 다
 * ```
 * 🔴 그래서 이 층은 16진/8진/10진 표기를 **스스로 해석하지 않는다** — 그것을 손으로
 *    다시 구현하면 파서와 **두 해석** 이 생기고, 갈라지는 쪽이 구멍이 된다.
 *    아래 IPv4 규칙이 **정규화된 결과** 를 보는 것으로 충분하다(실측이 그것을 보인다).
 *
 * 🔴 TLD 에 **punycode(`xn--`)를 허용** 한다. 처음엔 `[a-z]{2,63}` 로만 썼고 그것이
 *    `xn--3e0b707e`(.한국) 같은 **정상 국가 TLD 를 막았다** — 이 파일의 negative test
 *    목록에 정상 URL 을 같이 넣어 둔 덕에 잡혔다(막는 것만 세면 못 본다).
 */
const DNS_NAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
/** 🔴 공개 인터넷에 없는 TLD/이름. `.local`·`.internal` 은 내부 해석용이다. */
const INTERNAL_SUFFIX_RE = /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|corp|arpa|test|invalid|example)$/;

/** IPv4 리터럴이 **공개 대역** 인가. 🔴 모르는 모양은 공개로 보지 않는다. */
export function isPublicIpv4(host: string): boolean {
  const m = IPV4_RE.exec(host);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => !Number.isInteger(n) || n > 255)) return false;
  /** 🔴 선행 0 은 8진수 해석 여지를 만든다 — 그 모양 자체를 거절한다. */
  if (m.slice(1).some((p) => p.length > 1 && p.startsWith("0"))) return false;
  const [a, b, c] = o;
  if (a === 0) return false; // this-network
  if (a === 10) return false; // RFC1918
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local(클라우드 메타데이터)
  if (a === 172 && b >= 16 && b <= 31) return false; // RFC1918
  if (a === 192 && b === 168) return false; // RFC1918
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF protocol / 문서용
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return false; // 벤치마크
  if (a === 198 && b === 51 && c === 100) return false; // 문서용
  if (a === 203 && b === 0 && c === 113) return false; // 문서용
  if (a >= 224) return false; // multicast · reserved · broadcast
  return true;
}

/** IPv6 리터럴이 **공개 대역** 인가. 🔴 IPv4-mapped 는 v4 규칙으로 되돌려 본다. */
export function isPublicIpv6(raw: string): boolean {
  const h = raw.replace(/^\[|\]$/g, "").toLowerCase().split("%")[0];
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return false;
  /** 🔴 `::ffff:127.0.0.1` 로 v4 규칙을 우회하는 고전적 수법. */
  const mapped = /^::ffff:(?:0:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped) return isPublicIpv4(mapped[1]);
  if (/^::ffff:/.test(h)) return false;
  if (/^f[cd]/.test(h)) return false; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(h)) return false; // fe80::/10 link-local
  if (/^ff/.test(h)) return false; // ff00::/8 multicast
  if (/^2001:0?db8/.test(h)) return false; // 문서용
  if (/^64:ff9b/.test(h)) return false; // NAT64
  return true;
}

export function isPublicIpAddress(address: string): boolean {
  return address.includes(":") ? isPublicIpv6(address) : isPublicIpv4(address);
}

export type OutboundShapeVerdict = { ok: true; url: URL } | { ok: false; reason: OutboundBlockReason };

/**
 * ① 문자열 층 — **순수 함수 · DNS 0 · HTTP 0.**
 *
 * 🔴 기본 포트만 허용한다. `:8080` 류는 상품 페이지가 아니고 **내부 포트 탐색** 통로다.
 */
export function classifyOutboundUrl(raw: string): OutboundShapeVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "UNSUPPORTED_SCHEME" };
  }
  if (url.port !== "") return { ok: false, reason: "NON_DEFAULT_PORT" };

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, reason: "NON_PUBLIC_HOST_SHAPE" };
  if (host.startsWith("[")) {
    return isPublicIpv6(host) ? { ok: true, url } : { ok: false, reason: "NON_PUBLIC_HOST_SHAPE" };
  }
  if (IPV4_RE.test(host)) {
    return isPublicIpv4(host) ? { ok: true, url } : { ok: false, reason: "NON_PUBLIC_HOST_SHAPE" };
  }
  /** 🔴 DNS 이름 모양이 아니면(숫자만·16진수·점 없음) **전부 거절** 이다. */
  if (!DNS_NAME_RE.test(host)) return { ok: false, reason: "NON_PUBLIC_HOST_SHAPE" };
  if (INTERNAL_SUFFIX_RE.test(host)) return { ok: false, reason: "NON_PUBLIC_HOST_SHAPE" };
  return { ok: true, url };
}

/* ─────────────────────── ② 이름 해석 층 (DNS · fail-closed) ─────────────────────── */

async function resolveAll(hostname: string): Promise<string[]> {
  const lookup = await nodeDnsLookup();
  return new Promise((resolve, reject) => {
    lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses.map((a) => a.address));
    });
  });
}

export type OutboundTargetVerdict =
  | { ok: true; url: URL; addresses: string[] }
  | { ok: false; reason: OutboundBlockReason };

/**
 * ①+② — 문자열 검사 뒤 **실제로 해석되는 IP 전부** 를 확인한다.
 *
 * 🔴 **하나라도** 사설이면 막는다(DNS round-robin 으로 공개/사설을 섞는 수법).
 * 🔴 **해석 실패도 막는다**(fail-closed). 「모르면 통과」를 만들지 않는다.
 * 🟢 IP 리터럴은 ①에서 이미 끝났으므로 DNS 를 쓰지 않는다 — 불필요한 조회 0.
 */
export async function assertPublicOutboundTarget(raw: string): Promise<OutboundTargetVerdict> {
  const shape = classifyOutboundUrl(raw);
  if (!shape.ok) return shape;
  const host = shape.url.hostname.toLowerCase().replace(/\.$/, "");
  if (IPV4_RE.test(host) || host.startsWith("[")) return { ok: true, url: shape.url, addresses: [host] };

  let addresses: string[];
  try {
    addresses = await resolveAll(host);
  } catch {
    return { ok: false, reason: "DNS_UNRESOLVED" };
  }
  if (addresses.length === 0) return { ok: false, reason: "DNS_UNRESOLVED" };
  if (!addresses.every(isPublicIpAddress)) return { ok: false, reason: "RESOLVED_TO_PRIVATE_IP" };
  return { ok: true, url: shape.url, addresses };
}

/* ─────────────────── ③ 연결 시점 층 (node:http(s) `lookup` 훅) ─────────────────── */

/** 🔴 `node:net` 의 `LookupFunction` 과 **같은 모양** 이어야 꽂힌다(타입이 그것을 잠근다). */
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * `node:http(s)` 요청의 `lookup` 옵션에 그대로 넘긴다.
 *
 * 🔴🔴 **이 층만이 「검사한 IP 로 연결된다」를 보장한다.** 이름을 검사한 뒤 다시
 *    해석하는 것이 아니라, **연결에 쓰이는 그 해석 결과** 를 직접 거른다 →
 *    그래서 이 경로에서는 DNS rebinding(TOCTOU)이 닫힌다.
 * 🔴 `fetchHtmlDirect` 는 리다이렉트를 **스스로** 따라가므로(홉마다 새 요청)
 *    이 훅이 **모든 홉** 에 적용된다.
 */
export function guardedLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  const decide = (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]): void => {
    /** 🔴🔴 WU-026 — **호출됐다는 사실을 먼저 기록한다.** 통과/차단과 무관하다 —
     *  이 칸이 비어 있으면 「훅이 붙지 않았다」를 뜻하고 호출부가 그것으로 fail-closed 한다.
     *  🔴 성공했을 때만 세면 **차단된 홉이 「훅 미적용」으로 오인** 된다. */
    recordConnectGuardHit(hostname);
    if (err) return callback(err, "");
    if (!addresses.length) {
      return callback(Object.assign(new Error("outbound blocked (DNS_UNRESOLVED)"), { code: "ENOTFOUND" }), "");
    }
    if (!addresses.every((a) => isPublicIpAddress(a.address))) {
      return callback(Object.assign(new Error("outbound blocked (RESOLVED_TO_PRIVATE_IP)"), { code: "EACCES" }), "");
    }
    /** 🟢 호출부가 요구한 모양을 **그대로** 돌려준다(`all` 여부를 바꾸지 않는다). */
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  };
  /** 🔴 모듈 로드 실패도 **막는 쪽** 으로 떨어진다(fail-closed) — 연결되지 않는다. */
  void nodeDnsLookup().then(
    (lookup) => lookup(hostname, { ...options, all: true, verbatim: true }, decide),
    (err: unknown) => callback(err as NodeJS.ErrnoException, ""),
  );
}

/* ──────────── ④ connect 시점 고정 — fetch 의 DNS rebinding 을 닫는다 ──────────── */

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 WU-026 — **`fetch` 는 연결 직전에 «스스로 다시» 해석한다.** 측정값:
 * ════════════════════════════════════════════════════════════════════════════
 * ```
 * 우리 검증 lookup  1회
 *   → fetch("https://example.com/")
 * 전체 lookup       **2회**        ← 두 번째는 **undici 의 connector** 가 한 것이고
 *                                    우리 규칙을 통과하지 않는다
 * ```
 * 🔴 그래서 ②(이름 해석)만으로는 **검증한 IP 로 연결된다는 보장이 없다** — 그 사이에
 *    DNS 응답이 바뀌면 다른 IP 로 간다(DNS rebinding · TOCTOU).
 *
 * 🟢 **닫는 방법은 하나다 — connector 의 `lookup` 을 우리 것으로 만든다.**
 *    `node:http(s)` 는 `lookup` 옵션을 직접 받지만(③), `fetch` 는 **dispatcher** 를
 *    통해서만 받는다. 그래서 `undici.Agent({ connect: { lookup: guardedLookup } })` 를
 *    만들어 `fetch(url, { dispatcher })` 로 넘긴다.
 *    🟢 실측: dispatcher 를 주면 connect 시점 lookup 이 **우리 것** 이 되고, 그 훅이
 *       에러를 내면 **요청이 나가지 않는다**(패킷 0 — connect 전에 끊긴다).
 *
 * 🔴 **왜 `undici` 를 이 패키지의 의존성으로 올렸나** — Node 코어는 dispatcher 를
 *    만들 API 를 **노출하지 않는다**(`fetch(url,{dispatcher})` 는 받지만 `Agent` 가 없다).
 *    🟢 추가한 버전은 `apps/admin` 이 이미 쓰던 **같은 7.29.0** 이라 트리에 사본이 늘지 않았다.
 * 🔴 **동적 import 다** — 정적으로 쓰면 `undici` 가 끌어오는 `node:net`/`node:tls` 가
 *    클라이언트 번들로 들어가 빌드가 깨진다(`node:dns` 와 같은 계열 · §3-1 실측).
 */
type OutboundDispatcher = NonNullable<Parameters<typeof fetch>[1]> extends { dispatcher?: infer D } ? D : unknown;

let cachedDispatcher: unknown | null = null;
let dispatcherUnavailableReason: string | null = null;

/**
 * 🔴 **호출된 적이 있는 호스트** 를 기록한다. 「훅이 붙었는가」를 호출부가 사후에
 *    확인하는 유일한 방법이고, 그것이 **조용한 우회** 를 탐지한다.
 * 🟢 origin 이 아니라 hostname 으로 센다 — connector 가 받는 값이 그것이다.
 */
const connectGuardHits = new Map<string, number>();

function recordConnectGuardHit(hostname: string): void {
  const key = hostname.toLowerCase();
  connectGuardHits.set(key, (connectGuardHits.get(key) ?? 0) + 1);
}

export function connectGuardHitsFor(hostname: string): number {
  return connectGuardHits.get(hostname.toLowerCase()) ?? 0;
}

/** 🔴 테스트 전용 — 운영 코드가 이것을 부르면 「훅이 붙었다」 기록이 지워진다. */
export function resetConnectGuardHitsForTests(): void {
  connectGuardHits.clear();
  cachedDispatcher = null;
  dispatcherUnavailableReason = null;
}

/** IPv4/IPv6 **리터럴** 호스트는 이름 해석이 없으므로 connect 훅도 호출되지 않는다. */
export function isIpLiteralHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return IPV4_RE.test(h) || h.startsWith("[") || h.includes(":");
}

/**
 * connect 시점 훅이 꽂힌 dispatcher. 🔴 만들 수 없으면 **던진다**(fail-closed) —
 * 「dispatcher 없이 그냥 보낸다」는 선택지를 두지 않는다(그것이 이 WU 의 차단점이었다).
 */
export async function outboundDispatcher(): Promise<OutboundDispatcher> {
  if (cachedDispatcher) return cachedDispatcher as OutboundDispatcher;
  if (dispatcherUnavailableReason) {
    throw new OutboundBlockedError("CONNECT_GUARD_UNAVAILABLE", dispatcherUnavailableReason);
  }
  try {
    const { Agent } = await import("undici");
    /** 🔴 `guardedLookup` 을 **그대로** 넘긴다 — 사설 IP 규칙의 소유자를 복제하지 않는다. */
    cachedDispatcher = new Agent({ connect: { lookup: guardedLookup } });
    return cachedDispatcher as OutboundDispatcher;
  } catch (error) {
    /** 🔴 사유 문자열에 응답 본문/비밀값이 섞이지 않는다 — 모듈 이름만 남긴다. */
    dispatcherUnavailableReason = error instanceof Error ? `undici: ${error.name}` : "undici";
    throw new OutboundBlockedError("CONNECT_GUARD_UNAVAILABLE", dispatcherUnavailableReason);
  }
}

/* ─────────────────────── 리다이렉트 홉 판별 (순수) ─────────────────────── */

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
export function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}
