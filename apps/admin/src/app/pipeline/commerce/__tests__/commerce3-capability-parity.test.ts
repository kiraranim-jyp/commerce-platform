import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMERCE_ORDER, type CommerceId } from "../commerce-registry";
import { CHANNEL_CAPABILITY } from "../channel-lifecycle";
import { EDIT_ADAPTER_COMMERCE_IDS, editAdapterFor, editUnavailableNote } from "../edit-adapters";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-3(CEO 지시, 2026-09-26) — **선언 · 배선 · 문구가 갈라지지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 세 커머스를 «마무리» 한다는 것은 기능을 더 넣는 일이 아니라, 세 가지가 서로
 * 어긋날 수 없게 만드는 일이다:
 *
 *     CHANNEL_CAPABILITY.update   이 채널을 고칠 수 «있다고 확인했는가»
 *     EDIT_ADAPTERS               고치는 «배선» 이 있는가
 *     editUnavailableNote         없으면 셀러에게 «무엇이라 말하는가»
 *
 * ── 🔴 이 파일이 막는 두 사고 ────────────────────────────────────────────
 * ① capability 는 UNKNOWN 인데 어댑터를 등록하는 것.
 *    `editUnavailableNote()` 는 어댑터가 있으면 `undefined` 를 낸다 — 즉 어댑터를
 *    한 줄 적는 순간 「확인되지 않았습니다」가 «조용히 사라진다». 실측 없이 화면이
 *    수정 가능하다고 말하게 되는 경로가 그것이고, 지금까지 주석으로만 막혀 있었다
 *    (edit-adapters/index.ts:17-26).
 * ② capability 는 SUPPORTED 라고 적었는데 배선이 없는 것. 화면은 고칠 수 있다고
 *    말하는데 누르면 아무 일도 일어나지 않는다.
 *
 * 🔴 이 파일은 capability 값을 «주장하지 않는다». 표가 무엇이든 그 표와 배선과
 * 문구가 같은 말을 하는지만 본다 — 근거가 생겨 표가 바뀌면 이 테스트는 그대로
 * 통과해야 한다(값을 박아 두면 표를 고치는 날 여기도 고쳐야 하고, 그러면 두
 * 곳을 동시에 고치는 사람에게 아무 경고도 주지 못한다).
 */

const CHANNELS = ["smartstore", "coupang", "lotteon"] as const;

/** 주석은 걷어낸다 — 이 저장소의 주석은 「예전에는 이랬다」를 길게 설명한다. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readRoute(channel: string): string {
  return code(readFileSync(join(__dirname, `../../../api/${channel}/register/route.ts`), "utf8"));
}

const ROUTES: Record<string, string> = {
  smartstore: readRoute("smartstore"),
  coupang: readRoute("coupang"),
  lotteon: readRoute("lotteon"),
};

describe("① 🔴 어댑터 등록은 «확인된» 채널만 — 문구가 조용히 사라지지 않는다", () => {
  it("등록된 어댑터의 채널은 전부 update === SUPPORTED 다", () => {
    for (const id of EDIT_ADAPTER_COMMERCE_IDS) {
      expect(
        CHANNEL_CAPABILITY[id].update,
        `${id} 어댑터가 등록돼 있는데 capability.update 가 SUPPORTED 가 아니다 — ` +
          "이 상태로는 화면에서 「확인되지 않았습니다」가 사라지고 수정 가능한 것처럼 보인다.",
      ).toBe("SUPPORTED");
    }
  });

  it("update === SUPPORTED 인 채널은 «배선이 있어야» 한다", () => {
    for (const id of COMMERCE_ORDER) {
      if (CHANNEL_CAPABILITY[id].update !== "SUPPORTED") continue;
      expect(
        editAdapterFor(id),
        `${id} 는 수정 가능이라고 선언했는데 어댑터가 없다 — 화면이 고칠 수 있다고 말하고 누르면 아무 일도 없다.`,
      ).toBeDefined();
    }
  });

  it("🔴 확인되지 «않은» 채널은 반드시 문장을 갖는다 — 침묵하지 않는다", () => {
    for (const id of COMMERCE_ORDER) {
      if (CHANNEL_CAPABILITY[id].update === "SUPPORTED") continue;
      const note = editUnavailableNote(id);
      expect(note, `${id} 에 수정 불가 안내 문장이 없다`).toBeTruthy();
      /* 🔴 「안 됩니다」라고 말하지 않는다 — 확인되지 않았을 뿐이다. */
      expect(note).not.toContain("지원하지 않습니다");
      expect(note).not.toContain("불가능");
    }
  });

  it("어댑터가 자기 채널 id 를 그대로 말한다 — 레지스트리 키와 어긋나면 잘못된 번역이 실린다", () => {
    for (const id of EDIT_ADAPTER_COMMERCE_IDS) {
      expect(editAdapterFor(id)?.commerceId).toBe(id);
    }
  });
});

describe("② 🔴 라우트의 실행 경로가 capability 와 일치한다", () => {
  /** UPDATE 를 «실행» 하는 흔적. 판단(resolveLifecycle)이 아니라 실행이다. */
  const UPDATE_EXECUTION = [/operation:\s*"UPDATE"/, /method:\s*"PUT"/, /updateRegisteredProduct\(/];

  it.each(CHANNELS)("%s", (id) => {
    const src = ROUTES[id]!;
    const found = UPDATE_EXECUTION.filter((pattern) => pattern.test(src));
    if (CHANNEL_CAPABILITY[id].update === "SUPPORTED") {
      expect(
        found.length,
        `${id} 는 수정 가능이라고 선언했는데 라우트에 UPDATE 실행 경로가 없다.`,
      ).toBeGreaterThan(0);
    } else {
      expect(
        found,
        `${id} 는 update 가 ${CHANNEL_CAPABILITY[id].update} 인데 라우트에 UPDATE 실행 경로가 있다 — ` +
          "확인되지 않은 수정을 실제로 보내고 있다.",
      ).toEqual([]);
    }
  });

  it("🔴 update 가 SUPPORTED 가 아닌 채널의 감사 로그에 UPDATE 가 들어갈 수 없다", () => {
    for (const id of CHANNELS) {
      if (CHANNEL_CAPABILITY[id].update === "SUPPORTED") continue;
      /* operation 의 타입이 CREATE|RECREATE 로 좁혀져 있는 것이 그 보장이다.
         문자열이 등장하지 않는다는 것만 세면 타입이 넓어져도 모르므로 둘 다 본다. */
      expect(ROUTES[id]).not.toContain('"UPDATE"');
    }
  });
});

describe("③ 🔴 판단은 세 라우트가 «같은 함수» 로 한다 — 복제하면 갈라진다", () => {
  const SHARED = [
    "findChannelProductBySnapshot",
    "resolveCreateGate",
    "resolveLifecycle",
    "linkChannelProduct",
  ] as const;

  it.each(CHANNELS)("%s 가 공통 함수를 쓴다", (id) => {
    for (const fn of SHARED) {
      expect(ROUTES[id], `${id} 라우트가 ${fn} 을 쓰지 않는다`).toContain(fn);
    }
  });

  it("🔴 세 라우트 어디에도 capability 표를 «다시 쓰는» 코드가 없다", () => {
    for (const id of CHANNELS) {
      /* 라우트가 자기 capability 를 스스로 판정하면 표와 갈라진다. 표를 «읽는»
         것(CHANNEL_CAPABILITY)도 필요 없다 — resolveLifecycle 이 이미 읽는다. */
      expect(ROUTES[id], `${id} 라우트가 capability 를 직접 선언한다`).not.toContain('update: "');
      expect(ROUTES[id]).not.toContain('categoryUpdate: "');
    }
  });
});

describe("④ 🔴 Core 는 실행 코드에서 커머스 이름을 모른다", () => {
  /** 🔴 레지스트리와 capability 표는 «채널 이름을 아는 것이 일» 이라 제외한다.
   *  그 둘이 이름을 아는 유일한 자리라는 것이 곧 경계의 정의다. */
  const CORE_FILES = [
    "channel-edit-model.ts",
    "commerce-edit-adapter.ts",
    "channel-field-capability.ts",
    "ChannelEditPanel.tsx",
    "ChannelEditSummary.tsx",
    "ChannelRegistrationFrame.tsx",
  ] as const;

  it.each(CORE_FILES)("%s", (file) => {
    const src = code(readFileSync(join(__dirname, `../${file}`), "utf8"));
    for (const channel of ["smartstore", "coupang", "lotteon", "elevenst"]) {
      expect(src, `${file} 가 «${channel}» 을 실행 코드에서 안다`).not.toContain(channel);
    }
    /* 벤더 API 필드명도 새지 않는다 — 중립 통화의 이름만 있어야 한다. */
    for (const vendorField of ["originProduct", "smartstoreChannelProduct", "sellerProductId", "spdNo", "epdNo"]) {
      expect(src, `${file} 가 벤더 필드명 «${vendorField}» 을 안다`).not.toContain(vendorField);
    }
  });
});

describe("⑤ 🔴 수정 배선이 있는 채널은 «하나» 이고, 그 사실을 화면 배선도 말한다", () => {
  /**
   * 🔴 이것은 「확장이 안 된다」는 고백이 아니라 «지금 사실» 의 고정이다.
   * Core 는 중립이지만 CommerceWorkspace 의 수정 orchestration 은 아직 한 채널만
   * 잇는다(`/api/smartstore/registered-product` 를 직접 부른다). 두 채널의
   * capability 가 UNKNOWN 인 동안은 이을 대상이 없으므로 그것이 정직한 상태다.
   *
   * 🔴 그런데 이 사실이 «어디에도 적혀 있지 않으면» 다음 사람이 Core 가 중립이라는
   * 것만 보고 「세 채널이 이미 된다」고 읽는다. 여기서 세어 둔다 — 두 번째 채널이
   * 이어지는 날 이 테스트가 빨개지고, 그때 같이 고쳐야 하는 자리가 드러난다.
   */
  const workspace = code(
    readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"),
  );

  it("수정 기준값을 읽는 라우트 호출이 지금은 smartstore 하나뿐이다", () => {
    const calls = [...workspace.matchAll(/\/api\/(\w+)\/registered-product/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(0);
    expect([...new Set(calls)]).toEqual(["smartstore"]);
    expect([...new Set(calls)]).toEqual(EDIT_ADAPTER_COMMERCE_IDS);
  });

  it("registered-product 라우트가 존재하는 채널도 그 하나뿐이다", () => {
    for (const id of CHANNELS) {
      const exists = (() => {
        try {
          readFileSync(join(__dirname, `../../../api/${id}/registered-product/route.ts`));
          return true;
        } catch {
          return false;
        }
      })();
      expect(exists, `${id}/registered-product 라우트 존재 여부가 어댑터 등록과 어긋난다`).toBe(
        EDIT_ADAPTER_COMMERCE_IDS.includes(id as CommerceId),
      );
    }
  });
});
