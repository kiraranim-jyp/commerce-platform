import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 0-4+2-C — 판매자 정보가 배송 프로필에서 떨어져 나온다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 여기까지 온 길 ────────────────────────────────────────────────────────
 * A: canonical GET 을 열었다.  B: 화면 셋이 그것을 읽게 했다.
 * C: 이제 «쓰기» 와 «폼 상태» 가 프로필에서 떨어진다.
 *
 * A·B 는 「같은 값을 다른 곳에서 읽기」라 화면이 안 변하는 것이 성공이었다.
 * C 는 다르다 — 화면의 «의미» 가 바뀐다.
 *
 *     전   프로필 A ─ 판매자 정보 A      프로필을 바꿔 고르면 판매자 정보도 바뀌고
 *          프로필 B ─ 판매자 정보 B      새 프로필을 만들면 빈 채로 생겼다
 *
 *     후   셀러 ─ 판매자 정보 하나        어느 프로필을 보고 있든 같은 값
 *          프로필 A·B·C ─ 배송값만
 *
 * ── 🔴 이 파일이 지키는 것 ────────────────────────────────────────────────
 * ① 다섯 칸이 프로필 폼(fillForm/resetForm)에 «다시 묶이지» 않는다.
 * ② 배송·가격·상세페이지 스물세 칸은 한 줄도 안 움직였다.
 * ③ 저장이 프로필 id 없이 된다.
 * ④ 부분 업데이트 의미(키 없음 / "" / 값)가 기존과 같다.
 * ⑤ 이번에 «넘지 않은 선» — 060 dual-write 와 R6 호환층은 그대로다.
 */

const PAGE = readFileSync(join(__dirname, "../page.tsx"), "utf8");
const ROUTE = readFileSync(join(__dirname, "../../api/settings/seller-settings/route.ts"), "utf8");
const LIB = readFileSync(join(__dirname, "../../../lib/seller-settings.ts"), "utf8");

const FIVE = ["Manufacturer", "AsContactNumber", "QualityGuarantee", "KcExemptionText", "DefaultCountryOfOrigin"];

/** 배송 프로필 폼 함수의 본문만 떼어 본다.
 *
 * 🔴 파일 전체를 보면 안 된다. 이 파일에는 BrandProfileSection 이 함께 있고
 * 거기에도 `manufacturer` 가 있다 — «브랜드별» 제조사라 완전히 다른 값이다.
 * 이름이 같다고 같이 옮기면 브랜드 관리가 망가진다. */
/** 주석을 걷어낸 «실행되는 코드» 만 남긴다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function bodyOf(name: string): string {
  const start = PAGE.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  return PAGE.slice(start, PAGE.indexOf("\n  }", start));
}

describe("① 다섯 칸이 프로필 폼에 묶여 있지 않다", () => {
  it.each(FIVE)("fillForm 이 %s 를 프로필 값으로 덮지 않는다", (field) => {
    // 덮으면 프로필을 바꿔 고를 때마다 판매자 정보가 따라 바뀐다.
    expect(bodyOf("fillForm")).not.toContain(`set${field}(`);
  });

  it.each(FIVE)("resetForm 이 %s 를 비우지 않는다", (field) => {
    // 🔴 「새 프로필 만들기」가 셀러의 제조사를 지우던 자리다. PIVOT-03 의
    //    출발점이 정확히 이 증상이었다.
    expect(bodyOf("resetForm")).not.toContain(`set${field}(`);
  });

  it("canonical 창구에서 따로 읽는다", () => {
    expect(PAGE).toContain('fetch("/api/settings/seller-settings")');
  });

  it("🔴 그 조회가 프로필 변경에 딸려 돌지 않는다", () => {
    /* 의존성이 비어 있어야 한다. profiles 를 의존성에 넣으면 프로필을 바꿔
       고를 때마다 다시 읽고, 편집 중이던 입력이 날아간다. */
    const effect = PAGE.slice(PAGE.indexOf('fetch("/api/settings/seller-settings")'));
    expect(effect.slice(0, 1400)).toContain("}, []);");
  });

  it("🔴 null 을 빈 문자열로 맞춘다 — controlled input 이 풀리지 않게", () => {
    // canonical 은 값이 없으면 null 을 준다. 그대로 넣으면 React 가 그 칸을
    // uncontrolled 로 바꾼다.
    expect(PAGE).toContain('setManufacturer(v.manufacturer ?? "")');
  });
});

describe("② 배송·가격·상세페이지는 한 줄도 안 움직였다", () => {
  const KEPT = [
    ["택배사", "setDeliveryCompanyCode"],
    ["반품지 코드", "setReturnCenterCode"],
    ["반품지 연락처", "setCompanyContactNumber"],
    ["반품지 주소", "setReturnAddress"],
    ["출고지", "setOutboundShippingPlaceCode"],
    ["배송비", "setDeliveryCharge"],
    ["출고 소요일", "setOutboundLeadTimeDays"],
    ["기본 마진", "setDefaultMarginPercent"],
    ["반올림 단위", "setPriceRoundingUnit"],
    ["상단 공통이미지", "setTopCommonImageUrl"],
  ] as const;

  it.each(KEPT)("fillForm 이 %s 를 계속 채운다", (_label, setter) => {
    expect(bodyOf("fillForm")).toContain(`${setter}(`);
  });

  it.each(KEPT)("resetForm 이 %s 를 계속 초기화한다", (_label, setter) => {
    expect(bodyOf("resetForm")).toContain(`${setter}(`);
  });

  it("🔴 배송 프로필의 기본 프로필 선택은 그대로다", () => {
    // 「기본 배송 프로필」은 여전히 옳은 개념이다. 여러 개 중 하나를 쓴다.
    expect(PAGE).toContain("profiles.find((p) => p.isDefault) ?? profiles[0]");
  });

  it("🔴 배송 프로필 «목록» 이 제조자를 말하지 않는다", () => {
    /* 실측에서 놓쳤던 자리다(2026-09-23, CEO 화면 확인). 목록 줄이 프로필마다
       p.manufacturer 를 찍고 있어서 화면이 이렇게 말했다.

           기본 … 제조자(수입자) 규하맘샵   ← 레거시 컬럼에 남은 값
           기본 … 제조자(수입자) -          ← 같은 셀러인데 「없다」
           기본 … 제조자(수입자) -

       셀러당 하나인 값을 프로필마다 다르게 보여준 것이다. D 에서 레거시
       write 를 끊으면 첫 줄도 낡은 값이 된다. 제조자는 「판매자 정보」 탭
       한 곳에서만 말한다.

       🔴 목록 요약 줄에 한정해 본다 — 같은 파일의 브랜드 프로필 목록에도
       「제조자」가 있는데 그건 브랜드별 값이라 그대로 두어야 한다. */
    const list = PAGE.slice(PAGE.indexOf("택배사 {COURIER_OPTIONS"), PAGE.indexOf("기본으로 설정"));
    expect(list).not.toContain("p.manufacturer");
    // 배송값은 그 줄에 그대로 남아 있다 — 그건 프로필마다 다른 것이 맞다.
    expect(list).toContain("p.deliveryCharge");
    expect(list).toContain("p.returnDeliveryCharge");
  });

  it("🔴 브랜드 프로필의 제조사는 건드리지 않았다 — 다른 값이다", () => {
    // 브랜드별 제조사(BrandProfileSection)는 판매자 공통 제조사와 무관하다.
    expect(PAGE).toContain("editingId ? `/api/settings/coupang/brand-profiles/${editingId}`");
    expect(bodyOf("BrandProfileSection")).toContain("useState");
  });
});

describe("③ 저장이 프로필을 모른다", () => {
  it("판매자 정보 탭이 전용 저장 함수를 쓴다", () => {
    expect(PAGE).toContain("onSave={handleSaveSellerSettings}");
  });

  it("그 함수가 canonical 창구로 PUT 한다", () => {
    const fn = bodyOf("handleSaveSellerSettings");
    expect(fn).toContain('method: "PUT"');
    expect(fn).toContain('fetch("/api/settings/seller-settings"');
  });

  it("🔴 profile id 를 쓰지 않는다 — 프로필이 0개여도 저장돼야 한다", () => {
    const fn = bodyOf("handleSaveSellerSettings");
    expect(fn).not.toContain("editingId");
    expect(fn).not.toContain("profiles");
  });

  it("🔴 라우트도 profile id 를 받지 않는다", () => {
    expect(ROUTE).not.toContain("profileId");
    expect(ROUTE).not.toContain("params");
  });

  it("저장 버튼 문구가 이 탭의 말이다", () => {
    // 「프로필 저장」/「수정 저장」은 판매자 정보에 해당하지 않는 말이었다.
    expect(PAGE).toContain('"판매자 정보 저장"');
  });

  it("🔴 실패를 조용히 넘기지 않는다", () => {
    // 이번 작업의 취지가 「저장했다고 보이는데 안 저장됨」을 없애는 것이다.
    expect(bodyOf("handleSaveSellerSettings")).toContain("setSellerSaveMessage({ ok: false");
  });

  it("저장 결과로 화면을 되맞춘다 — 보낸 값을 그대로 믿지 않는다", () => {
    // 빈 칸으로 보낸 것은 null 이 되어 돌아온다. 그게 실제로 저장된 모습이다.
    expect(bodyOf("handleSaveSellerSettings")).toContain("data.values");
    expect(ROUTE).toContain("await loadSellerSettings()");
  });
});

describe("④ 신규 프로필 생성이 판매자 정보를 복제하지 않는다", () => {
  it("🔴 프로필 저장 body 에 다섯 칸이 없다", () => {
    /* PATCH 와 POST 가 같은 body 를 쓰므로 이 한 곳으로 둘 다 닫힌다.
       toRowFields 는 손대지 않았다 — 키가 안 오면 건드리지 않는 기존
       동작(`!== undefined`)이 그대로 일을 한다. */
    const body = PAGE.slice(PAGE.indexOf("const body = {"), PAGE.indexOf("editingId ? `/api/settings/coupang/profiles/"));
    for (const key of ["manufacturer", "asContactNumber", "qualityGuarantee", "kcExemptionText", "defaultCountryOfOrigin"]) {
      expect(body).not.toContain(`${key}:`);
    }
  });

  it("배송·가격·상세 값은 그 body 에 그대로 있다", () => {
    const body = PAGE.slice(PAGE.indexOf("const body = {"), PAGE.indexOf("editingId ? `/api/settings/coupang/profiles/"));
    for (const key of ["deliveryCompanyCode", "returnCenterCode", "deliveryCharge", "priceRoundingUnit", "defaultDetailBlocks"]) {
      expect(body).toContain(`${key}`);
    }
  });
});

describe("⑤ STOP① 배너 — 지우지 않고 자리를 가렸다", () => {
  it("🔴 판매자 정보 탭에서는 안 뜬다", () => {
    /* 배너는 「기본 아닌 프로필에 저장하면 등록에 반영되지 않는다」고 말한다.
       판매자 정보는 이제 canonical 로 가므로 어느 프로필을 보고 있든 반영된다
       — 그 탭에서는 거짓말이다. */
    expect(PAGE).toContain('activeTab !== "seller" && profiles.length > 1 && editingProfile');
  });

  it("다른 탭에서는 문구가 그대로다 — 배송·가격에는 여전히 참이다", () => {
    expect(PAGE).toContain("기본 아님 — 여기 저장해도 등록에는 반영되지 않습니다");
  });
});

describe("⑥ 이번에 넘지 않은 선", () => {
  it("🔴 dual-write 가 D 에서 «사라졌다» — 코드 호출 0건", () => {
    /* C 시점에는 이 검사가 「060 이 그대로 살아 있다」였다. C 배포 중에 기존
       편집기의 레거시 경로가 갑자기 끊기면 안 됐기 때문이다. D 에서 그 경로를
       닫았으므로 검사의 방향이 뒤집힌다.

       🔴 주석은 걷어내고 본다. 이 파일들에는 「여기 있던 dual-write 가
       사라졌다」는 설명이 남아 있고, 그건 지워야 할 글이 아니다 — 사라져야
       하는 것은 실행되는 코드다. 이 구분을 안 하면 주석 하나 때문에 검사가
       «거짓으로 통과»한다(실제로 그랬다). */
    expect(codeOnly(LIB)).not.toContain("save_seller_settings_dual");
    expect(codeOnly(LIB)).not.toContain("saveSellerSettingsDual");
    const route = readFileSync(join(__dirname, "../../api/settings/coupang/profiles/[id]/route.ts"), "utf8");
    expect(codeOnly(route)).not.toContain("saveSellerSettingsDual");
  });

  it("🔴 그래도 DB 함수는 아직 있다 — DROP 은 별도 단계다", () => {
    // 되돌릴 수 없는 일을 코드 제거와 같은 배포에 묶지 않는다. E 실측 뒤 F.
    expect(LIB).toContain("DROP 은 별도 migration");
  });

  it("🔴 canonical writer 는 레거시 표에 쓰지 않는다", () => {
    // D 이후 이것이 다섯 칸의 «유일한» writer 다.
    const fn = codeOnly(LIB.slice(LIB.indexOf("export async function saveSellerSettings(")));
    expect(fn).not.toContain("coupang_seller_profiles");
    expect(fn).not.toContain(".rpc(");
    expect(fn).toContain('from("seller_settings")');
  });

  it("🔴 배송 프로필 «계약» 이 다섯 칸을 받지 않는다 — D-2", () => {
    /* C 는 「화면이 안 보낸다」였다. 그것만으로는 누군가 body 에 다시 넣는
       순간 되살아난다. D-2 에서 입력 타입과 컬럼 변환을 함께 없애 «넣을 수
       없게» 만들었다.

       🔴 SellerProfileRow · toProfile 은 그대로 둔다 — 임시 호환층
       (loadFromLegacyProfile)이 아직 그 컬럼을 «읽는다». 읽기를 먼저 끊고,
       그다음에 컬럼을 없앤다. */
    const lib = readFileSync(join(__dirname, "../../api/coupang/_lib/seller-profile.ts"), "utf8");
    const input = lib.slice(lib.indexOf("export interface SellerProfileInput"), lib.indexOf("function toRowFields"));
    for (const key of ["manufacturer?", "asContactNumber?", "qualityGuarantee?", "kcExemptionText?", "defaultCountryOfOrigin?"]) {
      expect(codeOnly(input)).not.toContain(key);
    }

    const rowFields = codeOnly(lib.slice(lib.indexOf("function toRowFields"), lib.indexOf("export async function createSellerProfile")));
    for (const column of ["row.manufacturer", "row.as_contact_number", "row.quality_guarantee", "row.kc_exemption_text", "row.default_country_of_origin"]) {
      expect(rowFields).not.toContain(column);
    }

    // 배송·가격·상세 스물세 칸은 그대로다.
    for (const column of ["row.delivery_company_code", "row.return_center_code", "row.delivery_charge", "row.price_rounding_unit", "row.default_detail_blocks"]) {
      expect(rowFields).toContain(column);
    }
  });

  it("🔴 R6 호환층이 그대로다 — 제거는 별도 단계다", () => {
    expect(LIB).toContain("loadFromLegacyProfile");
  });

  it("🔴 fail-safe 재설계를 끼워 넣지 않았다", () => {
    // 조회 실패와 값 없음을 가르는 것은 ⑤ 의 일이다. C 는 cardinality 분리다.
    expect(LIB).not.toContain("QUERY_FAILED");
  });
});

describe("⑦ 저장의 부분 업데이트 의미", () => {
  const mocks = vi.hoisted(() => ({ from: vi.fn(), getSupabaseAdmin: vi.fn() }));
  vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

  /** update(...).is(...).eq(...).select(...) 사슬을 흉내 내고 실제로 넘어간
   *  칸을 잡아 둔다. 저장이 «무엇을 건드렸는가» 가 이 단계의 핵심이다. */
  function stubSupabase() {
    const captured: { row?: Record<string, unknown> } = {};
    const chain = {
      update(row: Record<string, unknown>) {
        captured.row = row;
        return chain;
      },
      is: () => chain,
      eq: () => chain,
      select: () => Promise.resolve({ data: [{ id: "x" }], error: null }),
    };
    mocks.getSupabaseAdmin.mockReturnValue({ from: () => chain });
    return captured;
  }

  beforeEach(() => mocks.getSupabaseAdmin.mockReset());

  it("키가 온 칸만 UPDATE 에 실린다", async () => {
    const captured = stubSupabase();
    const { saveSellerSettings } = await import("../../../lib/seller-settings");
    await saveSellerSettings({ manufacturer: "규하맘샵" });
    expect(Object.keys(captured.row ?? {}).sort()).toEqual(["manufacturer", "updated_at"]);
  });

  it('🔴 "" 는 지움(null)이다 — 화면에서 비운 칸', async () => {
    const captured = stubSupabase();
    const { saveSellerSettings } = await import("../../../lib/seller-settings");
    await saveSellerSettings({ qualityGuarantee: "" });
    expect(captured.row?.quality_guarantee).toBeNull();
  });

  it("🔴 안 온 칸은 UPDATE 에 아예 없다 — 다른 칸이 지워지지 않는다", async () => {
    const captured = stubSupabase();
    const { saveSellerSettings } = await import("../../../lib/seller-settings");
    await saveSellerSettings({ manufacturer: "규하맘샵" });
    expect(captured.row).not.toHaveProperty("as_contact_number");
    expect(captured.row).not.toHaveProperty("kc_exemption_text");
  });

  it("다섯 칸 전부를 보내면 다섯 칸이 실린다", async () => {
    const captured = stubSupabase();
    const { saveSellerSettings } = await import("../../../lib/seller-settings");
    await saveSellerSettings({
      manufacturer: "M",
      asContactNumber: "A",
      qualityGuarantee: "Q",
      kcExemptionText: "K",
      defaultCountryOfOrigin: "C",
    });
    expect(Object.keys(captured.row ?? {}).sort()).toEqual([
      "as_contact_number",
      "default_country_of_origin",
      "kc_exemption_text",
      "manufacturer",
      "quality_guarantee",
      "updated_at",
    ]);
  });

  it("빈 요청은 아무것도 건드리지 않는다 — updated_at 도 안 흔든다", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    const { saveSellerSettings } = await import("../../../lib/seller-settings");
    // 저장소를 아예 안 부르고 성공으로 끝난다(연결 실패 오류가 나오지 않는다).
    expect(await saveSellerSettings({})).toEqual({ ok: true });
  });
});
