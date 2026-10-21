import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-143 우선순위 ② — **국내(비-Shopify) 후보에 신뢰 가능한 브랜드 신호가 있는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시(2026-10-21):
 * > 「Cafe24/비-Shopify 후보에서도 **동일한 신뢰 가능한 site-brand 신호가 존재하는지
 * >  확인** 하고, 존재한다면 최소 범위로 canonical brand 에 연결할 수 있는지 검증합니다.
 * >  단 **`샵 이름 = 브랜드` fallback 은 금지** 합니다. biskuit 사례가 그 위험을 보여줍니다.」
 *
 * ── 🔴 왜 이 조사가 필요한가 (WU-142 실측) ─────────────────────────────────
 * ```
 * 국내 human SAME 2건이 **같은 모양** 으로 막혔다:
 *   beaumonde.co.kr  후보측 facts.brand **공백**        → BRAND_UNCONFIRMED
 *   biskuit.kr       후보측 facts.brand **"비스킷"**(샵 이름) → BRAND_MISMATCH
 * 🟢 그런데 **둘 다 제목에 품번과 한글 브랜드가 있다**:
 *   "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010"
 *   "[보보쇼즈] 허그 헤어리 몬스터 티셔츠 B226AC009 - 비스킷"
 * ```
 * 🔴 WU-134 의 복구(`extractSiteBrandName`)는 **Shopify 경로 전용** 이라 여기서 발화하지 않는다.
 *
 * ── 🔴🔴 이 파일이 «하지 않는» 것 ──────────────────────────────────────────
 * ```
 * ❌ 브랜드를 **추론** 하지 않는다 — 페이지가 직접 말하는 자리만 읽는다
 * ❌ `샵 이름 = 브랜드` fallback (CPO 금지 · WU-080 이 계약으로 잠근 축)
 * ❌ 운영 코드 변경 · threshold · 8축 · 판정
 * ❌ 제목에서 한글 브랜드를 **문자열로 긁어내기**(= 새 추출 규칙 · CPO 승인 전 금지)
 * ```
 * 🟢 보는 것은 **네 자리** 뿐이다 — `JSON-LD brand` · `og:site_name` ·
 *    `JSON-LD Organization.name` · `meta[property=product:brand]`.
 *    그 넷은 WU-134 가 **이미 쓰는 자리** 라 새 규칙이 아니다.
 *
 * 🔴 게이트 `WU_143_PROBE=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */
const LIVE = process.env.WU_143_PROBE === "1";

/**
 * 🔴🔴 **URL 을 손으로 적지 않는다 — GT 에서 읽는다.**
 *
 * 1차에 내가 두 URL 을 **추측해서 박았고** biskuit 쪽이 **틀렸다**
 * (실제는 Cafe24 한글 slug 경로 `/product/보보쇼즈-…-b226ac009/8891/…`,
 *  내가 적은 것은 `/product/detail.html?product_no=1902` — **존재하지 않는 주소**).
 * 🔴 URL 지어내기는 이 저장소의 금지 행위다(WU-116 이 같은 이유로 멈췄다).
 * ⟹ 🟢 **GT fixture 를 유일한 출처로** 삼는다. 그러면 지어낼 자리가 없다.
 */
const OBSERVED: Record<string, string> = {
  "www.beaumonde.co.kr": "facts.brand 공백 → BRAND_UNCONFIRMED",
  "biskuit.kr": 'facts.brand "비스킷"(샵 이름) → BRAND_MISMATCH',
};

function loadTargets(): { host: string; url: string; observed: string; expectBrandWord: string }[] {
  const gt = JSON.parse(
    readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
  ) as { candidates: { url: string; verdict: string }[] };
  const out: { host: string; url: string; observed: string; expectBrandWord: string }[] = [];
  for (const c of gt.candidates) {
    if (c.verdict !== "SAME") continue;
    let host = "";
    try {
      host = new URL(c.url).hostname;
    } catch {
      continue;
    }
    /** 🔴 국내 축만. `.kr` 판정은 **표 라벨용** 이고 운영 시장 판정이 아니다. */
    if (!host.endsWith(".kr")) continue;
    out.push({ host, url: c.url, observed: OBSERVED[host] ?? "(WU-142 관측 없음)", expectBrandWord: "보보쇼즈" });
  }
  return out;
}

/** 🔴 **원문이 직접 말하는 자리** 만. 추론·휴리스틱 0. */
function readBrandSlots(html: string) {
  const out: Record<string, string[]> = {
    "JSON-LD Product.brand": [],
    "JSON-LD Organization.name": [],
    "og:site_name": [],
    "meta product:brand": [],
  };
  /** 🟢 JSON-LD 는 **파싱해서** 읽는다(정규식으로 긁지 않는다 — WU-078 교훈). */
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const b of blocks) {
    const body = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      const type = String(o["@type"] ?? "");
      if (/Product/i.test(type)) {
        const b2 = o.brand;
        const name = typeof b2 === "string" ? b2 : ((b2 as Record<string, unknown> | undefined)?.name as string);
        if (name) out["JSON-LD Product.brand"].push(String(name));
      }
      if (/Organization|Store|LocalBusiness/i.test(type) && o.name) {
        out["JSON-LD Organization.name"].push(String(o.name));
      }
      Object.values(o).forEach(walk);
    };
    walk(parsed);
  }
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const v = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return v ? [v] : [];
  };
  out["og:site_name"] = meta("og:site_name");
  out["meta product:brand"] = meta("product:brand");
  return out;
}

describe("WU-143 ② — 국내 후보의 브랜드 신호", () => {
  it.runIf(LIVE)("페이지가 «직접 말하는» 브랜드 자리를 전수로 읽는다", async () => {
    /* eslint-disable no-console */
    const targets = loadTargets();
    console.log(`\n🟢 GT 에서 읽은 국내 human SAME 대상 **${targets.length}건**(손으로 적은 URL 0):`);
    for (const t of targets) console.log(`   ${t.host} — ${t.url}`);
    for (const t of targets) {
      console.log(`\n━━━━━━ ${t.host}`);
      console.log(`   WU-142 관측 — ${t.observed}`);
      let html = "";
      let status = 0;
      try {
        const res = await fetch(t.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-research/1.0)" },
          redirect: "follow",
        });
        status = res.status;
        html = await res.text();
      } catch (e) {
        console.log(`   🔴 fetch 실패 — ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      console.log(`   HTTP ${status} · ${html.length}B`);
      /** 🔴 열화된 응답으로 「신호 없음」을 적지 않는다(「측정불가」≠「없다」). */
      if (status !== 200 || html.length < 2000) {
        console.log(`   🔴 **측정불가** — 응답이 정상 상품 페이지가 아니다`);
        continue;
      }

      const slots = readBrandSlots(html);
      for (const [k, v] of Object.entries(slots)) {
        console.log(`   ${k.padEnd(28)} ${v.length === 0 ? "(없음)" : JSON.stringify(v)}`);
      }
      /**
       * 🔴🔴 **그 신호가 «쓸 수 있는» 것인지** 를 같이 적는다 — 존재만으로는 부족하다.
       *    `og:site_name` 이 **샵 이름** 이면 그것을 브랜드로 쓰는 것은 CPO 금지 축이다
       *    (biskuit 가 정확히 그 모양이다 · WU-080 계약).
       */
      const all = Object.values(slots).flat();
      const hasRealBrand = all.some((v) => v.includes(t.expectBrandWord) || /bobo\s*choses/i.test(v));
      const siteName = slots["og:site_name"][0] ?? null;
      const siteNameIsShop = siteName != null && !/bobo\s*choses/i.test(siteName) && !siteName.includes(t.expectBrandWord);
      console.log(`   ⟹ 브랜드를 직접 말하는 자리 있음? **${hasRealBrand ? "예" : "아니오"}**`);
      console.log(
        `   ⟹ og:site_name 이 샵 이름인가? **${siteNameIsShop ? "그렇다 — 🔴 브랜드로 쓰면 안 된다" : "아니다/없음"}**`,
      );
      /** 🟢 제목에 품번이 있는지는 **이미 WU-142 가 확인** 했다 — 여기서 다시 세지 않는다. */
    }
    /** 🔴 WU-142 가 센 국내 human SAME 은 **2건** 이다 — 분모가 달라지면 측정이 다른 것이다. */
    expect(targets.map((t) => t.host).sort()).toEqual(["biskuit.kr", "www.beaumonde.co.kr"]);
  }, 120_000);
});
