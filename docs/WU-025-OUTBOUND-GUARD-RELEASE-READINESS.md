# WU-025 — WU-024 Production Release Readiness (2026-10-15)

🔴 **이 문서는 «기록» 이다. 착수점이 아니다.** 현재 상태와 다음 범위는 `CLAUDE.md` §12 가
유일한 source of truth 다.

🔴 **비용/호출 전수**: AI **0** · Gemini **0** · 외부 검색 API **0** · 키 발급 **0** ·
결제 **0** · DB 쓰기 **0** · migration **0** · Registry **0** · threshold **0** ·
새 패키지 의존성 **0** · Production 배포 **0**. 쓴 것은 공개 상품 페이지 **HTTP GET 45회**(E2E 재검증).

---

## 1. 최종 판정 — 🟡 **HOLD**

```
SSRF root cause 확정        🟢 완료 (§2 — 경로 전수 · 두 outbound 스택)
SSRF 방어 구현              🟢 완료 (§3 — 3층 · 사본 0 · 새 의존성 0)
공격 변형 negative test     🟢 완료 (§4 — 42변형 + 변이 9종)
정상 URL regression         🟢 완료 (§5 — GT E2E **값 변화 0** · 50행 동일)
release boundary 실측        🟢 완료 (§6 — 🔴🔴 **64커밋 중 운영 코드는 6커밋뿐**)
Production 투입             🔴 **HOLD** — 남은 것은 «배포 승인» 하나다(§6-5)
```

🔴 **GO 로 적지 않는 이유 하나**: §11 의 GO 는 「… 그때만 배포」다. 그런데 배포(= `main`
머지)는 **CPO 가 이 지시서에서 명시적으로 보류** 했고(「64커밋을 합칠지 여부도 지금
결정하지 않습니다」), 헌장 §8 이 CTO 의 임의 머지를 금지한다. 🟢 **기술 전제는 전부
충족** 됐다 — 막는 것은 코드가 아니라 **권한** 이다.

---

## 2. SSRF root cause — 문자열 하나가 아니었다

### 2-1. 🔴 먼저 **CPO 보고의 전제 하나를 정정** 한다

> CPO: 「`169.254.169.254/products/x` 가 통과했다」

🟢 **WU-024 «이전» 에 통과했다**가 정확한 표현이다. WU-024 가 입력 경계를 열면서
`isPubliclyRoutableHttpUrl` 을 **같이** 넣었으므로 그 문자열은 WU-024 시점에도 이미 막혔다.
🔴 **그러나 CPO 의 판단은 결과적으로 옳았다** — 그 층만으로는 **닫히지 않았고**, 실제로
열려 있던 것은 **문자열이 아닌 두 가지** 였다(아래 2-3).

### 2-2. outbound 경로 전수 — **스택이 둘이다**

```
사용자 입력 URL
 → extractCandidateUrlsFromAiAnswer   입력 경계(모양만)
 → classifyUrlShape                   `/products/` 가 있으면 PRODUCT_PAGE
 → factsFromProductUrl
     ├ Shopify JSON ─┐
     └ fetchPlainHtml┤
                     ▼
     ① fetchWithDomainRateLimit  →  **global fetch(undici)**   호출부 **24곳**
                                     🔴 기본값 `redirect: "follow"` = undici 내부 추적
     ② fetchHtmlDirect           →  **node:https / node:http** 호출부 **6곳**
                                     (①의 429 폴백이 ②로 내려온다)
```
🟢 그 밖의 raw `fetch` 는 **고정 호스트** 뿐이다(Gemini · Naver DataLab · Rakuten API).
🟢 `image-evidence.ts:29` 은 후보 이미지 URL 을 받지만 **transient 경로에서 도달하지 않는다** —
`computeMinImageDistance` 가 `judgeDomesticCandidate` 에서 불리지 않고, 일시 분기가 Vision
**앞** 에서 `continue` 한다(WU-024 구현). 🔴 그래서 범위에 넣지 않았다(임의 확대 금지).

### 2-3. 🔴🔴 실제로 열려 있던 둘

```
❶ **리다이렉트** — `evil.com/products/x` → 302 → `http://169.254.169.254/…`
   첫 홉만 검사되고 추적은 **undici 안에서** 일어난다 → 두 번째 홉은 아무도 안 본다
❷ **이름 해석** — `127.0.0.1.nip.io/products/x` 는 **정상 DNS 이름** 이다.
   문자열 층을 그대로 통과하고 해석 결과가 루프백이다
🔴 그리고 ❶❷는 **문자열 blacklist 로 영원히 닫히지 않는다** — 목적지를 봐야 한다
```

🟢🟢 **반대로 「비표준 IP 표기」는 이미 닫혀 있었다 — 실측으로 확정했다**:
```
new URL("http://0x7f000001/")   → hostname "127.0.0.1"
new URL("http://2130706433/")   → hostname "127.0.0.1"
new URL("http://017700000001/") → hostname "127.0.0.1"
new URL("http://0x7f.0.0.1/")   → hostname "127.0.0.1"
new URL("http://127.1/")        → hostname "127.0.0.1"
new URL("http://010.0.0.1/")    → hostname "8.0.0.1"   ← 🔴 **진짜 공개 주소** 다
```
🔴 즉 WHATWG 파서가 **정규화** 하므로 점4개 IPv4 규칙 하나로 충분하다. 🔴 **8진/16진을
손으로 다시 해석하지 않는다** — 그러면 파서와 **두 해석** 이 생기고 갈라지는 쪽이 구멍이 된다.
🔴 `010.0.0.1` 을 「선행 0 이라 수상하다」로 막으면 **정상 목적지를 막는 것** 이다.

---

## 3. 방어 — **3층 · 사본 0 · 새 의존성 0**

```
① 문자열 (순수)   scheme · 포트 · host 모양 · 예약 TLD        classifyOutboundUrl
② 이름 해석       host → 해석되는 **IP 전부** 가 공개인가      assertPublicOutboundTarget
③ 연결 시점       node:http(s) `lookup` 훅                    guardedLookup
리다이렉트        **우리가** 따라간다(`redirect: "manual"`) + 홉마다 ①②        fetchGuarded
```

| 공격면(CPO 목록) | 막히는 층 | 상태 |
|---|---|---|
| localhost · loopback | ① | 🟢 |
| private IPv4 (RFC1918) | ① | 🟢 |
| link-local(IMDS) | ① | 🟢 |
| IPv6 loopback/ULA/link-local | ① | 🟢 |
| 비표준 IP 표기 | 파서 정규화 + ① | 🟢 (실측) |
| scheme 우회 | ① | 🟢 |
| port 우회 | ① | 🟢 |
| hostname → private IP | ② | 🟢 |
| **redirect → private** | 🔴 **홉마다 ①②** | 🟢 |
| **DNS rebinding** | ③ | 🟡 **스택별로 다르다**(§7) |

🔴 **fail-closed 다** — 해석 실패(`DNS_UNRESOLVED`)도 **막는다**. 「모르면 통과」를 만들면
경계의 존재 이유가 사라진다. 🟢 가용성 손실은 없다 — 해석되지 않는 이름은 어차피 연결되지 않는다.

🔴 **WU-024 의 중복을 지웠다** — `url-candidate-pool.ts` 가 자기 IP 표를 들고 있었다.
지금은 `classifyOutboundUrl` **하나를 호출** 한다(규칙이 둘이면 한쪽만 고쳐진다).

### 3-1. 🔴🔴 `node:dns` 를 «동적» import 하는 이유 — 실측으로 강제됐다

```
정적 import → next build **실패**:
  the chunking context (unknown) does not support external modules (request: node:dns)
  Import trace: pipeline/page.tsx [Client Component Browser]
```
🔴 이 모듈은 `domain-rate-limiter` → `universal-extractor` → … 로 **클라이언트 번들
그래프에 닿는다**(기존 구조 · 이 WU 가 만든 것이 아니다). `node:https` 와 달리 **`node:dns`
에는 브라우저 shim 이 없다** — 이 저장소는 같은 계열을 이미 적어 뒀다(P-9-A: 「Node 전용
모듈(tls/fs)이 브라우저 번들에 끌려 들어와 next build 가 깨진다」).

🔴 **「서버 전용 파일로 옮기면 된다」가 해법이 아니었다** — 깨뜨린 자리가 이미 서버 전용
파일이었다(bisect 로 확인: `direct-html-fetch` 의 import 를 떼도 계속 깨졌다).
🟢 동적 import 는 그 chunk 참조를 만들지 않는다(정적 → 실패 · 동적 → `node:dns` 에러 **0**).
🟢 모듈 핸들은 한 번만 받고 캐시한다. 🔴 `undici` 의 `dispatcher` 로 `fetch` 에 같은 훅을
꽂는 방법도 **동작을 실측했지만**(§7) 패키지 의존성 추가라 채택하지 않았다.

---

## 4. 음성대조 — 공격 변형 42 + 변이 9종

```
공격 변형 42종(①표) · 정상 URL 11종 **전부 통과 유지**
변이  M1 문자열 층 무력화                 58 FAIL
      M2 DNS 사설검사 제거                 4 FAIL
      M3 redirect manual → follow          6 FAIL
      M4 DNS 실패 fail-open                1 FAIL
      M5 검사를 fetch «뒤» 로 이동          3 FAIL
      M6 node:https 의 guardedLookup 제거   1 FAIL
      M7 direct-html-fetch 문자열 검사 제거  1 FAIL
      M8 guardedLookup 이 필터 안 함         1 FAIL
      M9 admin 쪽이 IP 표를 다시 들고 있다  20 FAIL
원상복구  122 passed
```

🔴🔴 **M5 가 처음에 «통과» 했다 — 그리고 그것은 가드 공백이 아니라 «변이가 적용되지
않은» 것이었다.** perl 치환 패턴이 안 맞아 파일이 그대로였다. 🔴 **적용되지 않은 변이는
통과하는 가드처럼 보인다** — 다시 적용해 확인하니 **3 FAIL** 이었다.
🟢 그래서 이 트랙의 함정 목록에 하나를 더한다: **변이가 실제로 적용됐는지 먼저 확인한다.**

🔴 **negative test 목록에 «정상 URL» 을 같이 넣은 덕에 내 가드의 결함을 잡았다** —
TLD 정규식이 `[a-z]{2,63}` 이라 **punycode 국가 TLD(`xn--3e0b707e` = .한국)를 막고 있었다.**
막는 것만 세면 보이지 않는 종류다.

---

## 5. 정상 경로 regression — **값 변화 0**

```
GT LIVE E2E 재실행(실제 HTTP 45회 · 운영 판정 함수)
  rows 50 → 50 · **값 변화 0 · 사라짐 0 · 새로생김 0**
  GT SAME → 버려짐 **증가 0**     GT DIFFERENT → EXACT 승격 **0 (변화 없음)**
  Registry-outside candidate → transient 진입 **31/31 유지**
  KRW 가격 **6샵 전부 동일** (88,000 · 59,000 · 226,000 · 258,000 · 117,000 · 117,000)
회귀  admin **547 files / 7,979 passed · failed 0 · skipped 76**
      (WU-024 기준 546/7,907 → **+72 = 신규 테스트 수와 일치**)
typecheck **0** = 기준선 · build **exit 0** · eslint 변경 전과 동일
```

🔴 **기존 테스트 1건의 fixture 를 고쳤다 — 가드를 느슨하게 하지 않았다.**
`rate-limit-429-fallback.test.ts` 가 가짜 호스트로 **`.test`**(RFC 2606 예약 TLD)를 쓰고
있었다. 그 TLD 는 공개 인터넷에서 해석되지 않고 내부 resolver 가 사내 호스트로 매핑할 수
있는 자리라 **막는 것이 맞다.** 🟢 고친 쪽은 fixture 호스트이고, **DNS 도 모킹** 해서
그 단위 테스트를 hermetic 하게 만들었다(전에는 아무것도 모킹하지 않았다).

---

## 6. 🔴🔴 release boundary 실측 — **「64커밋」은 과대평가였다**

```
origin/main  9e0ef9e8   behind 0 / ahead 64
```

### 6-1~2. WU-024 가 의존하는 커밋 / Production 에 넣으면 안 되는 것

🔴 **64커밋 중 «운영 코드» 를 건드린 것은 6커밋뿐이다**(테스트·문서·스크립트 제외 · 실측):

| 커밋 | 운영 파일 | WU-024 의존 | Production 동작 변화 |
|---|---|---|---|
| `db534289` 009C | `self-reference.ts`(+`canonicalizeProductUrl`) · `index.ts` · `snapshots/_lib/snapshot.ts` | 🔴 **필수** | 🟡 **있다** — 스냅샷 저장 URL 이 정규화된다 |
| `23a924fa` 017-1 | `ai-answer-urls.ts`(신규) · `index.ts` | 🔴 **필수** | 🟢 **없다**(호출부 0) |
| `05000080` 017-2 | `ai-answer-pool.ts`(신규) · `index.ts` | ⚪ 불필요 | 🟢 없다(호출부 0) |
| `d17808b5` 017-E2E | `ai-answer-pool.ts` · `url-shape.ts` | 🔴 **필수** | 🟡 **있다** — 비-Shopify 에서 쿼리 식별자를 **보존** 한다 |
| `cf225a40` 019A-ALT-3 | `discovery-url-identity.ts`(신규) · `index.ts` | ⚪ 불필요 | 🟢 없다(호출부 0) |
| `54fe6541` 024 | 운영 6파일 | — | 🟢 **없다** — `candidateUrls` 미공급이면 한 줄도 안 돈다 |
| (WU-025) | `outbound-guard.ts`(신규) · `domain-rate-limiter.ts` · `direct-html-fetch.ts` · `index.ts` · `url-candidate-pool.ts` | — | 🟡 **있다** — 모든 crawler outbound 요청에 목적지 검사 1회 |

🔴 `d17808b5` 의 `url-shape.ts` 변경이 **WU-024 E2E 의 전제** 다 — 그것 없이는 국내
Cafe24 계열(`?branduid=` · `?product_no=`)의 상품 식별자가 날아가 GT 후보를 읽지 못한다.

### 6-3~4. WU-024 만 release 가능한가 / 최소 release set

🔴 **단독 cherry-pick 불가** — `ai-answer-urls.ts` 와 `canonicalizeProductUrl` 이
`origin/main` 에 **없다**(실측: 파일 2개 부재 · 함수 grep 0건).

🟢🟢 **그런데 그것이 문제가 아니다 — 최소 release set 과 전체 머지가 «운영상 동등» 하다**:
```
최소 set   db534289 · 23a924fa · d17808b5 · 54fe6541 (+WU-025)   운영 4~5커밋
전체 머지  64커밋 — 🟢 나머지 **58커밋은 테스트·문서·스크립트만** 건드린다
→ 🔴 그래서 **cherry-pick 을 할 이유가 없다.** 충돌 위험(같은 `index.ts`·`ai-answer-pool.ts`
   를 연속 수정)을 감수하며 쪼개도 **Production 에 가는 코드가 같다.**
```

### 6-5. 🔴 그 release set 이 헌장상 Production 허용 범위인가 — **CPO 판정 사안 셋**

```
① db534289 — 스냅샷 `source_url` 정규화가 **저장되는 값** 을 바꾼다(병합은 안 한다).
   🟡 테스트·음성대조는 끝나 있다. 🔴 「저장 값 변경」의 배포 승인은 받은 적이 없다
② d17808b5 — `toCrawlerUrl` 이 비-Shopify 쿼리를 보존한다 → **운영 국내/Gemini 경로의
   fetch 대상 URL 이 바뀐다**(개선 방향이지만 동작 변화다)
③ WU-025  — **모든 crawler outbound 요청** 에 ⒜ DNS 조회 1회(지연) ⒝ 리다이렉트를
   우리가 추적 ⒞ 사설/예약 목적지 차단이 붙는다. 🟢 회귀·E2E 로 변화 0 을 측정했다
```
🔴 **CTO 는 머지하지 않았다.** 승인되면 **머지 한 줄** 이고 그때 **한 번** 배포된다.

---

## 7. 🔴 남는 위험 — 숨기지 않는다

```
🟡 DNS rebinding(TOCTOU)이 **스택별로 다르다**
     node:https 경로  🟢 닫혔다 — `lookup` 훅이 **연결에 쓰이는 해석** 을 거른다
     fetch 경로       🟡 열려 있다 — 검사와 connect 사이에 해석이 바뀌면 다른 IP 로 간다
   🟢 닫는 기전은 **실측했다**: 외부 `undici` `Agent` 를 global fetch 의 `dispatcher` 로
      넘기면 `connect.lookup` 이 호출되고, 그 훅이 에러를 내면 **요청이 나가지 않는다**.
   🔴 채택하지 않은 이유 — `packages/crawler` 에 **패키지 의존성 추가** 가 필요하고
      그것은 이 WU 의 범위를 넘는다(`undici` 는 `apps/admin` 에만 선언돼 있다).
   🔴 창의 크기: 공격자가 **우리 요청 시점에 맞춰 DNS 를 뒤집어야** 하고 TTL 캐시를
      이겨야 한다. 🔴 「없다」로 적지 않고 **CPO 판정 사안** 으로 남긴다.
🟡 AI 붙여넣기 경로(`collectAiAnswerCandidatePool`)는 **운영 호출부가 0** 이라 노출이 없다.
   🟢 단 그 경로도 ①②③ 아래에 있다(같은 fetch 스택을 쓴다) — 배선할 WU 가 재확인한다.
🟡 Playwright 경로는 이 가드 밖이다(브라우저가 자기 스택으로 연결한다). 🔴 사용자 URL 이
   그 경로로 가지 않는 것은 확인했다(`factsFromProductUrl` 은 Playwright 를 쓰지 않는다).
```

---

## 8. (F) JSON-LD 가격 강등 — **원인과 영향만 확정 · 수정 0**

```
발생 조건 셋이 **동시에** 성립할 때만
  ① 비-Shopify 후보(= `htmlPath` 경로)
  ② 그 페이지에 JSON-LD `offers.price` **와** `priceCurrency` 가 둘 다 있다
  ③ `withConfidence` 를 통과한다(= 모든 transient 경로)
원인 사슬
  product-url-facts.ts:250   `priceStatus:"VERIFIED_CURRENT"` 는 넣고
                             🔴 **`priceSource:"detail"` 은 넣지 않는다**
  match.ts:463 derivePriceStatus  `priceSource !== "detail"` → **무조건 덮어쓴다**
  price-source-adapter.ts:250-255 선두에서 전 후보를 초기화하고 **Shopify handle 만** 승격
```

🔴 **영향 범위 — `priceStatus` 를 읽는 운영 소비자는 «셋» 이다**(전수 grep):
```
run-domestic-price-check.ts:1268  transient `priceKrw` 게이트       → null (집계 제외)
lib/price-truth.ts:14             `isPriceDisplayable`              → 화면 금액 표기 게이트
lib/seller-decision.ts:48         `READY_TO_LIST` 승격 게이트        → `NEEDS_RECHECK` 상한
```

🔴🔴 **그래서 「한 줄 추가」가 아니다** — `priceSource:"detail"` 을 넣으면 세 번째 소비자가
**판매 판정을 `READY_TO_LIST` 로 올릴 수 있다.** 즉 이것은 **제품 정책 결정**
(「상세 페이지의 JSON-LD 를 '검증된 가격'으로 인정하는가」)이고 코드 수정이 아니다.

🟢 **WU-024/025 와의 관계**: 이 결함은 **WU-024 가 만든 것이 아니다**(`factsFromProductUrl`
은 선행 WU 산출물이고 Gemini pool 이 이미 그것을 쓴다). 🔴 다만 WU-024 가 **더 자주
발화시킨다** — 국내 Cafe24 후보가 늘어나기 때문이다(실측 6/6 전부 `UNVERIFIED_SEARCH`).

🟡 **별도 WU 필요 여부 — 필요하다. 단 «코드 WU» 가 아니라 «정책 결정 + 그 뒤 구현» 이다.**
🔴 지금 SSRF 와 **같은 WU 에서 섞지 않았다**(CPO 지시대로).

---

## 9. 완료 조건 10 자가점검

```
① SSRF root cause 확정            🟢 §2 (스택 둘 · 열려 있던 둘 · 이미 닫혀 있던 것)
② SSRF 방어 구현                  🟢 §3 (3층 · 사본 0 · 새 의존성 0)
③ 공격 변형 negative test         🟢 §4 (42변형 + 변이 9종 · 전부 FAIL → 복구)
④ 정상 URL regression             🟢 §5 (정상 11종 유지 · 회귀 7,979)
⑤ WU-024 GT E2E 재검증            🟢 §5 (50행 **값 변화 0**)
⑥ 기존 가격비교 경로 regression    🟢 §5 (admin 전수 · failed 0)
⑦ typecheck/build/regression      🟢 §5 (0 · exit 0 · failed 0)
⑧ 64커밋 dependency/boundary 실측  🟢 §6 (운영 6커밋 · 최소 set == 전체 머지)
⑨ Production 투입 가능 여부        🟢 **판정했다 — HOLD**(남은 것은 배포 승인 하나)
⑩ JSON-LD 후속 처리 필요성         🟢 §8 (필요 · 단 «정책 결정» 이고 코드 WU 가 아니다)
```

**CEO Action: NONE.** 🔴 이 단계는 CEO 테스트 단계가 아니다.
