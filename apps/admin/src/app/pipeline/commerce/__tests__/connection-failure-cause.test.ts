import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SELLER_SETTINGS_UNAVAILABLE_MESSAGE,
  SELLER_SETTINGS_UNAVAILABLE_RESOLUTION,
} from "@/lib/seller-settings-messages";
import { failedBeforeSending } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SELLER-UX-FINAL PHASE 3 — 「연결 실패」로 뭉개지 않는다 (CEO 지시 2026-10-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 서버는 네 상태를 갈라 돌려준다(resolve-context.ts:51-57). 그런데 화면은
 * `AUTH_FAILED` «만» 문구를 만들고 나머지를 `null` 로 떨어뜨리고 있었다 —
 * 「판매자 정보를 읽지 못했다」(DB 장애)일 때 셀러는 **아무 설명도 못 봤다**.
 *
 * 🔴 요구된 계약 셋을 고정한다:
 *     원인 표시 · 해결 방법 표시 · 재시도 가능 여부 정확히 표시
 *
 * 🔴 소스 문자열 검사는 주석을 벗기고 한다 — 아래 파일들의 주석에 상태 이름이
 * 설명으로 여러 번 나온다(여덟 번 걸린 함정).
 */
const ROOT = join(__dirname, "../../../..");
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
const read = (rel: string) => codeOnly(readFileSync(join(ROOT, rel), "utf8"));

const WORKSPACE = read("app/pipeline/CommerceWorkspace.tsx");

describe("① 🔴 「값이 비었다」와 「읽지 못했다」가 갈려 있다", () => {
  it("상수 둘이 서로 다른 말을 한다 — 원인과 해결방법", () => {
    expect(SELLER_SETTINGS_UNAVAILABLE_MESSAGE).toContain("확인하지 못해");
    expect(SELLER_SETTINGS_UNAVAILABLE_RESOLUTION).toContain("다시 시도");
    expect(SELLER_SETTINGS_UNAVAILABLE_MESSAGE).not.toBe(SELLER_SETTINGS_UNAVAILABLE_RESOLUTION);
  });

  it("🔴 「설정을 채우세요」라고 말하지 «않는다» — DB 장애를 설정 누락으로 둔갑시키지 않는다", () => {
    const both = `${SELLER_SETTINGS_UNAVAILABLE_MESSAGE} ${SELLER_SETTINGS_UNAVAILABLE_RESOLUTION}`;
    for (const forbidden of ["입력해", "등록해 주세요", "채워"]) {
      expect(both, forbidden).not.toContain(forbidden);
    }
  });

  it("서버 타입이 네 상태를 갈라 갖고 있다", () => {
    const resolve = read("app/api/naver/_lib/resolve-context.ts");
    for (const status of ["NOT_CONFIGURED", "AUTH_FAILED", "SELLER_SETTINGS_UNAVAILABLE"]) {
      expect(resolve, status).toContain(`status: "${status}"`);
    }
  });
});

describe("② 🔴 화면이 그 구분을 «쓴다» — null 로 떨어지지 않는다", () => {
  /** 상태 분기 식이 모여 있는 구간만 떼어 본다. */
  const BRANCH = WORKSPACE.slice(
    WORKSPACE.indexOf("setSmartStoreValidationError("),
    WORKSPACE.indexOf("setSmartStoreValidationLoading(false)"),
  );

  it.each(["AUTH_FAILED", "SELLER_SETTINGS_UNAVAILABLE", "NOT_CONFIGURED"])(
    "%s 가 자기 문구를 갖는다",
    (status) => {
      expect(BRANCH, `${status} 가 분기에 없다`).toContain(`data.status === "${status}"`);
    },
  );

  it("🔴 판매자 정보 읽기 실패에 «해결 방법» 이 붙는다", () => {
    expect(BRANCH).toContain("SELLER_SETTINGS_UNAVAILABLE_RESOLUTION");
  });

  it("🔴 인증 미설정에는 «갈 곳» 을 알려준다 — 재시도가 아니라 설정이다", () => {
    expect(BRANCH).toContain("설정 > 커머스 계정 관리");
  });

  it("🔴 문구를 새로 짓지 않고 서버 메시지를 그대로 쓴다", () => {
    /* data.message 가 들어가야 서버와 화면이 같은 말을 한다. */
    expect(BRANCH).toContain("data.message");
  });
});

describe("③ 🔴 쿠팡 미리보기가 읽기 장애를 「생성 실패」로 뭉개지 않는다", () => {
  const BRANCH = WORKSPACE.slice(
    WORKSPACE.indexOf("setPayloadPreviewUnavailableReason("),
    WORKSPACE.indexOf('"Payload를 생성하지 못했습니다."') + 40,
  );

  it("전용 분기가 있다", () => {
    expect(BRANCH).toContain('data.reason === "SELLER_SETTINGS_UNAVAILABLE"');
  });

  it("🔴 그 분기가 마지막 폴백 «앞» 에 있다 — 뒤에 있으면 도달하지 않는다", () => {
    expect(BRANCH.indexOf('data.reason === "SELLER_SETTINGS_UNAVAILABLE"')).toBeLessThan(
      BRANCH.indexOf('"Payload를 생성하지 못했습니다."'),
    );
  });

  it("원인과 해결방법을 같이 적는다", () => {
    expect(BRANCH).toContain("SELLER_SETTINGS_UNAVAILABLE_MESSAGE");
    expect(BRANCH).toContain("SELLER_SETTINGS_UNAVAILABLE_RESOLUTION");
  });
});

describe("④ 🔴 재시도 가능 여부가 «정확하다» — 서버 판정을 그대로 쓴다", () => {
  it("세 채널 모두 retryable: true 로 돌려준다 — 읽기 실패는 다시 하면 될 일이다", () => {
    const smartstore = read("app/api/smartstore/register/route.ts");
    const coupang = read("app/api/coupang/register/route.ts");
    /* SmartStore — 전용 분기가 retryable: true 를 싣는다. */
    const ss = smartstore.slice(smartstore.indexOf('context.status === "SELLER_SETTINGS_UNAVAILABLE"'));
    expect(ss.slice(0, 500)).toContain("retryable: true");
    /* 쿠팡 — 같은 판정 + 해결방법까지 싣는다. */
    const cp = coupang.slice(coupang.indexOf("if (sellerSettings.failed)"));
    expect(cp.slice(0, 700)).toContain("retryable: true");
    expect(cp.slice(0, 700)).toContain("SELLER_SETTINGS_UNAVAILABLE_RESOLUTION");
  });

  it("🔴 이 실패는 «보내기 전» 이다 — 채널에 아무것도 전송되지 않았다", () => {
    /* 세 채널 모두 step: "VALIDATION" 으로 기록한다. PHASE 4 의 분류가 그것을
       「보내기 전」으로 읽어야 셀러가 「중복 등록됐나?」를 걱정하지 않는다. */
    expect(failedBeforeSending("VALIDATION")).toBe(true);
  });

  it("🔴 가드가 payload 조립보다 «앞» 이다 — 읽지 못한 값으로 상품을 올리지 않는다", () => {
    const coupang = read("app/api/coupang/register/route.ts");
    expect(coupang.indexOf("if (sellerSettings.failed)")).toBeLessThan(coupang.indexOf("buildCoupangPayload("));
    const lotteon = read("app/api/lotteon/register/route.ts");
    expect(lotteon.indexOf("if (context.sellerSettingsError)")).toBeLessThan(
      lotteon.indexOf("validateLotteOnPayload("),
    );
  });
});

describe("⑤ 🔴 새 연결/인증 시스템을 만들지 않았다", () => {
  it("연결 상태 맵에 새 키를 넣지 않았다 — 읽기 장애는 «연결» 상태가 아니다", () => {
    const panel = read("app/pipeline/commerce/CoupangConnectionPanel.tsx");
    expect(panel).not.toContain("SELLER_SETTINGS_UNAVAILABLE");
    /* 기존 다섯 상태는 그대로다. */
    for (const k of ["UNKNOWN", "CHECKING", "NOT_CONFIGURED", "CONNECTED", "AUTH_FAILED"]) {
      expect(panel, k).toContain(`${k}:`);
    }
  });

  it("새 인증 라우트/프록시/디버그 라우트를 만들지 않았다", () => {
    expect(WORKSPACE).not.toContain("/api/debug");
    expect(WORKSPACE).not.toContain("outbound-proxy");
  });
});

describe("⑥ 🔴 문구 모듈이 «클라이언트 번들을 깨뜨리지 않는다»", () => {
  /* 처음에 문구를 `@/lib/seller-settings` 에서 가져왔더니 그 파일이
     `supabase-admin → supabase-server → next/headers` 를 끌고 와서 **build 가
     깨졌다**. typecheck 는 통과했고 build 가 잡았다 — 그래서 build 가 별도
     게이트다. 같은 함정이 다시 생기지 않게 박아 둔다. */
  it("🔴 문구 모듈에 import 가 «하나도» 없다", () => {
    const src = readFileSync(join(ROOT, "lib/seller-settings-messages.ts"), "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toContain("require(");
  });

  it("🔴 클라이언트 컴포넌트가 서버 모듈을 import 하지 않는다", () => {
    expect(WORKSPACE).toContain('from "@/lib/seller-settings-messages"');
    expect(WORKSPACE).not.toContain('from "@/lib/seller-settings"');
    expect(WORKSPACE).not.toContain("supabase-admin");
    expect(WORKSPACE).not.toContain("supabase-server");
  });

  it("🔴 글자가 «한 곳» 에만 있다 — 화면에 복사하지 않았다", () => {
    expect(WORKSPACE).toContain("SELLER_SETTINGS_UNAVAILABLE_MESSAGE");
    /* 문구를 리터럴로 베껴 넣으면 서버와 화면이 갈린다. */
    expect(WORKSPACE).not.toContain("판매자 정보를 확인하지 못해");
    /* 그리고 서버 모듈은 그 글자를 re-export 로만 갖는다. */
    const server = readFileSync(join(ROOT, "lib/seller-settings.ts"), "utf8");
    expect(server).toContain('} from "./seller-settings-messages"');
    expect(server).not.toContain('"판매자 정보를 확인하지 못해 등록을 진행할 수 없습니다."');
  });
});
