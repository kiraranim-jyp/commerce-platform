import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER } from "@commerce/marketplace";
import {
  FORBIDDEN_LOTTEON_ENDPOINTS,
  findForbiddenLotteOnEndpoint,
} from "../../../api/lotteon/_lib/forbidden-endpoints";
import { readSourceAt, stripComments } from "./source-text";

/**
 * LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14) — **범위 되돌리기**를 고정한다.
 *
 * 이 스위트는 기능을 검증하지 않는다. "무엇이 사라졌고 무엇이 남았는가"라는
 * 스코프 결정을 코드에 못 박는다. 되돌리기는 시간이 지나면 슬그머니 되살아나는
 * 종류의 변경이라(메뉴 한 줄, 탭 한 개), 사람이 기억하는 대신 테스트가 기억한다.
 *
 *   삭제  판매관리 화면 · 주문(209) 조회 라우트 · 클레임(50/51/69) 조회 라우트
 *   유지  🔴 210 guard(FORBIDDEN_LOTTEON_ENDPOINTS) — 지우면 안 된다
 *   유지  상품등록에 필요한 것(product-status 93 · categories onpick · 설정 · auth-test)
 *   UI만  11번가는 화면에서만 빠진다 — PlatformId/어댑터/PLATFORM_ORDER는 그대로
 */

function repoFile(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

function workspaceCode(): string {
  return stripComments(readSourceAt(new URL("../../CommerceWorkspace.tsx", import.meta.url)));
}

describe("판매관리는 이번 범위에서 제거됐다", () => {
  it("판매관리 화면과 주문·클레임 조회 라우트가 저장소에 없다", () => {
    for (const gone of [
      "../../../sales/page.tsx",
      "../../../api/lotteon/orders/route.ts",
      "../../../api/lotteon/claims/route.ts",
    ]) {
      expect(existsSync(repoFile(gone)), gone).toBe(false);
    }
  });

  it("사이드바에 판매관리 메뉴가 없다 — 갈 수 없는 곳으로 데려가지 않는다", () => {
    const shell = stripComments(readSourceAt(new URL("../../../../components/layout/AppShell.tsx", import.meta.url)));
    expect(shell).not.toContain('href: "/sales"');
    expect(shell).not.toContain("판매관리");
  });

  it("상품등록에 필요한 롯데ON 라우트는 그대로 남아 있다", () => {
    for (const kept of [
      // 93 — 등록 응답에 없는 단품번호(sitmNo)를 얻는 유일한 경로다.
      "../../../api/lotteon/product-status/route.ts",
      // onpick — 표준/전시 카테고리 선택에 필요하다.
      "../../../api/lotteon/categories/route.ts",
      "../../../api/lotteon/payload-preview/route.ts",
      "../../../api/lotteon/register/route.ts",
      "../../../api/lotteon/auth-test/route.ts",
      "../../../api/settings/lotteon/route.ts",
    ]) {
      expect(existsSync(repoFile(kept)), kept).toBe(true);
    }
  });
});

describe("🔴 210 guard는 판매관리 화면이 사라져도 그대로다", () => {
  it("금지 목록이 줄지 않았다 — 연동완료통보(210)를 포함한 15개가 그대로 있다", () => {
    expect(FORBIDDEN_LOTTEON_ENDPOINTS).toHaveLength(15);
    expect(FORBIDDEN_LOTTEON_ENDPOINTS.some((entry) => entry.apiNo === 210)).toBe(true);
  });

  it("210 연동완료통보는 여전히 호출 전에 막힌다", () => {
    expect(findForbiddenLotteOnEndpoint("/v1/openapi/delivery/v1/SellerIfCompleteInform")).not.toBeNull();
  });

  it("상품등록(87)은 여전히 막히지 않는다 — guard를 남긴다고 상품 축이 닫히지 않는다", () => {
    expect(findForbiddenLotteOnEndpoint("/v1/openapi/product/v1/product/registration/request")).toBeNull();
  });

  it("guard 파일 자체가 남아 있다", () => {
    expect(existsSync(repoFile("../../../api/lotteon/_lib/forbidden-endpoints.ts"))).toBe(true);
    expect(existsSync(repoFile("../../../api/lotteon/__tests__/forbidden-endpoints.test.ts"))).toBe(true);
  });
});

describe("11번가는 화면에서만 빠진다 — 코드는 그대로다", () => {
  it("PlatformId와 어댑터, PLATFORM_ORDER는 한 줄도 바뀌지 않았다", () => {
    expect(PLATFORM_ORDER).toEqual(["smartstore", "coupang", "elevenst"]);
    expect(PLATFORM_ADAPTERS.elevenst).toBeDefined();
    expect(PLATFORM_ADAPTERS.elevenst.label).toBe("11번가");
  });

  it("상품등록 화면이 나열하는 채널에서는 빠져 있다", () => {
    const code = workspaceCode();
    // 화면이 보는 목록은 WORKSPACE_PLATFORM_ORDER 하나뿐이고, 거기서 걸러진다.
    expect(code).toContain('WORKSPACE_PLATFORM_ORDER: PlatformId[] = PLATFORM_ORDER.filter((id) => id !== "elevenst")');
    // 탭 줄 · 준비상태 줄 · Action Center · ④ 흐름이 전부 같은 배열을 본다 —
    // 한 곳이라도 PLATFORM_ORDER를 직접 쓰면 탭에 없는 채널이 다시 나타난다.
    expect(code).not.toMatch(/\{PLATFORM_ORDER\./);
    expect(code).not.toMatch(/of PLATFORM_ORDER\b/);
    expect(code).not.toMatch(/order: PLATFORM_ORDER\b/);
  });

  it("Backlog에서도 '11번가 등록'을 약속하지 않는다", () => {
    const backlog = stripComments(readSourceAt(new URL("../BacklogPanel.tsx", import.meta.url)));
    expect(backlog).not.toContain("11번가");
  });
});

describe("'Preview'라는 이름을 화면에서 쓰지 않는다", () => {
  const screens = [
    "../NaverPayloadPreview.tsx",
    "../PlatformPreview.tsx",
    "../LotteOnRegistrationPanel.tsx",
    "../../CommerceWorkspace.tsx",
  ];

  it("세 탭 어디에도 'Payload Preview' 라는 표기가 남아 있지 않다", () => {
    for (const screen of screens) {
      const code = stripComments(readSourceAt(new URL(screen, import.meta.url)));
      expect(code, screen).not.toContain("Payload Preview");
      expect(code, screen).not.toContain("PREVIEW\n");
    }
  });

  it("기능은 그대로다 — 세 탭 모두 전송 데이터 원문을 계속 보여준다", () => {
    expect(stripComments(readSourceAt(new URL("../PlatformPreview.tsx", import.meta.url)))).toContain(
      "CoupangPayloadInspector",
    );
    expect(stripComments(readSourceAt(new URL("../NaverPayloadPreview.tsx", import.meta.url)))).toContain(
      "전송 데이터 원문",
    );
    expect(stripComments(readSourceAt(new URL("../LotteOnRegistrationPanel.tsx", import.meta.url)))).toContain(
      "전송 데이터 원문",
    );
  });

  it("스마트스토어/쿠팡 탭이 같은 이름을 쓴다 — 채널마다 다른 이름을 붙이지 않는다", () => {
    expect(stripComments(readSourceAt(new URL("../NaverPayloadPreview.tsx", import.meta.url)))).toContain(
      'title={sectionTitle("LISTING_INFO")}',
    );
    expect(stripComments(readSourceAt(new URL("../PlatformPreview.tsx", import.meta.url)))).toContain(
      'title={sectionTitle("LISTING_INFO")}',
    );
  });
});
