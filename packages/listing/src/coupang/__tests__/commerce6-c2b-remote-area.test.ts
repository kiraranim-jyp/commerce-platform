import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REMOTE_AREA_DELIVERABLE_UNDECIDED_NOTE,
  resolveRemoteAreaDeliverable,
} from "../build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2B — **판매자가 정하지 않은 배송 정책을 우리가 정하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * C-2A 조사에서 나온 것: `remoteAreaDeliverable: "N"` 이 build-payload 안에
 * 리터럴로 박혀 있었고, 설정에도 Common 에도 화면에도 검증기에도 없었다.
 * 주변 필드는 전부 왜 그 값인지 주석이 있는데 **이 줄만 근거가 없었다.**
 * 그래서 모든 쿠팡 상품이 「도서산간 배송 불가」로 등록되고 있었다.
 *
 * 🔴 CPO 지시 원문: 「N 이 틀렸으니 Y 로 바꾼다가 아니다.」 Y 도 우리가 정한
 * 값이다. 이 테스트가 고정하는 것은 **값이 아니라 «누가 정했는가»** 다.
 */

describe("① 판매자가 고른 값은 그대로 간다", () => {
  it.each(["Y", "N"] as const)("%s 를 고르면 그 값이고 decidedBySeller 다", (choice) => {
    const decision = resolveRemoteAreaDeliverable(choice);
    expect(decision.value).toBe(choice);
    expect(decision.decidedBySeller).toBe(true);
    expect(decision.note).toContain("판매자 설정");
  });
});

describe("② 🔴 고르지 «않았을» 때를 숨기지 않는다", () => {
  it.each([undefined, null])("%s 면 decidedBySeller 가 false 다", (input) => {
    const decision = resolveRemoteAreaDeliverable(input);
    expect(decision.decidedBySeller).toBe(false);
    expect(decision.note).toBe(REMOTE_AREA_DELIVERABLE_UNDECIDED_NOTE);
  });

  /* 🔴 지금 나가는 값은 여전히 N 이다 — 그 사실을 테스트가 «말한다».
     바꾸지 않은 이유는 두 가지이고 둘 다 CTO 가 정할 것이 아니다:
       ① 쿠팡이 이 필드를 필수로 요구하는지 확인할 근거가 없다(UNKNOWN)
       ② 판매자의 결정을 담을 칸이 없다 → migration → CPO STOP 지점
     이 줄이 바뀌는 날은 그 둘이 풀린 날이다. */
  it("미결정 상태의 현재 전송값은 N 이다 — 교정 전까지 «유지되는» 값이다", () => {
    expect(resolveRemoteAreaDeliverable(undefined).value).toBe("N");
  });

  it("미결정 안내가 「정한 적이 없다」를 말한다 — 「기본값」이라고 하지 않는다", () => {
    expect(REMOTE_AREA_DELIVERABLE_UNDECIDED_NOTE).toContain("정한 적이 없어");
    expect(REMOTE_AREA_DELIVERABLE_UNDECIDED_NOTE).not.toContain("기본값");
  });
});

describe("③ 🔴 임의의 N 이 다시 살아나지 못한다", () => {
  const SOURCE = readFileSync(join(__dirname, "..", "build-payload.ts"), "utf8");

  it("빌더에 `remoteAreaDeliverable: \"N\"` 리터럴이 없다", () => {
    expect(SOURCE).not.toMatch(/remoteAreaDeliverable:\s*"[YN]"\s*,/);
  });

  it("payload 는 resolveRemoteAreaDeliverable 를 거쳐서만 값을 얻는다", () => {
    expect(SOURCE).toContain(
      "remoteAreaDeliverable: resolveRemoteAreaDeliverable(sellerConfig.remoteAreaDeliverable).value",
    );
  });

  /* 🔴 값을 «반대로» 뒤집는 것도 교정이 아니다 — 같은 종류의 임의 결정이다. */
  it("미결정일 때 Y 로 뒤집지 않았다", () => {
    expect(resolveRemoteAreaDeliverable(null).value).not.toBe("Y");
  });
});
