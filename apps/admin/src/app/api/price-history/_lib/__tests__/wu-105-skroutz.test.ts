import { describe, expect, it } from "vitest";
import dns from "node:dns/promises";
import https from "node:https";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-105 — `skroutz.ro` UNREACHABLE **원인을 error evidence 로 가른다** (LIVE · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「코드 ❌ · 배포 ❌ · AI ❌ · 그 URL **만** · WU-084 의
 *    `UND_ERR_HEADERS_OVERFLOW` 와 **같은 유형인지** 확인 ·
 *    DNS / TLS / connection / timeout / HTTP / header overflow 를 **실제 error 로** 구분 ·
 *    **「우리 fetcher 문제」와 「외부 사이트 접근 불가」를 분리**」
 * 🔴 로그가 부족하면 **「원인 판별 불가」로 닫는다**.
 */
const LIVE = process.env.MI_P0_02_LIVE === "1";
const URL_ =
  "https://www.skroutz.ro/s/69624733/bobo-choses-bluza-pentru-copii-cu-maneca-lunga-hug-hairy-monster-b226ac009.html";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** 🟢 `node:https` 로 **헤더 상한을 바꿔** 돌린다 — WU-084 가 overflow 를 가른 그 방법. */
function viaHttps(maxHeaderSize: number): Promise<{ ok: boolean; status?: number; bytes?: number; err?: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      URL_,
      { method: "GET", headers: { "User-Agent": UA }, maxHeaderSize, timeout: 25000 },
      (res) => {
        let n = 0;
        res.on("data", (c: Buffer) => (n += c.length));
        res.on("end", () => resolve({ ok: true, status: res.statusCode, bytes: n }));
      },
    );
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, err: "TIMEOUT" }); });
    req.on("error", (e: Error & { code?: string }) => resolve({ ok: false, err: `${e.code ?? "ERR"}: ${e.message.slice(0, 80)}` }));
    req.end();
  });
}

describe("WU-105 — skroutz.ro UNREACHABLE 원인 (LIVE)", () => {
  (LIVE ? it : it.skip)("error evidence 로 가른다", async () => {
    /* ── ① DNS ── */
    let dnsOut = "";
    try {
      const a = await dns.lookup("www.skroutz.ro", { all: true });
      dnsOut = `🟢 해석됨 ${a.map((x) => x.address).join(",")}`;
    } catch (e) {
      dnsOut = `🔴 실패 ${String((e as { code?: string }).code ?? e)}`;
    }
    // eslint-disable-next-line no-console
    console.log(`\n① DNS            ${dnsOut}`);

    /* ── ② 운영 owner ── */
    const f = await factsFromProductUrl(URL_);
    // eslint-disable-next-line no-console
    console.log(`② 운영 owner      status=**${f.status}** httpCalls=${f.httpCalls} fetchPath=${f.fetchPath}`);

    /* ── ③ raw fetch — undici error code 를 «그대로» 읽는다 ── */
    let raw = "";
    try {
      const r = await fetch(URL_, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
      raw = `🟢 HTTP ${r.status} · ${r.headers.get("content-type") ?? ""}`;
    } catch (e) {
      const cause = (e as { cause?: { code?: unknown; message?: unknown } }).cause;
      raw = `🔴 ${String(e).slice(0, 70)} | cause.code=**${String(cause?.code ?? "없음")}**`;
    }
    // eslint-disable-next-line no-console
    console.log(`③ raw fetch       ${raw}`);

    /* ── ④ node:https 기본(16KB) vs 64KB — overflow 판별 ── */
    const small = await viaHttps(16 * 1024);
    const big = await viaHttps(64 * 1024);
    // eslint-disable-next-line no-console
    console.log(`④ https 16KB      ${JSON.stringify(small)}`);
    // eslint-disable-next-line no-console
    console.log(`   https 64KB      ${JSON.stringify(big)}`);

    /* ── 판정 ── */
    const headerOverflow = !small.ok && big.ok;
    // eslint-disable-next-line no-console
    console.log(
      `\n🔴 판정 — WU-084 와 **같은 유형(header overflow)인가**: ${headerOverflow ? "🟢 **그렇다**" : "🔴 **아니다**"}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `   우리 fetcher 문제 ↔ 외부 접근 불가: ${
        big.ok ? "🟡 **우리 쪽**(상한을 올리면 받아진다)" : "🔴 **외부 접근 불가**(상한과 무관하게 실패)"
      }`,
    );
    expect(f.status).toBeTruthy();
  }, 600_000);
});
