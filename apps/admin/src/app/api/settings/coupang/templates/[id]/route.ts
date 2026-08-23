import { findPlaceholderFields } from "@commerce/listing";
import { NextResponse } from "next/server";
import {
  deleteDescriptionTemplate,
  listDescriptionTemplates,
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
    // N-4.08 후속(CPO 지시, 2026-08-21) — "메세지 1" placeholder 템플릿이
    // isDefault=true로 잘못 지정되어 고객 상세페이지에 그대로 노출된 사고의
    // 재발 방지. 차단하지 않고 경고만 실어 보낸다 — 지정 자체는 그대로 진행
    // (판매자가 알고도 지정하려는 경우를 막지 않는다).
    const existing = await listDescriptionTemplates();
    const target = existing.find((t) => t.id === id);
    const placeholderFields = target ? findPlaceholderFields(target) : [];
    const result = await setDefaultDescriptionTemplate(id);
    if (!result.ok) return NextResponse.json(result);
    return NextResponse.json({
      ...result,
      placeholderWarning:
        placeholderFields.length > 0
          ? `이 템플릿의 ${placeholderFields.join(", ")} 항목에 아직 실제 문구로 채우지 않은 것으로 보이는 내용이 있습니다. 실제 등록 전에 확인해주세요.`
          : null,
    });
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
