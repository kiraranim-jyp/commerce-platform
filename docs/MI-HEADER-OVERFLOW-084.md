# WU-084 — Header overflow 일반화 검증 + 공통 fetch 복구 (구현 + 배포)

> 🔴 CPO 지시 2026-10-19. 「Smallable 전용 수정이 아니라, **공통 fetch 계층에서 안전하게
> 처리할 가치가 있는지**만 확정한다」 · hostname 조건 ❌ · 무차별 retry ❌

---

# WU-084 FINAL

## 1. Header overflow 재현 결과 — 🟢 **재현됨**

```
Smallable 응답 헤더 **19,197B** · Node `fetch`(undici) 기본 상한 **16,384B**
  16,384B → 🔴 Parse Error: Header overflow
  65,536B → 🟢 200 · 본문 745,320B
```

## 2. 관측 분모 — 🔴 **1 호스트**

**91 URL / 41 호스트** 전수(WU-076 ②통과 후보 + Smallable)를 `fetch` 로 돌려 **여섯으로 갈랐다**:

| 분류 | 건수 |
|---|---:|
| **A Header overflow** | **1** (`www.smallable.com`) |
| B network (`UND_ERR_SOCKET` 4 · `CONNECT_TIMEOUT` 1) | 5 |
| D HTTP 404 / 403 / 503 | 5 / 2 / 2 |
| F 정상 | **76** |

🔴 **분모를 숨기지 않는다 — overflow 호스트는 하나다.**

## 3. overflow 판별 방법 — 🟢 **안정적으로 가능**

```
err.cause.code === "UND_ERR_HEADERS_OVERFLOW"      ← undici 전용 코드
🔴 `TypeError: fetch failed` «문구» 로 판단하지 않는다 — 실측:
   DNS 실패  → cause.code = ENOTFOUND     (같은 문구)
   연결 거부  → cause.message = "bad port" (같은 문구)
```

## 4. 공통 retry — 🟢🟢 **이미 있는 폴백을 재사용한다(새 fetch 방식 0)**

```
`fetchWithDomainRateLimit` 에는 **429 폴백** 이 이미 있다 → `retryThroughDirectStack`
   → `fetchHtmlDirect`(direct-html-fetch.ts)
🟢 그 경로는 **`maxHeaderSize: 64 * 1024`** 를 이미 쓴다
🟢 그리고 **SSRF/DNS-rebinding 계약을 지킨다** — `classifyOutboundUrl` + `lookup: guardedLookup`
   (WU-025/026). 🔴 `node:https` 를 새로 부르면 그 가드를 **우회** 했을 것이다.
⟹ 후보 A(overflow 일 때만 1회) 채택 · 후보 B(무차별) **미채택**
```

## 5~8. 구현 / 변경량 / hostname

```
packages/crawler/src/rate-limit/domain-rate-limiter.ts   **1 파일 · +33줄**
  + isHeadersOverflow(error)            — 전용 코드로만 판별
  + fetchGuarded 를 try/catch 로 감싸고 **overflow 에서만** retryThroughDirectStack
  🔴 직접 스택도 실패하면 **원래 오류를 던진다**(조용히 삼키지 않는다)
🔴 hostname 조건 **0** · Smallable 문자열 **0** · 새 fetch 구현 **0** · 새 상수 **0**
```

## 4-b. 성능 / 안정성

| 항목 | 결과 |
|---|---|
| 정상 URL 1차 성공 | 🟢 retry **없음**(계약으로 잠금) |
| Header overflow URL | 🟢 2차 성공 |
| DNS 실패 / 연결 거부 | 🟢 retry **없음** · 원래 오류 전파 |
| HTTP 4xx/5xx | 🟢 오류가 아니므로 **그대로 반환** · retry 없음 |
| 평균 요청 횟수 | 🟢 **불변** — Smallable 실측 `httpCalls: 1` |
| final URL | 🟡 직접 스택 경로는 `Response.url` 이 빈 문자열 — 🟢 WU-075 의 `|| url` 폴백이 받는다(B4 계약) · 🔴 **429 폴백도 전부터 같다**(이번에 생긴 성질이 아니다) |
| soft-404 / product evidence | 🟢 불변(그 판정은 HTML 을 보고 한다) |

## 9. Smallable E2E — 🟢🟢 **UNREACHABLE → OK**

운영 owner `factsFromProductUrl` 실측:

```
status      UNREACHABLE  →  **OK**
fetchPath   PLAIN_HTML      (불변)
httpCalls   —            →  **1**  (요청이 늘지 않았다)
title       null         →  "Bobo Choses - Bobo Choses Organic Cotton T-shirt - Ecru | Smallable"
brand       null         →  **"Bobo Choses"**
price       null         →  **{ 82673, KRW }**
modelCode   null         →  **null**  🟢 **그대로다 — 페이지에 없으니 만들지 않았다**
colorText   null         →  null      🔴 색상 생산자가 제목 전용이라서다(WU-064 계약 · 이번 범위 밖)
```

🔴 **`B226AC112` 를 생성하거나 추론하지 않았다**(WU-083 REJECT 유지).

## 10. 기존 seller 회귀

🟢 공식몰 `OK`(SHOPIFY_JSON) · 국내 `miniboutique` `OK`(PLAIN_HTML) · SSG `NOT_PRODUCT_URL`
— **셋 다 WU-083 측정과 동일**.

## 11~13. regression / typecheck / build

```
apps/admin  **595 files / 8,333 passed** / failed **0** (skipped 102)
typecheck **0** · build **exit 0** · WU-083 baseline(594/8,328)에서 **+1 file / +5 test**
🟢 fetch 계약 동반 확인 — WU-025 · WU-026 · outbound-guard · WU-075 · mi-020 전부 통과
```

### 🟢 회귀가 **수정을 증명했다**(§10 포착)

```
wu-083-smallable-sku › `expect(pages.SMALLABLE.owner.status).toBe("UNREACHABLE")` 가 **FAIL**
🟢 **그것이 수정의 증거다**(쿠팡 고시 선례와 같은 방식).
조치: 계약을 **갱신** 했다 — 현재는 `OK` · `httpCalls 1` · brand/price 단언을 **추가** 하고,
      원인 기록(헤더 19KB > 16KB)은 주석으로 **남겼다**.
```

**Mutation** — baseline 5 passed
| | 변형 | 결과 |
|---|---|---|
| M1 | 모든 실패에 무차별 retry | 🔴 **1 failed** |
| M2 | 폴백 자체 제거 | 🔴 **2 failed** |
| M3 | 실패를 조용히 삼킨다 | 🔴 **1 failed** |
| M4 | **「문구」로 판별**(금지한 방법) | 🔴 **1 failed** |
| — | 원상복구 | 🟢 5 passed |

## 14~15. commit / production

push 완료 · `clean` · `behind/ahead 0 0` · Production **200**.

## 16. 🟢 **GO** — §7 의 10조건 대조

```
① overflow 재현          🟢      ⑥ 무차별 retry 아님        🟢
② 안정적 판별            🟢      ⑦ final URL/soft-404/evidence 회귀 0  🟢
③ 공통 계층 적용 가능     🟢🟢    ⑧ Smallable E2E 정상       🟢
④ hostname 조건 없음     🟢      ⑨ regression 0             🟢
⑤ 정상 URL retry 없음    🟢      ⑩ 운영 가치                🟡 **분모 1 호스트**
```

🔴 **⑩만 약하다 — 그것을 숨기지 않는다.** 그럼에도 GO 로 판단한 근거 셋:
```
⒜ 변경이 **기존 폴백 재사용** 이라 새 위험 표면이 없다(+33줄 · 새 fetch 0 · 새 상수 0)
⒝ **overflow 에서만** 돈다 — 정상 76건에 영향 0 이 계약으로 잠겼다
⒞ CEO 가 Smallable 을 **핵심 소싱원** 으로 지목했고, 그 전까지 그 사이트는
   **구조적으로 영구 차단** 상태였다(파싱 불가가 아니라 우리 상한 때문)
```

## 17. 운영상 의미

```
🟢 Smallable 이 **MI 입력으로 들어온다** — brand · 상품명 · 가격(KRW) · 사이즈.
🔴 그렇다고 **SAME 이 되는 것은 아니다**:
   · modelCode **없음**(WU-083) → 품번 축 사용 불가
   · colorText **null** → 색상 축도 지금은 비어 있다(WU-064 계약 · 별 사안)
   · price 가 **KRW 인데 `.com`** → `classifyCandidateMarket` 가 **UNKNOWN**(WU-051 대로 올바르다)
   ⟹ 해외/국내 **어느 금액 축에도 들어가지 않는다.** 🟢 화면 후보로는 보인다.
🔴 즉 이번 수정은 **「Smallable 을 비교에 넣었다」가 아니라 「입구를 열었다」** 다.
   그 다음 단계(색상 축·시장 판정)는 **별 사안이고 이 WU 가 건드리지 않았다.**
```

## CEO Action — **없음**
