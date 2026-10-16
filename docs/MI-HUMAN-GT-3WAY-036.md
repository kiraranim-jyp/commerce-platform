# WU-036 — AI 후보 → MI → 사람 육안 GT **3-Way 최종**

> 🔴 **2차 수집분이다.** 1차는 내 도구 결함으로 무효였다(전문
> `MI-HUMAN-GT-CONTROL-FAILURE-036.md`). 운영 코드 변경 **0** · AI 호출 **0** ·
> HTTP **0**(캐시) · 비용 **₩0**.

---

## 1. 🟢 CONTROL — 이번엔 통과했다

| | 1차(무효) | **2차** |
|---|---|---|
| 자기동일 쌍 4건(C09·C12·C17·C48) | 전부 DIFFERENT 🔴 | **전부 SAME** 🟢 |
| SAME 이 나온 그룹 | **1 / 6** 🔴 | **6 / 6** 🟢 |
| 미판정 | 1 | **0** |

🟢 두 게이트가 다 통과했으므로 **이 숫자는 전략 판단에 쓸 수 있다.**

---

## 2. KPI — Human GT 기준 전면 재계산 (전수 n=51)

```
Human   SAME **27** · DIFFERENT **23** · UNCERTAIN **1**
MI      SAME 10 · PRESUMED_SAME 27 · SIMILAR 4 · CONFLICT 10

🔴 P0  **False SAME = 1**      (Human DIFFERENT 인데 MI SAME)
🟡 P0  **SAME MISS  = 18**     (Human SAME 인데 MI ≠ SAME)
       MI SAME 의 Precision = 9/10 = **0.900**
       Recall                = 9/27 = **0.333**
       MI↔Human 일치율(UNCERTAIN 제외) = **0.620**
       기존 priorGt 와 어긋난 건 = **7**
```

🔴🔴 **그래서 「MI Precision 1.000 / False SAME 0」은 Human GT 기준에서 더 이상 성립하지
않는다.** 🔴 단 **N=1** 이고, 그 한 행에 중대한 단서가 있다(§3).

---

## 3. 🔴 P0-1 — False SAME **1건** 의 전수 분석 (C06)

```
원상품  Hug Hairy Monster T-Shirt by Bobo Choses · **Light Blue** · **B226AC009**
        설명 원문: 「… featuring **long sleeves** … Colour - Light Blue … B226AC009」
후보    global.trenbe.com
        「Bobo Choses Kids Hug Hairy Monster **Long Sleeve** T-Shirt (**Light Blue**)
          **B226AC009** 451 160484657 [P]」
MI      SAME · blocker 0 · 축 TITLE·MODEL_CODE·CATEGORY·COLOR·AUDIENCE
Human   **DIFFERENT** — 근거 「컬러가 다름」
```

🔴🔴 **기계가 볼 수 있는 축은 전부 일치한다** — 품번 동일 · 표기 색상 동일 · 브랜드 동일 ·
소매 길이까지 동일(원상품 설명이 `long sleeves` 라고 적는다). **소매 차이 가설은 반증됐다.**

🔴 그리고 **같은 조건의 C05 는 Human SAME 이다**:
```
C05 tinyapple  「Bobo Choses Hug Hairy Monster T-shirt, Light Blue」  → Human **SAME**
C06 trenbe     「… Long Sleeve … (Light Blue) B226AC009」             → Human **DIFFERENT**
```

🔴🔴 **그러므로 둘 중 하나다 — 그리고 CTO 는 둘 중 어느 쪽도 단정하지 않는다**:
```
⒜ trenbe(리세일 플랫폼) 상세 이미지가 자기 제목과 다른 색을 보여준다
⒝ 사람 판정이 C05 ↔ C06 사이에서 갈렸다
```
🔴 **「Precision 1.0 이 깨졌다」를 이 한 행으로 확정하지 않는다.** 재확인이 필요하다 —
그것이 이 WU 에서 **CEO 에게 남은 유일한 질문** 이다(§8).

🟢 **한편 다른 9건은 전부 맞았다**(C01·C02·C03·C04·C05·C09·C12·C17·C44).

---

## 4. 🟡 P0-2 — SAME MISS **18건** 을 CPO §8 분류로 전수 분해

| 분류 | 건수 | blocker | 성격 |
|---|---:|---|---|
| **브랜드 증거 부족** | **9** | `BRAND_UNCONFIRMED` | 🔴 WU-034 가 「안전한 확인 증거원 없음」으로 닫은 그 축 |
| **🔴🔴 «동일상품» 정의 차이** | **6** | `SIZE_SYSTEM` 4 + CONFLICT 2 | §5 — MI 결함이 아니다 |
| 제목 겹침 없음 | 3 | `NO_TITLE_OVERLAP` | 국내 샵 한글 제목 |
| 브랜드 오염 | 1 | `BRAND_MISMATCH` | biskuit.kr 의 brand 칸 = **「비스킷」(샵 이름)** — WU-034 실측 그대로 |
| 소재 | 1 | `MATERIAL` | blanchou.ca |
| 축 부족 | 3 | 없음 | C10·C33·C35 |

🔴 합계가 18 을 넘는 것은 **한 건에 blocker 가 둘 이상** 붙기 때문이다(상호배타 아님).

---

## 5. 🔴🔴🔴 이번 WU 의 최대 발견 — **「동일상품」의 정의가 CEO 와 MI 사이에서 다르다**

`priorGt → Human` 이 뒤집힌 7건 중 **5건이 한 성질** 이다:

| | 후보 | MI | Human | 성질 |
|---|---|---|---|---|
| C29 | cissywears **baby** booty ghosts t-shirt | PRESUMED (`SIZE_SYSTEM`) | **SAME** | baby 판 |
| C30 | billsstore booty ghosts l/s t-shirt **baby** | PRESUMED (`SIZE_SYSTEM`) | **SAME** | baby 판 |
| C33 | junioredition hug hairy monster **baby** t-shirt | **CONFLICT** | **SAME** | baby 판 |
| C34 | cissywears **baby** hug hairy monster t-shirt | PRESUMED (`SIZE_SYSTEM`) | **SAME** | baby 판 |
| C35 | bornyesterdaykids baby … t-shirt **+ denim pants SET** | **CONFLICT** | **SAME** | **세트 상품** |

> 🔴🔴 **CEO 는 「baby 사이즈 라인」과 「세트 구성」까지 같은 상품으로 본다.**
> MI 는 `SIZE_SYSTEM` · `CONFLICT` 로 그것을 **의도적으로 막는다.**

🔴 **이것은 MI 버그가 아니라 제품 정책 정의다. CTO 가 바꾸지 않았다.**
🔴 그리고 바꾸면 **등록 결과가 실제로 달라진다** — baby 판 가격이 성인 판의 국내 최저가로
들어가고, 세트 가격이 단품 가격으로 비교된다. **가격 판정 오염 경로다.**

🟢 반대 방향 2건(C06·C08)은 `prior=SAME → human=DIFFERENT` 이고 둘 다 **「컬러가 다름」** 이다.

---

## 6. CPO §12 — **variant-level identifier 가설 재검증**

```
🟢 **지지된다.** S4(Main Story `AW26MS185`) 색상 변형 후보 9건 →
   Human **전부 DIFFERENT**(근거 「다른 컬러」 4건 명시).
🟢🟢 그리고 **MI 가 그 9건 중 SAME 을 하나도 주지 않았다** —
   현재의 보수성이 정확히 그 축을 막고 있다.
🔴 **그러나 그것만으로는 부족하다** — 유일한 False SAME(C06)은 품번도 색상도 «같다».
   variant 식별자를 넣어도 C06 은 걸러지지 않는다.
```

---

## 7. CPO §11 — 병목 판정

```
AI Discovery  🟢 후보 51 중 Human SAME **27 (53%)** — pool 품질은 병목이 아니다
Extraction    🟡 오염 존재 — C06 의 `color = "shirt light blue"`(제목 조각이 섞였다) ·
                 PLAIN_HTML 경로 14칸 중 9칸 결손(WU-033)
MI            🔴 **Recall 0.333 이 병목** — 🔴 단 손실 18 중 **6건(33%)은 코드가 아니라 «정의»**
Human         🟢 51/51 판정 · UNCERTAIN 1(「이미지가 작아서 검토 불가」)
```

> **병목은 MI Recall 이고, 그 1/3 은 고칠 코드가 아니라 «정해야 할 정의» 다.**

🔴 **AI 출처별은 참고값이다**(CPO §10 — 순위화 금지 · 분모가 다르고 중복 출처가 있다):
`claude 13건/SAME 8 · gemini 6/4 · gpt 10/5 · cto-websearch 33/19`.
🟢 공통 사실 하나 — **어느 AI 를 쓰든 후보 pool 의 약 절반은 DIFFERENT 다.**

---

## 8. 최종 판정

```
CONTROL          🟢 PASS (자기동일 4/4 SAME · SAME 분포 6/6 그룹 · 미판정 0)
False SAME       🔴 **1** (C06) — 🔴 N=1 이고 C05 와 모순된다. **확정하지 않는다**
SAME MISS        🟡 **18** — 브랜드 9 · **정의 차이 6** · 제목 3 · 기타 3
Precision        0.900   Recall 0.333   일치율 0.620
variant 가설      🟢 지지 — 🔴 단 C06 은 설명하지 못한다
코드 변경         🟢 **0** (§15 — 원인이 정의 문제라 고칠 코드가 없다)
──────────────────────────────────────────
**HOLD** — 다음은 구현이 아니라 **CPO 결정 둘** 이다.
```

### 🔴 CPO 결정 둘 (CTO 가 고르지 않았다)

```
① 🔴🔴 **「baby 사이즈 라인 / 세트 구성」을 같은 상품으로 볼 것인가**
   그렇다 → SAME MISS 18 중 6 이 사라진다. 🔴 그러나 baby 가격·세트 가격이
            성인 단품 가격 비교에 들어간다(가격 판정 오염).
   아니다 → 현재 MI 가 옳고, Human GT 쪽을 그 정의로 재라벨해야 한다.
   🔴 **어느 쪽이든 먼저 정의를 적어야 다음 측정이 의미를 갖는다.**

② 🔴 **C06 재확인 1건** — 유일한 False SAME 이고 C05 와 모순된다.
   trenbe 상세 이미지가 제목과 다른 색인지만 보면 닫힌다.
```

🔴 **CEO Action: C06 한 건 재확인**(②). 그 외 추가 육안 판정은 없다.
