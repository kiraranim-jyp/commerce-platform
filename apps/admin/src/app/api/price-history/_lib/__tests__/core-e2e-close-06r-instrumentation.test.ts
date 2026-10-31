import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CLOSE-06R — **계측은 제품 동작을 바꾸지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §2 가 변경을 금지한 축 전수 — Search provider · Query · retry/variation/split ·
 *    Registry · adapter · threshold · matchTruth · priceTier · 가격정책 · UI ·
 *    「다시 분석」 · HIDDEN. 🟢 더한 것은 **읽기 전용 `console.log` 한 블록** 이다.
 *
 * 🔴🔴 **왜 로그가 필요했나**(조사로 확정했다):
 * ```
 * 배포 코드로 채울 수 있던 칸   Search(query·searches·organic) · pool(supplied·usable)
 * 🔴 채울 수 없던 칸            국내/해외 **분리** · SAME/PRESUMED 분포 · 가격 확인 수
 * 🔴 DB 로 보완 불가            `seen` 이 **세 생산자만** 담는다(WEB_SEARCH ·
 *                              DOMESTIC_LISTING **빠짐**) + 079 `source` CHECK 가
 *                              그 값을 **금지** 한다 ⟹ migration 없이는 못 남기고
 *                              다른 값으로 적으면 **데이터가 거짓** 이 된다
 * ```
 */

const ROUTE = readFileSync(
  path.join(__dirname, "../../check/route.ts"),
  "utf8",
);
/** 🔴 금지 검사는 **코드** 에만 — 주석이 금지를 설명한다(이 저장소가 아홉 번 걸린 함정). */
const CODE = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("CORE-E2E-CLOSE-06R — 계측 블록", () => {
  /** 🟢 I-1 — 일곱 생산자 **전수** 를 센다(뭉치지 않는다). */
  it("I-1 생산자별 건수와 WEAK 를 같이 적는다", () => {
    expect(CODE).toContain("[C06R-producers]");
    /**
     * 🔴🔴 **파일 전체로 세면 안 된다 — 내 변이가 그 구멍을 찾았다.**
     *    `domesticShop.webSearchEvidence` 는 **응답 조립부에도** 있어서, 계측에서
     *    그 줄을 지워도 파일 검사는 **통과했다**(N1·N2 가 「통과 — 가드 구멍」).
     * 🟢 그래서 **계측 블록으로 범위를 좁힌다** — 이제 빼면 FAIL 한다.
     */
    const from = CODE.indexOf("const PRODUCERS");
    expect(from).toBeGreaterThan(0);
    const to = CODE.indexOf("[C06R-funnel]", from);
    expect(to).toBeGreaterThan(from);
    const scope = CODE.slice(from, to);
    for (const p of [
      "domesticShop.webSearchEvidence",
      "domesticShop.domesticListingEvidence",
      "domesticShop.overseasAutoEvidence",
      "domesticShop.urlCandidateEvidence",
      "domesticShop.geminiEvidence",
      "domesticShop.reviewedSameEvidence",
      "domesticShop.weakCandidateEvidence",
    ]) {
      expect(scope, `🔴 ${p} 가 계측에서 빠졌다 — 그 축이 끊겼는지 알 수 없게 된다`).toContain(p);
    }
  });

  /** 🔴🔴 I-2 — **국내/해외/미확정 셋을 가른다**(CPO §6 표의 그 열). */
  it("I-2 시장을 셋으로 가른다", () => {
    expect(CODE).toContain("[C06R-funnel]");
    expect(CODE).toContain('KR: cut("KR")');
    expect(CODE).toContain('OVERSEAS: cut("OVERSEAS")');
    /** 🔴 「국내도 해외도 아님」을 **0 으로 뭉개지 않는다**. */
    expect(CODE).toContain('UNKNOWN_MARKET: cut("UNKNOWN")');
  });

  /** 🔴 I-3 — 판정 분포와 **가격 두 칸** 을 같이 적는다. */
  it("I-3 SAME/PRESUMED 와 가격을 가른다", () => {
    /**
     * 🔴🔴 **칸 이름에 «콜론» 을 붙여 센다 — 내 변이가 그 구멍을 찾았다.**
     *    `sameOrPresumedWithPrice` 만 보면 `sameOrPresumedWithPriceX` 로 바꿔도
     *    **부분문자열로 통과** 했다(N4 가 「통과 — 가드 구멍」).
     * 🟢 그래서 **객체 키 모양** 으로 단언한다.
     */
    for (const k of [
      "SAME:",
      "PRESUMED_SAME:",
      "SIMILAR:",
      "CONFLICT:",
      "withPrice:",
      /** 🔴 「가격 보유」와 「SAME/PRESUMED + 가격」은 **다른 숫자** 다(PE-01A 의 그 구분). */
      "sameOrPresumedWithPrice:",
    ]) {
      expect(CODE, `🔴 계측에 ${k} 칸이 없다`).toContain(k);
    }
  });

  /** 🔴 I-4 — 후보 **한 줄씩** 적는다(어느 칸에서 멈췄는지). */
  it("I-4 행 단위 로그가 있다", () => {
    expect(CODE).toContain("[C06R-row]");
    expect(CODE).toContain("e.crossSellerBlockers");
  });

  /** 🔴🔴 I-5 — **계측이 요청을 깨뜨리지 않는다**(읽기 전용 + try). */
  it("I-5 계측 블록이 try 로 감싸여 있다", () => {
    const at = CODE.indexOf("[C06R-producers]");
    expect(at).toBeGreaterThan(0);
    const before = CODE.slice(0, at);
    expect(before.lastIndexOf("try {")).toBeGreaterThan(before.lastIndexOf("} catch"));
    /** 🔴 그 블록 안에서 **쓰지 않는다** — await·fetch·insert·update 0. */
    const end = CODE.indexOf("} catch", at);
    const block = CODE.slice(at, end);
    for (const forbidden of ["await ", "fetch(", "insert", "update", "upsert", "setState"]) {
      expect(block, `🔴 계측 블록이 ${forbidden} 를 쓴다 — 읽기 전용이 아니다`).not.toContain(
        forbidden,
      );
    }
  });

  /** 🔴🔴 I-6 — **응답을 바꾸지 않았다**(계측은 로그뿐이다). */
  it("I-6 계측 블록이 응답 객체를 건드리지 않는다", () => {
    const at = CODE.indexOf("[C06R-producers]");
    const end = CODE.indexOf("} catch", at);
    const block = CODE.slice(at, end);
    /**
     * 🔴 **「return 금지」로 쓰면 안 된다** — 블록 안의 `cut()` 헬퍼가 자기 값을
     *    `return` 한다(지역 반환이고 핸들러를 끝내지 않는다). 내 1차 단언이 그것을
     *    잡아 **거짓 FAIL** 을 냈다. 🟢 지키려는 성질은 **「응답을 만들거나 바꾸지
     *    않는다」** 이므로 그것을 직접 적는다.
     */
    for (const forbidden of ["NextResponse", "return NextResponse", "domesticShop ="]) {
      expect(block).not.toContain(forbidden);
    }
    /** 🔴 그리고 응답 생성이 이 블록 **밖** 에 있다는 것까지 단언한다. */
    expect(CODE.indexOf("NextResponse.json", end)).toBeGreaterThan(end);
  });

  /** 🔴🔴 I-7 — CPO §2 금지축 **전수 무변경**(이 파일에서 확인 가능한 것). */
  it("I-7 Search·Identity·가격·저장 축을 건드리지 않았다", () => {
    /** 🟢 `/check` 는 여전히 `webSearch: true` 하나를 켠다 — retry·variation·split 0. */
    expect(CODE).toContain("webSearch: true");
    for (const forbidden of ["retry", "variation", "splitQuery", "buildDiscoverySearchQuery"]) {
      expect(CODE).not.toContain(forbidden);
    }
    /** 🔴 `seen` 은 **그대로 세 생산자** 다 — 영속 범위를 임의로 늘리지 않았다. */
    const seenAt = CODE.indexOf("const seen = [");
    expect(seenAt).toBeGreaterThan(0);
    const seenBlock = CODE.slice(seenAt, CODE.indexOf("];", seenAt));
    expect(seenBlock).toContain("overseasAutoEvidence");
    expect(seenBlock).toContain("geminiEvidence");
    expect(seenBlock).toContain("urlCandidateEvidence");
    /** 🔴 WEB_SEARCH·DOMESTIC_LISTING 을 **넣지 않았다** — DB CHECK 가 금지한다. */
    expect(seenBlock).not.toContain("webSearchEvidence");
    expect(seenBlock).not.toContain("domesticListingEvidence");
  });

  /**
   * 🔴🔴 I-8 — **DB `source` 어휘를 늘리지 않았다**(migration 0).
   *    🟢 그리고 그 제약이 왜 막는지를 계약이 직접 든다 — 다음 사람이 「다른 값으로
   *       적자」로 가지 않게.
   */
  it("I-8 source 어휘가 다섯 그대로다", () => {
    const sql = readFileSync(
      /** 🔴 **8단계** 다 — `apps/admin` 에서 리포 루트까지 둘이 더 있다(계산해 확인했다). */
      path.join(
        __dirname,
        "../../../../../../../../packages/database/prisma/migrations_manual/079_candidate_reviews.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(
      "source in ('OVERSEAS_AUTO', 'DOMESTIC_REGISTRY', 'SELLER_URL', 'GEMINI', 'GT_IMPORT')",
    );
    expect(sql).not.toContain("WEB_SEARCH");
    expect(sql).not.toContain("DOMESTIC_LISTING");
  });
});
