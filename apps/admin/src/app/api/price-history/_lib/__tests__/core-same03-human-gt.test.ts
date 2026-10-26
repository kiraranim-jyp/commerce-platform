import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSame03Candidates, loadSame03GtRows, same03UrlKey } from "./core-same03-inventory";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-03 — **CEO 판정 10/10 측정**(네트워크 0 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **완화하지 않는다.** 이 파일은 CEO 라벨로 **현재 MI 의 위치를 재기만** 한다 —
 *    BRAND · TITLE · COLOR · threshold · 8축 **전부 변경 0**(§7 ABSOLUTE FREEZE).
 *
 * ── 🔴🔴🔴 가장 먼저 — **이 표본으로 precision 을 측정할 수 없다** ─────────────
 * ```
 * CEO 라벨 — 동일 **5** · 판단불가 **5** · **다른제품 0**
 * ⟹ 「시스템이 SAME 이라 했는데 사람은 다르다고 한」 분모가 **0** 이다.
 * 🔴 그래서 「false SAME 0」을 **정밀도 근거로 쓰지 않는다** — 분모가 없는 0 이다.
 * 🔴 그리고 **이것이 축 완화를 금지하는 이유** 다: WU-063~080 이 여덟 축 전수에서
 *    「완화 = Human DIFFERENT 동반 개방」을 측정했는데, 이 표본에는 그 위험을
 *    **측정할 DIFFERENT 가 없다** ⟹ 완화의 안전성을 **증명할 수 없다.**
 * ```
 *
 * ── 🔴🔴 사유 네 건이 «같은 글자» 였다 ──────────────────────────────────────
 * ```
 * biskuit · donokids · m.luxboy · beaumonde(상세)의 입력 사유가 **글자 그대로 같았다**
 * (biskuit 페이지 텍스트 + 같은 끝문장) ⟹ 그 셋의 「무엇을 보고 판단했는가」는
 * **측정불가** 다. 🟢 ceo 라벨 자체는 유효하다.
 * 🔴 그 사유를 「donokids 상세설명에서 품번을 봤다」로 읽으면 **거짓 근거** 가 된다 —
 *    이 트랙이 반복해서 처벌한 **근거 오귀속** 이다.
 * ```
 */

interface GtRow {
  originCode: string;
  domain: string;
  url: string;
  ceo: string;
  why: string;
  whyHadPastedPageText: boolean;
  whyIsAboutThisCandidate: boolean;
  system: string;
  matchTruth: string | null;
  priceTier: string | null;
  inDomesticReference: boolean;
  blockers: string[];
  conflicts: string[];
  priorVerdicts: string[];
}

const GT = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "core-same03-human-gt.json"), "utf8"),
) as { counts: Record<string, number>; candidates: GtRow[]; _resolvedConflicts: { domain: string; resolvedTo: string }[] };

const rows = GT.candidates;
const same = rows.filter((r) => r.ceo === "동일");
const undecided = rows.filter((r) => r.ceo === "판단불가");
const different = rows.filter((r) => r.ceo === "다른제품");
/** 🔴 **읽기 자체가 안 된 후보** — 이 셋은 「동일성 판정」의 분모가 아니다. */
const UNREAD = new Set(["UNREACHABLE", "REDIRECTED_AWAY", "NOT_PRODUCT_URL", "NO_FACTS"]);

describe("CORE-PRICE-SAME-03 — CEO GT ① 분모를 먼저 적는다", () => {
  it("라벨이 화면 후보와 1:1 이고 원상품이 둘로 갈려 있다", () => {
    expect(rows).toHaveLength(10);
    /** 🔴 라벨이 **인벤토리와 같은 집합** 인지 확인한다(엉뚱한 URL 이 섞이면 측정이 거짓이다). */
    const inventory = new Set(
      (["B226AC009", "B226AC010"] as const).flatMap((code) =>
        buildSame03Candidates(code, loadSame03GtRows()).map((c) => c.urlKey),
      ),
    );
    for (const r of rows) {
      expect(inventory.has(same03UrlKey(r.url)), `🔴 ${r.domain} 은 그 화면의 후보가 아니다`).toBe(true);
    }
    expect(new Set(rows.map((r) => same03UrlKey(r.url))).size, "🔴 URL 중복이 있으면 분모가 부풀려진다").toBe(10);
    expect(rows.filter((r) => r.originCode === "B226AC009")).toHaveLength(5);
    expect(rows.filter((r) => r.originCode === "B226AC010")).toHaveLength(5);
  });

  it("🔴 다른제품이 0 이므로 precision 은 «측정불가» 다", () => {
    expect(same).toHaveLength(5);
    expect(undecided).toHaveLength(5);
    expect(different, "🔴 이 수가 0 인 동안 「false SAME 0」을 정밀도로 쓰지 않는다").toHaveLength(0);
    expect(GT.counts).toEqual({ 동일: 5, 다른제품: 0, 판단불가: 5, total: 10 });
  });

  it("판단불가 5건 중 4건은 «판정이 아니라 읽기 실패» 다", () => {
    const unread = undecided.filter((r) => UNREAD.has(r.system) || r.priceTier === "EXCLUDED");
    /** ⒜ 읽기 실패 3 ⒝ 목록 페이지 1 ⒞ 읽혔지만 이미지로 판단 못 한 것 1 */
    expect(undecided.filter((r) => UNREAD.has(r.system))).toHaveLength(3);
    expect(unread.length).toBeGreaterThanOrEqual(4);
    /** 🔴 읽힌 뒤 CEO 가 「이미지가 없어 못 보겠다」고 한 것은 **하나** 다. */
    const imageBlind = undecided.filter((r) => !UNREAD.has(r.system) && r.why.includes("이미지 판단불가"));
    expect(imageBlind).toHaveLength(1);
    expect(imageBlind[0].domain).toBe("luksusbaby.kr");
  });
});

describe("CORE-PRICE-SAME-03 — CEO GT ② 현재 MI 의 위치", () => {
  it("🟢 오포함 0 — 시스템이 SAME 이라 한 건은 전부 CEO 동일이다", () => {
    const systemSame = rows.filter((r) => r.system === "SAME");
    expect(systemSame).toHaveLength(2);
    expect(systemSame.map((r) => r.domain).sort()).toEqual(["beaumonde.co.kr", "global.trenbe.com"]);
    for (const r of systemSame) expect(r.ceo, `🔴 ${r.domain}`).toBe("동일");
    /** 🔴 단 위 「다른제품 0」 때문에 이것을 **precision 으로 환산하지 않는다**. */
  });

  it("🔴 재현율 — CEO 동일 5 중 시스템 SAME 확정은 2 다", () => {
    const recovered = same.filter((r) => r.system === "SAME");
    expect(recovered).toHaveLength(2);
    const held = same.filter((r) => r.system === "PRESUMED_SAME");
    expect(held).toHaveLength(3);
    expect(held.map((r) => r.domain).sort()).toEqual(["biskuit.kr", "donokids.com", "m.luxboy.com"]);
    /** 🟢 보류 3건은 **버려진 것이 아니다** — tier COMPARISON 으로 가격 축 자격을 갖는다. */
    for (const r of held) expect(r.priceTier).toBe("COMPARISON");
  });

  it("🟢 국내 참고가격에 실제로 들어간 CEO 동일은 2 건이다", () => {
    const priced = same.filter((r) => r.inDomesticReference);
    expect(priced.map((r) => r.domain).sort()).toEqual(["beaumonde.co.kr", "biskuit.kr"]);
    /**
     * 🔴🔴 **나머지 3건이 「국내가 아니다」가 아니다.**
     *    `global.trenbe.com` 은 **USD** 라 해외 축이고(환산 금지),
     *    `donokids` · `m.luxboy` 는 **등록부를 조회할 수 없어** KR 로 확정되지 않았다
     *    ⟹ 그 둘은 **측정불가** 다(운영에서는 KR 일 수 있다).
     */
    const notPriced = same.filter((r) => !r.inDomesticReference);
    expect(notPriced.map((r) => r.domain).sort()).toEqual(["donokids.com", "global.trenbe.com", "m.luxboy.com"]);
  });

  /**
   * 🔴🔴🔴 **CEO 동일을 막는 축이 둘로 수렴한다 — 그리고 그 둘은 FREEZE 다.**
   */
  it("🔴 보류 3건을 막는 축은 BRAND 와 TITLE 뿐이다", () => {
    const held = same.filter((r) => r.system === "PRESUMED_SAME");
    const axes = held.flatMap((r) => r.blockers).sort();
    expect(axes).toEqual(["BRAND_MISMATCH", "BRAND_UNCONFIRMED", "NO_TITLE_OVERLAP", "NO_TITLE_OVERLAP"]);
    /** 🔴 그 밖의 축(COLOR · MATERIAL · FIT · GARMENT_FORM · AUDIENCE_LINE)은 **0** 이다. */
    for (const axis of ["COLOR_VARIANT", "MATERIAL", "FIT", "GARMENT_FORM", "AUDIENCE_LINE"]) {
      expect(axes, `🔴 ${axis} 가 보류 원인이 아니다 — 그 축을 건드릴 근거가 없다`).not.toContain(axis);
    }
    /** 🔴 반증(conflict)으로 막힌 CEO 동일은 **0** 이다 — 반증 축은 이 표본에서 오차단하지 않았다. */
    expect(same.flatMap((r) => r.conflicts)).toEqual([]);
  });

  /**
   * 🟢🟢 **COLOR 반증은 이 표본에서 Human SAME 을 막지 않았다.**
   *
   * `luksusbaby`(t-shirt)가 유일한 COLOR 반증이고 CEO 는 **판단불가** 였다 —
   * 🔴 「동일」이 아니므로 **오차단 증거가 아니다** ⟹ COLOR 완화 근거로 쓰지 않는다.
   */
  it("COLOR 반증 1건은 CEO 동일이 아니다 — 완화 근거가 아니다", () => {
    const colorConflict = rows.filter((r) => r.conflicts.includes("COLOR"));
    expect(colorConflict).toHaveLength(1);
    expect(colorConflict[0].ceo).not.toBe("동일");
    expect(colorConflict[0].ceo).toBe("판단불가");
  });
});

describe("CORE-PRICE-SAME-03 — CEO GT ③ 과거 충돌이 해소됐다", () => {
  it("충돌 2건이 둘 다 «동일» 로 확정됐다", () => {
    const conflicted = rows.filter((r) => r.priorVerdicts.length > 1);
    expect(conflicted).toHaveLength(2);
    expect(conflicted.map((r) => r.domain).sort()).toEqual(["global.trenbe.com", "m.luxboy.com"]);
    for (const r of conflicted) expect(r.ceo, `🔴 ${r.domain}`).toBe("동일");
    expect(GT._resolvedConflicts.every((c) => c.resolvedTo === "동일")).toBe(true);
  });

  /**
   * 🔴🔴 **과거 DIFFERENT 의 원인이 «상품 차이가 아니었다».**
   *
   * CEO 가 `global.trenbe.com` 에 대해 적었다 — 「브랜드·타이틀·품번 다 겹치는데 …
   * **이미지에서 의상 전체가 아닌 캐릭터 부분만 캡쳐** 되어」.
   * ⟹ 🔴 과거 라벨 하나가 **이미지 크롭 때문에** DIFFERENT 였다. 그것은 **GT 결함** 이고
   *    MI 결함이 아니다. 🟢 그 사실을 fixture 에 **원인과 함께** 보존한다.
   */
  it("trenbe 의 과거 DIFFERENT 는 이미지 크롭에 귀속됐다(상품 차이 아님)", () => {
    const trenbe = rows.find((r) => r.domain === "global.trenbe.com")!;
    expect(trenbe.why).toContain("케릭터 부분만 캡쳐");
    expect(trenbe.whyIsAboutThisCandidate).toBe(true);
    const resolved = GT._resolvedConflicts.find((c) => c.domain === "global.trenbe.com")!;
    expect(resolved).toHaveProperty("attributedCause");
  });
});

describe("CORE-PRICE-SAME-03 — CEO GT ④ 사유의 신뢰 범위를 적는다", () => {
  /**
   * 🔴🔴 이 단언이 **발화 단언** 이다 — 복붙이 0 이면 아래 「측정불가」 표기가
   *    죽은 글자가 된다(「변화 0 = 안전」 금지).
   */
  it("사유 네 건이 같은 글자였고, 그 중 셋은 근거 측정불가로 표시됐다", () => {
    const pasted = rows.filter((r) => r.whyHadPastedPageText);
    expect(pasted.length, "🔴 복붙이 0 이면 이 계약이 아무것도 지키지 않는다").toBe(4);
    /** 🟢 같은 글자 네 건이 **한 문장으로 수렴** 한다(그래서 복붙이라고 판정했다). */
    expect(new Set(pasted.map((r) => r.why)).size).toBe(1);
    /** 🔴 그 중 **원본인 biskuit 하나만** 그 후보에 대한 서술로 인정한다. */
    const trusted = pasted.filter((r) => r.whyIsAboutThisCandidate);
    expect(trusted).toHaveLength(1);
    expect(trusted[0].domain).toBe("biskuit.kr");
    const untrusted = pasted.filter((r) => !r.whyIsAboutThisCandidate);
    expect(untrusted.map((r) => r.domain).sort()).toEqual([
      "beaumonde.co.kr",
      "donokids.com",
      "m.luxboy.com",
    ]);
  });

  it("라벨은 전건 유효하다 — 사유 결함을 라벨 결함으로 번지게 하지 않는다", () => {
    for (const r of rows) expect(["동일", "다른제품", "판단불가"]).toContain(r.ceo);
    expect(rows.filter((r) => r.whyIsAboutThisCandidate)).toHaveLength(7);
  });

  it("[측정 기록] 숫자를 같은 자리에서 센다", () => {
    const held = same.filter((r) => r.system === "PRESUMED_SAME");
    console.log(`    CEO 라벨            동일 ${same.length} · 판단불가 ${undecided.length} · 다른제품 ${different.length}`);
    console.log(`    🔴 precision        **측정불가**(다른제품 분모 0)`);
    console.log(`    재현율(SAME 확정)    ${same.filter((r) => r.system === "SAME").length} / ${same.length}`);
    console.log(`    보류(COMPARISON)     ${held.length} — ${held.map((r) => r.domain).join(" · ")}`);
    console.log(`    국내 참고가격 진입    ${same.filter((r) => r.inDomesticReference).length} / ${same.length}`);
    console.log(`    오포함(system SAME 중 CEO 비동일)  ${rows.filter((r) => r.system === "SAME" && r.ceo !== "동일").length}`);
    console.log(`    막는 축              ${held.flatMap((r) => r.blockers).sort().join(" · ")}`);
    console.log(`    판단불가 사유         읽기 실패 ${undecided.filter((r) => UNREAD.has(r.system)).length} · 목록 1 · 이미지 1`);
    console.log(`    사유 근거 측정불가     ${rows.filter((r) => !r.whyIsAboutThisCandidate).length} / ${rows.length}`);
  });
});
