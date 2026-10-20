import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { SUPPLIED_URL_INPUT_NOTICE, SUPPLIED_URL_INPUT_SUMMARY } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-129 — **AI 조사 결과를 «그대로» 붙여넣을 수 있다** (CPO 지시 2026-10-20)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 고친 결함 — 패널이 입력을 공백으로 쪼개 **모든 토큰** 을 `candidateUrls` 로 보냈다.
 *    그래서 AI 답변 산문을 붙여넣으면 **단어마다 항목** 이 되어 상한을 넘기고 **400** 이 났고,
 *    셀러는 **URL 을 한 줄씩 직접 찾아 넣는 수밖에 없었다**(= CPO 가 지적한 UX).
 *
 * 🔴 이 파일은 **그 전송 규칙** 과 **문구** 를 잠근다. 파이프라인은 한 줄도 바꾸지 않았다.
 */
const PANEL = readFileSync(path.join(__dirname, "../DomesticPriceIntelligencePanel.tsx"), "utf8");

/** 🟢 운영 전송 규칙과 **같은 식** 을 쓴다(아래 ③이 그 식이 소스에 있는지 단언한다). */
const send = (text: string) =>
  text
    .split(/\s+/)
    .map((s) => s.match(/https?:\/\/[^\s)\]}>,"']+/i)?.[0] ?? "")
    .filter(Boolean);

/** 🔴 실제 AI 답변 모양 — 산문 + 링크가 섞여 있다(WU-116 의 cto-websearch 산출 모양). */
const AI_ANSWER = `보보쇼즈 B226AC009 는 국내외 여러 곳에서 판매되고 있습니다.

국내 판매처:
1. 비스킷 — 88,000원 https://biskuit.kr/product/x/8891/category/367/display/1/
2. 보몽드 — 88,000원 (https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021)

해외 판매처:
- Junior Edition https://www.junioredition.com/products/hug-hairy-monster-t-shirt-by-bobo-choses
- Tiny Apple: https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue

가격대는 88,000원 ~ 89,540원 정도이며 100% 오가닉 코튼입니다.`;

describe("WU-129 ① AI 답변 산문을 붙여넣어도 «링크만» 나간다", () => {
  it("🟢🟢 산문 단어가 후보로 나가지 않는다", () => {
    const out = send(AI_ANSWER);
    expect(out).toHaveLength(4);
    expect(out.every((u) => /^https?:\/\//.test(u))).toBe(true);
    /** 🔴 예전 규칙이면 이 값이 **수십 개** 였고 서버가 400 을 냈다. */
    expect(out.some((u) => u.includes("biskuit.kr"))).toBe(true);
    expect(out.some((u) => u.includes("junioredition.com"))).toBe(true);
    expect(out).not.toContain("보보쇼즈");
    expect(out).not.toContain("국내");
    expect(out).not.toContain("88,000원");
  });

  it("🟢🟢 **괄호에 싸인 링크를 잃지 않는다**(1차 구현이 이것을 버렸고 이 단언이 잡았다)", () => {
    const out = send(AI_ANSWER);
    expect(out.some((u) => u.includes("beaumonde.co.kr"))).toBe(true);
    expect(out.every((u) => !/[()]/.test(u))).toBe(true);
  });

  it("🟢 뒤쪽 입력 경계도 그대로 통과한다(우리가 새 파서를 만들지 않는다)", () => {
    const sent = send(AI_ANSWER);
    const ex = extractCandidateUrlsFromAiAnswer(sent.join("\n"), null);
    expect(ex.urls.length).toBeGreaterThanOrEqual(3);
    expect([...ex.urls].every((u) => /^https?:\/\//.test(u))).toBe(true);
    /** 🔴 **AI 의 판단은 쓰지 않는다** — URL 만 쓴다(CPO 명시). */
    expect(JSON.stringify(ex)).not.toContain("SAME");
  });

  it("🔴 링크가 하나도 없으면 **아무것도 보내지 않는다**(「안 돌았다」가 된다)", () => {
    expect(send("국내에서 비스킷과 보몽드가 판매합니다. 88,000원입니다.")).toEqual([]);
  });
});

describe("WU-129 ② 문구가 「URL 을 직접 찾아오라」로 읽히지 않는다", () => {
  it("🔴 제목이 **AI 조사 결과 붙여넣기** 다", () => {
    expect(SUPPLIED_URL_INPUT_SUMMARY).toContain("AI 조사 결과");
    expect(SUPPLIED_URL_INPUT_SUMMARY).not.toContain("URL 직접");
  });

  it("🟢 안전 계약 두 문장은 **그대로** 남아 있다(WU-024/081)", () => {
    expect(SUPPLIED_URL_INPUT_NOTICE).toContain("저장되지 않");
    expect(SUPPLIED_URL_INPUT_NOTICE).toContain("우리가 다시 판정");
  });

  it("🟢 「붙여넣으세요」를 안내한다", () => {
    expect(SUPPLIED_URL_INPUT_NOTICE).toContain("붙여넣");
  });
});

describe("WU-129 ③ 전송 규칙을 «소스» 로 잠근다", () => {
  it("🔴 패널이 **토큰 안의 URL 을 꺼내** 보낸다(괄호를 잃지 않는 그 구현)", () => {
    expect(PANEL).toContain("s.match(/https?:");
    expect(PANEL).toContain("?.[0] ?? \"\")");
    /** 🔴 1차 구현(토큰 전체 검사)으로 되돌아가면 이 단언이 **FAIL 로 뒤집힌다**. */
    expect(PANEL).not.toContain("/^https?:\\/\\/\\S+$/i.test(s)");
  });

  it("🔴 placeholder 가 「한 줄에 하나」를 요구하지 않는다", () => {
    expect(PANEL).not.toContain('placeholder="https://… (한 줄에 하나)"');
    expect(PANEL).toContain("AI 답변을 그대로 붙여넣으세요");
  });

  it("🟢 비어 있으면 칸을 보내지 않는 기존 계약이 살아 있다", () => {
    expect(PANEL).toContain("suppliedUrls.length > 0 ? { snapshotId, candidateUrls: suppliedUrls } : { snapshotId }");
  });
});
