# COUPANG-DISPLAY-NAME-02 — 키 생략 실측 (2026-09-29)

> CTO 실측. 독립변수는 **`displayProductName` 키의 존재 여부 하나**.
> 대상 SAVED 1건 · PUT 1회 + 원복 1회 · 통로는 즉시 폐기.

## 1. 실험 전 상태

```
sellerProductId    16394846257   status SAVED
brand              "main story"  (KR-885022)
sellerProductName  "Bubble Sweatshirt in Grey Melange by Main Story"
generalProductName "Bubble Sweatshirt in Grey Melange by Main Story"
displayProductName "Bubble Sweatshirt in Grey Melange by Main Story"   ← 접두어 없음
                   (앞 스프린트의 overlay 가 덮어써서 잃은 상태)
```

## 2. 보낸 것

```
sellerProductName  → "[DN02] Bubble Sweatshirt in Grey Melange by Main Story"
displayProductName → 🔴 키 자체를 «생략»
나머지 baseline    → 통째로 그대로
```

통로가 스스로 확인한 값: `sentDisplayProductNameKey: false` ·
`acceptedLossRisks: ["displayProductName"]`(손실 검사를 돌렸고, 예상한 한 칸
외의 위험이 없음을 확인한 뒤에만 보냈다) · 쿠팡 응답 `SUCCESS`.

## 3. 🟢 결과 — **Case A. 쿠팡이 재생성한다**

```
seller  "[DN02] Bubble Sweatshirt in Grey Melange by Main Story"   ← 바뀜
display "main story Bubble Sweatshirt in Grey Melange by Main Story" ← 🔴 접두어가 «돌아왔다»
```

**키를 빼면 쿠팡이 `displayProductName` 을 다시 만든다.** 4회 연속 관측(약 2분) 동안
값이 안정적이었다.

## 4. 🔴 그런데 «출처» 가 `sellerProductName` 이 아니다 — 이번 실험의 핵심 발견

재생성된 값은 **새 상품명이 아니라 옛 이름**에 접두어가 붙은 것이었다.

```
display === brand + " " + generalProductName      ← 4회 관측 전부 true
display !== brand + " " + sellerProductName
```

우리는 `generalProductName` 을 baseline 값(옛 이름) 그대로 보냈고, 쿠팡은 **그것으로**
노출명을 조립했다.

🔴 **앞선 6개 표본으로는 이것을 알 수 없었다** — 그 표본들은 전부
`generalProductName === sellerProductName` 이라 두 공식이 구분되지 않았다.
이번 실험이 둘을 «갈라놓아» 진짜 출처를 드러냈다.

→ 그러므로 **키만 생략하면 노출명은 옛 이름에 머문다.** 노출명이 새 상품명을
따라오게 하려면 `generalProductName` 도 같이 보내야 한다 —
그 칸은 우리 빌더가 이미 갖고 있다(`CoupangPayload.generalProductName?`).

## 5. 🔴 여전히 UNKNOWN — pepe 의 정규화

`16392432073` 은 `generalProductName === sellerProductName` 인데도

```
general/seller  "… Last Ones In Stock - 28-29 EUR"
display         "pepe … Last Ones In Stock 28-29 EUR"     ← 두 번째 " - " 만 " " 로
```

즉 조립 시 **이름 자체를 정규화하는 단계가 하나 더 있다.** 이번 실험은 그것을
설명하지 못한다(우리 상품명에는 그 패턴이 없다). **합성 금지는 그대로 유효하다.**

## 6. 원복 — 그리고 앞 스프린트의 손상이 복구됐다

원복도 «같은 통로(키 생략)» 로 원래 이름을 보냈다.

```
seller  "Bubble Sweatshirt in Grey Melange by Main Story"        ← 원래 값
display "main story Bubble Sweatshirt in Grey Melange by Main Story"  ← 🟢 접두어 복구
```

앞 스프린트(`PROD-VERIFY-01`)에서 overlay 가 덮어써 잃었던 브랜드 접두어가
**돌아왔다.** 상품은 최초 등록 상태와 같아졌다.

## 7. 계약 후보 — 셋에서 둘로 좁혀졌다

```
(a) baseline 의 displayProductName 보존   → 🔴 탈락. 보존해도 옛 이름이 남고,
                                             접두어 재생성 기회를 버린다.
(b) 지금처럼 둘 다 덮는다                 → 🔴 탈락. 접두어와 정규화가 사라지고
                                             복구되지 않는다(실측으로 확인).
(c) displayProductName 키를 «생략»        → 🟢 접두어는 돌아온다.
                                             🔴 그러나 노출명이 옛 이름에 머문다.
(d) 키 생략 + generalProductName 도 새 이름 → 🟡 «유력». 아직 재 보지 않았다.
```

🔴 **(d) 는 아직 UNKNOWN 이다.** `generalProductName` 을 바꾸면 노출명이 따라오는지,
그리고 그때 §5 의 정규화가 어떻게 작동하는지 재 본 적이 없다.

CTO 권장: (d) 를 재는 `COUPANG-DISPLAY-NAME-03` 실측 1회. 범위는 이번과 동일
(SAVED 1건 · PUT 1회 + 원복 1회 · 독립변수 `generalProductName` 하나).
그 전까지 `applyCoupangEdits` 는 **고치지 않는다.**

## 8. 통로 폐기

```
DEBUG_COUPANG_DISPLAYNAME_TOKEN / _SELLER_PRODUCT_ID   제거 (env 잔존 0)
로컬 토큰 파일                                          삭제
라우트 api/debug/coupang-displayname-probe              삭제
소스 참조                                               0건
```

🔴 401/404 를 단독 증거로 쓰지 않는다 — source + deployment 로 증명한다.
