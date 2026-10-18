import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-077 — **국내 후보의 ⑥ Market KR 확정 병목** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「market gate 완화 ❌ · KRW-only ❌ · whitelist 확대 ❌ · 한국어만으로 KR ❌ ·
 *    MI gate ❌ · price parser ❌ — 조사 → counterfactual → GO/HOLD 까지만」
 *
 * ── 🔴🔴 분모를 먼저 가른다 (WU-073 의 「17」을 정정한다) ─────────────────────
 * ```
 * ① 내 **도메인 휴리스틱** 으로 「국내 계열」이라 센 것      → **17**
 * ② WU-063 표의 `kr` 라벨                                  → **9**
 * ③ 운영 `classifyCandidateMarket` 이 KR 로 확정한 것        → **7**
 * 🔴 WU-073 의 ⑤~⑧ 분모 17 은 **①** 이다. ②③과 **섞지 않는다.**
 * ```
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const T63 = path.join(OUT, "wu-063-table.json");
const G36 = path.join(OUT, "wu-036-3way.json");
const READY = existsSync(T63) && existsSync(G36);
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

/** 🔴 서술용 라벨이다 — 운영 규칙이 아니다(WU-073 과 같은 식). */
const HEUR = (d: string) =>
  /\.kr$|\.co\.kr|kihanan|biskuit|mustit|trenbe|luxboy|donokids|kids21|coupang|naver|ssg|lfmall|croket|luksus|miniboutique|beaumonde|littleluna|wconcept|lotteon|feelway|bbambam|ocokorea/i.test(d);

type Row = {
  id: string; human: string; domain: string; kr: boolean; currency: string | null;
  market: string; basis: string; tier: string; price: number | null; priceKrw: number | null; inDomestic: boolean;
};

/** 🔴 **페이지에서 읽는** 한국 증거 — 전부 «관측» 이고 운영 규칙이 아니다. */
type Ev = { langKo: boolean; bizNo: boolean; mailOrder: boolean; krwText: boolean; titleKo: boolean };
function evidence(html: string): Ev {
  const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? "";
  return {
    langKo: /<html[^>]+lang=["']ko/i.test(html) || /charset=["']?euc-kr/i.test(html),
    /** 사업자등록번호 모양 — 123-45-67890. */
    bizNo: /\d{3}-\d{2}-\d{5}/.test(html),
    mailOrder: /통신판매업|통신판매 ?신고/.test(html),
    krwText: /[0-9][0-9,]{3,}\s*원/.test(html),
    titleKo: /[가-힣]/.test(title),
  };
}

describe("WU-077 — ⑥ market KR 확정 (캐시 필요)", () => {
  (READY ? it : it.skip)("① 전수 표 · ② 탈락 구성 · ③ CF 6종 → 국내 버킷 precision", () => {
    const T = JSON.parse(readFileSync(T63, "utf8")) as Row[];
    const G = (JSON.parse(readFileSync(G36, "utf8")) as { rows: { candidateUrl: string }[] }).rows;
    const urlOf = new Map<string, string>();
    G.forEach((r, i) => urlOf.set(`C${String(i + 1).padStart(2, "0")}`, r.candidateUrl));

    const rows = T.map((r) => {
      const u = urlOf.get(r.id);
      const f = u ? path.join(CACHE, `${key(u)}.html`) : null;
      const html = f && existsSync(f) ? readFileSync(f, "utf8") : "";
      return { ...r, url: u ?? "", ev: evidence(html), heur: HEUR(r.domain) };
    });
    const A = rows.filter((r) => r.heur);

    /* ── §5-B CONTROL — 운영 owner 를 «복제하지 않고» 그대로 불러 표의 값을 재현한다 ── */
    let mismatch = 0;
    for (const r of rows) {
      const got = classifyCandidateMarket({
        domain: r.domain,
        currency: r.currency,
        isRegisteredDomesticShop: r.basis.includes("REGISTERED_SHOP"),
      });
      if (got.market !== r.market) mismatch += 1;
    }

    console.log("\n════════ WU-077 — ⑥ market KR 확정 ════════");
    console.log(` 🔴 분모 셋: 휴리스틱 **${A.length}** · 표 kr 라벨 **${rows.filter((r) => r.kr).length}** · 운영 KR 확정 **${A.filter((r) => r.market === "KR").length}**`);
    console.log(` 🟢 CONTROL — 운영 owner 재현 mismatch **${mismatch}** / ${rows.length}\n`);
    console.log(" id   human      domain                     cur   basis                               market   tier        | langKo bizNo 통판 원표기 제목한");
    for (const r of A) {
      console.log(
        [String(r.id).padEnd(4), String(r.human).padEnd(10), String(r.domain).slice(0, 26).padEnd(26),
        String(r.currency).padEnd(5), String(r.basis).slice(0, 35).padEnd(35), String(r.market).padEnd(8),
        String(r.tier).padEnd(11), "|", String(r.ev.langKo).padEnd(6), String(r.ev.bizNo).padEnd(5),
        String(r.ev.mailOrder).padEnd(4), String(r.ev.krwText).padEnd(6), String(r.ev.titleKo)].join(" "),
      );
    }

    /* ── ② 탈락 10 의 구성 ── */
    const dropped = A.filter((r) => r.market !== "KR");
    const byBasis: Record<string, number> = {};
    for (const r of dropped) byBasis[r.basis] = (byBasis[r.basis] ?? 0) + 1;
    console.log(`\n ── ② 탈락 ${dropped.length}건의 구성 ──`);
    console.log(`   ${JSON.stringify(byBasis)}`);

    /* ── ③ CF ── */
    const krTld = (d: string) => /\.kr$/i.test(d.trim().toLowerCase());
    const CFS: { name: string; kr: (r: (typeof rows)[number]) => boolean }[] = [
      { name: "CF-1 현재 로직(운영)", kr: (r) => r.market === "KR" },
      { name: "CF-2 KRW 만으로 KR", kr: (r) => r.currency === "KRW" },
      { name: "CF-3 .kr TLD 만으로 KR", kr: (r) => krTld(r.domain) },
      { name: "CF-4 현재 + 한국어 증거", kr: (r) => r.market === "KR" || (r.currency === "KRW" && (r.ev.langKo || r.ev.titleKo)) },
      { name: "CF-5 현재 + 사업자/통신판매", kr: (r) => r.market === "KR" || (r.currency === "KRW" && (r.ev.bizNo || r.ev.mailOrder)) },
      { name: "CF-6 복합(KRW + 한국어 + 사업자)", kr: (r) => r.market === "KR" || (r.currency === "KRW" && (r.ev.langKo || r.ev.titleKo) && (r.ev.bizNo || r.ev.mailOrder)) },
    ];

    /** 🔴 운영 국내 버킷 자격 — `market KR && priceKrw && tier ∈ {EXACT, COMPARISON}`. */
    const bucketEligible = (r: (typeof rows)[number]) => r.priceKrw != null && (r.tier === "EXACT" || r.tier === "COMPARISON");

    console.log(`\n ── ③ CF — KR 확정 → 국내 버킷 → Human 라벨 ──`);
    console.log("  축                                 KR확정  버킷진입  SAME  🔴DIFFERENT  UNCERTAIN");
    const table: Record<string, { kr: number; bucket: number; same: number; diff: number; unc: number }> = {};
    for (const cf of CFS) {
      const krSet = rows.filter(cf.kr);
      const bucket = krSet.filter(bucketEligible);
      const rec = {
        kr: krSet.length,
        bucket: bucket.length,
        same: bucket.filter((r) => r.human === "SAME").length,
        diff: bucket.filter((r) => r.human === "DIFFERENT").length,
        unc: bucket.filter((r) => r.human !== "SAME" && r.human !== "DIFFERENT").length,
      };
      table[cf.name] = rec;
      console.log(`  ${cf.name.padEnd(34)} ${String(rec.kr).padStart(4)}  ${String(rec.bucket).padStart(7)}  ${String(rec.same).padStart(4)}  ${String(rec.diff).padStart(10)}  ${String(rec.unc).padStart(9)}`);
    }

    /**
     * 🔴🔴 **이 WU 의 결정적 숫자** — 셀러가 실제로 보는 것은 「국내 최저가」 하나다.
     *    WU-063 의 제1원칙: **「잘못된 국내 최저가를 보여주는 것이 가격 미노출보다 더 큰 오류다.」**
     */
    console.log(`\n ── 🔴🔴 국내 «최저가» 가 누구에게서 오는가 ──`);
    const lowest: Record<string, { amount: number | null; id: string; human: string }> = {};
    for (const cf of CFS) {
      const bucket = rows.filter(cf.kr).filter(bucketEligible).filter((r) => r.priceKrw != null);
      const min = bucket.sort((a, b) => (a.priceKrw ?? 0) - (b.priceKrw ?? 0))[0];
      lowest[cf.name] = { amount: min?.priceKrw ?? null, id: min?.id ?? "-", human: min?.human ?? "-" };
      const mark = min?.human === "SAME" ? "🟢" : "🔴";
      console.log(`  ${cf.name.padEnd(34)} ₩${String(min?.priceKrw ?? "-").padStart(8)}  ${min?.id}  ${mark} ${min?.human}`);
    }

    console.log(`\n ── 🔴 같은 샵이 SAME/DIFFERENT 로 갈리는가(WU-063 경고 재확인) ──`);
    const byShop = new Map<string, string[]>();
    for (const r of A) byShop.set(r.domain, [...(byShop.get(r.domain) ?? []), `${r.id}:${r.human}`]);
    for (const [d, v] of byShop) if (new Set(v.map((x) => x.split(":")[1])).size > 1) console.log(`   🔴 ${d.padEnd(24)} ${v.join(" ")}`);

    writeFileSync(path.join(OUT, "wu-077.json"), JSON.stringify({ table, byBasis, heur: A.length }, null, 1));

    /* ══════════════════ 🔴 계약 ══════════════════ */

    /** §5-B — 운영 owner 를 그대로 불러 표의 market 을 **전건 재현** 한다. */
    expect(mismatch).toBe(0);

    /** ① 🔴 분모 셋이 다르다 — WU-073 의 「17」은 휴리스틱이다. */
    expect(A).toHaveLength(17);
    expect(rows.filter((r) => r.kr)).toHaveLength(9);
    expect(A.filter((r) => r.market === "KR")).toHaveLength(7);

    /** ② 🔴🔴 탈락 10 의 구성 — **셋으로 갈린다.** 「증거 부족」이 전부가 아니다. */
    expect(dropped).toHaveLength(10);
    expect(byBasis.FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE).toBe(4);
    expect(byBasis.KRW_WITHOUT_DOMAIN_EVIDENCE).toBe(4);
    expect(byBasis.NO_PRICE_EVIDENCE).toBe(2);

    /** ③ 🟢 현재 국내 버킷은 **5건** 이고 Human DIFFERENT 가 **이미 2건** 있다. */
    expect(table["CF-1 현재 로직(운영)"].bucket).toBe(5);

    /**
     * ③ 🔴🔴 **완화하면 Human DIFFERENT 가 국내 참고가격으로 들어간다.**
     *    donokids 가 같은 샵 안에서 SAME/DIFFERENT 로 갈리기 때문이다(C21✓ C22✗ C43✓).
     */
    for (const n of ["CF-2 KRW 만으로 KR", "CF-4 현재 + 한국어 증거", "CF-5 현재 + 사업자/통신판매", "CF-6 복합(KRW + 한국어 + 사업자)"]) {
      expect(table[n].diff).toBeGreaterThan(table["CF-1 현재 로직(운영)"].diff);
    }

    /** ③ 🔴 `.kr` 단독(통화 무시)은 **아무것도 바꾸지 않는다** — 버킷이 현재와 같다. */
    expect(table["CF-3 .kr TLD 만으로 KR"].bucket).toBe(table["CF-1 현재 로직(운영)"].bucket);

    /** ③ 🔴 한국어 축과 사업자 축이 **같은 4건** 을 연다 — 서로 독립이 아니다. */
    expect(table["CF-4 현재 + 한국어 증거"]).toEqual(table["CF-5 현재 + 사업자/통신판매"]);
    expect(table["CF-6 복합(KRW + 한국어 + 사업자)"]).toEqual(table["CF-4 현재 + 한국어 증거"]);

    /**
     * ④ 🔴🔴 **결정적** — 지금은 최저가가 Human **SAME** 에서 온다. 완화하면 Human
     *    **DIFFERENT** 로 바뀐다. 즉 셀러가 보는 「국내 최저가」가 **다른 상품 가격** 이 된다.
     *    WU-063 의 제1원칙상 이것 하나로 완화는 기각이다.
     */
    expect(lowest["CF-1 현재 로직(운영)"].human).toBe("SAME");
    for (const n of ["CF-4 현재 + 한국어 증거", "CF-5 현재 + 사업자/통신판매", "CF-6 복합(KRW + 한국어 + 사업자)"]) {
      expect(lowest[n].human).toBe("DIFFERENT");
      expect(lowest[n].amount).toBeLessThan(lowest["CF-1 현재 로직(운영)"].amount ?? Infinity);
    }

    /**
     * ④-b 🔴 **CF-2 는 «다른 성질» 로 틀린다 — 내 1차 단언이 여기서 깨졌다.**
     *    최저가가 Human **SAME**(C09 ₩40,300)이라 라벨로는 안 잡힌다. 그런데 그 출처가
     *    **`junioredition.com`(해외 사이트의 한국 표시가)** 이다. 즉 CF-2 는
     *    「틀린 상품」이 아니라 **「국내 판매처가 아닌 곳」** 을 국내 최저가로 만든다.
     *    🔴 그것이 바로 `classifyCandidateMarket` 머리 주석의 금지(「통화 단독 결정」)이고
     *       WU-051 이 막은 바로 그 모양이다. 🔴 라벨만 보면 **놓쳤을 오류** 다.
     */
    const cf2Low = rows.find((r) => r.id === lowest["CF-2 KRW 만으로 KR"].id);
    expect(cf2Low?.human).toBe("SAME");
    expect(/\.kr$/i.test(cf2Low?.domain ?? "")).toBe(false);
    expect(cf2Low?.market).not.toBe("KR");
  });
});
