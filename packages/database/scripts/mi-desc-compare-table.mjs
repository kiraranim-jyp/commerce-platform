/**
 * 🔵 DESC-COMPARE ② — 쌍별 비교표(Markdown) 생성. 🔴 계산 0 · 읽기 전용 · 운영 변경 0.
 *    입력 `%TEMP%/mi-url-evidence/desc-compare.json` → 산출 `docs/MI-DESC-COMPARE-PAIRS.md`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const d = JSON.parse(readFileSync(path.join(os.tmpdir(), "mi-url-evidence", "desc-compare.json"), "utf8"));
const S = { MATCH: "🟢", MISMATCH: "🔴", UNKNOWN: "·", NOT_APPLICABLE: "—" };
const AX = ["BRAND", "MODEL_CODE", "PRODUCT_NAME", "FORM_DESIGN", "COLOR", "MATERIAL", "AUDIENCE_AGE", "SIZE_FIT", "SET_OPTION", "IMAGE"];
const HEAD = ["브랜드", "품번", "상품명", "형태", "색상", "소재", "대상", "사이즈", "구성", "이미지"];
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const cut = (s, n) => { const x = esc(s); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };

const rows = d.pairs.slice().sort((a, b) =>
  String(a.originCode).localeCompare(String(b.originCode)) || String(a.candidateDomain).localeCompare(String(b.candidateDomain)));

let m = `# 상품 쌍별 상세설명 비교표 — 전수 ${d.pairs.length} 쌍\n\n`;
m += "> 🔴 **운영 변경 0 · DB 쓰기 0 · 외부 URL 재방문 0.** `shadow` 는 **운영 판정이 아니다**.\n";
m += "> 축별 판단 사유 · 원문 발췌 · 출처(TITLE/DESCRIPTION/URL/STRUCTURED_DATA)는\n";
m += "> `%TEMP%/mi-url-evidence/desc-compare.json` · `desc-compare.csv` 에 **전건** 들어 있다.\n\n";
m += `축 기호 — 🟢 MATCH · 🔴 MISMATCH · \`·\` UNKNOWN · \`—\` NOT_APPLICABLE · \`∅\` 비교 불가(설명문 미확보)\n\n`;
m += `| # | 원상품 품번 | 원상품 | 후보 판매처 | 후보 상품명 | 최초 판정 | 최초 blocker | ${HEAD.join(" | ")} | shadow | 변화 | human GT |\n`;
m += `|--:|---|---|---|---|---|---|${AX.map(() => ":-:").join("|")}|---|---|---|\n`;
for (const [i, r] of rows.entries()) {
  const comparable = r.hasOriginDescription && r.hasCandidateDescription;
  const ax = AX.map((k) => (comparable ? (S[r.axes[k]?.status] ?? "?") : "∅"));
  m += `| ${i + 1} | ${r.originCode || "—"} | ${cut(r.originTitle || "(제목 없음)", 32)} | ${esc(r.candidateDomain)} | `
    + `${cut(r.candidateTitle || "(제목 없음)", 38)} | ${r.baselineSystemVerdict || "—"} | `
    + `${cut((r.baselineBlockers ?? []).join(" "), 32) || "—"} | ${ax.join(" | ")} | `
    + `${String(r.shadowLabel).replace("SHADOW_", "")} | ${r.change} | ${r.humanGt || "—"} |\n`;
}
m += `\n🔴 **\`∅\` 는 설명문이 확보되지 않아 비교하지 못한 쌍이다** — 원상품 스냅샷 없음 ${d.pairs.filter((r) => !r.hasOriginDescription).length} ·`;
m += ` 후보 설명문 없음 ${d.pairs.filter((r) => !r.hasCandidateDescription).length} ⟹ 비교가능 **${d.denominators.comparablePairs}**.\n`;
m += `\n🔴 \`변화\` 어휘 — \`IMPROVABLE\` 개선 가능 · \`MAINTAINED\` 판단 유지 · \`UNDECIDABLE\` 판단 불가 ·`;
m += ` \`FIRST_JUDGMENT_ERROR\` 최초 판단 오류(**이 표본에서 0건**).\n`;
writeFileSync(path.join(process.cwd(), "..", "..", "docs", "MI-DESC-COMPARE-PAIRS.md"), m, "utf8");
console.log(`🟢 docs/MI-DESC-COMPARE-PAIRS.md — ${rows.length} 행 · ${(m.length / 1024).toFixed(1)}KB`);
