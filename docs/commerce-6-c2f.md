# Commerce-6 C-2F — 기본 필수정보 최종 정합성

> CTO(2026-09-26). **migration 0 · Common 신규 0 · MI 구현 0 · push 0.**
> 새 기능 없음. C-2D~E 구조가 «실제로 연결되는가» 만 확인했다.

---

## ① 재고 resolver 3-Commerce 연결 — 🟢 전부

```text
SmartStore   build-payload      payloadStockQuantity(product)
Coupang      coupang.adapter    resolveSourceStock → stock(ERROR) · stockUnknown(WARNING)
LotteON      validate-payload   resolveSourceStock → itmStkQty BLOCKED
채널별 별도 판정  🔴 «없다» — 테스트가 `stockQuantity.value > 0` 재등장을 막는다
999/DEFAULT      🔴 실제 재고로 취급하지 않는다(UNKNOWN)
`|| 1` 류 보정   🔴 세 빌더 전부 0건(테스트 고정)
```

크롤러 수집 확대 ❌ 안 함(CPO 범위 지시).

---

## ② 🔴 Readiness — 오류 유형 C 가 «실제로» 있었다

CPO 가 지정한 셋만 봤다.

| | 결과 |
|---|---|
A 실제 필수인데 READY | 🟢 없음 — 재고가 마지막이었고 C-2D/E 에서 닫혔다 |
B 선택인데 BLOCKED | 🟢 없음 — `UNKNOWN` 은 세 채널 어디서도 막지 않는다 |
**C 해결 못 하는 사실을 「여기서 입력」** | 🔴 **있었다 → 고쳤다** |

### C 의 내용

C-2E 가 롯데ON 에 `itmStkQty` 판정을 새로 만들었는데 `LOTTEON_FIX_GUIDE` 에
자리가 없어 **FALLBACK 으로 떨어졌다.**

```text
FALLBACK_FIX_GUIDE.where = "LOTTEON_TAB"
        ↓ lotteOnFixLocationToMissingKind
   MissingKind = "INPUT"
        ↓
화면: 「롯데ON 탭에서 채우세요」
```

🔴 원본 상품의 재고는 셀러가 그 탭에서 적을 수 있는 값이 아니다.
`where: "COMMON_PRODUCT"` 로 고치고 안내를 사실 + 다음 행동으로 바꿨다 —
**판단은 대신하지 않는다**(「판매하지 마세요」가 아니라 「직접 판단하시면 됩니다」).

### 덤으로 나온 «죽은 항목» 셋

라벨은 보이는데 `sectionId` 가 없어 눌러도 아무 데도 가지 않는 항목.
이 저장소가 이미 두 번 고친 결함이다(REWORK-7 ① 이미지 형식 · N-3.55 판매가).

```text
쿠팡          LABEL_TO_SECTION 에 「재고」 없음        → section-price
스마트스토어  naverFieldSectionId 에 stockQuantity 없음 → section-price
```

🔴 자리는 **확인하고** 적었다 — 재고 입력칸은 `PlatformPreview` 의 «가격»
섹션 안에 있다(`FieldRow label="재고"`). 추측이 아니다.

---

## ③ 기본 필수 Matrix 최종본

C-2D 표에서 바뀐 칸은 **재고 한 줄**이다.

| 개념 | SmartStore | Coupang | LotteON |
|---|---|---|---|
상품명·가격·대표이미지·카테고리·고시·KC·원산지 | 🟢 | 🟢 | 🟢 |
**재고** | 🟢 resolver | 🟢 resolver | 🟢 resolver(BLOCKED) |
브랜드 | 🟡 payload만 | 🟢 ERROR | 🟡 **UNKNOWN** |
제조사 | 🟢 고시 | 🟢 고시 | 🟡 **UNKNOWN** |
수입자 | 🟢 | 🟡 고시 경유 | 🟡 조건부 |
판매자·A/S | 🟢 | 🟡 recommended | 🟡 **UNKNOWN** |
옵션·상세설명 | 🟢 | 🟡 WARNING(정상) | 🟢 |
배송 기본 | 🟢 | 🟢 | 🟢 |

## ④ 남은 UNKNOWN — **그대로 둔다**

```text
롯데ON 브랜드 · 제조사 · A/S     필수 여부 «근거 없음»
```

🔴 `UNKNOWN → REQUIRED` 로 바꾸지 않았다. 필수가 아닌데 막으면 정상 등록이
막힌다. `UNKNOWN → OPTIONAL` 이라고 단정하지도 않았다. **87/89 실응답이
확보됐을 때 갱신**한다 — 그때까지 UNKNOWN 이 정확한 상태다.

## ⑤ Common 범위 재확인 — 🟢 신규 0

`source-stock` 은 새 Common «필드» 가 아니라 이미 있던 `stockQuantity` 의
**해석**이다. 금지 목록(묶음배송 · 조건부 무료 · 선물포장/메시지 · 채널 전용
고급 배송옵션)은 하나도 추가하지 않았다 — backlog 기록만(`c2c.md`).

## ⑥ MI 원본 재고 표시 지점 (조사만 · 구현 0)

```text
소유   CommerceWorkspace (product 를 갖고 있다)
전달   resolveSourceStock(product) → SourceStockFact
       기존 슬롯 패턴과 «같은» 방식 — profitability / priceCalculationDetail 이
       이미 그렇게 한다(숫자·노드만 내려보낸다, prop 하나)
표시   🌎 해외 원가 · 국내 시장가 «옆» 의 한 줄
```

🔴 패널이 `product` 를 받게 만들지 않는다 — `price-single-surface.test.ts` 가
마운트 지점에서 그것을 막고 있고 그 가드는 옳다.

```text
UNKNOWN        「원본 재고 미확인」 — 🔴 품절로 쓰지 않는다. 등록도 막지 않는다
OUT_OF_STOCK   「원본 재고 없음 · 등록 차단」 + 가격 비교 안내
국내 경쟁 재고  🔴 «다른 축» — stockCounts/soldOutListings 와 같은 카드에 섞지 않는다
                (경쟁사 품절은 오히려 기회 신호다)
```

---

## ⑦~⑪

| | |
|---|---|
변경 파일 | `lotteon-channel-form.ts`(안내 1) · `readiness.ts`(섹션 매핑 2) + 테스트 1 |
migration | **0** |
테스트 | admin **330 파일 / 4,531건** · listing 514 · shared 110 · marketplace 42 🟢 |
typecheck | admin **0** · shared 0 · marketplace 0 (listing 5건은 `origin/main` 기존) |
build | 🟢 |
Production 검증 | 코드 경로 전부 테스트 고정. 🔴 실제 재고 0 상품 건수는 DB 접근 불가로 UNKNOWN |
**CEO 결정 필요** | **없음** |

---

## 다음

기본 필수정보 정합성은 여기서 닫는다. 다음은 실제 아동의류 상품 하나로
**SmartStore → Coupang → LotteON** 을 끝까지 밟으며 나오는 누락만 처리한다.
그때 롯데ON 브랜드·제조사·A/S 의 UNKNOWN 도 실응답으로 갱신된다.
