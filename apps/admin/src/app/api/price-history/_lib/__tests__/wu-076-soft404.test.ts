import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-076 — **리다이렉트 «없는» 200 soft-404** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「조사 우선 · 구현 금지 · 텍스트 휴리스틱 즉시 구현 ❌ ·
 *    **표본에서 0건이면 억지로 규칙을 만들지 않고 HOLD**」
 *
 * ── 🔴🔴 CTO 는 Human GT 를 만들 수 없다 → **CONTROL probe** 를 썼다 ─────────
 * ```
 * 같은 호스트에 **존재할 수 없는 상품 URL** 을 넣고 무엇이 오는지 본다.
 *   bogus → 404/리다이렉트        ⟹ 그 사이트는 없는 상품을 정직하게 알린다
 *   bogus → 200 + 본문            ⟹ 🔴 그 호스트에 **200 soft-404 «능력»** 이 있다
 * 🟢 사람 라벨이 아니라 **사이트가 스스로 보여 주는 반증** 이다.
 * ```
 *
 * 🔴🔴 **1차 CONTROL 이 세 건에서 무효였고 내가 그것을 잡았다** — 경로 **마지막 칸** 을
 *    바꿨는데 Cafe24 계열은 마지막이 `…/category/367/display/1/` 같은 **꼬리표** 라
 *    같은 상품이 돌아왔다(bogus 제목이 후보 제목과 **글자 그대로 같았다**).
 *    🟢 식별자 **숫자 세그먼트** 를 바꾸는 2차로 재측정했고 biskuit·miniboutique·
 *       mustit 은 **실제로 404** 였다. 🔴 1차의 「200 5건」을 그대로 보고했으면 **틀렸다.**
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CAND = path.join(OUT, "wu-076-cand.json");
const CTRL1 = path.join(OUT, "wu-076-control.json");
const CTRL2 = path.join(OUT, "wu-076-control2.json");
const CACHE = path.join(OUT, "wu-032-cache");
const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");
const LIVE_F = path.join(OUT, "wu-074-live.json");
const READY = [CAND, CTRL1, CTRL2, NEW_GT, LIVE_F, path.join(OUT, "wu-036-3way.json")].every((f) => existsSync(f));
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

const TITLE = (h: string) => /<title[^>]*>([^<]+)<\/title>/i.exec(h)?.[1]?.trim() ?? null;
const OG_SITE = (h: string) => /property=["']og:site_name["'][^>]+content=["']([^"']+)/i.exec(h)?.[1]?.trim() ?? null;
const norm = (s: string | null) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** 🔴 「canonical 이 **사이트 루트** 를 가리킨다」 — 추가 HTTP 0 인 유일한 축. */
function canonicalIsRoot(html: string, url: string): boolean {
  const c = /rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1] ?? "";
  if (!c) return false;
  try {
    const u = new URL(c, url);
    return u.pathname === "/" || u.pathname === "";
  } catch {
    return false;
  }
}

describe("WU-076 — 200 soft-404 (캐시 필요)", () => {
  (READY ? it : it.skip)("① 존재 여부 · ② 적중 · ③ 축 counterfactual", () => {
    type Cand = { url: string; host: string; status: number | null; finalUrl: string; html: string; owner: { status: string; title: string | null; brand: string | null } };
    const D = Object.values(JSON.parse(readFileSync(CAND, "utf8")) as Record<string, Cand>);
    const C1 = JSON.parse(readFileSync(CTRL1, "utf8")) as Record<string, { status: number | null; html?: string }>;
    const C2 = JSON.parse(readFileSync(CTRL2, "utf8")) as Record<string, { status: number | null; title: string | null; len?: number; html?: string; invalid?: string | null }>;

    /** 🔴 2차가 유효하면 2차가 이긴다 — 1차 twin 이 무효였기 때문이다. */
    const ctrl = new Map<string, { status: number | null; title: string | null; src: string }>();
    for (const [h, v] of Object.entries(C1)) ctrl.set(h, { status: v.status, title: TITLE(v.html ?? ""), src: "1차" });
    for (const [h, v] of Object.entries(C2)) if (!v.invalid && v.status != null) ctrl.set(h, { status: v.status, title: v.title, src: "2차" });

    const softHosts = [...ctrl].filter(([, v]) => v.status === 200);

    /* ── ② 실제 후보가 그 soft-404 를 «맞았는가» ── */
    const hits = D.filter((d) => {
      const c = ctrl.get(d.host);
      return c?.status === 200 && norm(d.owner.title) === norm(c.title);
    });

    /* ── ③ 축: canonical → 루트 ── */
    const live = JSON.parse(readFileSync(LIVE_F, "utf8")) as Record<string, { html: string }>;
    const nw = JSON.parse(readFileSync(NEW_GT, "utf8")) as { id: string; url: string; why: string | null }[];
    const g3 = (JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")) as { rows: { candidateUrl: string }[] }).rows;
    const GT_PROD = [
      ...nw.filter((r) => !/404|홈페이지/.test(String(r.why))).map((r) => ({ url: r.url, html: live[r.id].html })),
      ...g3
        .map((r) => ({ url: r.candidateUrl, f: path.join(CACHE, `${key(r.candidateUrl)}.html`) }))
        .filter((r) => existsSync(r.f))
        .map((r) => ({ url: r.url, html: readFileSync(r.f, "utf8") })),
    ];
    const poolOk = D.filter((d) => d.owner.status === "OK");

    const axisOnPool = poolOk.filter((d) => canonicalIsRoot(d.html, d.url));
    const axisOnGt = GT_PROD.filter((r) => canonicalIsRoot(r.html, r.url));
    /** 🔴 비교축 — 「제목 == og:site_name」(텍스트 휴리스틱이 아닌 구조 신호). */
    const siteNameAxisPool = poolOk.filter((d) => {
      const o = OG_SITE(d.html);
      return o != null && norm(d.owner.title) === norm(o);
    });
    /** 🟢 soft-404 «페이지 자체» 에서 두 축이 발화하는가(= 발화한다면 잡히는가). */
    const ll = C2["www.littleluna.co.kr"];
    const llCanonRoot = canonicalIsRoot(ll?.html ?? "", "https://www.littleluna.co.kr/product/x/4119/category/1");

    const ownerDist: Record<string, number> = {};
    for (const d of D) ownerDist[d.owner.status] = (ownerDist[d.owner.status] ?? 0) + 1;

    console.log("\n════════ WU-076 — 리다이렉트 없는 200 soft-404 ════════");
    console.log(` ① CONTROL 호스트 ${ctrl.size} · 상태분포 ${JSON.stringify([...ctrl.values()].reduce<Record<string, number>>((a, v) => ((a[String(v.status)] = (a[String(v.status)] ?? 0) + 1), a), {}))}`);
    console.log(` 🔴 200 soft-404 «능력» 보유 호스트: ${softHosts.length}`);
    for (const [h, v] of softHosts) console.log(`      ${h.padEnd(24)} title=「${String(v.title).slice(0, 40)}」 (${v.src})`);
    console.log(` ② 🟢 실제 후보 «적중»: **${hits.length}건**`);
    console.log(` ③ 운영 status 분포(WU-075 적용 후 · N=${D.length}): ${JSON.stringify(ownerDist)}`);
    console.log(`\n ── 축 counterfactual (분모: 풀 OK ${poolOk.length} · CEO GT 정상상품 ${GT_PROD.length}) ──`);
    console.log(`  canonical → 루트       차단 ${axisOnPool.length} · 🔴 정상상품 오차단 ${axisOnGt.length}/${GT_PROD.length}`);
    console.log(`  제목 == og:site_name   차단 ${siteNameAxisPool.length} · (오차단 미산출 — 차단 0 이라 무의미)`);
    console.log(`\n  🟢 littleluna soft-404 «페이지» 에서 canonical→루트 발화: ${llCanonRoot}`);
    console.log(`  🟢 wconcept soft-404 «페이지» 는 **제목이 없다**(len=${C2["www.wconcept.co.kr"]?.len}) → 현재 \`NO_FACTS\` 가 이미 막는다`);

    writeFileSync(path.join(OUT, "wu-076.json"), JSON.stringify({ softHosts: softHosts.map(([h]) => h), hits: hits.length, ownerDist, axisOnPool: axisOnPool.length, axisOnGt: axisOnGt.length }, null, 1));

    /* ══════════════════ 🔴 계약 ══════════════════ */

    /** ① 🔴 200 soft-404 **능력은 실재한다** — 40 호스트 중 2. 그리고 **둘 다 한국 쇼핑몰** 이다. */
    expect(softHosts.map(([h]) => h).sort()).toEqual(["www.littleluna.co.kr", "www.wconcept.co.kr"]);
    /** ① 🔴 1차 CONTROL 이 무효였던 셋은 2차에서 **404** 다 — 1차 숫자를 쓰지 않는다. */
    for (const h of ["biskuit.kr", "miniboutique.co.kr", "m.web.mustit.co.kr"]) {
      expect(C1[h].status).toBe(200);
      expect(C2[h].status).toBe(404);
      expect(ctrl.get(h)?.status).toBe(404);
    }

    /** ② 🟢🟢 **표본 적중 0건** — CPO 의 HOLD 조건이 그대로 성립한다. */
    expect(hits).toHaveLength(0);

    /** ③ 🟢 WU-075 가 이 풀에서 실제로 일하고 있다. */
    expect(ownerDist.REDIRECTED_AWAY).toBeGreaterThan(0);

    /**
     * ③ 🟢🟢 **발화했다면 잡혔을 축이 하나 있다** — littleluna 의 soft-404 는
     *    `canonical` 이 **사이트 루트** 다. 🔴 WU-075 의 finalUrl 축은 리다이렉트가
     *    없으므로 **못 잡는다** — 서로 다른 구멍을 덮는다.
     */
    expect(llCanonRoot).toBe(true);
    /** ③ 🔴 그런데 **지금 막을 것이 없다** — 현재 풀에서 차단 이득이 0 이다. */
    expect(axisOnPool).toHaveLength(0);
    /** ③ 🟢 오차단도 0 이다(정상 상품을 죽이지 않는다). ⟹ 「해롭지 않지만 이득도 0」. */
    expect(axisOnGt).toHaveLength(0);
    /** ③ 🔴 텍스트 휴리스틱 대용으로 본 축도 **발화 0** — 넣을 근거가 없다. */
    expect(siteNameAxisPool).toHaveLength(0);
    /** ③ 🟢 wconcept 모양은 **제목이 없어** 기존 `NO_FACTS` 가 이미 막는다. */
    expect(C2["www.wconcept.co.kr"]?.title ?? null).toBeNull();
  });
});
