import { NextResponse } from "next/server";
import {
  createCommerceAccount,
  listCommerceAccounts,
  type CommerceAccountInput,
} from "./_lib/commerce-account";

export async function GET() {
  const accounts = await listCommerceAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CommerceAccountInput | null;
  if (!body?.platform || !body?.label) {
    return NextResponse.json({ ok: false, error: "플랫폼과 계정 이름이 필요합니다." }, { status: 400 });
  }
  const result = await createCommerceAccount(body);
  return NextResponse.json(result);
}
