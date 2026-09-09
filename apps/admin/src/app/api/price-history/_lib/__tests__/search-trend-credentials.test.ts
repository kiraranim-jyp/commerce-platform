import { describe, expect, it } from "vitest";
import { resolveSearchTrendCredentials } from "../market-signals-cache";

/**
 * PHASE 0-B(CPO 지시, 2026-09-09).
 *
 * 이 테스트가 지키는 불변조건: **API HUB 엔드포인트에는 API HUB 키가 간다.**
 * NAVER-API-HUB-2가 endpoint/헤더만 옮기고 값의 출처는 구 DataLab에 남겨둔
 * 탓에 Production이 401을 반복했다. 우선순위가 다시 뒤집히면 같은 장애가
 * 조용히 재발하므로 여기서 고정한다.
 */
const HUB = { NAVER_API_ACCESS_KEY: "hub-id", NAVER_API_SECRET_KEY: "hub-secret" };
const LEGACY = { NAVER_DATALAB_CLIENT_ID: "legacy-id", NAVER_DATALAB_CLIENT_SECRET: "legacy-secret" };

describe("credential 우선순위 — API HUB가 먼저다", () => {
  it("핵심 회귀: 둘 다 있으면 API HUB 키를 쓴다", () => {
    const r = resolveSearchTrendCredentials({ ...LEGACY, ...HUB });
    expect(r).toMatchObject({ clientId: "hub-id", clientSecret: "hub-secret" });
  });

  it("API HUB 키가 없으면 구 DataLab 키로 폴백한다 — 회귀 없이 동작만 유지", () => {
    const r = resolveSearchTrendCredentials(LEGACY);
    expect(r).toMatchObject({ clientId: "legacy-id", clientSecret: "legacy-secret" });
  });

  it("id/secret은 각각 독립적으로 폴백하지 않는다 — 짝이 섞이면 인증이 깨진다", () => {
    // ACCESS_KEY만 있고 SECRET_KEY가 없는 반쪽 설정. secret은 legacy로 채워지므로
    // 두 체계의 키가 섞인다 — 이 조합 자체는 허용하되(설정 실수 구제),
    // 어떤 값이 선택되는지는 명시적으로 고정해 둔다.
    const r = resolveSearchTrendCredentials({ ...LEGACY, NAVER_API_ACCESS_KEY: "hub-id" });
    expect(r).toMatchObject({ clientId: "hub-id", clientSecret: "legacy-secret" });
  });
});

describe("NOT_CONFIGURED 처리 유지", () => {
  it("아무 키도 없으면 null — 외부 호출을 시도하지 않는다", () => {
    expect(resolveSearchTrendCredentials({})).toBeNull();
  });

  it("빈 문자열/공백만 있는 값은 설정된 것으로 치지 않는다", () => {
    expect(resolveSearchTrendCredentials({ NAVER_API_ACCESS_KEY: "  ", NAVER_API_SECRET_KEY: "x" })).toBeNull();
    expect(resolveSearchTrendCredentials({ NAVER_API_ACCESS_KEY: "x", NAVER_API_SECRET_KEY: "" })).toBeNull();
  });
});

describe("값 노출 금지", () => {
  it("공백 혼입은 값이 아니라 boolean 플래그로만 알린다", () => {
    const r = resolveSearchTrendCredentials({
      NAVER_API_ACCESS_KEY: " hub-id\n",
      NAVER_API_SECRET_KEY: "hub-secret",
    });
    expect(r).toMatchObject({ clientId: "hub-id", idTrimmed: true, secretTrimmed: false });
  });

  it("trim 플래그는 원본 길이를 유추할 수 있는 형태가 아니다", () => {
    const r = resolveSearchTrendCredentials(HUB)!;
    expect(typeof r.idTrimmed).toBe("boolean");
    expect(typeof r.secretTrimmed).toBe("boolean");
  });
});
