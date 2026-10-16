# WU-046 — C29/C34 「축 부족」의 원인 전수해부

> 🔴 **조사 전용 / HOLD.** 운영 코드 변경 **0** · 배포 **없음** · 작업트리 **clean** ·
> AI 0 · 외부 API 0 · HTTP 0(WU-032 캐시). 기준선 **SAME 13 / FP 1 / MISS 15** 유지.

---

## §1 C29·C34 의 정확한 상태

```
verdict  PRESUMED_SAME · blockers **[]**(비어 있다) · 축 **3** (필요 5)
축       핵심 상품명 «일부» · 상품군 shirt · 대상 KIDS
🔴 브랜드는 양쪽 "Bobo Choses" 로 **일치하는데 축이 아니다** —
   `brandOk` 는 **전제조건** 이고 `CrossSellerAxis` 에 BRAND 가 없다(설계).
```

### 빠진 칸 (후보 쪽, 둘 다 동일)

| 칸 | 원상품 | 후보 |
|---|---|---|
| `brandModelCode` | `B226AC010` / `B226AC009` | **null** |
| `colorText` | `Heather Grey` / `Light Blue` | **null** |
| `materialText` | 설명문(100% Organic Cotton) | **null** |
| `fitText` | `relaxed fit` | **null** |
| `sizeLabels` | 2-3Y…12-13Y | `3m`(옵션 1개) |

---

## §2 🔴 페이지에 «원천이 없다» — 추출 실패가 아니다

캐시된 실제 HTML 전수 확인:

```
C29  품번 `B226AC010`      🔴 **페이지에 없음**
     색상 `Heather Grey`   🔴 **페이지에 없음**
     소재 organic cotton   🟡 있음 — 단 **meta description 산문**(퍼센트 없음)
C34  품번 `B226AC009`      🔴 **없음**
     색상 `Light Blue`     🔴 **없음**
     소재 organic cotton   🟡 meta description 산문
둘 다 Shopify `options` 가 `["3m"]` 하나뿐 — **색상 옵션이 없다**
```

🔴 그러므로 **「우리 추출기가 못 읽었다」가 아니다.** 정규 칸에 값이 없다.

---

## §3 🔴🔴 그런데 더 중요한 것이 나왔다 — **C34 의 페이지 증거가 원상품과 다르다**

```
원상품(S2)   Hug Hairy Monster T-Shirt · **Light Blue** · B226AC009
후보 C34     cissywears `/products/bobo-choses-babyhug-hairy-monster-t-shirt`
  제목       "Bobo Choses Baby Hug Hairy Monster T-Shirt"
  🔴 설명    「**Softpaw bear** print in **coral on soft pink**」
Human GT     **SAME**
```

🔴🔴 **제목은 Hug Hairy Monster 인데 설명은 Softpaw bear · coral on soft pink 다.**
원상품은 Light Blue 의 Hug Hairy Monster 이므로 **설명이 가리키는 상품은 다르다.**

🟢 **대조군 C29 는 정합한다**:
```
원상품(S1)  Booty Ghosts · **Heather Grey**
후보 C29    「**Grey marl** long sleeve baby top with playful **ghost** print」  🟢 맞다
```

🔴 **그래서 C34 를 SAME 으로 만드는 개선은 할 수 없다.** Human GT 와 페이지 증거가
충돌하고, 어느 쪽이 맞는지는 **CTO 가 단정할 수 없다**(상점 설명이 틀렸을 수도,
사람 판정이 틀렸을 수도 있다). 🔴 WU-036 §F 가 예고한 바로 그 자리다.

---

## §4 그래서 가능한 개선안과 그 위험

```
안 A. meta description 에서 색상/소재를 읽는다
   🟢 C29 는 축이 늘 수 있다 — `Grey marl` ↔ `Heather Grey` 는 «grey» 가 겹쳐
      COLOR_VARIANT 에 걸리지 않고 색조도 GREY 로 일치한다.
   🔴🔴 그러나 **자유 산문을 새 추출원으로 쓰는 것** 이고 **51건 전체에 적용** 된다.
      실측 오염 사례가 바로 그 안에 있다 — C34 의 「coral on soft pink」를
      색상으로 읽으면 **원상품과 충돌** 해 지금보다 나빠진다.
   🔴 소재는 퍼센트가 없어(`soft organic cotton`) `parseMaterialComposition` 이
      조성 키를 만들지 못한다 — 축이 서지 않을 가능성이 크다(미측정).

안 B. 품번/색상을 다른 곳에서 찾는다
   🔴 **페이지에 없다**(§2). 찾을 곳이 없다.

안 C. 축 개수를 낮춘다
   ❌ **금지** — threshold 완화다(CPO 명시).
```

---

## §5 최종 판정

```
C29·C34 의 원인   🟢 확정 — **blocker 가 아니라 축 부족** 이고,
                   그 축의 원천이 **페이지에 없다**(추출 실패 아님)
개선 가능성        🔴 안 A 는 자유 산문 신규 추출원 · C34 에서 **오히려 악화** 증거 있음
                   안 B 는 원천 부재 · 안 C 는 금지
C34                🔴🔴 **Human GT 와 페이지 증거가 충돌** 한다
코드 변경          🟢 **0** · 배포 **없음** · 기준선 **유지**(SAME 13 / FP 1 / MISS 15)
──────────────────────────────────────────
**HOLD** — CPO 가 지정한 「기존 증거로 안전하게 확정할 수 없으면 HOLD」에 해당한다.
```

### 🔴 CPO 결정 — 둘

```
① **C34 의 Human GT 재확인** (CEO 1건)
   상점 설명이 「Softpaw bear · coral on soft pink」인데 Human 은 SAME 이다.
   🔴 GT 가 틀렸다면 **MISS 15 중 1건이 사라지고** 기준선이 바뀐다.
   🔴 설명이 틀렸다면(템플릿 오류) GT 가 맞고 그 건은 영원히 증거가 없다.
② **meta description 을 추출원으로 열 것인가**
   🔴 열면 51건 전체에 적용되고 C34 같은 오염이 들어온다. 🟢 열지 않으면
      C29 는 영원히 축 3 이다. **어느 쪽이든 측정 후 결정이 필요하고,
      CTO 가 고르지 않았다.**
```

🔴 **CEO Action: C34 한 건 재확인(①이 선택될 경우에만).**
