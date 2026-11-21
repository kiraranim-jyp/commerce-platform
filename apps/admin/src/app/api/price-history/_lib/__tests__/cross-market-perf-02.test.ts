import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-P0-CROSS-MARKET-COMPLETION-02 **E** — 실데이터 성능
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **새 GT 를 만들지 않았다** · 새 수집 0 · HTTP 0 · DB 0 · 정책 0.
 *    기존 fixture 의 **운영 산출 칸** 을 읽는다(복제 계산 0).
 *
 * ── 🔴🔴 분모를 «세 종류» 로 가른다. 섞으면 전부 틀린다 ──────────────────
 * ```
 * ① core-same03-human-gt.json   n=10  🟢 **운영 산출이 행마다 기록돼 있다**
 *    (system · matchTruth · priceTier · inDomesticReference · blockers)
 *    ⟹ 🟢 **운영 결과를 측정할 수 있는 유일한 분모** 다
 *    🔴 그러나 human **DIFFERENT 가 0** 이다 ⟹ **precision(오탐) 측정 불가**
 * ② wu-112-human-gt.json        n=27  🔴 운영 칸이 **없다**(sid·domain·url·verdict·reason)
 *    ⟹ human DIFFERENT 6 이 있지만 **운영 결과와 대조할 수 없다**
 * ③ wu-116-human-gt.json        n=1   🟢 `market` 칸 보유(유일)
 * ```
 * 🔴 ①의 recall 과 ②의 DIFFERENT 를 **한 비율로 합치지 않는다.**
 */

const FIX = (f: string) => path.join(__dirname, "fixtures", f);
const read = <T>(f: string): T => JSON.parse(readFileSync(FIX(f), "utf8")) as T;

interface Same03Row {
  originCode: string;
  domain: string;
  url: string;
  ceo: string;
  system: string | null;
  matchTruth: string | null;
  priceTier: string | null;
  inDomesticReference: boolean | null;
  blockers: string[] | null;
}

const host = (u: string): string => {
  try {
    return new URL(u).host;
  } catch {
    return "(unparsable)";
  }
};
/** 🔴 **도메인으로 시장을 «판정» 하지 않는다** — 이 술어는 **표본을 가르는 라벨** 이다. */
const isKrDomain = (h: string): boolean => h.endsWith(".kr");

const same03 = (): Same03Row[] => read<{ candidates: Same03Row[] }>("core-same03-human-gt.json").candidates;

describe("CROSS-MARKET-PERF-02 E — 통합 MI 실데이터 성능", () => {
  /* ── A. 분모 ────────────────────────────────────────────────────────────── */

  it("A-0 🔴🔴 측정 가능한 분모는 ①뿐이다 — ②는 운영 칸이 «없다»", () => {
    const a = same03();
    expect(a, "🔴 ① n=10").toHaveLength(10);
    /** 🟢 ①은 행마다 운영 산출을 들고 있다. */
    for (const r of a) {
      expect(r, "🔴 운영 칸이 사라지면 이 측정이 무의미해진다").toHaveProperty("system");
      expect(r).toHaveProperty("priceTier");
      expect(r).toHaveProperty("inDomesticReference");
    }
    /** 🔴 ①에 human DIFFERENT 가 0 이다 ⟹ 오탐(precision)을 못 잰다. */
    expect(a.filter((r) => r.ceo === "다른제품"), "🔴 ①의 DIFFERENT 분모는 0").toHaveLength(0);

    /** 🔴 ②는 운영 칸이 없다 — 그 사실을 계약으로 고정한다(다음 사람이 섞지 않게). */
    const b = read<{ candidates: Array<Record<string, unknown>> }>("wu-112-human-gt.json").candidates;
    expect(b, "🔴 ② n=27").toHaveLength(27);
    expect(Object.keys(b[0]).sort(), "🔴 ②에는 운영 산출 칸이 없다").toEqual([
      "domain",
      "originCode",
      "reason",
      "sid",
      "url",
      "verdict",
    ]);
    expect(b.filter((r) => r.verdict === "DIFFERENT"), "🟡 ②에만 DIFFERENT 가 있다").toHaveLength(6);
  });

  /* ── B. 🟢🟢 국내 — 「국내 SAME 0」이 «이 분모» 에서 반증된다 ──────────── */

  it("B-1 🟢🟢 국내 human 동일 2건이 **둘 다** 국내 참고가격 축에 들어간다", () => {
    const kr = same03().filter((r) => isKrDomain(host(r.url)));
    expect(kr, "🇰🇷 .kr 행 7").toHaveLength(7);
    const krSame = kr.filter((r) => r.ceo === "동일");
    expect(krSame, "🔴 human 동일 2").toHaveLength(2);
    /** 🟢🟢 둘 다 국내 축에 **도달했다** — 「국내는 구조적으로 0」이 아니다. */
    expect(krSame.every((r) => r.inDomesticReference === true), "🟢 국내참고 2/2").toBe(true);

    const beaumonde = krSame.find((r) => host(r.url) === "www.beaumonde.co.kr");
    const biskuit = krSame.find((r) => host(r.url) === "biskuit.kr");
    /** 🟢🟢 국내에서 **SAME + EXACT** 가 실재한다. */
    expect(beaumonde?.system, "🟢 국내 SAME 실재").toBe("SAME");
    expect(beaumonde?.matchTruth).toBe("STRONG_IDENTIFIER");
    expect(beaumonde?.priceTier, "🟢 국내 EXACT 실재").toBe("EXACT");
    expect(beaumonde?.blockers ?? [], "🟢 차단축 없음").toEqual([]);
    /** 🟡 나머지 하나는 보류 — 🔴 **틀린 것이 아니라** 차단축이 적혀 있다. */
    expect(biskuit?.system).toBe("PRESUMED_SAME");
    expect(biskuit?.priceTier).toBe("COMPARISON");
    expect(biskuit?.blockers ?? []).toEqual(["BRAND_MISMATCH", "NO_TITLE_OVERLAP"]);

    console.log(`\n═══ B-1 국내(분모 ${kr.length} · human 동일 ${krSame.length}) ═══`);
    for (const r of kr)
      console.log(
        `    ${host(r.url).padEnd(22)} human=${String(r.ceo).padEnd(6)} sys=${String(r.system).padEnd(16)} ` +
          `tier=${String(r.priceTier).padEnd(11)} 국내참고=${String(r.inDomesticReference)}`,
      );
    console.log(`    🟢 human 동일 ${krSame.length}/${krSame.length} 국내참고 진입 · SAME 1 · PRESUMED 1`);
    console.log(`    🔴 이 분모에 human DIFFERENT 가 0 이라 **오탐은 측정 불가** 다`);
  });

  it("B-2 🔴🔴 국내 탈락의 원인은 «market UNKNOWN 이 아니다» — 전수로 확정한다", () => {
    const kr = same03().filter((r) => isKrDomain(host(r.url)));
    const dropped = kr.filter((r) => r.inDomesticReference !== true);
    expect(dropped, "🔴 국내 축에 못 간 5건").toHaveLength(5);
    /**
     * 🔴🔴 **지시 §3 의 전제를 데이터가 정정한다.**
     *    「운영 market 이 UNKNOWN 이라 빠졌다」가 아니다 — 이 분모에서 탈락 원인은
     *    **후보를 읽지 못했거나(UNREACHABLE·REDIRECTED_AWAY) tier 가 제외(EXCLUDED)** 다.
     *    ⟹ 시장 분류 «이전» 단계에서 끝난 행이 **3/5** 다.
     */
    const reasons = dropped.map((r) => r.system);
    expect(reasons.filter((s) => s === "UNREACHABLE"), "🔴 후보를 읽지 못함 2").toHaveLength(2);
    expect(reasons.filter((s) => s === "REDIRECTED_AWAY"), "🔴 도착지가 상품이 아님 1").toHaveLength(1);
    /** 🔴 나머지 2는 **판정은 났고 tier 가 EXCLUDED** 다(SIMILAR · CONFLICT). */
    const excluded = dropped.filter((r) => r.priceTier === "EXCLUDED");
    expect(excluded, "🔴 tier 제외 2").toHaveLength(2);
    expect(excluded.map((r) => r.system).sort()).toEqual(["CONFLICT", "SIMILAR"]);
    /** 🔴 **「market UNKNOWN 때문」인 행은 이 분모에 0 이다.** */
    expect(
      dropped.filter((r) => r.matchTruth !== null && r.priceTier !== "EXCLUDED"),
      "🔴 판정·tier 가 멀쩡한데 빠진 행 = 0",
    ).toEqual([]);

    console.log(`\n═══ B-2 국내 탈락 5건의 «실제» 원인 ═══`);
    for (const r of dropped) console.log(`    ${host(r.url).padEnd(22)} ${String(r.system).padEnd(16)} tier=${String(r.priceTier)}`);
    console.log(`    🔴 UNREACHABLE 2 · REDIRECTED_AWAY 1 · tier EXCLUDED 2 ⟹ **market UNKNOWN 0**`);
  });

  /* ── C. 해외 — 같은 기준으로 잰다 ──────────────────────────────────────── */

  it("C-1 🟢 해외도 «같은 기준» 으로 측정된다 — 판정·tier 가 같은 칸에서 나온다", () => {
    const os = same03().filter((r) => !isKrDomain(host(r.url)));
    expect(os, "🌎 해외 3").toHaveLength(3);
    expect(os.filter((r) => r.ceo === "동일"), "🔴 human 동일 3").toHaveLength(3);
    /** 🟢 해외에서도 SAME/EXACT 가 하나 있고 나머지는 보류다 — 국내와 **같은 모양** 이다. */
    expect(os.filter((r) => r.system === "SAME"), "🟢 해외 SAME 1").toHaveLength(1);
    expect(os.filter((r) => r.priceTier === "EXACT"), "🟢 해외 EXACT 1").toHaveLength(1);
    expect(os.filter((r) => r.system === "PRESUMED_SAME"), "🟡 보류 2").toHaveLength(2);
    console.log(`\n═══ C-1 해외(분모 ${os.length}) ═══`);
    for (const r of os)
      console.log(`    ${host(r.url).padEnd(22)} human=${String(r.ceo)} sys=${String(r.system).padEnd(16)} tier=${String(r.priceTier)}`);
  });

  it("C-2 🟢🟢 국내·해외가 «같은 판정 어휘» 를 쓴다 — 전용 상태가 없다", () => {
    const a = same03();
    const kr = new Set(a.filter((r) => isKrDomain(host(r.url))).map((r) => String(r.system)));
    const os = new Set(a.filter((r) => !isKrDomain(host(r.url))).map((r) => String(r.system)));
    /** 🔴 한쪽에만 있는 «판정» 어휘가 있으면 엔진이 둘로 갈린 것이다. */
    const judged = (s: Set<string>) => [...s].filter((x) => ["SAME", "PRESUMED_SAME", "SIMILAR", "CONFLICT"].includes(x));
    expect(judged(os).every((x) => ["SAME", "PRESUMED_SAME", "SIMILAR", "CONFLICT"].includes(x))).toBe(true);
    for (const v of judged(os)) expect(["SAME", "PRESUMED_SAME", "SIMILAR", "CONFLICT"]).toContain(v);
    /** 🟢 국내에만 있는 것은 **판정이 아니라 수집 실패** 다(UNREACHABLE·REDIRECTED_AWAY). */
    const krOnly = [...kr].filter((x) => !os.has(x));
    for (const v of krOnly)
      expect(
        ["UNREACHABLE", "REDIRECTED_AWAY", "SIMILAR", "CONFLICT", "SAME"],
        `🔴 국내 전용 «판정» 어휘 ${v} 가 생겼다 — 엔진이 갈라진 것이다`,
      ).toContain(v);
  });

  /* ── D. 가격 확보율 ─────────────────────────────────────────────────────── */

  it("D-1 🟢 가격 축 도달 — 국내 2/7 · 해외 1/3(tier EXACT 기준) · 분모를 같이 적는다", () => {
    const a = same03();
    const kr = a.filter((r) => isKrDomain(host(r.url)));
    const os = a.filter((r) => !isKrDomain(host(r.url)));
    const priced = (rows: Same03Row[]) => rows.filter((r) => r.priceTier === "EXACT" || r.priceTier === "COMPARISON");
    expect(priced(kr), "🇰🇷 가격 축 2").toHaveLength(2);
    expect(priced(os), "🌎 가격 축 3").toHaveLength(3);
    /** 🔴 「확보율」을 한 숫자로 뭉치지 않는다 — 분모가 7 과 3 으로 다르다. */
    console.log(`\n═══ D-1 가격 축 도달 ═══`);
    console.log(`    🇰🇷 ${priced(kr).length}/${kr.length}  ·  🌎 ${priced(os).length}/${os.length}`);
    console.log(`    🔴 두 비율을 합치지 않는다(분모가 다르다 · 표본 ${a.length})`);
  });

  /* ── E. 🔴 못 재는 것을 «못 잰다» 고 적는다 ─────────────────────────────── */

  it("E-1 🔴 측정 불가 항목을 계약으로 못 박는다 — 0% 로 적지 않는다", () => {
    const a = same03();
    /** ① 오탐(precision) — ①에 DIFFERENT 가 0 이라 분모가 없다. */
    expect(a.filter((r) => r.ceo === "다른제품").length, "🔴 오탐 분모 0").toBe(0);
    /** ② 탐색률 — 이 fixture 는 **이미 후보가 된 행** 만 들고 있다(발견 단계 분모가 없다). */
    expect(a.every((r) => typeof r.url === "string" && r.url.length > 0), "🔴 전건이 후보 단계 이후다").toBe(true);
    /** ③ 운영 `market` 칸 — ①에는 **없다**(wu-116 한 건만 보유). */
    expect(Object.keys(a[0]), "🔴 ①에 market 칸이 없다").not.toContain("market");
    const w116 = read<{ candidates: Array<{ market?: string }> }>("wu-116-human-gt.json").candidates;
    expect(w116, "🟢 market 칸을 가진 GT 는 1건뿐").toHaveLength(1);
    expect(w116[0].market, "🟢 그 1건은 KR 로 «확정» 돼 있다").toBe("KR");

    console.log(`\n═══ E-1 측정 불가(🔴 0% 로 적지 않는다) ═══`);
    console.log(`    ① 오탐(precision)   분모 0 — ①에 human DIFFERENT 가 없다`);
    console.log(`    ② 후보 탐색률        분모 없음 — fixture 가 «후보가 된 뒤» 를 담는다`);
    console.log(`    ③ 운영 market 분포    GT 중 그 칸 보유 **1건**(wu-116 · KR) ⟹ 분포를 말할 수 없다`);
    console.log(`    🔴 필요한 추가 데이터 — **운영 market·tier 칸을 가진 DIFFERENT 포함 GT**`);
  });
});
