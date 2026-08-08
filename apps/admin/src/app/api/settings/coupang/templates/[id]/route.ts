import { NextResponse } from "next/server";
import {
  deleteDescriptionTemplate,
  setDefaultDescriptionTemplate,
  updateDescriptionTemplate,
  type DescriptionTemplateInput,
} from "../../../../coupang/_lib/description-template";

/** Sprint 0(CEO 지시, 2026-08-07) — "설정된 거 수정할 수 있어야 하는데 없어."
 * 기존엔 {isDefault:true}만 지원했다 — 이제 {name, shippingBlocks, ...} 같은
 * 일반 필드 업데이트도 같은 핸들러에서 처리한다(isDefault만 있으면 그쪽으로,
 * name/blocks가 있으면 updateDescriptionTemplate로). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | ({ isDefault?: boolean } & Partial<DescriptionTemplateInput>)
    | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 필요합니다." }, { status: 400 });
  }
  if (body.isDefault) {
    const result = await setDefaultDescriptionTemplate(id);
    return NextResponse.json(result);
  }
  if (!body.name) {
    return NextResponse.json({ ok: false, error: "템플릿 이름이 필요합니다." }, { status: 400 });
  }
  const result = await updateDescriptionTemplate(id, body as DescriptionTemplateInput);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteDescriptionTemplate(id);
  return NextResponse.json(result);
}
