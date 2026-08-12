import { NextResponse } from "next/server";
import {
  deleteCommerceAccount,
  setDefaultCommerceAccount,
  updateCommerceAccount,
  type CommerceAccountInput,
  type CommerceAccountPlatform,
} from "../_lib/commerce-account";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | (Partial<CommerceAccountInput> & { isDefault?: boolean; platform?: CommerceAccountPlatform })
    | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.isDefault) {
    if (!body.platform) {
      return NextResponse.json({ ok: false, error: "platform이 필요합니다." }, { status: 400 });
    }
    const result = await setDefaultCommerceAccount(id, body.platform);
    return NextResponse.json(result);
  }
  const { isDefault: _isDefault, ...fields } = body;
  const result = await updateCommerceAccount(id, fields);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteCommerceAccount(id);
  return NextResponse.json(result);
}
