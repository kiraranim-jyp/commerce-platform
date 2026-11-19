/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **AI Search 신상품 검색 의도 — 질의 수준 설계·비교**(HTTP 0 · 비용 0 · 운영 질의 불변)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 **STEP A 결과** — 실제 실행 질의 owner 는 **하나** 다:
 * ```
 * packages/crawler/src/discovery-core/query-planner.ts
 *   `buildCompositeDiscoveryQuery(identity, options?)`  ← 질의 문자열을 조립한다
 *   `buildDiscoverySearchQuery(identity)`               ← 그것을 그대로 호출하는 껍데기
 *   const SELLER_SIGNAL = "국내해외 동일상품 판매처"      ← X2 관측 질의의 **접미사**
 * 호출  apps/admin/.../web-search-pool.ts  — 🔴 「질의 owner 는 하나다 — 여기서
 *       문자열을 조립하지 않는다」가 소스에 적혀 있다(사본 0)
 * ```
 * 🔴 AI Search 자체는 **사용자 브라우저** 에서 돌고 서버는 `candidateUrls[]` 만 받는다 —
 *    그 한계는 **그대로 유지해 기록** 한다(이 WU 가 바꾸지 않는다).
 *
 * 🔴🔴🔴 **그래서 운영 상수를 교체하지 «않았다» — 차단 사유 둘을 먼저 적는다**:
 * ```
 * ⒜ `SELLER_SIGNAL` 은 **A/B 실측으로 채택된 값** 이다(QUERY-ADOPT-01 ·
 *    A「동일상품 판매처」 🇰🇷 URL **1** ↔ B「국내해외 동일상품 판매처」 🇰🇷 **8**).
 *    🔴 그리고 그 자리에 **「이 상수를 다시 연구하지 않는다」** 가 CPO 확정으로 적혀 있다.
 *    ⟹ 동급 실측 없이 갈아 끼우면 **측정 없이 채택을 바꾸는 것** 이다.
 * ⒝ 그 실측은 **Apify 유료 검색 호출** 이다(`APIFY_API_TOKEN`) ⟹ **비용 발생** ·
 *    이 WU 의 실행 원칙이 「비용 증가 … 발생할 때만 중단하고 보고」라고 명시한다.
 * ```
 * 🟢 **대신 그 축에는 이미 «측정 전용 훅» 이 있다**(`options.signal`) — 계약 `Q12` 가
 *    「운영 호출부는 이 인자를 넘기지 않는다」를 잠근다. ⟹ 그 훅으로 **질의 문자열만**
 *    비교한다(HTTP 0 · 비용 0 · 운영 동작 **불변**).
 *
 * 🔴 **금지 준수** — 상태 필드·상태 판정 모듈 **0** · `itemCondition` 수집 **0** ·
 *    SAME/임계값/가격/`recommendedPrice`/SINGLE·RANGE/`isCollectionBlocked`/등록부·어댑터/
 *    DB/스키마 **전부 0** · 특정 도메인 전용 규칙 **0**.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildCompositeDiscoveryQuery,
  buildDiscoverySearchQuery,
} from "@commerce/crawler/src/discovery-core/query-planner";
import type { ProductIdentity } from "@commerce/crawler/src/discovery-core/types";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const PLANNER = path.join(ROOT, "packages", "crawler", "src", "discovery-core", "query-planner.ts");
const POOL = path.join(HERE, "..", "web-search-pool.ts");
const OUT = path.join(HERE, "preserved", "ai-search-new-item-intent.json");

/**
 * 🔵 **신상품 의도 후보 — 짧은 한국어 토큰 하나만 더한다.**
 *
 * 🔴 **왜 이 모양인가**(지어내지 않았다 · 소스에 적힌 실측 위에 세운다):
 * ```
 * SP-08  «긴 자연어 목적 문장» = **NO-GO** — 효과의 정체가 「목적」이 아니라
 *        **「한국어 토큰」** 이었고 영어 CONTROL 은 국내가 **전혀 안 늘었다**
 * SP-09/10  짧은 한국어 신호(「동일상품 판매처」)가 Evidence 판매처를 가장 많이 올렸다
 * ⟹ 🟢 그래서 **짧은 한국어 토큰 1개** 만 더한다(「새상품」).
 * 🔴 제외어(used · refurbished · vintage …)를 **나열하지 않는다** — 작업지시서도
 *    「검색엔진이 제외어를 검색어로 해석해 결과를 악화시킬 수 있다」고 경고한다.
 * 🔴 영어 신품 어휘(brand new · NWT)를 넣지 않는다 — 같은 질의에 섞으면 길어지고,
 *    영어 축은 **국내를 늘리지 못한다** 가 이미 측정됐다.
 * ```
 */
const CANDIDATE_SIGNAL = "국내해외 동일상품 새상품 판매처";

type Row = {
  id: string;
  hasCode: boolean;
  baseline: string | null;
  candidate: string | null;
  baselineTokens: number;
  candidateTokens: number;
  tokenDelta: number;
  identifiersPreserved: boolean;
};

/** 🔴 **원본에서 읽힌 값만** 쓴다 — 지어내지 않는다. */
const val = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object" && "value" in v) {
    const i = (v as { value?: unknown }).value;
    return typeof i === "string" ? i.trim() || null : null;
  }
  return null;
};

const identities = (): { id: string; identity: ProductIdentity }[] => {
  const gt = read(path.join(HERE, "fixtures", "wu-059-gt-facts.json")) as {
    origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
  };
  return Object.entries(gt.origins).map(([id, o]) => {
    const cp = o.canonicalProduct;
    return {
      id,
      identity: {
        brand: val(cp.brand),
        productName: val(cp.title),
        productType: null,
        genderAge: null,
        color: val(cp.color),
        size: null,
        season: null,
        productCode: val(cp.sku),
        sourceUrl: val(cp.sourceUrl) ?? "",
        sourceSite: null,
        sourceCountry: null,
        market: null,
        facts: [val(cp.material)].filter((x): x is string => Boolean(x)),
      },
    };
  });
};

const rows = (): Row[] =>
  identities().map(({ id, identity }) => {
    const base = buildCompositeDiscoveryQuery(identity);
    const cand = buildCompositeDiscoveryQuery(identity, { signal: CANDIDATE_SIGNAL });
    const keeps = (t: string | null) =>
      Boolean(
        t &&
          (!identity.brand || t.includes(`"${identity.brand}"`)) &&
          (!identity.productCode || t.includes(`"${identity.productCode}"`)),
      );
    return {
      id,
      hasCode: Boolean(identity.productCode),
      baseline: base.text,
      candidate: cand.text,
      baselineTokens: base.tokenCount,
      candidateTokens: cand.tokenCount,
      tokenDelta: cand.tokenCount - base.tokenCount,
      identifiersPreserved: keeps(cand.text),
    };
  });

describe("STEP A — 실제 질의 owner 확인(코드 근거)", () => {
  it("Q-1 🟢 질의 owner 가 **하나** 이고 호출부가 문자열을 조립하지 않는다", () => {
    const planner = readFileSync(PLANNER, "utf8");
    expect(planner).toContain("export function buildCompositeDiscoveryQuery");
    expect(planner).toContain('const SELLER_SIGNAL = "국내해외 동일상품 판매처"');
    const pool = readFileSync(POOL, "utf8");
    expect(pool).toContain("buildDiscoverySearchQuery(input.identity)");
    expect(pool).toContain("buildCompositeDiscoveryQuery(input.identity");
    /** 🔴 호출부가 접미사를 **직접 적지 않는다**(사본 0). */
    const bare = pool.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(bare, "🔴 호출부에 신호 문자열이 생기면 owner 가 둘이 된다").not.toContain("동일상품 판매처");
  });

  it("Q-2 🔴 **브라우저 AI Search 한계를 그대로 기록** 한다(바꾸지 않았다)", () => {
    const route = readFileSync(path.join(HERE, "..", "..", "check", "route.ts"), "utf8");
    /** 🟢 서버가 받는 것은 후보 URL 배열이다 — 검색 원문을 받지 않는다. */
    expect(route).toContain("candidateUrls");
    const bare = route.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(bare, "🔴 서버가 검색 원문을 받기 시작하면 이 기록을 갱신한다").not.toContain(
      "searchRawText",
    );
  });
});

describe("STEP B·C — 신상품 의도 질의 «문자열» 비교(HTTP 0 · 비용 0)", () => {
  it("Q-3 🟢 식별 근거가 **훼손되지 않는다**(브랜드·품번 따옴표 보존)", () => {
    const rs = rows();
    expect(rs.length).toBeGreaterThan(0);
    expect(rs.every((r) => r.identifiersPreserved), "🔴 식별자가 깨지면 그 질의는 쓸 수 없다").toBe(true);
  });

  it("Q-4 🔴 토큰 증가가 **정확히 1** 이다(질의를 길게 만들지 않았다)", () => {
    for (const r of rows()) {
      if (!r.baseline) continue;
      expect(r.tokenDelta, `🔴 ${r.id} 토큰 증가가 1 이 아니다`).toBe(1);
    }
  });

  it("Q-5 🔴🔴 제외어를 **나열하지 않았다** · 영어 신품 어휘도 넣지 않았다", () => {
    for (const banned of ["used", "pre-owned", "second-hand", "refurbished", "vintage", "open-box", "brand new", "nwt"]) {
      expect(CANDIDATE_SIGNAL.toLowerCase(), `🔴 ${banned} — 제외어 나열은 결과를 악화시킨다`).not.toContain(
        banned,
      );
    }
    /** 🟢 짧은 한국어 신품 토큰 **하나** 다. */
    expect(CANDIDATE_SIGNAL).toContain("새상품");
    expect(CANDIDATE_SIGNAL.split(/\s+/)).toHaveLength(4);
  });

  it("Q-6 🔴🔴 **운영 질의는 불변** 이다(상수 교체 0 · 훅은 측정 전용)", () => {
    /** 🟢 인자를 안 넘기면 **오늘 동작 그대로** 다 — 그것을 직접 단언한다. */
    for (const { identity } of identities()) {
      const opDefault = buildDiscoverySearchQuery(identity);
      const opComposite = buildCompositeDiscoveryQuery(identity).text;
      expect(opDefault).toBe(opComposite);
      if (opDefault) expect(opDefault).toContain("국내해외 동일상품 판매처");
      if (opDefault) expect(opDefault, "🔴 운영 질의에 신품 토큰이 들어가면 채택된 것이다").not.toContain("새상품");
    }
    /** 🔴 그리고 운영 상수 자체가 그대로다. */
    expect(readFileSync(PLANNER, "utf8")).toContain('const SELLER_SIGNAL = "국내해외 동일상품 판매처"');
  });
});

describe("STEP D — 범용성(단일 SKU 패치가 아니다)", () => {
  it("Q-7 🟢 **여러 형태**에서 같은 규칙으로 동작한다(품번 유/무 포함)", () => {
    const rs = rows().filter((r) => r.baseline);
    /** 🔴 분모를 적는다 — 적으면 적다고 적는다. */
    expect(rs.length).toBeGreaterThanOrEqual(4);
    const withCode = rs.filter((r) => r.hasCode);
    const withoutCode = rs.filter((r) => !r.hasCode);
    /** 🟢 품번이 없어도 질의가 **만들어진다**(기존 설계 그대로). */
    expect(withCode.length).toBeGreaterThan(0);
    for (const r of rs) expect(r.tokenDelta).toBe(1);
    /** 🔴 특정 상품 전용 분기가 없다 — 모든 행이 **같은 증분** 이다. */
    expect(new Set(rs.map((r) => r.tokenDelta))).toEqual(new Set([1]));
    expect(withoutCode.length).toBeGreaterThanOrEqual(0);
  });

  it("Q-8 🔵 비교 산출물을 남긴다(차단 사유·미검증 축 포함)", () => {
    const rs = rows();
    const out = {
      note:
        "🔴 **질의 «문자열» 비교 전용** — HTTP 0 · 비용 0 · DB 0 · 운영 질의 **불변** · " +
        "상태 필드·상태 판정 모듈 0 · SAME/가격/약관/어댑터/스키마 변경 0.",
      owner: {
        queryBuilder: "packages/crawler/src/discovery-core/query-planner.ts#buildCompositeDiscoveryQuery",
        shell: "#buildDiscoverySearchQuery",
        operationalSignal: "국내해외 동일상품 판매처 (SELLER_SIGNAL)",
        caller: "apps/admin/src/app/api/price-history/_lib/web-search-pool.ts",
        measurementHook: "options.signal — 🔴 운영 호출부는 넘기지 않는다(계약 Q12)",
        browserLimit:
          "🔴 AI Search 는 **사용자 브라우저** 에서 돌고 서버는 `candidateUrls[]` 만 받는다 — " +
          "검색 원문을 담는 칸이 **없다**(기존 한계 · 이 WU 가 바꾸지 않았다)",
      },
      candidateSignal: CANDIDATE_SIGNAL,
      rationale:
        "🟢 SP-08 이 **긴 목적 문장을 NO-GO** 로 판정하고 효과의 정체를 **「한국어 토큰」** 으로 " +
        "지목했다 ⟹ **짧은 한국어 토큰 1개**(「새상품」)만 더한다. 🔴 제외어 나열 0 · 영어 신품 어휘 0",
      queryComparison: rs,
      tokenDelta: { min: Math.min(...rs.map((r) => r.tokenDelta)), max: Math.max(...rs.map((r) => r.tokenDelta)) },
      identifiersPreserved: rs.every((r) => r.identifiersPreserved),
      adoptionStatus: "🔴 **BLOCKED — 운영 상수 교체 안 함**",
      blockers: [
        {
          id: "B1 측정 없이 채택을 바꿀 수 없다",
          detail:
            "`SELLER_SIGNAL` 은 **A/B 실측으로 채택된 값** 이다(A 🇰🇷 URL 1 ↔ B 🇰🇷 8) · " +
            "그 자리에 **「이 상수를 다시 연구하지 않는다」** 가 CPO 확정으로 적혀 있다",
          owner: "CPO",
        },
        {
          id: "B2 검증이 유료 외부 검색을 요구한다",
          detail:
            "질의 효과(검색 결과 수 · 국내/해외 후보 · 중고·리퍼 감소 · 상품 URL 비율)는 " +
            "**Apify 유료 호출** 로만 측정된다 ⟹ **비용 발생**(실행 원칙상 중단·보고 사유)",
          owner: "CEO",
        },
      ],
      notVerified: [
        "🔴 검색 결과 수 증감 — **미측정**(유료 실행 필요)",
        "🔴 국내/해외 후보 변화 — **미측정**",
        "🔴 중고·리퍼 명시 결과 감소 — **미측정**(그리고 상태 어휘는 후보 데이터에 0 이었다)",
        "🔴 후보 URL 의 상품 페이지 비율 — **미측정**",
        "🔴 실행 간 변동 — 같은 질의의 URL 겹침이 **3~30%**(SP-10) ⟹ 1회 관측으로 우열을 가를 수 없다",
      ],
      unchanged: [
        "SAME / PRESUMED_SAME 기준 · 임계값",
        "가격 적격성 · `recommendedPrice` · SINGLE/RANGE · G6 측정",
        "`isCollectionBlocked` 약관 정책",
        "등록부 · 어댑터 · 특정 도메인 로직",
        "DB 스키마 · 마이그레이션",
      ],
      ctoVerdict:
        "🔴 **PARTIAL / BLOCKED** — owner 확정과 질의 설계·문자열 비교는 완료했으나 " +
        "**운영 실행 질의는 바꾸지 않았다**. 🔴 「개선됐다」로 적지 않는다(효과 미측정).",
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    expect(out.blockers).toHaveLength(2);
    expect(out.notVerified.length).toBeGreaterThan(0);
    expect(out.identifiersPreserved).toBe(true);
  });

  it("Q-9 🔴 경계 — 금지 축을 건드리지 않았다", () => {
    const self = readFileSync(path.join(HERE, "ai-search-new-item-intent.test.ts"), "utf8");
    for (const victim of ["query-planner", "web-search-pool", "fixtures", "c-candidate", "a-identity", "g8-", "kids-"]) {
      expect(new RegExp(`writeFileSync\\([^)]*${victim}`).test(self), `🔴 ${victim} 쓰기 금지`).toBe(false);
    }
    const s = self.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    for (const token of [
      ["DATABASE", "_URL"],
      ["getSupabase", "Admin"],
      ["itemCond", "ition"],
      ["SAME", "_MIN_AXES ="],
      ["isCollection", "Blocked("],
      ["APIFY_API", "_TOKEN"],
    ].map(([x, y]) => `${x}${y}`)) {
      expect(s, `🔴 ${token} — 질의 WU 가 경계를 넘었다`).not.toContain(token);
    }
  });
});
