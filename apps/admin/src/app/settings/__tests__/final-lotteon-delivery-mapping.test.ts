import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * FINAL-3COMMERCE — **끊어진 연결을 «잇는» 화면**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 캡처가 드러낸 단절:
 *
 *     [설정]→[배송 프로필]  Hessen · 우체국택배 · 반품주소지   ← 값이 있다
 *                              🔴 연결 없음
 *     [롯데ON]→[배송]       전부 「선택 안 함」
 *
 * `lotteon_seller_settings` 표도 PUT 라우트도 067 컬럼도 있는데 **값을 넣는
 * 화면만 없었다.** 그래서 내가 넣은 「설정값이 있으면 숨긴다」 조건이 «한 번도
 * 참이 된 적이 없다» — 증상을 숨긴 것도 아니고 아무 일도 하지 않았다.
 */

const DIR = join(__dirname, "..");
const MAPPING = readFileSync(join(DIR, "LotteOnDeliveryMapping.tsx"), "utf8").replace(/\r\n/g, "\n");
const SETTINGS = readFileSync(join(DIR, "page.tsx"), "utf8").replace(/\r\n/g, "\n");
/** 주석이 옛 구조를 인용하므로 코드만 본다(이 스프린트에서 다섯 번 걸린 함정). */
const code = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("① 저장 경로가 «생겼다»", () => {
  it("여섯 값을 모두 고를 수 있다", () => {
    for (const field of [
      "outboundPlaceNo",
      "returnPlaceNo",
      "deliveryCostPolicyNo",
      "deliveryRegionGroupCode",
      "courierCode",
      "returnCourierCode",
    ]) {
      expect(MAPPING, field).toContain(field);
    }
  });

  it("PUT 으로 저장한다 — 비어 있던 그 라우트를 «부른다»", () => {
    expect(MAPPING).toContain('fetch("/api/settings/lotteon-seller"');
    expect(MAPPING).toContain('method: "PUT"');
  });

  /* 🔴 고르는 즉시 저장한다. 「저장」을 따로 누르게 하면 셀러는 골라 놓고 나가고
     다음에 와서 또 고른다 — 이 화면이 없애려던 반복이 그대로 남는다. */
  it("고르는 즉시 저장한다", () => {
    expect(MAPPING).toContain("const pick = useCallback(");
    expect(MAPPING).not.toContain("저장하기");
  });

  it("목록은 롯데ON 이 준 것을 쓴다", () => {
    expect(MAPPING).toContain('fetch("/api/lotteon/delivery-settings"');
  });
});

describe("② 🔴 이름으로 «자동 매칭하지 않는다»", () => {
  /* 쿠팡 Wing 의 Hessen(24496935)과 롯데ON PLO3837441 은 다른 채널이 발급한
     번호다. 틀리면 물건이 엉뚱한 곳에서 나간다 — 셀러가 선언한다. */
  it("배송 프로필 값으로 후보를 «자동 선택» 하지 않는다", () => {
    const c = code(MAPPING);
    expect(c).not.toMatch(/find\([^)]*name\s*===\s*profile/i);
    expect(c).not.toContain("autoMatch");
    expect(c).not.toContain("guess");
  });

  it("그 이유가 화면 문구로 셀러에게 설명된다", () => {
    expect(MAPPING).toContain("자동으로 잇지 않습니다");
  });
});

describe("③ 🔴 코드를 화면에 보여주지 않는다", () => {
  it("고른 결과는 «이름» 으로 표시된다", () => {
    expect(MAPPING).toContain("savedLabel");
    expect(MAPPING).toContain("✓ 연결됨");
  });

  it("번호를 직접 적는 칸이 없다", () => {
    const c = code(MAPPING);
    expect(c).not.toContain("코드 직접 입력");
    expect(c).not.toMatch(/<input[^>]*type="text"/);
  });
});

describe("④ 자리가 «배송 프로필 안» 이다", () => {
  /* 🔴 별도 탭을 만들면 ㉢(2026-09-22)가 「중복」이라며 지운 구조가 되살아난다. */
  it("배송 프로필 탭에서 그려진다", () => {
    const at = SETTINGS.indexOf('activeTab === "shipping"');
    expect(at).toBeGreaterThan(-1);
    /* 🔴 STEP 3(2026-09-28) — 여기에 `commonCarrier` prop 이 붙었다. 공통 택배사를
       넘겨서 이름이 정확히 같을 때만 롯데ON 코드로 잇는다(못 찾으면 「확인 필요」).
       이 검사의 주장은 «자리» 이므로 태그 이름으로 본다 — 자동 닫는 형태를
       요구하면 prop 이 하나 붙을 때마다 깨진다. */
    expect(SETTINGS.slice(at, at + 1400)).toContain("<LotteOnDeliveryMapping");
  });

  it("새 탭을 만들지 않았다", () => {
    expect(code(SETTINGS)).not.toContain('label: "롯데ON 배송"');
  });
});

describe("⑤ 🔴 조회 실패를 «목록 0건» 으로 바꿔 말하지 않는다", () => {
  /* 화면이 「고를 것이 없다」고 하면 셀러는 롯데ON 에 값이 없는 줄 알지만
     사실은 조회가 닿지 않은 것이다. 다시 불러오기를 준다. */
  it("실패를 실패라고 말하고 재시도를 준다", () => {
    expect(MAPPING).toContain("불러오지 못했습니다");
    expect(MAPPING).toContain("다시 불러오기");
  });
});
