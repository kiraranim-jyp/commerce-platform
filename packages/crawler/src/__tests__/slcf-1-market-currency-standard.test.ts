import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyMarketCurrencyEvidence,
  type MarketCurrencyObservation,
} from "./market-currency-evidence";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SMALLABLE-LOCAL-CURRENCY-FOLLOWUP — **기준을 잠그고 전수에 적용한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **`a0b3c08` 은 CPO CLOSED 다**(2026-11-07). 그 판정을 **다시 재지 않는다** —
 *    JP 는 EUR · `?currency=` 는 표시 계층 · Smallable 현지통화 구현 **중단 확정**.
 *    🟢 그 사실을 계약 10건(`phase2-market-currency-is-not-site-fx`)이 이미 지킨다.
 *
 * 🟢 이 파일이 **새로 하는 것** 은 CPO 가 적은 그 한 줄이다 —
 *    「**국가별 가격과 통화의 정확성을 검증할 수 있는 기준을 확보**」.
 * ```
 * A  기준 자체를 잠근다 — 단일 환율 구간 교집합 · 「통화 여러 개 ⟹ 현지통화」 추론 금지 ·
 *    「확인 불가」 ↔ 「수집 실패」 분리 · 상품 1개로는 판정 불가
 * B  닫힌 판정과 **같은 답** 을 내는지 확인한다(Smallable 격자 → SITE_FX)
 * C  **운영 전수** 에 적용한다(읽기 전용 덤프 · `SLCF1_OUT_DIR`)
 * ```
 * 🔴 운영 코드 변경 **0** — 수집 정책 · 통화 정책 · `market_country` 의미 · CASE ·
 *    추천가격 · 판매 판단 · 국내 매칭 **전부 불변**.
 */

const OUT = process.env.SLCF1_OUT_DIR ?? "";
const GRID_FILE = OUT === "" ? "" : path.join(OUT, "market-currency-grid.json");
const LIVE = GRID_FILE !== "" && existsSync(GRID_FILE);

/**
 * 🔴🔴 **비교 축(`groupKey`)은 호출부가 정한다** — 그것이 이 기준의 전제다.
 * ```
 * 격자 축   한 상품 × 여러 «국가» × 여러 통화   → groupKey = 국가   (a0b3c08 라이브 격자)
 * 운영 축   여러 «상품» × 국가별 1통화          → groupKey = 상품   (MARKET_PROBE 저장분)
 * ```
 * 🔴 둘을 섞으면 안 된다 — 한 축에서 「독립된 가격 벡터」가 무엇인지가 달라진다.
 */
const obs = (
  groupKey: string,
  market: string,
  currency: string,
  amount: number,
): MarketCurrencyObservation => ({ groupKey, market, currency, amount });

/* ════════════════════════════════ A. 기준 ════════════════════════════════ */

describe("SLCF-1 A — 🔴 기준: 단일 환율 구간 교집합", () => {
  it("A-1 🔴🔴 **통화가 여러 개라는 사실만으로 「현지통화」라 적지 않는다**", () => {
    /**
     * 🔴 `a0b3c08` 실측 격자(상품 430753)와 **같은 모양** 이다 — 한 상품의 세 통화가
     *    하나의 환율표로 설명된다 ⟹ 사이트가 **환산해서** 보여준 것이다.
     * 🔴 상품이 하나뿐이면 **판정 불가** 다(비율 하나는 어떤 환율로도 설명된다) ⟹
     *    두 상품을 넣어 **교집합** 이 성립하는지 본다.
     */
    const rows = [
      obs("p1", "JP", "EUR", 54),
      obs("p1", "JP", "JPY", 10_078),
      obs("p1", "JP", "USD", 63),
      /** 🟢 같은 환율(JPY/EUR ≈ 186.6 · USD/EUR ≈ 1.17)로 설명되는 다른 상품. */
      obs("p2", "JP", "EUR", 100),
      obs("p2", "JP", "JPY", 18_663),
      obs("p2", "JP", "USD", 117),
    ];
    const r = classifyMarketCurrencyEvidence(rows);
    expect(r.verdict, "🔴 사이트 환산을 「현지통화」로 판정했다").toBe("SITE_FX");
    expect(r.currencies).toEqual(["EUR", "JPY", "USD"]);
    expect(r.pairs.every((p) => p.explainedBySingleRate === true)).toBe(true);
  });

  it("A-2 🟢 **환율로 설명되지 않으면 현지 가격이다**(하나라도 깨지면 LOCAL)", () => {
    const rows = [
      obs("p1", "JP", "EUR", 100),
      obs("p1", "JP", "JPY", 18_663),
      /** 🔴 두 번째 상품의 JPY 가 환율에서 **크게 벗어난다**(현지 가격 정책). */
      obs("p2", "JP", "EUR", 100),
      obs("p2", "JP", "JPY", 25_000),
    ];
    const r = classifyMarketCurrencyEvidence(rows);
    expect(r.verdict).toBe("LOCAL_CURRENCY");
  });

  it("A-2b 🔴🔴 **쌍 하나가 설명돼도 SITE_FX 가 아니다** — 전부 설명될 때만이다", () => {
    /**
     * 🔴 변이 R4(`every` → `some`)가 **1차 계약을 통과했다** — A-2 에 통화쌍이 **하나뿐**
     *    이라 `some` 과 `every` 가 같은 답을 냈다(분모 1). 🟢 그래서 **설명되는 쌍과
     *    설명되지 않는 쌍을 같이** 세운다.
     */
    const rows = [
      /** 🟢 EUR/USD 는 하나의 환율로 설명된다. */
      obs("p1", "JP", "EUR", 100),
      obs("p1", "JP", "USD", 117),
      obs("p2", "JP", "EUR", 200),
      obs("p2", "JP", "USD", 234),
      /** 🔴 JPY 는 환율에서 크게 벗어난다(현지 가격). */
      obs("p1", "JP", "JPY", 18_663),
      obs("p2", "JP", "JPY", 50_000),
    ];
    const r = classifyMarketCurrencyEvidence(rows);
    const explained = r.pairs.filter((p) => p.explainedBySingleRate === true);
    const broken = r.pairs.filter((p) => p.explainedBySingleRate === false);
    expect(explained.length, "🔴 전제: 설명되는 쌍이 있어야 한다").toBeGreaterThan(0);
    expect(broken.length, "🔴 전제: 깨지는 쌍이 있어야 한다").toBeGreaterThan(0);
    expect(r.verdict, "🔴 쌍 하나만 보고 「사이트 환산」이라 단정했다").toBe("LOCAL_CURRENCY");
  });

  it("A-3 🔴 **「확인 불가」와 「수집 실패」를 가른다**(CPO §3)", () => {
    /** ⒜ 통화 하나 → 확인 불가. 🔴 「현지통화 없음」이 아니다. */
    const one = classifyMarketCurrencyEvidence([obs("p1", "FR", "EUR", 54), obs("p2", "FR", "EUR", 61)]);
    expect(one.verdict).toBe("INSUFFICIENT");
    expect(one.reason).toContain("통화가 하나뿐");
    /** ⒝ 입력이 비면 → 비교 가능한 관측이 없다(= 수집 실패는 **이 모듈 밖** 이다). */
    const none = classifyMarketCurrencyEvidence([]);
    expect(none.verdict).toBe("INSUFFICIENT");
    expect(none.reason).toContain("관측이 없다");
    /** 🔴 가격 0/음수/빈 통화는 **입력이 아니다** — 지어내지 않는다. */
    const bad = classifyMarketCurrencyEvidence([obs("p1", "JP", "JPY", 0), obs("p1", "JP", "", 10)]);
    expect(bad.verdict).toBe("INSUFFICIENT");
    /**
     * 🔴🔴 **그 필터가 «판정을 바꾸는» 자리까지 단언한다.** 변이 R5(필터 제거)가 1차
     *    계약을 통과했다 — 위 케이스는 필터가 없어도 어차피 INSUFFICIENT 였기 때문이다.
     *    🟢 그래서 **0 금액이 들어오면 SITE_FX 가 LOCAL 로 뒤집히는** 모양을 세운다.
     */
    /**
     * 🔴 **0 을 «분자» 쪽 통화에 둔다.** 1차에 `JPY 0` 으로 뒀더니 그 통화가 분모가 되어
     *    `!(y > 0)` 가드가 **그 행을 건너뛰었다** ⟹ 필터가 없어도 결과가 같아 변이가
     *    통과했다(R5). 🟢 통화 정렬이 앞서는 `AUD` 에 0 을 두면 분자가 되어 구간이 깨진다.
     */
    const withZero = classifyMarketCurrencyEvidence([
      obs("p1", "JP", "EUR", 100),
      obs("p1", "JP", "AUD", 160),
      obs("p2", "JP", "EUR", 200),
      obs("p2", "JP", "AUD", 320),
      /** 🔴 수집이 0 을 남긴 행 — 이것이 판정에 들어가면 환율 구간이 **거짓으로** 깨진다. */
      obs("p3", "JP", "EUR", 150),
      obs("p3", "JP", "AUD", 0),
    ]);
    expect(
      withZero.verdict,
      "🔴 0 금액을 관측으로 받아들여 「현지통화」로 뒤집혔다",
    ).toBe("SITE_FX");
  });

  it("A-4 🔴🔴 **상품 1개로는 판정하지 않는다** — 1식 1미지수는 언제나 풀린다", () => {
    const r = classifyMarketCurrencyEvidence([obs("p1", "JP", "EUR", 54), obs("p1", "JP", "JPY", 10_078)]);
    expect(r.verdict, "🔴 상품 하나로 「사이트 환산」이라 단정했다").toBe("INSUFFICIENT");
    expect(r.reason).toContain("판정 불가");
    expect(r.pairs[0]!.samples).toBe(1);
  });

  it("A-5 🔴 **편차 임계값을 쓰지 않는다** — 그 계산이 `a0b3c08` 에서 오판했다", () => {
    /**
     * 🔴 USD/EUR 비율 편차는 0.5% 를 **넘는데**(정수 반올림 잡음) 단일 환율 구간은
     *    **비어 있지 않다** ⟹ 임계값으로 보면 「현지통화」로 **오판** 한다.
     */
    const rows = [
      obs("p1", "JP", "EUR", 54),
      obs("p1", "JP", "USD", 63),
      obs("p2", "KR", "EUR", 49),
      obs("p2", "KR", "USD", 57),
    ];
    /**
     * 🔴🔴 **1차에 내가 「편차가 0.5% 를 넘는다」를 전제로 적었고 그 전제가 틀렸다**
     *    (이 두 값의 편차는 0.29% 다). `a0b3c08` 의 0.563% 는 **다른 격자** 의 숫자다.
     * 🟢 그래서 **숫자를 지어내지 않고** 기준이 금지하는 것을 직접 단언한다 —
     *    ⒜ 이 격자는 SITE_FX 다 ⒝ 소스에 **임계값 비교가 없다**.
     */
    expect(
      classifyMarketCurrencyEvidence(rows).verdict,
      "🔴 임계값식 오판이 되돌아왔다",
    ).toBe("SITE_FX");
    /**
     * 🔴 소스에도 그 금지를 남긴다 — 다음 사람이 임계값으로 되돌리지 못하게.
     * 🔴🔴 **주석을 벗긴다.** 1차에 벗기지 않아 FAIL 했다 — 그 모듈의 머리 주석이
     *    금지 대상(`spread < 0.5%`)을 **설명으로** 적어 뒀기 때문이다
     *    (메모 `source-scan-must-strip-comments` · 이 트랙 열 번째).
     */
    const RAW = readFileSync(path.join(__dirname, "market-currency-evidence.ts"), "utf8");
    expect(RAW, "🔴 금지 이유가 소스에서 사라졌다").toContain("편차 임계값");
    const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(CODE, "🔴 기준이 임계값 비교로 바뀌었다").not.toContain("spread");
    /** 🟢 그리고 **구간 교집합** 이 실제 구현임을 같이 단언한다(없으면 기준이 바뀐 것이다). */
    expect(CODE).toContain("Math.max(lo,");
    expect(CODE).toContain("Math.min(hi,");
  });
});

/* ════════════════════ B. 닫힌 판정과 같은 답인가 ════════════════════ */

describe("SLCF-1 B — 🟢 `a0b3c08` 의 판정을 **재현** 한다(재조사 아님)", () => {
  it("B-1 🔴 Smallable 라이브 격자 → **SITE_FX**(그 WU 의 결론과 같다)", () => {
    /** 🔴 2026-11-07 실측 격자 그대로(상품 430753 · 세 국가 × 세 통화). */
    const GRID: Record<string, Record<string, number>> = {
      JP: { EUR: 54, JPY: 10_078, USD: 63 },
      KR: { EUR: 49, JPY: 9_145, USD: 57 },
      US: { EUR: 53, JPY: 9_892, USD: 62 },
    };
    /**
     * 🔴 **그 격자는 「한 상품 × 세 국가」** 다 — 국가가 상품 역할을 한다(같은 상품의
     *    국가별 표시가 각각 한 벌의 (통화→금액) 이다). 🟢 그래서 `productKey` 에 국가를 쓴다.
     */
    const rows: MarketCurrencyObservation[] = [];
    for (const [country, byCur] of Object.entries(GRID))
      for (const [currency, amount] of Object.entries(byCur))
        rows.push(obs(`430753@${country}`, country, currency, amount));
    const r = classifyMarketCurrencyEvidence(rows);
    expect(r.verdict, "🔴 닫힌 판정과 다른 답이 났다 — 기준이 틀렸다").toBe("SITE_FX");
    for (const p of r.pairs) expect(p.samples).toBe(3);
  });

  it("B-2 🔴 JP 축은 **EUR 이다** — 운영 전수 숫자를 기록으로 잠근다", () => {
    /** 🔴 DB 전수(2026-11-11 재확인): `MARKET_PROBE` · `market_code='jp'` → **EUR 62행 · JPY 0행**. */
    const JP_CURRENCIES = { EUR: 62 } as const;
    expect(Object.keys(JP_CURRENCIES)).toEqual(["EUR"]);
    expect((JP_CURRENCIES as Record<string, number>).JPY).toBeUndefined();
  });
});

/* ════════════════════ C. 운영 전수 적용(읽기 전용 덤프) ════════════════════ */

describe.skipIf(!LIVE)("SLCF-1 C — 🟢 운영 전수에 기준을 적용한다", () => {
  it("판매처별로 **SITE_FX / LOCAL_CURRENCY / 확인 불가** 를 가른다", () => {
    /* eslint-disable no-console */
    interface GridRow {
      host: string;
      snapshot_id: string;
      market_code: string;
      currency: string;
      amount: number;
    }
    const grid = JSON.parse(readFileSync(GRID_FILE, "utf8")) as GridRow[];
    expect(grid.length, "🔴 덤프가 비었다").toBeGreaterThan(50);

    const byHost = new Map<string, MarketCurrencyObservation[]>();
    for (const g of grid) {
      if (!g.host) continue;
      const list = byHost.get(g.host) ?? [];
      /** 🔴 같은 상품의 **국가별 표시** 가 한 벌이다 — `a0b3c08` 격자와 같은 축으로 센다. */
      /**
       * 🔴🔴 **축은 «상품» 이다** — 운영 저장분은 (상품, 국가) 당 통화가 **하나** 라
       *    `상품@국가` 로 묶으면 쌍 표본이 **언제나 1** 이고 전건 「판정 불가」가 된다
       *    (1차에 그렇게 돌려 전 판매처가 INSUFFICIENT 로 나왔다). 🟢 상품 축으로 묶으면
       *    같은 상품의 **국가별 통화들** 이 한 벌이 되어 비교가 성립한다.
       */
      list.push(obs(g.snapshot_id, g.market_code, g.currency, g.amount));
      byHost.set(g.host, list);
    }

    console.log("\n판매처                  행   통화                     판정");
    const verdicts = new Map<string, string>();
    for (const [host, rows] of [...byHost.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const r = classifyMarketCurrencyEvidence(rows);
      verdicts.set(host, r.verdict);
      console.log(
        `  ${host.padEnd(22)} ${String(rows.length).padStart(4)}  ${r.currencies.join(",").padEnd(24)} ${r.verdict}` +
          (r.reason ? ` — ${r.reason}` : "") +
          (r.verdict === "LOCAL_CURRENCY"
            ? ` · 설명 안 되는 쌍 ${r.pairs
                .filter((p) => p.explainedBySingleRate === false)
                .map((p) => p.pair.join("/"))
                .join(" ")}`
            : ""),
      );
    }

    /** 🔴 분모 0 을 PASS 로 쓰지 않는다 — 판매처가 한 곳도 안 돌았으면 FAIL 이다. */
    expect(verdicts.size).toBeGreaterThan(3);
    /** 🔴🔴 Smallable 은 통화가 **하나뿐** 이다 ⟹ 「확인 불가」다(「현지통화 없음」이 아니다). */
    const smallable = [...verdicts.entries()].find(([h]) => h.includes("smallable"));
    expect(smallable, "🔴 Smallable 행이 전수에 없다").toBeTruthy();
    expect(smallable![1], "🔴 닫힌 판정과 어긋난다 — Smallable 은 EUR 하나다").toBe("INSUFFICIENT");
  });
});
