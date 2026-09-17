import { NextResponse } from "next/server";
import type { CanonicalProduct } from "@commerce/shared";
import {
  buildLotteOnPayload,
  validateLotteOnPayload,
  type LotteOnProductRegistrationPayload,
  type LotteOnRegistrationResultRow,
} from "@commerce/listing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRegistrationAccess } from "@/lib/auth/require-registration-access";
import { getLotteOnCredentials } from "../_lib/env";
import { callLotteOnApi, LOTTEON_WRITE_PATHS } from "../_lib/client";
import { classifyLotteOnHttpStatus } from "../_lib/connection-error";
import { buildLotteOnContext, type LotteOnChannelFormInput } from "../_lib/build-context";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — 롯데ON 실제 상품등록.
 *
 * `87 상품 등록` POST /v1/openapi/product/v1/product/registration/request
 *
 * 이번 스프린트에서 **허용된 유일한 쓰기**다(조사 §6-3: 상품 축은 2단계 승인 +
 * 판매중지 전환으로 되돌릴 수 있어 기존 쿠팡/스마트스토어와 동일한 검증 관행이
 * 성립한다). 판매관리 쓰기(210/137/52/60/71/225 …)는 구현하지 않았고
 * `_lib/forbidden-endpoints.ts` guard가 호출 자체를 차단한다.
 *
 * 원칙은 기존 두 register 라우트와 같다:
 *  - 상품 **1개만** 받는다(배열 인터페이스를 만들지 않는다).
 *  - Preview와 **같은 함수**로 조립·검증한다(buildLotteOnContext).
 *  - 검증(BLOCKED/MISSING)이 남아 있으면 API를 호출하지 않는다 — 마지막 방어선.
 *  - 성공/실패 모두 `registration_attempts`에 기록한다(새 로깅 계층 없음).
 */
const LOTTEON_PLATFORM_KEY = "lotteon";

interface LotteOnRegisterResult {
  status: "SUBMITTED" | "FAILED";
  /** 채널 상품 ID(판매자상품번호 spdNo). */
  externalProductId: string | null;
  traceId: string;
  durationMs: number;
  message: string;
  errorCode: string | null;
  payload?: LotteOnProductRegistrationPayload;
  /** 87 응답의 data[] — 항목별 처리결과. */
  rows?: LotteOnRegistrationResultRow[];
  /** 옵션(단품) 단위 채널 ID를 저장하지 못한 이유. 아래 주석 참고. */
  optionIdNote?: string;
}

/**
 * 🔴 옵션(단품) 단위 채널 ID를 저장하지 않는 이유 — 저장할 자리가 없어서가 아니라
 * **롯데ON이 등록 응답으로 돌려주지 않기 때문**이다.
 *
 * 87 문서의 Received Message는 `epdNo / spdNo / resultCode / resultMessage`
 * 네 개뿐이다. 쿠팡 vendorItemId에 해당하는 단품번호(sitmNo)는 등록 응답에
 * 없고, 나중에 `93 상품 목록 조회`의 sitmNoLst로만 얻을 수 있다.
 * 그래서 새 테이블을 만들지 않았고, 없는 값을 만들어 넣지도 않았다.
 */
const OPTION_ID_NOTE =
  "롯데ON 상품등록(87) 응답에는 단품(옵션) 번호가 포함되지 않습니다 — 판매자상품번호(spdNo)만 저장했습니다. 단품번호가 필요하면 상품 목록 조회(93)의 sitmNoLst로 별도 조회해야 합니다.";

/** 쿠팡/스마트스토어 register 라우트의 logRegistrationAttempt와 같은 구조·같은
 * 테이블. 새 로깅 계층을 만들지 않는다. 미실행 마이그레이션 대비 폴백도 동일. */
async function logRegistrationAttempt(
  result: LotteOnRegisterResult,
  apiResponseBody: unknown,
  snapshotId: string | null,
  jobKey: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const row: Record<string, unknown> = {
    platform: LOTTEON_PLATFORM_KEY,
    status: result.status,
    error_code: result.errorCode,
    trace_id: result.traceId,
    duration_ms: result.durationMs,
    external_product_id: result.externalProductId,
    payload: result.payload ?? null,
    response: apiResponseBody ?? null,
    snapshot_id: snapshotId,
    job_key: jobKey,
  };
  const optionalColumns = ["snapshot_id", "job_key"];
  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { error } = await supabase.from("registration_attempts").insert(row);
    if (!error) return;
    console.warn(`[lotteon/register] registration_attempts 기록 실패(시도 ${attempt + 1}):`, error.message);
    const nextColumn = optionalColumns[attempt];
    if (!nextColumn || !(nextColumn in row)) break;
    delete row[nextColumn];
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const traceId = crypto.randomUUID();

  const body = (await request.json().catch(() => null)) as {
    product?: CanonicalProduct;
    channel?: LotteOnChannelFormInput;
    snapshotId?: string;
    jobKey?: string;
    liveRates?: Record<string, number>;
    roundingUnit?: number;
  } | null;

  if (!body?.product) {
    return NextResponse.json({ ok: false, message: "product가 필요합니다." }, { status: 400 });
  }
  const snapshotId = body.snapshotId ?? null;
  const jobKey = body.jobKey ?? null;

  // P0-C PRE-REGISTER SECURITY GATE(CEO 승인, 2026-09-17) — 쿠팡/스마트스토어
  // register와 **같은 함수**를 같은 자리(getLotteOnCredentials() 직전)에 둔다.
  // 롯데ON 계정은 commerce_accounts platform='lotteon'의 **첫 행**이다.
  // 🔴 여기가 특히 중요하다: `_lib/forbidden-endpoints.ts`는 상품 축(87 등록)을
  //    명시적으로 **허용**하므로, 인증키가 들어가는 순간 코드 레벨 STOP이 없다.
  //    오늘 롯데ON이 안전한 유일한 이유가 "키가 없어서"였다.
  const access = await requireRegistrationAccess(snapshotId);
  if (!access.ok) return access.response;

  const finish = (partial: Omit<LotteOnRegisterResult, "traceId" | "durationMs">): LotteOnRegisterResult => ({
    ...partial,
    traceId,
    durationMs: Date.now() - startedAt,
  });

  const credentials = await getLotteOnCredentials();
  if (!credentials) {
    const result = finish({
      status: "FAILED",
      externalProductId: null,
      message: "롯데ON 인증키가 설정되어 있지 않습니다 — 설정 > 커머스 계정 관리에서 인증키를 입력해 주세요.",
      errorCode: "NOT_CONFIGURED",
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json({ ok: false, result });
  }

  const context = await buildLotteOnContext(body.product, body.channel ?? {}, {
    liveRates: body.liveRates,
    roundingUnit: body.roundingUnit,
  });

  // 마지막 방어선 — Preview와 같은 검증 함수다. 화면이 이미 막아주는 게 정상
  // 경로지만, 오래된 클라이언트 상태로 요청이 와도 잘못된 등록이 나가지 않게 한다.
  const validation = validateLotteOnPayload(context.input);
  const payload = buildLotteOnPayload(context.input);
  if (!validation.ok) {
    const reasons = validation.fields
      .filter((field) => field.status !== "READY")
      .map((field) => `${field.label}: ${field.reason ?? ""}`)
      .join(" / ");
    const result = finish({
      status: "FAILED",
      externalProductId: null,
      payload,
      message: `등록에 필요한 값이 부족합니다 — ${reasons}`,
      errorCode: "VALIDATION",
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json({ ok: false, result, validation, identityError: context.identityError });
  }

  const response = await callLotteOnApi(credentials.apiKey, {
    method: "POST",
    path: LOTTEON_WRITE_PATHS.productRegistration,
    body: payload,
  });

  if (!response.ok) {
    const result = finish({
      status: "FAILED",
      externalProductId: null,
      payload,
      message: response.message,
      errorCode: response.step,
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json({ ok: false, result, validation });
  }

  const httpIssue = classifyLotteOnHttpStatus(response.httpStatus);
  if (httpIssue) {
    const result = finish({
      status: "FAILED",
      externalProductId: null,
      payload,
      message: `${httpIssue.userMessage} ${httpIssue.nextAction}`,
      errorCode: `HTTP_${response.httpStatus}`,
    });
    await logRegistrationAttempt(result, response.raw, snapshotId, jobKey);
    return NextResponse.json({ ok: false, result, validation });
  }

  const rows = Array.isArray(response.data) ? (response.data as LotteOnRegistrationResultRow[]) : [];
  const spdNo = rows.find((row) => typeof row?.spdNo === "string" && row.spdNo.trim())?.spdNo ?? null;

  // 🔴 HTTP 200만으로 성공 처리하지 않는다(조사 §5-1). returnCode가 "0000"이고
  // 판매자상품번호(spdNo)가 실제로 돌아왔을 때만 SUBMITTED다 — 둘 중 하나라도
  // 없으면 "등록됐다"고 말할 근거가 없다.
  if (!response.returnOk || !spdNo) {
    const rowMessage = rows
      .map((row) => [row?.resultCode, row?.resultMessage].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(" / ");
    const result = finish({
      status: "FAILED",
      externalProductId: null,
      payload,
      rows,
      message:
        `롯데ON이 등록을 완료하지 않았습니다(returnCode ${response.returnCode ?? "없음"})` +
        (response.message ? ` — ${response.message}` : "") +
        (rowMessage ? ` / ${rowMessage}` : "") +
        (!spdNo && response.returnOk ? " — 응답에 판매자상품번호(spdNo)가 없습니다." : ""),
      errorCode: response.returnCode ?? "RETURN_CODE_MISSING",
    });
    await logRegistrationAttempt(result, response.raw, snapshotId, jobKey);
    return NextResponse.json({ ok: false, result, validation });
  }

  const result = finish({
    status: "SUBMITTED",
    externalProductId: spdNo,
    payload,
    rows,
    message: "롯데ON에 상품 등록을 요청했습니다.",
    errorCode: null,
    optionIdNote: OPTION_ID_NOTE,
  });
  await logRegistrationAttempt(result, response.raw, snapshotId, jobKey);

  return NextResponse.json({
    ok: true,
    result,
    validation,
    /** 🔴 HTTP 200 = 완료가 아니다. 롯데ON은 **2단계 승인**(카테고리 승인 +
     * 상품정보 승인)이 둘 다 끝나야 고객 화면에 노출된다 — 상태는
     * /api/lotteon/product-status(93)로 확인해야 한다. */
    nextStep:
      "등록 요청이 접수되었습니다. 롯데ON은 카테고리 승인과 상품정보 승인 2단계를 모두 통과해야 실제로 노출됩니다 — 상품 상태 조회에서 최종승인여부(fnlAprvYn)를 확인하세요.",
  });
}
