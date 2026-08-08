import { mergeCoupangDescription, type TemplateSectionBlock } from "@commerce/listing";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * 상세설명 템플릿 — 배송안내/교환/반품/구매대행/A·S처럼 상품마다 바뀌지 않는
 * 고정 문구를 한 번만 만들어두고 재사용한다. AI는 상품소개/상품특징만 담당하고,
 * 최종 상세설명은 mergeDescription()이 "AI 생성분 + 템플릿"을 합쳐서 만든다.
 *
 * Sprint 0(CEO 지시, 2026-08-07) — 각 섹션이 문자열 하나가 아니라 텍스트/이미지
 * 블록 배열(`xxxBlocks`)일 수 있게 확장했다. `xxxInfo`(문자열)는 계속 함께
 * 채운다 — mergeCoupangDescription()(detailBlocks 없이 호출되는 레거시 경로)의
 * 안전망이자, blocks가 텍스트만으로 이뤄졌을 때의 사람이 읽는 미러다.
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
  shippingBlocks: TemplateSectionBlock[];
  exchangeBlocks: TemplateSectionBlock[];
  returnBlocks: TemplateSectionBlock[];
  agentBuyBlocks: TemplateSectionBlock[];
  asBlocks: TemplateSectionBlock[];
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
  shipping_blocks: TemplateSectionBlock[] | null;
  exchange_blocks: TemplateSectionBlock[] | null;
  return_blocks: TemplateSectionBlock[] | null;
  agent_buy_blocks: TemplateSectionBlock[] | null;
  as_blocks: TemplateSectionBlock[] | null;
}

/** 텍스트 블록만 이어붙여 사람이 읽는 문자열로 만든다(이미지 블록은 무시) —
 * `xxxInfo` 미러 컬럼에 쓰는 값과 mergeCoupangDescription 레거시 경로가
 * 기대하는 값이 이 함수 하나로 통일된다. */
function flattenTextBlocks(blocks: TemplateSectionBlock[] | null | undefined): string {
  if (!blocks || blocks.length === 0) return "";
  return blocks
    .filter((b): b is Extract<TemplateSectionBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** 레거시 행(blocks 컬럼이 비어있고 문자열만 있는 경우) 자동 승격 — 별도
 * 데이터 마이그레이션 스크립트 없이 읽는 시점에 블록 1개로 합성한다. */
function blocksOrLegacyPromote(
  blocks: TemplateSectionBlock[] | null,
  legacyText: string | null,
): TemplateSectionBlock[] {
  if (blocks && blocks.length > 0) return blocks;
  const trimmed = (legacyText ?? "").trim();
  return trimmed ? [{ id: "legacy", type: "text", content: trimmed }] : [];
}

function toTemplate(row: DescriptionTemplateRow): DescriptionTemplate {
  const shippingBlocks = blocksOrLegacyPromote(row.shipping_blocks, row.shipping_info);
  const exchangeBlocks = blocksOrLegacyPromote(row.exchange_blocks, row.exchange_info);
  const returnBlocks = blocksOrLegacyPromote(row.return_blocks, row.return_info);
  const agentBuyBlocks = blocksOrLegacyPromote(row.agent_buy_blocks, row.agent_buy_info);
  const asBlocks = blocksOrLegacyPromote(row.as_blocks, row.as_info);
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    // 텍스트 블록만 이어붙인 미러 — blocks가 텍스트 하나뿐이든(레거시 승격)
    // 여러 개든 항상 이 하나의 함수로 만든다(두 경로가 서로 다른 문자열을
    // 만들면 mergeCoupangDescription 결과가 화면과 어긋난다).
    shippingInfo: flattenTextBlocks(shippingBlocks),
    exchangeInfo: flattenTextBlocks(exchangeBlocks),
    returnInfo: flattenTextBlocks(returnBlocks),
    agentBuyInfo: flattenTextBlocks(agentBuyBlocks),
    asInfo: flattenTextBlocks(asBlocks),
    shippingBlocks,
    exchangeBlocks,
    returnBlocks,
    agentBuyBlocks,
    asBlocks,
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
  shippingBlocks?: TemplateSectionBlock[];
  exchangeBlocks?: TemplateSectionBlock[];
  returnBlocks?: TemplateSectionBlock[];
  agentBuyBlocks?: TemplateSectionBlock[];
  asBlocks?: TemplateSectionBlock[];
}

function toRowFields(input: DescriptionTemplateInput) {
  return {
    shipping_blocks: input.shippingBlocks ?? [],
    exchange_blocks: input.exchangeBlocks ?? [],
    return_blocks: input.returnBlocks ?? [],
    agent_buy_blocks: input.agentBuyBlocks ?? [],
    as_blocks: input.asBlocks ?? [],
    shipping_info: flattenTextBlocks(input.shippingBlocks) || null,
    exchange_info: flattenTextBlocks(input.exchangeBlocks) || null,
    return_info: flattenTextBlocks(input.returnBlocks) || null,
    agent_buy_info: flattenTextBlocks(input.agentBuyBlocks) || null,
    as_info: flattenTextBlocks(input.asBlocks) || null,
  };
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
      ...toRowFields(input),
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, template: toTemplate(data as DescriptionTemplateRow) };
}

/** Sprint 0(CEO 지시, 2026-08-07) — CEO가 실제 화면에서 발견한 버그: "설정된
 * 거 수정할 수 있어야 하는데 없어." 지금까지 이 함수 자체가 없어서 PATCH가
 * isDefault 전환만 지원했다. */
export async function updateDescriptionTemplate(
  id: string,
  input: DescriptionTemplateInput,
): Promise<{ ok: true; template: DescriptionTemplate } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data, error } = await supabase
    .from("coupang_description_templates")
    .update({
      name: input.name,
      ...toRowFields(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
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
