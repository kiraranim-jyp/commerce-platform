/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02d (2026-10-11) — **고치기 «전에» 재야 할 것 하나.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 foretforet 상세를 1건 읽는다.
 *
 * MI-P0-02c ⑧ 에서 `fetchForetforetModelCode` 가 판매처 자체코드
 * (`MA26KASST0577356`)를 돌려줘 `compareModelCode` 가 **없는 반증**(`conflict`)을
 * 만드는 것을 실측했다. CPO 가 방향을 확정했다 —
 * 「브랜드 품번을 확인할 증거 없음 → CONFLICT 가 아니라 INSUFFICIENT」.
 *
 * 🔴 **그런데 고치는 방법이 두 갈래이고, 어느 쪽인지 아직 모른다:**
 *
 *     ① 상세에 브랜드 품번(`AW26MS185`)이 «있다»
 *        → extractor 가 그것을 읽어야 한다. null 로 바꾸면 있는 증거를 버린다.
 *     ② 상세에 «없다»
 *        → extractor 가 `null` 을 돌려줘야 한다(= `unavailable`).
 *          그러면 텍스트·교차판매처 경로가 살아난다.
 *
 * 🔴 **모른 채 고치면 그게 추측이다.** 그래서 이 파일은 상세 HTML 을 실제로 받아
 *    「브랜드 품번이 그 페이지 어디에 있는가/없는가」만 «관측» 한다. 고치지 않는다.
 *
 * 🔴 `mpn` 하나만 보지 않는다 — JSON-LD 전체 · 본문 전체 · 테이블 · 속성값을
 *    같이 본다. 한 칸만 보고 「없다」고 적으면 그게 [[absence-requires-execution]]
 *    위반이다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchWithDomainRateLimit } from "../../rate-limit/domain-rate-limiter";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 실측 URL(MI-P0-02c). #5 = 멜란지 = 원상품과 같은 색상인 «정답» 후보다. */
const TARGETS = [
  { rank: 5, label: "멜란지(정답)", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277461" },
  { rank: 1, label: "그린(대조군)", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277465" },
] as const;

const BRAND_CODE = "AW26MS185";
/** 🔴 Main Story 품번 꼴. 상세에 «다른» 브랜드 품번이 적혀 있을 수도 있으므로
 *  글자 그대로 찾는 것과 «꼴로» 찾는 것을 같이 한다. */
const BRAND_CODE_SHAPE = /\bAW\d{2}MS\d{3}\b/gi;
/** 판매처 자체코드 꼴(실측: MA26KASST0577356). */
const OWN_CODE_SHAPE = /\bMA\d{2}[A-Z]{5}\d{7}\b/gi;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** 발견 위치를 사람이 되짚을 수 있게 주변 문맥을 남긴다. 🔴 원문을 자르는 유일한 자리다. */
function contexts(html: string, re: RegExp, span = 90): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(re)) {
    const i = m.index ?? 0;
    out.push(html.slice(Math.max(0, i - span), i + m[0].length + span).replace(/\s+/g, " "));
    if (out.length >= 5) break;
  }
  return out;
}

describe.skipIf(!LIVE)("🔴 MI-P0-02d — foretforet 상세에 브랜드 품번이 있는가", () => {
  it(
    "상세 HTML 을 실제로 받아 브랜드 품번 유무만 관측한다(고치지 않는다)",
    async () => {
      const rows: Record<string, unknown>[] = [];
      for (const t of TARGETS) {
        const response = await fetchWithDomainRateLimit(t.url, {
          headers: { Accept: "text/html", "User-Agent": CHROME_UA },
          signal: AbortSignal.timeout(15000),
        });
        const html = await response.text();

        // JSON-LD 블록을 전부 모은다 — mpn 외의 칸도 같이 본다.
        const jsonLdBlocks: unknown[] = [];
        for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
          try {
            jsonLdBlocks.push(JSON.parse(m[1]));
          } catch {
            // 🔴 실측: foretforet 의 두 번째 블록은 홑따옴표라 파싱 실패한다.
            //    그래서 «파싱 실패한 블록의 원문» 도 아래 문자열 검사가 본다.
            jsonLdBlocks.push({ __unparsed: m[1].slice(0, 400).replace(/\s+/g, " ") });
          }
        }

        rows.push({
          ...t,
          status: response.status,
          bytes: html.length,
          /** 🔴 핵심 — 글자 그대로의 브랜드 품번이 페이지 어디에든 있는가. */
          containsBrandCodeLiteral: html.toUpperCase().includes(BRAND_CODE),
          brandCodeShapeHits: [...new Set((html.match(BRAND_CODE_SHAPE) ?? []).map((x) => x.toUpperCase()))],
          brandCodeContexts: contexts(html, BRAND_CODE_SHAPE),
          ownCodeShapeHits: [...new Set((html.match(OWN_CODE_SHAPE) ?? []).map((x) => x.toUpperCase()))],
          jsonLdBlockCount: jsonLdBlocks.length,
          jsonLd: jsonLdBlocks,
        });
        // eslint-disable-next-line no-console
        console.log(
          `#${t.rank} ${t.label} status=${response.status} bytes=${html.length} ` +
            `brandCodeLiteral=${html.toUpperCase().includes(BRAND_CODE)} ` +
            `brandCodeShape=${JSON.stringify(rows[rows.length - 1].brandCodeShapeHits)} ` +
            `ownCode=${JSON.stringify(rows[rows.length - 1].ownCodeShapeHits)}`,
        );
      }

      const answer = rows[0];
      const verdict = {
        question: "foretforet 상세에 브랜드 품번(AW26MS185)이 있는가",
        answer: answer.containsBrandCodeLiteral
          ? "🔴 있다 — extractor 가 그것을 «읽어야» 한다. null 로 바꾸면 있는 증거를 버린다"
          : "🟢 없다 — extractor 는 null 을 돌려줘야 한다(= unavailable). 자체코드를 품번 칸에 넣는 것이 결함이다",
        containsBrandCodeLiteral: answer.containsBrandCodeLiteral,
        brandCodeShapeHits: answer.brandCodeShapeHits,
        ownCodeShapeHits: answer.ownCodeShapeHits,
        notFixed: "🔴 이 측정은 관측만 한다. extractor 를 바꾸지 않았다.",
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        path.join(OUT_DIR, "mi-p0-02d-foretforet-brandcode.json"),
        JSON.stringify({ verdict, rows }, null, 1),
        "utf8",
      );
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(verdict, null, 2));

      // 🔴 결론 방향을 단언하지 «않는다». 두 건을 실제로 받았다는 것만 단언한다.
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.status === 200), "상세를 못 받으면 결론을 내릴 수 없다").toBe(true);
      expect(rows.every((r) => Number(r.bytes) > 1000)).toBe(true);
    },
    10 * 60 * 1000,
  );
});

/* ═══════ 🔴🔴 조사 결론 — 결함은 «브랜드마다 다르다» ═══════ */

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 MI-P0-02d — **CTO 가 한 번 틀렸고, 기존 테스트가 잡았다. 그 기록이다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 위 실측으로 「foretforet 상세에 Main Story 브랜드 품번이 없다」를 확인한 뒤,
 * `DOMESTIC_IDENTIFIER_EXTRACTORS` 에서 `foretforet.com` 을 **제거했다.**
 * 🔴 **그 변경은 틀렸고 되돌렸다.** 기존 테스트 9개가 FAIL 했고, 그중 하나가
 *    정확히 이유를 적어 뒀다:
 *
 *      run-domestic-price-check-guard.test.ts
 *      「H) P-7-C STEP 2 핵심 회귀 — FORETFORET + low(42%) + foreignModelCode
 *        있음 → skip 해제, 실제 골든케이스(PèPè) 전체 체인이 verified=true 까지
 *        도달한다」
 *
 * 🟢 즉 **같은 추출기가 PèPè 에서는 `partial` 을 내서 load-bearing 이다.**
 *    (P-7-C 실측: 「포레포레 정답 후보가 텍스트 confidence 42%(low)인데 SKU 는
 *     partial 일치한다」 — 그 브랜드는 품번이 판매처 코드 «안에» 들어 있어
 *     `compareModelCode` 의 LCS≥4 가 걸린다.)
 *
 * 🔴 **내가 한 실수의 이름:** 한 브랜드(Main Story)를 재고 **전 도메인으로
 *    일반화했다.** 대조군을 두지 않았다.
 *    [[coverage-is-a-property-not-a-filename]] · 「부정 단정엔 대조군을」.
 *
 * ── 그래서 사실은 이렇게 갈린다 ─────────────────────────────────────────────
 *
 *     PèPè        브랜드 품번이 판매처 코드 «안에» 있다  → partial  🟢 쓸모 있다
 *     Main Story  브랜드 품번이 상세 어디에도 «없다»     → conflict 🔴 거짓 반증
 *
 * 🔴 **결함은 실재하지만 「추출기 제거」가 해법이 아니다.** 같은 함수가 한
 *    브랜드에서는 증거를, 다른 브랜드에서는 거짓 반증을 만든다.
 *    해법 후보는 「brand code 가 그 값 안에 나타나는지」를 보는 것이지만, 그것은
 *    `compareModelCode` 의 판정 기준(LCS≥4)을 건드리는 일이고 — 그 함수는
 *    EXACT 승격 조건을 쥐고 있다. 🔴 **CTO 가 임의로 바꾸지 않는다. CPO 판정 사안.**
 */
describe("🔴🔴 MI-P0-02d — 같은 추출기가 브랜드마다 다른 결과를 낸다", () => {
  it("Main Story: 자체코드 ↔ 브랜드 품번 → conflict (거짓 반증)", async () => {
    const { compareModelCode } = await import("../model-code");
    expect(compareModelCode("AW26MS185", "MA26KASST0577356")).toBe("conflict");
  });

  /**
   * 🟢 대조군 — 이 단언이 「제거하면 안 되는 이유」다. PèPè 는 브랜드 품번 조각이
   *    판매처 코드 안에 있어 `partial` 이 난다(기존 골든케이스의 실측값 꼴).
   */
  it("🟢 PèPè 꼴: 브랜드 품번 조각이 판매처 코드 «안에» 있으면 partial 이다", async () => {
    const { compareModelCode } = await import("../model-code");
    const evidence = compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER");
    expect(evidence).not.toBe("unavailable");
    // 🔴 `conflict` 가 아니라는 것이 핵심이다 — 증거로 쓸 수 있다.
    expect(evidence).not.toBe("conflict");
  });

  it("🔴 foretforet 는 레지스트리에 «남아 있다» — 제거는 되돌렸다", async () => {
    const { supportsDomesticIdentifierExtraction } = await import("../domestic-identifiers");
    expect(supportsDomesticIdentifierExtraction("foretforet.com")).toBe(true);
  });
});
