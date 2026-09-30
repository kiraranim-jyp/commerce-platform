import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCollectableAccess } from "../_lib/comparison-shop";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 070 — 해외 비교 사이트 5곳: **등록은 하되 수집 대상이 아니다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 테스트가 지키는 것은 하나다 — 「카탈로그에 있다」가 「자동 수집한다」로
 * 새지 않는 것. 커넥터를 검증하지 않은 사이트를 호출 대상에 넣으면 매번 빈손으로
 * 돌아오거나, 더 나쁘게는 값을 «있는 것처럼» 받아온다.
 *
 * 🔴 소스 문자열 검사는 **주석을 벗기고** 한다. 이 저장소가 여덟 번 걸린 함정이다
 * ([[source-scan-must-strip-comments]]) — 070 의 주석에는 설명을 위해 'OK' 와
 * `true` 라는 «글자» 가 들어 있어서, 벗기지 않으면 검사가 조용히 무력해진다.
 */
const SQL_PATH = join(
  __dirname,
  "../../../../../../../packages/database/prisma/migrations_manual/070_global_comparison_sites_seed.sql",
);

/** `--` 줄 주석을 제거한다. 이 파일에는 블록 주석이 없다. */
function codeOnly(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

const RAW = readFileSync(SQL_PATH, "utf8");
const CODE = codeOnly(RAW);

const DOMAINS = ["shopping.google.com", "amazon.com", "ebay.com", "walmart.com", "aliexpress.com"];

describe("① 다섯 곳이 «등록» 된다", () => {
  it("도메인 다섯이 모두 INSERT 문에 있다", () => {
    for (const d of DOMAINS) {
      expect(CODE, `${d} 가 코드(주석 제외)에 없다`).toContain(`'${d}'`);
    }
  });

  it("공통 카탈로그다 — source='SYSTEM' 이고 workspace 열을 쓰지 않는다", () => {
    expect(CODE).toContain("'SYSTEM'");
    /* comparison_shops 에는 workspace_id 가 없다(019). 셀러별 행이 아니라
       공통 행이라는 뜻이고, 그래서 모든 셀러가 같은 목록을 본다. */
    expect(CODE).not.toContain("workspace_id");
  });

  it("🔴 중복이면 조용히 넘어가고 기존 행을 덮어쓰지 않는다", () => {
    expect(CODE).toContain("on conflict (domain) do nothing");
    expect(CODE.toLowerCase()).not.toContain("do update");
    expect(CODE.toLowerCase()).not.toContain("upsert");
  });
});

describe("② 🔴 자동 수집 가능으로 «표시하지 않는다»", () => {
  it("INSERT 되는 모든 행이 is_active=false 다 — true 가 한 번도 안 나온다", () => {
    /* 열 목록에 is_active 가 있고, 값 줄에는 false 만 있어야 한다. */
    expect(CODE).toContain("is_active");
    expect(CODE).toContain("false");
    expect(CODE, "값 목록에 true 가 있으면 어느 한 행이 켜진 것이다").not.toMatch(/\btrue\b/);
  });

  it("🔴 access_status 에 'OK' 를 넣지 않는다 — 미확인을 확인으로 적지 않는다", () => {
    expect(CODE).not.toContain("'OK'");
  });

  it("🔴 'BLOCKED' 도 넣지 않는다 — 막혔다는 것 역시 실측이다", () => {
    expect(CODE).not.toContain("'BLOCKED'");
    expect(CODE).not.toContain("'LOGIN_REQUIRED'");
    expect(CODE).not.toContain("'API_DISCONTINUED'");
  });

  it("관측하지 않은 통화를 지어내지 않는다 — currency 는 null 이다", () => {
    expect(CODE).not.toContain("'USD'");
    expect(CODE).not.toContain("'CNY'");
    expect(CODE).not.toContain("'KRW'");
  });
});

describe("③ 🔴 왜 is_active=false 가 필요한가 — null 은 «막지 못한다»", () => {
  it("isCollectableAccess(null) 은 true 다 — access_status 만으로는 못 막는다", () => {
    /* 이것이 이 마이그레이션 설계의 근거다. null 이 막아 준다고 착각하면
       다섯 곳이 그대로 호출 대상이 된다. */
    expect(isCollectableAccess(null)).toBe(true);
    expect(isCollectableAccess(undefined)).toBe(true);
  });

  it("막는 축은 isActive 다 — 화면·검색이 쓰는 «같은» 합성으로 확인한다", () => {
    /* comparison/search/route.ts:92 · market-categories/route.ts:81 과 같은 조건식. */
    const collectable = (row: { isActive: boolean; accessStatus: null }) =>
      row.isActive && isCollectableAccess(row.accessStatus);
    expect(collectable({ isActive: false, accessStatus: null })).toBe(false);
    /* 대조군 — 켜면 통과한다. 즉 「나중에 켤 수 있다」가 보장된다. */
    expect(collectable({ isActive: true, accessStatus: null })).toBe(true);
  });
});

describe("④ 기존 데이터를 건드리지 않는다", () => {
  it("🔴 국내 표(다나와·네이버 쇼핑)를 한 글자도 건드리지 않는다", () => {
    expect(CODE).not.toContain("domestic_price_sources");
    expect(CODE).not.toContain("danawa");
    expect(CODE).not.toContain("shopping.naver.com");
  });

  it("🔴 UPDATE · DELETE · ALTER 가 없다 — INSERT 하나뿐이다", () => {
    const lowered = CODE.toLowerCase();
    expect(lowered).not.toContain("update ");
    expect(lowered).not.toContain("delete ");
    expect(lowered).not.toContain("alter ");
    expect(lowered).not.toContain("drop ");
    expect((lowered.match(/insert into/g) ?? []).length).toBe(1);
  });

  it("카테고리를 건드리지 않는다 — category_scope 를 쓰지 않아 기본값('{}')으로 남는다", () => {
    expect(CODE).not.toContain("category_scope");
  });
});
