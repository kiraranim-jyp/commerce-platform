# WU-022-4 수집 패킷 — AI Identity **세 단어** 수집 (모델당 26건)

🔴 자동화 0 · Playwright 0 · Extension 0 · AI API 0 · 키 0 · 결제 ₩0.
🟢 사람이 자기 브라우저에서 직접 묻고 답을 복사한다(WU-002 가 막은 것은 「자동 입력」이다).
🔴 **CTO 가 CEO 에게 직접 요청하지 않는다**(§3). CPO 가 전달한다.

---

## 0. 한 장 요약

```
무엇을   AI 1개를 열고 아래 26건에 대해 **세 단어 중 하나만** 받는다
몇 건    모델당 **26건** (고유 후보 수 · GT SAME 16 · DIFFERENT 10)
어디에   %TEMP%\mi-p0-02\mi-022-ai-verdicts.json
준비물   🟢 프롬프트 본문   %TEMP%\mi-p0-02\mi-022-4-prompt.txt   (26건 전부 생성돼 있다)
         🟢 답 넣을 템플릿 %TEMP%\mi-p0-02\mi-022-ai-verdicts.TEMPLATE.json (78행 · 3모델×26)
```

🟡 **모델을 다 하지 않아도 된다.** 한 모델만 와도 그 모델의 KPI 는 나온다.
🔴 모델별 행 수를 **억지로 맞추지 않는다**(지시서 §2). 수집된 만큼 그대로 기록된다.

---

## 1. 🔴 AI 에게 줄 지시문 (그대로 붙여넣는다)

```
아래 각 항목에 대해 「원상품」과 「후보」가 **완전히 같은 실제 상품인지** 판정해 주세요.

🔴 답은 반드시 다음 세 단어 중 **하나만** 적습니다. 다른 말을 덧붙이지 마세요.

    SAME
    DIFFERENT
    UNCERTAIN

- 확신이 서지 않으면 UNCERTAIN 을 쓰세요. 추측으로 SAME 을 쓰지 마세요.
- 색상·사이즈군이 다르면 같은 품번이라도 DIFFERENT 입니다.
- 판매 국가/시장만 다르고 상품이 같으면 SAME 입니다.
- 이유·확신도·가격을 적지 마세요. 「SAME (0.9)」·「동일상품입니다」는 무효 처리됩니다.

출력 형식(번호와 세 단어만):
1. SAME
2. DIFFERENT
...
```

그 아래에 `mi-022-4-prompt.txt` 내용을 **그대로** 붙입니다(26건이 번호와 함께 들어 있습니다).

### 🔴 무효 처리되는 답 (정규화하지 않습니다)

```
SAME (0.95)      동일상품입니다      판정: 동일상품
동일상품으로 보입니다      SAME - confidence 0.9      same (소문자)
→ 전부 **AI_VERDICT_INVALID** 로 기록된다. 🔴 사람이 의미로 번역하지 «않는다».
🟢 INVALID 도 버리지 않고 센다 — 버리면 분모가 조용히 줄어든다.
```

---

## 2. 답 넣기

`mi-022-ai-verdicts.TEMPLATE.json` 의 `verdict` 칸을 채우고 파일명을
**`mi-022-ai-verdicts.json`** 으로 바꿉니다. (수집 안 한 모델의 26행은 **통째로 지웁니다** —
빈 문자열로 남기면 그 모델 전체가 INVALID 로 집계됩니다.)

```json
[
  { "searchId": "S1", "candidateUrl": "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
    "model": "claude", "verdict": "SAME" },
  …
]
```

🟢 검증기가 잡는 것 — 모르는 후보 · `(model, 후보)` 중복 · 비배열 · 세 단어 아님(INVALID 기록).

---

## 3. 🔴🔴 이 측정의 **의도된 편향**을 먼저 적는다

```
프롬프트에 **후보의 관측 제목**을 같이 넣는다(AI 가 URL 을 못 열 수 있으므로).
🔴 그 제목에는 **색상 단어가 들어 있다**(예: 「… Graystone」·「… Grey Melange」).
→ 🔴 그러므로 이 설계는 **Q3(AI 도 색상 failure mode 를 갖는가)에서 AI 에게 유리하다.**
   ⒜ AI 가 그래도 Graystone 을 SAME 이라 하면 → **강한 신호**(제목에 답이 있는데도 틀렸다)
   ⒝ AI 가 DIFFERENT 라 하면 → 🔴 **약한 신호** — 「쉬웠다」와 구분되지 않는다
🔴 보고서에 이 단서를 반드시 같이 적는다.
```

---

## 4. 들어오면 CTO 가 추가 질문 없이 내는 것

```
모델별   수집 수 · INVALID 수 · SAME/DIFFERENT/UNCERTAIN **분포**
         Accuracy · Precision(SAME) · False SAME · missed-SAME  🔴 분모 0 이면 **N/A**
AI vs MI 3×3 행렬(🔴 2×2 로 접지 않는다 — UNCERTAIN 이 숨는다) ·
         Agreement · AI-only / MI-only / both correct / both wrong
         🔴 MI 의 **strict 축과 threeWay 축 둘 다**에 대해 각각 낸다
조합     둘 다 SAME→SAME · 둘 다 DIFFERENT→DIFFERENT · 그 외 UNCERTAIN
         🔴 **평가용 가상 조합** 이다. 운영 코드에 넣지 않는다.
핵심질문 Q1 AI 가 MI 의 **False SAME 6건**(전부 S4 · PRESUMED_SAME · 색상 상이)을 잡는가
         Q2 AI 가 MI 가 놓친 SAME 을 찾는가
         Q3 AI 도 같은 **색상 failure mode** 를 갖는가 (🔴 §3 의 편향 단서와 같이 읽는다)
         Q4 불일치할 때 어느 쪽이 GT 에 가까운가 → Combination 필요성
```

🔴 **GT 는 WU-022-3 것을 그대로 쓴다.** AI·MI 결과에 맞춰 **수정하지 않는다**.

---

## 5. 🔴 이 수집으로도 **답이 안 나오는 것**

```
🔴 모델 우열 — 분모·난이도가 다르면 비교하지 않는다(지시서 §2)
🔴 전체 서비스 성능 — 원상품 6건 · 고유 후보 26건이다
🔴 Discovery 성능 — 이번 축은 **Identity 만** 본다
🔴 그리고 후보 자체가 **AI 가 품번으로 찾아온 것** 이라는 선택 편향이 그대로 남는다
```
