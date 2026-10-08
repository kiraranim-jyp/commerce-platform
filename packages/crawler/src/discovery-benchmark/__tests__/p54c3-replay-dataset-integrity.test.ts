/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-C.2 STEP 3(CPO 지시, 2026-10-08) — **측정 하니스 신뢰성.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 실제 사고를 막는다. 1차 Replay 가 `url.slice(0, 92)` 로 콘솔에
 *    출력했고 그 «잘린 문자열» 이 측정 데이터로 복구됐다 —
 *
 *      106건 중 16건(15%) 잘림 · 2건 퍼센트 인코딩 깨짐
 *      🔴 `littleluna.co.kr/…-aw26ms185-bub` 에서 끊겨 `grey-melange` 가 사라졌고
 *         「K=5 에서 Little Luna 탈락」이라는 **거짓 결론**이 나왔다
 *
 * 🔴 CPO 가 지정한 6항목을 그대로 잠근다. 특히 ④ round-trip equality 가
 *    load-bearing 이다 — 저장→복원 후 URL 이 한 글자라도 달라지면 FAIL.
 */
import { describe, expect, it } from "vitest";
import {
  forReport,
  parseReplayDataset,
  safeDecode,
  serializeReplayDataset,
  type ReplayCandidateRecord,
  type ReplayDataset,
} from "../replay-dataset";

/**
 * 🔴 실측에서 «실제로 잘렸던» URL 들이다. 짧은 샘플로 바꾸지 않는다 —
 *    그러면 이 테스트가 사고를 재현하지 못한다(fixture 는 더럽게).
 */
const REAL_LONG_URLS = [
  // 🔴 1차 사고의 바로 그 URL. 92자에서 끊기면 grey-melange 가 사라진다.
  "https://littleluna.co.kr/product/%EB%A9%94%EC%9D%B8%EC%8A%A4%ED%86%A0%EB%A6%AC-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/",
  "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-chocolate-brown/4117/category/23/display/1/",
  "https://dmont.co.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%82%A4%EC%A6%88-%EB%B9%84%EC%8A%A4%ED%8A%B8-%EC%8A%A4%EC%9B%A8%EC%85%94%EC%B8%A0",
  "https://www.lfmall.co.kr/app/product/DUFNXX00499/%EB%AF%B8%EB%8B%88%EB%A1%9C%EB%94%94%EB%8B%88-%ED%95%98%ED%8A%B8",
  "https://www.lotteon.com/p/product/LO2752605259?sitmNo=LO2752605259_LO2752605259&mall_no=1&dpId=DP0000",
  /**
   * 🔴 «정말로 깨진» 퍼센트 인코딩. 1차 사고에서 2건이 이 모양이었다 —
   *    92자 경계가 멀티바이트 시퀀스 «중간» 을 자르면 `%EB%A9` 처럼 남는다.
   *    🔴 처음에 `…%EB%A6%AC-aw26ms185-bub`(시퀀스가 완결된 지점) 을 샘플로
   *       썼는데 그건 디코딩이 «된다» — 테스트가 사고를 재현하지 못했다.
   */
  "https://littleluna.co.kr/product/%EB%A9%94%EC%9D%B8%EC%8A%A4%ED%86%A0%EB%A6",
];

function record(groundingUrl: string, finalUrl: string): ReplayCandidateRecord {
  return {
    groundingUrl,
    webTitle: "littleluna.co.kr",
    queryId: "Q5",
    queryRank: 3,
    finalUrl,
    canonicalUrl: finalUrl,
    classification: "PRODUCT_PAGE",
    crawlerUrl: finalUrl,
    dedupeKey: "littleluna.co.kr|/product/x",
    probeBytes: 188549,
  };
}

const DATASET: ReplayDataset = {
  capturedAt: "2026-10-08T00:00:00.000Z",
  model: "gemini-flash-latest",
  jobs: [
    {
      jobKey: "JOB-261007-005",
      originUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
      queries: [{ id: "Q5", text: "AW26MS185" }],
      queryOutcomes: [{ id: "Q5", outcome: "SUCCESS" }],
      candidates: REAL_LONG_URLS.map((u, i) => record(`https://vertexaisearch.cloud.google.com/grounding-api-redirect/T${i}`, u)),
    },
  ],
};

describe("🔴 ① 저장 JSON 의 URL 은 잘리지 않는다", () => {
  it("직렬화된 문자열이 «원문 전체» 를 담는다", () => {
    const json = serializeReplayDataset(DATASET);
    for (const url of REAL_LONG_URLS) {
      expect(json, `${url.slice(0, 40)}… 가 저장에서 사라졌다`).toContain(JSON.stringify(url).slice(1, -1));
    }
  });

  it("🔴 1차 사고의 URL 이 grey-melange 까지 온전하다", () => {
    const json = serializeReplayDataset(DATASET);
    expect(json).toContain("grey-melange");
    expect(json).toContain("/4120/category/23/display/1/");
  });
});

describe("🔴 ② 보고용 truncate 가 저장 데이터에 영향을 주지 않는다", () => {
  it("forReport 는 «새 문자열» 을 돌려주고 레코드를 바꾸지 않는다", () => {
    const before = serializeReplayDataset(DATASET);
    for (const job of DATASET.jobs) {
      for (const c of job.candidates) {
        const shown = forReport(c.finalUrl);
        // 긴 URL 은 잘려 보여야 한다(가독성 목적 자체는 유지된다).
        if ((c.finalUrl ?? "").length > 92) expect(shown.length).toBeLessThan((c.finalUrl ?? "").length);
      }
    }
    // 🔴 핵심: 출력 후에도 저장 직렬화가 «한 글자도» 달라지지 않는다.
    expect(serializeReplayDataset(DATASET)).toBe(before);
  });

  it("🔴 자른 문자열은 길이를 함께 적는다 — 「이게 전부」로 오해하지 않게", () => {
    const long = REAL_LONG_URLS[0];
    const shown = forReport(long);
    expect(shown).toContain("…");
    expect(shown).toContain(`(${long.length}자)`);
  });

  it("null 은 「(없음)」으로 — 빈 문자열로 만들지 않는다", () => {
    expect(forReport(null)).toBe("(없음)");
  });
});

describe("🔴 ③ 퍼센트 인코딩이 그대로 보존된다", () => {
  it("한글 인코딩·디코딩 형태 둘 다 원문 그대로 저장된다", () => {
    const parsed = parseReplayDataset(serializeReplayDataset(DATASET));
    const urls = parsed.jobs[0].candidates.map((c) => c.finalUrl);
    expect(urls).toContain(REAL_LONG_URLS[0]); // %EB%A9%94… 형태
    expect(urls).toContain(REAL_LONG_URLS[1]); // 메인스토리 형태
  });
});

describe("🔴🔴 ④ round-trip equality — load-bearing", () => {
  it("저장 → 복원 후 모든 URL 칸이 «완전히 동일» 하다", () => {
    const parsed = parseReplayDataset(serializeReplayDataset(DATASET));
    expect(parsed).toEqual(DATASET);
    // 칸별로도 확인한다 — toEqual 이 통과해도 어느 칸이 중요한지 코드가 말해야 한다.
    for (const [i, c] of parsed.jobs[0].candidates.entries()) {
      const original = DATASET.jobs[0].candidates[i];
      expect(c.groundingUrl).toBe(original.groundingUrl);
      expect(c.finalUrl).toBe(original.finalUrl);
      expect(c.canonicalUrl).toBe(original.canonicalUrl);
      expect(c.crawlerUrl).toBe(original.crawlerUrl);
      expect(c.webTitle).toBe(original.webTitle);
      expect(c.queryId).toBe(original.queryId);
      expect(c.queryRank).toBe(original.queryRank);
    }
  });
});

describe("🔴 ⑤ decodeURIComponent 실패가 전체를 손상시키지 않는다", () => {
  it("깨진 인코딩 1건이 있어도 나머지가 살아 있다", () => {
    const broken = REAL_LONG_URLS[5];
    // 🔴 전제 확인 — 이 값은 «실제로» 디코딩에 실패한다(전제가 깨지면 테스트가 무의미).
    expect(() => decodeURIComponent(broken)).toThrow();
    // safeDecode 는 던지지 않고 원문을 돌려준다.
    expect(safeDecode(broken)).toBe(broken);
    // 그리고 전체 복원이 그 1건 때문에 깨지지 않는다.
    const parsed = parseReplayDataset(serializeReplayDataset(DATASET));
    expect(parsed.jobs[0].candidates).toHaveLength(REAL_LONG_URLS.length);
  });

  it("정상 인코딩은 제대로 디코딩된다", () => {
    expect(safeDecode(REAL_LONG_URLS[0])).toContain("메인스토리");
  });
});

describe("🔴 ⑥ groundingUrl 과 finalUrl 이 서로 덮어쓰지 않는다", () => {
  it("두 칸이 «다른» 값으로 유지된다", () => {
    const parsed = parseReplayDataset(serializeReplayDataset(DATASET));
    for (const c of parsed.jobs[0].candidates) {
      expect(c.groundingUrl).toContain("grounding-api-redirect");
      expect(c.finalUrl).not.toContain("grounding-api-redirect");
      expect(c.groundingUrl).not.toBe(c.finalUrl);
    }
  });

  it("🔴 groundingUrl 이 비면 복원이 «던진다» — 조용히 넘기지 않는다", () => {
    const damaged = JSON.parse(serializeReplayDataset(DATASET)) as ReplayDataset;
    damaged.jobs[0].candidates[0].groundingUrl = "";
    expect(() => parseReplayDataset(JSON.stringify(damaged))).toThrow(/groundingUrl/);
  });

  it("🔴 jobs 모양이 깨지면 복원이 던진다", () => {
    expect(() => parseReplayDataset(JSON.stringify({ capturedAt: "", model: "", jobs: "not-array" }))).toThrow(/jobs/);
  });
});
