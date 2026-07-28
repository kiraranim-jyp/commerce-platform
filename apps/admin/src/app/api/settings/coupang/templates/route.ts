import { NextResponse } from "next/server";
import {
  createDescriptionTemplate,
  listDescriptionTemplates,
  type DescriptionTemplateInput,
} from "../../../coupang/_lib/description-template";

export async function GET() {
  const templates = await listDescriptionTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DescriptionTemplateInput | null;
  if (!body?.name) {
    return NextResponse.json({ ok: false, error: "템플릿 이름이 필요합니다." }, { status: 400 });
  }
  const result = await createDescriptionTemplate(body);
  return NextResponse.json(result);
}
