# CTO FINAL EVIDENCE — Sprint A (①②④ + R3)

> 대상 커밋 **`a046965`** · Production 반영 완료 · 2026-09-28
> 🔴 **이 문서는 정리다. 코드 변경 0 · 새 테스트 0.**
> 🔴 **Production 실데이터 렌더는 §9 — CEO 단계다.** 그 경계를 바꾸지 않는다.

---

## 0. Sprint A 가 없앤 것 — 한 줄

**셀러가 롯데ON 채널 코드를 «적는» 자리.**

첫 LIVE 등록(2026-09-22)이 그 구조 때문에 깨졌다 — 화면이 `note="공통코드 OPLC_CD"`
라는 힌트를 달아 두고 번호를 적게 했고, 셀러는 그 힌트를 답으로 읽어
`oplcCd="OPLC_CD"` 를 보냈다. `returnCode 9999`.

F-7 이 원산지·택배사는 막았는데 셋이 남아 있었다. 이번에 그 셋을 닫았다.

---

## 1. R1 — 브랜드 · 업체상품번호 Render Evidence 🟢

`sprintA-no-channel-code-typing.test.ts` (17건 · jsdom 마운트)

```
브랜드명 「Bobo Choses」 화면에 있다                    PASS
SKU 「B226AC043」 화면에 있다                           PASS
🔴 「브랜드 선택」 입력칸이 «없다»                       PASS
🔴 「업체 상품코드」 입력칸이 «없다»                      PASS
🔴 「속성모듈」 문구가 «없다»                            PASS
   (204 를 부르는 코드가 저장소에 «없는데» 도움말이
    「속성모듈(204) 조회 결과」라고 적혀 있었다)
⑪에 채널 코드용 편집 가능 input 0개                      PASS
```

### 왜 없애도 되는가 — 계약으로 확인

```
brdNo   payload  ...(channel.brandNo ? {brdNo} : {})        조건부
        검증기   🔴 검사 0줄  → 비워도 등록된다
epdNo   payload  ...(channel.externalProductNo ? … : {})    조건부
        검증기   🔴 검사 0줄  → 비워도 등록된다
```

**묻는 데서 얻는 것이 없고 잃을 것은 있었다.**

## 2. R2 — 과세 유형 Render Evidence 🟢

```
「과세 유형」 라벨이 있다                                PASS
🔴 값이 없을 때 「01」이 «조용히 보이지 않는다»           PASS  ← 이번 Sprint 의 핵심
🔴 도움말에 답(「01 과세 · 02 면세 …」)이 «없다»          PASS
「번호를 직접 넣은 경우에는 채워지지 않습니다」 안내 있다  PASS
값이 '01' 인 input 이 «없다»                            PASS
읽기 전용 — 셀러가 코드를 적는 칸이 아니다               PASS
```

### 🔴 「01」이 나가던 경로 세 곳을 모두 닫았다

```
폼 초기값                 "01"  →  ""
BLANK 채널 설정            "01"  →  ""
build-context `?? "01"`         →  `?? ""`
205 방어적 읽기   tdf_cd → tdf_cd · tdfCd · tdf_Cd · tdfDvsCd · tdf_dvs_cd
검증기            🔴 검사가 «없었다» → 추가
                  비면 MISSING · 모르는 값이면 BLOCKED(TAX_TYPE_UNKNOWN)
```

🔴 **`UNKNOWN` 을 임의로 `01` 로 바꾸지 않는다**(CPO 확정).
과세유형 네 값의 «의미» 는 우리가 지어낸 것이 아니라 문서 원문이다
(`types.ts:168` — 「01 과세 / 02 면세 / 03 영세 / 04 해당없음」).

## 3. R3 — 카테고리 파생값 stale 방지 Render Evidence 🟢

`sprintA-r3-category-derived.test.ts` (11건)

### 잡힌 결함 (Verification-only 스프린트 실측)

```
추천 A 고름        →  과세 02 · 고시품목 23
카테고리를 바꿈     →  selected = null  (출처는 버린다 — 옳다)
                      과세 = "02"       🔴 파생값은 남았다
payload            →  taxTypeCode "02"  🔴 A 의 값이 나갔다
```

### 🔴 조사가 뒤집은 것 — 「번호 직접 입력 UI」는 «이미 없었다»

REWORK-5 가 폐기했고 화면에 남은 것은 주석뿐이다(패널 `1325~1343`).
`setLotteOnStandardCategoryNo` 는 **테스트에서만** 불린다.

→ **실제 결함은 `applyLotteOnRecommendedCategory` 의 `??` 폴백 하나였다.**
추천 A → 추천 B 로 바꿀 때도 B 가 값을 주지 않으면 A 의 값이 살아남았다.

### 계약 11건

```
R3-1  추천 A → tax A · notice A                                     PASS
R3-2  추천 A → 추천 B(값 있음) → B 의 값                            PASS
      🔴 B 가 과세를 안 주면 A 의 과세가 «남지 않는다»                PASS
      🔴 B 가 고시를 안 주면 A 의 고시가 «남지 않는다»                PASS
      🔴 셀러가 «직접 고른» 고시 품목은 카테고리를 바꿔도 «남는다»     PASS
R3-3  카테고리 미선택 → 둘 다 빈 값                                  PASS
R3-4  🔴 «그려진 구조» — 표준/전시 카테고리 번호를 받는 편집 가능
      컨트롤 0개 · 「직접 찾기」 버튼 0개 · 「카테고리 추천」 있음      PASS
R3-5  payload 에도 A 의 값이 남지 않는다 · 카테고리는 B 로 바뀐다     PASS
R3-6  과세를 주지 않는 «모든» 경로에서 01 이 생기지 않는다             PASS
```

### provenance — 🔴 무조건 지우지 않는다

| 필드 | 셀러 입력 경로 | 처리 | 근거 |
|---|---|---|---|
| `tdfDvsCd` | 🔴 **없다** — 읽기 전용 · 선택기 없음 | 새 카테고리 값으로 덮고, 없으면 `""` | 출처가 205 하나 |
| `pdItmsCd` | **있다** — 89 목록에서 고른다 | 직전 카테고리가 준 값이면 버리고, 셀러가 고른 값이면 **남긴다** | `selected.noticeItemCodes` 비교 |

🔴 **provenance 축을 새로 만들지 않았다.** `form.category.selected.noticeItemCodes`
가 이미 「직전 카테고리가 알려준 것」이다.

🔴 **CPO 가 달아 준 제한을 그대로 기록한다** —
*「이 원칙은 `noticeItemCodes` 가 USER 선택인지 카테고리 자동값인지 구분할 수 있는
현재 구조에 «한해» 적용한다. 향후 다른 source 가 추가되면 같은 비교만으로
provenance 를 가정해서는 안 된다.」*

## 4. 기존 저장값 보존 🟢

입력칸을 내렸지만 **이미 저장된 값은 여전히 payload 로 나간다.** 그래서 화면에서
지우면 「안 보이게만 만든 것」이 된다.

```
값이 있을 때만   「브랜드번호」·「업체상품번호」로 «읽기 전용» 표시
값이 없으면      줄 자체를 그리지 않는다(새 상품에서는 보이지 않는다)
```

🔴 **증거의 출처를 정확히 적는다.** 내 실측 하네스는 이 케이스를 재현하지
못했다(fixture 를 거꾸로 짰다). 지어내지 않고 정규 스위트를 인용한다.

```
three-layer-realign:421
  expect(html).toContain(`data-channel-code="${saved}"`)
  saved ∈ [OW-77, RT-88, DC-99, RG-01, OP-ES, BR-4242, EPD-1, NONE]
증명 2·3 통과 → 저장된 BR-4242 · EPD-1 이 화면에 돌아온다
```

## 5. Payload cross-check 🟢

```
brdNo · epdNo 비었을 때   payload 에 «키 자체가 없다»(조건부 spread)   PASS
검증기가 둘을 요구하지 않는다 — 비워도 통과                            PASS
🔴 단품코드 eitmNo 는 sku 로 «그대로 간다» — 식별자를 잃지 않는다      PASS
tdfDvsCd  고른 값이 spdLst[0].tdfDvsCd 로 그대로                      PASS
          빈 값 → 검증기 MISSING · 모르는 값 → BLOCKED                PASS
R3        A → B(값 없음) → payload 빈 값 · 카테고리는 B               PASS
          A → B(값 있음) → payload 가 B 의 값                         PASS
build-context 실제 통과  빈 폼 → `""`(01 아님) · 공백도 `""`          PASS
```

🔴 **`build-context` 를 «실제로 부르는» 검사가 따로 있다**(`sprintA-tax-no-silent-default`, 4건).
그 이유는 §6 에 적는다.

## 6. Negative test (음성 대조) 🟢 — 🔴 여기서 내 가드에 구멍이 있었다

### ② 과세

```
1차 시도   "01" 폴백을 «두 곳» 에 되살렸다  →  «한 곳만» 잡혔다
           BLANK 상수                        잡혔다
           build-context `?? "01"`           🔴 안 잡혔다

원인       build-context 는 «함수를 통과시켜야» 드러나는데, 내 검사가 payload
           빌더에 channel 을 직접 넘겨 그 경로를 «건너뛰었다».
           실제 등록 경로는 라우트 → build-context → 빌더다.

보강       sprintA-tax-no-silent-default 추가(실제 build-context 를 부른다)
2차 대조   두 곳 모두 복원 → 3건 실패 → 되돌려 전부 통과
```

🔴 같은 계열 실수가 이 스프린트에서 **네 번째**다 —
조건 미발동 · 표시만 보고 상태 놓침 · 메서드 무시 · **경로 건너뜀**.

### R3

```
옛 `?? form.…` 폴백 복원  →  4건 즉시 실패
                             과세 잔류 · 고시 잔류 · payload 잔류 · 01 fallback
되돌림                    →  11건 전부 통과
```

### 🔴 가드가 내 «과잉» 을 두 번 잡았다

```
rework14 필드 패리티      내가 붙인 4버튼 과세 선택기를 「쿠팡에 없는 부품」으로 잡았다
                          판정이 맞다 — CPO 가 요청한 것은 새 UI 가 아니었다
                          → 읽기 전용으로 되돌렸다
three-layer-realign       저장된 BR-4242 가 화면에서 사라진 것을 잡았다
                          판정이 맞다 → 값이 있을 때만 읽기 전용으로 세운다
```

## 7. Regression 🟢

```
admin        354 파일 / 4,755건   PASS
listing       42 파일 /   530건   PASS
pricing 538 · shared 133 · marketplace 42 · category 22   (직전 스프린트 기준 유지)
```

### Sprint A 가드 (신규·갱신)

```
sprintA-no-channel-code-typing     17건   Render · Data · Payload 3단
sprintA-tax-no-silent-default       4건   🔴 실제 build-context 통과
sprintA-r3-category-derived        11건   R3-1~R3-6 + provenance
final-mapping-render               14건   ⓪ HTTP 계약 3건 포함(P0-2)
f2-save-failure                     9건   저장 실패 위장 금지 + 상태 오염
s24-delivery-collapse-render        6건   ⑤배송 코드 노출 0
                                   ─────
                                   61건
```

🔴 **기존 계약 5개를 갱신했다** — 옛 화면을 박아 둔 기대값이다.

```
three-layer-realign         ⑪ 목록 15 → 13
commerce-tab-alignment      같은 목록
commerce6-e2e-children      차단 목록에 「과세 유형」이 «들어왔다»
                            (예전에는 01 폴백이 조용히 채워 잡히지 않았다)
rework7-summary-shape       과세가 «검증 대상» 이 되어 표시가 붙는다
                            payload-preview 스텁에 tdfDvsCd 추가
listing build-payload.test  🔴 fixture 가 「모든 값이 채워진 상태」라 적어 놓고
                            과세를 채우지 않았다 — 조용한 "01" 에 기대고 있었다
```

## 8. typecheck / build / deploy 🟢

```
typecheck   admin 0
            listing 5 → 🔴 origin/main 에서 온 «기존» 오류(전부 테스트 파일,
                          내 파일 아님 · 개수 변화 없음)
build       next build 성공
deploy      ttaejyo-jzqkmg3nv… ● READY (Production)
반영 확인    ttaejyo.vercel.app 200 · commerce-platform-mocha.vercel.app 200
git         origin/main = a046965 · 미푸시 0 · tree clean
```

## 9. 🔴 Production 실데이터 Render — **CEO 단계다**

내가 할 수 없는 이유를 실행으로 확인했다.

```
연결된 브라우저   0건        (list_connected_browsers)
Production       외부 401    (Vercel 배포 보호)
로컬 dev         Supabase 키가 .env.local 에 «없다»
                 (있는 것은 QA_PROXY_TO_PROD · OCI_PROXY_URL 둘뿐)
```

위 §1~§6 은 **배포된 커밋의 컴포넌트를 마운트한 실측**이다.
🔴 **「Production 실데이터 렌더 PASS」라고 쓰지 않는다.**

---

## 10. HOLD — 이번 범위가 아니다

```
③ 수입대행코드 impPrxCd     SELLER_CONFIRMATION · 89 그룹 존재 여부 조사 전
⑤ 원산지 ISO 국가코드        A-2(크롤러가 ISO 를 얻을 수 있는가) 조사 전
204 브랜드 자동조회          호출 코드가 «없다»
SKU → epdNo 자동생성         유일성·중복등록 계약 미확인
고시 자동화                  93 등록 상품 0건 → 94 확인 불가 · UNKNOWN 유지
Vercel `__tests__` 정리      CEO 테스트 후 별도 Cleanup
delivery-settings 세션 검사   🟡 보안 후보로 기록만(앱 레벨 가드 없음)
```

---

## CTO SELF-VERIFICATION — 🟡 PARTIAL

①②④ · R3 · Render(마운트) · Data · Payload · Axis · Failure-path · Regression ·
typecheck · build · deploy 는 🟢.
**§9(Production 실데이터 렌더)가 🟡** 이므로 전체를 🟢 로 쓰지 않는다.

🔴 이 문서에 내가 틀린 것 넷을 그대로 남겼다 —
① 가드 구멍(경로 건너뜀) ② 과잉 UI 두 건 ③ R1 저장값 fixture 재현 실패
④ Python 편집으로 파일 두 개를 truncate 한 사고(직전 커밋에 기록).
