# COUPANG-UPDATE-PROD-VERIFY-01 — Production 실측 (2026-09-29)

> CTO 실측 기록. **실제 쿠팡 상품에 PUT 을 보냈다.** 대상은 SAVED 1건,
> 변경은 상품명 하나. 실측 후 상품명은 **원래 값으로 되돌렸다.**

## 1. 대상

```
sellerProductId   16394846257
status            SAVED (임시저장)
sellerProductName "Bubble Sweatshirt in Grey Melange by Main Story"
최상위 칸          56   ·   items 5   ·   이미지 35장
```

## 2. 실행

```
GET baseline → PUT(상품명 하나) → Re-GET → 대조 → PUT(원복) → Re-GET
```

통로는 1회용 `api/debug/coupang-name-update`(토큰 fail-closed · 대상 1건 못 박음 ·
`name` 문자열만 수신 · 실행은 `executeCoupangUpdate`). **실측 직후 삭제했다.**

## 3. 결과 — CPO 5조건

```
① PUT 성공                {"ok":true,"sellerProductId":"16394846257","changed":["name"]}
② 상품명 실제 변경         "Bubble …" → "[TEST] Bubble …"   🟢 GET 으로 확인
③ sellerProductId 유지     16394846257 → 16394846257          🟢
④ 상품명 외 baseline 보존  🟡 세 곳이 달라졌다 — 아래 §4
⑤ 중복 CREATE 없음         🟢 최상위 칸 56 → 56, 신규 상품 없음, 같은 번호로 유지
```

가격(147900 ×5) · 재고(1,2,2,2,1) · `sellerProductItemId` 5개 · `certifications` ·
`displayCategoryCode`(85551) · 최상위 56칸 — **사라진 칸도 생긴 칸도 없다.**

## 4. 🔴 달라진 세 곳 — 둘은 쿠팡, 하나는 우리

### ⓐ `saleStartedAt` — 쿠팡이 다시 쓴다

```
2026-09-25T09:18:57  →  2026-09-29T01:11:27
```

우리는 baseline 값을 그대로 실어 보냈다. 쿠팡이 저장 시점으로 갱신한다.

### ⓑ `items[].extraProperties.MOTA_TRACE` — 쿠팡 내부 추적값

```
OPENAPI-false-NONE,nil,KR-885022,…   →   OPENAPI-false-NONE,API_SELLER,KR-885022,…
```

`nil` 이 `API_SELLER` 로 바뀐다. 「API 로 수정됐다」는 쿠팡 쪽 감사 표시다.

### ⓒ `items[].images[].vendorPath` — 쿠팡이 정규화한다

이미지 **35장 전부 `cdnPath` 동일**(실제 이미지가 그대로다). 달라진 필드는
`vendorPath` 하나뿐이고, 새 값이 `cdnPath` 의 파일명과 같아진다.

```
before  5884915f-282d-4af4-86a2-a11022bce5a7-0001.jpg
after   eaeb394938175c65fbf73c9bd42dae7f8ea9788aa69336d8f790e2e55e53.jpg
cdnPath vendor_inventory/c22b/eaeb39…e55e53.jpg   ← 양쪽 동일
```

🔴 **ⓐⓑⓒ 는 우리가 만든 값이 아니다.** Master 에서 새어 나온 칸은 «하나도 없다».

### ⓓ 🔴 `displayProductName` 의 브랜드 접두어가 «사라진다» — 이건 우리 쪽이다

```
before   "main story Bubble Sweatshirt in Grey Melange by Main Story"
after    "[TEST] Bubble Sweatshirt in Grey Melange by Main Story"
원복 후   "Bubble Sweatshirt in Grey Melange by Main Story"   ← 접두어가 돌아오지 않는다
```

`applyCoupangEdits` 는 상품명을 고칠 때 `sellerProductName` 과 `displayProductName`
**둘 다** 덮는다(한쪽만 바꾸면 셀러센터에 옛 이름이 남기 때문이다). 그런데 쿠팡이
등록 시 노출명에 붙여 둔 브랜드 접두어(`main story `)가 그 순간 사라지고,
**쿠팡이 다시 붙여 주지 않는다.**

→ 🟡 **CPO 판단 필요.** 상품명 축 «안» 의 부작용이라 「보존 위반」은 아니지만,
셀러가 의도하지 않은 노출명 변화다. 넓히려면 노출명 규칙의 실측이 먼저다.

## 5. 🔴 쿠팡 UPDATE 는 «비동기» 다 (새 사실)

```
SAVED  --PUT-->  UPDATE_REQ_ACCEPTED(임시저장중)  --처리완료-->  SAVED
```

PUT 이 `ok` 를 줘도 즉시 반영되지 않는다. 원복 PUT 직후 GET 은 **옛 이름 + 임시저장중**
을 돌려줬고, 잠시 뒤 다시 읽으니 새 이름 + SAVED 였다.

🔴 **영향**: `coupangUpdateGate` 는 `SAVED` 만 통과시킨다. 그래서 수정 직후 곧바로
다시 수정하면 「확인되지 않았습니다」로 막힌다. 지금 화면은 전송 후 기준값을 버리고
「다시 불러와주세요」라고 말하므로 동작은 맞지만, **문구가 그 상황을 설명하지는 못한다.**
(이번 스프린트 범위 밖 — 기록만 남긴다.)

## 6. 통로 폐기

```
① 토큰·대상 환경변수 제거      DEBUG_COUPANG_UPDATE_* → 잔존 0건
② 로컬 토큰 파일 삭제
③ 라우트 삭제                  api/debug/coupang-name-update
④ 소스 참조 0건                (주석 포함 검색)
⑤ 재배포 + 배포 커밋 기준 확인
```

🔴 401/404 를 삭제 증거로 쓰지 않았다 — `/api/*` 는 미들웨어가 앞단에서 막아
없는 라우트도 401 을 준다. **source + deployment** 로 증명한다.

## 7. 판정

```
Coupang SAVED 상품의 «상품명 하나» UPDATE
  → baseline 보존 방식으로 실제 Production 에서 동작함이 확인됐다.
```

남은 판단은 §4-ⓓ 하나다. 그 판단 전까지 capability 는 지금 값
(`SUPPORTED_WHEN_SAVED` × `updateFields: ["name"]`) 그대로 둔다.
