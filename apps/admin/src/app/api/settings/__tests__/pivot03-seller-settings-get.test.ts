import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 Phase 0-4+2-A — 판매자 공통 설정의 canonical 읽기 창구
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 서버 경로(등록·미리보기·게이트)는 Phase 1 에서 seller_settings 로 옮겼는데
 * 화면 네 곳은 아직 `/api/settings/coupang/profiles` 에서 다섯 칸을 꺼내 쓴다.
 * 그 라우트는 «배송 프로필 목록» 이라 프로필마다 한 벌씩 준다 — 화면은 여전히
 * 「이 프로필의 판매자 정보」를 보고 있다는 뜻이다.
 *
 * 이 파일은 그 자리를 대신할 GET 의 계약을 고정한다.
 *
 * ── 🔴 지키는 것 ──────────────────────────────────────────────────────────
 * ① 판정을 «여기서 다시 하지 않는다». loadSellerSettings() 가 준 값을 그대로
 *    내보낸다. 한 줄이라도 다시 판정하면 「화면이 말하는 값」과 「등록에 나가는
 *    값」이 갈릴 자리가 하나 더 생긴다.
 * ② values 는 정확히 다섯 칸이다. source 가 섞여 들어가면 화면이 그것을
 *    설정값처럼 그린다.
 * ③ 이번 단계는 «읽기» 뿐이다. PUT 이 같이 들어오면 화면이 아직 레거시를 읽는
 *    동안 「저장한 값과 보이는 값」이 갈라진다.
 */

const mocks = vi.hoisted(() => ({ loadSellerSettings: vi.fn() }));
vi.mock("@/lib/seller-settings", () => ({ loadSellerSettings: mocks.loadSellerSettings }));

const { GET } = await import("../seller-settings/route");
const SOURCE = readFileSync(join(__dirname, "../seller-settings/route.ts"), "utf8");

const FIVE = {
  manufacturer: "규하맘샵",
  asContactNumber: "해외 구매대행으로 A/S 불가",
  qualityGuarantee: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
  kcExemptionText: "KC인증 어린이제품 공급자적합성확인",
  defaultCountryOfOrigin: "상세설명 참조",
};

const call = async () => (await GET()).json();

beforeEach(() => mocks.loadSellerSettings.mockReset());

describe("① resolver 가 준 값을 그대로 내보낸다", () => {
  it("다섯 칸이 한 글자도 바뀌지 않는다", async () => {
    mocks.loadSellerSettings.mockResolvedValue({ ...FIVE, source: "SELLER_SETTINGS" });
    expect(await call()).toEqual({ ok: true, values: FIVE, source: "SELLER_SETTINGS" });
  });

  it("🔴 값을 «만들지» 않는다 — 비어 있으면 비어 있다고 말한다", async () => {
    // 제조사 미입력은 쿠팡 등록의 1위 블로커였다. 여기서 빈 값을 그럴듯한
    // 것으로 채우면 그 경고가 조용히 사라진다.
    const empty = {
      manufacturer: null,
      asContactNumber: null,
      qualityGuarantee: null,
      kcExemptionText: null,
      defaultCountryOfOrigin: null,
    };
    mocks.loadSellerSettings.mockResolvedValue({ ...empty, source: "NONE" });
    expect(await call()).toEqual({ ok: true, values: empty, source: "NONE" });
  });

  it("🔴 일부만 있는 실측 모양도 그대로 — manufacturer 만 null", async () => {
    const real = { ...FIVE, manufacturer: null };
    mocks.loadSellerSettings.mockResolvedValue({ ...real, source: "SELLER_SETTINGS" });
    const body = await call();
    expect(body.values).toEqual(real);
    expect(body.values.manufacturer).toBeNull();
  });

  it("resolver 를 «한 번만» 부른다", async () => {
    mocks.loadSellerSettings.mockResolvedValue({ ...FIVE, source: "SELLER_SETTINGS" });
    await call();
    expect(mocks.loadSellerSettings).toHaveBeenCalledTimes(1);
  });

  it("🔴 인자를 넘기지 않는다 — 고르는 규칙은 resolver 안에 있다", async () => {
    // workspace/scope 축을 라우트가 임의로 고르기 시작하면 등록 경로와 화면이
    // 서로 다른 행을 볼 수 있다.
    mocks.loadSellerSettings.mockResolvedValue({ ...FIVE, source: "SELLER_SETTINGS" });
    await call();
    expect(mocks.loadSellerSettings).toHaveBeenCalledWith();
  });
});

describe("② values 는 정확히 다섯 칸이다", () => {
  it("🔴 source 가 values 안으로 새지 않는다", async () => {
    mocks.loadSellerSettings.mockResolvedValue({ ...FIVE, source: "LEGACY_PROFILE" });
    const body = await call();
    expect(Object.keys(body.values).sort()).toEqual([
      "asContactNumber",
      "defaultCountryOfOrigin",
      "kcExemptionText",
      "manufacturer",
      "qualityGuarantee",
    ]);
    expect(body.values).not.toHaveProperty("source");
  });

  it("배송·가격 값이 섞여 오면 그대로 새어 나간다 — 그 사실을 드러내 둔다", async () => {
    /* resolver 가 다섯 칸만 준다는 계약이 깨지면 이 라우트도 같이 깨져야
       한다. 여기서 화이트리스트로 걸러 «조용히 정상처럼» 보이게 하면, 계약이
       깨진 것을 아무도 모른 채 화면만 멀쩡해진다. */
    mocks.loadSellerSettings.mockResolvedValue({ ...FIVE, deliveryCharge: 3000, source: "SELLER_SETTINGS" });
    expect(await call()).toHaveProperty("values.deliveryCharge", 3000);
  });
});

describe("③ source 는 돌려주되 값이 아니다", () => {
  it.each(["SELLER_SETTINGS", "LEGACY_PROFILE", "NONE"])("%s 를 그대로 전한다", async (source) => {
    mocks.loadSellerSettings.mockResolvedValue({ ...FIVE, source });
    expect(await call()).toHaveProperty("source", source);
  });

  it("🔴 LEGACY_PROFILE 이 계속 나오면 임시 호환층을 못 뗀다는 신호다", async () => {
    // 이 값이 화면에 뜨면 안 된다(셀러에게는 아무 의미 없는 말이다).
    // 우리에게는 ⑨ 판단 근거다 — 그래서 응답에는 싣고 주석에 이유를 적는다.
    mocks.loadSellerSettings.mockResolvedValue({ ...FIVE, source: "LEGACY_PROFILE" });
    expect(await call()).toHaveProperty("source", "LEGACY_PROFILE");
    expect(SOURCE).toContain("화면에 «띄우지 않는다»");
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만 남긴다.
 *
 * 🔴 이 라우트의 주석에는 「여기서는 coupang_seller_profiles 에 쓰지 않는다」
 * 처럼 «하지 않는 일» 이 적혀 있다. 그건 지워야 할 글이 아니라 남겨야 할
 * 글이다 — 이름이 파일에 없는지가 아니라 코드가 그것을 부르는지를 본다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("④ 이 라우트가 여는 문", () => {
  /* 🔴 A 에서는 여기가 「PUT 을 내보내지 않는다」였다. C(0-4+2)에서 CEO 지시로
     canonical PUT 이 추가되면서 그 단언이 «의도적으로» 깨졌다 — 약화가 아니라
     계약이 바뀐 것이다.

     대신 더 조인다: 이 창구가 여는 문은 «정확히 둘» 이고, 나머지는 여전히
     닫혀 있어야 한다. 특히 POST 가 열리면 「판매자 설정을 여러 개 만든다」는
     뜻이 되어 셀러당 하나라는 전제가 무너지고, DELETE 는 되돌릴 수 없다. */
  it("🔴 GET 과 PUT «만» 있다", () => {
    const methods = (codeOnly(SOURCE).match(/export async function (\w+)/g) ?? [])
      .map((m) => m.replace("export async function ", ""))
      .sort();
    expect(methods).toEqual(["GET", "PUT"]);
  });

  it.each(["POST", "PATCH", "DELETE"])("🔴 %s 는 열지 않는다", (method) => {
    expect(codeOnly(SOURCE)).not.toContain(`export async function ${method}`);
  });

  it("🔴 라우트가 스스로 DB 를 부르지 않는다 — lib 함수만 쓴다", () => {
    // 표 이름과 질의가 라우트로 새어 나오면 「값을 찾는 규칙」이 두 곳에 산다.
    const code = codeOnly(SOURCE);
    expect(code).not.toContain("getSupabaseAdmin");
    expect(code).not.toContain("coupang_seller_profiles");
    expect(code).not.toContain('from("seller_settings")');
  });

  it("profile id 를 받지 않는다 — 판매자 정보는 프로필에 속하지 않는다", () => {
    expect(SOURCE).not.toContain("profileId");
    expect(SOURCE).not.toContain("params");
  });
});
