import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-089 — **AI 후보 URL 품질** 과 「상세페이지 전용」 counterfactual (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「AI API ❌ · threshold ❌ · 비용 게이트 ❌ · 8축 ❌ · Registry ❌ ·
 *    **AI 결과에 없는 URL 을 검색해 보충하지 않는다** · 코드 변경 0 이 기본값」
 * 🔴 **허위 `matchLevel`/`truth`/`priceTier`/qualification 생성 금지** — 모든 수치는
 *    운영 owner 가 낸 값(WU-087 캐시)만 쓴다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const CACHE = path.join(OUT, "wu-087-cache.json"); // 🟢 WU-087 이 운영 owner 로 만든 결과
/**
 * 🔵🔵🔵 CPO ⒜ 판정(2026-10-31) — **corpus 가 기대 모양이 아니면 «측정불가» 다.**
 *
 * 🔴 이 파일의 숫자 계약(`expect(rows).toHaveLength(181)`)은 머신 `%TEMP%` 의
 *    **공유 가변 산출물**(`OUT/mi-019a-search-result.json`)에 걸려 있다. 리포 코드와
 *    무관하게 행 수가 바뀌면 엉뚱한 변경의 회귀처럼 FAIL 한다(`181 → 182` 실측).
 * 🔴 그 증가는 **self-reference 와 인과가 없다**(CORPUS-ROOT-CAUSE-01 결론).
 * 🟢 그래서 숫자를 고치지 않고 **게이트** 를 세운다 — 기대 모양이 아니면 SKIP.
 * 🔴 「측정불가」는 0 도 PASS 도 아니다 · `181` 을 `182` 로 바꾸지 않았다.
 * 🔴 게이트 술어는 `wu-073` 과 **같은 양** 을 센다(`candidates ∪ dropped[].url`).
 */
const EXPECTED_AI_URLS = 181;

function corpusSize(): number | null {
  if (!existsSync(SEARCH)) return null;
  try {
    const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
      rows?: { candidates?: string[]; dropped?: { url: string }[] }[];
    };
    if (!Array.isArray(s.rows)) return null;
    const all = new Set<string>();
    for (const r of s.rows) {
      (r.candidates ?? []).forEach((u) => all.add(u));
      (r.dropped ?? []).forEach((d) => all.add(d.url));
    }
    return all.size;
  } catch {
    /** 🔴 깨진 산출물을 「0 건」으로 읽지 않는다 — **측정불가** 다. */
    return null;
  }
}
const CORPUS_N = corpusSize();
const READY = existsSync(SEARCH) && existsSync(CACHE) && CORPUS_N === EXPECTED_AI_URLS;
if (!READY) {
  /* eslint-disable-next-line no-console */
  console.log(
    `[WU-089] 🔴 측정불가 — corpus ${CORPUS_N ?? "없음"} ≠ 기대 ${EXPECTED_AI_URLS}` +
      ` (%TEMP%/mi-p0-02 공유 산출물 · self-reference 와 무관)`,
  );
}

const KRISH = (h: string) =>
  /\.kr$|\.co\.kr|kihanan|biskuit|mustit|trenbe|luxboy|donokids|kids21|coupang|naver|ssg|lfmall|croket|luksus|miniboutique|beaumonde|littleluna|wconcept|lotteon|feelway|bbambam|ocokorea/i.test(h);
const host = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};

type Rec = { url: string; host: string; kr: boolean; status: string; brand: string | null; code: string | null; price: { amount: number; currency: string } | null; market: string };

describe("WU-089 — AI URL 품질 (캐시 필요)", () => {
  (READY ? it : it.skip)("③ 전수 유형 ④ 국내/해외 ⑤ 비율 ⑥⑦ counterfactual", () => {
    const s = JSON.parse(readFileSync(SEARCH, "utf8")) as { rows: { candidates: string[]; dropped?: { url: string }[] }[] };
    const all = new Set<string>();
    for (const r of s.rows) {
      r.candidates.forEach((u) => all.add(u));
      (r.dropped ?? []).forEach((d) => all.add(d.url));
    }
    const aiUrls = [...all];
    const cache = JSON.parse(readFileSync(CACHE, "utf8")) as Record<string, Rec>;
    const ex = extractCandidateUrlsFromAiAnswer(aiUrls.map((u, i) => `${i + 1}. ${u}`).join("\n"), null);
    const extracted = new Set(ex.urls);

    /**
     * 🔴🔴 **유형은 «운영 판정 결과» 로 정한다** — URL 경로 모양만으로 정하지 않는다
     *    (WU-073 이 `classifyUrlShape` 의 **양방향 오류** 를 실측했다).
     * ```
     * PRODUCT_DETAIL   운영이 **상품 페이지로 열어 사실을 만든** 것(= status `OK`)
     *   ├ WITH_EVIDENCE   그중 brand/품번까지 읽힌 것
     *   └ NO_EVIDENCE     읽히지 않은 것 — 🔴 **상세가 아니라는 뜻이 «아니다»**
     * REDIRECTED_AWAY  도착지가 상품이 아니다(WU-075)
     * UNREACHABLE      받지 못했다
     * NO_FACTS         제목조차 없다
     * NOT_EXTRACTED    ① 추출기가 상품 URL 로 보지 않았다(목록/홈/검색/카테고리)
     * ```
     */
    const typeOf = (u: string): string => {
      if (!extracted.has(u)) return "NOT_EXTRACTED";
      const r = cache[u];
      if (!r) return "OTHER";
      if (r.status !== "OK") return r.status; // UNREACHABLE · REDIRECTED_AWAY · NO_FACTS
      /**
       * 🔴🔴 **1차 정의가 틀렸다** — `brand || code` 를 상세의 조건으로 썼더니
       *    **가격은 있는데 brand/품번이 없는 3건** 이 빠져 `cf.price` 가 12 → 9 로
       *    «줄었다». 🟢 상세 여부의 owner 는 `factsFromProductUrl` 의 `status` 다.
       */
      return "PRODUCT_DETAIL";
    };

    const rows = aiUrls.map((u) => ({ url: u, host: host(u), kr: KRISH(host(u)), type: typeOf(u), rec: cache[u] }));
    const tally = (xs: typeof rows) => {
      const t: Record<string, number> = {};
      for (const x of xs) t[x.type] = (t[x.type] ?? 0) + 1;
      return t;
    };
    const kr = rows.filter((x) => x.kr);
    const os = rows.filter((x) => !x.kr);

    /** 🔴 ① 추출 탈락을 **운영 `classifyUrlShape` 분포** 와 같이 적는다(둘은 다른 축이다). */
    const shapeOfNotExtracted: Record<string, number> = {};
    for (const x of rows.filter((y) => y.type === "NOT_EXTRACTED"))
      shapeOfNotExtracted[classifyUrlShape(x.url)] = (shapeOfNotExtracted[classifyUrlShape(x.url)] ?? 0) + 1;

    const detail = rows.filter((x) => x.type === "PRODUCT_DETAIL");
    const detailWithEv = detail.filter((x) => x.rec?.brand || x.rec?.code);
    const pct = (a: number, b: number) => `${a}/${b} = ${((100 * a) / b).toFixed(1)}%`;

    // eslint-disable-next-line no-console
    console.log(`\n════════ WU-089 — AI URL 품질 (N=${rows.length}) ════════`);
    // eslint-disable-next-line no-console
    console.log(`  전체  ${JSON.stringify(tally(rows))}`);
    // eslint-disable-next-line no-console
    console.log(`  국내(${kr.length})  ${JSON.stringify(tally(kr))}`);
    // eslint-disable-next-line no-console
    console.log(`  해외(${os.length})  ${JSON.stringify(tally(os))}`);
    // eslint-disable-next-line no-console
    console.log(`\n  🔴 ① 추출 탈락 ${rows.filter((x) => x.type === "NOT_EXTRACTED").length}건의 URL 모양: ${JSON.stringify(shapeOfNotExtracted)}`);
    // eslint-disable-next-line no-console
    console.log(`  🟢 그중 evidence(brand/품번)까지: ${detailWithEv.length} · 🔴 evidence 없음: ${detail.length - detailWithEv.length}`);
    // eslint-disable-next-line no-console
    console.log(`  🟢 **PRODUCT_DETAIL 비율** 전체 ${pct(detail.length, rows.length)} · 국내 ${pct(detail.filter((x) => x.kr).length, kr.length)} · 해외 ${pct(detail.filter((x) => !x.kr).length, os.length)}`);

    /* ── ⑥⑦ counterfactual: 「상세페이지만 제출했다면」 ── */
    const f = (xs: typeof rows) => ({
      url: xs.length,
      extraction: xs.filter((x) => extracted.has(x.url)).length,
      fetch: xs.filter((x) => x.rec?.status === "OK").length,
      evidence: xs.filter((x) => x.rec?.status === "OK" && (x.rec.brand || x.rec.code)).length,
      price: xs.filter((x) => x.rec?.price != null).length,
      market: xs.filter((x) => x.rec?.price != null && (x.rec.market === "KR" || x.rec.market === "OVERSEAS")).length,
    });
    const now = f(rows);
    const cf = f(detail);
    const line = (k: keyof typeof now) =>
      `  ${k.padEnd(12)} ${String(now[k]).padStart(5)} ${String(cf[k]).padStart(8)} ${String(cf[k] - now[k]).padStart(7)}`;
    // eslint-disable-next-line no-console
    console.log(`\n  ── ⑥⑦ KPI 비교 ──\n  KPI            현재  상세전용    증감`);
    for (const k of ["url", "extraction", "fetch", "evidence", "price", "market"] as const) console.log(line(k));

    const nowKr = f(kr), cfKr = f(detail.filter((x) => x.kr));
    const nowOs = f(os), cfOs = f(detail.filter((x) => !x.kr));
    // eslint-disable-next-line no-console
    console.log(`\n  국내  price ${nowKr.price} → ${cfKr.price} (${cfKr.price - nowKr.price}) · market ${nowKr.market} → ${cfKr.market} (${cfKr.market - nowKr.market})`);
    // eslint-disable-next-line no-console
    console.log(`  해외  price ${nowOs.price} → ${cfOs.price} (${cfOs.price - nowOs.price}) · market ${nowOs.market} → ${cfOs.market} (${cfOs.market - nowOs.market})`);

    writeFileSync(path.join(OUT, "wu-089.json"), JSON.stringify({ tally: tally(rows), kr: tally(kr), os: tally(os), now, cf, nowKr, cfKr, nowOs, cfOs, shapeOfNotExtracted }, null, 1));

    /* ══════ 🔴 계약 ══════ */
    expect(rows).toHaveLength(181);
    /** 🔴🔴 **이 WU 의 답** — 상세페이지만 남겨도 **downstream 절대 수가 늘지 않는다.** */
    expect(cf.price).toBe(now.price);
    expect(cf.market).toBe(now.market);
    expect(cfKr.price).toBe(nowKr.price);
    expect(cfOs.price).toBe(nowOs.price);
    /** 🟢 줄어드는 것은 **분모** 다(노이즈 제거) — 효율은 오르고 **산출은 같다**. */
    expect(cf.url).toBeLessThan(now.url);
  });
});
