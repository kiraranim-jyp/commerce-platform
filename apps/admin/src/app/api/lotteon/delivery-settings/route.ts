import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { fetchLotteOnIdentity } from "../_lib/identity";
import { runLotteOnRead } from "../_lib/request";

/**
 * REWORK-11 ④(CEO 지시, 2026-09-15) — **배송 설정을 우리가 조회한다.**
 *
 * ── 무엇을 고치는가 ───────────────────────────────────────────────────────
 * CEO 실측: 롯데ON 판매자센터에 출고지·반품지·배송비정책이 **이미 등록돼 있다.**
 * 그런데 따져의 롯데ON 탭은 그 번호들을 셀러가 손으로 옮겨 적게 했고, 화면에는
 * "셀러 설정에서 자동으로 채울 수 없습니다"라고만 적혀 있었다. 우리가 물어보지
 * 않았을 뿐이다.
 *
 * ── 부르는 것 ─────────────────────────────────────────────────────────────
 *   207 identity           GET                      trGrpCd · trNo (거래처)
 *   150 getDvpListSr       **POST + JSON 바디**      출고지(dvpTypCd=02) · 반품지(01)
 *   166 getDvCstListSr     **POST + JSON 바디**      배송비 정책
 *    89 getDetailCodeList  GET(grpCd 쿼리)           택배사(DV_CO_CD) · 배송가능지역(DV_RGSPR_GRP_CD)
 * 전부 **읽기**다. forbidden-endpoints.ts의 금지 목록(주문/배송/클레임 쓰기)에
 * 하나도 닿지 않는다 — 그리고 닿더라도 client.ts의 guard가 네트워크 전에 끊는다.
 *
 * 메서드/바디는 문서 원문(공개 문서 백엔드 apiNo=150 · 166 · 89)에서 확인한 값이다.
 * LOTTEON-HOLD-FIX-A(2026-09-15) 전까지 150/166을 GET + 쿼리스트링으로 부르고
 * 있었다 — 그 동안 `afflTrCd`는 문서가 요구한 자리(JSON 바디)에 실린 적이 없다.
 *
 * ── 🔴 확정되지 않은 것: `afflTrCd` ───────────────────────────────────────
 * 150/166은 소속거래처코드(`afflTrCd`)를 요구한다. 그 값이 **207의 trNo인지 별도
 * 상위 거래처번호인지 문서에서 확정하지 못했다.** 실호출로 검증할 수단이 없다.
 *
 * 그래서 이 라우트는 두 가지를 지킨다:
 *   1. 값을 **지어내지 않는다.** 207이 준 trNo를 그대로 보내고, 무엇을 보냈는지
 *      (`sentAfflTrCd`)를 응답에 실어 화면이 그대로 보여줄 수 있게 한다.
 *   2. 실패하거나 **0건이면 그 사유를 그대로 올려보낸다**(`issues`). "설정값이
 *      없습니다"로 바꿔서 셀러에게 다시 입력시키지 않는다 — 조회를 못 한 것과
 *      판매자센터에 정말 없는 것은 셀러가 해야 할 일이 완전히 다르다.
 *
 * ── 🔴 LOTTEON-TIMEOUT-1(CEO 실측, 2026-09-15) ────────────────────────────
 * CEO 화면에 선 문장은 "롯데ON 응답이 제한 시간 안에 오지 않았습니다." 한 줄뿐이었다.
 * 이 라우트는 **5회 직렬**(207 → 150 → 166 → 89×2)인데 그 한 줄은 어느 회차에서
 * 끊겼는지 말하지 않았다. 게다가 `ok:false`로 내려가는 길은 ① 207 실패뿐이라
 * (150/166/89 실패는 `issues`로 가고 `ok:true`다) 그 문장을 본 순간 이미
 * **207에서 끊겼다는 뜻**이었는데도 화면이 그렇게 말하지 못했다.
 * 이제 실패한 단계 이름(`failedStep`) · 소요시간 · 아웃바운드 홉을 같이 싣는다.
 *
 * ── 직렬을 병렬로 바꾸지 않은 이유 ────────────────────────────────────────
 * 150 · 166 · 89(DV_CO_CD) · 89(DV_RGSPR_GRP_CD)는 서로 의존하지 않는다
 * (전부 207의 trNo 하나만 필요하다). 그래도 직렬로 둔다 — 2026-09-15 실측에서
 * 병목은 롯데ON이 아니라 **아웃바운드 프록시의 CONNECT 핸드셰이크**였고
 * (60초 넘게 무응답인 경우가 8회 중 3회), 터널이 한 번 서면 뒤따르는 호출은
 * 같은 keep-alive 소켓을 재사용해 290ms에 끝난다. 병렬로 바꾸면 undici가
 * 소켓을 여러 개 열어 **CONNECT를 오히려 여러 번** 하게 된다 — 지금 병목에서는
 * 느려지는 쪽이다. 프록시가 고쳐지기 전에는 이 순서를 유지한다.
 */

export const dynamic = "force-dynamic";

/**
 * LOTTEON-TIMEOUT-1 — 단계 이름은 여기 한 곳에만 둔다. `issues[].source`,
 * `runLotteOnRead({step})`(서버 로그), `notAttemptedSteps`가 **같은 글자**를
 * 써야 로그와 화면을 나중에 맞춰 볼 수 있다.
 */
const STEP_PLACES = "150 출고지/반품지 조회";
const STEP_COST = "166 배송비정책 조회";
const stepForCodes = (groupCode: string) => `89 공통코드 ${groupCode}`;

/** 판매자센터에 등록된 장소 한 건. 번호는 롯데ON이 발급한 것이고 우리가 만들지 않는다. */
interface DeliveryPlace {
  /** dvpNo — 87 payload의 owhpNo / rtrpNo 로 들어간다. */
  no: string;
  name: string | null;
  /** dvpTypCd — 01 반품(회수)지 · 02 출고지. */
  typeCode: string | null;
  /** 대표 출고/회수지인가(150 문서 원문 `rprtYn` [default:'N']). 하나뿐일 때 자동 적용의 근거. */
  isDefault: boolean;
}

interface CostPolicy {
  /** dvCstPolNo — 87 payload의 dvCstPolNo. */
  no: string;
  name: string | null;
}

interface CodeOption {
  code: string;
  name: string | null;
}

interface Issue {
  /** 어느 API가 답하지 못했는가 — 화면이 apiNo를 그대로 보여준다. */
  source: string;
  message: string;
}

function str(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * 봉투의 data가 배열인지 `{list: []}`인지 확정되지 않았다 — 둘 다 읽는다.
 * 어느 쪽도 아니면 빈 배열이고, 호출부가 그 사실을 issue로 적는다.
 */
function rows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  if (data && typeof data === "object") {
    for (const key of ["list", "itemList", "dvpList", "dvCstList", "codeList"]) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
      }
    }
  }
  return [];
}

/**
 * 150 · 166의 **요청 바디**. 두 API 모두 문서 원문이 `POST` + JSON 바디이고
 * Request Sample이 `{"afflTrCd":"LO999999","afflLrtrCd":"SLO99999"}`다 —
 * 쿼리스트링이 아니다.
 *
 * 🔴 `afflLrtrCd`(하위거래처번호)는 문서상 **선택값**이고, 우리에게는 그 값이
 * 없다(207 identity는 trGrpCd/trNo만 준다). 그래서 **키 자체를 넣지 않는다** —
 * 빈 문자열로 채우면 "하위거래처가 빈 문자열인 곳을 찾아라"라는 다른 질문이
 * 되고, 0건이 돌아와도 그것이 조회 실패인지 정말 없는 것인지 구분할 수 없게 된다.
 */
function buildAfflBody(afflTrCd: string): Record<string, string> {
  return { afflTrCd };
}

async function readErrorMessage(response: NextResponse): Promise<string> {
  const body = (await response.clone().json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? "롯데ON이 응답하지 않았습니다.";
}

export async function GET() {
  const issues: Issue[] = [];

  /* ① 거래처 — 150/166이 요구하는 afflTrCd의 유일한 출처다. */
  const identity = await fetchLotteOnIdentity();
  if (!identity.ok) {
    return NextResponse.json({
      ok: false,
      reason: "IDENTITY_FAILED",
      /* 🔴 LOTTEON-TIMEOUT-1 — 사유 앞에 **어느 단계인지**를 붙인다. 화면이
         서버 문장을 그대로 세우는 규약(패널 DeliveryLookupNote)이라, 여기서
         붙이면 화면 파일을 건드리지 않고도 셀러가 단계를 읽을 수 있다. */
      message: `${identity.step}에서 끊겼습니다 — ${identity.message}`,
      failedStep: identity.step,
      elapsedMs: identity.elapsedMs,
      proxyProvider: identity.proxyProvider,
      /* 아직 부르지 않은 나머지 단계를 적어 둔다 — "5회 중 1회에서 멈췄다"는
         사실이 응답만 보고도 드러나야 한다. */
      notAttemptedSteps: [STEP_PLACES, STEP_COST, stepForCodes("DV_CO_CD"), stepForCodes("DV_RGSPR_GRP_CD")],
      /* 🔴 여기서 멈춘다. afflTrCd 없이 150/166을 부르면 무엇을 물어본 것인지
         알 수 없는 응답이 온다 — 임의의 값으로 질의하지 않는다. */
    });
  }
  const afflTrCd = identity.identity.trNo;

  /* ② 출고지 · 반품지(150). */
  const outboundPlaces: DeliveryPlace[] = [];
  const returnPlaces: DeliveryPlace[] = [];
  const placeRead = await runLotteOnRead({
    method: "POST",
    path: LOTTEON_READ_PATHS.deliveryPlaceList,
    body: buildAfflBody(afflTrCd),
    step: STEP_PLACES,
  });
  if (!placeRead.ok) {
    issues.push({ source: STEP_PLACES, message: await readErrorMessage(placeRead.response) });
  } else {
    const list = rows(placeRead.result.data);
    if (list.length === 0) {
      issues.push({
        source: STEP_PLACES,
        message: `응답은 받았지만 목록이 0건입니다(소속거래처코드 ${afflTrCd}로 조회). 판매자센터에 출고지/반품지가 등록돼 있는데도 0건이면 조회에 쓴 소속거래처코드가 다른 값일 수 있습니다.`,
      });
    }
    for (const row of list) {
      const no = str(row, "dvpNo", "dvp_no", "owhpNo", "rtrpNo");
      if (!no) continue;
      const place: DeliveryPlace = {
        no,
        name: str(row, "dvpNm", "dvp_nm"),
        typeCode: str(row, "dvpTypCd", "dvp_typ_cd"),
        /* 150 문서 원문의 응답 필드는 `rprtYn`(대표 출고/회수지 여부 [default:'N'])다.
           `bscYn`은 이 문서 어디에도 없다 — 그 이름으로 읽던 동안 isDefault는
           항상 false였고, "기본 표시건 자동 적용"이 한 번도 동작하지 않았다. */
        isDefault: (str(row, "rprtYn", "rprt_yn") ?? "").toUpperCase() === "Y",
      };
      // 문서상 02 = 출고지, 01 = 반품(회수)지. 유형을 못 읽으면 어느 쪽으로도
      // 분류하지 않는다 — 반품지를 출고지로 넣으면 주문이 엉뚱한 곳으로 간다.
      if (place.typeCode === "02") outboundPlaces.push(place);
      else if (place.typeCode === "01") returnPlaces.push(place);
      else
        issues.push({
          source: STEP_PLACES,
          message: `장소 ${no}의 유형코드(dvpTypCd)를 읽지 못해 출고지/반품지 어느 쪽으로도 분류하지 않았습니다.`,
        });
    }
  }

  /* ③ 배송비 정책(166). */
  const costPolicies: CostPolicy[] = [];
  const costRead = await runLotteOnRead({
    method: "POST",
    path: LOTTEON_READ_PATHS.deliveryCostPolicyList,
    body: buildAfflBody(afflTrCd),
    step: STEP_COST,
  });
  if (!costRead.ok) {
    issues.push({ source: STEP_COST, message: await readErrorMessage(costRead.response) });
  } else {
    const list = rows(costRead.result.data);
    if (list.length === 0) {
      issues.push({
        source: STEP_COST,
        message: `응답은 받았지만 목록이 0건입니다(소속거래처코드 ${afflTrCd}로 조회).`,
      });
    }
    for (const row of list) {
      const no = str(row, "dvCstPolNo", "dv_cst_pol_no");
      if (!no) continue;
      costPolicies.push({ no, name: str(row, "dvCstPolNm", "dv_cst_pol_nm") });
    }
  }

  /* ④ 공통코드(89) — 택배사 · 배송가능지역. */
  async function detailCodes(groupCode: string): Promise<CodeOption[]> {
    const read = await runLotteOnRead({
      method: "GET",
      path: LOTTEON_READ_PATHS.detailCodeList,
      query: { grpCd: groupCode },
      step: stepForCodes(groupCode),
    });
    if (!read.ok) {
      issues.push({ source: stepForCodes(groupCode), message: await readErrorMessage(read.response) });
      return [];
    }
    const list = rows(read.result.data);
    if (list.length === 0) {
      issues.push({ source: stepForCodes(groupCode), message: "응답은 받았지만 목록이 0건입니다." });
    }
    return list
      .map((row) => {
        /* 89 문서 원문의 data 배열 필드는 `grpCd · langCd · cd · cdNm · cdEpn · sortSeq …`다.
           `dtlCd`/`dtlCdNm`은 존재하지 않는다 — 없는 이름을 1순위에 두고 있었고
           실제 값은 폴백이 주워 담고 있었다. 1순위를 문서 원문으로 되돌린다. */
        const code = str(row, "cd");
        if (!code) return null;
        return { code, name: str(row, "cdNm") };
      })
      .filter((option): option is CodeOption => option != null);
  }

  const couriers = await detailCodes("DV_CO_CD");
  const deliveryRegionGroups = await detailCodes("DV_RGSPR_GRP_CD");

  return NextResponse.json({
    ok: true,
    readOnly: true,
    /** 🔴 무엇을 물어봤는지를 화면이 그대로 보여준다(afflTrCd 확정 전이라 중요하다). */
    sentAfflTrCd: afflTrCd,
    outboundPlaces,
    returnPlaces,
    costPolicies,
    couriers,
    deliveryRegionGroups,
    issues,
  });
}
