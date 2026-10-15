/**
 * WU-022 공용 KPI 부품 — 🔴 테스트 파일에서 빼낸 이유는 **사본 금지** 다.
 * 022(다리)와 022-4(AI Identity)가 **같은 함수**를 써야 두 보고서의 숫자가 같은 뜻을 갖는다.
 * 🔴 여기에는 판정 «정책» 이 없다. 집계 라벨과 분모 규칙만 있다.
 */
import type { Gt, ThreeWay } from "./mi-identity-benchmark";

/* ── GT 규격 — 🔴 MI 칸이 없다. MI 를 GT 로 복사할 자리를 구조로 없앤다 ───────── */
export interface GtEntry {
  searchId: string;
  candidateUrl: string;
  gt: Gt;
  /** 🔴 비어 있으면 거부한다 — 「근거 없는 GT」를 측정에 넣지 않는다. */
  gtReason: string;
  gtToken?: { mustInclude?: string[]; mustExclude?: string[] };
}
export interface GtValidation {
  entries: GtEntry[];
  rejected: { index: number; reason: string }[];
}

export function validateGtFile(raw: unknown, knownIds: readonly string[]): GtValidation {
  const entries: GtEntry[] = [];
  const rejected: { index: number; reason: string }[] = [];
  if (!Array.isArray(raw)) return { entries, rejected: [{ index: -1, reason: "최상위가 배열이 아니다" }] };
  const seen = new Set<string>();
  raw.forEach((r, index) => {
    const row = r as Partial<GtEntry>;
    if (!row || typeof row !== "object") return void rejected.push({ index, reason: "객체가 아니다" });
    if (typeof row.searchId !== "string" || !knownIds.includes(row.searchId))
      return void rejected.push({ index, reason: `모르는 searchId: ${String(row.searchId)}` });
    if (typeof row.candidateUrl !== "string" || row.candidateUrl.trim() === "")
      return void rejected.push({ index, reason: "candidateUrl 누락" });
    if (row.gt !== "SAME" && row.gt !== "DIFFERENT")
      return void rejected.push({ index, reason: `gt 는 SAME|DIFFERENT 만: ${String(row.gt)}` });
    if (typeof row.gtReason !== "string" || row.gtReason.trim() === "")
      return void rejected.push({ index, reason: "gtReason 이 비었다 — 근거 없는 GT 를 받지 않는다" });
    const key = `${row.searchId}::${row.candidateUrl}`;
    if (seen.has(key)) return void rejected.push({ index, reason: `중복: ${key}` });
    seen.add(key);
    entries.push(row as GtEntry);
  });
  return { entries, rejected };
}

/** 🔴 GT 가 실제 페이지와 어긋나면 **측정 전에** 깨뜨린다(019A §3 장치). */
export function gtTokenMismatch(entry: GtEntry, observedTitle: string | null): string | null {
  if (!entry.gtToken || observedTitle == null) return null;
  const t = observedTitle.toLowerCase();
  for (const m of entry.gtToken.mustInclude ?? []) if (!t.includes(m.toLowerCase())) return `mustInclude 불일치: ${m}`;
  for (const m of entry.gtToken.mustExclude ?? []) if (t.includes(m.toLowerCase())) return `mustExclude 위반: ${m}`;
  return null;
}

/* ── 축 KPI — 🔴 accuracy 분모와 precision 분모가 «다르다» ──────────────────── */
export interface AxisKpi {
  n: number;
  accuracy: number | null;
  /** 🔴 UNCERTAIN 은 분자·분모 둘 다에서 빠진다. */
  precisionSame: number | null;
  falseSame: number;
  missedSame: number;
}

export function axisKpi(rows: { gt: Gt; call: ThreeWay | null }[]): AxisKpi {
  const scored = rows.filter((r) => r.call != null);
  const correct = scored.filter((r) => (r.call === "SAME") === (r.gt === "SAME")).length;
  const saidSame = scored.filter((r) => r.call === "SAME");
  return {
    n: scored.length,
    /* 🔴 분모가 0 이면 **0 이 아니라 null**(= N/A) 이다. */
    accuracy: scored.length ? correct / scored.length : null,
    precisionSame: saidSame.length ? saidSame.filter((r) => r.gt === "SAME").length / saidSame.length : null,
    falseSame: saidSame.filter((r) => r.gt === "DIFFERENT").length,
    missedSame: scored.filter((r) => r.call !== "SAME" && r.gt === "SAME").length,
  };
}

export interface Quadrant {
  aiSame_miSame: number;
  aiSame_miDiff: number;
  aiDiff_miSame: number;
  aiDiff_miDiff: number;
  agreement: number | null;
  aiOnlyCorrect: number;
  miOnlyCorrect: number;
  bothCorrect: number;
  bothWrong: number;
}

export function quadrantOf(rows: { gt: Gt; ai: ThreeWay | null; mi: ThreeWay | null }[]): Quadrant {
  const both = rows.filter((r) => r.ai != null && r.mi != null);
  const q: Quadrant = {
    aiSame_miSame: 0, aiSame_miDiff: 0, aiDiff_miSame: 0, aiDiff_miDiff: 0,
    agreement: both.length ? both.filter((r) => r.ai === r.mi).length / both.length : null,
    aiOnlyCorrect: 0, miOnlyCorrect: 0, bothCorrect: 0, bothWrong: 0,
  };
  for (const r of both) {
    const a = r.ai === "SAME", m = r.mi === "SAME";
    if (a && m) q.aiSame_miSame++; else if (a && !m) q.aiSame_miDiff++;
    else if (!a && m) q.aiDiff_miSame++; else q.aiDiff_miDiff++;
    const aOk = a === (r.gt === "SAME"), mOk = m === (r.gt === "SAME");
    if (aOk && mOk) q.bothCorrect++; else if (aOk) q.aiOnlyCorrect++;
    else if (mOk) q.miOnlyCorrect++; else q.bothWrong++;
  }
  return q;
}

/* ══ WU-022-4 전용 ═══════════════════════════════════════════════════════════ */

/** 🔴 세 단어가 아니면 **정규화하지 않는다** — 지시서 §1. */
export const AI_VERDICT_INVALID = "AI_VERDICT_INVALID" as const;
export type AiVerdictCell = ThreeWay | typeof AI_VERDICT_INVALID;

/**
 * 🔴🔴 「SAME (0.95)」·「동일상품입니다」·「판정: 동일상품」을 **읽어내지 않는다.**
 * 공백만 다듬고, 정확히 세 단어 중 하나가 아니면 INVALID 다.
 */
export function readAiVerdict(raw: unknown): AiVerdictCell {
  if (typeof raw !== "string") return AI_VERDICT_INVALID;
  const v = raw.trim();
  return v === "SAME" || v === "DIFFERENT" || v === "UNCERTAIN" ? (v as ThreeWay) : AI_VERDICT_INVALID;
}

export interface AiEntry { searchId: string; candidateUrl: string; model: string; verdict: AiVerdictCell }
export interface AiFileValidation {
  entries: AiEntry[];
  invalid: { index: number; model: string; raw: string }[];
  rejected: { index: number; reason: string }[];
  models: string[];
}

export function validateAiFile(raw: unknown, knownKeys: ReadonlySet<string>): AiFileValidation {
  const entries: AiEntry[] = [];
  const invalid: { index: number; model: string; raw: string }[] = [];
  const rejected: { index: number; reason: string }[] = [];
  if (!Array.isArray(raw)) return { entries, invalid, rejected: [{ index: -1, reason: "최상위가 배열이 아니다" }], models: [] };
  const seen = new Set<string>();
  raw.forEach((r, index) => {
    const row = (r ?? {}) as Record<string, unknown>;
    const model = typeof row.model === "string" && row.model.trim() ? row.model.trim() : "UNSPECIFIED";
    const key = `${String(row.searchId)}::${String(row.candidateUrl)}`;
    if (!knownKeys.has(key)) return void rejected.push({ index, reason: `모르는 후보: ${key}` });
    const dedupe = `${model}::${key}`;
    if (seen.has(dedupe)) return void rejected.push({ index, reason: `중복: ${dedupe}` });
    seen.add(dedupe);
    const verdict = readAiVerdict(row.verdict);
    /* 🔴 INVALID 를 «버리지 않는다» — 기록한다. 버리면 분모가 조용히 줄어든다. */
    if (verdict === AI_VERDICT_INVALID) invalid.push({ index, model, raw: String(row.verdict).slice(0, 80) });
    entries.push({ searchId: String(row.searchId), candidateUrl: String(row.candidateUrl), model, verdict });
  });
  return { entries, invalid, rejected, models: [...new Set(entries.map((e) => e.model))].sort() };
}

/** SAME / DIFFERENT / UNCERTAIN / INVALID 분포. 🔴 합계가 분모다. */
export function verdictDistribution(cells: readonly AiVerdictCell[]): Record<string, number> {
  const out: Record<string, number> = { SAME: 0, DIFFERENT: 0, UNCERTAIN: 0, [AI_VERDICT_INVALID]: 0 };
  for (const c of cells) out[c] = (out[c] ?? 0) + 1;
  return out;
}

/** AI × MI 3×3 — 🔴 2×2 로 접으면 UNCERTAIN 이 숨는다. */
export function crossMatrix(rows: { ai: ThreeWay; mi: ThreeWay }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = `AI_${r.ai}__MI_${r.mi}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * 🔴 **평가용 가상 조합이다. 운영 정책이 아니다.**
 * 둘 다 SAME → SAME · 둘 다 DIFFERENT → DIFFERENT · 그 외 → UNCERTAIN.
 */
export function combine(ai: ThreeWay, mi: ThreeWay): ThreeWay {
  if (ai === "SAME" && mi === "SAME") return "SAME";
  if (ai === "DIFFERENT" && mi === "DIFFERENT") return "DIFFERENT";
  return "UNCERTAIN";
}
