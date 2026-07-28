import { mergeCoupangDescription } from "@commerce/listing";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * 상세설명 템플릿 — 배송안내/교환/반품/구매대행/A·S처럼 상품마다 바뀌지 않는
 * 고정 문구를 한 번만 만들어두고 재사용한다. AI는 상품소개/상품특징만 담당하고,
 * 최종 상세설명은 mergeDescription()이 "AI 생성분 + 템플릿"을 합쳐서 만든다.
 */
export interface DescriptionTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  shippingInfo: string;
  exchangeInfo: string;
  returnInfo: string;
  agentBuyInfo: string;
  asInfo: string;
}

interface DescriptionTemplateRow {
  id: string;
  name: string;
  is_default: boolean;
  shipping_info: string | null;
  exchange_info: string | null;
  return_info: string | null;
  agent_buy_info: string | null;
  as_info: string | null;
}

function toTemplate(row: DescriptionTemplateRow): DescriptionTemplate {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    shippingInfo: row.shipping_info ?? "",
    exchangeInfo: row.exchange_info ?? "",
    returnInfo: row.return_info ?? "",
    agentBuyInfo: row.agent_buy_info ?? "",
    asInfo: row.as_info ?? "",
  };
}

export async function listDescriptionTemplates(): Promise<DescriptionTemplate[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("coupang_description_templates")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[description-template] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as DescriptionTemplateRow[]).map(toTemplate);
}

export interface DescriptionTemplateInput {
  name: string;
  shippingInfo?: string;
  exchangeInfo?: string;
  returnInfo?: string;
  agentBuyInfo?: string;
  asInfo?: string;
}

export async function createDescriptionTemplate(
  input: DescriptionTemplateInput,
): Promise<{ ok: true; template: DescriptionTemplate } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const existing = await listDescriptionTemplates();
  const { data, error } = await supabase
    .from("coupang_description_templates")
    .insert({
      name: input.name,
      is_default: existing.length === 0,
      shipping_info: input.shippingInfo ?? null,
      exchange_info: input.exchangeInfo ?? null,
      return_info: input.returnInfo ?? null,
      agent_buy_info: input.agentBuyInfo ?? null,
      as_info: input.asInfo ?? null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, template: toTemplate(data as DescriptionTemplateRow) };
}

export async function setDefaultDescriptionTemplate(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { error: clearError } = await supabase
    .from("coupang_description_templates")
    .update({ is_default: false })
    .neq("id", id);
  if (clearError) return { ok: false, error: clearError.message };

  const { error } = await supabase
    .from("coupang_description_templates")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteDescriptionTemplate(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase.from("coupang_description_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getDefaultDescriptionTemplate(): Promise<DescriptionTemplate | null> {
  const templates = await listDescriptionTemplates();
  if (templates.length === 0) return null;
  return templates.find((t) => t.isDefault) ?? templates[0];
}

/** 실제 병합 로직은 packages/listing(순수 함수, register 라우트가 buildCoupangPayload에
 * 넘길 때도 재사용)에 있다 — 여기서는 Supabase에서 읽어온 DescriptionTemplate 모양을
 * 그 함수가 기대하는 모양으로 넘겨주기만 한다. */
export function mergeDescription(aiDescription: string, template: DescriptionTemplate | null): string {
  return mergeCoupangDescription(aiDescription, template);
}
