/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **STEP A-1 — 상품 «상태» 판별 근거 확인**(측정 전용 · HTTP 0 · DB 0 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 작업지시서 STEP A 의 **1번 요구사항** 이다 — 「기존 후보 데이터에서 상품 상태를
 *    판별할 수 있는 **근거를 확인한다**」. 🔴 게이트는 **적용하지 않았다**(아래 이유).
 *
 * 🔴🔴🔴 **측정 결과가 차단 사유를 만들었다.** 확보된 후보 전수에서 상태 신호가 **0** 이고
 *    운영에 상태를 읽는 칸·추출기도 **없다** ⟹ CEO 정책을 **문자 그대로** 적용하면
 *    (「명시적으로 신품임이 확인된 후보만 NEW」 + 「UNKNOWN 은 비교 대상 제외」)
 *    **비교 집합이 국내·해외 모두 «전부» 비어버린다.**
 * 🔴 그래서 §6 의 **「범위 충돌」** 로 보고하고 **멈췄다** — 구현해서 「정책 적용 완료」로
 *    적으면 **셀러 화면에서 가격 비교가 사라진 것을 「준수」로 포장** 하는 것이 된다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
/** 🔴 주석을 **벗긴다** — 주석 속 어휘를 「구현됐다」로 세지 않는다. */
const bare = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const OUT = path.join(HERE, "preserved", "step-a1-item-condition-evidence.json");

/**
 * 🔴 **사이트 이름을 쓰지 않는다** — 상태 어휘만 본다(범용).
 * 🔴 그리고 이 패턴은 **측정 전용** 이다. 운영 판정 축이 아니다(게이트 미적용).
 */
const NEW_RE = /신품|새상품|미개봉|unused|brand ?new|new with tags?|\bnwt\b/i;
const REFURB_RE = /리퍼|리퍼비시|refurb|전시상품|진열상품|반품상품/i;
const USED_RE = /중고|세컨핸드|second[- ]?hand|pre-?owned|pre-?loved|\bused\b/i;

type Cond = "NEW" | "REFURBISHED" | "USED" | "UNKNOWN";
/** 🔴 **위험한 쪽을 먼저 본다** — 리퍼/중고 신호가 있으면 그것이 이긴다. */
const classify = (title: string | null, desc: string | null): Cond => {
  const s = `${title ?? ""} ${desc ?? ""}`;
  if (REFURB_RE.test(s)) return "REFURBISHED";
  if (USED_RE.test(s)) return "USED";
  if (NEW_RE.test(s)) return "NEW";
  return "UNKNOWN";
};

const tally = (xs: Cond[]) =>
  xs.reduce<Record<string, number>>((a, x) => ({ ...a, [x]: (a[x] ?? 0) + 1 }), {});

describe("STEP A-1 — 상태 판별 근거(측정 전용 · 구현 0)", () => {
  /* ═══════ ① 운영에 상태를 «읽는» 칸이 없다 ═══════ */

  it("A1-1 🔴🔴 운영 타입·추출기에 **상태 칸이 없다**(코드 근거)", () => {
    const targets = [
      path.join(ROOT, "packages", "crawler", "src", "comparison-search", "types.ts"),
      path.join(ROOT, "packages", "shared", "src", "product-facts.ts"),
      path.join(ROOT, "packages", "crawler", "src", "comparison-search", "seller-facts.ts"),
      path.join(ROOT, "packages", "crawler", "src", "comparison-search", "product-url-facts.ts"),
    ];
    for (const f of targets) {
      const src = bare(f);
      for (const token of ["itemCondition", "REFURBISHED", "USED_ITEM", "리퍼", "중고"]) {
        expect(
          src,
          `🔴 ${path.basename(f)} 에 ${token} 이 생겼다 — 상태 축 신설은 **승인 사안** 이다`,
        ).not.toContain(token);
      }
    }
  });

  /* ═══════ ② 확보된 후보 전수에서 상태 신호가 0 ═══════ */

  it("A1-2 🔴🔴 후보 텍스트 **116건 전수** 에서 상태 신호가 **0** 이다", () => {
    const kw = (read(path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json")) as {
      pairs: { candidate: { title: string | null; description: string | null } | null }[];
    }).pairs;
    const a22 = (read(path.join(HERE, "preserved", "a22-candidate-descriptions.json")) as {
      rows: { hasDescription: boolean; title: string | null; description: string | null }[];
    }).rows.filter((r) => r.hasDescription);

    const bGroup = kw.map((r) => classify(r.candidate?.title ?? null, r.candidate?.description ?? null));
    const aGroup = a22.map((r) => classify(r.title, r.description));
    expect(bGroup).toHaveLength(109);
    expect(aGroup).toHaveLength(7);
    /** 🔴 **전건 UNKNOWN** — 명시 NEW 도 리퍼·중고도 없다. */
    expect(tally(bGroup)).toEqual({ UNKNOWN: 109 });
    expect(tally(aGroup)).toEqual({ UNKNOWN: 7 });
  });

  /* ═══════ ③ 🔴 정책 문자 적용의 «귀결» 을 수치로 고정 ═══════ */

  /**
   * 🔴🔴🔴 **이 단언이 차단 사유다.** 「UNKNOWN 제외」를 켜면 적격 후보가 **0** 이 된다.
   *    🔴 그러면 기존에 **해외에서 보이던 비교 근거까지 사라진다**(국내만의 문제가 아니다).
   * 🟢 나중에 상태 근거가 확보되면 이 단언이 **FAIL 로 뒤집히고** 그것이 진척의 증거다.
   */
  it("A1-3 🔴🔴 정책을 문자 그대로 적용하면 **적격 후보가 0** 이 된다", () => {
    /**
     * 🔴 **산출물을 읽지 않는다** — 1차 구현이 A1-5 보다 **먼저** 그 파일을 읽어
     *    순서 의존이 생겼다(파일이 없으면 FAIL). 🟢 같은 입력에서 **직접 계산** 한다.
     */
    const kw = (read(path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json")) as {
      pairs: { candidate: { title: string | null; description: string | null } | null }[];
    }).pairs;
    const a22 = (read(path.join(HERE, "preserved", "a22-candidate-descriptions.json")) as {
      rows: { hasDescription: boolean; title: string | null; description: string | null }[];
    }).rows.filter((r) => r.hasDescription);
    const conds: Cond[] = [
      ...kw.map((r) => classify(r.candidate?.title ?? null, r.candidate?.description ?? null)),
      ...a22.map((r) => classify(r.title, r.description)),
    ];
    const newCount = conds.filter((c) => c === "NEW").length;
    expect(newCount, "🟢 이 값이 0 을 넘으면 정책을 적용할 수 있다").toBe(0);
    /** 🔴 적격 0 ⟹ 비교 집합이 비어버린다(국내·해외 공통). */
    expect(conds.length - newCount).toBe(conds.length);
  });

  /* ═══════ ④ D-4 계약을 우회·약화하지 않았다 ═══════ */

  it("A1-4 🔴 `D-4` 계약을 **그대로 유지**했다(삭제·약화·우회 0)", () => {
    const d4 = readFileSync(path.join(HERE, "domestic-discovery-gap-analysis.test.ts"), "utf8");
    /** 🟢 그 계약이 **살아 있다** — 상태 어휘가 owner 셋에 생기면 FAIL 한다. */
    expect(d4).toContain("D-4");
    expect(d4).toContain("상품 **상태 축(일반/리퍼/중고)이 운영에 없다**");
    expect(d4).toContain("itemCondition");
    /** 🔴 그러므로 이번에 상태 어휘를 운영 owner 에 넣지 **않았다**(A1-1 이 그것을 본다). */
  });

  /* ═══════ ⑤ 산출 — 근거 가용성과 측정불가를 «가른다» ═══════ */

  it("A1-5 🔵 근거 가용성·측정불가·선행 조건을 산출한다(구현 0)", () => {
    const kw = (read(path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json")) as {
      pairs: { candidateUrl: string; candidate: { title: string | null; description: string | null } | null }[];
    }).pairs;
    const a22 = (read(path.join(HERE, "preserved", "a22-candidate-descriptions.json")) as {
      rows: { hasDescription: boolean; title: string | null; description: string | null }[];
    }).rows.filter((r) => r.hasDescription);

    const rows = [
      ...kw.map((r) => ({
        group: "B_GROUP_109",
        hasTitle: Boolean(r.candidate?.title?.trim()),
        hasDescription: Boolean(r.candidate?.description?.trim()),
        condition: classify(r.candidate?.title ?? null, r.candidate?.description ?? null),
      })),
      ...a22.map((r) => ({
        group: "A_GROUP_7",
        hasTitle: Boolean(r.title?.trim()),
        hasDescription: Boolean(r.description?.trim()),
        condition: classify(r.title, r.description),
      })),
    ];
    const total = rows.length;
    const t = tally(rows.map((r) => r.condition));

    const out = {
      note:
        "🔴 **STEP A-1 측정 전용** — 구현 0 · 게이트 미적용 · HTTP 0 · DB 0 · GT 0 · " +
        "verdict 0 · SAME 기준 0 · G6 동결 유지 · 덮어쓰기 0 · 사이트 전용 처리 0.",
      policy: {
        source: "CEO 확정 — 신품(NEW)만 관리·비교 · REFURBISHED/USED/UNKNOWN 제외",
        litmus: "「명시적으로 신품임이 확인된 후보만 NEW」 + 「UNKNOWN 은 비교 대상 제외」",
      },
      evidenceAvailability: {
        /** 🔴 구조화 축 — **읽는 칸이 없다**(코드 근거 A1-1). */
        structured: {
          itemConditionExtracted: false,
          fieldOnCandidateType: false,
          note:
            "🔴 `itemCondition`(schema.org)·상태 칸이 운영 타입·추출기에 **없다** ⟹ " +
            "구조화 상태 근거는 **수집되고 있지 않다**(추출 축 신설은 이 WU 범위 밖)",
        },
        /** 🟢 텍스트 축 — 확보된 전수에서 **측정했다**. */
        textual: {
          denominatorRows: total,
          bGroupRows: 109,
          aGroupRows: 7,
          withTitle: rows.filter((r) => r.hasTitle).length,
          withDescription: rows.filter((r) => r.hasDescription).length,
          tally: t,
          note:
            "🔴 **전건 UNKNOWN** 이다 — 명시 신품 어휘도 리퍼·중고 어휘도 **0** 이다. " +
            "🟢 「제목·설명문이 없어서」가 아니다(제목 116/116 · 설명문 다수 보유)",
        },
      },
      /** 🔴🔴 정책 문자 적용의 귀결 — **수치로** 적는다. */
      eligibleIfPolicyApplied: {
        total,
        NEW: t.NEW ?? 0,
        REFURBISHED: t.REFURBISHED ?? 0,
        USED: t.USED ?? 0,
        UNKNOWN: t.UNKNOWN ?? 0,
        excluded: total - (t.NEW ?? 0),
        consequence:
          "🔴🔴 **비교 집합이 0 이 된다** — 국내만의 문제가 아니다. 기존에 해외에서 보이던 " +
          "비교 근거(동일상품 가격)까지 **전부 사라진다**",
      },
      /** 🔴 측정불가 — 「없다」로 적지 않는다. */
      unmeasurable: [
        {
          axis: "라이브 페이지의 JSON-LD `itemCondition`",
          why: "추출되지 않고(코드) **HTTP 0** 이라 확인할 수 없다",
          note: "🟡 schema.org 표준 칸이므로 **존재 가능성** 은 있다 — 🔴 있다고 가정하지 않는다",
        },
        {
          axis: "Shopify `tags` 의 상태 표기",
          why: "`tags` 는 facts 로 들어가지만 **산출물에 보존되지 않았다**",
          note: "🔴 0 으로 세지 않는다",
        },
        {
          axis: "등록부/DB 의 판매처 성격(리퍼 전문 여부)",
          why: "**DB 금지** · 그리고 도메인 성격으로 상태를 추정하는 것은 **사이트 전용 처리** 다",
          note: "🔴 금지 축이므로 열지 않았다",
        },
      ],
      /** 🔴 선행 조건 — 이 WU 가 **임의로 하지 않는다**. */
      prerequisitesForStepA: [
        {
          need: "상태 근거 **수집 축** 신설(예: JSON-LD `itemCondition` 읽기)",
          owner: "CPO",
          why: "STEP A 는 「**기존** 후보 데이터에서 판별」이 범위다 — 추출기 변경은 그 범위 밖이다",
          ctoCanOpen: false,
        },
        {
          need: "근거가 없을 때의 **제품 동작 결정**",
          owner: "CEO",
          why:
            "「UNKNOWN 제외」를 지금 켜면 **비교 기능이 사라진다** ⟹ 그 손실을 받아들일지, " +
            "아니면 근거 확보까지 **관측 전용** 으로 둘지는 **사업 결정** 이다",
          ctoCanOpen: false,
        },
      ],
      stepBStatus:
        "🔴 **착수하지 않았다** — CPO 가 「STEP A 검증이 통과하지 않으면 STEP B 를 완료 처리하지 " +
        "않는다」고 명시했고, STEP A 가 **차단** 됐다",
      ctoVerdict:
        "🔴 **BLOCKED** — 정책은 명확하고 구현 난이도도 낮지만, **판별 근거가 0** 이라 적용 즉시 " +
        "제품 기능이 사라진다. 🔴 임의로 「NEW 추정」을 넣지 않았다(정책 3번 위반) · " +
        "🔴 게이트를 끈 채 「적용 완료」로 적지도 않았다.",
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    expect(out.evidenceAvailability.textual.tally.UNKNOWN).toBe(total);
    /** 🔴 선행 조건 둘 **모두 CTO 범위 밖** 이다 — 「노력 부족」이 아니다. */
    expect(out.prerequisitesForStepA.every((p) => p.ctoCanOpen === false)).toBe(true);
    expect(out.unmeasurable.length).toBeGreaterThan(0);
  });

  it("A1-6 🔴 경계 — 게이트 **미적용** · 구현 0 · 금지 0", () => {
    const self = readFileSync(path.join(HERE, "step-a1-item-condition-evidence.test.ts"), "utf8");
    for (const victim of ["c-candidate", "a-identity", "g8-", "kids-", "a22-", "a07-", "fixtures", "MI-KIDS", "domestic-discovery"]) {
      expect(new RegExp(`writeFileSync\\([^)]*${victim}`).test(self), `🔴 ${victim} 덮어쓰기 금지`).toBe(false);
    }
    const s = self.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    for (const token of [
      ["DATABASE", "_URL"],
      ["getSupabase", "Admin"],
      ["fetchPlain", "Html"],
      ["judgeDomestic", "Candidate"],
      ["SAME", "_MIN_AXES ="],
      ["isPrice", "Displayable("],
      ["ADAPTER_BY_", "DOMAIN ="],
    ].map(([x, y]) => `${x}${y}`)) {
      expect(s, `🔴 ${token} — 측정 WU 가 경계를 넘었다`).not.toContain(token);
    }
  });
});
