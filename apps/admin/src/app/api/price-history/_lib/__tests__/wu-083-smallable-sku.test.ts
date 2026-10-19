import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-083 — **판매처 SKU ↔ 제조사 품번** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「Smallable 전용 파서 금지 · OCR 금지 · 검색엔진 금지 ·
 *    `430700 → B226AC112` 추론 금지 · 보호축 전부 유지」
 *
 * ── 🔴🔴 세 단계 분리(CPO §목표) ────────────────────────────────────────────
 * ```
 * ① 상품 데이터를 못 가져오는가?   🔴 **그렇다. 그리고 원인은 파싱이 아니라 «헤더 크기» 다.**
 *      운영 owner → `UNREACHABLE` · raw fetch → `TypeError: fetch failed`
 *      🟢 node:https 로 maxHeaderSize 를 올려 실측:
 *         16,384B(Node 기본) → **Parse Error: Header overflow**
 *         65,536B            → **200 · 본문 745KB · 응답 헤더 19,197B**
 * ② 상품은 가져오지만 품번을 못 가져오는가?  🟢 가져오면 **다 읽힌다**(아래 표)
 * ③ 제조사 품번이 없어서 막히는가?           🔴🔴 **그렇다 — 페이지에 «없다».**
 * ```
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const HTML = path.join(OUT, "wu-083-smallable.html");
const CMP = path.join(OUT, "wu-083-compare.json");
const PAGES = path.join(OUT, "wu-083-pages.json");
const READY = existsSync(HTML) && existsSync(CMP) && existsSync(PAGES);

/** 🔴 Bobo Choses 공식 품번 모양 — `B226AC112`. 추측이 아니라 공식몰이 쓰는 형태다. */
const BOBO_CODE = /\b[A-Z]\d{3}[A-Z]{2}\d{3}\b/g;

describe("WU-083 — Smallable 판매처 SKU (캐시 필요)", () => {
  (READY ? it : it.skip)("① fetch · ② 추출 · ③ 품번 부재 · control", () => {
    const html = readFileSync(HTML, "utf8");
    const cmp = JSON.parse(readFileSync(CMP, "utf8")) as { name: string | null; sku: string | null; color: string | null; price: string | null; cur: string | null; boboCode: string[] }[];
    const pages = JSON.parse(readFileSync(PAGES, "utf8")) as Record<
      string,
      { owner: { status: string; fetchPath: string; httpCalls?: number; brand?: string | null; price?: unknown; modelCode?: string | null } }
    >;

    /*
     * ── ① 🟢🟢 **WU-084 가 이 단언을 뒤집었다 — 그것이 수정의 증거다.**
     *
     * 🔴 WU-083 측정 시점: `UNREACHABLE`(헤더 19KB > Node 기본 16KB).
     * 🟢 WU-084 가 `UND_ERR_HEADERS_OVERFLOW` 일 때만 **기존 직접 스택**
     *    (maxHeaderSize 64KB · SSRF 가드 유지)으로 되돌리게 해서 **`OK`** 가 됐다.
     * 🔴 원인 기록은 지우지 않는다 — fetchPath 는 여전히 PLAIN_HTML 이고
     *    httpCalls 도 **1** 이다(요청이 늘지 않았다).
     */
    expect(pages.SMALLABLE.owner.status).toBe("OK");
    expect(pages.SMALLABLE.owner.fetchPath).toBe("PLAIN_HTML");
    expect(pages.SMALLABLE.owner.httpCalls).toBe(1);
    /** 🟢 그리고 **다섯 축 중 셋** 이 실제로 들어온다(품번은 여전히 없다 — 아래 ③). */
    expect(pages.SMALLABLE.owner.brand).toBe("Bobo Choses");
    expect(pages.SMALLABLE.owner.price).toEqual({ amount: 82673, currency: "KRW" });
    expect(pages.SMALLABLE.owner.modelCode ?? null).toBeNull();

    /* ── ② 받아 오면 무엇이 읽히는가 ── */
    const lds = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    const prod = lds.map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } })
      .find((j) => j && j["@type"] === "Product") as Record<string, unknown> | undefined;
    expect(prod).toBeTruthy();
    /** 🟢 brand · color · 가격 · 통화가 **구조화 데이터로** 있다. */
    expect((prod!.brand as { name?: string }).name).toBe("Bobo Choses");
    expect(prod!.color).toBe("Ecru");
    expect((prod!.offers as { priceCurrency?: string }).priceCurrency).toBe("KRW");
    /** 🔴 그런데 `sku` 는 **Smallable 자체 체계** 다(`AAA…`). */
    expect(String(prod!.sku)).toMatch(/^AAA\d+$/);
    expect(prod!.mpn ?? null).toBeNull();

    /* ── ③ 🔴🔴 제조사 품번이 **페이지 어디에도 없다** ── */
    expect(html.match(BOBO_CODE) ?? []).toHaveLength(0);
    expect(html.includes("B226AC112")).toBe(false);
    /** 🔴 그리고 Smallable 상품 **8건 전수** 에서도 0건이다(1건이 아니다). */
    expect(cmp.length).toBeGreaterThanOrEqual(8);
    expect(cmp.filter((r) => r.boboCode.length > 0)).toHaveLength(0);
    /** 🔴 전부 `AAA…` SKU 다 — 판매처 자체 체계. */
    expect(cmp.filter((r) => r.sku && /^AAA\d+$/.test(r.sku)).length).toBeGreaterThanOrEqual(7);

    /* ── control ── */
    /** 🟢 A 공식몰은 정상으로 열린다(같은 조건에서 우리 문제가 아니다). */
    expect(pages["CTRL-A-공식"].owner.status).toBe("OK");
    /** 🟢 B 국내 판매처도 정상 — 품번을 제목에 적는다. */
    expect(pages["CTRL-B-국내"].owner.status).toBe("OK");
    /** 🔴 C SSG 는 **URL 모양** 에서 막힌다(WU-073 이 이미 「오차단」으로 기록). */
    expect(pages["CTRL-C-SSG"].owner.status).toBe("NOT_PRODUCT_URL");

    /** 🔴 **추론하지 않았다** — `430700`/`AAA…` 를 `B226AC112` 로 바꾸는 코드는 없다. */
    expect(html.includes("430700")).toBe(true);
  });
});
