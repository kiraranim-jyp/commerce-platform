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
import { createGateMessage, resolveCreateGate, resolveLifecycle } from "@/app/pipeline/commerce/channel-lifecycle";
import { hasPriorSuccessfulAttempt } from "../../snapshots/_lib/attempts-summary";
import {
  findChannelProductBySnapshot,
  findProductIdBySnapshot,
  linkChannelProduct,
} from "@/app/api/_lib/channel-product";

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
  /* P0-CHANNEL-03 F-9 — 이 시도가 «무엇» 이었는가.
     🔴 'CREATE' 만 받는다. 롯데ON 은 update·categoryUpdate 가 둘 다 UNKNOWN
     이라 UPDATE 도 RECREATE 도 «실행 경로가 없다» — 받을 수 없는 값을 타입에
     열어 두면 다음 사람이 「적을 수 있으니 할 수 있다」고 읽는다. */
  lifecycle?: { operation: "CREATE"; channelProductId: string | null } | null,
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
    /* 🔴 모르면 비운다 — 세 라우트 공통 규약(SmartStore F-5 · Coupang F-8). */
    operation: lifecycle?.operation ?? null,
    channel_product_id: lifecycle?.channelProductId ?? null,
    snapshot_id: snapshotId,
    job_key: jobKey,
  };
  /* 가장 새 컬럼이 가장 먼저 포기된다 — 063 미적용 환경에서도 이력 기록
     «자체» 가 실패하지 않게(세 라우트 공통 규약). */
  const optionalColumns = ["channel_product_id", "operation", "snapshot_id", "job_key"];
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

  /* 🔴 PIVOT-03 R6-FS — 검증보다 «앞» 이다. 아래 validateLotteOnPayload 는
     「값이 있는가」를 보는데, 지금은 값이 있는지 «없는지도 모르는» 상태다.
     그 상태를 「부족합니다」로 말하면 셀러가 설정을 고치러 가지만 고칠 것이
     없다 — 원인은 우리 쪽 조회 실패다. */
  if (context.sellerSettingsError) {
    const result = finish({
      status: "FAILED",
      externalProductId: null,
      /* payload 를 만들지 «않는다». 지금 만들면 판매자 정보가 빈 칸으로 들어간
         payload 가 기록에 남고, 나중에 보면 「이 값으로 시도했다」로 읽힌다 —
         실제로는 값을 몰랐던 것이다. */
      payload: undefined,
      message: context.sellerSettingsError,
      errorCode: "VALIDATION",
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json({
      ok: false,
      result,
      identityError: context.identityError,
      sellerSettingsError: context.sellerSettingsError,
    });
  }

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

  /* ══════════════════════════════════════════════════════════════════════════
     P0-CHANNEL-03 F-9 — 롯데ON 은 «만들기 하나» 다. 그리고 그것이 정직한 상태다.

     capability(channel-lifecycle.ts, CTO 지시로 2026-09-25 정정):
         update         UNKNOWN   apiNo 90 은 「승인 상품 수정」이고 계약 미확인
         categoryUpdate UNKNOWN   근거 없음
     둘 다 UNKNOWN 이므로 이미 나가 있는 상품에 대해 이 라우트가 «실행할 수
     있는 것이 없다». 그래서 UPDATE 도 RECREATE 도 만들지 않았다.

     ── 🔴 왜 「지금 나가 있는 카테고리」를 읽지 않는가 ──────────────────────
     SmartStore·Coupang 은 읽어서 대조한다. 롯데ON 만 읽지 않는 이유는 게을러서가
     아니라 «읽어도 비교할 수 없어서» 다:
       · 롯데ON 카테고리는 표준(`scatNo`) + 전시(`dcatLst[]`) «2중 구조» 다
         (조사 §7-2). 네이버/쿠팡의 leaf 1개와 달리 「카테고리 하나」를 견줄 수
         없고, 무엇이 같아야 같은 것인지부터 정해진 바 없다.
       · apiNo 94 상품상세조회는 읽기라서 «부르는 것» 자체는 안전하지만, 응답
         모양을 실측한 적이 없다. 실측 없이 필드명을 찍으면 거의 확실히
         undefined 가 오고, 그러면 결국 여기와 «같은 결론»(UNKNOWN)에 이른다 —
         API 만 한 번 더 부르고.
     🔴 그래서 categoryUnknown: true 를 «그대로» 넘긴다. 그 결과가 BLOCKED 다.
     이 라우트가 이 상품에 대해 확인한 것이 정말로 그것뿐이기 때문이다.

     올리는 조건: 2중 카테고리의 동일성 정의 + apiNo 94 응답 실측. 그 전에는
     늘리지 않는다 — 이번 스프린트가 apiNo 90 에서 배운 것이 그것이다.
  ══════════════════════════════════════════════════════════════════════════ */
  const existing = await findChannelProductBySnapshot(snapshotId, LOTTEON_PLATFORM_KEY);
  /* 🔴 중복 CREATE 차단이 «이 분기 자체» 다. SmartStore·Coupang 은 RECREATE 가
     아래 POST 로 흘러가므로 POST 직전에 blocksCreate() 빗장을 따로 뒀지만,
     여기는 연결이 있으면 «무조건 반환» 한다 — 「연결 있음 → 새로 만들기」로
     가는 경로가 문법적으로 존재하지 않는다. 그래서 빗장을 한 번 더 두면
     도달할 수 없는 죽은 코드가 되고, 읽는 사람에게 「여기로 올 수도 있다」는
     잘못된 인상을 준다. 빗장 대신 이 주석을 둔다. */
  if (existing) {
    const decision = resolveLifecycle(LOTTEON_PLATFORM_KEY, true, {
      /* 🔴 비교하지 «않았다». 「바뀐 게 없다」가 아니다 — 바로 아래
         comparedEverything:false 가 그 차이를 말한다(F-6). */
      fields: [],
      category: false,
      categoryUnknown: true,
      comparedEverything: false,
    });
    const result = finish({
      status: "FAILED",
      externalProductId: existing.externalProductId,
      payload,
      message: `${decision.reason} 이미 롯데ON 에 등록돼 있습니다(spdNo=${existing.externalProductId}) — 새로 만들지 않았습니다.`,
      errorCode: decision.operation,
    });
    /* 🔴 operation 을 적지 않는다 — 아무것도 하지 않았다. */
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json({ ok: false, result, validation });
  }

  /* 🔴 P0-CHANNEL-03 F-12 후속 — 연결이 «없어도» 이미 나가 있을 수 있다.
     세 라우트 공통 빗장이다(SmartStore·Coupang 과 같은 이유). 기존 381
     snapshot 은 product_id 가 NULL 이라 연결을 «가질 수 없고», 연결 기록이
     유실되는 경로도 설계상 존재한다. 그 상태로 여기 도달하면 위의
     `if (existing)` 분기를 지나쳐 새 상품을 만든다.
     확인하지 «못한» 경우(null)도 막는다 — 중복보다 재시도가 싸다. */
  const gate = resolveCreateGate({
    /* 🔴 여기까지 왔다는 것은 연결이 «없다» 는 뜻이다 — 있으면 위에서 이미
       반환했다. 그 사실을 그대로 넘긴다(다시 조회하지 않는다). */
    hasChannelProduct: false,
    priorSuccess: await hasPriorSuccessfulAttempt(snapshotId, LOTTEON_PLATFORM_KEY),
    /* 🔴 롯데ON 에는 RECREATE 실행 경로가 없다 — capability 가 UNKNOWN 이라
       resolveLifecycle 이 내지도 않는다. 상수로 적어 그 사실을 드러낸다. */
    plannedOperation: "CREATE",
  });
  if (gate !== "ALLOW") {
    const result = finish({
      status: "FAILED",
      externalProductId: null,
      payload,
      message: createGateMessage(gate, "롯데ON"),
      errorCode: gate,
    });
    /* 🔴 operation 을 적지 않는다 — 아무것도 하지 않았다. */
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json({ ok: false, result, validation });
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
  /* ══════════════════════════════════════════════════════════════════════
     P0-CHANNEL-03 F-9 — 등록이 «성공했을 때만» 현재 연결을 만든다.
     세 라우트 공통 규약이고 이유도 같다:

     🔴 실패한 시도로 ChannelProduct 를 만들면 다음 CREATE 가 막혀 셀러가
        영영 등록하지 못한다 — 그래서 이 자리(SUBMITTED 경로)에만 있다.
        롯데ON 은 특히 「HTTP 200 ≠ 성공」이라 returnCode 0000 + spdNo 가
        둘 다 확인된 «뒤» 여야 한다. 위 분기가 이미 그것을 보장한다.
     🔴 snapshot 이 아니라 «Product» 에 잇는다 — 재분석으로 새 snapshot 이
        생겨도 연결이 끊어지지 않게.
     🔴 product_id 가 없으면(기존 381건) 잇지 않는다. 예전과 똑같이 attempt
        만 남는다.
     🔴 DB 기록 실패가 등록 결과를 뒤집지 않는다. 상품은 이미 롯데ON 에
        나갔다 — 기록이 안 됐다고 「실패」라고 말하면 그것이 거짓이다. */
  let channelProductId: string | null = null;
  const productId = await findProductIdBySnapshot(snapshotId);
  if (productId) {
    const linked = await linkChannelProduct({
      productId,
      channel: LOTTEON_PLATFORM_KEY,
      externalProductId: spdNo,
    });
    channelProductId = linked?.id ?? null;
  }
  await logRegistrationAttempt(result, response.raw, snapshotId, jobKey, {
    operation: "CREATE",
    channelProductId,
  });

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
