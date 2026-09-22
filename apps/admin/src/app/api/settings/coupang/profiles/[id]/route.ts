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

  /* ══ TTAEJYO-PIVOT-03 D(CEO 승인, 2026-09-23) ══════════════════════════

     여기 있던 dual-write 호출이 사라졌다. 이 라우트는 이제 «배송 프로필» 만
     다룬다 — 판매자 공통 다섯 칸(제조사·A/S·품질보증·KC문구·원산지 기본)은
     PUT /api/settings/seller-settings 가 seller_settings 에 직접 쓴다.

     ⑤ 에서 RPC 를 넣었던 이유는 그때 두 표에 «함께» 써야 했기 때문이다.
     이제 쓸 곳이 하나라서 묶을 것이 없다.

     🔴 D-2 로 SellerProfileInput 에서도 다섯 칸을 뺐다. 그래서 fields 에
     그 칸들이 들어올 «수» 가 없다 — 「UI 가 안 보내서 우연히 안 써진다」가
     아니라 「계약이 받지 않는다」가 됐다.

     남은 것: 060 함수는 DB 에 아직 있다(DROP 은 별도 migration). R6 호환층도
     그대로다 — 둘 다 E 실측 뒤에 판단한다. */
  const result = await updateSellerProfile(id, fields);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteSellerProfile(id);
  return NextResponse.json(result);
}
