import { NextResponse } from "next/server";
import {
  deleteSellerProfile,
  setDefaultSellerProfile,
  updateSellerProfile,
  type SellerProfileInput,
} from "../../../../coupang/_lib/seller-profile";
import { pickSellerSettingFields, saveSellerSettingsDual } from "@/lib/seller-settings";

/** Sprint A-8(작업2/4) — isDefault:true는 기존처럼 "기본으로 설정" 전용 경로로
 * 두고, 그 외 필드가 하나라도 오면 updateSellerProfile로 보낸다(출고지/반품지
 * 수정 모달이 이 분기를 쓴다). 두 요청을 같은 body 모양(Partial)으로 받되
 * isDefault는 별도 원자적 연산(다른 프로필의 is_default를 같이 내려야 함)이라
 * 분리해서 처리한다. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | (Partial<SellerProfileInput> & { isDefault?: boolean })
    | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.isDefault) {
    const result = await setDefaultSellerProfile(id);
    return NextResponse.json(result);
  }
  const { isDefault: _isDefault, ...fields } = body;

  /* ══ TTAEJYO-PIVOT-03 ⑤(CEO 승인, 2026-09-22) ══════════════════════════

     059 로 판매자 공통 설정을 seller_settings 로 옮겼고 reader 는 그쪽만 본다.
     그런데 이 writer 는 아직 coupang_seller_profiles 에만 썼다 — 셀러가 저장하면
     성공했다고 보이는데 등록에는 «안 나간다»(silent divergence). 그 틈을 닫는다.

     🔴 body 를 «건드리지 않는다». 다섯 칸을 빼서 보내면 기존 PATCH 의 partial
     update semantics 가 달라진다(toRowFields 는 「키가 왔는가」로 판정한다).
     그래서 아래 updateSellerProfile 호출은 지금까지와 «완전히 같은 fields» 를
     받는다 — 배송·가격·상세페이지 동작이 한 글자도 바뀌지 않는다.

     RPC 가 같은 다섯 칸을 한 번 더 쓰는 것은 같은 값이라 무해하다(멱등).
     얻는 것은 원자성이다 — coupang_seller_profiles.5칸 ↔ seller_settings.5칸 이
     한 트랜잭션 안에서 «함께» 성공하거나 «함께» 실패한다(060).

     🔴 RPC 를 «먼저» 부른다. 실패하면 여기서 끝내고 기존 저장도 하지 않는다 —
     두 표가 갈라지는 것보다 아무것도 저장되지 않는 편이 낫다.

     temporary dual-write · legacy write removal = Phase ⑨ */
  const sellerFields = pickSellerSettingFields(fields as Record<string, unknown>);
  if (Object.keys(sellerFields).length > 0) {
    const dual = await saveSellerSettingsDual(id, sellerFields);
    if (!dual.ok) {
      return NextResponse.json({ ok: false, error: dual.error }, { status: 500 });
    }
  }

  const result = await updateSellerProfile(id, fields);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteSellerProfile(id);
  return NextResponse.json(result);
}
