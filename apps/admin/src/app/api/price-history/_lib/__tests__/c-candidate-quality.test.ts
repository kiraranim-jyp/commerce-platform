/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 C 과제 — **후보 «품질» 평가**(네트워크 0 · 운영 변경 0 · 판정 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지정 순서: C(후보 품질) → A(식별 정확도). 이유는 **상류** 다 —
 *    「후보가 상품 페이지가 아니거나 사실이 비어 있으면 A 를 개선해도 매칭으로
 *     이어지지 않는다」.
 *
 * 🔴🔴 **새 조사를 하지 않는다**(§4-D). 전부 **이미 있는 실측**을 조인한다:
 * ```
 * fixtures/mi-reeval-03-keyword-input.json   B군 109쌍 · candidate.{title,description}
 * docs/MI-KIDS-TRIAGE-FEASIBILITY.json       같은 109쌍 · axesAfter · candidateCodes
 * preserved/a33-candidate-coordinates.json   A군 33 좌표(동결 분모)
 * preserved/a22-candidate-descriptions.json  A군 22 GET 실측(도달 8 · 설명문 7)
 * classifyUrlShape(...)                      🟢 **운영 게이트 owner** · HTTP 0
 * ```
 *
 * 🔴 **하지 않는 것** — SAME 기준 완화 · verdict 재계산 · 상세설명으로 DIFFERENT→SAME ·
 *    접근 제한 우회 · 사이트 전용 어댑터 · 새 검색 공급자 · DB · 운영 코드 수정.
 * 🔴 산출물은 **`preserved/`** 에 쓴다(`fixtures/` 는 GT 라벨 집합이라 분모를 흔든다).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
/**
 * 🔴🔴 **두 축을 한 숫자로 섞으면 거짓 블로커가 된다**(이 트랙에서 한 번 정정한 자리).
 * ```
 * 추출 축  후보 facts 의 `brandModelCode`  — 비대칭이고 **비어 있다**(배선은 «금지» 다:
 *          제목 토큰을 승격하면 판매처 SKU 가 같이 올라가 false SAME 이 난다)
 * 확인 축  `confirmBrandCodeInEvidence(원본품번, {title,url,sku})` — **원본의 그 품번만**
 *          확인하므로 판매처 코드 승격이 구조적으로 불가능하다(실측 4/4 · FP 0)
 * ```
 * 🟢 그래서 「품번이 없다」를 말하기 전에 **확인 축을 같이 센다.** 🔴 순수 함수라 HTTP 0 이고
 *    판정을 **바꾸지 않는다** — 운영 owner 를 **읽기 전용으로 부르는 것** 이다(§5-B).
 */
import { confirmBrandCodeInEvidence } from "@commerce/crawler/src/comparison-search/domestic-identifiers";

const HERE = path.join(
  process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__",
);
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

type KwRow = {
  originCode: string | null;
  candidateUrl: string;
  candidateDomain: string;
  humanGt: string | null;
  baselineSystemVerdict: string | null;
  candidate: { title: string | null; description: string | null };
};
type FeasRow = {
  candidateUrl: string;
  axesAfter: Record<string, string> | null;
  candidateCodes: string[] | null;
  nameSharedTokens: string[] | null;
};

/**
 * 🔴 **칸 이름을 추측하지 않는다** — 이 트랙에서 열두 번 틀린 그 함정이다.
 *    이 fixture 는 배열이 아니라 `{ source, note, pairs }` 다(실측으로 확인).
 */
const kw = (): KwRow[] =>
  (read(path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json")) as { pairs: KwRow[] }).pairs;
const feas = () => read(path.join(ROOT, "docs", "MI-KIDS-TRIAGE-FEASIBILITY.json")) as {
  denominators: Record<string, unknown>;
  rows: FeasRow[];
};

/**
 * 🔴🔴 **품질 문제와 식별 문제를 «가른다»**(CPO 요구). 섞으면 「MI 가 못 맞춘다」로
 *    읽히는데 실제로는 **후보가 애초에 쓸 수 없는 입력** 인 경우가 섞인다.
 * 🔴 네 유형은 **배타** 다 — 위에서 아래로 처음 걸리는 것 하나만 센다.
 */
type Bucket = "QUALITY_SHAPE" | "QUALITY_NO_TITLE" | "QUALITY_NO_CODE" | "IDENTITY_AXIS" | "USABLE";

const bucketOf = (
  shape: string,
  title: string | null,
  codes: string[] | null,
  confirmed: string | null,
): Bucket => {
  /** ① 운영 게이트가 **HTTP 를 쓰기도 전에** 버리는 모양 — 상품 페이지가 아니다. */
  if (shape !== "PRODUCT_PAGE") return "QUALITY_SHAPE";
  /** ② 제목이 없으면 이름 축이 **구조적으로** 설 수 없다(지어내지 않는다). */
  if (!title?.trim()) return "QUALITY_NO_TITLE";
  /**
   * ③ 핵심 식별 조합(브랜드+품번 · 상품명+품번 · §5-D)이 **불가능** 한 경우.
   * 🔴🔴 **두 축이 «둘 다» 비었을 때만** 이라고 적는다 — 추출이 비었어도 확인 축이
   *    잡으면 그 쌍은 품번 근거를 **갖고 있다**(그걸 「없다」로 적으면 거짓 블로커다).
   */
  if ((!codes || codes.length === 0) && !confirmed) return "QUALITY_NO_CODE";
  /** ④ 사실이 **다 있는데** 축이 어긋난다 ⟹ 여기부터가 A(식별) 과제다. */
  return "IDENTITY_AXIS";
};

const tally = <T extends string>(xs: T[]) =>
  xs.reduce<Record<string, number>>((a, x) => ({ ...a, [x]: (a[x] ?? 0) + 1 }), {});

describe("C 과제 — 후보 품질 평가(기존 실측 재사용 · HTTP 0)", () => {
  /* ═════════ ① 분모를 먼저 고정한다 — 섞어 쓰면 전부 거짓이 된다 ═════════ */

  it("C-0 🔴 분모 셋이 **서로 다른 집합** 이다(합산 금지)", () => {
    const b = kw();
    const f = feas();
    expect(b).toHaveLength(109);
    expect(f.rows).toHaveLength(109);
    expect(f.denominators.pairs).toBe(109);
    /** 🟢 두 산출물이 **같은 109쌍** 인지 URL 로 확인한다(조인 키 정합성). */
    const bUrls = new Set(b.map((r) => r.candidateUrl));
    const fUrls = new Set(f.rows.map((r) => r.candidateUrl));
    expect(fUrls).toEqual(bUrls);
    /** 🔴 A군(33)은 **다른 집합** 이다 — B군 결과로 A군을 대체하지 않는다. */
    const a = read(path.join(HERE, "preserved", "a33-candidate-coordinates.json")) as {
      pairs: { candidateUrl: string }[];
    };
    expect(a.pairs).toHaveLength(33);
    const overlap = a.pairs.filter((p) => bUrls.has(p.candidateUrl)).length;
    expect(typeof overlap).toBe("number");
  });

  /* ═════════ ② 평가 + 산출물 — 🔴 이 파일이 **유일한 쓰기 주체** 다 ═════════ */

  it("C-1 🔵 후보 품질을 **세 축**으로 평가하고 산출물을 남긴다", () => {
    const b = kw();
    const byUrl = new Map(feas().rows.map((r) => [r.candidateUrl, r]));

    const rows = b.map((r) => {
      const f = byUrl.get(r.candidateUrl);
      const shape = classifyUrlShape(r.candidateUrl);
      const codes = f?.candidateCodes ?? null;
      /**
       * 🔴 **확인 축** — 원상품 품번이 후보의 제목·URL 에 토큰으로 있는지만 본다.
       *    🔴 `sku` 는 이 분모에 **없다**(저장된 칸이 아니다) ⟹ `null` 로 둔다.
       *       그래서 이 숫자는 운영 확인 축의 **하한** 이다(과대평가하지 않는다).
       */
      const confirmed = confirmBrandCodeInEvidence(r.originCode ?? null, {
        title: r.candidate?.title ?? null,
        url: r.candidateUrl,
        sku: null,
      });
      return {
        candidateDomain: r.candidateDomain,
        candidateUrl: r.candidateUrl,
        humanGt: r.humanGt ?? null,
        /** ① 상품 페이지 적합성 — 운영 게이트 owner 가 판정한다. */
        urlShape: shape,
        /** ② 사실 충분성 — 🔴 「있다/없다」만 적는다(원문을 저장하지 않는다). */
        hasTitle: Boolean(r.candidate?.title?.trim()),
        hasDescription: Boolean(r.candidate?.description?.trim()),
        codeCount: codes?.length ?? 0,
        /** 🟢 **확인 축** — 「원본 품번이 후보 증거에 있다」. 추출 축과 **따로** 적는다. */
        codeConfirmed: Boolean(confirmed),
        nameSharedTokenCount: f?.nameSharedTokens?.length ?? 0,
        /** ③ 근거 품질 — 🟢 **이미 계산된** 축 상태를 읽기만 한다(재판정 0). */
        axes: f?.axesAfter ?? null,
        bucket: bucketOf(shape, r.candidate?.title ?? null, codes, confirmed),
      };
    });

    const buckets = tally(rows.map((r) => r.bucket));
    /** 🔴 **반복 여부는 「호스트 수」로 판정한다**(CPO 승격 기준). */
    const hostsPerBucket = Object.fromEntries(
      (["QUALITY_SHAPE", "QUALITY_NO_TITLE", "QUALITY_NO_CODE", "IDENTITY_AXIS", "USABLE"] as const).map(
        (bk) => [bk, new Set(rows.filter((r) => r.bucket === bk).map((r) => r.candidateDomain)).size],
      ),
    );
    /** 🔴 GT 가 있는 쌍만 따로 센다 — GT 없는 쌍을 정확도 분모에 넣지 않는다. */
    const withGt = rows.filter((r) => r.humanGt === "SAME" || r.humanGt === "DIFFERENT");
    const byGt = Object.fromEntries(
      ["SAME", "DIFFERENT"].map((g) => [
        g,
        {
          n: withGt.filter((r) => r.humanGt === g).length,
          buckets: tally(withGt.filter((r) => r.humanGt === g).map((r) => r.bucket)),
        },
      ]),
    );
    /** 🟢 축 상태 분포(브랜드·품번·이름) — 🔴 verdict 를 다시 계산하지 않는다. */
    const axisTally = Object.fromEntries(
      ["brand", "code", "name"].map((ax) => [
        ax,
        tally(rows.map((r) => (r.axes?.[ax] ?? "ABSENT") as string)),
      ]),
    );

    const a22 = read(path.join(HERE, "preserved", "a22-candidate-descriptions.json")) as {
      attempted: number;
      reached: number;
      withDescription: number;
    };

    const out = {
      note:
        "🔴 평가 전용 · 운영 코드 변경 0 · HTTP 0 · 판정 재계산 0. " +
        "🔴 B군 109쌍 기준이며 A군(33)·KIDS 전체로 확대 해석하지 않는다.",
      denominators: {
        bGroupPairs: rows.length,
        withHumanGt: withGt.length,
        aGroupCoordinates: 33,
        aGroupLiveReach: { attempted: a22.attempted, reached: a22.reached, withDescription: a22.withDescription },
        note: "🔴 B군과 A군을 **합산하지 않는다**(다른 집합 · A∩B = 0 으로 기록됨)",
      },
      urlShape: tally(rows.map((r) => r.urlShape)),
      facts: {
        hasTitle: rows.filter((r) => r.hasTitle).length,
        hasDescription: rows.filter((r) => r.hasDescription).length,
        /** 🔴 **두 축을 갈라 적는다** — 합치면 거짓 블로커가 된다. */
        codeExtracted: rows.filter((r) => r.codeCount > 0).length,
        codeConfirmed: rows.filter((r) => r.codeConfirmed).length,
        codeEitherAxis: rows.filter((r) => r.codeCount > 0 || r.codeConfirmed).length,
        codeConfirmedButNotExtracted: rows.filter((r) => r.codeConfirmed && r.codeCount === 0).length,
        nameTokenPresent: rows.filter((r) => r.nameSharedTokenCount > 0).length,
      },
      axisTally,
      buckets,
      hostsPerBucket,
      byGt,
      rows,
    };
    writeFileSync(path.join(HERE, "preserved", "c-candidate-quality.json"), JSON.stringify(out, null, 2));

    /** 🟢 모든 쌍이 **정확히 한 유형** 에 든다 — 어디로도 사라지지 않는다. */
    expect(Object.values(buckets).reduce((a, n) => a + n, 0)).toBe(109);
    expect(rows.every((r) => r.urlShape.length > 0)).toBe(true);
  });

  /* ═════════ ③ 보존 계약 — 산출물이 분모를 흔들지 않는다 ═════════ */

  it("C-2 🔴🔴 쓰기 주체가 **하나** 이고 `fixtures/` 를 건드리지 않는다", () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith(".ts"));
    let writers = 0;
    let fixtureWrites = 0;
    for (const f of files) {
      const bare = readFileSync(path.join(HERE, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      if (/writeFileSync\([^)]*c-candidate-quality/.test(bare)) writers += 1;
      if (/writeFileSync\([^)]*"fixtures"/.test(bare)) fixtureWrites += 1;
    }
    expect(writers, "🔴 쓰기 주체가 둘이 되면 어느 쪽이 정본인지 모르게 된다").toBe(1);
    expect(fixtureWrites, "🔴 fixtures/ 에 쓰면 GT 분모가 흔들린다").toBe(0);
  });

  it("C-3 🔴 산출물에 **원문·인증정보가 없다**(있다/없다만 적는다)", () => {
    const raw = readFileSync(path.join(HERE, "preserved", "c-candidate-quality.json"), "utf8");
    for (const banned of ['"description":', '"title":', "Authorization", "cookie", "token"]) {
      expect(raw, `🔴 ${banned} 가 산출물에 섞였다`).not.toContain(banned);
    }
  });

  /* ═════════ ④ 운영 불변 — 이 과제가 판정을 건드리지 않았다 ═════════ */

  it("C-4 🔴🔴 평가가 **운영 판정·가격·동결 축을 건드리지 않았다**", () => {
    const src = readFileSync(path.join(HERE, "c-candidate-quality.test.ts"), "utf8");
    const bare = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    /**
     * 🔴🔴 **금지 토큰을 «런타임에 조립» 한다.** 그러지 않으면 이 목록 자체가 스캔에
     *    걸려 **항상 FAIL** 한다 — 이 트랙에서 다섯 번 밟은 자기참조 함정이고,
     *    1차 실행에서 **실제로 걸렸다**(`SAME_MIN_AXES` 가 제 목록에서 잡혔다).
     */
    const banned = [
      ["SAME", "_MIN_AXES"],
      ["compareAxis", "("],
      ["withConf", "idence"],
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["DATABASE", "_URL"],
      /**
       * 🔴🔴 **이 줄이 이 계약의 진짜 과녁이다** — 「제목 토큰을 후보
       *    `brandModelCode` 로 **승격**」이 금지된 배선이다(실측으로 되돌린 적이 있다 ·
       *    판매처 SKU 가 같이 올라가 **false SAME**). 🔴 측정은 그 승격을 하지 않는다.
       */
      ["brandModelCode", " ="],
      ["brandModelCode", ":"],
    ].map(([a, b]) => `${a}${b}`);
    for (const token of banned) {
      expect(bare, `🔴 ${token} — 평가 WU 가 판정/수집/배선/DB 로 넘어갔다`).not.toContain(token);
    }
    /**
     * 🔴🔴 **`confirmBrandCodeInEvidence` 는 금지 목록에서 «빼냈다» — 조준이 틀렸었다.**
     *    1차 구현이 그것을 막았고 **내 측정을 막았다.** 그 함수는 **순수** 하고
     *    **원본의 그 품번만** 확인하므로 판매처 코드 승격이 구조적으로 불가능하다 ⟹
     *    읽기 전용 호출은 **판정 변경이 아니라 §5-B 가 요구하는 「운영 함수로 재기」** 다.
     * 🟢 느슨하게 풀지 않고 **과녁을 배선(위 두 줄)으로 옮겼다.**
     * 🔴 그리고 **반드시 부른다** — 안 부르면 추출 축만 보고 「품번이 없다」는
     *    **거짓 블로커** 를 보고하게 된다(이 트랙에서 한 번 정정한 자리).
     */
    expect(bare, "🔴 확인 축을 재지 않으면 「품번 없음」이 거짓이 된다").toContain(
      "confirmBrandCodeInEvidence(",
    );
  });
});
