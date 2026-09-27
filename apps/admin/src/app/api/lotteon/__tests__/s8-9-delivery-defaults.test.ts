import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-8/9 — **배송 기본값은 판매자 설정에서 «한 번» 정한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 정책 결정(2026-09-26):
 *   「해외직구 상품이므로 상품마다 별도 배송비 정책을 선택할 필요 없음.
 *    판매자 설정에서 하나의 기본 정책을 관리하고 상품 등록 시 자동 적용한다.」
 *
 * 🔴 이 결정이 Commerce-6 C-2 의 STOP 을 풀었다. 그때 막힌 이유 셋 중 ③
 * (workspace 축이 없어 넣으면 C-1b/C-1c 가 없앤 공유가 되살아난다)이 «정책»
 * 문제였고, ①(쓰는 화면이 중복으로 지워졌다)은 이 결정으로 뒤집혔다.
 *
 * E2E 가 그 반복 비용을 숫자로 보여줬다 — 상품 하나를 다 채워도 롯데ON 에
 * SELLER_PLACE_REQUIRED 네 값이 남아 상품마다 다시 골라야 했다.
 */

const LIB = join(__dirname, "..", "_lib");
const read = (rel: string) => readFileSync(join(LIB, rel), "utf8").replace(/\r\n/g, "\n");
const SETTINGS = read("seller-settings.ts");
const CONTEXT = read("build-context.ts");
const MIGRATION = readFileSync(
  join(__dirname, "..", "..", "..", "..", "..", "..", "..", "packages", "database", "prisma", "migrations_manual", "067_lotteon_seller_settings_workspace_and_courier.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("① 택배사 두 값이 설정에 «자리» 를 갖는다", () => {
  it.each(["courierCode", "courierLabel", "returnCourierCode", "returnCourierLabel"])(
    "%s 가 타입·읽기·쓰기에 모두 있다",
    (field) => {
      const column = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      expect(SETTINGS, `타입에 ${field}`).toContain(`${field}: string | null`);
      expect(SETTINGS, `COLUMNS 에 ${column}`).toContain(column);
      expect(SETTINGS, `writer 에 ${column}`).toContain(`${column}: clean(input.${field})`);
    },
  );

  /* 🔴 label 이 «함께» 없으면 화면이 코드를 보여주거나 매번 89 를 다시 불러야
     한다. F-7 이 없앤 상태로 되돌아가는 길이다. */
  it("code 만 저장하지 않는다 — label 이 짝으로 있다", () => {
    expect(SETTINGS).toContain("courierLabel");
    expect(SETTINGS).toContain("returnCourierLabel");
  });
});

describe("② 🔴 자동 적용 — 상품마다 다시 고르지 않는다", () => {
  it.each(["courierCode", "returnCourierCode"])("%s 가 fixed() 사다리를 탄다", (field) => {
    expect(CONTEXT).toContain(`${field}: fixed(form.${field}, sellerSettings.${field})`);
  });

  /* 🔴 순서가 이 기능의 전부다. 설정이 상품 폼을 덮으면 「이 상품만 다른
     택배사」가 불가능해진다 — 제조사 사다리와 같은 원칙이다. */
  it("상품 폼이 «먼저» 다 — trimOrNull 단독 사용으로 돌아가지 않았다", () => {
    expect(CONTEXT).not.toContain("courierCode: trimOrNull(form.courierCode)");
    expect(CONTEXT).not.toContain("returnCourierCode: trimOrNull(form.returnCourierCode)");
  });
});

describe("③ migration 이 C-1b/C-1c 계약을 «깨지 않는다»", () => {
  it("workspace 축과 scope_key 를 넣는다", () => {
    expect(MIGRATION).toContain("ADD COLUMN IF NOT EXISTS workspace_id uuid");
    expect(MIGRATION).toContain("scope_key text NOT NULL DEFAULT 'default'");
  });

  it("workspace 당 1행 · 레거시도 1행", () => {
    expect(MIGRATION).toContain("lotteon_seller_settings_workspace_scope_key");
    expect(MIGRATION).toContain("lotteon_seller_settings_legacy_scope_key");
  });

  /* 🔴 C-1/C-2 에서 확정한 금지가 그대로 지켜지는지 본다. 하나라도 들어오면
     레거시 행의 귀속을 «추정» 하는 것이 된다. */
  it("레거시 삭제·backfill·임의 workspace 가 없다", () => {
    expect(MIGRATION).not.toMatch(/\bDELETE\b/i);
    expect(MIGRATION).not.toMatch(/\bUPDATE\s+lotteon_seller_settings\b/i);
    expect(MIGRATION).not.toMatch(/INSERT\s+INTO/i);
  });

  it("🔴 코드 «값» 을 기본값으로 넣지 않는다", () => {
    /* 🔴 SQL 주석(`--`)을 걷고 «실행되는 문장» 만 본다. 금지 목록을 설명하느라
       주석에 4279402 를 «예시로» 적었더니 이 가드가 그것을 잡았다 — 세 번째로
       같은 실수를 했다(C-2B 의 「롯데ON API 필드명」 · C-2C 의 「근거 없음」). */
    const statements = MIGRATION.replace(/^\s*--.*$/gm, "");
    expect(statements).not.toMatch(/4279402|4279403/);
    expect(statements).not.toMatch(/DEFAULT\s+'[0-9]{4}'/);
  });
});

describe("④ 수입사명 — 상품이 아니라 «판매자» 의 것이다", () => {
  /* S-4/5/6 에서 찾았다. CEO 가 본 「수입사명 누락」은 값이 없는 게 아니라
     «상품 필드» 라서 상품마다 다시 입력하게 되는 것이었다. */
  it("seller_settings 에 importer 칸이 생긴다", () => {
    expect(MIGRATION).toContain("ALTER TABLE seller_settings");
    expect(MIGRATION).toContain("ADD COLUMN IF NOT EXISTS importer text");
  });

  it("🔴 제조사와 «다른» 개념이라고 적혀 있다", () => {
    expect(MIGRATION).toContain("제조사≠수입사≠판매자");
  });
});
