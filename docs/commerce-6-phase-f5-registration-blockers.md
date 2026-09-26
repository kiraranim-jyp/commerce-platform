# Commerce-6 F-5 — 미확인 항목 확정 · 아동의류 실등록 잔여 blocker

> CTO(2026-09-26). **코드 변경: 회귀 테스트 1개뿐.** DB 0 · migration 0 · push 0.
>
> 🔴 이번 Phase 의 결론은 **「코드로 해결할 blocker 가 없다」** 이고,
> 그 판정에 이르는 과정에서 **위임 조사의 P0 세 건을 전부 뒤집었다.**

---

## 1. F-4 §7 Production 검증 7건 — 상태 확정

| # | 항목 | 상태 | 근거 / 이유 |
|---|---|---|---|
1 | 89 `OPLC_CD` 실제 응답 | **UNKNOWN** | 저장소 실측 0건. 로컬에 롯데ON 자격증명 없음. 🔴 원산지 자동화의 **유일한 해제 조건** |
2 | `lotteon_seller_settings` 행/값 | **UNKNOWN** | `vercel env pull` 이 Sensitive 값을 주지 않아 DB 접근 불가(C-1) |
3 | `coupang_seller_profiles` is_default 행의 값 | **UNKNOWN** | 같음. 🟡 행 수 3 · 나머지 2행 null 은 059/062 기록으로 **CONFIRMED** |
4 | `seller_settings` 다섯 칸의 값 | 🟡 **부분 CONFIRMED** | 1행 · `manufacturer = NULL` 은 `059:91`·`062:46` 기록으로 확정. 나머지 네 칸 값은 UNKNOWN |
5 | 쿠팡 출고지 ↔ 롯데ON 출고지 동일성 | **NOT_REQUIRED** | 🔴 자동 병합을 하지 «않기로» 확정했다(Phase C §2 — 동일성은 셀러가 선언). 확인해야 할 이유가 사라졌다 |
6 | 166 배송비정책 내부 필드(금액) | **NOT_REQUIRED** | 🔴 배송비 통합 금지 확정(Phase B §5). 금액을 읽을 이유가 없다. 정보로서는 UNKNOWN |
7 | `DV_CO_CD` 값 목록 | **NOT_REQUIRED** | 🔴 택배사 채널 간 변환을 하지 «않기로» 확정(F-3 §3). 목록이 없어도 설계가 성립한다 |

```text
UNKNOWN 3  ·  부분 CONFIRMED 1  ·  NOT_REQUIRED 3  ·  IMPLEMENTATION_CANDIDATE 0
```

🔴 **`IMPLEMENTATION_CANDIDATE` 가 0인 것이 이번 판정의 핵심이다** — 7건 중 어느 것도
「지금 구현해도 되는 상태」에 도달하지 않았다.

---

## 2. 원산지 자동화 — **불가 확정, 현상 유지**

```text
필요한 것   89 OPLC_CD 의 cdNm 이 «무엇인지» 한 번만 보면 된다
가진 것     응답 «구조» 뿐 — { cd, cdNm }   (common-codes/route.ts:63-70)
            🔴 값의 «형식» 은 실측 0건
```

🔴 **픽스처를 근거로 승격하지 않았다.** `originCode: "KR"` · `"XX"` 는 우리
`__tests__` 의 mock 이고, 롯데ON 응답이 아니다. 조사 보고가 이것으로
「`KR`/대한민국 · `US`/미국」 예시를 만들어 냈으나 **날조다.**

### 판정

```text
Common origin text → LotteON origin binding      ❌ 설계하지 않는다
현재의 도움말 방식(e5aec1a)                        ✅ 그대로 유지하고 끝낸다
```

`e5aec1a` 가 한 것은 데이터 계약이 아니라 **문구 한 줄**이다 —
`originPickerNote()` 가 Common 원산지 텍스트를 그 칸 도움말에 실어 상품정보 탭
왕복을 없앤다. 금지 항목(`resolveNaverOriginArea` · `COUNTRY_NAME_KO` ·
하드코딩 국가코드 · `4279402`)은 **코드에 0건**으로 확인했다.

---

## 3. Seller Common — migration 없음 (유지)

```text
Common 의미상 필요 가능성        있음
3 Commerce payload 소비처        0
seller_settings workspace 격리   🔴 되어 있지 않다
   reader 가 .is("workspace_id", null) 로 «레거시 한 행» 만 읽는다(:132·:295)
   059: 「NULL 은 전역이 아니라 귀속을 확인할 수 없는 레거시다」
```

🔴 지금 칸을 늘리면 **15개 워크스페이스가 한 행을 공유하는 구조를 그대로 확장**한다.
Beta Security 격리와 결합하기 전에는 추가하지 않는다. **이번에도 migration 0.**

---

## 4. `brand_intro` — 문서상 최종 사실 유지

```text
배선  ✅ 세 채널이 전부 brandIntro 를 조립 함수에 넘긴다
조립  ✅ assembleContentsFromBlocks:518 이 BRAND_INTRO 를 처리한다
블록  🔴 defaultDetailBlocks():414-424 에 없고, 만드는 코드가 저장소 전체 0건
결과  🔴 현재 등록 payload 에 «도달하지 않는다»
```

기본 블록 자동 생성은 Common 매핑 문제가 아니라 **상품 상세페이지 정책 변경**이므로
F-5 에서 구현하지 않았다.

---

## 5. 🔴 위임 조사의 P0 세 건을 뒤집었다

이번에도 보고를 그대로 쓰지 않았다. **세 건 모두 「입력 경로가 없다」는 주장이었고,
셋 다 사실이 아니다.**

| 주장 | 실제 | 근거 |
|---|---|---|
「롯데ON 전시카테고리 선택 화면이 **없다**」 | 🔴 **있다** | `:1196` 설명 · `:1261` 「전시카테고리번호(dcatLst) 쉼표 입력칸」 · `:760` 표준카테고리를 고르면 `displayCategoryNos` 가 **함께 채워진다** · `lotteon-picked-category.test.ts:125-127` 이 그 자동 반영을 고정 |
「롯데ON KC 인증정보 입력 경로가 **없다**」 | 🔴 **있다** | `:1644` `value={form.certification.safetyText}` 입력칸 렌더 · `:444` `safetyMissing` 판정 · 🔴 `:437` 주석은 「푸는 길이 없었다」는 **과거형**(이미 고쳐진 기록) · 테스트 `:509` 「유아동(23)은 안전인증이 들어가야 등록 가능성이 100%가 된다」 |
「쿠팡이 variant 2개를 items 1개로만 등록한다」 | 🔴 **아니다** | `:1534-1537` 「옵션이 있으면 variant별로 item을 하나씩 만든다」 · `:1559` `variantSlots.map(variant => buildCoupangItem(...))` — 인용된 `registration-reverse-verification-report.md` 가 **그 수정 이전 문서**다 |

🔴 **패턴이 반복된다**: 「화면에서 못 찾았다」를 「없다」로 적는 것. F-4 §0 의 판정
기준이 여기서도 그대로 적용된다 — **찾지 못한 것은 없는 것의 근거가 아니다.**

§7 에 이 세 사실을 고정하는 회귀 테스트를 추가했다.

---

## 6. 아동의류 3-Commerce 실등록 잔여 blocker

### 6-1. 결론

```text
🔴 코드로 해결 가능한 P0 :  «없다»
```

`commerce-4-children-fashion-completion.md`(커밋 `7c3cca9`)의 결론이 **Commerce-5/6
이후에도 그대로 유효**하다. 그 사이 등록 게이트는 한 줄도 바뀌지 않았다 —
`lotteon/register/route.ts` 의 마지막 변경은 `de0f2a5`(P0-CHANNEL-03 F-12a)로
Commerce-5 «이전»이다.

### 6-2. 채널별 상태 (A=구현 · B=Production 검증)

| | CREATE | ChannelProduct | UPDATE | RECREATE | 막는 것 |
|---|---|---|---|---|---|
**SmartStore** | **A+B** (`13713593585` 외) | A+B | **A+B** | A+B | — |
**Coupang** | **A+B** (`16394846257`) | A+B | 🔴 UNKNOWN(의도) | A (카테고리 변경 시) | Seller 화면 확인(사람) |
**LotteON** | **A** · 🔴 **B 없음** | A · B 미확인 | 🔴 UNKNOWN(의도) | — 발행 경로 없음 | 🔴 **Production 실행 1건** |

`CHANNEL_CAPABILITY`(`channel-lifecycle.ts:87-92`)와 `EDIT_ADAPTERS`(`smartstore` 하나)가
일치하고, `commerce3-capability-parity` 가 그 일치를 테스트로 막고 있다.
🔴 **UNKNOWN 둘은 실패가 아니라 조사 부채이고, 의도적으로 유지한다.**

### 6-3. 실제 남은 것 — 전부 **코드 밖**

| # | 채널 | 무엇 | 코드로 가능? | 필요한 것 |
|---|---|---|---|---|
**P0-1** | LotteON | Production CREATE 가 **한 번도 확인되지 않았다** | 🔴 **불가** | CEO 가 아동의류 1건 등록 → `spdNo`·`epdNo`·`returnCode` 회신 |
**P1-1** | Coupang | 기등록 상품이 Seller 화면에서 **의도대로 보이는지** | 🔴 불가 | CEO 가 Wing 에서 `16394846257` 확인 |
**P1-2** | Coupang | UPDATE capability 실측 | 🔴 불가 | `DEBUG_COUPANG_PROBE_TOKEN` 값(비밀 — 요구하지 않음) 또는 CEO 가 probe 1회 호출 |
**P1-3** | LotteON | UPDATE(apiNo 90) 계약 | 🔴 불가 | P0-1 성공이 선행. 그 전엔 만들지 않는다 |

🔴 **셀러가 화면에서 풀 수 있는 것**(설정 4값 입력 · 카테고리 선택 · KC 입력)은
전부 **입력 경로가 이미 있다**(§5). 코드 결함이 아니다.

### 6-4. CTO 가 Production 을 실행할 수 없는 이유 (재확인)

```text
로컬 자격증명   Supabase · 네이버 · 쿠팡 · 롯데ON 전부 «없음»
vercel env pull Sensitive 값 42/51 이 빈 문자열(C-1 에서 확인)
실등록          되돌리기 어려운 «외부» 행위 — 명시적 승인 없이 누르지 않는다
```

---

## 7. 이번에 추가한 것 — 회귀 테스트 하나

`commerce6-f5-registration-facts.test.ts` — §5 에서 뒤집은 세 사실을 고정한다.
**같은 오해가 반복되면 누군가 이미 있는 UI 를 다시 만든다.**

```text
① 롯데ON 전시카테고리 입력 경로가 있다
② 롯데ON 안전인증(KC) 입력 경로가 있다
③ 쿠팡은 variant 마다 item 을 만든다
④ 등록 게이트는 Commerce-6 이 건드리지 않았다(capability ↔ 어댑터 일치)
```

🔴 기능 변경 0. 「없다고 적힌 것이 실제로는 있다」만 못박는다.

---

## 8. 🔴 하지 않은 것

```text
❌ 원산지 자동 변환 · OPLC_CD 추정 매핑 · 국가코드 하드코딩 · 픽스처의 실측 승격
❌ seller 필드 추가 · DB migration
❌ BRAND_INTRO 기본 블록 자동 생성
❌ Coupang/LotteON UPDATE 어댑터 등록(capability UNKNOWN 유지)
❌ 「있으면 좋을 값」의 Common 확장
❌ push
```

## 9. CEO 실행 요청 — 변동 없음

`commerce-4 §10` 의 TEST 1~3 이 그대로 유효하다. 🔴 **TEST 1(롯데ON 등록 1건)만
「새로 누르는」 것**이고 2·3 은 보기다. 자격증명·토큰은 보내지 않는다.

```text
TEST 1  롯데ON 아동의류 1건 등록 → spdNo · epdNo · returnCode · (실패 시) resultMessage
TEST 2  Coupang 16394846257 Wing 화면 확인
TEST 3  SmartStore 13713593585 화면 확인 (🔴 재등록 누르지 말 것)
```

그 결과가 오면 닫히는 것:
```text
spdNo   → LotteON CREATE lifecycle 실측 종료 · channel_products 기록 확인
epdNo   → apiNo 93 조회 키 논의 종료
실패    → resultMessage 로 막힌 필수값 특정 → 그 부분만 최소 수정
```
