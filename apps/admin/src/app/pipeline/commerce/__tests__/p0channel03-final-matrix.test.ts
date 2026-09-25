import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMERCE_ORDER, type CommerceId } from "../commerce-registry";
import {
  CHANNEL_CAPABILITY,
  resolveCreateGate,
  resolveLifecycle,
  type ChangeSet,
} from "../channel-lifecycle";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 §7 — **세 채널 lifecycle 최종 매트릭스**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 스프린트 전체가 만든 계약을 «한 표» 로 고정한다. 이 파일이 깨지면 어딘가에서
 * 정책이 바뀐 것이고, 그것은 대개 조용히 일어난다.
 *
 * 🔴 지키는 두 축:
 *   ① 확인되지 않은 것을 확인했다고 말하지 않는다(UNKNOWN ≠ NOT_SUPPORTED).
 *   ② 어떤 실패도 «새 상품을 만드는 길» 로 이어지지 않는다.
 */

const SEEN = { categoryUnknown: false, comparedEverything: true } as const;
const PRICE: ChangeSet = { fields: ["salePrice"], category: false, ...SEEN };
const CATEGORY: ChangeSet = { fields: [], category: true, ...SEEN };
const NONE: ChangeSet = { fields: [], category: false, ...SEEN };
const CHANNELS = ["smartstore", "coupang", "lotteon"] as const;

describe("§7-① 최초 CREATE — 세 채널 모두 ALLOW", () => {
  it.each(CHANNELS)("%s", (id) => {
    expect(resolveLifecycle(id, false, PRICE).operation).toBe("CREATE");
    expect(resolveCreateGate({ hasChannelProduct: false, priorSuccess: false, plannedOperation: "CREATE" })).toBe("ALLOW");
  });
});

describe("§7-② ChannelProduct 존재 — capability 가 정한다", () => {
  it("SmartStore: 일반 변경 → UPDATE (수정 API 확인됨)", () => {
    expect(resolveLifecycle("smartstore", true, PRICE).operation).toBe("UPDATE");
  });

  it("🔴 Coupang: 일반 변경 → BLOCKED (수정 근거 «없음» — 추측 구현 안 함)", () => {
    expect(resolveLifecycle("coupang", true, PRICE).operation).toBe("BLOCKED");
  });

  it("🔴 LotteON: 일반 변경 → BLOCKED (apiNo 90 계약 미확인)", () => {
    expect(resolveLifecycle("lotteon", true, PRICE).operation).toBe("BLOCKED");
  });

  it("변경 없음 → NOOP (전수 비교했을 때만)", () => {
    for (const id of CHANNELS) expect(resolveLifecycle(id, true, NONE).operation).toBe("NOOP");
  });
});

describe("§7-③ 카테고리 변경 — 무조건 UPDATE 라고 가정하지 않는다", () => {
  it("🔴 Coupang: 공식이 «불가» 로 명시 → RECREATE", () => {
    const d = resolveLifecycle("coupang", true, CATEGORY);
    expect(d.operation).toBe("RECREATE");
    expect(d.reason).toContain("바꿀 수 없습니다");
  });

  it("🔴 SmartStore·LotteON: «미확인» → RECREATE 로 제안하되 그렇게 말한다", () => {
    for (const id of ["smartstore", "lotteon"] as const) {
      const d = resolveLifecycle(id, true, CATEGORY);
      expect(d.operation).toBe("RECREATE");
      expect(d.reason).toContain("확인되지 않았습니다");
    }
  });

  it("🔴 카테고리를 «읽지 못했으면» 어느 쪽으로도 밀지 않는다 — BLOCKED", () => {
    for (const id of CHANNELS) {
      const d = resolveLifecycle(id, true, { fields: ["salePrice"], category: false, categoryUnknown: true, comparedEverything: false });
      expect(d.operation).toBe("BLOCKED");
    }
  });
});

describe("§7-④ 성공 이력만 존재 / 조회 UNKNOWN — 세 채널 모두 BLOCK", () => {
  it.each([
    ["성공 이력만 존재", true, "BLOCKED_PRIOR_SUCCESS"],
    ["조회 UNKNOWN", null, "BLOCKED_UNKNOWN"],
  ] as const)("%s → %s", (_label, priorSuccess, verdict) => {
    expect(resolveCreateGate({ hasChannelProduct: false, priorSuccess, plannedOperation: "CREATE" })).toBe(verdict);
  });

  it("ChannelProduct 존재 + CREATE 시도 → BLOCKED_LINKED", () => {
    expect(resolveCreateGate({ hasChannelProduct: true, priorSuccess: true, plannedOperation: "CREATE" })).toBe("BLOCKED_LINKED");
  });

  it("🔴 명시적 RECREATE 는 네 경우 모두 지나간다", () => {
    for (const hasChannelProduct of [true, false]) {
      for (const priorSuccess of [true, false, null]) {
        expect(resolveCreateGate({ hasChannelProduct, priorSuccess, plannedOperation: "RECREATE" })).toBe("ALLOW");
      }
    }
  });
});

describe("§7-⑤ 🔴 UPDATE 실패가 CREATE/RECREATE 로 «떨어지지» 않는다", () => {
  const routes: Record<string, string> = {
    smartstore: readFileSync(join(__dirname, "../../../api/smartstore/register/route.ts"), "utf8"),
    coupang: readFileSync(join(__dirname, "../../../api/coupang/register/route.ts"), "utf8"),
    lotteon: readFileSync(join(__dirname, "../../../api/lotteon/register/route.ts"), "utf8"),
  };

  it("SmartStore — UPDATE 실패 분기가 그대로 반환한다", () => {
    const src = routes.smartstore!;
    const fail = src.slice(src.indexOf("if (!updated.ok) {"), src.indexOf('logStep("상품 수정", "success"'));
    expect(fail).toContain("return NextResponse.json(result);");
    /* 🔴 실패 처리 안에서 operation 을 바꾸거나 CREATE 로 내려보내지 않는다. */
    expect(fail).not.toContain("plannedOperation");
    expect(fail).not.toContain("CREATE_PRODUCT_PATH");
  });

  it("🔴 세 라우트 어디에도 자동 재시도·자동 재등록이 없다", () => {
    for (const [name, src] of Object.entries(routes)) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, `${name}`).not.toContain("retryRegister");
      expect(code, `${name}`).not.toContain("fallbackToCreate");
      expect(code, `${name}`).not.toContain("autoRecreate");
    }
  });

  it("🔴 외부 상품을 지우는 경로가 세 라우트 어디에도 없다", () => {
    for (const [name, src] of Object.entries(routes)) {
      expect(src, `${name}`).not.toContain('method: "DELETE"');
    }
  });
});

describe("§8 Production 안전성 — 코드로 고정", () => {
  const store = readFileSync(join(__dirname, "../../../api/_lib/channel-product.ts"), "utf8");
  const linker = readFileSync(join(__dirname, "../../../api/_lib/link-legacy-registration.ts"), "utf8");

  it("🔴 ChannelProduct 를 LIVE 로 추정하지 않는다", () => {
    for (const src of [store, linker]) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code).not.toContain('"LIVE"');
    }
  });

  it("🔴 source URL 기반 자동 매칭이 없다", () => {
    const code = linker.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toContain("source_url");
    expect(code).not.toContain("sourceUrl");
  });

  it("🔴 기존 데이터를 지우는 코드가 없다", () => {
    for (const src of [store, linker]) expect(src).not.toContain(".delete(");
  });
});

describe("§6 LotteON 선결조건 — 없으면 «등록 API 를 부르지 않는다»", () => {
  /** 🔴 네 값은 판매자센터에 «먼저» 등록돼 있어야 한다. 임의 값을 보낼 수 없다. */
  const PREREQ = ["owhpNo", "rtrpNo", "dvCstPolNo", "dvRgsprGrpCd"] as const;

  /* 🔴 값 검증 자체(없으면 BLOCKED · 있으면 READY)는 «검증기 옆» 에서 한다 —
     packages/listing/src/lotteon/__tests__/build-payload.test.ts 에 실제
     product/channel 픽스처가 이미 있고, 여기서 빈 객체를 흉내 내면 필드가 하나
     늘 때마다 깨지면서 진짜 기본값과 달라진다(실제로 두 번 깨졌다).
     이 파일은 «라우트가 그 결과를 게이트로 쓰는가» 만 본다. */

  it("네 값이 검증기의 BLOCKED 목록에 있다", () => {
    const src = readFileSync(
      join(__dirname, "../../../../../../../packages/listing/src/lotteon/validate-payload.ts"),
      "utf8",
    );
    for (const field of PREREQ) expect(src).toContain(`field: "${field}"`);
    expect(src).toContain("SELLER_PLACE_REQUIRED");
  });

  it("라우트가 validation.ok 를 게이트로 쓴다 — 87 호출 «앞» 에서", () => {
    const src = readFileSync(join(__dirname, "../../../api/lotteon/register/route.ts"), "utf8");
    const iGate = src.indexOf("if (!validation.ok) {");
    const iCall = src.indexOf("LOTTEON_WRITE_PATHS.productRegistration");
    expect(iGate).toBeGreaterThan(-1);
    expect(iGate).toBeLessThan(iCall);
  });
});

describe("§7 capability 표 — 확인된 것만 SUPPORTED 다", () => {
  it("수정이 «확인된» 채널은 SmartStore 하나뿐이다", () => {
    const supported = COMMERCE_ORDER.filter((id: CommerceId) => CHANNEL_CAPABILITY[id].update === "SUPPORTED");
    expect(supported).toEqual(["smartstore"]);
  });

  it("🔴 카테고리 수정이 SUPPORTED 인 채널은 «하나도 없다»", () => {
    for (const id of COMMERCE_ORDER) {
      expect(CHANNEL_CAPABILITY[id].categoryUpdate).not.toBe("SUPPORTED");
    }
  });

  it("Coupang 카테고리만 NOT_SUPPORTED — 나머지는 UNKNOWN(모르는 것과 안 되는 것은 다르다)", () => {
    expect(CHANNEL_CAPABILITY.coupang.categoryUpdate).toBe("NOT_SUPPORTED");
    expect(CHANNEL_CAPABILITY.smartstore.categoryUpdate).toBe("UNKNOWN");
    expect(CHANNEL_CAPABILITY.lotteon.categoryUpdate).toBe("UNKNOWN");
  });
});
