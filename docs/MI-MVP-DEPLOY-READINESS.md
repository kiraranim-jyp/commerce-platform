# MVP 서비스 검증 전환 — 배포 준비 상태 점검

> 🔴🔴 **결론: 배포할 것이 «없다».** 런타임 변경 **0** 이고 MVP 흐름은 **이미
> Production 에 떠 있다.** → CPO 지시 ①~③ 의 답이 「최소 변경 0」 이고
> ④ 배포는 **불필요** 하다. ⑤⑥ CEO 테스트는 **지금 바로 가능하다.**
> 🔴 단 push 는 하지 않았다(아래 §4).

---

## 1. ① 최소 변경 정리 — **0**

```
git -c core.quotepath=false diff --name-only origin/main..HEAD
  | grep -avE "__tests__|^docs/|^CLAUDE.md$"
→ 출력 **없음**
```

🟢 **52커밋 전부가 `__tests__/` · `docs/` · `CLAUDE.md` 다.** 런타임 코드·DB·설정
변경이 **한 줄도 없다.** 🔴 그러므로 「서비스에 올릴 최소 변경」을 정리할 대상이
**존재하지 않는다.**

---

## 2. ② MVP 흐름이 UI 에서 쓸 수 있는가 — 🟢 **이미 배포돼 있다**

핵심 파일이 **`origin/main`(= 배포본)에 전부 있다**:
```
🟢 apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx
🟢 apps/admin/src/app/api/price-history/check/route.ts
🟢 apps/admin/src/app/today/page.tsx
```

### Production 실측 (read-only GET)

| URL / 경로 | 응답 | 해석 |
|---|---|---|
| `https://ttaejyo.vercel.app` | **HTTP 200** | 🟢 살아 있다 |
| `https://commerce-platform-mocha.vercel.app` | **HTTP 200** | 🟢 살아 있다 |
| `/pipeline` | **307** | 🟢 로그인 리다이렉트 — **정상 보호** |
| `/today` | **307** | 🟢 같음 |
| `/api/price-history/check` | **401** | 🟢 인증 요구 — **정상 보호** |

🔴 **307/401 을 「route 가 없다」로 읽지 않는다** — 헌장 §10 과 메모
`production-307-is-not-route-evidence` 가 못박은 함정이다. 🟢 여기서는 **보호가
작동한다는 증거**로만 쓴다. 🔴 인증 뒤 화면은 CTO 가 열 수 없다(CEO 몫).

🟢 Vercel 프로젝트: `commerce-platform`(`prj_A1E0oIpZuKnygWBGyjS9WrnoE71Y`).

---

## 3. ③ 최소 UI 연결 수정 — **불필요**

🟢 ②에서 확인했듯 UI → API → MI → 가격 → 셀러 문구 경로가 **이미 떠 있다.**
그리고 선행 WU 들이 그 경로의 산출을 실측했다:
```
🟢 computeSellerAction 이 셀러 문구를 만든다(signals 46건 산출 · 선행 WU)
🟢 price-hierarchy.ts:453 이 「환율 환산이 아닙니다」를 문장으로 명시한다
🟢 DB price_alerts 에 실제 행 6개(PRICE_GAP 3 · ORIGIN_TREND 3)
```
🔴 **고칠 연결을 찾지 못했다.** 없는 결함을 만들지 않는다.

---

## 4. ④ 배포 — 🔴 **하지 않았다. 그리고 할 필요가 없다**

```
🟢 런타임 변경 0 이므로 push 해도 **기능이 1g 도 바뀌지 않는다**
🔴 그런데 push 는 Vercel 배포를 «트리거» 한다(헌장 §8 · 메모
   vercel-deploy-from-repo-root) → 기능 변화 0 인 재배포를 CTO 가 임의로
   일으키지 않는다
🔴 그리고 §12 에 **CEO 결정 A~E** 가 대기 중이다. push 는 그 결정과 묶여 있다
→ 🟢 **CEO 테스트는 «지금 배포된 것» 으로 바로 할 수 있다.** 배포를 기다릴
   이유가 없다.
```

---

## 5. ⑤⑥ CEO 테스트 — 🟢 **지금 가능하다**

🔴 **CTO 가 CEO 에게 직접 요청하지 않는다**(헌장 §3 — CTO→CEO 직행 금지).
CPO 가 「테스트 URL + 상품 URL + 클릭 순서 + 기대 결과」를 한 번에 전달한다고
했으므로, **그 재료만** 아래에 준비했다.

### 테스트 URL
```
https://ttaejyo.vercel.app/today        (가격 일괄 확인 · 목록)
https://ttaejyo.vercel.app/pipeline     (상품별 MI 상세)
🔴 둘 다 로그인이 필요하다(307)
```

### 넣을 실제 상품 — 🟢 **DB 에 있는 실상품이고 CTO 가 이미 E2E 로 돌렸다**

| | 상품 | 원상품 URL | 🟢 CTO 실측 결과 |
|---|---|---|---|
| **A** | Louise Misha Astrid Organic Cotton Jacket (Cream) | `smallable.com/en/product/astrid-organic-cotton-jacket-cream-louise-misha-381712` | 후보 **17** · verdict `SIMILAR 3 · CONFLICT 3 · UNKNOWN 11` · 🔴 **SAME 0** |
| **B** | Bobo Choses Boo Bo Choses T-shirt (`B226AC002`) | `bobochoses.com/products/b226ac002-boo-bo-choses-t-shirt` | 후보 **6** · verdict `SIMILAR 1 · UNKNOWN 4 · CONFLICT 1` · 🔴 **SAME 0** |

### 기대 결과 — 🔴 **「GO」가 나오지 않는 것이 정상이다**

```
🟢 보여야 하는 것
   · 해외 원본 가격이 **원본 통화** 로 표시된다(EUR) — KRW 로 둔갑하지 않는다
   · 국내 후보가 목록으로 뜨고 각 후보에 **유사/불일치 근거** 가 붙는다
   · 「동일상품 확인」 버튼으로 사람이 SAME 을 확정할 수 있다(links PATCH)
   · 원가 기준이 「한국 표시가」면 **「환율 환산이 아닙니다」** 가 문장으로 뜬다

🔴 보이지 «않아야» 하는 것
   · 다른 상품(데님셔츠·쁘띠북·양말)이 **동일상품으로 승격되어 가격 비교에
     들어가는 것** — 그것이 나오면 **FAIL** 이다
   · 데이터가 없는데 「추천/GO」가 뜨는 것

🔴 즉 이번 테스트의 질문은 「SAME 이 나오는가」가 **아니다.**
   **「정보가 부족할 때 제품이 그것을 정직하게 말하는가」** 다.
```

---

## 6. 🔴 CEO 가 봐야 할 한 가지 (CPO 가 정한 질문)

> 「이 서비스가 내가 상품을 소싱/등록할 때 실제로 쓸 만한 정보를 주는가?」

🔴 CTO 가 미리 답하지 않는다. 다만 **측정으로 아는 것**은 적어 둔다:
```
🟢 해외 원가·통화·국내 후보 목록·근거 문구는 **나온다**(실측)
🔴 「동일상품 확정 + 가격 비교」까지 가는 상품은 **55/498 = 11.0%** 다(선행 WU)
🔴 그 11% 의 상한은 **국내 샵이 해외 품번을 적는가** 이고 코드가 아니다
```

## 7. Known Unknowns

```
🔴 인증 뒤 **실제 렌더**는 CTO 가 확인할 수 없다(메모
   production-payload-is-unreachable). 소스 경로로만 추적했다
🔴 배포본(origin/main 1f030313)이 **실제로 떠 있는 빌드인지** 확정하지 못했다 —
   빌드 로그의 `Commit:` 줄을 읽어야 하고 그건 인증이 필요하다
   (메모 production-307-is-not-route-evidence)
🔴 위 상품 A/B 가 **그 CEO 계정 workspace 에 있는지** 확인하지 않았다 —
   스냅샷은 workspace 에 귀속되고 링크 보유 workspace 는 2곳뿐이다(선행 WU)
🔴 CTO 의 E2E 는 운영 owner 직접 호출이었다. UI 를 거친 결과와 같다는 보장은
   **소스 경로 추적** 수준이고 렌더 실측이 아니다
```
