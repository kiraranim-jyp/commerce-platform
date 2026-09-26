import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2C — **상수가 «조용히» 늘지 못하게 한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * C-2B 가 고친 `remoteAreaDeliverable: "N"` 은 한 번의 실수가 아니라 «부류» 였다.
 * 스키마에 맞춰 payload 를 채우다 보면 빈 칸에 그럴듯한 값을 적게 되고, 그 값이
 * 판매자의 결정인지 기술적 귀결인지가 구분되지 않은 채 남는다. 그 줄만 보면
 * 아무 문제가 없어 보이는 것이 이 결함의 성질이다.
 *
 * 그래서 값을 검사하지 않는다 — **목록을 검사한다.** 쿠팡 payload 최상위에
 * 하드코딩된 키는 아래 넷뿐이고, 넷 다 왜 그 값인지가 소스에 적혀 있다.
 * 다섯 번째가 생기면 이 테스트가 먼저 막는다.
 *
 * 🔴 값을 여기 적지 않는다. 값을 적으면 이 파일이 「그 값이 옳다」고 말하는
 *    두 번째 자리가 된다 — 지금 고치려는 문제가 바로 그것이다.
 */

/* 🔴 줄바꿈을 정규화하고 읽는다. 이 저장소 파일은 CRLF 라서 `"\n  return {\n"`
   같은 앵커가 그냥 안 맞는다(이 테스트를 처음 짤 때 정확히 그렇게 실패했다). */
const SOURCE = readFileSync(join(__dirname, "..", "build-payload.ts"), "utf8").replace(/\r\n/g, "\n");

/** `return {` 부터 짝이 맞는 `};` 까지 — payload 최상위만 본다(items[] 제외). */
function payloadReturnBlock(): string {
  const start = SOURCE.lastIndexOf("\n  return {\n");
  expect(start, "payload return 블록을 찾지 못했다").toBeGreaterThan(-1);
  const end = SOURCE.indexOf("\n  };\n", start);
  return SOURCE.slice(start, end);
}

/** `key: <리터럴>,` 인 줄의 «키» 만 모은다. 변수·함수 호출은 상수가 아니다. */
function hardcodedKeys(block: string): string[] {
  return block
    .split("\n")
    .map((line) => /^\s{4}([a-zA-Z][A-Za-z0-9]*): ("[^"]*"|-?\d+(\.\d+)?|true|false),\s*$/.exec(line))
    .filter((m): m is RegExpExecArray => m != null)
    .map((m) => m[1]);
}

/**
 * 하드코딩이 허용된 키와 «그 근거가 어디에 적혀 있는지».
 *
 * 🔴 목록에 넣는 조건은 「지금 그 값이 나가고 있다」가 아니라 **「왜 그 값인지가
 * 소스에 적혀 있다」** 이다. `unionDeliveryType` 은 근거가 «없다» 는 사실이
 * 적혀 있어서 들어간다 — 모른다고 적는 것도 기록이다.
 */
const DOCUMENTED: { key: string; mustMention: string }[] = [
  { key: "deliveryMethod", mustMention: "AGENT_BUY" },
  { key: "freeShipOverAmount", mustMention: "CONDITIONAL_FREE" },
  { key: "unionDeliveryType", mustMention: "근거 «없음»" },
  { key: "requested", mustMention: "Wing" },
];

describe("① 쿠팡 payload 최상위의 하드코딩 «목록» 이 늘지 않는다", () => {
  it("아는 넷 말고는 없다", () => {
    expect(hardcodedKeys(payloadReturnBlock()).sort()).toEqual(DOCUMENTED.map((d) => d.key).sort());
  });

  /* 🔴 C-2B 가 이 자리에서 하나를 걷어냈다. 되살아나면 위 목록이 다섯이 된다. */
  it("remoteAreaDeliverable 이 목록에 돌아오지 않았다", () => {
    expect(hardcodedKeys(payloadReturnBlock())).not.toContain("remoteAreaDeliverable");
  });
});

describe("② 남은 상수는 «왜 그 값인지» 가 소스에 적혀 있다", () => {
  it.each(DOCUMENTED)("$key 의 근거가 기록돼 있다", ({ key, mustMention }) => {
    /* 근거는 «타입 선언» 위에 있기도 하고(deliveryMethod · requested) «대입» 위에
       있기도 하다(freeShipOverAmount · unionDeliveryType). 그래서 키가 나오는
       모든 자리를 보고 그중 한 곳이라도 바로 위에 근거가 있으면 통과한다.

       🔴 파일 전체에서 찾지 않는다 — 그러면 아무 데나 한 줄 적고 통과시킬 수
       있다. 주석은 그 줄 «바로 위» 에 서야 의미가 있다. */
    const positions: number[] = [];
    for (let at = SOURCE.indexOf(`${key}:`); at > -1; at = SOURCE.indexOf(`${key}:`, at + 1)) {
      positions.push(at);
    }
    expect(positions.length, `${key} 가 소스에 없다`).toBeGreaterThan(0);
    const documented = positions.some((at) =>
      SOURCE.slice(Math.max(0, at - 900), at).includes(mustMention),
    );
    expect(documented, `${key} 의 근거가 바로 위에 없다`).toBe(true);
  });
});

describe("③ 🔴 다른 채널과 «반대» 인 것이 기록돼 있다", () => {
  /* 네이버는 대표님 지시로 묶음배송을 항상 켠다(deliveryBundleGroupUsable: true).
     쿠팡은 반대값을 보내고 그 이유가 없었다. 값은 바꾸지 않았다 — Production
     등록 정책이라 CPO/CEO 결정이다. 다만 «모순을 안다» 는 사실은 남긴다. */
  it("쿠팡 묶음배송 상수가 네이버와 반대라는 사실이 적혀 있다", () => {
    const at = SOURCE.lastIndexOf("unionDeliveryType:");
    const above = SOURCE.slice(Math.max(0, at - 900), at);
    expect(above).toContain("네이버");
    expect(above).toContain("반대");
  });
});
