# Sprint A — R1 / R2 / R3 Evidence

> 2026-09-28 · 구현 `c1dac5b` → R3 수정 이 커밋
> 🔴 **Production 실데이터 렌더는 내가 할 수 없다**(아래 §0). 그 경계를 지킨다.

---

## 0. 🔴 먼저 — 내가 «할 수 없는» 것

```
연결된 브라우저   0건 (list_connected_browsers)
Production       외부에서 401 (Vercel 배포 보호)
로컬 dev         Supabase 키가 .env.local 에 없어 상품 화면이 뜨지 않는다
                 (있는 것은 QA_PROXY_TO_PROD · OCI_PROXY_URL 둘뿐)
```

그래서 아래 증거는 **배포된 커밋의 컴포넌트를 마운트한 실측**이다.
🔴 **「Production 실데이터 렌더」가 아니다.** 그 한 칸은 CEO 단계에 남는다.

---

## R1 — 브랜드 · SKU 🟢

`sprintA-no-channel-code-typing` (마운트)

```
브랜드명 「Bobo Choses」 표시            true
SKU 「B226AC043」 표시                   true
「브랜드 선택」 입력칸                    없음   ✅
「업체 상품코드」 입력칸                  없음   ✅
「속성모듈」 문구                         없음   ✅  (204 를 부르지도 않으면서 근거로 댔던 문구)
⑪에 채널 코드용 편집 가능 input          0개    ✅
```

### 저장값 보존 — 🔴 증거의 출처를 정확히 적는다

내 실측 하네스는 이 케이스를 **재현하지 못했다**(fixture 를 거꾸로 짰다 —
`fromLotteOnChannelInfo` 에 폼을 넣었고, 고친 뒤에도 패널이 읽는 경로와 달랐다).
**지어내지 않고 정규 스위트의 증거를 인용한다.**

```
three-layer-realign:421   expect(html).toContain(`data-channel-code="${saved}"`)
                          saved ∈ [OW-77, RT-88, DC-99, RG-01, OP-ES, BR-4242, EPD-1, NONE]
증명 2·3 통과              → 저장된 BR-4242 · EPD-1 이 «화면에 돌아온다»
```

## R2 — 과세 유형 🟢

```
「과세 유형」 라벨                        있음
🔴 「01」이 조용히 보이나                 false  ✅ ← 이번 수정의 핵심
도움말에 답(「01 과세 …」)                false  ✅
「번호를 직접 넣은 경우에는 채워지지 않습니다」  있음
값 '01' 인 input 존재                    false  ✅
```

## R3 — 🔴 FAIL 이었고, 고쳤다

### 실측으로 잡은 결함 (Verification-only 스프린트)

```
추천 A 고름                →  과세 02 · 고시품목 23
번호를 직접 B 로 바꿈       →  selected = null   (버린다 — 옳다)
                              과세 = "02"        🔴 남았다
payload                    →  taxTypeCode "02"  🔴 A 의 값이 나갔다
```

`selected`(출처)는 버리는데 그 **파생값**은 남는 비대칭이었다.

### CPO 결정 B — 번호 직접 입력 경로 제거

🔴 **조사 결과 그 UI 는 «이미 없었다».** REWORK-5 가 폐기했고, 화면에 남은 흔적은
주석뿐이다(`LotteOnRegistrationPanel:1325~1343`). `setLotteOnStandardCategoryNo`
는 **테스트에서만** 불린다.

**그래서 실제 결함은 `applyLotteOnRecommendedCategory` 의 `??` 폴백 하나였다** —
추천 A → 추천 B 로 바꿀 때도 B 가 값을 주지 않으면 A 의 값이 살아남았다.

### 고친 것 — 🔴 provenance 를 보고 지운다

```ts
// 전
notice: { itemCode: category.noticeItemCodes[0] ?? form.notice.itemCode }
codes:  { taxTypeCode: category.taxTypeCode ?? form.codes.taxTypeCode }

// 후
notice: { itemCode: category.noticeItemCodes[0] ?? keptNoticeItemCode(form) }
codes:  { taxTypeCode: category.taxTypeCode ?? "" }
```

| 필드 | 셀러 입력 경로 | 처리 | 근거 |
|---|---|---|---|
| `tdfDvsCd` 과세 | 🔴 **없다** — 화면이 읽기 전용이고 선택기도 없다 | 새 카테고리 값으로 덮고, 없으면 빈 값 | 출처가 205 하나뿐 |
| `pdItmsCd` 고시 품목 | **있다** — 89 목록에서 고른다(`CommonCodePicker`) | 직전 카테고리가 준 값이면 버리고, 셀러가 고른 값이면 **남긴다** | `selected.noticeItemCodes` 와 비교 |

🔴 **provenance 축을 새로 만들지 않았다.** `form.category.selected.noticeItemCodes`
가 이미 「직전 카테고리가 알려준 것」이다. 그 안에 있으면 카테고리에서 온 것,
없으면 셀러가 고른 것이다.

### 계약 11건 (CPO 지정 R3-1~R3-6)

```
R3-1  추천 A → tax A · notice A                                    PASS
R3-2  추천 A → 추천 B(값 있음) → B 의 값                           PASS
      🔴 추천 A → 추천 B(과세 없음) → A 의 과세가 «남지 않는다»      PASS
      🔴 추천 A → 추천 B(고시 없음) → A 의 고시가 «남지 않는다»      PASS
      🔴 셀러가 «직접 고른» 고시 품목은 카테고리를 바꿔도 남는다      PASS
R3-3  카테고리 미선택 → 둘 다 빈 값                                 PASS
R3-4  🔴 «그려진 구조» 로 확인 — 표준/전시 카테고리 번호를 받는
      편집 가능 컨트롤 0개 · 「직접 찾기」 버튼 0개 · 추천 버튼 있음  PASS
R3-5  payload 에도 A 의 값이 남지 않는다 · 카테고리는 B 로 바뀐다    PASS
R3-6  과세를 주지 않는 «모든» 경로에서 01 이 생기지 않는다            PASS
```

### 🔴 음성 대조

```
옛 `?? form.…` 폴백 복원  →  4건 즉시 실패
                             과세 '02' 잔류 · 고시 '23' 잔류 · payload '02' · 01-fallback
되돌림                    →  11건 전부 통과
```

---

## 회귀

```
admin        354 파일 / 4,755건   PASS
listing      42 파일 / 530건      PASS
typecheck    admin 0
```

---

## 🔴 남은 한 칸

```
Production 실데이터 렌더   내가 할 수 없다(§0). CEO 단계다.
```

그리고 HOLD 유지 — ③ 수입대행 · ⑤ ISO 원산지 · 204 브랜드 · SKU→`epdNo` · 고시 자동화.

## CTO SELF-VERIFICATION — 🟡 PARTIAL

R1·R2·R3 은 마운트 실측 + 음성 대조로 🟢.
🔴 **§0 의 경계와 R1 저장값 증거의 «출처» 를 명시했다** — 내 하네스가 재현하지
못한 것을 재현했다고 쓰지 않았다.
