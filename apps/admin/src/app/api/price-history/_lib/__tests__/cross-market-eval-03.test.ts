import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-P0-CROSS-MARKET-COMPLETION-03 — **기존 GT × 기존 운영 산출 조인**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 새 GT **0** · 새 수집 **0** · HTTP **0** · DB **0** · 라벨 변경 **0** · 정책 **0**.
 *
 * ── 🔴🔴 조인에서 두 번 틀렸고 둘 다 남긴다 ──────────────────────────────
 * ```
 * ⒜ `system_verdict ?? v` 로 읽었다 ⟹ `v` 는 **사람 판정** 이라 10/10 이 «완전 일치» 로
 *    나왔다. 🔴 그대로 보고했으면 **「정확도 100%」라는 동어반복 거짓** 이었다.
 *    🟢 `system_verdict` **만** 쓴다(사람 판정으로 폴백 금지).
 * ⒝ `source === "GT_IMPORT"` 로 거르려 했다 ⟹ 🔴 `source` 는 **provenance 가 아니다**
 *    (기본값 라벨이 섞인다). 🟢 **시스템 칸이 실재하는가**(`system_verdict != null`)로 거른다.
 * ```
 *
 * ── 🔴 조인 가능 범위(지시 §5 — 숨기지 않는다) ───────────────────────────
 * ```
 * 조인 키   **정규화 URL 하나**(host 소문자·`www.` 제거·끝 슬래시 제거)
 * 🔴 domain 조인은 **쓰지 않았다** — wu-112 도메인 × 운영 덤프에서 **1:1 이 0건** 이다
 *    (junioredition 62행 · global.trenbe 2행 ⟹ 어느 행에 붙일지 알 수 없다 · 지어내지 않는다)
 * 운영 덤프  `dsp-01-reviewed-same` · `ceo-evidence-review-db` · `ux04-b3-reviews` = **45행**
 *            그중 **운영 판정이 실재하는 행 19**
 * 🔴 `brand-conflict-price-real`(159행)은 **URL 칸이 없어** 조인 대상에서 빠졌다
 * 결과      human GT **39행** 중 운영 판정과 연결 **6**(고유 URL 기준)
 * ```
 */

const FIX = (f: string) => path.join(__dirname, "fixtures", f);
const read = <T>(f: string): T => JSON.parse(readFileSync(FIX(f), "utf8")) as T;

interface EvalRow {
  gtFile: string;
  url: string;
  domain: string;
  human: string;
  system_verdict: string;
  match_truth: string | null;
  price_tier: string | null;
  market: string | null;
  price_amount: number | null;
  price_currency: string | null;
  blockers: string[] | null;
  source: string | null;
}

const rows = (): EvalRow[] => read<{ rows: EvalRow[] }>("cross-market-eval-03.json").rows;
/** 🔴 **도메인으로 시장을 판정하지 않는다** — 표본을 가르는 라벨일 뿐이다. */
const isKrDomain = (d: string): boolean => d.endsWith(".kr");

describe("CROSS-MARKET-EVAL-03 — GT × 운영 산출 조인 측정", () => {
  /* ── A. 조인 결과와 «연결 실패» 를 같이 적는다 ─────────────────────────── */

  it("A-0 🔴 조인 성공 6 · 실패 33 — 숨기지 않는다", () => {
    const r = rows();
    expect(r, "🟢 연결 6(고유 URL)").toHaveLength(6);
    /** 🔴 전건에 운영 판정이 실재한다(사람 판정으로 폴백하지 않았다는 증거). */
    for (const x of r) {
      expect(x.system_verdict, `🔴 ${x.domain} 운영 판정 없음`).toBeTruthy();
      expect(x.human, `🔴 ${x.domain} 사람 라벨 없음`).toBeTruthy();
      /** 🔴🔴 동어반복 방지 — 두 칸이 **다른 어휘 체계** 여야 한다. */
      expect(["SAME", "DIFFERENT", "UNCERTAIN", "동일", "다른제품", "판단불가"]).toContain(x.human);
    }
    /** 🔴 분모 — human GT 39 중 33 은 **연결되지 않았다**. */
    const gtTotal = 27 + 9 + 2 + 1; // wu-112 · wu-125 · wu-111 · wu-116
    expect(gtTotal).toBe(39);
    console.log(`\n═══ A-0 조인 ═══`);
    console.log(`    human GT **39** × 운영 판정 실재 **19** → 연결 **${r.length}** · 🔴 미연결 **${gtTotal - r.length}**`);
    console.log(`    🔴 조인 키는 정규화 URL 하나 · domain 조인은 1:1 이 0건이라 쓰지 않았다`);
    console.log(`    🔴 brand-conflict-price-real(159행)은 **URL 칸이 없어** 조인 불가`);
  });

  it("A-1 🔴🔴 **처음으로 human DIFFERENT 가 포함된 운영 결과 자료다**", () => {
    const r = rows();
    const same = r.filter((x) => x.human === "SAME");
    const diff = r.filter((x) => x.human === "DIFFERENT");
    expect(same, "🟢 human SAME 4").toHaveLength(4);
    /** 🟢🟢 §0-XM02 가 「오탐 분모 0」으로 닫았던 그 구멍이 **이 자료로 열린다**. */
    expect(diff, "🟢🟢 human DIFFERENT 2 — 오탐 분모가 생겼다").toHaveLength(2);
  });

  /* ── B. 🟢 측정 — 분자/분모를 같이 적는다 ──────────────────────────────── */

  it("B-1 🔴 SAME 오탐 2/6 · precision 4/6 — 분모 6 을 같이 적는다", () => {
    const r = rows();
    /** 🟢 운영이 「확정 SAME」이라 한 행. */
    const sysSame = r.filter((x) => x.system_verdict === "SAME");
    const falseSame = sysSame.filter((x) => x.human === "DIFFERENT");
    expect(sysSame, "🟢 시스템 SAME 4").toHaveLength(4);
    /** 🟢🟢 **확정 SAME 중 오탐 0** — 틀린 것을 SAME 이라 한 적이 없다. */
    expect(falseSame, "🟢 확정 SAME 오탐 0").toHaveLength(0);

    /** 🔴 보류(PRESUMED_SAME)는 **별도로** 센다 — 확정과 합치지 않는다. */
    const presumed = r.filter((x) => x.system_verdict === "PRESUMED_SAME");
    expect(presumed, "🟡 보류 2").toHaveLength(2);
    /** 🔴🔴 그 **보류 2건이 «둘 다» human DIFFERENT** 다 — WU-123/125 패턴의 재현. */
    expect(presumed.filter((x) => x.human === "DIFFERENT"), "🔴 보류 2/2 가 다른 상품").toHaveLength(2);

    console.log(`\n═══ B-1 정밀도(분모 ${r.length}) ═══`);
    console.log(`    확정 SAME **${sysSame.length}** → human SAME ${sysSame.filter((x) => x.human === "SAME").length} · 오탐 **${falseSame.length}**`);
    console.log(`    보류 PRESUMED **${presumed.length}** → human DIFFERENT **${presumed.filter((x) => x.human === "DIFFERENT").length}**`);
    console.log(`    🔴 확정과 보류를 합치지 않는다 — 합치면 「정확도 4/6」이라는 다른 사실이 된다`);
  });

  it("B-2 🟢 human SAME 회수율 4/4 — 놓친 동일상품 0", () => {
    const r = rows();
    const humanSame = r.filter((x) => x.human === "SAME");
    const recovered = humanSame.filter((x) => x.system_verdict === "SAME");
    expect(humanSame, "🔴 분모 4").toHaveLength(4);
    expect(recovered, "🟢 회수 4").toHaveLength(4);
    console.log(`\n═══ B-2 회수율 ═══\n    human SAME ${recovered.length}/${humanSame.length} 이 확정 SAME 으로 올라왔다(놓친 동일상품 0)`);
  });

  it("B-3 🔴 가격 참고 축 도달 1/6 — 나머지는 그 칸이 «비어 있다»", () => {
    const r = rows();
    const priced = r.filter((x) => x.price_tier === "EXACT" || x.price_tier === "COMPARISON");
    expect(priced, "🔴 도달 1").toHaveLength(1);
    expect(priced[0].domain).toBe("global.trenbe.com");
    expect(priced[0].price_tier).toBe("EXACT");
    /** 🔴 나머지 5는 `price_tier` 가 **null** 이다 — 「제외됐다」가 아니라 **기록이 없다**. */
    expect(r.filter((x) => x.price_tier === null), "🔴 tier 칸이 빈 행 5").toHaveLength(5);
    console.log(`\n═══ B-3 가격 축 ═══\n    도달 ${priced.length}/${r.length} · 🔴 tier 칸이 **비어 있는** 행 5(제외가 아니다)`);
  });

  it("B-4 🔴 시장 분류 — 기록된 행이 1/6 뿐이다(분포를 말할 수 없다)", () => {
    const r = rows();
    const withMarket = r.filter((x) => x.market !== null);
    expect(withMarket, "🔴 market 칸 보유 1").toHaveLength(1);
    expect(withMarket[0].market).toBe("OVERSEAS");
    /** 🔴 **「null 을 UNKNOWN 으로 읽지 않는다」** — 그 칸이 비어 있는 것이다. */
    expect(r.filter((x) => x.market === null), "🔴 칸이 빈 행 5").toHaveLength(5);
    console.log(`\n═══ B-4 시장 분류 ═══\n    기록 ${withMarket.length}/${r.length}(OVERSEAS 1) · 🔴 나머지 5는 **칸이 비어 있다**(UNKNOWN 이 아니다)`);
  });

  it("B-5 🔴🔴 국내 표본이 «0» 이다 — 국내 지표를 이 자료로 만들지 않는다", () => {
    const r = rows();
    const kr = r.filter((x) => isKrDomain(x.domain));
    expect(kr, "🔴 .kr 도메인 0").toHaveLength(0);
    /**
     * 🔴 그래서 **국내 오탐·국내 회수율을 이 자료로 내지 않는다.**
     * 🟢 국내 측정은 `core-same03`(§0-XM02)이 유일하고 그쪽은 **DIFFERENT 가 0** 이다
     *    ⟹ 🔴 **국내 오탐은 여전히 어느 자료로도 측정 불가** 다.
     */
    console.log(`\n═══ B-5 국내 ═══\n    🔴 이 자료의 .kr 표본 **0** ⟹ 국내 오탐·회수율 **측정 불가**`);
    console.log(`    🟢 국내 측정 자료는 core-same03(§0-XM02) 하나이고 그쪽은 DIFFERENT 가 0 이다`);
  });

  /* ── C. 🔴 측정 불가를 계약으로 못 박는다 ──────────────────────────────── */

  it("C-1 🔴 후보 탐색률은 이 자료로 측정 불가 — 발견 단계 분모가 없다", () => {
    const r = rows();
    /** 🔴 전건이 **이미 후보가 된 뒤** 의 행이다(검색 요청 수·발견 수가 없다). */
    expect(r.every((x) => typeof x.url === "string" && x.url.length > 0)).toBe(true);
    expect(r.every((x) => x.system_verdict !== null)).toBe(true);
    console.log(`\n═══ C-1 측정 불가(🔴 0% 로 적지 않는다) ═══`);
    console.log(`    ① 후보 탐색률 — 발견 단계 분모 없음(이 자료는 후보가 된 뒤를 담는다)`);
    console.log(`    ② 국내 오탐·회수율 — 이 자료의 .kr 표본 0 · core-same03 은 DIFFERENT 0`);
    console.log(`    ③ 시장 분포 — market 칸 보유 1/6`);
    console.log(`    🔵 필요한 원천 — **국내 후보를 포함하고 market·tier 칸이 채워진, DIFFERENT 를 가진 운영 판정 자료**`);
  });
});
