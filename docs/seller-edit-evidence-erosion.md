# SELLER-EDIT EVIDENCE EROSION — 셀러 편집이 매칭 근거를 훼손한다

**등록일** 2026-09-14 · **등록자** CTO · **지시** CEO, 2026-09-14
**상태** 🔵 등록만 됨 — **지금 고치지 않는다**
**우선순위** COLOR SAFETY → TITLE INFORMATION → EDIT-SHOP DISCOVERY **이후**

---

## 1. 무엇이 발견됐나

`MATCHING-3.2-D` 조사(2026-09-14) 중 드러났다. 셀러가 **등록 편의를 위해** 상품
정보를 다듬으면, 그 편집이 **매칭 입력을 조용히 훼손**한다.

실측 사례 — Smallable `430663`:

```
title          원본  "… | Lavender"
               편집  "Bobo Choses 26FW Straight Jogging Pants"      USER_EDITED
color          원본  optionGroups = ["Lavender"]  (JSON-LD hasVariant[0].color)
               편집  color.value = "BLUE"                           USER_EDITED · confidence 1
sku            원본값이 지워짐                                       USER_EDITED
manufacturer   편집됨                                                USER_EDITED
```

원본 페이지 728KB 전문에 **상품 색으로서의 "blue"가 없다.** 형제 색상은
`430664 Navy blue`로 별도 URL이다.

## 2. 왜 조용한가 — 두 단계로 끊긴다

```
1단계   제목 편집이 파서 경로를 끊는다
        extractColorFromTitle("… | Lavender") → "Lavender"   ← 원래는 이렇게 뽑혔다
        제목에서 "Lavender" 가 사라지자 이 경로가 죽었다
        (같은 파서 규칙이 나머지 44건 중 42건은 정확히 재현한다)

2단계   그 빈자리에 사람이 값을 넣는다
        source=USER_EDITED, confidence=1 로 저장된다
        confidence 1 은 "확실하다"는 뜻인데, 확실한 것은 사람의 의도이지 사실이 아니다
```

**셀러에게는 아무 경고도 없다.** 제목을 고치는 화면과 매칭 근거가 만들어지는 곳이
서로를 모른다.

## 3. 실제 피해

`430663`의 같은 상품 세 색(`AC060` 라벤더 / `AC059` 다크그린 / `AC061` 일렉트릭블루):

```
optionGroups 기준   정답 AC060 만 SAME          ✅ 정확히 갈랐다
color.value 기준    오답 AC061 만 SAME          ❌ 정확히 반대로 갈랐다
```

즉 **편집된 색상 하나가 동일상품 판정을 뒤집었다.** `compareColor` 불일치는
`conflicts`로 들어가 **점수를 보기도 전에 CONFLICT로 끝내므로**, 잘못된 편집값은
정답 쌍을 즉사시킬 수 있다.

## 4. 이 문서가 다루는 범위 — 색상보다 넓다

색상은 `MATCHING-3.2-E`가 따로 다룬다. **이 문서의 주제는 그 위 계층이다:**

> **등록을 위한 편집과 매칭을 위한 원본이 같은 칸을 쓰고 있다.**

영향을 받을 수 있는 필드(확인 필요, 미측정):

```
title          매칭 질의 · coreTitleTokens · TITLE 축
color          COLOR 축 (hard conflict)
sku            identifier · modelCode 비교
brand          BRAND 축 (hard conflict)
manufacturer   ?
description    material · fit 추출의 원천
```

## 5. 조사 방향 (확정 아님)

1. **편집 전 원본을 보존하고 있는가.** `ProvenanceField`에 `source`는 있는데
   **원본값을 남기는 칸이 있는가.** 없다면 편집은 되돌릴 수 없는 파괴다.
2. **매칭은 원본을, 등록은 편집본을 써야 하는가.** 그게 옳다면 두 값을 분리해
   들고 있어야 한다.
3. **`confidence=1`의 의미.** 사람이 넣은 값에 최고 신뢰도를 주는 것이 옳은가.
   사람은 등록이 통과하도록 값을 채우지, 원본을 증언하려고 채우지 않는다.
4. **셀러에게 알려야 하는가.** "이 편집은 가격비교 정확도에 영향을 줍니다" 같은
   경고가 필요한지, 아니면 구조로 막아야 하는지.

## 6. 하지 말 것

```
❌ 셀러 편집 기능 자체를 막기          등록에 필요한 기능이다
❌ USER_EDITED 값을 전역으로 무시       색상 하나의 사례로 전체를 끄지 않는다
❌ 430663 한 행을 고쳐서 실험 결과 바꾸기   ← 이 저장소가 이미 한 실수
❌ MATCHING-3.2-E 와 섞기              그쪽은 색상 축 하나만 다룬다
```

## 7. 표본 한계 (정직하게)

**전 DB에서 `USER_EDITED` 색상은 이 한 건뿐이다.** 다른 필드의 편집 빈도는
아직 세지 않았다. 한 건 위에서 구조를 바꾸면 그것도 같은 종류의 실수가 된다.
`MATCHING-3.2-E` STEP 2가 `color / sku / title` 건수를 세고 있으므로 그 결과를
이 문서에 이어 붙인다.

## 8. 관련 문서

- `docs/matching-3.2-d-color-authority.md` — 이 발견의 출처
- `docs/matching-2.0-regression-430632.md` — 재개방 상태
- `docs/matching-regression-booty-ghosts.md` — 별건
