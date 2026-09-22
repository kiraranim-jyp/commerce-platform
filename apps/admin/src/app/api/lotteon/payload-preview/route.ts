import { NextResponse } from "next/server";
import type { CanonicalProduct } from "@commerce/shared";
import { buildLotteOnPayload, validateLotteOnPayload } from "@commerce/listing";
import { buildLotteOnContext, type LotteOnChannelFormInput } from "../_lib/build-context";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead } from "../_lib/request";
import { recordAuditLog } from "@/lib/audit-log";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — Payload Preview(읽기 전용, 부작용 0).
 *
 * 쿠팡 /api/coupang/payload-preview 와 같은 자리다. register/route.ts와
 * **완전히 같은 조립·검증**(buildLotteOnContext → buildLotteOnPayload →
 * validateLotteOnPayload)을 쓰고, 다른 점은 딱 하나 — 롯데ON에 실제로
 * POST하지 않고 registration_attempts도 기록하지 않는다는 것뿐이다.
 *
 * 이 라우트는 상품등록(87) 경로를 **호출하지 않는다.** 207 Identity 한 번만
 * 조회한다(거래처번호가 payload 필수값이라서).
 */
/* ══ LOTTEON-REG-01 계측(읽기 전용 · 한시) ══════════════════════════════════

   왜 여기로 옮겼나. 계측이 category-recommend 에만 있었는데, 그 라우트는
   **이미 카테고리를 고른 상품에서는 돌지 않는다**(LotteOnRegistrationPanel 의
   hadCategoryOnMountRef — 셀러의 결정을 덮지 않으려는 기존 규칙). 그래서 CEO 가
   [다시 확인] 을 눌러야만 찍혔고, 두 번 놓쳤다.

   payload-preview 는 탭에 들어올 때마다 자동으로 돈다. 그리고 여기서는 추천
   1위가 아니라 **셀러가 실제로 고른 표준카테고리** 를 묻게 된다 — 증거가 더
   정확하다.

   🔴 한 번만 돈다. 모듈 수준 플래그라 람다 인스턴스마다 최대 1회이고, 이미
   기록이 있으면 아래 판정이 끝난 뒤 이 블록 전체를 제거한다. 실패해도
   조용히 넘어간다 — 진단이 등록 미리보기를 막지 않는다. */
let noticeItemProbeDone = false;

async function probeNoticeItemCode(
  standardCategoryNo: string | null | undefined,
  /**
   * 🔴 연결이 «살아 있을 때만» 묻는다.
   *
   * 1차 시도 실측(2026-09-22 13:42): 단건 조회가 20,201ms timeout 이었는데,
   * 같은 창에서 207 identity 도 20,283ms timeout 이었다. 즉 filter_1 이 문제가
   * 아니라 **롯데ON 연결이 그 시점에 끊겨 있었다**(한 시간 전에는 205 목록
   * 6131건이 성공했다 — 간헐적이다). 실험이 성립하지 않았다.
   *
   * 연결이 죽은 동안 계속 찔러 봐야 답을 얻지 못하고, 미리보기에 20초를 더
   * 얹기만 한다. identity 가 이미 실패했으면 «건너뛴다».
   */
  connectionHealthy: boolean,
): Promise<void> {
  if (noticeItemProbeDone) return;
  const stdCatId = standardCategoryNo?.trim();
  if (!stdCatId) return;
  // 🔴 연결이 죽었으면 done 으로 «표시하지 않는다» — 살아나면 다음 미리보기에서
  //    다시 묻는다. 예전에는 실패해도 플래그를 세워서, 한 번 실패하면 그 람다가
  //    죽을 때까지 두 번 다시 시도하지 않았다.
  if (!connectionHealthy) return;
  noticeItemProbeDone = true;
  try {
    const probe = await runLotteOnRead({
      host: "onpick",
      method: "GET",
      path: LOTTEON_READ_PATHS.onpickCheetah,
      query: { job: "cheetahStandardCategory", filter_1: stdCatId, skip: "0", limit: "1" },
      envelope: "RAW",
      step: `205 표준카테고리 단건 조회(품목코드 확인 · ${stdCatId})`,
    });
    const base = { step: "205_SINGLE", stdCatId, from: "payload-preview" };
    let payload: Record<string, unknown>;
    if (!probe.ok) {
      payload = { ...base, ok: false };
    } else {
      const raw = probe.result.raw as { itemList?: unknown } | null;
      const list = Array.isArray(raw?.itemList) ? (raw.itemList as Record<string, unknown>[]) : [];
      const row = (list[0]?.data ?? list[0] ?? null) as Record<string, unknown> | null;
      const itms = row ? ((row["pd_itms_list"] ?? row["pd_Itms_list"]) as unknown) : undefined;
      /* 3차 계측(2026-09-22) — 단건 조회까지 pd_itms_list 가 비어 있음을 확인했다
         (itmsLength 0 · returnedRows 1 · 연결 정상). 그런데 같은 응답에 우리가
         «한 번도 읽지 않은» 배열이 하나 더 있다 — `attr_list` 다. disp_list(전시
         카테고리) · pd_itms_list(품목) 옆에 나란히 있는 세 번째 목록이라, 고시
         품목이 거기 실려 있을 수 있다.

         🔴 새 API 도 새 파라미터도 아니다. 이미 받아 온 응답을 «한 겹 더 볼»
         뿐이고, 여전히 값이 아니라 구조(길이·키 이름)만 남긴다. */
      const attrs = row ? (row["attr_list"] as unknown) : undefined;
      payload = {
        ...base,
        ok: true,
        returnedRows: list.length,
        rowKeys: row ? Object.keys(row) : null,
        itmsIsArray: Array.isArray(itms),
        itmsLength: Array.isArray(itms) ? itms.length : null,
        // 🔴 값이 아니라 «키 이름» 만 본다.
        itmsFirstKeys:
          Array.isArray(itms) && itms[0] && typeof itms[0] === "object" ? Object.keys(itms[0] as object) : null,
        attrsIsArray: Array.isArray(attrs),
        attrsLength: Array.isArray(attrs) ? attrs.length : null,
        attrsFirstKeys:
          Array.isArray(attrs) && attrs[0] && typeof attrs[0] === "object" ? Object.keys(attrs[0] as object) : null,
      };
    }
    /* ══ 89 공통코드에 품목코드 «목록» 이 있는가 (CEO 승인, 2026-09-22) ══

       205 는 끝났다 — 목록·단건 모두 pd_itms_list 가 비어 있고, attr_list 는
       상품 «속성»(attr_id/attr_pi_type)이라 고시 «품목» 과 무관하다.

       남은 길은 89 getDetailCodeList 다. 이미 동작 중인 경로이고(DV_CO_CD 택배사 ·
       DV_RGSPR_GRP_CD 배송가능지역) 호출 모양도 그대로다 — grpCd 하나만 다르다.

       🔴 코드그룹 이름이 payload 필드명과 같다는 «규칙» 만으로 존재를 단정하지
       않는다(CEO 명시). 지금까지 실제로 확인된 것은 DV_CO_CD 와 DV_RGSPR_GRP_CD
       둘뿐이다. 그래서 «확정» 이 아니라 «질문» 으로 던지고, 응답이 답하게 둔다.

           목록 있음   → 셀러가 「어린이제품」을 고른다. 번호를 외우지 않는다.
           목록 0건    → DIRECT 확정
           호출 실패   → 🔴 DIRECT 가 아니라 UNRESOLVED
                         (「직접 입력해야 한다」와 「다른 공급원이 있다」를
                          아직 구분하지 못한 상태다) */
    const codeProbe = await runLotteOnRead({
      // host 를 주지 않으면 기본 호스트(openapi.lotteon.com)다 — 89 는 onpick 이
      // 아니라 그쪽이고, delivery-settings 가 이미 같은 방식으로 부른다.
      method: "GET",
      path: LOTTEON_READ_PATHS.detailCodeList,
      query: { grpCd: "PD_ITMS_CD" },
      step: "89 공통코드 상세 조회(PD_ITMS_CD 존재 확인)",
    });
    if (!codeProbe.ok) {
      payload.pdItmsCodeGroup = { ok: false, verdict: "UNRESOLVED" };
    } else {
      const data = codeProbe.result.data as unknown;
      const rows = Array.isArray(data) ? data : [];
      payload.pdItmsCodeGroup = {
        ok: true,
        rowCount: rows.length,
        // 🔴 값이 아니라 «구조» 만. 목록이 실재하는지, 어떤 필드로 오는지.
        firstKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0] as object) : null,
        verdict: rows.length > 0 ? "AVAILABLE" : "EMPTY",
      };
    }

    console.log(`[LOTTEON-REG-01] ${JSON.stringify(payload)}`);
    await recordAuditLog({
      eventType: "LOTTEON_REG_01_PROBE",
      actor: "system",
      marketplace: "lotteon",
      field: "pdItmsCd",
      afterValue: payload,
      reason: "205 표준카테고리 단건 조회에 품목코드가 들어 있는가(읽기 전용 진단)",
    });
  } catch {
    // 진단 실패가 미리보기를 막지 않는다.
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    product?: CanonicalProduct;
    channel?: LotteOnChannelFormInput;
    liveRates?: Record<string, number>;
    roundingUnit?: number;
  } | null;

  if (!body?.product) {
    return NextResponse.json({ ok: false, reason: "INVALID_REQUEST", message: "product가 필요합니다." }, { status: 400 });
  }

  const context = await buildLotteOnContext(body.product, body.channel ?? {}, {
    liveRates: body.liveRates,
    roundingUnit: body.roundingUnit,
  });

  const validation = validateLotteOnPayload(context.input);
  const payload = buildLotteOnPayload(context.input);

  // identityError 가 없다 = 이 요청에서 롯데ON 연결이 «실제로» 살아 있었다.
  await probeNoticeItemCode(context.input.channel.standardCategoryNo, context.identityError == null);

  return NextResponse.json({
    ok: true,
    /** 거래처 조회가 실패했으면 payload의 trGrpCd/trNo가 비어 있다 —
     * validation이 IDENTITY_REQUIRED로 이미 막지만 원인도 같이 내려준다. */
    identityError: context.identityError,
    payload,
    validation,
  });
}
