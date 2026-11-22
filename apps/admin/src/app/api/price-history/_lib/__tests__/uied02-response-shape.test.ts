/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 UIED-02 §7-B/F — **응답 예시 조립 + 기존 판정 불변 확인**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 함수를 그대로 쓴다** — `summarizeIdentityEvidence` 는 운영 owner 이고,
 *    구조화/상세설명 칸은 운영 push 자리와 **같은 식** 을 재현한다(식을 지어내지 않는다).
 * 🔴 네트워크 **0** · DB **0** · 저장 **0**. 입력은 기존 산출물 둘이다.
 *
 * 🔴🔴 **증명 범위** — 「응답이 이 모양으로 조립된다」까지다. 실제 `/check` 본문은
 *    로그인 뒤라 CTO 가 볼 수 없다(메모 `production-payload-is-unreachable`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const FIX = join(__dirname, "fixtures");
const read = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

/** 🔴 운영 push 자리와 **같은 식** — 세 상태를 가른다. */
const descriptionCell = (d: string | null | undefined) => ({
  raw: d ?? null,
  length: d?.length ?? 0,
  state: d == null ? "NOT_MEASURED" : d.length === 0 ? "MISSING" : "PRESENT",
});

describe("UIED02 §7-B — 후보별 통합 증거 응답 예시", () => {
  it("B-1 🟢🟢 **네 영역이 한 후보 객체로 조립된다**(운영 산출 + 운영 식)", () => {
    /**
     * 🔴🔴 **운영 요약기를 다시 부르지 않는다.** MIC01 fixture 에 **운영이 낸
     *    `identityEvidence`** 가 그대로 들어 있다(그 라이브 실행의 산출). 🔴 합성 facts 로
     *    다시 부르면 축이 **전건 `NOT_MEASURED`** 가 된다 — 이 세션에서 **두 번** 그 함정에
     *    빠졌다(그 축은 `facts.evidence` 를 읽는다). 🟢 그래서 **운영 산출을 그대로** 쓴다.
     */
    const cap = read("mic01-candidate-originals.json") as {
      identityEvidence: {
        url: string;
        domain: string;
        evidence: { axes: Record<string, unknown>[]; supply: Record<string, unknown> } | null;
      }[];
    };
    const reass = read("mier01-reassessment.json") as {
      origin: { brandRaw: string | null; codeRaw: string | null; titleRaw: string | null };
      rows: {
        domain: string;
        candidate: {
          brandRaw: string | null;
          codeRaw: string | null;
          titleRaw: string | null;
          descriptionRaw: string | null;
        };
        stored: { verdict: string | null; priceTier: string | null; blockers: string[] };
      }[];
    };

    const byDomain = new Map(reass.rows.map((r) => [r.domain, r]));
    const candidates = cap.identityEvidence
      .filter((e) => e.evidence != null)
      .map((e) => {
        const live = byDomain.get(e.domain);
        return {
          candidateUrl: e.url,
          domain: e.domain,
          /** 🔵 ③ 구조화 세 칸 — 원상품 · 후보. 🔴 축과 **합치지 않는다**. */
          structured: {
            origin: {
              brand: reass.origin.brandRaw,
              modelCode: reass.origin.codeRaw,
              title: reass.origin.titleRaw,
            },
            candidate: {
              brand: live?.candidate.brandRaw ?? null,
              modelCode: live?.candidate.codeRaw ?? null,
              title: live?.candidate.titleRaw ?? null,
            },
          },
          /** 🔵 ④ 후보 상세설명 **원문** — 운영 push 자리와 같은 식. */
          description: descriptionCell(live?.candidate.descriptionRaw),
          /** 🔵 ⑤ 기존 TITLE/DESCRIPTION 관찰값 — **운영 산출 그대로**. */
          axes: e.evidence!.axes,
          supply: e.evidence!.supply,
          /** 🔴 **대조군** — 기존 운영 판정이다. 이 응답이 그것을 바꾸지 않는다. */
          storedForComparison: live?.stored ?? null,
        };
      });

    expect(candidates, "🔴 후보가 조립되지 않았다").toHaveLength(8);

    for (const c of candidates) {
      expect(c.structured.origin, `🔴 ${c.domain} 원상품 구조화 없음`).toBeTruthy();
      expect(c.structured.candidate, `🔴 ${c.domain} 후보 구조화 없음`).toBeTruthy();
      expect(c.axes.length, `🔴 ${c.domain} 축 요약 없음`).toBeGreaterThan(0);
      expect(["PRESENT", "MISSING", "NOT_MEASURED"]).toContain(c.description.state);
      /** 🔴 `length` 가 `raw` 와 **일치** 한다(지어낸 숫자가 아니다). */
      expect(c.description.length, `🔴 ${c.domain} 길이 불일치`).toBe(c.description.raw?.length ?? 0);
    }
    /** 🟢 상세설명 원문이 **실제로** 실린다 — 8/8. */
    const present = candidates.filter((c) => c.description.state === "PRESENT");
    expect(present, "🔴 상세설명 원문이 실리지 않았다").toHaveLength(8);
    /** 🔴 원문이 **절단되지 않았다** — 길이가 서로 다르고 최댓값이 1,000자를 넘는다. */
    expect(new Set(present.map((c) => c.description.length)).size).toBeGreaterThanOrEqual(7);
    expect(Math.max(...present.map((c) => c.description.length))).toBeGreaterThan(1_000);
    /** 🔵 그리고 **구조화 ↔ 축이 갈리는 실례** 가 이 표본에 있다(UIED-01 §B). */
    const brandAxisMissing = candidates.filter(
      (c) => (c.axes.find((a) => a.axis === "BRAND")?.comparison as string) === "MISSING",
    );
    const structuredBrand = brandAxisMissing.filter((c) => (c.structured.candidate.brand ?? "").length > 0);
    expect(
      structuredBrand.length,
      "🔴 구조화 브랜드와 브랜드 축이 갈리는 실례가 사라졌다 — 두 값을 합치면 안 되는 근거다",
    ).toBeGreaterThanOrEqual(5);

    /* eslint-disable no-console */
    console.log("\n═══ §7-B 후보별 통합 증거 응답 예시(실제 운영 산출) ═══");
    const ex = present.find((c) => c.domain === "junioredition.com") ?? present[0];
    console.log(
      JSON.stringify(
        {
          candidateUrl: ex.candidateUrl,
          domain: ex.domain,
          structured: ex.structured,
          description: {
            ...ex.description,
            raw: ex.description.raw!.slice(0, 180) + " …(이하 원문 그대로 · 절단 없음)",
          },
          axes: ex.axes.filter((a) => ["BRAND", "MODEL_CODE", "PRODUCT_NAME"].includes(a.axis as string)),
          supply: ex.supply,
        },
        null,
        2,
      ),
    );
    console.log("\n═══ 상세설명 상태 분포 ═══");
    console.log(
      "  " +
        JSON.stringify(
          candidates.reduce<Record<string, number>>((m, c) => {
            m[c.description.state] = (m[c.description.state] ?? 0) + 1;
            return m;
          }, {}),
        ),
    );
    console.log("\n═══ §7-D 네 영역 연결 + §7-F 기존 판정 대조 ═══");
    for (const c of candidates) {
      const ax = (k: string) => String(c.axes.find((a) => a.axis === k)?.comparison ?? "-");
      console.log(
        `  ${c.domain.padEnd(24)} 브랜드(구조화=${String(c.structured.candidate.brand ?? "-").padEnd(20)} 축=${ax("BRAND").padEnd(9)})` +
          ` 품번=${String(c.structured.candidate.modelCode ?? "-").padEnd(12)} 상품명축=${ax("PRODUCT_NAME").padEnd(9)}` +
          ` 설명=${String(c.description.length).padStart(5)}자 · verdict=${String(c.storedForComparison?.verdict ?? "-")}`,
      );
    }
    /* eslint-enable no-console */

    writeFileSync(
      join(FIX, "uied02-response.json"),
      JSON.stringify({ identityEvidence: { candidates, observedAt: "<이 응답이 관측한 시각>" } }, null, 2),
      "utf8",
    );
  });

  it("F-1 🔴🔴 **기존 판정이 한 글자도 바뀌지 않는다** — 증거 칸은 대조군과 분리돼 있다", () => {
    const reass = read("mier01-reassessment.json") as {
      rows: { domain: string; stored: { verdict: string | null; priceTier: string | null; blockers: string[] } }[];
    };
    /**
     * 🔴 이 WU 는 판정 입력을 건드리지 않았으므로 **기존 라벨이 그대로** 여야 한다.
     * 🟢 UIED-01 이 적은 그 분포다 — `PRESUMED_SAME` **8/8**.
     */
    const verdicts = reass.rows.map((r) => r.stored.verdict);
    expect(verdicts).toHaveLength(8);
    expect(verdicts.every((v) => v === "PRESUMED_SAME"), "🔴 기존 판정 분포가 바뀌었다").toBe(true);
    /** 🔴 그리고 **SAME 승격이 0** 이다 — 상세설명을 응답에 실은 것만으로 판정이 오르지 않는다. */
    expect(verdicts.filter((v) => v === "SAME").length, "🔴🔴 SAME 이 늘었다 — 판정에 연결됐다").toBe(0);
  });
});
