import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  failedBeforeSending,
  listingFailureOrigin,
  listingFailureOriginLabel,
  type ListingFailureOrigin,
} from "../failure-origin";
import type { ListingErrorStep } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SELLER-UX-FINAL PHASE 4 — 「보내기 전」 ≠ 「채널이 거부」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 재는 것은 「분류표가 있는가」가 아니라 **「표가 실제 코드와 맞는가」** 다.
 * 분류를 지어내면 화면이 「값을 고치세요」라고 말하는데 실은 채널 장애인 상태가
 * 된다 — 셀러가 고칠 수 없는 것을 계속 고치게 만든다.
 */
const ALL_STEPS: ListingErrorStep[] = [
  "VALIDATION",
  "CATEGORY",
  "AUTHENTICATION",
  "NETWORK",
  "IMAGE",
  "COUPANG_API",
  "NOT_IMPLEMENTED",
];

describe("① 일곱 값 «전부» 가 분류된다 — 빠진 값이 없다", () => {
  it.each(ALL_STEPS)("%s 가 두 분류 중 하나다", (step) => {
    expect(["BEFORE_SEND", "CHANNEL"]).toContain(listingFailureOrigin(step));
  });

  it("🔴 ListingErrorStep 이 늘면 이 테스트가 깨진다 — 분류표가 조용히 낡지 않는다", () => {
    const types = readFileSync(join(__dirname, "../types.ts"), "utf8");
    const block = types.slice(types.indexOf("export type ListingErrorStep"), types.indexOf(";", types.indexOf("export type ListingErrorStep")));
    const declared = (block.match(/"[A-Z_]+"/g) ?? []).map((s) => s.replace(/"/g, ""));
    expect(declared.sort()).toEqual([...ALL_STEPS].sort());
  });

  it("두 분류가 «모두» 쓰인다 — 한쪽으로 몰리지 않았다", () => {
    const origins = new Set(ALL_STEPS.map(listingFailureOrigin));
    expect(origins.size).toBe(2);
  });
});

describe("② 🔴 분류가 «실제 코드» 와 맞는다 — 근거를 원문에서 확인한다", () => {
  const ROOT = join(__dirname, "../../../..");
  const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

  it("CATEGORY 는 «보내기 전» 이다 — 자체 검사이고 호출이 없다", () => {
    expect(listingFailureOrigin("CATEGORY")).toBe("BEFORE_SEND");
    const src = read("apps/admin/src/app/api/smartstore/register/route.ts");
    /* 카테고리 판정이 isVerifiedCategorySelected 자체 검사다. */
    expect(src).toContain("isVerifiedCategorySelected(listing.category)");
    /* 그 분기가 이미지 업로드(외부 호출)보다 «앞» 이다. */
    expect(src.indexOf('step: "CATEGORY"')).toBeLessThan(src.indexOf("await uploadNaverProductImages("));
  });

  it("🔴 IMAGE 는 «보낸 뒤» 다 — 이름과 달리 채널 업로드 호출이다", () => {
    expect(listingFailureOrigin("IMAGE")).toBe("CHANNEL");
    const src = read("apps/admin/src/app/api/smartstore/register/route.ts");
    /* 이 단계는 uploadNaverProductImages(accessToken, ...) 실패에서 나온다 —
       토큰을 들고 네이버에 올리는 외부 호출이다. */
    expect(src).toContain("await uploadNaverProductImages(accessToken,");
    const at = src.indexOf('step: "IMAGE"');
    expect(at).toBeGreaterThan(src.indexOf("await uploadNaverProductImages("));
  });

  it("VALIDATION 은 «보내기 전» 이다 — 우리 검증기다", () => {
    expect(listingFailureOrigin("VALIDATION")).toBe("BEFORE_SEND");
  });

  it("AUTHENTICATION · NETWORK · COUPANG_API 는 «보낸 뒤» 다", () => {
    for (const step of ["AUTHENTICATION", "NETWORK", "COUPANG_API"] as ListingErrorStep[]) {
      expect(listingFailureOrigin(step)).toBe("CHANNEL");
    }
  });

  it("NOT_IMPLEMENTED 는 «보내기 전» 이다 — 호출이 0건이다", () => {
    expect(listingFailureOrigin("NOT_IMPLEMENTED")).toBe("BEFORE_SEND");
    const src = read("packages/listing/src/executors/not-implemented.executor.ts");
    /* 🔴 외부 호출이 없다 — fetch/axios 가 한 줄도 없어야 이 분류가 맞다. */
    expect(src).not.toContain("fetch(");
  });
});

describe("③ failedBeforeSending 이 같은 표를 본다 — 두 벌로 갈리지 않는다", () => {
  it.each(ALL_STEPS)("%s 에서 두 함수가 일치한다", (step) => {
    expect(failedBeforeSending(step)).toBe(listingFailureOrigin(step) === "BEFORE_SEND");
  });

  it("🔴 분류표가 파일에 «하나» 다", () => {
    const src = readFileSync(join(__dirname, "../failure-origin.ts"), "utf8");
    expect((src.match(/Record<ListingErrorStep, ListingFailureOrigin>/g) ?? []).length).toBe(1);
  });
});

describe("④ 문구가 사실만 말한다", () => {
  it("보내기 전이면 «전송되지 않았다» 고 말한다", () => {
    const msg = listingFailureOriginLabel("BEFORE_SEND");
    expect(msg).toContain("보내기 전");
    expect(msg).toContain("전송되지 않았습니다");
  });

  it("보낸 뒤면 «일부 만들어졌을 수 있다» 고 말한다 — 중복 등록 위험을 숨기지 않는다", () => {
    const msg = listingFailureOriginLabel("CHANNEL");
    expect(msg).toContain("보낸 뒤");
    expect(msg).toContain("일부 만들어졌을 수 있습니다");
  });

  it("🔴 「셀러 잘못 / 채널 잘못」이라고 말하지 않는다 — 책임을 단정하지 않는다", () => {
    for (const origin of ["BEFORE_SEND", "CHANNEL"] as ListingFailureOrigin[]) {
      const msg = listingFailureOriginLabel(origin);
      /* 🔴 `for (const a = [...], b of a)` 는 문법 오류다 — 전에도 한 번 걸렸다. */
      for (const forbidden of ["잘못", "책임", "실수"]) {
        expect(msg, forbidden).not.toContain(forbidden);
      }
    }
  });
});

describe("⑤ 🔴 두 화면이 같은 함수를 본다", () => {
  const ROOT = join(__dirname, "../../../..");
  const codeOnly = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

  it("등록 결과 화면이 출처를 «단계보다 먼저» 보여준다", () => {
    const src = codeOnly(readFileSync(join(ROOT, "apps/admin/src/app/pipeline/commerce/ListingSection.tsx"), "utf8"));
    expect(src).toContain("listingFailureOriginLabel(listingFailureOrigin(result.error.step))");
    expect(src.indexOf("listingFailureOriginLabel(")).toBeLessThan(src.indexOf("실패 단계:"));
  });

  it("이력 패널도 출처와 단계를 적는다 — 라벨 함수를 «재사용» 한다", () => {
    const src = codeOnly(
      readFileSync(join(ROOT, "apps/admin/src/app/pipeline/commerce/RegistrationHistoryPanel.tsx"), "utf8"),
    );
    expect(src).toContain("failedBeforeSending(entry.result.error.step)");
    expect(src).toContain("errorStepLabel(");
    /* 🔴 자기만의 라벨 표를 만들지 않았다 — 두 화면이 같은 실패를 다른 이름으로
       부르면 셀러가 두 가지 문제로 센다. */
    expect(src).not.toContain("VALIDATION:");
  });
});
