/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02c ⑧ (2026-10-11) — **「평가 상한을 올리면 풀리는가」를 추측하지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 foretforet 에 요청한다(5건).
 *
 * 저장경로 측정에서 JOB-JE-MAINSTORY @ foretforet.com 이 Gate 2(NOT_MATCHED)로
 * 떨어졌다. 원인을 후보 순서로 특정했다(`mi-p0-price-identity.json` 실측):
 *
 *     #1 그린        [평가됨]  modelCodeEvidence=conflict
 *     #2 초코브라운   [평가됨]
 *     #3 로즈        [평가됨]
 *     #4 그레이스톤   [🔴 MAX_EVIDENCE_CANDIDATES=3 «밖»]
 *     #5 멜란지 ←정답 [🔴 상한 밖]
 *
 * 🔴 **여기서 「상한만 올리면 정답이 살아난다」고 적으면 그것은 추측이다.**
 *    #1~#3 이 `conflict` 였다는 것은 `fetchForetforetModelCode` 가 상세에서 읽은
 *    값이 `AW26MS185` 와 **달랐다**는 뜻이다. 그린·초코브라운·로즈는 색상만 다른
 *    같은 라인이므로 브랜드 품번이 같아야 하는데 conflict 가 났다 — 그 상세가
 *    브랜드 품번이 아니라 **자체코드** 를 주고 있을 가능성이 크다. 그러면 멜란지도
 *    conflict 다.
 *
 * 🔴 그래서 **실제로 읽어 본다.** 다섯 건 전부. 그 결과가
 *      · 전부 conflict  → 상한을 올려도 풀리지 않는다(상한은 원인이 아니다)
 *      · 멜란지만 exact → 상한이 실제 원인이다
 *    둘 중 하나를 사실로 가른다.
 *
 * 🔴 **고치지 않는다.** `MAX_EVIDENCE_CANDIDATES` 는 HTTP 비용 상한이고 「대표 1건」은
 *    설계 결정이다 — 둘 다 CPO 판정 사안이다. 이 파일은 «재기만» 한다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareModelCode, confirmBrandCodeInTitle, fetchDomesticModelCode } from "@commerce/crawler";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 실측 URL·순서 그대로(`mi-p0-price-identity.json`). 자르지 않았다. */
const FORETFORET_CANDIDATES = [
  { rank: 1, color: "그린", title: "AW26 2차[메인스토리]그린 버블 스웻셔츠-MA26KASST0577196", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277465" },
  { rank: 2, color: "초코브라운", title: "AW26 2차[메인스토리]초코브라운 버블 스웻셔츠-MA26KASST0576878", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277464" },
  { rank: 3, color: "로즈", title: "AW26 2차[메인스토리]로즈 버블 스웻셔츠-MA26KASST0577592", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277463" },
  { rank: 4, color: "그레이스톤", title: "AW26 2차[메인스토리]그레이스톤 버블 스웻셔츠-MA26KASST0577271", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277462" },
  { rank: 5, color: "멜란지(정답)", title: "AW26 2차[메인스토리]멜란지 버블 스웻셔츠-MA26KASST0577356", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277461" },
] as const;

const FOREIGN_CODE = "AW26MS185";
const MAX_EVIDENCE_CANDIDATES = 3;

describe.skipIf(!LIVE)("🔴 MI-P0-02c ⑧ — 평가 상한이 정답을 가린 것인가", () => {
  it(
    "foretforet 5건의 품번을 전부 실제로 읽어 compareModelCode 를 본다",
    async () => {
      const rows: Record<string, unknown>[] = [];
      for (const c of FORETFORET_CANDIDATES) {
        let domesticModelCode: string | null = null;
        let error: string | null = null;
        try {
          // 🔴 운영이 쓰는 그 추출기. 새로 만들지 않는다.
          domesticModelCode = await fetchDomesticModelCode("foretforet.com", c.url);
        } catch (e) {
          error = e instanceof Error ? `${e.name}: ${e.message}` : "unknown";
        }
        rows.push({
          ...c,
          withinCap: c.rank <= MAX_EVIDENCE_CANDIDATES,
          /** 제목 확인 경로 — foretforet 은 자체코드만 적으므로 null 이 정상이다. */
          titleConfirmed: confirmBrandCodeInTitle(FOREIGN_CODE, c.title),
          domesticModelCode,
          error,
          // 🔴 운영 비교기 그대로. 내가 판정하지 않는다.
          evidence: compareModelCode(FOREIGN_CODE, domesticModelCode),
        });
        // eslint-disable-next-line no-console
        console.log(
          `#${c.rank} ${c.color.padEnd(12)} cap=${c.rank <= MAX_EVIDENCE_CANDIDATES ? "IN " : "OUT"} ` +
            `code=${String(domesticModelCode)} evidence=${String(rows[rows.length - 1].evidence)}${error ? ` err=${error}` : ""}`,
        );
      }

      const answer = rows.find((r) => r.rank === 5)!;
      const inCap = rows.filter((r) => r.withinCap);
      const verdict = {
        /** 🔴 상한 «안» 의 세 건이 전부 conflict 인가 — 그래서 evaluated[0] 이 대표가 됐다. */
        inCapAllConflict: inCap.every((r) => r.evidence === "conflict"),
        inCapEvidence: inCap.map((r) => `#${String(r.rank)}=${String(r.evidence)}`),
        /** 🔴 정답(#5)의 실제 증거. 이것이 이 측정의 전부다. */
        answerEvidence: answer.evidence,
        answerDomesticModelCode: answer.domesticModelCode,
        conclusion:
          answer.evidence === "exact" || answer.evidence === "partial"
            ? "🔴 상한이 실제 원인이다 — 정답은 품번이 맞는데 평가 기회를 못 받았다"
            : "🟢 상한은 원인이 «아니다» — 정답도 품번이 맞지 않으므로 상한을 올려도 풀리지 않는다",
        /** 🔴 어느 쪽이든 고치지 않는다. CPO 판정 사안이다. */
        notFixed: "MAX_EVIDENCE_CANDIDATES · 대표 1건 정책 둘 다 CTO 가 바꾸지 않았다",
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-02c-cap-probe.json"), JSON.stringify({ verdict, rows }, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(verdict, null, 2));

      // 🔴 결론 방향을 단언하지 «않는다». 다섯 건을 실제로 읽었다는 것만 단언한다.
      expect(rows).toHaveLength(5);
      expect(rows.every((r) => r.error === null), "품번 조회가 실패하면 결론을 내릴 수 없다").toBe(true);
    },
    10 * 60 * 1000,
  );
});

/* ═══════ 🔴🔴 실제 원인 — 자체코드가 품번 칸에 들어가 conflict 를 «지어낸다» ═══════ */

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 MI-P0-02c ⑧ — **이 테스트는 결함을 「현재 동작」으로 고정한다.**
 *      고치면 이 테스트가 깨진다. **그것이 신호다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 위 실측이 내 가설(상한)을 반증하면서 진짜 원인을 드러냈다:
 *
 *     fetchForetforetModelCode → "MA26KASST0577356"   ← 판매처 «자체코드»
 *     compareModelCode("AW26MS185", "MA26KASST0577356") → 🔴 "conflict"
 *
 * 🔴 `conflict` 는 「품번이 달라서 **다른 상품이다**」라는 뜻이다. 그런데 실제로는
 *    「비교할 브랜드 품번을 못 얻었다」(= `unavailable`)가 사실이다.
 *    **없는 반증을 지어내고 있다.**
 *
 * 🔴 그 결과가 구조적이다 — foretforet 의 Main Story 후보 5건이 «전부» conflict 라
 *    `selectDomesticCandidate` 가 conflict 아닌 후보를 찾지 못하고 `evaluated[0]`
 *    을 대표로 돌려주며, `toDomesticMatchType(low)` = NOT_MATCHED 에서 rescue 도
 *    발화하지 않아(modelCode 가 exact/partial 이 아니고 crossSeller 도 SAME 이
 *    아니다) Gate 2 에서 떨어진다. **정답 상품이 117,000원 가격까지 있는데 링크가
 *    만들어지지 않는다.**
 *
 * 🔴 **이 위험은 이미 문서화돼 있었다.** `domestic-identifiers.ts` 주석:
 *      「`productFactsFromListing` 이 `brandModelCode: null` 을 하드코딩한 것은
 *        옳다 — 포레포레 `MA26KASST0577356` 를 품번 칸에 넣으면 compareModelCode
 *        가 접두사부터 갈라져 「모델코드 충돌」을 **지어낸다**」
 *    즉 **listing 경로는 막았고 extractor 경로는 막지 않았다.** 가드가 한쪽에만
 *    있는 그 패턴이다.
 *
 * 🔴 **CTO 가 고치지 않았다.** `fetchForetforetModelCode` 를 바꾸면 foretforet 의
 *    모든 상품 판정이 바뀐다. 그리고 「상세에 브랜드 품번이 애초에 있는가」를 아직
 *    재지 않았다 — 있으면 extractor 가 그것을 읽어야 하고, 없으면 `null` 을
 *    돌려줘야 한다(그러면 `unavailable` 이 되어 텍스트/교차판매처 경로가 살아난다).
 *    **어느 쪽인지 모른 채 고치면 그게 추측이다.** CPO 판정 사안이다.
 */
describe("🔴🔴 MI-P0-02c — foretforet extractor 가 conflict 를 지어낸다(현재 동작 고정)", () => {
  it("판매처 자체코드가 브랜드 품번과 비교되어 conflict 가 된다", () => {
    // 🔴 실측값이다(위 probe, 2026-10-11). 네트워크 없이 비교기만 본다.
    expect(compareModelCode("AW26MS185", "MA26KASST0577356")).toBe("conflict");
    // 🔴 사실은 이것이어야 한다 — 비교할 브랜드 품번을 얻지 못했으므로.
    expect(compareModelCode("AW26MS185", null)).toBe("unavailable");
  });

  /**
   * 🔴 색상만 다른 같은 라인이 **서로도** conflict 다. 같은 브랜드 품번
   *    `AW26MS185` 를 공유하는 5건인데 자체코드는 전부 달라서, 어느 것을 골라도
   *    「다른 상품」이 된다. 이것이 「구조적」이라는 말의 뜻이다.
   */
  it("같은 라인의 다섯 색상이 서로 다른 자체코드를 가져 모두 conflict 가 된다", () => {
    const own = ["MA26KASST0577196", "MA26KASST0576878", "MA26KASST0577592", "MA26KASST0577271", "MA26KASST0577356"];
    expect(new Set(own).size).toBe(5);
    for (const code of own) expect(compareModelCode("AW26MS185", code), code).toBe("conflict");
  });

  /** 🟢 대조군 — 브랜드 품번이 실제로 오면 exact 가 난다. 비교기 자체는 정상이다. */
  it("🟢 비교기는 정상이다 — 브랜드 품번이 오면 exact 다", () => {
    expect(compareModelCode("AW26MS185", "AW26MS185")).toBe("exact");
  });
});
