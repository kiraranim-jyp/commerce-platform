/**
 * RAW-CANDIDATE-CROSSCHECK-02 — 원본 보존 생성기(조사 전용 · 운영 코드 변경 0).
 *
 * 🔴 두 원본을 «요약하지 않고» 파일로 떨어뜨린다(CPO §10).
 *    ① RAW-01-current-search.json      현재 실행에서 «실제로 확보된 것» + 확보 불가 선언
 *    ② RAW-02-historical-ceo-review.json 과거 CEO 육안검토 원본(fixture 그대로)
 *    ③ CROSSCHECK-03-comparison.json    URL 단위 교차표
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIX = join(process.cwd(), "apps/admin/src/app/api/price-history/_lib/__tests__/fixtures");
const OUT = join(process.cwd(), "docs/raw-crosscheck-02");
const fx = (f) => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const loose = (u) => String(u).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

/* ══════════ ① 현재 실행 — 운영 DB 에서 «실제로» 읽은 것만 ══════════ */
const current = {
  _source: "운영 DB 직접 조회(읽기 전용) · 2026-10-31",
  snapshot: {
    id: "9c07b07a-ccc2-489a-af02-37129bf45c31",
    created_at: "2026-10-31T12:02:00.561Z",
    updated_at: "2026-10-31T12:02:39.681Z",
    source_url:
      "https://www.junioredition.com/en-kr/collections/4-years/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses?utm_source=chatgpt.com",
    title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses",
    brand: "Bobo Choses",
    sku: "B226AC010",
    color: "Heather Grey",
    price: { amount: 37, currency: "GBP", source: "ORIGINAL" },
  },
  /** 🔴🔴 §13 STOP — Raw Search 는 «구조적으로» 복구 불가다. 추정으로 메우지 않는다. */
  rawSearch: {
    status: "UNAVAILABLE",
    why: [
      "영속 저장 없음 — public 테이블 32개 전수에 Search 결과 테이블이 없다",
      "런타임 로그 복구 불가 — vercel logs 는 미들웨어 요청 줄만 돌려주고(logs: []) 과거 배포는 0행",
      "🔴 title/snippet/rank 는 «코드가 읽지도 않는다» — web-search-pool.ts 의 ApifySearchItem 은 { organicResults?: { url?: string }[] } 이고 map(o => o.url) 로 URL 만 가져간다(saveHtml:false)",
      "로그에 남는 것은 집계뿐 — [SP07-websearch] query·searches·organic(수)·skipped·failed / [SP07-pool] supplied·accepted·usable·miEligible·dropped(host:reason)·hosts",
    ],
    recoverableFields: ["query(로그)", "timestamp(로그)", "domain/host(로그)", "organic 개수(로그)"],
    unrecoverableFields: ["raw response", "raw rank", "raw title", "raw snippet", "raw URL 전문"],
  },
  /** 🟢 그 실행이 «실제로 남긴» 것 — 전부 원문. */
  persisted: {
    domestic_product_links: { rows: 0, note: "영속 후보 0 — 전부 일시(transient) 생산자 산출이었다" },
    price_alerts: { rows: 0 },
    price_observations: {
      rows: 4,
      note: "🔴🔴 네 행이 «전부» SELLER_ORIGIN 이다 — 원본 상품 자신의 가격 관측이고 비교 후보가 아니다",
      data: [
        { source: "SELLER_ORIGIN", label: "ORIGIN_FX", currency: "GBP", amount: 37, price_krw: 66197, market_code: null, url: "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses" },
        { source: "SELLER_ORIGIN", label: "KR_MARKET", currency: "KRW", amount: 69100, price_krw: 69100, market_code: "en-kr", url: "https://www.junioredition.com/en-kr/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses" },
        { source: "SELLER_ORIGIN", label: "MARKET_PROBE", currency: "AUD", amount: 79, price_krw: 74100, market_code: "en-au", url: "https://www.junioredition.com/en-au/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses" },
        { source: "SELLER_ORIGIN", label: "MARKET_PROBE", currency: "GBP", amount: 37, price_krw: 66197, market_code: "en-int", url: "https://www.junioredition.com/en-int/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses" },
      ],
    },
    /** 🔴🔴🔴 §6 이 지목한 그 후보 — 원문 그대로. */
    candidate_reviews: {
      rows: 1,
      data: [
        {
          id: "6f75269b-c18e-4465-a1e1-da351b40f059",
          snapshot_id: "9c07b07a-ccc2-489a-af02-37129bf45c31",
          origin_code: "B226AC010",
          candidate_url: "https://junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
          candidate_domain: "junioredition.com",
          candidate_title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses",
          image_url: null,
          price_amount: "37",
          price_currency: "GBP",
          market: "OVERSEAS",
          system_verdict: "SAME",
          match_truth: "STRONG_IDENTIFIER",
          price_tier: "EXACT",
          blockers: [],
          human_verdict: null,
          source: "OVERSEAS_AUTO",
          first_seen_at: "2026-10-31T12:03:28.730Z",
          last_seen_at: "2026-10-31T12:03:28.343Z",
          reviewed_at: null,
        },
      ],
    },
  },
};

/* ══════════ ② 과거 CEO 육안검토 원본 — fixture 그대로(새 검색 0) ══════════ */
const blind = fx("wu-067-blind-review-set.json");
const gt68 = Object.values(fx("wu-068-new-gt.json"));
const f59 = fx("wu-059-gt-facts.json");
const gt112 = fx("wu-112-human-gt.json");

const S1 = Object.values(blind).find((b) => b.sid === "S1");
const historical = [];
/** ⓐ 블라인드 세트(S1 = B226AC010) + 그 세트의 CEO 라벨. */
for (const it of S1.items) {
  const lab = gt68.find((g) => g.searchId === "S1" && loose(g.url) === loose(it.url));
  historical.push({
    url: it.url,
    domain: it.domain,
    title: it.title,
    ceo: lab?.gt ?? null,
    ceoReason: lab?.why ?? null,
    originFixture: "wu-067-blind-review-set.json + wu-068-new-gt.json",
  });
}
/** ⓑ WU-059 GT 의 S1 후보(facts 포함 원문). */
for (const [k, c] of Object.entries(f59.candidates)) {
  if (c.searchId !== "S1") continue;
  historical.push({ url: c.url, domain: c.domain, title: c.title, ceo: c.humanGt ?? null, ceoReason: c.humanReason ?? null, priceStatus: c.priceStatus ?? null, price: c.price ?? null, facts: c.facts ?? null, originFixture: `wu-059-gt-facts.json#${k}` });
}
/** ⓒ originCode 축 GT. */
for (const c of gt112.candidates) {
  if (String(c.originCode).toUpperCase() !== "B226AC010") continue;
  historical.push({ url: c.url, domain: c.domain, ceo: c.verdict ?? null, originFixture: "wu-112-human-gt.json" });
}

/** 🔴 세 그룹을 섞지 않는다(CPO §3). */
const group = (v) => (v === "SAME" ? "CEO-SAME" : v === "DIFFERENT" ? "CEO-DIFFERENT" : v === "UNCERTAIN" ? "CEO-REVIEW" : "라벨없음");
const byUrl = new Map();
for (const h of historical) {
  const k = loose(h.url);
  if (!byUrl.has(k)) byUrl.set(k, { ...h, group: group(h.ceo), sources: [h.originFixture] });
  else {
    const p = byUrl.get(k);
    p.sources.push(h.originFixture);
    if (!p.ceo && h.ceo) { p.ceo = h.ceo; p.group = group(h.ceo); }
  }
}
const histList = [...byUrl.values()];

/* ══════════ ③ 교차표 ══════════ */
const measured = JSON.parse(readFileSync(join(FIX, "cand-02-rows.json"), "utf8")).products.find((p) => p.sid === "S1");
const measuredByUrl = new Map(measured.rows.map((r) => [loose(r.url), r]));
const suppliedSet = new Set(measured.suppliedUrls.map(loose));

const cross = histList.map((h) => {
  const k = loose(h.url);
  const m = measuredByUrl.get(k);
  return {
    url: h.url,
    ceoGroup: h.group,
    ceoVerdict: h.ceo,
    /** 🔴 「현재 Raw」가 아니다 — 현재 Raw 는 확보 불가다. 이것은 **재투입 입력에 있었는가** 다. */
    inReinjectionInput: suppliedSet.has(k),
    crawlReached: Boolean(m),
    identity: m ? (m.tier ?? m.verdict ?? null) : null,
    rows: Boolean(m),
    display: m ? (m.display ?? null) : null,
    price: m ? (m.priced ? `${m.currency} ${m.price}` : m.price != null ? `${m.currency} ${m.price}(집계밖)` : null) : null,
    lostAt: !suppliedSet.has(k) ? "재투입 입력 밖" : !m ? "Crawl/URL 필터" : m.display == null ? "Display(판정 제외)" : null,
  };
});

const summary = {
  _wu: "RAW-CANDIDATE-CROSSCHECK-02",
  _scope: "원상품 B226AC010 (Booty Ghosts Long Sleeve T-Shirt by Bobo Choses)",
  _codeChanges: 0,
  _dbWrites: 0,
  historical: {
    total: histList.length,
    "CEO-SAME": histList.filter((h) => h.group === "CEO-SAME").length,
    "CEO-DIFFERENT": histList.filter((h) => h.group === "CEO-DIFFERENT").length,
    "CEO-REVIEW": histList.filter((h) => h.group === "CEO-REVIEW").length,
    "라벨없음": histList.filter((h) => h.group === "라벨없음").length,
  },
  currentRawSearch: "UNAVAILABLE(§13 STOP)",
  crosscheckBasis: "🔴 「현재 Raw Search」가 아니라 **재투입 실측**(cand-02-rows.json)과 대조했다 — 분모가 다르다",
};

writeFileSync(join(OUT, "RAW-01-current-search.json"), JSON.stringify(current, null, 2));
writeFileSync(join(OUT, "RAW-02-historical-ceo-review.json"), JSON.stringify({ _note: "과거 CEO 육안검토 원본 — fixture 그대로. 새 검색 0 · 요약/삭제 0.", candidates: histList }, null, 2));
writeFileSync(join(OUT, "CROSSCHECK-03-comparison.json"), JSON.stringify({ summary, rows: cross }, null, 2));

console.log(JSON.stringify(summary, null, 1));
console.log("\n=== 교차표 ===");
for (const c of cross) {
  console.log(` ${c.ceoGroup.padEnd(14)} 재투입=${c.inReinjectionInput ? "Y" : "N"} crawl=${c.crawlReached ? "Y" : "N"} id=${String(c.identity ?? "-").padEnd(18)} disp=${String(c.display ?? "X").padEnd(9)} price=${String(c.price ?? "-").padEnd(16)} ${c.lostAt ?? "🟢 통과"}`);
  console.log(`    ${c.url}`);
}
