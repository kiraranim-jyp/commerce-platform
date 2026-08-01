import { NextResponse } from "next/server";
import {
  deleteSellerProfile,
  setDefaultSellerProfile,
  updateSellerProfile,
  type SellerProfileInput,
} from "../../../../coupang/_lib/seller-profile";

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
  const result = await updateSellerProfile(id, fields);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteSellerProfile(id);
  return NextResponse.json(result);
}
