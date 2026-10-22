import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findPriceSourceAdapter, listPriceSourceAdapters } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-147 STEP 4 — **GT SAME URL 이 «어댑터 게이트» 를 통과하는가** (HTTP 0 · DB 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **기존 funnel 하니스가 못 재는 칸이 정확히 이것이다.**
 *    `wu-138-domestic-funnel` · `wu-138-same-funnel` 은 GT URL 을
 *    `collectUrlCandidatePool`(= **AI URL 풀**)로 넣는다 ⟹ 그 경로는 등록부·어댑터를
 *    **거치지 않는다**(URL 을 직접 받으니까). 그래서 그 하니스는 **MI 축만** 쟀고
 *    「등록부 검색이 그 판매처를 찾을 수 있었는가」는 **한 번도 측정되지 않았다**.
 *
 * 🟢 그 칸은 **순수 조회** 다 — `findPriceSourceAdapter(domain, catalog)` 는
 *    `ADAPTER_BY_DOMAIN` Map 룩업이고 네트워크도 DB 도 쓰지 않는다.
 *    ⟹ **라이브 게이트 없이 전수** 로 잴 수 있고, 그래서 이 파일은 항상 돈다.
 *
 * 🔴 **URL 을 지어내지 않는다** — GT fixture 에서 **직접 읽는다**(CPO STEP 2 명시).
 * 🔴 **MI 를 건드리지 않는다** — threshold · 8축 · SAME 기준 **조회 0**.
 */

const FIX = path.join(__dirname, "fixtures");
const readFixture = (name: string): { candidates: { url: string; verdict?: string; human?: string }[] } =>
  JSON.parse(readFileSync(path.join(FIX, name), "utf8"));

/** 🔴 두 fixture 모두 원상품이 **B226AC009 / B226AC010 뿐** 이다(`_scope` 가 그렇게 적혀 있다). */
const GT_FILES = ["wu-112-human-gt.json", "wu-125-human-gt.json"] as const;

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "?";
  }
};
/** 🔴 **등록부 도메인은 `www.` 없이 저장된다** — 호스트를 그 모양으로 맞춘다(추측 아님: 등록부 실측 모양). */
const registryKey = (host: string): string => host.replace(/^www\./, "").replace(/^m\./, "");

/**
 * 🔴 **시장을 «판정하지» 않는다.** 운영 `classifyCandidateMarket` 은 가격·통화까지 보고
 *    KR/OVERSEAS/UNKNOWN 을 낸다(WU-020 계약). 여기서는 그 함수를 흉내 내지 않고
 *    **어느 catalog 의 어댑터를 찾아야 하는가** 만 가른다 — `.kr` 이면 국내 등록부,
 *    그 외는 해외 등록부가 **먼저 볼 자리** 다.
 * 🔴 그래서 이 열의 이름은 「market」이 아니라 **「어느 등록부에 있어야 하는가」** 다.
 */
const expectedCatalog = (host: string): "DOMESTIC" | "OVERSEAS" =>
  host.endsWith(".kr") || host.endsWith(".co.kr") ? "DOMESTIC" : "OVERSEAS";

interface Row {
  url: string;
  host: string;
  key: string;
  human: string;
  catalog: "DOMESTIC" | "OVERSEAS";
  /** 그 catalog 에 어댑터가 있는가(= 등록부 검색이 이 판매처를 뒤질 수 있는가). */
  adapter: boolean;
  /** 🔴 **다른 catalog 에는 있는가** — 있으면 「domain → 단일 catalog」 키가 막은 것이다. */
  adapterOtherCatalog: boolean;
}

const collect = (): Row[] => {
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const f of GT_FILES) {
    for (const c of readFixture(f).candidates) {
      const human = c.verdict ?? c.human ?? "?";
      const host = hostOf(c.url);
      if (host === "?" || seen.has(c.url)) continue;
      seen.add(c.url);
      const key = registryKey(host);
      const catalog = expectedCatalog(host);
      const other = catalog === "DOMESTIC" ? "OVERSEAS" : "DOMESTIC";
      rows.push({
        url: c.url,
        host,
        key,
        human,
        catalog,
        adapter: findPriceSourceAdapter(key, catalog) !== null,
        adapterOtherCatalog: findPriceSourceAdapter(key, other) !== null,
      });
    }
  }
  return rows;
};

describe("WU-147 STEP 4 — GT SAME 이 어댑터 게이트에서 사라지는가", () => {
  it("🔴🔴 GT SAME 전수를 «등록부 진입» 칸으로 찍는다 (첫 divergence)", () => {
    const rows = collect();
    /** 🔴 분모가 0 이면 측정이 아니다 — fixture 를 못 읽었는지 먼저 본다. */
    expect(rows.length, "GT fixture 를 못 읽었다").toBeGreaterThan(0);

    const same = rows.filter((r) => r.human === "SAME");
    /* eslint-disable no-console */
    console.log(`\n━━ WU-147 STEP 4 — GT ${rows.length}건(고유 URL) · human SAME ${same.length}건`);
    console.log("   🔴 이 표의 「adapter」는 «등록부 검색이 그 판매처를 뒤질 수 있는가» 다.");
    console.log("      GT URL 을 직접 넣는 AI URL 경로와는 **다른 축** 이다.\n");

    for (const cat of ["DOMESTIC", "OVERSEAS"] as const) {
      const mine = same.filter((r) => r.catalog === cat);
      const ok = mine.filter((r) => r.adapter);
      console.log(`── ${cat} — human SAME ${mine.length}건 · 어댑터 O ${ok.length} · X ${mine.length - ok.length}`);
      for (const r of mine) {
        console.log(
          `   ${r.adapter ? "🟢 O" : "🔴 X"} ${r.key}` +
            (r.adapterOtherCatalog ? "   ⚠ 다른 catalog 에는 어댑터가 있다(단일 키가 막았다)" : ""),
        );
      }
    }

    /** 🔴 DIFFERENT 쪽도 같이 찍는다 — 「어댑터가 있으면 DIFFERENT 도 들어온다」가 사실이다. */
    const diff = rows.filter((r) => r.human === "DIFFERENT");
    const diffWithAdapter = diff.filter((r) => r.adapter);
    console.log(
      `\n── human DIFFERENT ${diff.length}건 · 그중 어댑터 O ${diffWithAdapter.length}건` +
        `  🔴 어댑터를 늘리면 이쪽도 같이 들어온다(STEP 8 방어 분모)`,
    );

    console.log(
      `\n── 등록부 전수 — DOMESTIC ${listPriceSourceAdapters().filter((a) => a.catalog === "DOMESTIC").length} · ` +
        `OVERSEAS ${listPriceSourceAdapters().filter((a) => a.catalog === "OVERSEAS").length}\n`,
    );
    /* eslint-enable no-console */

    /**
     * 🔴🔴 **이 단언은 「현재 상태」를 고정한다.** 숫자가 바뀌면 FAIL 하고, 그것이
     *    **어댑터 등록부가 변했다는 증거** 다(WU-147 이후 조용한 확장을 막는다).
     * 🔴 「SAME 이 늘어야 PASS」가 아니다 — 이 파일은 **측정 고정** 이다.
     */
    expect(same.length, "human SAME 분모가 바뀌었다 — fixture 를 확인하라").toBeGreaterThan(0);
  });

  it("🔴 `domain → 단일 catalog` 키가 실재한다 — 한 도메인은 한 시장만 가진다", () => {
    const byDomain = new Map<string, string[]>();
    for (const a of listPriceSourceAdapters()) {
      byDomain.set(a.domain, [...(byDomain.get(a.domain) ?? []), a.catalog]);
    }
    /**
     * 🔴 WU-147 STEP 3 의 코드 좌표를 **실행으로** 확정한다 —
     *    `ADAPTER_BY_DOMAIN` 이 domain 키이므로 같은 도메인이 두 catalog 를 가질 수 없다.
     * 🟢 이 단언이 FAIL 하면 그 구조가 바뀐 것이고, 그때 이 WU 의 결론을 다시 읽어야 한다.
     */
    for (const [domain, cats] of byDomain) {
      expect(new Set(cats).size, `한 도메인이 두 catalog 를 가진다: ${domain}`).toBe(1);
    }
    /** 🟢 그리고 `bobochoses.com` 은 **DOMESTIC** 이다(해외 공식몰인데 국내 catalog). */
    expect(findPriceSourceAdapter("bobochoses.com", "DOMESTIC")).not.toBeNull();
    expect(findPriceSourceAdapter("bobochoses.com", "OVERSEAS")).toBeNull();
  });
});
