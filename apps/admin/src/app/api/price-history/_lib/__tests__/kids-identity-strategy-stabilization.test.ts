/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 로드맵 ② — **핵심 식별 전략 검증·안정화**(평가 전용 · HTTP 0 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **결론을 먼저 정해 놓지 않는다**(CPO 명시) — 안정화할 근거가 없으면 그대로 적는다.
 * 🔴 **A·C 에서 이미 확인한 한계와 «거부된 레버» 를 다시 조사하지 않는다** — 이 WU 는
 *    그것들이 **지금도 닫혀 있는지** 확인할 뿐이다.
 *
 * 🔴🔴 **가드를 복제하지 않는다**(§4-D). 거부 레버마다 **이미 소유자 계약이 있다** ⟹
 *    여기서는 그 **소유자가 실재하고 술어를 들고 있는지** 만 확인한다. 같은 단언을 또
 *    쓰면 한쪽만 고쳐져 갈린다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const CROSS = path.join(ROOT, "packages", "crawler", "src", "comparison-search", "cross-seller.ts");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
/** 🔴 주석을 **벗긴다** — 주석 속 설명이 「구현됐다」로 세어지는 함정(여덟 번 걸렸다). */
const bare = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const OUT = path.join(HERE, "preserved", "kids-identity-strategy-stabilization.json");

/* ═══════════ ① 전략이 «실제로» 쓰는 증거 — 운영 소스에서 읽는다 ═══════════ */

const strategy = () => {
  const src = bare(CROSS);
  const axes = [...new Set((src.match(/axis: "[A-Z_]+"/g) ?? []).map((m) => m.split('"')[1]))].sort();
  const blockers = [...new Set((src.match(/blocker: "[A-Z_]+"/g) ?? []).map((m) => m.split('"')[1]))].sort();
  const sameMin = Number(/const SAME_MIN_AXES = (\d+)/.exec(src)?.[1]);
  const presumedMin = Number(/const PRESUMED_SAME_MIN_AXES = (\d+)/.exec(src)?.[1]);
  /** 🟢 「관찰된 차이」 집합 — 「모른다」와 **다른 사실** 로 분리돼 있다. */
  const obsBlock = src.slice(src.indexOf("OBSERVED_DIFFERENCE_BLOCKERS"), src.indexOf("export const OBSERVED_DIFFERENCE_BLOCKER_LIST"));
  const observed = [...new Set((obsBlock.match(/"[A-Z_]+"/g) ?? []).map((m) => m.replaceAll('"', "")))].sort();
  return { src, axes, blockers, sameMin, presumedMin, observed };
};

describe("로드맵 ② — 핵심 식별 전략 검증(평가 전용)", () => {
  it("S-1 🔵 전략이 쓰는 **증거 축과 문턱** 을 운영 소스에서 확정한다", () => {
    const s = strategy();
    /** 🔴 숫자를 **고정** 한다 — 바뀌면 FAIL 해서 사람이 본다(조용히 움직이지 않는다). */
    expect(s.sameMin).toBe(5);
    expect(s.presumedMin).toBe(3);
    expect(s.axes).toEqual([
      "AUDIENCE",
      "CATEGORY",
      "COLOR",
      "FIT",
      "IMAGE",
      "MATERIAL",
      "MODEL_CODE",
      "SIZE",
      "TITLE",
    ]);
    /**
     * 🔴🔴 **`IMAGE` 는 축 목록에 있지만 SAME 정원에서 빠진다** — 표준 §2.2 와 정합이다.
     *    「축에 있다」를 「SAME 을 만들 수 있다」로 읽지 않는다.
     *
     * 🔴🔴 **1차 단언이 «주석» 을 근거로 했고 FAIL 로 드러났다.** 주석은
     *    「`evaluate()` 의 `coreAxisCount` 에서 IMAGE 를 뺀다」고 적어 두었지만
     *    **`coreAxisCount` 라는 식별자는 코드에 없다**(주석에만 1회) — **낡은 주석** 이다.
     * 🟢 실제 기전은 축 배열의 **필터** 다 ⟹ 그 **코드** 를 단언한다.
     * 🟡 그리고 같은 줄이 **`TITLE` 1점도 정원에서 뺀다** — 「약한 제목 일치」가 혼자
     *    SAME 을 밀지 못하게 하는 조건이고, 이것도 같이 고정한다.
     */
    expect(s.src, "🔴 IMAGE 가 SAME 정원에 들어가면 표준과 어긋난다").toContain(
      'axis.axis !== "IMAGE"',
    );
    expect(s.src, "🔴 TITLE 1점이 정원에 들어가면 약한 일치가 SAME 을 민다").toContain(
      'axis.axis === "TITLE" && axis.points === 1',
    );
  });

  it("S-2 🟢🟢 「모른다」와 「달랐다」가 **집합으로 분리** 돼 있다(③ 처리 원칙)", () => {
    const s = strategy();
    /** 🟢 관찰된 차이 9종 — 양쪽에서 **서로 다른 값을 읽은** 경우다. */
    expect(s.observed).toEqual([
      "AUDIENCE_LINE",
      "BRAND_MISMATCH",
      "FIT",
      "GARMENT_FORM",
      "MATERIAL",
      "MODEL_CODE_AGE_LINE",
      "NO_TITLE_OVERLAP",
      "SAME_SELLER_DISTINCT_LISTING",
      "SIZE_SYSTEM",
    ]);
    /**
     * 🔴🔴 **이것이 이 단계의 핵심 확인이다** — 「확인 못 했다」 계열은 그 집합에
     *    **들어 있지 않다**(`BRAND_UNCONFIRMED` · `COLOR_VARIANT`) ⟹ 운영은 그 둘을
     *    **차이로 단정하지 않고 보류** 로 쓴다. 표준 절대불변 ③(누락 ↔ 불일치 구분)과 정합.
     */
    /**
     * 🔴🔴 **어휘 ≠ 발화** — `SIZE_SYSTEM` 은 관찰된차이 집합에 **있는데** 실제
     *    `blocker: "SIZE_SYSTEM"` push 가 **0** 이다(WU-045 「단독 비차단」의 흔적).
     * 🟢 그 사실을 고정한다 — 누가 push 를 넣으면 FAIL 해서 **정책 변경임이 드러난다**.
     */
    expect(s.observed).toContain("SIZE_SYSTEM");
    expect(s.blockers, "🔴 SIZE_SYSTEM 이 발화하기 시작했다 — WU-045 정책 변경이다").not.toContain(
      "SIZE_SYSTEM",
    );

    for (const notADifference of ["BRAND_UNCONFIRMED", "COLOR_VARIANT"]) {
      expect(s.blockers, `🔴 ${notADifference} 는 blocker 어휘에 있어야 한다`).toContain(notADifference);
      expect(
        s.observed,
        `🔴🔴 ${notADifference} 가 「관찰된 차이」로 올라가면 **모르는 것을 다르다고 단정** 한다`,
      ).not.toContain(notADifference);
    }
  });

  /* ═══════ ④ 거부된 레버가 «지금도» 닫혀 있는가 — 🔴 가드를 복제하지 않는다 ═══════ */

  it("S-3 🔴🔴 거부 레버 **8종의 소유자 계약이 실재** 한다(복제 0)", () => {
    const guards: { lever: string; file: string; predicate: string }[] = [
      {
        lever: "제목 토큰 → 후보 brandModelCode 승격(false SAME)",
        file: "apps/admin/src/app/api/price-history/_lib/__tests__/candidate-code-parity-01.test.ts",
        predicate: "brandModelCode",
      },
      {
        lever: "상세설명 증거를 운영 SAME 판정에 연결",
        file: "packages/crawler/src/comparison-search/__tests__/brand-1-description-evidence.test.ts",
        predicate: "brand-description-evidence",
      },
      {
        lever: "domain / 판매처 이름을 브랜드로 쓰기",
        file: "packages/crawler/src/comparison-search/__tests__/wu-080-brand-producer.test.ts",
        predicate: "brand",
      },
      {
        lever: "generic 숫자 가격 parser",
        file: "packages/crawler/src/comparison-search/__tests__/wu-079-price-producer.test.ts",
        predicate: "price",
      },
      {
        lever: "SAME 문턱에 식별 증거 요구 / threshold 조정",
        file: "packages/crawler/src/comparison-search/__tests__/mi-p0-11-material-and-same-threshold.test.ts",
        predicate: "SAME",
      },
      {
        lever: "숫자-only slug 를 식별자로 쓰기",
        file: "packages/crawler/src/comparison-search/__tests__/wu-095-numeric-slug.test.ts",
        predicate: "slug",
      },
      {
        lever: "상세설명에만 있는 품번을 식별 근거로 승격",
        file: "apps/admin/src/app/api/price-history/_lib/__tests__/a-identity-axis.test.ts",
        predicate: "opensGtDifferent",
      },
      {
        lever: "UA 회전·변경으로 접근 제한 우회",
        file: "apps/admin/src/app/api/price-history/_lib/__tests__/case-01-fetch-failure-reason.test.ts",
        predicate: "UA_POOL",
      },
    ];
    const missing: string[] = [];
    for (const g of guards) {
      let src = "";
      try {
        src = readFileSync(path.join(ROOT, g.file), "utf8");
      } catch {
        missing.push(`${g.lever} — 🔴 가드 파일이 없다`);
        continue;
      }
      if (!src.includes(g.predicate)) missing.push(`${g.lever} — 🔴 술어 \`${g.predicate}\` 가 없다`);
    }
    expect(missing, "🔴 거부 레버에 소유자 계약이 없으면 **조용히 되살아날 수 있다**").toEqual([]);
    expect(guards).toHaveLength(8);
  });

  /* ═══════ ② GT 별 작동 범위 — 🔴 기존 실측을 «분모를 갈라» 읽는다 ═══════ */

  it("S-4 🔵 GT 별 작동 범위를 **분모를 섞지 않고** 정리하고 산출물을 남긴다", () => {
    const s = strategy();
    const a = read(path.join(HERE, "preserved", "a-identity-axis.json")) as {
      denominator: Record<string, unknown>;
      axisByGt: Record<string, { n: number; modelCode: Record<string, number> }>;
      leverSafety: Record<string, { pairs: number; hosts: number; opensGtDifferent: number }>;
    };
    const recount = read(path.join(HERE, "preserved", "gt-latest-recount.json")) as {
      a: { latest: { byGt: Record<string, { n: number; modelCode: Record<string, number> }>; riskCodeMatchButHumanDifferent: number } };
    };
    const boosted = read(path.join(HERE, "preserved", "a11-fulltext-axes-boosted.json")) as {
      denominator: Record<string, number>;
      gtLatest: Record<string, unknown>;
      byGtLatest: { all: Record<string, unknown> };
      guardChangedPairs: number;
    };
    const c = read(path.join(HERE, "preserved", "c-candidate-quality.json")) as {
      buckets: Record<string, number>;
      hostsPerBucket: Record<string, number>;
    };

    const out = {
      note:
        "🔴 평가 전용 — 운영 변경 0 · HTTP 0 · verdict 재계산 0 · 새 계약 복제 0. " +
        "🔴 **결론을 먼저 정하지 않았다**. 🔴 분모가 다른 숫자를 **합산하지 않는다**.",
      /* ① */
      strategy: {
        sameMinAxes: s.sameMin,
        presumedSameMinAxes: s.presumedMin,
        axes: s.axes,
        axisCount: s.axes.length,
        imageExcludedFromSameQuota: true,
        weakTitleExcludedFromSameQuota: true,
        quotaFilterMechanism:
          '축 배열 필터 — `axis.axis !== "IMAGE" && !(axis.axis === "TITLE" && axis.points === 1)` ' +
          "(🔴 주석의 `coreAxisCount` 는 **코드에 없는 낡은 이름** 이다 — 주석을 근거로 쓰면 틀린다)",
        blockers: s.blockers,
        blockersPushedCount: s.blockers.length,
        observedDifferenceBlockers: s.observed,
        notADifference: ["BRAND_UNCONFIRMED", "COLOR_VARIANT"],
        /**
         * 🔴🔴 **어휘에 있는데 «발화하지 않는» 것이 하나 있다** — `SIZE_SYSTEM` 은
         *    union(:115)과 관찰된차이 집합(:163)에 **있는데 `blocker: "SIZE_SYSTEM"`
         *    push 가 0** 이다. 🟢 WU-045 의 「사이즈 라인 차이는 **단독으로 SAME 을 막지
         *    않는다**」 결정의 흔적이다. 🔴 「11종이 발화한다」로 적으면 거짓이다.
         */
        declaredButNeverPushed: ["SIZE_SYSTEM"],
        confirmAxis:
          "품번은 **추출하지 않고 확인** 한다 — `confirmBrandCodeInEvidence(원본품번, {title,url,sku})` " +
          "⟹ 산출이 `foreignCode` 또는 `null` 뿐이라 **지어낸 충돌 0**",
      },
      /* ② 🔴 세 분모를 **나란히** 둔다 — 하나로 합치지 않는다 */
      scopeByGt: {
        identityAxis26_priorLabels: a.axisByGt,
        identityAxis26_latestLabels: recount.a.latest.byGt,
        bothFullText11_latestLabels: boosted.byGtLatest.all,
        denominators: {
          identityAxisPairs: a.denominator.identityAxisPairs,
          identityAxisGtLabeled: a.denominator.humanGtLabeled,
          bothFullTextPairs: boosted.denominator.total,
          bothFullTextLatestLabeled: 5,
          note: "🔴 26 ↔ 11 은 **다른 집합** 이다(겹침은 있으나 합산 금지)",
        },
      },
      /* ③ */
      unknownHandling: {
        principle:
          "🟢 운영이 「모른다」와 「달랐다」를 **집합으로** 가른다 — 관찰된 차이 9종만 " +
          "`OBSERVED_DIFFERENCE_BLOCKERS` 에 들어가고 `BRAND_UNCONFIRMED`·`COLOR_VARIANT` 는 **보류** 다",
        measured:
          "A 평가 26쌍에서 비(非)MATCH 의 **지배 성분이 UNKNOWN** 이었다(brand 10 · code 2 · name 13) " +
          "⟹ 🔴 「MI 가 틀렸다」가 아니라 **「입력을 모른다」** 다",
        rule: "🔴 UNKNOWN 을 오판으로도 성공으로도 세지 않는다(CPO 명시)",
      },
      /* ④ */
      rejectedLeversStillClosed: {
        count: 8,
        guardsPresent: true,
        note: "🔴 이 WU 는 **가드를 복제하지 않았다** — 소유자 실재와 술어 보유만 확인했다",
      },
      /* ⑤ 🔴 결론을 먼저 정하지 않는다 — 두 묶음으로 «가른다» */
      stabilizable: [
        "🟢 축 9 · 문턱 5/3 · blocker 11 · 관찰된차이 9 — **숫자로 고정됐다**(S-1·S-2 가 잠근다)",
        "🟢 「모른다 ↔ 달랐다」 분리 — 집합이 코드에 있고 계약으로 잠겼다",
        "🟢 거부 레버 8종 — 소유자 계약 실재 확인(S-3)",
        "🟢 품번 **확인 축**(추출 아님) — 지어낸 충돌이 구조적으로 0",
        "🟢 상세설명은 SAME 을 **막지 않지만 DIFFERENT 를 가르지도 못한다** — 분모 7·11·26 에서 재현",
      ],
      needsMoreEvidence: [
        "🔴 GT 라벨이 작다 — 식별축 26 중 13 · 양쪽원문 11 중 **최신 5**(비율로 희석하지 않는다)",
        "🔴 `BASELINE_NOT_REPRODUCED` 5쌍 — 그 쌍의 축 수치는 「운영이 지금 그 값을 낸다」로 쓸 수 없다",
        "🔴 `COLOR_VARIANT` 는 한글 색상 표기 표본이 **없다**(소스 주석이 미측정이라 적는다)",
        "🔴 `IMAGE` 축의 운영 기여도 — SAME 정원 밖이라 이 자산들로 **측정되지 않았다**",
        "🔴 A군 33 중 22쌍은 **양쪽 원문 없음** ⟹ 비교 불가(0% 아님)",
        "🔴 Production API 에서 전략이 실제로 내는 verdict 분포 — **미검증**(CTO 가 꺼낼 수 없다)",
      ],
      /* 🔴 교차 확인 — 보강이 기존 결론을 흔들지 않았다 */
      consistency: {
        boostedGuardChangedPairs: boosted.guardChangedPairs,
        leverSafetyUnchanged: a.leverSafety,
        riskCodeMatchButHumanDifferent: {
          identityAxis26_latest: recount.a.latest.riskCodeMatchButHumanDifferent,
          bothFullText11_latest: 1,
          note:
            "🔴 **분모가 다르다** — 26 에서는 최신 GT 로 0 이 됐고, 11 에서는 `C22/donokids` 1건이다. " +
            "🟢 그 1건은 `PRINT_PATTERN MISMATCH` 가 막는다(한 축으로 판정하지 않는 원칙이 작동)",
        },
        candidateQuality: { buckets: c.buckets, hosts: c.hostsPerBucket },
      },
      verdict:
        "🔴 **안정화 가능 항목 5 · 추가 근거 필요 항목 6.** 운영 변경 0 이고, " +
        "**안전한 범용 개선 레버는 이 단계에서도 발견되지 않았다**(C·A 결론 유지).",
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🔴 두 묶음이 **둘 다 비어 있지 않다** — 한쪽만 적으면 그림이 거짓이 된다. */
    expect(out.stabilizable.length).toBeGreaterThan(0);
    expect(out.needsMoreEvidence.length).toBeGreaterThan(0);
    /** 🟢 보강이 가드 효과를 바꾸지 않았다(A④ 재현). */
    expect(out.consistency.boostedGuardChangedPairs).toBe(0);
  });

  it("S-5 🔴 이 WU 가 **운영·동결 경계를 넘지 않았다**", () => {
    const self = bare(path.join(HERE, "kids-identity-strategy-stabilization.test.ts"));
    for (const token of [
      ["writeFileSync(", "CROSS"],
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["DATABASE", "_URL"],
      ["brandModelCode", " ="],
    ].map(([a, b]) => `${a}${b}`)) {
      expect(self, `🔴 ${token} — 검증 WU 가 경계를 넘었다`).not.toContain(token);
    }
    /** 🟢 운영 소스는 **읽기만** 했다. */
    expect(self).toContain("readFileSync");
    expect(self).toContain('"preserved", "kids-identity-strategy-stabilization.json"');
  });
});
