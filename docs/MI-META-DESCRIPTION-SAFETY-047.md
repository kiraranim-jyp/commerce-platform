# WU-047 — C34 증거 충돌 + meta description 전수 안전성 검증

> 🔴 **조사 전용 / 채택 불가.** 운영 코드 변경 **0** · 배포 **없음** · 작업트리 **clean** ·
> AI 0 · 외부 API 0 · HTTP 0(캐시). 기준선 **SAME 13 / FP 1 / MISS 15** 유지.

---

## §A C34 충돌 원인 — **확정됐다**

증거원 전수 대조(캐시 HTML):

| 증거원 | 값 | 판정 |
|---|---|---|
| `<title>` · `og:title` | Bobo Choses Baby **Hug Hairy Monster** T-Shirt | 🟢 맞다 |
| **JSON-LD description** | 「The little **hairy monster** looks completely content being hugged」 | 🟢 **맞다** |
| **meta / og:description** | 「**Softpaw bear** print in **coral on soft pink**」 | 🔴 **틀렸다** |
| **og:image** | `cdn/shop/files/**B226AB040**_1.jpg` | 🟢 **결정적** |

```
페이지 전체 낱말 수  coral 3 · softpaw 3 · **hug hairy 0** · **hairy monster 0** · light blue 0
```

🔴🔴 **meta description 하나만 다른 상품을 말한다** — 상점의 템플릿/복사 오류다.
🟢 **Human GT(SAME)를 뒤집을 근거가 아니다.** 제목·JSON-LD·이미지가 모두
「Hug Hairy Monster」를 가리킨다.

---

## §D 🔴🔴 WU-046 의 내 결론을 **정정한다**

WU-046 에서 「원천 부재」라고 적었다. **틀렸다 — 원천이 있다.**

```
C29  og:image = **B226AB046**_1.jpg     원상품 B226AC010
C34  og:image = **B226AB040**_1.jpg     원상품 B226AC009
                 ↑ `B226AB***` = **baby 라인** · `B226AC***` = **kids 라인**
```

🔴 즉 C29·C34 는 **「축 부족」이 아니라 「품번이 실제로 다른 baby 라인」** 이다.
🟢 그리고 그것은 **C33 과 같은 사례** 다 — C33(junioredition baby)은 이미
`B226AB040` 으로 **MODEL_CODE 충돌** 이 떠서 CONFLICT 다.

### 🔴 그래서 셋은 같은 «정책» 질문이다

```
C29 · C33 · C34 = 같은 디자인의 **baby 라인** 이고 **품번이 다르다**
CPO 정책      「같은 모델 + **사이즈만** 다름 → SAME」
             🔴 그런데 **품번이 다르면 같은 모델이 아니다**
Human GT     SAME
```

🔴 **그 품번을 추출하면 C29·C34 는 CONFLICT 가 된다**(C33 처럼). Human GT 와
**반대 방향** 이다. 그러므로 「증거를 더 넣어 회수한다」가 성립하지 않는다.

### 정책/기술 분리 (CPO §D)

```
① C29  🔴 **정보 부족이 아니다** — 품번이 다른 baby 라인이다 (정정)
② C34  🔴 **페이지 증거 충돌이 아니다** — meta 하나만 틀렸고 나머지는 정합하며,
          실체는 ①과 **같은 baby 라인 품번 차이** 다 (정정)
③ 🔴🔴 **둘을 「축 부족」으로 뭉뚱그리면 안 된다**는 CPO 지적이 맞았다.
   다만 가르는 축은 「정보 부족 ↔ 증거 충돌」이 아니라
   **「품번이 다른 baby 라인」이라는 하나의 정책 질문** 이었다.
```

---

## §B meta description 전수 안전성 — **채택 불가**

### ① 오염 실측 (구조적)

`meta description` ↔ `JSON-LD description` 낱말 겹침으로 오염을 셌다:

```
둘 다 있는 **32건** 중 **3건(9.4%)** 이 서로 다른 상품/사이트를 말한다
  🔴 C34 cissywears   겹침 0.05  (Softpaw ≠ Hug Hairy Monster)
  🔴 C40 kolkid.ca    겹침 0.00
  🔴 C43 donokids     겹침 0.00  ← **쇼핑몰 사이트 소개문** 이 들어가 있다
```

### ② 반사실 측정 (전수 51 · 운영 `withConfidence`)

기존 색조 사전으로 meta description 에서 색조를 가진 구절을 찾아
`colorText` 가 빈 후보에 주입했다(**새 사전 0**).

| KPI | 기준선 | meta 주입 후 |
|---|---:|---:|
| MI SAME | 13 | **13** |
| False SAME | 1 | **1** |
| SAME MISS | 15 | **15** |

🔴 **순증 0.** 그리고 **바뀐 행이 하나 있는데 악화다**:
```
🔴 C34 cissywears  PRESUMED_SAME → **CONFLICT**   Human = **SAME**
   「coral on soft pink」가 색상으로 주입돼 원상품 Light Blue 와 충돌한다
```

### ③ CPO 안전 기준 6항 — **2항 위반**

| 기준 | 결과 |
|---|---|
| False SAME 증가 0 | 🟢 1 → 1 |
| C19/C20/C25 보호 유지 | 🟢 변화 없음 |
| C06 악화 없음 | 🟢 변화 없음 |
| **Human SAME 회수의 실제 순증** | 🔴 **0** |
| **산문 오염으로 인한 새 오판 없음** | 🔴 **C34 가 CONFLICT 로 악화** |
| 새 색상 사전 불필요 | 🟢 기존 resolver 만 사용 |

> CPO: 「하나라도 충족하지 못하면 meta description 을 운영 추출원으로 채택하지 않습니다.」
> → **채택하지 않는다.**

---

## §C 최종 판정

```
C34 충돌 원인     🟢 **확정** — meta 하나만 틀렸고 og:image 가 `B226AB040` 을 싣는다
WU-046 정정       🔴 「원천 부재」가 아니라 **「품번이 다른 baby 라인」** 이다
C29·C33·C34       🟢 **같은 사례** 로 묶인다 — 정보 부족도 증거 충돌도 아니다
meta description  🔴 **채택 불가** — 순증 0 · C34 악화 · 오염 9.4%
코드 변경         🟢 **0** · 배포 **없음** · 기준선 **유지**
──────────────────────────────────────────
**HOLD / STOP(meta description 축)**
```

### 🔴 CPO 결정 — 하나로 좁혀졌다

```
**「같은 디자인의 baby 라인이 «다른 품번» 을 가질 때 SAME 인가」**

🔴 CPO 정책 「같은 모델 + 사이즈만 다름 → SAME」은 **품번이 같을 때의 규칙** 이다.
   C29·C33·C34 는 품번 자체가 `AB` ↔ `AC` 로 갈린다.
⒜ 「다른 품번 = 다른 모델 → DIFFERENT」 → Human GT 3건을 그 정의로 **재라벨** 해야 한다
   (그러면 MISS 15 → 12 가 되고 기준선이 바뀐다)
⒝ 「같은 디자인이면 품번이 달라도 SAME」 → `compareModelCode` 의 충돌 규칙을 바꿔야 하고
   🔴 그것은 B226AC042↔B226AC043(색상 변형)을 지키던 **바로 그 규칙** 이다(cross-seller.ts:758 주석)
🔴 **CTO 가 고르지 않았다.** ⒝ 는 안전장치를 건드리므로 측정 전 구현 금지다.
```

🔴 **CEO Action: NONE.**
