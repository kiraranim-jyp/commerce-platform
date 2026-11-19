/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 ③ KIDS 전체 MI 흐름 검증 — **어디까지 검증됐고 어디서 근거가 끊기는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 WU 의 목적은 **기능을 더 만드는 것이 아니다**(CPO 명시). 네트워크 0 · 운영
 *    변경 0 · verdict 재계산 0 · DB 0 · 동결 정책 변경 0.
 *
 * 🔴🔴 **「검증됐다」를 글로 적지 않는다 — 기계가 확인한다.** 각 단계의 근거 파일과
 *    숫자가 **실제로 거기 있는지** 단언하고, 없으면 `UNVERIFIED` 로 적는다.
 * 🔴 **UNKNOWN·검증불가를 성공도 실패도 아닌 그대로** 둔다(억지 분류 금지).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const exists = (p: string) => {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
};

const KW = path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json");
const C = path.join(HERE, "preserved", "c-candidate-quality.json");
const A = path.join(HERE, "preserved", "a-identity-axis.json");
const A33 = path.join(HERE, "preserved", "a33-candidate-coordinates.json");
const A22 = path.join(HERE, "preserved", "a22-candidate-descriptions.json");
const A07 = path.join(HERE, "preserved", "a07-both-fulltext-axes.json");
const CAUSES = path.join(ROOT, "docs", "MI-KIDS-CODE-NAME-CAUSES.json");
const SHADOW = path.join(ROOT, "docs", "MI-REEVAL-STEP5-SHADOW.json");

type KwRow = {
  originCode: string | null;
  candidateUrl: string;
  humanGt: string | null;
  candidate: { description: string | null } | null;
};

describe("③ KIDS MI 흐름 검증 — 단계별 근거 확인(HTTP 0)", () => {
  /* ═══════════ ① 분모 축 — 🔴 여기서 틀리면 뒤의 모든 숫자가 거짓이 된다 ═══════════ */

  /**
   * 🔴🔴 **C·A 보고의 「109쌍」을 정정한다.** 실측하면 행 109 인데
   *    고유 `(originCode, candidateUrl)` 은 **103** 이고 고유 후보 URL 은 **95** 다.
   *    ⟹ 「쌍 109」가 아니라 **「행 109 · 고유 쌍 103 · 고유 후보 95」** 가 정확한 표현이다.
   * 🟢 C·A 의 **축 집계는 행 단위** 였으므로 숫자는 유효하다. 바뀌는 것은 **이름** 이다.
   */
  it("F-1 🔴 분모 축을 **세 가지로 갈라** 고정한다(109 ≠ 고유 쌍)", () => {
    const kw = (read(KW) as { pairs: KwRow[] }).pairs;
    expect(kw).toHaveLength(109);
    expect(new Set(kw.map((r) => `${r.originCode}|${r.candidateUrl}`)).size).toBe(103);
    expect(new Set(kw.map((r) => r.candidateUrl)).size).toBe(95);
  });

  /**
   * 🔴🔴 **URL 만으로 GT 를 조인하면 「상충」이 조용히 생긴다** — 같은 후보가 **다른
   *    원상품** 과 짝이면 라벨이 다를 수 있다(그것은 상충이 아니다).
   * 🟢 올바른 키는 `(originCode, candidateUrl)` 이고 그 축에서는 **상충 0** 이어야 한다.
   */
  it("F-2 🔴🔴 GT 조인 키는 **(원상품, 후보)** 다 — URL 단독은 상충을 만든다", () => {
    const kw = (read(KW) as { pairs: KwRow[] }).pairs;
    const causes = read(CAUSES) as {
      rows: { originCode: string | null; candidateUrl: string; humanGt: string | null }[];
    };
    const pairKey = (o: string | null, u: string) => `${o}|${u}`;
    const byPair = new Map(
      causes.rows.filter((r) => r.humanGt).map((r) => [pairKey(r.originCode, r.candidateUrl), r.humanGt]),
    );
    const pairDiffs = kw.filter(
      (r) =>
        r.humanGt &&
        byPair.has(pairKey(r.originCode, r.candidateUrl)) &&
        byPair.get(pairKey(r.originCode, r.candidateUrl)) !== r.humanGt,
    );
    /**
     * 🔴🔴🔴 **이 둘은 「상충」이 아니라 「갱신」이다 — 단정하지 않고 가렸다.**
     *    `MI-KIDS-CODE-NAME-CAUSES` 가 그 사실을 **스스로 들고 있다**
     *    (`gtSuperseded: true` · `humanGtSource: core-2m-ceo-visual-gt(최신 · 대체)` ·
     *     CPO 「최신 CEO 판정을 기준 truth 로 확정」).
     * 🔴🔴 **그래서 결함은 「갈린다」가 아니라 「fixture 가 낡은 라벨을 들고 있다」** 다 —
     *    `mi-reeval-03-keyword-input.json` 의 `humanGt` 는 **대체 전** 값이고,
     *    C·A 가 그 값을 썼다. ⟹ 그 두 쌍을 GT 근거로 쓰면 **거짓 반례** 가 된다.
     * 🟢 계약은 「갈리면 **반드시 superseded 로 표시돼 있어야 한다**」로 세운다 —
     *    표시 없이 갈리는 날이 오면 그때가 **진짜 상충** 이고 이 단언이 FAIL 한다.
     */
    expect(pairDiffs.length, "🟡 갱신이 실재한다(0 이 되면 계약 갱신 사안)").toBe(2);
    const supersededPairs = new Set(
      causes.rows
        .filter((r) => (r as { gtSuperseded?: boolean }).gtSuperseded)
        .map((r) => pairKey(r.originCode, r.candidateUrl)),
    );
    for (const r of pairDiffs) {
      expect(
        supersededPairs.has(pairKey(r.originCode, r.candidateUrl)),
        "🔴 표시 없이 라벨이 갈렸다 — 그때는 **진짜 상충** 이다",
      ).toBe(true);
    }

    /** 🟡 URL 축에서는 갈린다 — **그것이 정상** 이고, 그래서 URL 축으로 집계하지 않는다. */
    const byUrl = new Map(causes.rows.filter((r) => r.humanGt).map((r) => [r.candidateUrl, r.humanGt]));
    const urlConflicts = kw.filter(
      (r) => r.humanGt && byUrl.has(r.candidateUrl) && byUrl.get(r.candidateUrl) !== r.humanGt,
    ).length;
    expect(urlConflicts, "🔴 이 값이 0 이 되면 F-2 의 경고가 무의미해진다(그때 갱신)").toBeGreaterThan(0);
  });

  /* ═══════════ ② 단계 간 데이터 전달 일관성 ═══════════ */

  it("F-3 🟢 단계가 **같은 집합** 을 보고 있다(C ⊃ A · causes == C)", () => {
    const c = read(C) as { rows: { candidateUrl: string }[] };
    const a = read(A) as { rows: { candidateUrl: string }[] };
    const causes = read(CAUSES) as { rows: { candidateUrl: string }[] };
    const cSet = new Set(c.rows.map((r) => r.candidateUrl));
    expect(c.rows).toHaveLength(109);
    expect(a.rows).toHaveLength(26);
    expect(a.rows.every((r) => cSet.has(r.candidateUrl)), "🔴 A 분모가 C 밖으로 나갔다").toBe(true);
    expect(causes.rows).toHaveLength(109);
    expect(causes.rows.every((r) => cSet.has(r.candidateUrl))).toBe(true);
  });

  /* ═══════════ ③ 🔴🔴 근거가 «있는데 연결되지 않은» 지점 ═══════════ */

  /**
   * 🔴🔴🔴 **이 WU 가 찾은 것** — A군 후보 일부가 **B군 fixture 에 설명문을 갖고 있는데**
   *    A④ 의 「양쪽 원문」 분모(**7**)에 들어가지 않았다.
   *
   * 🔴 그러므로 **A④ 분모 7 은 과소** 다. 🟢 그리고 보강에 **새 HTTP 가 필요 없다**.
   * 🔴 **그러나 A 의 결론(승격 0)은 흔들리지 않는다** — 레버 ②는 「GT DIFFERENT 를
   *    **하나라도** 여는가」로 거부됐고, 분모가 늘어도 **이미 관측된 2건은 사라지지 않는다**.
   * 🔴 이 자리에서 A 를 재측정하지 않는다(③ 은 검증 단계다 · CPO 범위).
   */
  it("F-4 🔴🔴 A군 후보 설명문이 **이미 있는데 분모에 연결되지 않았다**", () => {
    const kw = (read(KW) as { pairs: KwRow[] }).pairs;
    const coord = (read(A33) as { pairs: { pairId: string; candidateUrl: string }[] }).pairs;
    const a22 = (read(A22) as { rows: { pairId: string; hasDescription: boolean }[] }).rows;
    const urlByPair = new Map(coord.map((p) => [p.pairId, p.candidateUrl]));
    const aUrls = new Set(coord.map((p) => p.candidateUrl));

    /** A군 후보이면서 B군 fixture 에도 있는 고유 URL. */
    const overlap = [...new Set(kw.filter((r) => aUrls.has(r.candidateUrl)).map((r) => r.candidateUrl))];
    expect(overlap.length, "🔴 기록된 「A∩B = 0」은 **URL 축에서 사실이 아니다**").toBe(6);
    /** 🟢 그 겹침 행은 **전부** 후보 설명문을 갖고 있다. */
    const overlapRows = kw.filter((r) => aUrls.has(r.candidateUrl));
    expect(overlapRows.every((r) => Boolean(r.candidate?.description?.trim()))).toBe(true);

    /** 🔴 그중 A22 가 실제로 확보한 것은 둘뿐이다 ⟹ **미연결 4**. */
    const got22 = new Set(a22.filter((r) => r.hasDescription).map((r) => urlByPair.get(r.pairId)));
    expect(got22.size, "🔴 a22 조인 키는 `pairId` 다 — URL 로 조인하면 0 이 나온다").toBe(7);
    const alreadyCounted = overlap.filter((u) => got22.has(u)).length;
    expect(alreadyCounted).toBe(2);
    expect(overlap.length - alreadyCounted, "🟡 새 HTTP 0 으로 더할 수 있는 최대 쌍 수").toBe(4);
  });

  /**
   * 🔴🔴🔴 **낡은 라벨이 A 의 레버 거부 근거를 흔드는가 — 답은 「아니다」다.**
   *
   * 🔴 호스트 **집합** 으로 가린다. 쌍 축으로 재조인하려다 전건 `undefined` 를 얻었고
   *    (C·A 산출물이 `originCode` 를 버렸다) 그 숫자를 **결론으로 쓰지 않았다**.
   *    🟢 그 결함은 A 하니스에 `originCode` 를 더해 고쳤고, 이 단언은 **조인에 의존하지
   *       않는 축**(호스트 교집합)으로 세운다.
   */
  it("F-7 🔴🔴 **갱신된 라벨은 A 의 거부 근거와 겹치지 않는다**(교집합 0)", () => {
    const causes = read(CAUSES) as {
      rows: { candidateUrl: string; gtSuperseded?: boolean }[];
    };
    const a = read(A) as {
      rows: { candidateDomain: string; humanGt: string | null; leverCodeOnlyInDescription: boolean }[];
    };
    const supersededHosts = new Set(
      causes.rows.filter((r) => r.gtSuperseded).map((r) => new URL(r.candidateUrl).hostname),
    );
    /** 🟢 전체 109행 중 갱신은 **둘** 이다. */
    expect(causes.rows.filter((r) => r.gtSuperseded)).toHaveLength(2);
    const rejectionHosts = new Set(
      a.rows.filter((r) => r.leverCodeOnlyInDescription && r.humanGt === "DIFFERENT").map((r) => r.candidateDomain),
    );
    expect(rejectionHosts.size, "🔴 거부 근거가 사라지면 A 를 다시 판정해야 한다").toBe(2);
    const overlap = [...rejectionHosts].filter((h) => supersededHosts.has(h));
    expect(overlap, "🔴 겹치면 A 의 「승격 0」을 **CPO 재판정** 으로 올려야 한다").toEqual([]);
  });

  /* ═══════════ ④ 흐름 표 산출 — 검증 / 부분 / 검증불가를 «가른다» ═══════════ */

  it("F-5 🔵 단계별 검증 상태를 산출한다(🔴 검증불가를 0 으로 적지 않는다)", () => {
    const kw = (read(KW) as { pairs: KwRow[] }).pairs;
    const c = read(C) as { urlShape: Record<string, number>; buckets: Record<string, number>; facts: Record<string, number> };
    const a = read(A) as {
      denominator: Record<string, unknown>;
      axisTally: Record<string, Record<string, number>>;
      leverSafety: Record<string, { pairs: number; opensGtDifferent: number }>;
      baselineVerdict: Record<string, number>;
    };
    const a22 = read(A22) as { attempted: number; reached: number; withDescription: number };
    const shadow = read(SHADOW) as { pairsA: { baselineReproduced: boolean }[] };

    const stages = [
      {
        stage: "① MI 입력(후보 URL 경계)",
        status: "PARTIAL",
        verified: "입력 경계는 pool 이 소유한다(라우트는 모양 검사만) — 계약 `wu-024` F절",
        unverifiable:
          "🔴 **AI Search 는 사용자 브라우저에서 돈다** — 서버는 `candidateUrls[]` 만 받고 " +
          "검색 원문을 담는 칸이 코드에 없다 ⟹ 이 단계는 **구조적 측정불가**(0% 아님)",
      },
      {
        stage: "② 후보 수집",
        status: "PARTIAL",
        verified:
          `실패 사유가 호출부까지 온다(계약 17 · 429/404/Timeout/ENOTFOUND/Shopify 폴백) · ` +
          `라이브 실측 시도 ${a22.attempted} → 도달 ${a22.reached} → 설명문 ${a22.withDescription}`,
        unverifiable:
          "🔴 **Production API 발화 미검증** — 셀러가 재분석을 눌러야 찍히고 `vercel logs` 는 라이브 테일이다",
      },
      {
        stage: "③ 식별 근거(후보 품질)",
        status: "VERIFIED",
        verified:
          `행 109 기준 — 상품페이지 ${c.urlShape.PRODUCT_PAGE}/109 · 제목 ${c.facts.hasTitle}/109 · ` +
          `품번 어느 축이든 ${c.facts.codeEitherAxis} · 품질 ${c.buckets.QUALITY_NO_CODE} ↔ 식별 ${c.buckets.IDENTITY_AXIS}`,
        unverifiable:
          "🔴 `PRODUCT_PAGE 109/109` 은 **이미 쌍이 된 후보** 분모다(선별 편향) ⟹ 실제 수집 단계의 URL 품질로 일반화 금지",
      },
      {
        stage: "④ 판정(SAME/SIMILAR/DIFFERENT/UNKNOWN)",
        status: "PARTIAL",
        verified:
          `식별 축 26쌍 — modelCode ${JSON.stringify(a.axisTally.modelCode)} · ` +
          `A군 baseline 재현 ${shadow.pairsA.filter((p) => p.baselineReproduced).length}/${shadow.pairsA.length}`,
        unverifiable:
          `🔴 그 26 안에 **BASELINE_NOT_REPRODUCED ${a.baselineVerdict.BASELINE_NOT_REPRODUCED ?? 0}쌍** 이 있다 ⟹ ` +
          `그 쌍의 축 수치는 「운영이 지금 그 값을 낸다」로 쓸 수 없다 · GT 라벨은 ${a.denominator.humanGtLabeled}/26`,
      },
      {
        stage: "⑤ 가격 비교",
        status: "FROZEN_NOT_MEASURED",
        verified:
          "🔴 이 WU 에서 **측정하지 않았다** — A/B 가격 표시는 동결이고 통화 분리·환산 금지 계약이 그 경계를 지킨다",
        unverifiable: "🔴 「국내 SAME 0」 상태도 이 WU 가 열지 않았다 ⟹ 성공도 실패도 아닌 **미측정**",
      },
    ];

    const out = {
      note:
        "🔴 ③ 흐름 검증 — 운영 변경 0 · HTTP 0 · verdict 재계산 0 · 동결 변경 0. " +
        "🔴 검증불가를 0 으로 적지 않는다. 🔴 분모 축을 섞지 않는다.",
      denominatorAxes: {
        rows: kw.length,
        uniqueOriginCandidatePairs: new Set(kw.map((r) => `${r.originCode}|${r.candidateUrl}`)).size,
        uniqueCandidateUrls: new Set(kw.map((r) => r.candidateUrl)).size,
        note: "🔴 C·A 보고의 「109쌍」은 **행 109 · 고유 쌍 103 · 고유 후보 95** 로 읽는다(집계는 행 단위라 숫자는 유효하다)",
      },
      joinIntegrity: {
        aSubsetOfC: true,
        causesMatchesC: true,
        gtDiffByPairKey: 2,
        gtDiffAllMarkedSuperseded: true,
        gtConflictsByUrlKey: 2,
        note:
          "🔴 URL 단독 조인은 **라벨 상충을 만든다** — 키는 (원상품, 후보) 다. " +
          "🔴🔴 그리고 쌍 축 차이 2건은 **상충이 아니라 CEO 판정 «갱신»** 이다 ⟹ " +
          "`mi-reeval-03-keyword-input.json` 의 `humanGt` 는 **대체 전(낡은) 라벨** 이고 " +
          "C·A 가 그것을 썼다. 🟢 단 그 2건은 A 의 레버 거부 근거와 **겹치지 않는다**(F-7).",
      },
      staleGtExposure: {
        supersededRows: 2,
        supersededHosts: ["bornyesterdaykids.com", "m.luxboy.com"],
        rejectionBasisHosts: ["cemarose.ca", "www.tinyapple.net"],
        overlap: 0,
        impactOnAConclusion: "🟢 없다 — 거부 근거 2건이 **갱신 대상이 아니다**",
        remainingDebt:
          "🔴 C·A 의 `humanGt` 는 낡은 라벨을 들고 있다. 🟡 최신 truth 로 재집계할지는 " +
          "**CPO 판정 사안** 이고 이 WU 가 열지 않았다(③ 은 검증 단계다)",
      },
      joinLimitation:
        "🔴 A 의 축 조인은 **URL 축** 이라 중복 URL(10개 · 14행)에서 **첫 행을 집는다** ⟹ " +
        "그 쌍의 축 값은 **다른 원상품의 것일 수 있다**. 🟢 이번에 `originCode` 를 산출물에 " +
        "더해 다음 세션이 쌍 축으로 되짚을 수 있게 했다.",
      unconnectedEvidence: {
        aGroupCandidatesAlsoInBFixture: 6,
        allHaveCandidateDescription: true,
        alreadyCountedInA22: 2,
        addableWithoutNewHttp: 4,
        impactOnAConclusion:
          "🔴 **없다** — 레버 ②는 「GT DIFFERENT 를 하나라도 여는가」로 거부됐고 " +
          "분모가 늘어도 이미 관측된 2건은 사라지지 않는다",
        note: "🟡 A④ 분모 7 은 **과소** 다. 재측정 여부는 **CPO 판정 사안** 이고 이 WU 가 열지 않았다",
      },
      leverStatus: a.leverSafety,
      stages,
      artifactsPresent: {
        keywordInput: exists(KW),
        cQuality: exists(C),
        aIdentity: exists(A),
        a33: exists(A33),
        a22: exists(A22),
        a07: exists(A07),
        codeNameCauses: exists(CAUSES),
        shadow: exists(SHADOW),
      },
    };
    writeFileSync(path.join(HERE, "preserved", "kids-flow-verification.json"), JSON.stringify(out, null, 2));

    /** 🟢 근거 파일이 하나라도 없으면 그 단계는 「검증됐다」고 적을 수 없다. */
    expect(Object.values(out.artifactsPresent).every(Boolean)).toBe(true);
    /** 🔴 다섯 단계 중 **VERIFIED 는 하나뿐** 이다 — 과장하지 않는다. */
    expect(stages.filter((s) => s.status === "VERIFIED")).toHaveLength(1);
    /** 🔴 모든 단계가 **검증불가/한계를 적는다**(빈칸 금지). */
    expect(stages.every((s) => s.unverifiable.length > 0)).toBe(true);
  });

  /* ═══════════ ⑤ 보존·경계 계약 ═══════════ */

  it("F-6 🔴🔴 쓰기 주체 **하나** · `fixtures/` 쓰기 **0** · 경계 넘지 않았다", () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith(".ts"));
    let writers = 0;
    let fixtureWrites = 0;
    for (const f of files) {
      const bare = readFileSync(path.join(HERE, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      if (/writeFileSync\([^)]*kids-flow-verification/.test(bare)) writers += 1;
      if (/writeFileSync\([^)]*"fixtures"/.test(bare)) fixtureWrites += 1;
    }
    expect(writers).toBe(1);
    expect(fixtureWrites).toBe(0);

    const self = readFileSync(path.join(HERE, "kids-flow-verification.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    /** 🔴 자기참조 함정 — 토큰을 **런타임에 조립** 한다. */
    for (const token of [
      ["SAME", "_MIN_AXES"],
      ["withConf", "idence"],
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["DATABASE", "_URL"],
      ["brandModelCode", " ="],
    ].map(([x, y]) => `${x}${y}`)) {
      expect(self, `🔴 ${token} — 검증 WU 가 판정/수집/배선/DB 로 넘어갔다`).not.toContain(token);
    }
    /** 🔴 산출물에 원문을 담지 않는다. */
    const raw = readFileSync(path.join(HERE, "preserved", "kids-flow-verification.json"), "utf8");
    for (const b of ['"description":', '"originTitle"', "Authorization", "cookie"]) {
      expect(raw, `🔴 ${b} 가 산출물에 섞였다`).not.toContain(b);
    }
  });
});
