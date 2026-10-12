# MI-GEMINI-INTEGRATION-005 — 진행 중 (WU 미완)

> 🔴🔴 **이 WU 는 끝나지 않았다.** 헌장 「컨텍스트가 부족해지면 결과를 중간
> 제출하지 않고 상태를 보존하고 다음 실행에서 같은 WU 를 계속한다」에 따라
> **선행 사실과 원자적 변경만** 남긴다.
> 🔴 **Production 연결(`run-domestic-price-check.ts`)은 아직 하지 않았다** —
> 그 파일은 여전히 **0줄 변경** 이다. Gemini 는 **비활성** 이다.

---

## 1. 🟢 이번 실행에서 끝낸 것 — wrapper 계약 확장 (원자적)

🔴 **WU-1 의 내 wrapper 가 §10 비용 측정을 «구조적으로» 못 했다.**
`{outcome, urls, failureDetail}` 만 돌려주고 `provider.usage()` 를 밖으로 내보내지
않았다 → provider 인스턴스가 함수 안에서 죽으므로 **상품당 토큰을 셀 길이 없었다.**

```
ProductionDiscoveryResult 에 추가
  usage: GoogleDiscoveryUsage | null
  model: string | null
🔴 null = 「호출 자체를 안 했다」(CONFIG_MISSING). **0 과 구분한다.**
🟢 provider 를 try «밖» 에서 만든다 — 안에서 만들면 예외 시 usage() 를 읽을 길이
   없고 **실패한 호출의 토큰이 집계에서 사라진다.**
```

🔴 그 과정에서 `provider.model()` 로 **추측** 했다가 `TS2339` 를 냈다. 실제는
**`modelName()`** 다. 🔴 이 트랙에서 칸/메서드 이름을 추측해 틀린 것이 **다섯 번째** 다.

## 2. 🔴🔴 §10 요구 항목 중 **하나는 측정 불가** 다

```
GoogleDiscoveryUsage(google-discovery.ts:123)가 내놓는 것은 다섯뿐이다:
  requests · promptTokens · candidatesTokens · thoughtsTokens · totalTokens
🔴 **groundingQueries 는 «없다».** grounding 쿼리 수는 응답 usageMetadata 에
   들어오지 않는다 → 지시서 §10 의 `groundingQueries` 는 **현재 구조에서 측정 불가** 다.
🔴 0 으로 적지 않는다. 🟢 측정하려면 응답 본문의 grounding 메타를 파싱하는
   별 작업이 필요하고, 그것은 이 WU 범위가 아니다.
```

## 3. 🟢 §12 가 요구한 실제 모델 — 확인했다

```
DEFAULT_MODEL = "gemini-flash-latest"        google-discovery.ts:52
resolveModel  = options?.model ?? process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL   :265
🔴 `scripts/.env` 에 GEMINI_MODEL 이 **없다** → 기본값 `gemini-flash-latest` 가 쓰인다
FETCH_TIMEOUT_MS = 90000 (:61)
🔴 **가격은 적지 않는다.** `gemini-flash-latest` 는 **별칭** 이고 어느 버전으로
   해석되는지 코드로 알 수 없다. 공식 단가를 확인할 수 없으므로 §12 대로
   **추정해서 확정값처럼 적지 않는다.**
```

## 4. 🔴 feature flag — 기존 규약이 **없다**

```
grep: apps/admin/src/app/api/price-history/_lib/ 에 process.env.MI_* / *_ENABLED → **0건**
→ 🔴 기존 체계를 따를 수 없다. 새로 정해야 하고, 지시서 §13 이 예시로 준
   `MI_GEMINI_DISCOVERY_ENABLED=false` 를 쓰는 것이 맞다(기본 OFF).
🔴 단 그 결정은 Production 파일을 건드리는 순간과 묶이므로 다음 실행에서 한다.
```

## 5. 🔴 다음 실행이 이어서 할 것 (순서 고정)

```
① run-domestic-price-check.ts 에 flag + Gemini 분기 추가 (기본 OFF)
   🔴 searchResults 생성 뒤에 **append** 하되 §3 의 scope 적용이 선행이다
② scope — isBatchSurveyTarget 정책을 Gemini 후보에도 적용
   🟢 wrapper 가 `preferredDomains` 를 받으므로 **주입 경로가 이미 열려 있다**
   🔴 테니스 원상품에 아동복 후보가 섞이지 않는지가 §17-B 의 PASS 조건이다
③ normalized URL dedupe (기존 domestic 결과와 중복 제거)
④ 후보 cap N — 🔴 임의 확정 금지. 실측 기준으로 정하고 네 숫자를 따로 기록
   (발견 / usable / MI eligible / 실제 validation)
⑤ 저장 금지 분기 — source_id 없는 후보는 upsert 하지 않는다(일시 pool)
⑥ E2E — 아동복 + 테니스 실상품 · OFF/ON 비교 · 비용 실측
⑦ negative test — CONFIG_MISSING · API_FAILURE · timeout · 0 candidate
⑧ 전체 회귀 + typecheck + 가드
```

## 6. 현재 상태

```
Production runtime 변경   **0**  (run-domestic-price-check 0줄)
DB / schema               **0**
Gemini 활성화             🔴 **아니다**
변경 파일                 discovery-core/production-discovery.ts **하나**
crawler typecheck         2 = baseline (추가 0)
discovery 테스트          105 passed / 0 failed
```

🔴 **베이스라인 재확인** — crawler 전체에서 `match-truth-priority.test.ts` 수집 실패
1건은 `@/lib/supabase-admin` 미해결이고 **baseline** 이다(내 변경과 무관).
