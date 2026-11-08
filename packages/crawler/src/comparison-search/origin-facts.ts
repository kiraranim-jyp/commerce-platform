import { type ProductFacts, type ProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { attachProductEvidence } from "./product-evidence";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 COMMON-EVIDENCE-1 — **원상품 facts 의 «단일 owner»**(CPO 승인 2026-11-08)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **A6 에서 무엇이 왜 깨졌는가 — 호출만 복구하지 않고 원인을 고친다**
 *
 * ```
 * 원인  Evidence 합성이 **owner 가 아니라 «호출부» 에 있었다.**
 *       MI-L1 은 운영 호출부 3곳만 `attachProductEvidence(...)` 로 감쌌고
 *       GT 하니스·E2E 하니스는 감싸지 않았다 ⟹ **같은 원상품인데 facts 가 갈렸다.**
 * 증상  `SPRINT2-QUERY-PARITY` **Q-4** 가 그 갈림을 FAIL 로 잡았다
 *       (러너 문자열 `facts: productFactsFromIdentityDna(input.dna)` 가 사라졌다).
 * 🔴 그 계약이 막는 것은 **「하니스가 운영과 다른 facts 로 발견량을 재는 거짓 측정」** 이고
 *    그것은 **지켜야 하는 계약** 이다 ⟹ 🔴 **완화하지 않는다.**
 * 🟢 해결  **합성을 owner 안으로 옮긴다.** 그러면 양쪽이 **같은 함수 하나** 를 부르므로
 *    갈릴 구조가 **사라진다**(호출부 5곳이 동의해야 하는 문제가 없어진다).
 * ```
 *
 * 🔴 **왜 `shared` 가 아니라 여기인가**(A3-a 가 보류된 그 이유):
 * ```
 * productFactsFromIdentityDna  packages/shared     — 원상품 DNA → facts
 * attachProductEvidence        packages/crawler    — facts → facts + evidence
 * 🔴 `packages/shared/package.json` 의 dependencies 는 **{}** 다 ⟹ shared 는
 *    crawler 를 import 할 수 **없다**(순환 의존). 🟢 crawler 는 shared 를 import 한다.
 * ⟹ 🟢 **합성의 유일한 가능 위치가 crawler** 다. 등록부 소유 계층을 옮기지 않는다.
 * ```
 *
 * 🟢 **후보 경로와 «같은 모양» 이 된다** — 후보는 이미 그렇게 하고 있었다:
 * ```
 * 후보   product-url-facts.ts:412 · :593
 *        attachProductEvidence(recoverModelCodeFromDetail(facts))   ← facts owner 안
 * 원상품 origin-facts.ts (이 파일)
 *        attachProductEvidence(productFactsFromIdentityDna(dna))    ← facts owner 안
 * ```
 * 🔴 그래서 이 파일은 **새 생산 규칙을 만들지 않는다** — 기존 둘을 **합성만** 한다.
 *    🔴 `recoverModelCodeFromDetail` 은 **부르지 않는다** — 그것은 후보 페이지 HTML 에서
 *       품번을 복구하는 함수이고 원상품 DNA 에는 그 입력이 없다(없는 것을 만들지 않는다).
 */
export function originFactsFromIdentityDna(dna: ProductIdentityDna): ProductFacts {
  return attachProductEvidence(productFactsFromIdentityDna(dna));
}
