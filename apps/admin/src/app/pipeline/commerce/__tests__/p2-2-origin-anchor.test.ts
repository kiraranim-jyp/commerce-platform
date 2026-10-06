import { describe, expect, it } from "vitest";
import type { NaverPayloadFieldCheck, NaverPayloadValidationResult } from "@commerce/listing";
import { REGISTRATION_FIELD_ANCHOR, registrationFieldAnchor } from "../readiness-state";
import type { PriorityItem } from "../readiness-state";
/* `ReadinessItem` 은 readiness-state 가 re-export 하지 않는다 — 원래 자리에서 가져온다. */
import { computeNaverPayloadReadiness, type ReadinessItem } from "../readiness";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-2 ① — 「기본정보에서 입력하기」가 **그 칸** 으로 간다 (CEO 실측, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 사고: 버튼을 눌러도 원산지로 가지 않았다. 원인은 버튼이 아니라 «이동 대상»
 * 이다 — `goToSection` 은 섹션을 열고 그 안의 **첫 번째** 입력칸을 포커스하고,
 * 기본정보의 첫 칸은 「상품명」이다. 그래서 「이동」이라고 말하면서 이동하지 않았다.
 *
 * 🔴 공통 패턴인지를 «구조로» 재고, 원산지 하나만 통과하는지 보지 않는다 —
 * 필드를 더하는 비용이 「표 한 줄 + id 한 개」인지가 이 테스트의 관심사다.
 */
const item = (label: string, sourceLabels: string[]): PriorityItem => ({
  key: label,
  label,
  sourceItems: sourceLabels.map((l) => ({ label: l, passed: false, required: true }) as ReadinessItem),
});

describe("① 🔴 원산지 두 라벨이 «같은 칸» 을 가리킨다", () => {
  it("「원산지」(코드 미확인) → 원산지 입력칸", () => {
    expect(registrationFieldAnchor(item("스마트스토어 확인 필요", ["원산지"]))).toBe("field-countryOfOrigin");
  });

  it("🔴 「원산지 직접입력」(04 로 떨어진 경우) → «같은» 칸", () => {
    /* P2-1 A 가 두 이름으로 가른 그 둘이다. 셀러가 적는 곳은 하나뿐이므로
       앵커도 하나여야 한다 — 두 칸으로 보내면 셀러는 어디에 적을지 모른다. */
    expect(registrationFieldAnchor(item("스마트스토어 확인 필요", ["원산지 직접입력"]))).toBe(
      "field-countryOfOrigin",
    );
  });

  it("항목 라벨 자체로도 찾는다 — sourceItems 가 비어 있어도", () => {
    expect(registrationFieldAnchor(item("원산지", []))).toBe("field-countryOfOrigin");
  });
});

describe("② 🔴 표에 없는 항목은 지금까지와 «똑같이» 동작한다 (회귀 없음)", () => {
  it("매핑이 없으면 undefined — 섹션까지만 이동한다", () => {
    expect(registrationFieldAnchor(item("상품명", ["상품명"]))).toBeUndefined();
    expect(registrationFieldAnchor(item("카테고리", ["카테고리"]))).toBeUndefined();
    expect(registrationFieldAnchor(item("인증정보(KC)", ["인증정보(KC)"]))).toBeUndefined();
  });

  it("🔴 가드가 공허하지 않다 — 표가 실제로 비어 있지 않다", () => {
    expect(Object.keys(REGISTRATION_FIELD_ANCHOR).length).toBeGreaterThan(0);
  });
});

describe("③ 🔴 앵커 id 가 화면에 «실제로» 있다 — 이동 경로 없는 안내를 만들지 않는다", () => {
  it("표의 모든 앵커가 PlatformPreview 의 DOM id 와 짝이 있다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const preview = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8");
    /* 🔴 주석을 벗기고 본다 — 앵커 id 를 «설명하는» 주석이 그 파일에 있어서,
       벗기지 않으면 설명문이 짝으로 세어진다(이 저장소에서 반복해 걸린 함정). */
    const code = preview
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    for (const anchor of new Set(Object.values(REGISTRATION_FIELD_ANCHOR))) {
      expect(code, `${anchor} 앵커가 화면에 없다 — 눌러도 아무 데도 가지 않는다`).toContain(`id="${anchor}"`);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ⑤ 🔴 앵커가 «그 섹션 안» 에 있다 (2026-10-06, CEO 보고로 추가)
   ════════════════════════════════════════════════════════════════════════════

   §③ 은 「앵커 id 가 화면에 있는가」까지만 봤다. 그것이 통과하는 동안 실제 버그가
   7주 넘게 살아 있었다: 앵커도 있었고 섹션 id 도 있었는데 **서로 다른 곳을
   가리켰다.** `naverFieldSectionId` 는 `section-basic` 을 돌려줬고 원산지 칸은
   고시정보 섹션에 있었다 — 바로가기가 원산지 칸이 «없는» 섹션을 열었다.

   🔴 두 사실이 짝이라는 것을 아무도 재지 않았다. 여기서 잰다. */
describe("⑤ 🔴 앵커가 매핑된 섹션 «안» 에 있다 — 두 사실이 갈라지지 않게", () => {
  const ORIGIN_FIELDS = [
    { field: "detailAttribute.originAreaInfo.originAreaCode", label: "원산지" },
    { field: "detailAttribute.originAreaInfo.content", label: "원산지 직접입력" },
  ] as const;

  /** `PlatformPreview.tsx` 에서 그 앵커를 담고 있는 섹션 id 를 «구조로» 읽는다. */
  async function sectionContainingAnchor(anchor: string): Promise<string> {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    /* 🔴 주석을 벗긴다 — §③ 과 같은 이유다(이 저장소에서 반복해 걸린 함정). */
    const code = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

    /* 섹션 경계는 `sectionProps("section-…")` 다 — 전 섹션이 이 표기를 쓴다. */
    const bounds = [...code.matchAll(/sectionProps\("(section-[a-z-]+)"\)/g)].map((m) => ({
      id: m[1]!,
      at: m.index!,
    }));
    const anchorAt = code.indexOf(`id="${anchor}"`);

    /* ── 공허 방지: 둘 다 «실제로 찾았는지» 먼저 못박는다 ───────────────────
       이것이 없으면 정규식이 하나도 못 맞춰도 아래가 조용히 통과한다. */
    expect(bounds.length, "섹션 경계를 하나도 못 찾았다 — 표기가 바뀌었다").toBeGreaterThan(5);
    expect(anchorAt, `${anchor} 앵커를 화면에서 못 찾았다`).toBeGreaterThan(-1);

    /* 앵커보다 앞에 있는 마지막 경계가 그 앵커를 담은 섹션이다.
       🔴 형제 섹션 기준이다 — 중첩 섹션(section-payload)은 이 셈으로 판별하지
       않는다. 앵커가 그쪽으로 옮겨지면 이 단정이 틀리므로 그때 셈을 고친다. */
    const owner = bounds.filter((b) => b.at < anchorAt).pop();
    expect(owner, `${anchor} 앞에 섹션 경계가 없다`).toBeDefined();
    return owner!.id;
  }

  /** 그 필드 하나만 MISSING 인 validation. 🔴 readiness.test.ts 와 같은 shape 다. */
  function validationFor(field: string): NaverPayloadValidationResult {
    const fields: NaverPayloadFieldCheck[] = [{ field, status: "MISSING", reason: "테스트 사유" }];
    return {
      ok: false,
      readyCount: 0,
      missingCount: 1,
      blockedCount: 0,
      fields,
      issues: [{ field, reason: "테스트 사유", severity: "MISSING" }],
      advisoryNotes: [],
      kcStatus: "SELLER_REVIEW_REQUIRED",
    } as unknown as NaverPayloadValidationResult;
  }

  for (const { field, label } of ORIGIN_FIELDS) {
    it(`「${label}」의 이동 섹션이 앵커가 «실제로 있는» 섹션과 같다`, async () => {
      const summary = computeNaverPayloadReadiness(validationFor(field));
      const readinessItem = summary.items.find((i) => i.label === label);
      expect(readinessItem, `${label} 항목이 없다 — 라벨 표가 바뀌었다`).toBeDefined();

      const mapped = readinessItem!.sectionId;
      expect(mapped, `${label} 에 이동 섹션이 없다`).toBeTruthy();

      /* 앵커는 §① 이 쓰는 그 표에서 온다 — 여기서 이름을 손으로 적지 않는다. */
      const anchor = registrationFieldAnchor(item(label, [label]));
      expect(anchor, `${label} 의 앵커가 표에 없다`).toBeDefined();

      const actual = await sectionContainingAnchor(anchor!);
      expect(
        mapped,
        `「${label}」 안내는 ${mapped} 로 보내는데 입력칸(${anchor})은 ${actual} 에 있다 — 바로가기가 빈 섹션을 연다`,
      ).toBe(actual);
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   ⑥ 🔴 readiness 가 보내는 «모든» 자리가 실재한다 (STEP 1-a, 2026-10-06)
   ════════════════════════════════════════════════════════════════════════════

   §⑤ 는 앵커 표에 등록된 것(원산지 둘)만 봤다. 그 범위가 좁아서, 같은 종류의
   결함이 하나 더 살아 있는 것을 못 잡았다 — `section-images` 는 readiness 에만
   있고 화면에 «없다»(대표이미지 바로가기가 죽은 링크였다).

   🔴 그래서 「원산지만 특별히 검사」를 그만두고 **전수** 로 바꾼다.
   🔴 그리고 알려진 미해결을 «PASS 로 숨기지 않는다» — 목록으로 세고, 그 목록이
      낡으면(고쳐졌는데 남아 있으면) 그것도 실패로 만든다. */
describe("⑥ 🔴 readiness → 섹션 전수 — 알려진 미해결과 신규 결함을 가른다", () => {
  /**
   * 🔴 **알려진 미해결 1건.** STEP 2(대표이미지 자동 선정)가 실제 편집 위치를
   * 확정한 뒤 target 을 정하기로 CPO 가 보류했다(2026-10-06). 영구 예외가
   * 아니다 — 아래 마지막 테스트가 「고쳐졌으면 이 목록에서 빼라」고 말한다.
   */
  const EXPECTED_UNRESOLVED = ["section-images"] as const;

  const strip = (code: string) =>
    code
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

  async function read(rel: string) {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return strip(readFileSync(join(__dirname, "..", rel), "utf8"));
  }

  /** readiness 쪽 소스가 «낼 수 있는» 섹션 id. */
  const emitted = (code: string, prefix: string) =>
    new Set([...code.matchAll(new RegExp(`"(${prefix}-[a-z-]+)"`, "g"))].map((m) => m[1]!));

  /** 화면에 «실재하는» 섹션 id — 전 섹션이 sectionProps 표기를 쓴다. */
  const present = (code: string) =>
    new Set([...code.matchAll(/sectionProps\("([a-z-]+)"\)/g)].map((m) => m[1]!));

  const CHANNELS = [
    { label: "SmartStore/Coupang", from: "readiness.ts", screen: "PlatformPreview.tsx", prefix: "section" },
    { label: "LotteON", from: "lotteon-channel-form.ts", screen: "LotteOnRegistrationPanel.tsx", prefix: "lotteon-section" },
  ] as const;

  for (const channel of CHANNELS) {
    it(`${channel.label} — 보내는 자리가 모두 화면에 있다 (알려진 미해결 제외)`, async () => {
      const emittedIds = emitted(await read(channel.from), channel.prefix);
      const presentIds = present(await read(channel.screen));

      /* ── 공허 방지: 양쪽을 «실제로» 찾았는지 먼저 못박는다 ─────────────── */
      expect(emittedIds.size, `${channel.from} 에서 섹션 id 를 못 찾았다`).toBeGreaterThan(3);
      expect(presentIds.size, `${channel.screen} 에서 섹션을 못 찾았다`).toBeGreaterThan(3);

      const broken = [...emittedIds].filter((id) => !presentIds.has(id));
      const unexpected = broken.filter((id) => !(EXPECTED_UNRESOLVED as readonly string[]).includes(id));
      expect(
        unexpected,
        `${channel.label}: readiness 가 «없는 자리» 로 보낸다 — 바로가기가 죽은 링크가 된다`,
      ).toEqual([]);
    });
  }

  it("🔴 알려진 미해결 목록이 낡지 않았다 — 고쳐졌으면 목록에서 빼라", async () => {
    /* 예외를 적어 두고 잊으면 그것이 「결함을 PASS 로 숨기는」 것이 된다.
       고쳐진 순간 여기서 실패해서, 목록을 줄이도록 강제한다. */
    const emittedIds = emitted(await read("readiness.ts"), "section");
    const presentIds = present(await read("PlatformPreview.tsx"));
    for (const id of EXPECTED_UNRESOLVED) {
      expect(emittedIds.has(id), `${id} 를 readiness 가 더 이상 쓰지 않는다 — 목록에서 빼라`).toBe(true);
      expect(presentIds.has(id), `${id} 가 화면에 생겼다 — 목록에서 빼라`).toBe(false);
    }
  });
});

describe("④ 🔴 클릭 지점이 앵커를 «실제로 넘긴다»", () => {
  it("goToSection 이 두 번째 인자를 받고 호출부가 그것을 넘긴다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain("function goToSection(sectionId: string, fieldAnchorId?: string)");
    expect(code).toContain("goToSection(item.sectionId, registrationFieldAnchor(item))");
    /* 🔴 포커스도 앵커 «안» 에서 찾는다 — 스크롤만 하고 포커스를 섹션 첫 칸에
       두면 셀러는 여전히 상품명에 커서가 간다(그것이 이번 결함이었다). */
    expect(code).toContain("anchor?.querySelector<HTMLElement>(INPUT_SELECTOR)");
  });
});
