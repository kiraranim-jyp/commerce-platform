# WU-022-2 — 18 rawAnswer **정량 측정 결과** (운영 코드 0)

🔴 운영 코드 0 · MI 0 · threshold 0 · 색상사전 0 · `PRESUMED_SAME` 정책 0 · Registry 0 ·
Shopify Suggest 0 · Category/Sourcing 0 · schema 0 · DB 쓰기 0 · AI API 0 · 키 0 · 결제 ₩0 ·
배포 0. 🟡 후보 페이지 **HTTP 37회**(read-only GET).

---

## 0. 🔴🔴 먼저 — **수집 조건이 규격과 다르다.** 모든 숫자에 이 전제가 붙는다

```
① 🔴🔴 입력이 «원상품 URL» 이 아니라 **SKU/품번** 이었다
   증거: S5 에서 Claude·Gemini 둘 다 「`Vernice Nero` 만으로는 특정 불가」라고 답했다.
         원상품 URL(junioredition .../lulu-t-bar-shoes-in-vernice-nero-by-pepe)을 받았다면
         나올 수 없는 답이다. 패킷 §1-② 는 「원상품 URL 말고는 아무것도 주지 않는다」.
   🔴 그래서 이 측정은 **「URL 주고 찾기」가 아니라 「품번 주고 찾기」** 다. 성격이 다르다.
② 🔴 고정 프롬프트를 쓰지 않았다 — 답변들이 「SKU별 국내/해외 동일상품 URL」에 답하고 있다
③ 🔴 한 대화에 6상품을 한꺼번에 물었다(§1-⑤ 위반) → 상품 간 문맥 혼입 가능
④ 🔴 접두사 규격(「검색 결과 없음 / 동일상품 후보 없음 / 후보 있음」) 미준수
   → outcome **18/18 전건 UNLABELED** → 🔴 **「검색 실패 ↔ 후보 없음」을 가를 수 없다**
⑤ 🔴 AI verdict(SAME/DIFFERENT/UNCERTAIN) 축을 수집하지 않았다 → AI KPI **측정불가**
```

🟢 **그래도 측정을 돌렸다** — CPO 지시(§2)대로 전달된 텍스트를 그대로 쓰고 재구성하지 않았다.
🔴 **일반화하지 않는다.** 원상품 6건 · 모델 1회씩이다.

### 원문 보존과 분할 — 🔴 손으로 자르지 않았다

3개 모델이 **한 답변에 6상품**을 담아 왔으므로 `searchId` 단위로 잘라야 했다.
🟢 모델이 **스스로 쓴 머리글**을 경계로 쓰는 결정적 규칙(`split-raw.cjs`)을 돌렸다.

```
claude  /^S([1-6])\.\s/m      gemini  /^### \d+\. S([1-6]) /m      gpt  /^# S([1-6]) — /m
전 모델 S1~S6 **6섹션 전부 검출** · 🟢 머리글 밖(서문·꼬리)에 있던 URL **0건**
   → 분할로 **유실된 URL 이 없다**. 🔴 귀속 불가 구간은 어느 searchId 에도 넣지 않았다.
```

---

## 1. §9 표 — Model × searchId

| Model | S | raw | URL후보 | known+ | GT | MI(strict) | MI(raw) |
|---|---|---|---:|---:|---|---|---|
| claude | S1 | OK | 4 | **1** | S S | S S | SAME, SAME |
| claude | S2 | OK | 4 | **1** | S S S | S S S | SAME, SAME, SAME |
| claude | S3 | OK | 3 | 0 | S S | S S | SAME, **PRESUMED_SAME** |
| claude | S4 | OK | 5 | 0 | ⚪ | ⚪ | 🔴 원상품 덤프 부재 |
| claude | S5 | OK | **0** | 0 | — | — | — |
| claude | S6 | OK | 1 | 0 | S | S | **PRESUMED_SAME** |
| gemini | S1 | OK | 1 | 0 | S | S | SAME |
| gemini | S2 | OK | 4 | 0 | S S | S S | **PRESUMED_SAME ×2** |
| gemini | S3 | OK | 2 | 0 | S | S | SAME |
| gemini | S4 | OK | 2 | 0 | ⚪ | ⚪ | 🔴 원상품 덤프 부재 |
| gemini | S5 | OK | **0** | 0 | — | — | — |
| gemini | S6 | OK | **0** | 0 | — | — | — |
| gpt | S1 | OK | **0** | 0 | — | — | — |
| gpt | S2 | OK | **0** | 0 | — | — | — |
| gpt | S3 | OK | 3 | 0 | S S | S S | SAME, **PRESUMED_SAME** |
| gpt | S4 | OK | 4 | 0 | ⚪ | ⚪ | 🔴 원상품 덤프 부재 |
| gpt | S5 | OK | 2 | 0 | **S D** | **S D** | SAME, **SIMILAR** |
| gpt | S6 | OK | 1 | 0 | S | S | **PRESUMED_SAME** |

🔴 **S4 는 측정에서 빠졌다**(3모델 11후보) — 원상품(Main Story Grey Melange)이 로컬
덤프(`mi-017-e2e-cases.json`)에 **없어서** `withConfidence` 를 돌릴 수 없었다.
🔴 **「S4 에서 AI 가 실패했다」가 아니다 — 우리 쪽 입력 부재다.**

---

## 2. Discovery — 🟢 모델 간 차이가 실제로 갈렸다

| 모델 | URL 후보(추출 후) | known-positive 발견 | 미검증 신규 | 후보 0 인 상품 |
|---|---:|---|---:|---|
| **claude** | **17** | 🟢 **2/5** | 15 | S5 |
| **gemini** | 9 | 0/5 | 9 | S5 · S6 |
| **gpt** | 10 | 0/5 | 10 | S1 · S2 · S5 |

🔴 **「gpt 가 S1·S2 에서 못 찾았다」로 읽지 않는다.** gpt 는 그 둘에 URL 을 **적었다**(각 3·4개).
추출기가 **상품 상세가 아닌 URL**(신세계V 브랜드관 · LF몰 **검색결과** · 공식몰 **collections**)을
걸렀다. 🟢 그것이 설계된 동작이고, 「사이트 추천 ≠ 상품 발견」이라는 CPO 원칙의 구현이다.
🟡 즉 gpt 는 **후보를 넓게 말했지만 상품 URL 로는 적게 남았다.**

🔴 **known-positive 2/15 를 「AI 가 나쁘다」로 읽으면 틀린다** — 그 집합은 **하한**이고
S3·S5·S6 의 known-positive URL 들(공식몰 b126ai018 · b226ac117 · foretforet · deuxbebe)은
이번에 아무 모델도 내놓지 않았다. 🟢 대신 아래 §4 가 더 중요한 숫자를 준다.

---

## 3. GT — 🟢 검증 장치가 전건 통과했다

```
후보 행 25 → GT 조인 **17** · 🟢 거부 **0** · 🟢 **gtToken 불일치 0**
   (= 내가 세운 GT 가 **실제로 가져온 제목과 전건 일치**했다 · 019A §3 장치)
UNVERIFIED **2**  rboutique(색상·품번 제목에 없음) · stockmann.ee(색상·품번 제목에 없음)
   🔴 AI 가 「B226AC010 · 그레이」·「컬러 451 LIGHT BLUE」라고 적었지만 **AI 주장은 GT 가 아니다**
UNREACHABLE **8** bobochoses.com/de-de · skroutz.ro · feelway ×2 · zozo.jp · tinyapple(입고중) …
   🔴 「없는 상품」이 아니라 **우리가 못 읽은 것** 이다
GT 라벨(고유) 15 = SAME **14** · DIFFERENT **1**
```

🟢 **DIFFERENT 1건이 중요하다** — gpt 가 S5 국내 후보로 낸 Beaumonde `Pepe 00225 VERNICE NERO`
(원상품은 `01195-VERNICE-NERO`). 품번도 품목(부츠↔T-Bar)도 다르다. 🟢 **GPT 스스로도
「같은 상품이라고 확정하면 안 돼」라고 적었고**, GT 와 MI 가 둘 다 DIFFERENT 를 냈다.

---

## 4. 🟢🟢 MI KPI — strict 축에서 **완벽하다**

```
MI strict     n=17 · Accuracy **1.000** · Precision(SAME) **1.000**
              **False SAME = 0** · **missed-SAME = 0**
MI threeWay   n=17 · Accuracy 0.647 · Precision 1.000 · False SAME 0 · missed-SAME **6**
모델별 strict  claude 1.00(8행) · gemini 1.00(4행) · gpt 1.00(5행) — 전부 False SAME 0
```

🔴 **두 축을 같이 읽는다**(하나만 쓰면 결과가 숨는다):
```
strict   PRESUMED_SAME → SAME 으로 센다  → 17/17 정답
threeWay PRESUMED_SAME → UNCERTAIN       → 6건이 「보류」로 빠져 Accuracy 0.647
🟢 즉 **MI 가 틀린 건이 0 이고**, 남은 것은 **「확신을 유보한 6건」** 이다.
   PRESUMED_SAME 6건의 GT 는 **전부 SAME** 이었다 —
     trenbe(B126AI018) · kihanan(B226AC117) · biskuit(B226AC009) ·
     luxboy(B226AC009) · bobochoses.co.jp(B126AI018) · mustit(B226AC117)
🔴 그렇다고 「PRESUMED_SAME 을 SAME 으로 올려라」로 읽지 않는다 — 이 표본은 n=6 이고,
   019A 에서 **PRESUMED_SAME 6/6 이 GT DIFFERENT 였던** 반대 사례가 있다. 정책 변경 금지(§10).
```

### 🟢🟢 이번 측정의 가장 큰 결과 — **신규 true-SAME 12건**

```
GT SAME 고유 14건 중 019A known-positive 집합에 있던 것은 **2건** 뿐이다
→ 🟢 **AI Discovery 가 기존 정답 집합에 없던 «진짜 동일상품» URL 을 12개 가져왔다**
   (tinyapple ×2 · trenbe ×2 · biskuit · luxboy · bobochoses ko-kr · bobochoses.co.jp ·
    junioredition ×2 · kihanan · mustit)
   그리고 **MI 가 그 전부를 strict 기준으로 맞게 판정했다(False SAME 0).**
🔴 단 §0 의 전제가 붙는다 — **품번을 주고 찾은 결과** 다. URL 만 주고도 같은 결과가 나올지는
   **미측정** 이다.
```

---

## 5. 🔴 AI 축 — **측정불가** (0% 가 아니다)

```
AI Accuracy · Precision · False SAME · missed-SAME · AI↔MI Agreement · 4분면
  → 🔴 **전부 측정불가**
이유: 세 모델 중 아무도 후보 «개별» 에 대해 `SAME|DIFFERENT|UNCERTAIN` **세 단어**를 주지 않았다.
  GPT 는 「판정: 동일상품」을 **상품 단위 산문**으로 적었다 → validator 가 산문을 거부한다(설계대로).
🔴 내가 그 산문을 세 단어로 «번역하지 않았다» — 그러면 AI 의 판정이 아니라 **내 판정**이 된다.
```

🟡 **AI 축을 재려면 2차 수집 한 번이 더 필요하다** — 같은 후보 목록을 AI 에게 보여 주고
**세 단어 중 하나만** 받는다(`mi-022-ai-verdicts.json`). 🔴 그때까지 **AI vs MI 우열을
판정하지 않는다.**

---

## 6. 판정

```
MI (strict)       🟢🟢 **17/17 · False SAME 0 · missed-SAME 0**
MI (threeWay)     🟡 Accuracy 0.647 — 틀린 게 아니라 **6건을 보류**했다
AI Discovery      🟢 **작동한다** — 신규 true-SAME **12건** 확보(모델 합계)
                  🟡 모델 차: claude 후보 17 / gemini 9 / gpt 10(상품 URL 기준)
AI Identity       🔴 **측정불가** — 세 단어 verdict 미수집
AI vs MI 우열      🔴 **판정하지 않는다**
```

🔴 **이번 데이터로 바꾸지 않은 것**: MI threshold · 색상사전 · `PRESUMED_SAME` 정책 ·
AI/MI ensemble · Category · Sourcing · Search 엔진 · Registry. **전부 0.**

## 7. 다음에 필요한 것 — 둘 다 작고, 하나는 우리 쪽 일이다

```
🟢 CTO 가 할 수 있는 것 — S4 원상품을 덤프에 채우면 **11 후보가 추가로 측정된다**
   (지금은 우리 입력 부재로 빠져 있다 · AI 실패가 아니다)
🟡 CPO/CEO 쪽 — ⒜ AI verdict 2차 수집(세 단어) ⒝ 규격대로 «원상품 URL» 로 재수집하면
   「품번 주고 찾기」와 「URL 주고 찾기」를 **분리해서** 비교할 수 있다
```
