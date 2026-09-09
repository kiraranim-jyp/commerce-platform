import { describe, expect, it } from "vitest";
import { resolveSearchTrendCredentials } from "../market-signals-cache";

/**
 * NAVER-PHASE0-AUTH-FIX(CPO 지시, 2026-09-10).
 *
 * 이 테스트가 지키는 불변조건: **Search Trend에는 DATALAB pair만 간다.**
 *
 * 이름이 헷갈리지만 실증이 갈랐다 — Production에서 네 조합을 각각 호출한
 * 결과 NAVER_DATALAB_CLIENT_ID + CLIENT_SECRET만 200/OK/ratio를 돌려줬고,
 * NAVER_API_ACCESS_KEY가 들어간 조합은 교차 조합까지 셋 다 401이었다.
 * "API_HUB라는 이름이 붙었으니 API HUB 키겠지"라는 추정이 401의 원인이었고,
 * 그 추정이 다시 코드로 돌아오지 못하게 여기서 막는다.
 */
const HUB = { NAVER_API_ACCESS_KEY: "hub-id", NAVER_API_SECRET_KEY: "hub-secret" };
const LEGACY = { NAVER_DATALAB_CLIENT_ID: "datalab-id", NAVER_DATALAB_CLIENT_SECRET: "datalab-secret" };

describe("credential 선택 — DATALAB pair가 정답이다", () => {
  it("핵심 회귀: 둘 다 있어도 DATALAB pair를 쓴다", () => {
    // 실증에서 401을 돌려준 것이 ACCESS_KEY 쪽이다. 이름에 끌려 그쪽을
    // 우선하면 Production이 그대로 다시 죽는다.
    expect(resolveSearchTrendCredentials({ ...HUB, ...LEGACY })).toMatchObject({
      clientId: "datalab-id",
      clientSecret: "datalab-secret",
    });
  });

  it("ACCESS_KEY/SECRET_KEY만 있으면 폴백하지 않는다 — 틀린 키로 조용히 넘어가지 않는다", () => {
    // 폴백을 남기면 401이 원인 모르게 되풀이된다. 없으면 없다고 말한다.
    expect(resolveSearchTrendCredentials(HUB)).toBeNull();
  });

  it("DATALAB pair만 있으면 그것을 쓴다", () => {
    expect(resolveSearchTrendCredentials(LEGACY)).toMatchObject({ clientId: "datalab-id" });
  });

  it("한쪽만 있으면 NOT_CONFIGURED — 반쪽 짝으로 호출하지 않는다", () => {
    expect(resolveSearchTrendCredentials({ NAVER_DATALAB_CLIENT_ID: "x" })).toBeNull();
    expect(resolveSearchTrendCredentials({ NAVER_DATALAB_CLIENT_SECRET: "x" })).toBeNull();
  });
});

describe("NOT_CONFIGURED 처리 유지", () => {
  it("아무 키도 없으면 null — 외부 호출을 시도하지 않는다", () => {
    expect(resolveSearchTrendCredentials({})).toBeNull();
  });

  it("빈 문자열/공백만 있는 값은 설정된 것으로 치지 않는다", () => {
    expect(resolveSearchTrendCredentials({ NAVER_DATALAB_CLIENT_ID: "  ", NAVER_DATALAB_CLIENT_SECRET: "x" })).toBeNull();
    expect(resolveSearchTrendCredentials({ NAVER_DATALAB_CLIENT_ID: "x", NAVER_DATALAB_CLIENT_SECRET: "" })).toBeNull();
  });
});

describe("credentialSource — 무음 경로를 만들지 않는다(PHASE 0 §5)", () => {
  it("자격증명을 찾았으면 DATALAB", () => {
    expect(resolveSearchTrendCredentials(LEGACY)).toMatchObject({ source: "DATALAB", mixedPair: false });
  });

  it("못 찾았으면 null — 호출부가 NONE으로 로그를 남긴다", () => {
    expect(resolveSearchTrendCredentials({})).toBeNull();
  });
});

describe("값 노출 금지", () => {
  it("공백 혼입은 값이 아니라 boolean 플래그로만 알린다", () => {
    const r = resolveSearchTrendCredentials({
      NAVER_DATALAB_CLIENT_ID: " datalab-id\n",
      NAVER_DATALAB_CLIENT_SECRET: "datalab-secret",
    });
    expect(r).toMatchObject({ clientId: "datalab-id", idTrimmed: true, secretTrimmed: false });
  });

  it("trim 플래그는 원본 길이를 유추할 수 있는 형태가 아니다", () => {
    const r = resolveSearchTrendCredentials(LEGACY)!;
    expect(typeof r.idTrimmed).toBe("boolean");
    expect(typeof r.secretTrimmed).toBe("boolean");
  });
});
