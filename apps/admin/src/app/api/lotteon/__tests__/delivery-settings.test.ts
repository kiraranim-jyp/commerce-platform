import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOTTEON_READ_PATHS } from "../_lib/client";

/**
 * LOTTEON-HOLD-FIX-A(CEO 승인, 2026-09-15) — **문서 원문과 대조해 확정된 결함 3건**을
 * 테스트로 고정한다. 롯데ON IP allowlist 때문에 실호출 검증이 불가능하므로
 * (403), 이 스위트가 유일한 증명이다.
 *
 * 고정하는 사실 (전부 문서 원문 `soapi` 문서 백엔드 apiNo=150 · 166 · 89 확인):
 *
 *   ① 150 · 166 은 **POST + JSON 바디**다. Request Sample이
 *      `{"afflTrCd":"LO999999","afflLrtrCd":"SLO99999"}` — 쿼리스트링이 아니다.
 *      (89 는 GET + `grpCd` 쿼리다. 그건 원래 맞았고 바꾸지 않는다.)
 *   ② 150 응답의 대표 출고/회수지 필드는 `rprtYn`이다. `bscYn`은 문서에 없다.
 *   ③ 89 응답의 코드/명 필드는 `cd` / `cdNm`이다. `dtlCd`는 존재하지 않는다.
 *
 * 🔴 이 스위트가 통과해도 `c52e334`의 HOLD는 풀리지 않는다. 여전히 미확인:
 *   · `afflTrCd`가 207 identity의 `trNo`와 같은 값인가
 *   · 판매자센터 실제 번호(4279402 · 4279403 · PLO3837441)와의 매핑
 *
 * mock을 **client 층**에 건다(= `runLotteOnRead`·identity·라우트 파서는 전부
 * 진짜 코드가 돈다). 그래야 "무엇을 어떤 메서드/바디로 보내는가"를 실제로
 * 나가는 호출 인자에서 관찰할 수 있고, returnCode 게이트도 진짜 코드가 판정한다.
 */

interface CapturedCall {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

const hoisted = vi.hoisted(() => ({
  calls: [] as CapturedCall[],
  /** path → 봉투(returnCode/data). 테스트마다 갈아끼운다. */
  responders: new Map<string, { returnCode: string; message?: string | null; data: unknown }>(),
  /** path → 네트워크 실패 메시지. 타임아웃(LOTTEON-TIMEOUT-1)을 재현할 때 쓴다. */
  networkFailures: new Map<string, string>(),
}));

vi.mock("../_lib/env", () => ({
  getLotteOnCredentials: async () => ({ apiKey: "TEST-KEY-NOT-A-REAL-KEY" }),
}));

vi.mock("../_lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_lib/client")>();
  return {
    ...actual,
    callLotteOnApi: async (_apiKey: string, options: CapturedCall) => {
      hoisted.calls.push(options);
      const networkFailure = hoisted.networkFailures.get(options.path);
      if (networkFailure) {
        /* client.ts의 catch 분기가 돌려주는 모양 그대로 — AbortSignal.timeout()이
           던진 DOMException.message가 여기 실린다. */
        return { ok: false as const, step: "NETWORK_ERROR" as const, message: networkFailure, causeChain: [] };
      }
      const envelope = hoisted.responders.get(options.path) ?? { returnCode: "0000", data: [] };
      return {
        ok: true as const,
        httpStatus: 200,
        returnCode: envelope.returnCode,
        returnOk: envelope.returnCode === actual.LOTTEON_RETURN_CODE_OK,
        message: envelope.message ?? null,
        dataCount: Array.isArray(envelope.data) ? envelope.data.length : null,
        data: envelope.data,
        raw: envelope,
      };
    },
  };
});

const IDENTITY_TR_NO = "LO123456";

/** 150 문서 원문 Response Sample 형태 그대로(필드명 · 값 형식). */
const PLACE_ROWS = [
  { dvpNo: "PLO00008", dvpTypCd: "02", dvpNm: "사무실", useYn: "Y", rprtYn: "N" },
  { dvpNo: "PLO00009", dvpTypCd: "02", dvpNm: "물류창고", useYn: "Y", rprtYn: "Y" },
  { dvpNo: "PLO00010", dvpTypCd: "01", dvpNm: "회수지", useYn: "Y", rprtYn: "Y" },
];

const COST_ROWS = [{ dvCstPolNo: "DV0001", dvCstPolNm: "기본 배송비", useYn: "Y", rprtYn: "Y" }];

/** 89 문서 원문 Response Sample 형태. `dtlCd`는 문서에 없는 이름이라 일부러
 * 다른 값으로 함께 넣어 둔다 — 파서가 `cd`를 읽는지 구별하기 위해서다. */
const CODE_ROWS = [
  { grpCd: "DV_CO_CD", langCd: "ko", cd: "CJ", cdNm: "CJ대한통운", dtlCd: "WRONG", dtlCdNm: "틀린이름" },
  { grpCd: "DV_CO_CD", langCd: "ko", cd: "HJ", cdNm: "한진택배" },
];

function setDefaultResponders() {
  hoisted.responders.clear();
  hoisted.responders.set(LOTTEON_READ_PATHS.identity, {
    returnCode: "0000",
    data: { trGrpCd: "LO", trNo: IDENTITY_TR_NO, trDvsCd: "01", trNm: "테스트거래처" },
  });
  hoisted.responders.set(LOTTEON_READ_PATHS.deliveryPlaceList, { returnCode: "0000", data: PLACE_ROWS });
  hoisted.responders.set(LOTTEON_READ_PATHS.deliveryCostPolicyList, { returnCode: "0000", data: COST_ROWS });
  hoisted.responders.set(LOTTEON_READ_PATHS.detailCodeList, { returnCode: "0000", data: CODE_ROWS });
}

interface DeliverySettingsBody {
  ok: boolean;
  message?: string;
  reason?: string;
  failedStep?: string | null;
  elapsedMs?: number | null;
  proxyProvider?: string | null;
  notAttemptedSteps?: string[];
  sentAfflTrCd?: string;
  outboundPlaces?: { no: string; name: string | null; typeCode: string | null; isDefault: boolean }[];
  returnPlaces?: { no: string; isDefault: boolean }[];
  costPolicies?: { no: string; name: string | null }[];
  couriers?: { code: string; name: string | null }[];
  deliveryRegionGroups?: { code: string; name: string | null }[];
  issues?: { source: string; message: string }[];
}

async function runRoute(): Promise<DeliverySettingsBody> {
  const { GET } = await import("../delivery-settings/route");
  const response = await GET();
  return (await response.json()) as DeliverySettingsBody;
}

function callFor(path: string): CapturedCall | undefined {
  return hoisted.calls.find((call) => call.path === path);
}

beforeEach(() => {
  hoisted.calls.length = 0;
  hoisted.networkFailures.clear();
  setDefaultResponders();
});

describe("① 150 · 166 은 POST + JSON 바디다 (쿼리스트링이 아니다)", () => {
  it("150 출고지/반품지 조회를 POST로 부르고 afflTrCd를 바디에 싣는다", async () => {
    await runRoute();
    const call = callFor(LOTTEON_READ_PATHS.deliveryPlaceList);
    expect(call).toBeDefined();
    expect(call?.method).toBe("POST");
    expect(call?.body).toEqual({ afflTrCd: IDENTITY_TR_NO });
    // 🔴 쿼리스트링으로 보내지 않는다 — 문서 Request Sample이 JSON 바디다.
    expect(call?.query).toBeUndefined();
  });

  it("166 배송비정책 조회를 POST로 부르고 afflTrCd를 바디에 싣는다", async () => {
    await runRoute();
    const call = callFor(LOTTEON_READ_PATHS.deliveryCostPolicyList);
    expect(call?.method).toBe("POST");
    expect(call?.body).toEqual({ afflTrCd: IDENTITY_TR_NO });
    expect(call?.query).toBeUndefined();
  });

  it("afflLrtrCd(선택값)는 값이 없으면 **키 자체가 바디에 없다** — 빈 문자열로 채우지 않는다", async () => {
    await runRoute();
    for (const path of [LOTTEON_READ_PATHS.deliveryPlaceList, LOTTEON_READ_PATHS.deliveryCostPolicyList]) {
      const body = callFor(path)?.body as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(["afflTrCd"]);
      expect("afflLrtrCd" in body).toBe(false);
    }
  });

  it("89 공통코드는 GET + grpCd 쿼리 그대로다(문서가 GET이다 — 같이 바꾸지 않는다)", async () => {
    await runRoute();
    const codeCalls = hoisted.calls.filter((call) => call.path === LOTTEON_READ_PATHS.detailCodeList);
    expect(codeCalls.map((call) => call.method)).toEqual(["GET", "GET"]);
    expect(codeCalls.map((call) => call.query)).toEqual([{ grpCd: "DV_CO_CD" }, { grpCd: "DV_RGSPR_GRP_CD" }]);
    expect(codeCalls.every((call) => call.body === undefined)).toBe(true);
  });

  it("207 identity는 GET 그대로다", async () => {
    await runRoute();
    expect(callFor(LOTTEON_READ_PATHS.identity)?.method).toBe("GET");
  });
});

describe("② isDefault는 150의 rprtYn에서 온다 (bscYn이 아니다)", () => {
  it("rprtYn === 'Y' 인 건만 isDefault=true 로 잡힌다", async () => {
    const body = await runRoute();
    expect(body.ok).toBe(true);
    expect(body.outboundPlaces).toEqual([
      { no: "PLO00008", name: "사무실", typeCode: "02", isDefault: false },
      { no: "PLO00009", name: "물류창고", typeCode: "02", isDefault: true },
    ]);
    expect(body.returnPlaces?.[0]).toMatchObject({ no: "PLO00010", isDefault: true });
  });

  it("문서에 없는 bscYn만 들어오면 isDefault는 false다 — 없는 필드를 근거로 삼지 않는다", async () => {
    hoisted.responders.set(LOTTEON_READ_PATHS.deliveryPlaceList, {
      returnCode: "0000",
      data: [
        { dvpNo: "PLO00011", dvpTypCd: "02", dvpNm: "가", bscYn: "Y" },
        { dvpNo: "PLO00012", dvpTypCd: "02", dvpNm: "나", bscYn: "Y" },
      ],
    });
    const body = await runRoute();
    expect(body.outboundPlaces?.map((place) => place.isDefault)).toEqual([false, false]);
  });
});

describe("③ 89 파서는 cd / cdNm 을 1순위로 읽는다", () => {
  it("dtlCd가 함께 들어와도 cd / cdNm 값이 나온다", async () => {
    const body = await runRoute();
    expect(body.couriers).toEqual([
      { code: "CJ", name: "CJ대한통운" },
      { code: "HJ", name: "한진택배" },
    ]);
    expect(body.deliveryRegionGroups).toEqual(body.couriers);
  });
});

describe("HTTP 200이어도 returnCode가 0000이 아니면 실패다", () => {
  it("166이 returnCode 9999를 주면 배송비정책은 0건이고 그 사유가 issues에 남는다", async () => {
    hoisted.responders.set(LOTTEON_READ_PATHS.deliveryCostPolicyList, {
      returnCode: "9999",
      message: "조회 권한이 없습니다.",
      data: COST_ROWS,
    });
    const body = await runRoute();
    expect(body.costPolicies).toEqual([]);
    expect(body.issues?.some((issue) => issue.source.startsWith("166"))).toBe(true);
    // 출고지(150)는 정상이므로 그대로 살아 있다 — 한 API의 실패가 전체를 지우지 않는다.
    expect(body.outboundPlaces).toHaveLength(2);
  });

  it("207 identity가 실패하면 150/166을 아예 부르지 않는다(임의의 afflTrCd로 질의하지 않는다)", async () => {
    hoisted.responders.set(LOTTEON_READ_PATHS.identity, { returnCode: "9999", data: null });
    const body = await runRoute();
    expect(body.ok).toBe(false);
    expect(callFor(LOTTEON_READ_PATHS.deliveryPlaceList)).toBeUndefined();
    expect(callFor(LOTTEON_READ_PATHS.deliveryCostPolicyList)).toBeUndefined();
  });
});

/* ══ LOTTEON-TIMEOUT-1 ═══════════════════════════════════════════════════════
 * CEO 실측(2026-09-15, Production b8a0e52): ⑤배송에 이 한 줄만 섰다 —
 *   "롯데ON 배송 설정을 불러오지 못했습니다 — 롯데ON 응답이 제한 시간 안에 오지 않았습니다."
 * 이 라우트는 5회 직렬인데 그 문장은 **어느 회차에서 끊겼는지 말하지 않았다.**
 * 다음 조사가 또 맨땅에서 시작하지 않도록, 실패 응답이 단계를 대는지 고정한다.
 * ═══════════════════════════════════════════════════════════════════════════ */
describe("LOTTEON-TIMEOUT-1 — 실패하면 어느 단계에서 끊겼는지 응답이 말한다", () => {
  /** AbortSignal.timeout()이 던지는 DOMException의 실제 message. */
  const TIMEOUT_RAW = "The operation was aborted due to timeout";

  it("🔴 207에서 타임아웃이면 message가 '207 …에서 끊겼습니다'로 시작한다", async () => {
    hoisted.networkFailures.set(LOTTEON_READ_PATHS.identity, TIMEOUT_RAW);
    const body = await runRoute();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("IDENTITY_FAILED");
    expect(body.failedStep).toBe("207 identity(거래처 조회)");
    expect(body.message?.startsWith("207 identity(거래처 조회)에서 끊겼습니다 — ")).toBe(true);
    // 🔴 영문 예외 원문은 셀러 문장에 남지 않는다(REWORK-12 ②의 계약 유지).
    expect(body.message).not.toContain(TIMEOUT_RAW);
  });

  it("🔴 207에서 멈췄으면 나머지 4단계를 '부르지 않았다'고 이름으로 적는다", async () => {
    hoisted.networkFailures.set(LOTTEON_READ_PATHS.identity, TIMEOUT_RAW);
    const body = await runRoute();
    expect(body.notAttemptedSteps).toEqual([
      "150 출고지/반품지 조회",
      "166 배송비정책 조회",
      "89 공통코드 DV_CO_CD",
      "89 공통코드 DV_RGSPR_GRP_CD",
    ]);
    // 말만 그런 게 아니라 실제로 부르지 않았다.
    expect(hoisted.calls.map((call) => call.path)).toEqual([LOTTEON_READ_PATHS.identity]);
  });

  it("소요시간과 아웃바운드 홉이 응답에 남는다 — 20초를 다 썼는지 구분할 수 있어야 한다", async () => {
    hoisted.networkFailures.set(LOTTEON_READ_PATHS.identity, TIMEOUT_RAW);
    const body = await runRoute();
    expect(typeof body.elapsedMs).toBe("number");
    // 프록시 미설정 환경에서도 라벨은 남는다(값은 "OCI"/"FIXIE"/"NONE" 셋 중 하나).
    expect(["OCI", "FIXIE", "NONE"]).toContain(body.proxyProvider);
  });

  it("🔴 150이 타임아웃이면 전체가 죽지 않는다 — 그 단계만 issues에 이름으로 남는다", async () => {
    hoisted.networkFailures.set(LOTTEON_READ_PATHS.deliveryPlaceList, TIMEOUT_RAW);
    const body = await runRoute();
    // 207은 성공했으므로 라우트는 ok:true다 — 한 단계의 실패가 나머지를 지우지 않는다.
    expect(body.ok).toBe(true);
    expect(body.outboundPlaces).toEqual([]);
    expect(body.issues?.some((issue) => issue.source === "150 출고지/반품지 조회")).toBe(true);
    // 166 · 89는 그대로 살아 있다.
    expect(body.costPolicies).toHaveLength(1);
    expect(body.couriers).toHaveLength(2);
  });

  it("🔴 응답 어디에도 인증키·프록시 URL이 실리지 않는다", async () => {
    hoisted.networkFailures.set(LOTTEON_READ_PATHS.identity, TIMEOUT_RAW);
    const serialized = JSON.stringify(await runRoute());
    expect(serialized).not.toContain("TEST-KEY-NOT-A-REAL-KEY");
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toMatch(/https?:\/\/[^"]*@/);
  });
});

describe("무엇으로 물어봤는지를 응답이 그대로 말한다", () => {
  it("sentAfflTrCd = 207이 준 trNo (🔴 이 등식 자체는 아직 미확인 — 그래서 응답에 싣는다)", async () => {
    const body = await runRoute();
    expect(body.sentAfflTrCd).toBe(IDENTITY_TR_NO);
  });
});
