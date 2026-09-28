# COUPANG-DISPLAY-NAME-03 — 출처 확정 실측 (2026-09-29)

> CTO 실측. 독립변수는 **`generalProductName` 하나**.
> `sellerProductName` 은 건드리지 «않았다». PUT 1회 + 원복 1회. 통로 즉시 폐기.

## 1. 실험 전

```
sellerProductId    16394846257   status SAVED
brand              "main story"
sellerProductName  "Bubble Sweatshirt in Grey Melange by Main Story"
generalProductName "Bubble Sweatshirt in Grey Melange by Main Story"
displayProductName "main story Bubble Sweatshirt in Grey Melange by Main Story"
```

## 2. 보낸 것

```
sellerProductName   🔴 건드리지 않음 (baseline 값 그대로)
generalProductName  → "[DN03] Bubble Sweatshirt in Grey Melange by Main Story"
displayProductName  → 키 생략
```

통로가 스스로 증명한 값: **`sellerProductNameUnchanged: true`** ·
`sentDisplayProductNameKey: false` · `acceptedLossRisks: ["displayProductName"]` ·
쿠팡 응답 `SUCCESS`.

## 3. 🟢🟢 결과 — **Case A. 출처는 `generalProductName` 이다**

```
seller  "Bubble Sweatshirt in Grey Melange by Main Story"          ← 안 건드림, 그대로
general "[DN03] Bubble Sweatshirt in Grey Melange by Main Story"   ← 이것만 바꿈
display "main story [DN03] Bubble Sweatshirt in Grey Melange by Main Story"
        └─ brand + " " + generalProductName   (3회 관측 전부 true)
```

**노출명이 `generalProductName` 을 따라갔다. `sellerProductName` 은 움직이지
않았는데도 노출명이 바뀌었다.** 독립변수가 하나였으므로 이것으로 확정된다.

```
생성 입력이 sellerProductName    🔴 탈락 (DN-02 에서 이미)
생성 입력이 generalProductName   🟢 확정 (이번 실측)
```

## 4. 확정된 계약

```
displayProductName = brand + " " + normalize(generalProductName)
                     ↑ 쿠팡이 만든다. 우리가 보내면 «그 값이 그대로» 저장된다.
                     ↑ 키를 생략하면 «다시 만든다».
```

| 항목 | 상태 |
|---|---|
| 우리가 직접 보내는 필드가 아니다 | 🟢 확정(소스) |
| 키 생략 시 쿠팡이 재생성 | 🟢 확정(DN-02) |
| 생성 입력 = `generalProductName` | 🟢 **확정(DN-03)** |
| `brand` 가 접두어로 쓰인다 | 🟢 확정 |
| `normalize()` 규칙 | 🔴 **UNKNOWN — 아래 §5** |

## 5. 🔴 여전히 UNKNOWN — 그래서 합성 금지는 유지된다

`16392432073`(pepe)은 `general === seller` 인데도 조립 결과가 다르다.

```
general "… Last Ones In Stock - 28-29 EUR"
display "pepe … Last Ones In Stock 28-29 EUR"    ← 두 번째 " - " 만 " " 로
```

즉 `brand + " " + general` 로 **그대로** 만들어지지 않는 경우가 있다. 정규화
단계가 하나 더 있고 그 규칙은 표본 하나로 복원되지 않는다.

🔴 **그러므로 `displayProductName` 을 우리가 «만들지» 않는다.** 확정된 것은
「무엇을 입력으로 쓰는가」이지 「어떻게 만드는가」가 아니다. 키를 생략해
**쿠팡이 만들게** 하는 것이 유일하게 안전한 길이다.

## 6. 🟢 계약 후보 — (d) 로 닫힌다

```
(a) baseline 의 displayProductName 보존   🔴 탈락 — 옛 이름이 남는다
(b) 지금처럼 둘 다 덮는다                 🔴 탈락 — 접두어·정규화 소실, 복구 불가
(c) 키 생략만                             🔴 탈락 — 노출명이 옛 이름에 머문다(DN-02)
(d) 키 생략 + generalProductName 도 새 이름  🟢 **확정**
```

### 구현 계약(제안)

```
UPDATE 에서 상품명을 고칠 때
  sellerProductName   → 새 이름
  generalProductName  → 같은 새 이름
  displayProductName  → 🔴 키를 «보내지 않는다»(baseline 에서 제거)
```

🔴 세 번째 줄이 핵심이다. 그런데 **현재 `detectCoupangUpdateLoss` 는 그 칸의
부재를 `MISSING` 으로 막는다**(update-preflight.ts ①) — 옳은 가드다. 구현하려면
「이 한 칸은 «의도적으로» 빼는 것」이라는 예외를 손실 검사가 알아야 한다.
그 예외를 만드는 순간 가드가 넓어지므로, **예외는 `displayProductName` 하나로
못 박고 테스트로 고정**해야 한다.

🔴 아직 **코드를 고치지 않았다.** `applyCoupangEdits` 도 손실 검사도 그대로다.
CPO 판정 뒤에 구현한다.

## 7. 원복 — 최초 등록 상태로 복귀

```
seller  "Bubble Sweatshirt in Grey Melange by Main Story"
general "Bubble Sweatshirt in Grey Melange by Main Story"
display "main story Bubble Sweatshirt in Grey Melange by Main Story"
```

세 이름 모두 최초 등록 상태와 같다.

## 8. 통로 폐기

```
DEBUG_COUPANG_GENERALNAME_TOKEN / _SELLER_PRODUCT_ID   제거 (env 잔존 0)
로컬 토큰 파일                                          삭제
라우트 api/debug/coupang-generalname-probe              삭제
소스 참조(apps/admin/src · packages)                    0건
```

🔴 `.next/types/*` 에 이름이 남아 있으나 그것은 **로컬 빌드 캐시**이고
`apps/admin/.gitignore:17` 로 추적되지 않는다 — 소스가 아니다.
401/404 를 단독 증거로 쓰지 않는다.
