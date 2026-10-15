# WU-026 — fetch 경로 DNS rebinding 차단 + Release Gate (2026-10-15)

🔴 **이 문서는 «기록» 이다. 착수점이 아니다.** 현재 상태는 `CLAUDE.md` §12 가 owner 다.

🔴 **비용/호출 전수**: AI **0** · Gemini **0** · 외부 검색/AI API **0** · 키 **0** · 결제 **0** ·
DB 쓰기 **0** · migration **0** · Registry **0** · threshold **0** · Production 배포 **0**.
쓴 것은 공개 상품 페이지 **HTTP GET 45회**(E2E 재검증)뿐이다.
🟡 **새 의존성 1건** — `undici@^7.0.0`(`packages/crawler`). 🟢 `apps/admin` 이 이미 쓰던
**같은 7.29.0** 이라 트리에 사본이 늘지 않았다(근거는 §3 축⑤).

---

## 1. 최종 판정 — 🟡 **HOLD**

```
① fetch DNS rebinding root cause 확정   🟢 §2 (측정: lookup 1 → 2)
② 실제 방어 구현                        🟢 §4 (connect 시점 고정)
③ DNS rebinding 공격 테스트             🟢 §5 (실 fetch · 패킷 0)
④ redirect + DNS 결합 공격              🟢 §5
⑤ mutation                              🟢 §6 (6종 전부 FAIL · 적용 여부 먼저 확인)
⑥ WU-024 정상 E2E 결과 보존             🟢 §7 (**값 변화 0** · 50행 · 6 KRW · 31/31 · 45 HTTP)
⑦ typecheck / regression / build         🟢 §7 (0 · 8,002 passed · exit 0)
⑧ client bundle 안전성                   🟢🟢 §4-2 (`node:dns`·`undici`·`node:net` **0** ·
                                            번들이 기준선보다 **59,404 bytes 작아졌다**)
⑨ Production release set 확정            🟢 §8 (운영 커밋 **8** · 나머지 57은 테스트·문서)
⑩ 최종 판정                              🟡 **HOLD** — 아래 한 줄 때문이다
```

🔴🔴 **보안 차단점은 닫혔다.** CPO 가 지명한 blocker(fetch 경로 rebinding)는 해결됐고
**실 네트워크로 증명** 했다(§5-3). 🔴 그런데 배포를 CTO 가 하지 않는다 — release set 안에
**WU-024/025/026 과 무관한 «기존» 동작 변화 둘** 이 들어 있고(§8-3) 그 제품 수용 판단은
CPO 몫이다. 🟢 승인되면 **머지 한 줄** 이고 기술 검증은 전부 끝나 있다.

---

## 2. root cause — **해석이 «두 번» 일어난다** (측정)

```
우리 검증 lookup                1회
  → fetch("https://example.com/")
전체 lookup                     **2회**      ← 두 번째는 undici 의 connector 가 한 것
우리가 본 IP                    104.20.23.154 / 172.66.147.243
🔴 그 두 번째 해석은 **우리 규칙을 통과하지 않는다** → 검증한 IP 와 연결한 IP 가
   같다는 보장이 없다(TOCTOU · DNS rebinding)
```

🔴 `node:http(s)` 는 `lookup` 옵션을 **직접** 받아 WU-025 에서 이미 닫혔다.
🔴 `fetch` 는 그 훅을 **dispatcher 를 통해서만** 받는다 — 그래서 fetch 경로만 열려 있었다.

---

## 3. 전수검토 10축 — **해법을 사전 가정하지 않았다**

| 축 | 판정 | 근거 |
|---|---|---|
| ① 현재 dispatcher 재구성 | 🔴 불가 | 기본은 undici **global agent** 이고 Node 는 그것의 connector 를 바꿀 API 를 **노출하지 않는다** |
| ② `node:https` 훅 재사용 | 🔴 **채택 안 함** | 그 스택으로 **전부** 옮기면 24개 호출부의 전송 스택이 바뀐다. 🔴 이 저장소가 측정해 둔 「undici 429 ↔ node:https 200」(Cloudflare) 차이 때문에 **결과가 달라진다** — 「기존 crawler 결과 변화 최소화」와 충돌 |
| ③ fetch 에 custom dispatcher | 🟢 **채택** | `fetch(url,{dispatcher})` 가 외부 Agent 를 받고 `connect.lookup` 이 불린다 — **실측** |
| ④ 기존 dependency 활용 | 🔴 불가 | crawler 의 기존 트리(playwright 계열)에 Dispatcher 구현이 없다. `undici` 는 `apps/admin` 에만 선언돼 있어 crawler 에서 **해석 불가**(실측 `MODULE_NOT_FOUND`) |
| ⑤ `undici` 의존성 추가 | 🟡 **채택(비용 있음)** | Node 코어가 `Agent` 를 노출하지 않으므로 ③의 전제다. 🟢 `^7.0.0` = admin 과 **같은 7.29.0** → 사본 0. 🔴 번들 영향은 ⑩에서 **측정** 했다 |
| ⑥ DNS 결과 pinning | 🔴 불가 | URL 의 host 를 IP 로 바꿔 넣으면 **TLS SNI/인증서가 깨진다**(https). `fetch` 는 `servername` 을 받지 않는다 |
| ⑦ socket 직전 목적지 검증 | 🟢 **= ③ 과 같은 것** | connector 의 `lookup` 이 바로 그 자리다. 이름을 다시 해석하는 것이 아니라 **연결에 쓰이는 해석** 을 거른다 |
| ⑧ redirect 별 재검증 | 🟢 **이미 있다 + 유지** | WU-025 가 `redirect:"manual"` + 홉마다 ①② 재검사를 넣었다. 🟢 홉마다 **같은 dispatcher** 가 실리는 것을 테스트가 단언한다 |
| ⑨ 다른 outbound 경로와 통합 | 🟢 **통합됨** | 두 스택이 **같은 `guardedLookup`** 을 쓴다(`node:https` 는 옵션으로, `fetch` 는 Agent 로). 사설 IP 규칙의 owner 는 **그 함수 하나** |
| ⑩ 새 의존성/번들/서버·클라 경계 | 🔴🔴 **여기서 진짜 문제가 나왔다** | 아래 §4-2 |

---

## 4. 구현

### 4-1. connect 시점 고정

```
outbound-guard.ts
  outboundDispatcher()   await import("undici") → new Agent({connect:{lookup: guardedLookup}})
                         🔴 못 만들면 **던진다**(fail-closed · 유일한 fail-closed 사유)
                         🟢 한 번 만들어 캐시 — 요청당 비용이 아니다
  guardedLookup          호출될 때마다 **기록** 한다(통과/차단 무관)
domain-rate-limiter.ts
  fetchGuarded           dispatcher 획득 → 홉마다 ①② → fetch(..., {dispatcher})
                         → 훅이 관측되지 않으면 **로그 한 줄**(`[WU-026-guard]`)
```

🔴🔴 **「훅이 안 불렸으면 던진다」로 먼저 만들었고, 그것을 걷어냈다.** `fetch` 를 stub 하는
**기존 테스트 9파일 / 30건** 이 전부 깨졌다 — 그 stub 들은 connector 가 아니므로 우리
lookup 을 부를 이유가 없다. 🔴 즉 그 단언은 **보안을 더하지 않고 하니스만 묶었다.**
🟢 그래서 역할을 갈랐다 — **고칠 수 있는 것은 fail-closed**(dispatcher 생성 실패),
**환경 사실은 관측**(로그), **실제 적용 증명은 LIVE E2E**(§5-3).

### 4-2. 🔴🔴 client bundle — **여기서 1MB 회귀를 만들었고 되돌렸다**

```
dispatcher 를 붙인 직후 측정:
  client 청크의 undici 참조  기준선 **0파일** → **1파일**(973KB 청크에 undici 전체)
  🔴 원인은 dispatcher 가 아니라 **값 import 사슬** 이었다:
     display-priority → match-truth → cross-seller → match → domestic-identifiers
                      → foretforet → **domain-rate-limiter**(= fetch 스택)
  🔴 즉 화면이 쓰는 **정렬 함수 하나** 가 crawler 의 fetch 스택 전체를 브라우저로 끌고 있었다
     (기존 구조 · 이 WU 가 만든 것이 아니다 — WU-025 의 `node:dns` 빌드 실패도 같은 뿌리였다)
```

🟢🟢 **고친 방법은 leaf 분리 하나다** — `MATCH_TRUTH_RANK`(6줄 상수)와 `MatchTruth` 타입을
`match-truth-rank.ts`(의존 **0**)로 빼고, `match-truth.ts` 가 **그대로 re-export** 한다
(기존 import 경로 전부 무변경 · 로직 **한 줄도** 안 바뀜).

```
사슬         15모듈(fetch 스택 도달) → **2모듈**(순수)
client 청크  2,108,160 → **2,048,756 bytes**  🟢 기준선보다 **59,404 bytes 작다**
client 참조  node:dns **0** · undici **0** · node:net **0**
```
🔴 이 성질은 **테스트로 잠갔다** — 누가 `display-priority` 에 판정 로직을 다시 끌어오면
사슬 추적 테스트가 터진다.

---

## 5. 공격 검증 (네트워크 0 · 패킷 0)

```
직접 접근 42변형            🟢 WU-025 하니스가 담당(사본 금지 · 재작성하지 않았다)
DNS  hostname → public       🟢 통과 유지
     hostname → private      🟢 차단(②)
     🔴🔴 public → private rebinding  🟢 **차단**(③ · 아래)
     private → public         🟢 **검증 단계에서** 차단 — 연결 시도 0(lookup 1회로 끝)
     공개/사설 혼합           🟢 차단
redirect  public → public            🟢 그대로 따라간다
          public → private(IP)       🟢 2홉에서 차단 · 요청 1건만 나갔다
          public → 이름이 사설 해석   🟢 2홉에서 차단
          홉마다 dispatcher           🟢 **같은 dispatcher 가 모든 홉에 실린다**
```

### 5-3. 🔴🔴 rebinding 차단의 «실제» 증명

```
단위 테스트  **실 global fetch + 실 undici Agent** · DNS 만 모킹
             호출 1(검증) = 공개 · 호출 2(connect) = 사설 → **요청이 나가지 않는다**
             🟢 패킷 0 — 우리 훅이 connect «전» 에 끊는다
LIVE E2E     **실 네트워크 45요청** · `connectGuardHosts = 32`
             🟢 즉 런타임이 dispatcher 를 **실제로 honor 한다**(stub 으로는 증명 불가한 부분)
```

---

## 6. Mutation — 6종 전부 FAIL · 원상복구 95 passed

```
M1 dispatcher 를 넘기지 않는다            8 FAIL
M2 connect 훅을 Agent 에 꽂지 않는다      2 FAIL
M3 dispatcher 실패를 삼킨다(fail-open)    1 FAIL
M4 관측 로그 제거(조용한 우회)             2 FAIL
M5 훅 기록을 «성공할 때만»                 1 FAIL
M6 화면용 leaf 를 판정 모듈로 되돌린다      1 FAIL   ← 번들 누수 재발 방지
원상복구                                  95 passed
```

🔴 **변이가 실제로 적용됐는지 먼저 확인했다**(WU-025 에서 적용 안 된 변이를 「통과」로
읽었던 실수). 적용 스크립트가 패턴 불일치 시 **종료 코드 1** 로 멈춘다.
🟢 그리고 **M3·M5 는 처음에 통과했다** — 단언이 없었기 때문이다. 둘 다 단언을 추가해
FAIL 로 바꿨다(「dispatcher 실패는 반드시 throw」· 「차단된 홉도 기록된다」).

---

## 7. 정상 경로 · 품질

```
WU-024 GT LIVE E2E   rows 50 → 50 · **값 변화 0 · 사라짐 0 · 새로생김 0**
                     KRW 6샵 동일 · transient 샵 조합 **31 → 31** · HTTP **45**
회귀                 admin **548 files / 8,002 passed · failed 0 · skipped 76**
typecheck            **0** = 기준선        build **exit 0**
client bundle        node:dns/undici/node:net **0** · 기준선보다 59,404 bytes 작다
```

🔴 **기존 하니스 2건을 손봤다 — 가드를 느슨하게 하지 않았다**:
① `rate-limit-429-fallback` 에 **fake timer 를 켜기 전 dispatcher 워밍** 추가.
   dispatcher 첫 생성이 **실제 동적 import** 라 fake timer 아래 첫 로드가 끝나지 않는다
   (실측 15초 timeout). 🟢 운영에는 fake timer 가 없고 캐시되므로 요청당 비용도 아니다.
② WU-025 하니스의 stub 이 **connector 의 이름 해석을 흉내내도록** 보강(새 관측 계약 반영).

---

## 8. Release boundary — 재산출

```
origin/main  9e0ef9e8   behind 0 / ahead **65**(WU-026 커밋 전) → 커밋 후 66
```

### 8-1~2. 의존 그래프 (실측)

```
WU-026 → WU-025(outbound-guard) → WU-024(url-candidate-pool)
                                 → db534289(canonicalizeProductUrl)
                                 → 23a924fa(ai-answer-urls)
                                 → d17808b5(url-shape — Cafe24 쿼리 식별자 보존)
🟢 WU-026 이 고친 파일은 **전부 origin/main 에 이미 있다**(limiter · direct-html-fetch ·
   display-priority · match-truth) → 선행 파일 부재 문제는 **WU-024 쪽** 뿐이다
🔴 `undici` 는 main 의 crawler package.json 에 **없다** → WU-026 이 추가한다(lock 포함)
```

### 8-3. 🔴 「전체 65커밋이 운영상 동등하다」 재검증 — **여전히 참이다**

```
운영 코드를 건드린 커밋  **8**  (db534289 · 23a924fa · 05000080 · d17808b5 ·
                                cf225a40 · 54fe6541 · d28708f2 · WU-026)
나머지                   **57** — 테스트 · 문서 · DB 덤프 스크립트만
→ 🟢 최소 release set 과 전체 머지가 **운영상 동등** 하다 → cherry-pick 할 이유가 없다
   (쪼개면 같은 `index.ts`·`ai-answer-pool.ts` 를 연속 수정한 커밋들이 충돌한다)
```

### 8-4. 🔴 그래서 남은 것 — **제품 수용 판단 둘 + 배포 승인**

```
① db534289  스냅샷 `source_url` 정규화 → **저장되는 값** 이 바뀐다(병합은 안 한다)
② d17808b5  `toCrawlerUrl` 이 비-Shopify 쿼리를 보존 → 운영 fetch 대상 URL 이 바뀐다
   🔴 ①②는 **WU-024/025/026 과 무관한 «기존» 변경** 이고 배포 승인을 받은 적이 없다
③ WU-025/026  모든 crawler outbound 에 목적지 검사 + connect 고정이 붙는다
   🟢 회귀·E2E 로 **값 변화 0** 을 측정했다 · 🟡 요청당 DNS 조회 1회가 더해진다
🔴 CTO 는 머지하지 않았다. 승인되면 머지 한 줄이고 기술 검증은 끝나 있다.
```

---

## 9. 남는 위험

```
🟢 fetch rebinding            **닫혔다**(connect 시점 고정 · 실 네트워크로 증명)
🟢 node:https rebinding       닫혀 있다(WU-025)
🟡 「런타임이 dispatcher 를 무시」  코드가 고칠 수 없는 환경 사실 → **로그로 관측**
   (`[WU-026-guard]` · Vercel 런타임 로그에서 읽는다). 🟢 현재 런타임에서는 적용됨을 실측
🟡 요청당 DNS 조회 1회 추가     해석 실패는 어차피 연결 불가이므로 가용성 손실은 없다
🟡 Playwright 경로는 이 가드 밖  🟢 사용자 URL 이 그 경로로 가지 않는 것은 확인했다
🟡 AI 붙여넣기 경로            운영 호출부 **0** — 같은 fetch 스택 아래 있으므로 가드는 적용된다
```

---

## 10. (§9) JSON-LD 가격 강등 — **수정 0 · 기록만**

```
발생 조건  ① 비-Shopify 후보(htmlPath) ② JSON-LD 가격+통화 둘 다 있음 ③ withConfidence 통과
원인 사슬  product-url-facts.ts:250 `priceSource:"detail"` 미설정
           → match.ts:463 derivePriceStatus 가 **무조건** UNVERIFIED_SEARCH 로 덮어쓴다
           → price-source-adapter.ts:250-255 가 Shopify handle 만 승격
영향 범위  `priceStatus` 소비자 **셋**
           run-domestic-price-check:1268  transient priceKrw 게이트 → null
           lib/price-truth.ts:14          화면 금액 표기 게이트
           lib/seller-decision.ts:48      🔴 **READY_TO_LIST 승격 게이트**
WU-024 관계 🟢 WU-024 가 만든 결함이 **아니다**(선행 산출물 · Gemini pool 이 이미 사용)
            🔴 다만 **더 자주 발화시킨다** — 국내 Cafe24 후보가 늘어난다(실측 6/6)
별도 WU    🟡 **필요하다. 단 «코드 WU» 가 아니라 «정책 결정 + 그 뒤 구현» 이다** —
           `priceSource:"detail"` 을 넣으면 **판매 판정이 READY_TO_LIST 로 올라갈 수 있다**
```

**CEO Action: NONE.**
