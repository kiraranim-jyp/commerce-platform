import { NextResponse } from "next/server";
import type { CanonicalProduct } from "@commerce/shared";
import { buildLotteOnPayload, validateLotteOnPayload } from "@commerce/listing";
import { buildLotteOnContext, type LotteOnChannelFormInput } from "../_lib/build-context";

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

  return NextResponse.json({
    ok: true,
    /** 거래처 조회가 실패했으면 payload의 trGrpCd/trNo가 비어 있다 —
     * validation이 IDENTITY_REQUIRED로 이미 막지만 원인도 같이 내려준다. */
    identityError: context.identityError,
    payload,
    validation,
  });
}
