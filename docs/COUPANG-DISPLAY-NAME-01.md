# COUPANG-DISPLAY-NAME-01 — 노출명 조사 (2026-09-29)

> CTO 조사 보고. **Production PUT 0회 · 상품 변경 0건 · 새 write route 0개.**
> 읽기 전용 표본 6건(기존 `debug/coupang-product-get-raw`, 조사 후 토큰 폐기).

## 1. 🟢 확정된 것 넷

### ① 생성 주체는 «쿠팡» 이다 — 표본과 무관하게 확정

`CoupangPayload`(빌더 산출물)에 **`displayProductName` 칸이 없다**
([build-payload.ts:194~](packages/listing/src/coupang/build-payload.ts:194)).
등록할 때 우리가 보낸 적이 «한 번도» 없다. 그러므로 그 값은 쿠팡이 만든다.
이것은 소스로 증명되며 표본 수에 의존하지 않는다.

### ② 생성 시점은 CREATE 다

표본 6건 중 **우리가 UPDATE 한 1건을 뺀 5건 전부** 접두어를 갖고 있다.

### ③ UPDATE 시 재생성하지 «않는다»

`16394846257` 은 UPDATE 후 `brand: "main story"` 가 **그대로 살아 있는데도**
노출명은 접두어 없이 남았다. 쿠팡은 우리가 보낸 값을 그대로 저장하고,
brand 로 다시 만들어 주지 않는다.

### ④ 🔴 규칙을 «복원할 수 없다» — 정규화가 섞인다

```
표본 6건 중 brand 값이 있는 것        6 / 6
display == brand + " " + seller      4 / 6
  예외 ① 16394846257  ← 우리가 UPDATE 로 덮은 건(반례가 아니다)
  예외 ② 16392432073  ← 🔴 진짜 예외
```

```
brand   "pepe"
seller  "Lulu T Bar Shoes in Vernice Nero by PèPè - Last Ones In Stock - 28-29 EUR"
display "pepe Lulu T Bar Shoes in Vernice Nero by PèPè - Last Ones In Stock 28-29 EUR"
                                                                        ↑ " - " → " "
```

**두 번째 `" - "` 만 공백으로 줄었고 첫 번째는 살아남았다.** 접두어를 붙이는 것
외에 쿠팡이 이름 자체를 «정규화» 한다는 뜻이고, 그 규칙은 한 사례로 복원되지 않는다.

→ 🔴 **`brand + " " + name` 으로 합성하는 로직을 만들면 안 된다**(CPO 금지 항목이
실측으로 확인됐다). 4/6 이 맞는다고 쓰면 나머지에서 조용히 틀린 이름이 나간다.

## 2. 표본 전문

| sellerProductId | brand (brandId) | display = brand+" "+seller |
|---|---|---|
| 16325604881 | 보보쇼즈 (KR-19580) | 🟢 |
| 16336681622 | 애니멀스옵저버토리 (KR-24013) | 🟢 |
| 16338809221 | 애니멀스옵저버토리 (KR-24013) | 🟢 |
| 16340176952 | 애니멀스옵저버토리 (KR-24013) | 🟢 |
| 16392432073 | pepe (KR-59951) | 🔴 정규화 발생 |
| 16394846257 | main story (KR-885022) | ⚪ 우리가 덮은 건 |

전 표본에서 **`generalProductName === sellerProductName`** 이었다(6/6).
`brand` 는 Wing 에 등록된 브랜드(`resolvedBrand.brandName`/`brandId`)에서 온다.

## 3. 🔴 아직 UNKNOWN — 그리고 «이것이 계약을 가른다»

```
UPDATE 전문에서 `displayProductName` 키를 «아예 빼면» 쿠팡이 재생성하는가?
```

우리는 그 경우를 재 본 적이 «없다». 이번 UPDATE 는 항상 그 칸을 **포함해서** 보냈고
(`applyCoupangEdits` 가 두 칸을 같이 덮는다), 쿠팡은 보낸 값을 그대로 저장했다.

* 재생성한다면 → **키를 빼는 것** 이 정답이다(접두어가 다시 붙는다).
* 재생성하지 않는다면 → baseline 값이 그대로 남아 «옛 이름» 이 노출된다.

두 결과가 정반대의 구현을 요구하므로, **이 하나를 재기 전에는 계약을 정할 수 없다.**

## 4. 선택지 — 셋 다 대가가 있다

```
(a) baseline 의 displayProductName 을 «보존»(키를 그대로 나른다)
    → 접두어는 지킨다. 그러나 상품명을 고쳐도 노출명은 «옛 이름» 이다.
       `applyCoupangEdits` 가 두 칸을 덮게 만든 바로 그 이유가 되살아난다.

(b) 지금처럼 «둘 다» 덮는다
    → 노출명이 즉시 맞는다. 그러나 쿠팡이 붙인 접두어와 정규화가 사라지고
       복구할 수 없다(§1-④).

(c) UPDATE 에서 `displayProductName` 키를 «생략» 한다
    → §3 이 참이면 최선. 거짓이면 (a)와 같아진다. 🔴 재 보기 전에는 모른다.
```

🔴 **CTO 권장: (c) 를 재는 1회용 실측을 먼저 한다.** 범위는 이번 Production
검증과 동일하다 — SAVED 1건 · 상품명 하나 · `displayProductName` 키만 생략 ·
직후 원복. 그것이 셋 중 하나를 «확정» 으로 바꾸는 유일한 방법이다.

그 실측 전까지 `displayProductName` 은 **UNKNOWN 으로 유지한다.**

## 5. 이번 조사에서 하지 «않은» 것

* Production PUT 0회 · 기존 상품 변경 0건 · 새 debug write route 0개
* 코드 변경 0줄 — 노출명 생성/보존 로직을 «만들지 않았다»
* `sellerProductName === displayProductName` 공통 모델을 세우지 않았다
* 다른 Commerce 의 baseline UPDATE 모델을 복제하지 않았다

## 6. 통로 폐기

```
토큰 DEBUG_COUPANG_PRODUCT_PROBE_TOKEN  발급 → 조사 → 폐기 (env 잔존 0)
로컬 토큰 파일                            삭제
라우트                                    «원래 있던» 읽기 전용 통로라 남긴다
재배포 후 토큰 없이 호출                    404 (fail-closed 로 닫힘)
```

🔴 라우트를 지우지 않은 것은 이번에 만든 것이 아니기 때문이다. 닫히는 방식은
토큰 부재이고, 그것이 이 통로의 원래 설계다.
