import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toRegisteredProductSnapshot } from "../_lib/update-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-6 — **실측 전에 지켜야 할 것**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 넷:
 *   ① 실측 probe 가 라우트와 «같은 매핑» 을 쓴다 — 다시 적으면 실측이 코드와
 *      무관해진다(probe 는 통과하는데 코드는 실패).
 *   ② probe 는 «읽기만» 한다 — PUT/POST/DELETE 가 한 줄도 없다.
 *   ③ 상품번호에 기본값이 없다 — 두 번호가 섞이면 남의 상품을 본다(F-12b).
 *   ④ 새 읽기 라우트가 «같은 인증» 뒤에 있다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const PROBE = codeOnly(
  readFileSync(join(__dirname, "../../../../../scripts/p0channel03-f14-6-edit-model-probe.ts"), "utf8"),
);
const PROXY = codeOnly(readFileSync(join(__dirname, "../../../../proxy.ts"), "utf8"));
const UPDATER = codeOnly(readFileSync(join(__dirname, "../_lib/update-product.ts"), "utf8"));

describe("① 🔴 probe 와 라우트가 같은 매핑을 쓴다", () => {
  it("probe 는 toRegisteredProductSnapshot 을 «불러서» 쓴다", () => {
    expect(PROBE).toContain("toRegisteredProductSnapshot");
    expect(PROBE).toContain("toRegisteredProductSnapshot(envelope.result?.body)");
  });

  it("🔴 probe 가 응답 모양을 «다시 적지» 않는다", () => {
    for (const path of ["originProduct?", "detailAttribute?", "optionCombinations?"]) {
      expect(PROBE, `probe 가 매핑을 다시 적었다: ${path}`).not.toContain(path);
    }
  });

  it("라우트도 같은 함수를 쓴다 — 두 벌이 아니다", () => {
    expect(UPDATER).toContain("return toRegisteredProductSnapshot(res.body);");
    /* 🔴 매핑이 한 곳뿐인가. 두 번 선언되면 갈라진다. */
    expect(UPDATER.match(/function toRegisteredProductSnapshot/g)).toHaveLength(1);
  });

  it("꺼낸 매핑이 그대로 동작한다 — 읽은 것과 못 읽은 것을 가른다", () => {
    const ok = toRegisteredProductSnapshot({
      originProduct: { name: "A", salePrice: 1000, images: { optionalImages: [{}, {}] } },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.snapshot.name).toBe("A");
      expect(ok.snapshot.optionalImageCount).toBe(2);
      /* 🔴 응답에 없던 것을 null 로 메우지 않는다 — 「못 읽었다」가 남아야 한다. */
      expect(ok.snapshot.stockQuantity).toBeUndefined();
    }
    /* 원상품이 없으면 «실패» 다. 빈 기준값을 만들지 않는다. */
    expect(toRegisteredProductSnapshot({}).ok).toBe(false);
    expect(toRegisteredProductSnapshot(null).ok).toBe(false);
  });
});

describe("② 🔴 probe 는 읽기만 한다", () => {
  it.each(['method: "PUT"', 'method: "POST"', 'method: "DELETE"', "updateRegisteredProduct"])(
    "「%s」가 없다",
    (forbidden) => {
      expect(PROBE).not.toContain(forbidden);
    },
  );

  it("실제 UPDATE 는 CEO 가 화면에서 한다고 «적어 둔다»", () => {
    expect(PROBE).toContain("CEO 가");
    expect(PROBE).toContain("이 스크립트는 쓰지 않는다");
  });
});

describe("③ 🔴 상품번호를 사람이 적는다", () => {
  it("기본 상품번호가 없다", () => {
    expect(PROBE).not.toContain("DEFAULT_ORIGIN_PRODUCT_NO");
    expect(PROBE).toContain("const originProductNo = process.argv[2];");
    expect(PROBE).toContain("if (!originProductNo)");
  });

  it("두 번호가 다르다는 것을 화면에 «말한다»", () => {
    expect(PROBE).toContain("13713593585");
    expect(PROBE).toContain("13714803530");
    expect(PROBE).toContain("다른 상품");
  });
});

describe("④ 🔴 새 읽기 라우트가 같은 인증 뒤에 있다", () => {
  it("proxy 예외 목록에 smartstore 가 없다", () => {
    /* 예외는 cron·debug·auth·support 뿐이다. api/smartstore/* 는 matcher 안에
       있으므로 Seller 세션 없이는 401 이다 — 그 위에 라우트 자신의
       requireRegistrationAccess 가 한 겹 더 선다. */
    expect(PROXY).toContain("api/cron|api/debug|api/auth|api/support");
    expect(PROXY).not.toContain("api/smartstore");
  });

  it("공개 경로 목록에도 없다", () => {
    const publicPaths = PROXY.slice(PROXY.indexOf("SELLER_PUBLIC_PATHS = new Set(["), PROXY.indexOf("]);"));
    expect(publicPaths).not.toContain("smartstore");
    expect(publicPaths).not.toContain("registered-product");
  });
});
