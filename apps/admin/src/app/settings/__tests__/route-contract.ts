import { vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 계약대로 대답하는 fetch — **URL 만 보고 대답하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 생겼나(CPO 2차 감사, 2026-09-28)
 *
 * 「롯데ON 연결」 화면은 Production 에서 **한 번도 동작한 적이 없었다**.
 *
 *     route.ts                  export async function GET()   ← 핸들러는 이것뿐
 *     LotteOnDeliveryMapping    fetch(".../delivery-settings", { method: "POST" })
 *                               → 405 → 목록 0건 → 고를 수 없음 → 저장 없음
 *                               → 상품 화면 전부 「선택 안 함」
 *
 * 그런데 내 렌더 검사 11건은 **전부 통과했다.** 스텁이 URL 만 보고 대답했기
 * 때문이다 — POST 로 부르든 GET 으로 부르든 같은 목록을 돌려줬다.
 *
 * 🔴 실제와 «다른 모양» 을 흉내 낸 검사는 통과해도 아무것도 증명하지 않는다.
 * 이 스프린트에서 같은 계열로 세 번 틀렸고(조건이 발동 안 함 · 표시만 보고
 * 상태를 놓침 · 메서드를 무시함) 이것이 세 번째다.
 *
 * 그래서 여기서는 라우트가 «실제로 내보내는 핸들러» 만 응답하고,
 * 나머지 메서드에는 Next.js 가 하는 그대로 **405** 를 돌려준다.
 */

export interface RouteContract {
  /** `/api/lotteon/delivery-settings` 처럼 경로 그대로. */
  path: string;
  /** 라우트 파일이 `export` 하는 핸들러만 적는다. 없는 메서드는 405 가 된다. */
  handlers: Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", RouteHandler>>;
}

/** 요청 본문을 받아 `{ ok, body }` 를 돌려준다. 본문 검사도 여기서 한다. */
export type RouteHandler = (request: { body: unknown }) => { ok?: boolean; status?: number; body: unknown };

export interface StubbedCall {
  path: string;
  method: string;
  body: unknown;
  status: number;
}

/**
 * 계약을 주면 `fetch` 를 대신 꽂고, 오간 요청을 기록해 돌려준다.
 *
 * 🔴 계약에 없는 경로는 404, 계약에 있으나 핸들러가 없는 메서드는 405 다.
 * 둘을 구분하는 이유는 「주소를 잘못 썼다」와 「메서드를 잘못 썼다」가
 * 서로 다른 결함이기 때문이다 — 이번에 난 것은 후자다.
 */
export function stubRoutes(contracts: RouteContract[]): StubbedCall[] {
  const calls: StubbedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown, init?: { method?: string; body?: string }) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body ? safeParse(init.body) : undefined;
      const contract = contracts.find((c) => url.split("?")[0].endsWith(c.path));

      if (!contract) {
        calls.push({ path: url, method, body, status: 404 });
        return Promise.resolve(response(404, { ok: false, message: "not found" }));
      }
      const handler = contract.handlers[method as keyof typeof contract.handlers];
      if (!handler) {
        /* 🔴 Next.js 가 하는 그대로다. 본문은 비어 있고 상태만 405 다 —
           화면이 `res.ok` 만 보면 「불러오지 못했습니다」로 떨어진다. */
        calls.push({ path: contract.path, method, body, status: 405 });
        return Promise.resolve(response(405, {}));
      }
      const result = handler({ body });
      const status = result.status ?? (result.ok === false ? 500 : 200);
      calls.push({ path: contract.path, method, body, status });
      return Promise.resolve(response(status, result.body));
    }),
  );
  return calls;
}

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
