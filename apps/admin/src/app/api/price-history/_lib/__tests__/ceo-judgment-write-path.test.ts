import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCeoAxisState, isCeoJudgmentVerdict } from "../ceo-judgment";
import { stripComments } from "../../../../pipeline/commerce/__tests__/source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **CEO 판단 쓰기 경로 계약**(CPO 승인 범위 ⒞ · 2026-11-07)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 네트워크 0 · DB 0. DB 동작은 `scripts/ceo-judgment-write-verify.mjs` 가 **실측** 했다
 *    (10항 PASS · 전용 키 정리 후 잔여 0). 🔴 이 파일은 **코드 경계** 를 잠근다.
 */

const LIB = join(__dirname, "../ceo-judgment.ts");
const ROUTE = join(__dirname, "../../[snapshotId]/ceo-judgments/route.ts");
const src = (p: string) => stripComments(readFileSync(p, "utf8").replace(/\r\n/g, "\n"));
const LIB_SRC = src(LIB);
const ROUTE_SRC = src(ROUTE);

describe("A. 술어 — DB CHECK «앞에서» 막는다", () => {
  it("A-1 verdict 는 세 값뿐이다 — `SIMILAR` 는 이 표의 값이 «아니다»", () => {
    for (const v of ["SAME", "DIFFERENT", "UNDECIDED"]) expect(isCeoJudgmentVerdict(v)).toBe(true);
    // 🔴 `candidate_reviews` 는 SIMILAR 를 허용하지만 `ceo_judgments` 는 **아니다**(083 CHECK).
    for (const v of ["SIMILAR", "MAYBE_SAME", "same", "", null, undefined, 1]) {
      expect(isCeoJudgmentVerdict(v)).toBe(false);
    }
  });

  it("A-2 축 상태는 네 값뿐이다 — 🔴 «미입력» 은 이 집합에 없다", () => {
    for (const v of ["MATCH", "MISMATCH", "UNKNOWN", "NOT_APPLICABLE"]) expect(isCeoAxisState(v)).toBe(true);
    // 🔴🔴 「미입력」은 **행이 없는 것** 으로 표현된다 — 상태값으로 만들면 그 구분이 깨진다.
    for (const v of ["", "NOT_ENTERED", "미입력", null]) expect(isCeoAxisState(v)).toBe(false);
  });
});

describe("B. 🔴 append-only — 덮지 않는다", () => {
  it("B-1 `UPDATE` 경로가 «없다»", () => {
    expect(LIB_SRC).not.toMatch(/\.update\(/);
    expect(LIB_SRC).not.toMatch(/\.upsert\(/);
    // 🔴 `onConflict` 는 부분 유니크에서 42P10 을 낸다(WU-141-R1) — 쓰지 않는다.
    expect(LIB_SRC).not.toContain("onConflict");
    expect(ROUTE_SRC).not.toMatch(/\.update\(|\.upsert\(/);
  });

  it("B-2 version 은 «직전 최대 + 1» 이고 `supersedes_id` 로 잇는다", () => {
    expect(LIB_SRC).toContain("(prev?.version ?? 0) + 1");
    expect(LIB_SRC).toContain("supersedes_id: prev?.id ?? null");
  });

  it("B-3 🔴 동일 내용 비교가 «없다» — 같은 내용도 새 버전이다(CPO 결정 Ⓘ)", () => {
    for (const banned of ["isSameContent", "deepEqual", "sameAsPrev", "skipIfSame", "alreadySaved"]) {
      expect(LIB_SRC).not.toContain(banned);
    }
  });

  it("B-4 🔴 삭제 경로가 «없다» — 판단을 지우지 않는다", () => {
    expect(LIB_SRC).not.toMatch(/\.delete\(/);
    expect(ROUTE_SRC).not.toMatch(/\.delete\(/);
  });
});

describe("C. 🔴 중복 방지 — 재시도는 «한 번» 이다", () => {
  it("C-1 `23505` 만 재시도 대상이다", () => {
    expect(LIB_SRC).toContain('"23505"');
    expect(LIB_SRC).toContain("conflict");
  });

  it("C-2 🔴🔴 재시도가 **루프가 아니다** — `attempt()` 호출이 정확히 둘이다", () => {
    // 🔴 CPO 명시: 무한 재시도 금지. 🟢 while/for 루프로 감싸면 여기서 걸린다.
    const calls = [...LIB_SRC.matchAll(/await attempt\(\)/g)];
    expect(calls).toHaveLength(2);
    const body = LIB_SRC.slice(LIB_SRC.indexOf("const first = await attempt()"));
    expect(body).not.toMatch(/\bwhile\b|\bfor\s*\(/);
  });
});

describe("D. 🔴 축을 쓰지 않는다 — 불완전한 판단을 남기는 경로가 «없다»", () => {
  it("D-1 축 표에 **insert 하지 않는다**", () => {
    for (const s of [LIB_SRC, ROUTE_SRC]) {
      expect(s).not.toMatch(/from\(["']ceo_judgment_axes["']\)/);
    }
  });

  it("D-2 🔴 보상 삭제 패턴이 없다 — 원자성을 «흉내내지» 않는다", () => {
    // 🔴 insert → 실패 시 delete 는 원자적이 아니다. 그 경로 자체를 만들지 않았다.
    expect(LIB_SRC).not.toMatch(/rollback|compensat/i);
    expect(LIB_SRC).not.toMatch(/\.delete\(/);
  });

  it("D-3 🟢 축 술어는 «있지만» 저장에 쓰이지 않는다(후속 RPC 가 재사용한다)", () => {
    expect(LIB_SRC).toContain("isCeoAxisState");
    // 🔴 그 술어가 insert 근처에 없다 — 쓰면 축 경로가 생긴 것이다.
    const insertBlock = LIB_SRC.slice(LIB_SRC.indexOf(".insert({"), LIB_SRC.indexOf(".select(SELECT)"));
    expect(insertBlock).not.toContain("Axis");
  });
});

describe("E. 🔴 보안 경계 — 기존 경로와 «같은 함수» 다", () => {
  it("E-1 인증·소유권을 둘 다 거친다", () => {
    expect(ROUTE_SRC).toContain("requireUser()");
    expect(ROUTE_SRC).toContain("getSnapshot(snapshotId, workspaceId)");
    // 🔴 소유권 실패는 **404** 다(존재 여부를 흘리지 않는다).
    expect(ROUTE_SRC).toContain("status: 404");
    // 🟢 GET·POST **둘 다** 소유권을 본다.
    expect([...ROUTE_SRC.matchAll(/assertOwnedSnapshot\(/g)]).toHaveLength(3); // 정의 1 + 호출 2
  });

  it("E-2 🔴 판단자를 «세션» 에서 가져온다 — 클라이언트 값을 쓰지 않는다", () => {
    expect(LIB_SRC).toContain("reviewer: string");
    expect(ROUTE_SRC).toContain("reviewer: auth.user.email || auth.user.userId");
    // 🔴 body 에서 reviewer 를 읽으면 위장이 된다.
    expect(ROUTE_SRC).not.toMatch(/body\?\.\s*reviewer|body\.reviewer/);
  });

  it("E-3 🟢 DB 접근은 `service_role` 하나다 — 클라이언트 경로 0", () => {
    expect(LIB_SRC).toContain("getSupabaseAdmin()");
    for (const banned of ["supabase-browser", "createSupabaseBrowserClient", "use client", "@prisma/client"]) {
      expect(LIB_SRC).not.toContain(banned);
      expect(ROUTE_SRC).not.toContain(banned);
    }
  });

  it("E-4 🔴🔴 조회에 «범위 축» 이 반드시 있다 — `ceo_judgments` 에 workspace 칸이 없다", () => {
    // 🔴 `review_url_key` 만으로 조회하면 다른 workspace 판단이 섞인다(083 에 workspace_id 가 없다).
    expect(LIB_SRC).toContain("listCeoJudgments(input: { snapshotId: string })");
    expect(LIB_SRC).toContain('.eq("snapshot_id", input.snapshotId)');
    // 🔴 URL 키 축 조회는 이번 범위가 아니다 — 열면 여기서 걸린다.
    expect(LIB_SRC).not.toMatch(/\.in\(["']review_url_key["']/);
  });
});

describe("F. 🔴 승인 범위 밖을 건드리지 않는다", () => {
  it("F-1 `candidate_reviews` 와 기존 GT 에 접근 0", () => {
    /**
     * 🔴 **내 1차 단언이 틀렸다** — `human_verdict:` 를 금지했는데 그 칸은
     *    `ceo_judgments` 에 **정상적으로 있다**(083). 🟢 느슨하게 하지 않고
     *    **실제 성질** 로 바꿨다: **건드리는 표를 전수로 센다**.
     */
    for (const s of [LIB_SRC, ROUTE_SRC]) {
      const tables = [...s.matchAll(/\.from\(["']([a-z_]+)["']\)/g)].map((m) => m[1]!);
      for (const t of tables) expect(["ceo_judgments"], `허용 밖 표: ${t}`).toContain(t);
      expect(s).not.toContain("SAME05_BASELINE");
      expect(s).not.toContain("GT_IMPORT");
    }
    // 🟢 그리고 실제로 **한 표만** 쓴다(축 표도 쓰지 않는다 — D-1 과 짝이다).
    const used = new Set([...LIB_SRC.matchAll(/\.from\(["']([a-z_]+)["']\)/g)].map((m) => m[1]!));
    expect([...used]).toEqual(["ceo_judgments"]);
  });

  it("F-2 판정·검색·가격 경로를 import 하지 않는다", () => {
    for (const banned of [
      "market-intelligence",
      "candidate-market",
      "run-domestic-price-check",
      "cross-seller",
      "price-tier",
    ]) {
      expect(LIB_SRC).not.toContain(banned);
      expect(ROUTE_SRC).not.toContain(banned);
    }
  });

  it("F-3 🟢 `reviewKey` 를 «재사용» 한다 — 복제하면 조회가 못 찾는다", () => {
    expect(LIB_SRC).toContain('from "./candidate-review"');
    expect(LIB_SRC).toContain("reviewKey(input.candidateUrl)");
    // 🔴 정규화기를 새로 만들지 않았다.
    expect(LIB_SRC).not.toContain("canonicalizeProductUrl");
  });

  it("F-4 🔴 `rawNote`·축을 시스템이 만들지 않는다", () => {
    expect(LIB_SRC).toContain("raw_note: input.rawNote ?? null");
    expect(ROUTE_SRC).toContain('typeof body?.rawNote === "string" ? body.rawNote : null');
    // 🔴 메모를 생성하는 어휘가 없다.
    for (const banned of ["buildNote", "generateNote", "inferAxes", "deriveAxes"]) {
      expect(LIB_SRC).not.toContain(banned);
    }
  });
});
