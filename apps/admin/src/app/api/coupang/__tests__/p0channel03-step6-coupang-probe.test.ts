import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANNEL_CAPABILITY } from "../../../pipeline/commerce/channel-lifecycle";
import { editAdapterFor } from "../../../pipeline/commerce/edit-adapters";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A-2 STEP 6 — **쿠팡 조사 통로. 아직 판정하지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 다섯:
 *   ① 진단 통로는 «읽기만» 한다 — 쓰기 메서드가 한 줄도 없다.
 *   ② 토큰이 없으면 «없는 것처럼» 닫힌다(404). 「설정이 없으니 통과」가 아니다.
 *   ③ 등록 ID 축을 섞지 않는다 — 쿠팡의 그것은 `sellerProductId` 다.
 *   ④ 응답을 «가공하지 않고» 그대로 싣는다 — 우리가 읽는 칸만 보면 조사가 안 된다.
 *   ⑤ 🔴 조사가 끝나기 «전» 에는 capability 가 UNKNOWN 이고 어댑터도 없다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE = codeOnly(readFileSync(join(__dirname, "../../debug/coupang-product-get-raw/route.ts"), "utf8"));
const PROBE_RAW = readFileSync(
  join(__dirname, "../../../../../scripts/p0channel03-step6-coupang-get-probe.ts"),
  "utf8",
);
/* 🔴 주석을 걷어낸 것과 원본을 «따로» 둔다. 「쓰기가 없다」는 실행되는 코드에서
   봐야 하고(문구에는 「PATCH 는 없습니다」처럼 그 낱말이 나온다), 「무엇을 하지
   않겠다고 선언했는가」는 주석에서 봐야 한다. 한 벌로 보면 둘 중 하나가 거짓이 된다. */
const PROBE = codeOnly(PROBE_RAW);
const PROXY = codeOnly(readFileSync(join(__dirname, "../../../../proxy.ts"), "utf8"));

describe("① 🔴 진단 통로는 읽기만 한다", () => {
  it("GET 만 내보낸다", () => {
    expect(ROUTE).toContain("export async function GET(");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(ROUTE, `${method} 핸들러가 있다`).not.toContain(`export async function ${method}(`);
    }
  });

  it("쿠팡 호출도 GET 하나뿐이다", () => {
    expect(ROUTE).toContain('method: "GET"');
    expect(ROUTE.match(/method: "/g) ?? []).toHaveLength(1);
  });

  it("probe 에도 쓰기가 없다 — «호출하는» 메서드로 본다", () => {
    /* 🔴 낱말 금지로는 볼 수 없다. probe 는 「POST/PUT/PATCH/DELETE 는 없습니다」
       라고 화면에 «말하기» 때문에 그 낱말이 나온다 — 실제로 한 번 걸렸다.
       그래서 fetch 가 무엇을 하는지, method 를 지정하는지를 본다. */
    expect(PROBE).not.toMatch(/method:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/);
    expect(PROBE).not.toContain("body: JSON.stringify");
    /* fetch 는 한 번뿐이고 기본(GET)이다. */
    expect(PROBE.match(/await fetch\(/g) ?? []).toHaveLength(1);
  });
});

describe("② 🔴 토큰이 없으면 없는 것처럼 닫힌다", () => {
  it("설정이 없으면 통과시키지 «않는다»", () => {
    expect(ROUTE).toContain("if (!expected) return false;");
    expect(ROUTE).toContain('{ status: 404 }');
  });

  it("토큰을 코드에 적지 않는다 — 환경변수 이름만 있다", () => {
    expect(ROUTE).toContain("process.env.DEBUG_COUPANG_PROBE_TOKEN");
    /* 🔴 값처럼 보이는 상수가 없다. */
    expect(ROUTE).not.toMatch(/DEBUG_COUPANG_PROBE_TOKEN\s*=\s*["'`]/);
  });

  it("SmartStore 진단 통로와 «같은 방식» 이다 — 두 벌이 아니다", () => {
    const naver = codeOnly(readFileSync(join(__dirname, "../../debug/naver-product-get-raw/route.ts"), "utf8"));
    expect(naver).toContain('request.headers.get("x-debug-token")');
    expect(ROUTE).toContain('request.headers.get("x-debug-token")');
  });

  it("🔴 api/debug 는 proxy 예외다 — 그래서 세션 없이 조사할 수 있다", () => {
    /* 기존 `/api/coupang/product-status` 는 같은 GET 을 하지만 Seller 세션 뒤에
       있어서 CTO 가 쓸 수 없다. 그 라우트를 고치지 않고 통로만 하나 둔 이유다. */
    expect(PROXY).toContain("api/debug");
  });
});

describe("③ 🔴 등록 ID 축을 섞지 않는다", () => {
  it("쿠팡의 등록 ID 는 sellerProductId 다", () => {
    expect(ROUTE).toContain('searchParams.get("sellerProductId")');
    expect(ROUTE).toContain("seller-products/${encodeURIComponent(sellerProductId)}");
  });

  it("probe 가 «후보들을 나란히» 찍는다 — 하나로 단정하지 않는다", () => {
    for (const path of ["data.sellerProductId", "data.productId", "data.items.0.vendorItemId"]) {
      expect(PROBE).toContain(path);
    }
  });

  it("🔴 probe 에 기본 상품번호가 없다 — 쿠팡에는 이미 중복 3건이 있다", () => {
    expect(PROBE).toContain("if (!sellerProductId)");
    expect(PROBE).toContain("16336681622");
    expect(PROBE).not.toContain("const DEFAULT_SELLER_PRODUCT_ID");
  });
});

describe("④ 🔴 응답을 가공하지 않고 싣는다", () => {
  it("body 를 그대로 돌려준다", () => {
    expect(ROUTE).toContain("body: response.body");
    /* 🔴 골라 담으면 「우리가 읽는 칸」만 보이고 조사가 되지 않는다. */
    expect(ROUTE).not.toContain("displayCategoryCode");
  });

  it("probe 는 값이 아니라 «모양» 을 찍는다", () => {
    expect(PROBE).toContain("function describeShape");
    expect(PROBE).toContain("배열(");
    expect(PROBE).toContain("객체(키 ");
  });

  it("probe 가 Core 중립 통화의 여덟 칸을 «찾아본다»", () => {
    for (const field of ["상품명", "판매가격", "재고", "상세설명", "이미지", "옵션", "상품정보제공고시", "카테고리"]) {
      expect(PROBE).toContain(field);
    }
  });
});

describe("⑤ 🔴 조사 전에는 판정하지 않는다", () => {
  it("쿠팡 capability 는 여전히 UNKNOWN 이다", () => {
    expect(CHANNEL_CAPABILITY.coupang.update).toBe("UNKNOWN");
    /* 🔴 카테고리는 공식 가이드가 「수정 불가」로 명시한 «확인된» 사실이다. */
    expect(CHANNEL_CAPABILITY.coupang.categoryUpdate).toBe("NOT_SUPPORTED");
  });

  it("쿠팡 수정 어댑터는 «아직 없다»", () => {
    expect(editAdapterFor("coupang")).toBeUndefined();
  });

  it("🔴 probe 가 capability 를 «정하지 않는다» 고 스스로 적는다", () => {
    expect(PROBE_RAW).toContain("「칸이 있다」는 「고칠 수 있다」가 아니다");
    expect(PROBE_RAW).toContain("EDITABLE 로 올리지 않는다");
  });

  it("🔴 수정 API 조사는 이 스크립트로 하지 않는다고 적는다", () => {
    expect(PROBE_RAW).toContain("쓰기는 한 줄도 넣지 않는다");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⑥ STEP 6-6 — **조사 결과를 «문서로» 고정한다. capability 는 그대로다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 문서 근거가 늘었다고 capability 를 올리지 않는다. 이 블록이 지키는 것은
 * 「무엇을 알아냈는지」와 「무엇을 아직 모르는지」가 코드·문서에 남아 있는가다 —
 * 다음 사람이 「조사 끝났으니 EDITABLE」로 읽지 않게.
 */
describe("⑥ 🔴 STEP 6-6 조사 결과가 남아 있다 — 그리고 판정은 그대로다", () => {
  const SURVEY = readFileSync(
    join(__dirname, "../../../../../../../docs/p0-channel-03-step6-coupang-update-survey.md"),
    "utf8",
  );
  const CAPABILITY = readFileSync(join(__dirname, "../../../pipeline/commerce/channel-lifecycle.ts"), "utf8");

  it("등록 ID 축이 «불변인 것» 으로 확정돼 기록됐다", () => {
    expect(SURVEY).toContain("sellerProductId");
    /* 🔴 productId 는 묶음/해제로 바뀌므로 키로 쓰면 안 된다 — 그 사실이 남아야 한다. */
    expect(SURVEY).toContain("`productId` 를 키로 쓰면 안 된다");
    expect(SURVEY).toContain("vendorItemId");
  });

  it("🔴 가격·재고가 «다른 ID 축» 이라는 사실이 기록됐다", () => {
    expect(SURVEY).toContain("vendorItemId` 로 한다");
    expect(SURVEY).toContain("저장하고 있지 않다");
  });

  it("전체 수정이 「GET JSON 전문 되보내기」라는 것이 기록됐다", () => {
    expect(SURVEY).toContain("전체\n> JSON 전문을 전송");
    /* 🔴 그것이 F-14-7 규칙과 같은 모양이라는 발견도 남긴다. */
    expect(SURVEY).toContain("F-14-7");
  });

  it("🔴 «모르는 것» 이 목록으로 남아 있다", () => {
    for (const unknown of [
      "GET 응답의 실제 모양",
      "승인 대기 중 상품",
      "sellerProductId` 가 유지되는가",
    ]) {
      expect(SURVEY, `모르는 것이 빠졌다: ${unknown}`).toContain(unknown);
    }
  });

  it("🔴 우리 코드가 PUT 을 «보낼 수 없다» 는 사실이 기록됐다", () => {
    expect(SURVEY).toContain("타입 수준에서");
    expect(CAPABILITY).toContain("PUT 을 «보낼 수 없다»");
  });

  it("🔴 capability 표는 값을 올리지 않고 «이유» 만 갱신했다", () => {
    expect(CHANNEL_CAPABILITY.coupang.update).toBe("UNKNOWN");
    expect(CAPABILITY).toContain("문서 근거 확보 · 실측 대기");
    expect(CAPABILITY).toContain("문서가 늘었다고 올리지");
  });

  it("등록 축의 위험(2026-02-02 API 변경)도 같이 남겼다", () => {
    expect(SURVEY).toContain("2026년 2월 2일 시행");
    expect(SURVEY).toContain("이 조사의\n범위가 아니다");
  });
});
