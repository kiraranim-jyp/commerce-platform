/**
 * P0-A.35 ④(CEO 지시, 2026-09-20) — **브랜드 표준화 계층.**
 *
 * ── 왜 별도 계층인가 ────────────────────────────────────────────────────────
 * 지금까지 브랜드는 Shopify `vendor` 칸을 «그대로» 쓰고, 비교는 문자열 포함
 * 관계 하나였다. 그게 SAME 도달을 막는 단일 최대 원인이었다.
 *
 * 실측(2026-09-20, 고정 카탈로그):
 *
 *   junioredition vendor 93종 중 **68종(73%)** 에 판촉·법인 문구가 섞여 있다
 *     "Konges Sløjd Clothing 30% Off Sale"   "Angulus Sale 70% Off"
 *     "Pèpè Shoes 50% Off"                   "Liewood Clothing 60% Off Sale"
 *   공식몰은 깨끗하다
 *     "Konges Sløjd A/S" × 3,530   "Angulus" × 1,272
 *
 * 같은 브랜드가 «할인율별로» 다른 vendor 가 된다. 할인이 바뀌면 브랜드가 바뀐다.
 *
 * ── 🔴 문자열을 지우는 규칙이 아니다 ────────────────────────────────────────
 * CEO 지시: 「"Clothing 30% Off Sale" 같은 문자열 제거 규칙을 넣지 말고 계층을
 * 만들라」. 그래서 이 파일은 셋을 «분리해서» 답한다.
 *
 *     raw        판매처가 적은 값 그대로 (버리지 않는다 — 감사에 필요하다)
 *     value      비교에 쓰는 핵심명
 *     confidence 그 핵심명을 얼마나 믿을 수 있는가
 *
 * 꼬리를 떼어냈으면 confidence 가 내려간다. 「떼어냈다」는 사실이 사라지지 않는다.
 *
 * ── 하지 않는 것 ────────────────────────────────────────────────────────────
 * 브랜드 별칭 사전(Bobo Choses ↔ 보보쇼즈)을 만들지 않는다. 그건 번역이고,
 * 이 저장소가 계속 거절해 온 것이다. 여기서는 «같은 문자열의 꼬리» 만 다룬다.
 */

import { normalizeFactText } from "./product-facts";

/** 브랜드 핵심명 뒤에 붙는 «판매처의 말». 브랜드 이름의 일부가 아니다. */
const TRAILING_NOISE = [
  // 판촉 — junioredition 실측
  /\b\d{1,3}\s*%\s*off\b/gi,
  /\bsale\b/gi,
  /\boutlet\b/gi,
  // 취급 품목 — "Konges Sløjd Clothing", "Pèpè Shoes"
  /\b(clothing|shoes|wear|living|kids|baby|home)\b/gi,
  // 법인격
  /\b(a\/s|aps|ltd|inc|gmbh|srl|bv|nv|co|corp|company)\b\.?/gi,
];

/** 🔴 꼬리를 떼고 «남은 것이 없으면» 떼지 않은 것으로 되돌린다. */
function stripTrailingNoise(text: string): { value: string; stripped: boolean } {
  let out = text;
  for (const re of TRAILING_NOISE) out = out.replace(re, " ");
  out = out.replace(/[-–—,/]+/g, " ").replace(/\s+/g, " ").trim();
  if (!out) return { value: text.trim(), stripped: false };
  return { value: out, stripped: out !== text.trim() };
}

export type BrandConfidence = "HIGH" | "LOW" | "NONE";

export interface BrandIdentity {
  /** 판매처가 적은 값 그대로. */
  raw: string | null;
  /** 비교에 쓰는 핵심명(소문자·공백 정규화). 없으면 null. */
  value: string | null;
  /**
   * HIGH  손대지 않고 그대로 쓸 수 있었다
   * LOW   판촉·법인 꼬리를 떼어냈다 — 값은 쓰되 «확정» 근거로는 약하다
   * NONE  브랜드를 읽지 못했다
   */
  confidence: BrandConfidence;
}

/** 시즌코드만 있는 vendor(bobochoses "AW26")는 브랜드가 아니다 — 기존 원칙 유지. */
const SEASON_CODE_ONLY = /^(ss|aw|fw|sp)\s?\d{2,4}$/i;

export function resolveBrandIdentity(raw: string | null | undefined): BrandIdentity {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || SEASON_CODE_ONLY.test(trimmed)) return { raw: raw ?? null, value: null, confidence: "NONE" };
  const { value, stripped } = stripTrailingNoise(trimmed);
  /* 🔴 기존 brandsCompatible 과 «같은» 정규화를 쓴다. toLowerCase 만 쓰면
     "Pèpè" 가 "pepe" 와 갈라진다 — 실측으로 확인한 회귀다(내가 만든 것). */
  const normalized = normalizeFactText(value).replace(/\s+/g, " ").trim();
  if (!normalized) return { raw: trimmed, value: null, confidence: "NONE" };
  return { raw: trimmed, value: normalized, confidence: stripped ? "LOW" : "HIGH" };
}

/**
 * 두 브랜드가 «같은 브랜드로 볼 수 있는가».
 *
 * 🔴 핵심명이 정확히 같거나, 한쪽이 다른 쪽을 «단어 경계에서» 포함할 때만 참이다.
 *    부분 문자열 포함을 그대로 쓰면 "Bo" 가 "Bobo" 를 삼킨다 — 기존
 *    brandsCompatible 이 `includes` 만 쓰던 자리가 여기다.
 */
export function brandIdentitiesCompatible(a: BrandIdentity, b: BrandIdentity): boolean {
  if (!a.value || !b.value) return false;
  if (a.value === b.value) return true;
  const wa = a.value.split(" ");
  const wb = b.value.split(" ");
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  // 짧은 쪽의 «모든» 단어가 긴 쪽에 순서대로 들어 있으면 같은 브랜드로 본다.
  let i = 0;
  for (const w of long) if (w === short[i]) i++;
  return i === short.length;
}
