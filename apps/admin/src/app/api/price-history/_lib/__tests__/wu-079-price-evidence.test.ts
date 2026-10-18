import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-079 — **가격 증거 회수 경로 전수** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「generic 숫자 parser ❌ · 가격이 있다는 이유만으로 VERIFIED_CURRENT ❌ ·
 *    site adapter 선제 구현 ❌ · MI/시장/AI 전부 ❌ — 조사 → CF → GO/HOLD/REJECT」
 * 🔴 **가격을 더 찾는 것보다 «틀린 가격을 찾지 않는 것» 이 우선이다.**
 *
 * 🟢 **안전성 ground truth 가 있다** — 성공군은 JSON-LD 가 `VERIFIED` 금액을 준다.
 *    새 CF 가 그 페이지에서 **다른 숫자** 를 내면 그것이 **False Price Extraction** 이다.
 *    🔴 실패군(beaumonde)에는 ground truth 가 **없다**(사람 확인 불가) → 「회수했다」로
 *       적지 않고 **CF 들이 서로 어긋나는지** 를 센다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const PAGES = path.join(OUT, "wu-079-pages.json");
const READY = existsSync(PAGES);

type Page = {
  id: string; url: string; domain: string; status: number | null; html: string;
  owner: { status: string; price: { amount: number; currency: string } | null; priceStatus: string | null };
};

const strip = (x: string) => x.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** 🔴 CF-1 — **라벨이 붙은** 금액만. 라벨별로 «따로» 센다(의미를 섞지 않는다). */
function labelled(html: string, label: string): number[] {
  const text = strip(html);
  const re = new RegExp(`${label}\\s*[:：]?\\s*([0-9][0-9,]{2,})\\s*원`, "g");
  return [...text.matchAll(re)].map((m) => num(m[1]));
}

/** 🔴 CF-2 — embedded state 는 **명시적 field 이름** 이 있을 때만. */
function stateKeys(html: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const re = /"(price|salePrice|sellingPrice|productPrice|finalPrice|goodsPrice|sale_price|dcPrice|consumerPrice|set_goods_fixedPrice|fixedPrice)"\s*:\s*"?([\d,]+)"?/gi;
  for (const m of html.matchAll(re)) (out[m[1]] ??= []).push(num(m[2]));
  return out;
}

/** 🔴 CF-3 — class 에 가격 의미가 있는 «요소의 내용» 에서만. 이름만으로 확정하지 않는다. */
function domSemantic(html: string): number[] {
  const re = /<(\w+)[^>]*class=["'][^"']*(price|sale|cost|amount)[^"']*["'][^>]*>([\s\S]{0,200}?)<\/\1>/gi;
  const vals: number[] = [];
  for (const m of html.matchAll(re)) {
    const t = strip(m[3]);
    const hit = /^([0-9][0-9,]{2,})\s*원?$/.exec(t) ?? /^([0-9][0-9,]{2,})/.exec(t);
    if (hit) vals.push(num(hit[1]));
  }
  return [...new Set(vals)];
}

describe("WU-079 — 가격 증거 (수집 캐시 필요)", () => {
  (READY ? it : it.skip)("① 원인 · ② CF-1~3 · ③ 안전성(성공군 오추출)", () => {
    const P = Object.values(JSON.parse(readFileSync(PAGES, "utf8")) as Record<string, Page>);
    const fail = P.filter((p) => p.owner.price == null);
    const ok = P.filter((p) => p.owner.price != null);

    console.log("\n════════ WU-079 — 가격 증거 전수 ════════");
    console.log(` 수집 ${P.length} · 🔴 운영에서 가격 없음 **${fail.length}** · 🟢 있음 ${ok.length}`);
    console.log(`\n ── ① 실패군: 구조화 증거가 «정말» 없는가 ──`);
    for (const p of fail) {
      const ld = (p.html.match(/<script[^>]+application\/ld\+json/gi) ?? []).length;
      const mi = (p.html.match(/itemprop=["']price["']/gi) ?? []).length;
      const mt = (p.html.match(/<meta[^>]+(property|name)=["'][^"']*price/gi) ?? []).length;
      console.log(`   ${p.id} ${p.domain.padEnd(20)} JSON-LD ${ld} · microdata ${mi} · meta ${mt} · owner=${p.owner.priceStatus}`);
    }

    console.log(`\n ── ② CF 별 추출값 (실패군) ──`);
    const cfRows: Record<string, unknown>[] = [];
    for (const p of fail) {
      const sale = labelled(p.html, "판매가");
      const list = labelled(p.html, "정가");
      const st = stateKeys(p.html);
      const dom = domSemantic(p.html);
      cfRows.push({ id: p.id, sale, list, st, dom });
      console.log(`   ${p.id} ${p.domain}`);
      console.log(`      CF-1 「판매가」 ${JSON.stringify(sale)} · 「정가」 ${JSON.stringify(list)}`);
      console.log(`      CF-2 state     ${JSON.stringify(st)}`);
      console.log(`      CF-3 DOM       ${JSON.stringify(dom.slice(0, 10))} (${dom.length}개)`);
    }

    console.log(`\n ── ③ 🔴 안전성 — 성공군에서 CF 가 «다른 숫자» 를 내는가 ──`);
    console.log("   id    도메인                 운영(JSON-LD)   CF-1 판매가       CF-3 DOM");
    let falseCf1 = 0;
    let falseCf3 = 0;
    for (const p of ok) {
      const truth = p.owner.price!.amount;
      const s = labelled(p.html, "판매가");
      const d = domSemantic(p.html);
      const cf1Bad = s.length > 0 && !s.includes(truth);
      const cf3Bad = d.length > 0 && d[0] !== truth;
      if (cf1Bad) falseCf1 += 1;
      if (cf3Bad) falseCf3 += 1;
      console.log(
        `   ${p.id.padEnd(5)} ${p.domain.slice(0, 20).padEnd(21)} ${String(truth).padStart(8)}   ${(cf1Bad ? "🔴" : s.length ? "🟢" : "  ")} ${JSON.stringify(s).padEnd(14)} ${cf3Bad ? "🔴" : d.length ? "🟢" : "  "} ${JSON.stringify(d.slice(0, 4))}`,
      );
    }
    console.log(`   ⟹ CF-1 오추출 **${falseCf1}/${ok.length}** · CF-3 오추출 **${falseCf3}/${ok.length}**`);

    writeFileSync(path.join(OUT, "wu-079.json"), JSON.stringify({ fail: fail.map((p) => p.id), cfRows, falseCf1, falseCf3 }, null, 1));

    /* ══════════════════ 🔴 계약 ══════════════════ */

    /** Q1 🟢 **가격 추출 실패가 맞다** — beaumonde 2건은 HTTP 200 · 상품페이지인데 가격만 없다. */
    const beau = P.filter((p) => /beaumonde/i.test(p.domain));
    expect(beau).toHaveLength(2);
    for (const p of beau) {
      expect(p.status).toBe(200);
      expect(p.owner.status).toBe("OK");
      expect(p.owner.price).toBeNull();
      expect(p.owner.priceStatus).toBe("PRICE_UNAVAILABLE");
      /** Q2 🔴 구조화 증거는 **정말 0** 이다 — 「놓쳤다」가 아니라 **「없다」**. */
      expect(p.html.match(/<script[^>]+application\/ld\+json/gi) ?? []).toHaveLength(0);
      expect(p.html.match(/itemprop=["']price["']/gi) ?? []).toHaveLength(0);
      expect(stateKeys(p.html)).toEqual({});
    }

    /**
     * Q3/Q4 🔴🔴 **CF 들이 서로 어긋난다** — 같은 페이지에서 라벨/DOM 이 다른 값을 낸다.
     *    ⟹ 「가격을 찾았다」로 적을 수 없다(semantic ambiguity).
     */
    const c13 = cfRows.find((r) => r.id === "C13")!;
    const c27 = cfRows.find((r) => r.id === "C27")!;
    /** C13: 「판매가」가 있는데 DOM 목록에는 **그 값이 없다**(DOM 은 다른 상품들이다). */
    expect((c13.sale as number[]).length).toBeGreaterThan(0);
    expect((c13.dom as number[])).not.toContain((c13.sale as number[])[0]);
    /** C27: 「판매가」 라벨 뒤에 **숫자가 없다**(설명 문구) → CF-1 이 아예 회수하지 못한다. */
    expect(c27.sale).toEqual([]);
    /** C27: 대신 「정가」만 잡힌다 — 🔴 **Regular-vs-Sale Misread** 의 정확한 모양이다. */
    expect((c27.list as number[]).length).toBeGreaterThan(0);

    /** ③ 🔴 그리고 CF-3 은 **성공군에서 틀린 값을 낸다** — 이것만으로 REJECT 근거가 된다. */
    expect(falseCf3).toBeGreaterThan(0);
    /** ③ 🟢 반면 CF-1(라벨)은 **오추출 0** 이다 — 안전성 자체는 확보된다. */
    expect(falseCf1).toBe(0);

    /**
     * 🔴🔴 **분모 오염을 정정한다** — 내가 `factsFromProductUrl` **하나만** 불러
     *    「실패군 4건」으로 셌는데, 운영 **전체 체인** 에서는 luksusbaby 2건이
     *    `enrichCandidatePrices` 로 채워져 **`VERIFIED_CURRENT · priceSource="detail"`** 이다.
     *    ⟹ **진짜 실패군은 beaumonde 2건뿐** 이다.
     *    🔴 원인도 확정됐다 — luksusbaby 는 `fetchPath = SHOPIFY_JSON` 이라
     *       **HTML 의 JSON-LD(`offers.price=54750, KRW`)를 아예 보지 않는다**(설계상 price null).
     */
    const T63 = path.join(OUT, "wu-063-table.json");
    const tbl = JSON.parse(readFileSync(T63, "utf8")) as { domain: string; priceStatus: string | null; priceSource: string | null }[];
    const luk = tbl.filter((r) => /luksus/i.test(r.domain));
    expect(luk).toHaveLength(2);
    for (const r of luk) {
      expect(r.priceStatus).toBe("VERIFIED_CURRENT");
      expect(r.priceSource).toBe("detail");
    }
    const beauRows = tbl.filter((r) => /beaumonde/i.test(r.domain));
    for (const r of beauRows) expect(r.priceStatus).toBe("PRICE_UNAVAILABLE");

    /**
     * 🔴🔴 **downstream — 안전한 축으로 회수되는 1건이 «틀린 상품» 이다.**
     *    CF-1 로 회수 가능한 것은 **C13 뿐**(C27 은 「판매가」 뒤에 숫자가 없다).
     *    그런데 Human GT 는 C13 **DIFFERENT** · C27 **SAME** 이다.
     *    ⟹ 안전한 회수가 국내 가격비교 **precision 을 떨어뜨린다**.
     */
    const human = JSON.parse(readFileSync(T63, "utf8")) as { id: string; human: string; domain: string; tier: string }[];
    const h13 = human.find((r) => r.id === "C13")!;
    const h27 = human.find((r) => r.id === "C27")!;
    expect(h13.human).toBe("DIFFERENT");
    expect(h27.human).toBe("SAME");
    /** 🔴 회수되는 쪽이 DIFFERENT · 회수 못 하는 쪽이 SAME — 방향이 거꾸로다. */
    expect((c13.sale as number[]).length).toBeGreaterThan(0);
    expect(c27.sale).toEqual([]);
    /** 🔴 그리고 C13 은 tier 가 버킷 자격(COMPARISON)이라 가격만 생기면 **들어간다**. */
    expect(["EXACT", "COMPARISON"]).toContain(h13.tier);
  });
});
