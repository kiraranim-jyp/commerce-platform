# WU-019A — AI vs MI 동일상품 판정 Benchmark

🔴 AI 호출 **0** · Gemini 0 · 외부 AI/검색 API 0 · 키 0 · 결제 **₩0** · DB 쓰기 0 ·
schema 0 · UI 0 · threshold 0 · 색상 사전 0 · `PRESUMED_SAME` 정책 0 · 앙상블 코드 0 ·
Registry 0 · 배포 0 · **엔진 변경 0**. 🟡 판매처 GET **12회**.

---

## 0. 🔴🔴 먼저 — **AI 축은 측정불가다**(0% 가 아니다)

지시서 §11 이 「CTO 가 자동 브라우저/API 를 만들지 않는다」 고 명시하고 외부 AI API 는
전면 금지다. 그래서 **AI 판정 데이터를 CTO 가 만들 수 없다.**

```
🟢 한 것    MI 축 **실측** · GT 독립 수립 + **독립 검증 장치** · AI 입력 규격/정규화기 ·
            KPI·4분면·충돌분석 **코드** (AI 파일이 들어오면 자동 산출)
🔴 못 한 것  AI Accuracy · AI False SAME · AI↔MI Agreement · 4분면 · 충돌 승자
            → 전부 **측정불가**. 🔴 AI 를 「틀렸다」·「0%」로 적지 않는다.
🔴 AI verdict 를 **지어내지 않았다.** fixture 로 넣어 수치를 만들지도 않았다.
```

## 1·2. 테스트셋 — 쌍 **14** / 6유형 (전부 운영 DB 실데이터)

```
EXACT_SAME 6 · SAME_OTHER_MARKET 1 · SAME_BRAND_DIFF_MODEL 2 ·
SAME_MODEL_DIFF_COLOR 2 · SIMILAR 2 · DIFFERENT 1
```
원상품 5개 · 후보 URL 11개. 🔴 `match_truth` 를 GT 로 쓰지 않았다.

## 3. 🟢 GT 독립 — 그리고 **검증 장치를 추가**했다(WU-018 에 없던 것)

GT 는 품번 + 상품명 + 색상으로 세우고, **실제로 가져온 후보 제목과 대조**한다
(`gtToken.mustInclude` / `mustExclude`). 🔴 GT 가 페이지와 어긋나면 **측정 전에 깨진다.**
🟢 이번 실행에서 **14건 전건 통과** — GT 가 실제 페이지와 일치함이 확인됐다.

## 4·5. MI 결과 (실측 · 기존 운영 판정 그대로)

| case | 유형 | GT | MI(raw / strict / conf) | |
|---|---|---|---|---|
| B01 | EXACT_SAME | SAME | `SAME` / SAME / 0.97 | 🟢 |
| B02 | SIMILAR | DIFFERENT | `CONFLICT` / DIFFERENT / 0.45 | 🟢 |
| B03 | SAME_BRAND_DIFF_MODEL | DIFFERENT | `CONFLICT` / DIFFERENT / 0.3 | 🟢 |
| B04 | DIFFERENT | DIFFERENT | `CONFLICT` / DIFFERENT / 0 | 🟢 |
| B05 | EXACT_SAME | SAME | `SAME` / SAME / 1.0 | 🟢 |
| B06 | SIMILAR(역방향) | DIFFERENT | `CONFLICT` / DIFFERENT / 0.48 | 🟢 |
| B07 | EXACT_SAME | SAME | **제외** `UNREACHABLE`(실측 404) | ⚪ |
| B08 | SAME_BRAND_DIFF_MODEL | DIFFERENT | `CONFLICT` / DIFFERENT / 0.3 | 🟢 |
| B09 | EXACT_SAME(국내 littleluna) | SAME | `SAME` / SAME / 0.66 | 🟢 |
| **B10** | **SAME_MODEL_DIFF_COLOR** | DIFFERENT | 🔴 `PRESUMED_SAME` / SAME / 0.62 | 🔴 |
| B11 | EXACT_SAME(국내 foretforet) | SAME | `SIMILAR` / DIFFERENT / 0.55 | 🔴 |
| B12 | EXACT_SAME(국내 deuxbebe) | SAME | `SIMILAR` / DIFFERENT / 0.58 | 🔴 |
| B13 | SAME_MODEL_DIFF_COLOR | DIFFERENT | `CONFLICT` / DIFFERENT / 0.78 | 🟢 |
| B14 | SAME_OTHER_MARKET | SAME | `PRESUMED_SAME` / SAME / 1.0 | 🟢 |

🔴 **MI 정규화를 두 축으로 갈라 적는다**(하나만 쓰면 결과가 숨는다):
`strict` = `PRESUMED_SAME`→SAME(False SAME 엄격 · WU-018 기준) · `threeWay` =
`PRESUMED_SAME`→UNCERTAIN(AI 와 3값 비교용). **정책 변경이 아니라 집계 라벨이다.**

## 6·7·8·9. KPI

```
MI Accuracy    10/13   (sample N=13 · facts OK 분모)
MI False SAME  **1**   (B10 · strict 기준)   🟢 threeWay 기준이면 UNCERTAIN
MI Recall      4/6     (sample N=6)
AI Accuracy    🔴 측정불가      AI False SAME  🔴 측정불가
AI↔MI 일치      🔴 측정불가      4분면 · 충돌 승자  🔴 측정불가
제외 1건       B07 `UNREACHABLE` → **WU-017 축**(MI 오판으로 세지 않는다)
```
🔴 N=13 / N=6 을 시스템 전체 정확도로 **일반화하지 않는다.**

### 🟢 B10(=P10) regression — 유지됐다
`PRESUMED_SAME` 그대로이고 WU-018-P10 에서 확인한 `→ COMPARISON · EXACT 승격 차단`도
그대로다. 🔴 **AI 가 B10 을 어떻게 판단하는지는 미수집** — AI 축이 열리면 **가장 먼저** 볼 칸이다.

### 🔴 MI 오판 3건의 성질이 다르다 (WU-018 과 같은 분류)
```
B10  거짓 동일상품 — 원인 **색상 추출**(extractColorFromTitle 이 "Rose"를 모른다)
B11·B12  Recall 손실 — **증거 부족**(국내 샵 제목의 품번이 자체 품번) · 🟢 설계대로
```
🔴 수정하지 않았다(지시서 §10 · WU-018 CPO 판정 유지).

## 10. AI 판정 수집 규격 — 🔴 **사람이 한 번에 채울 수 있는 형태**

### 고정 프롬프트 (케이스마다 같은 문장 · 변형 금지)
```
아래 두 상품 페이지가 "같은 상품"인지 판단해 주세요.

원상품: <sourceUrl>
후보:   <candidateUrl>

규칙:
- 색상이 다르면 같은 상품이 아닙니다.
- 사이즈/시장(국가)만 다른 것은 같은 상품입니다.
- 확실하지 않으면 UNCERTAIN 을 쓰세요.

답변 형식(첫 줄은 반드시 한 단어):
SAME | DIFFERENT | UNCERTAIN
그 다음 줄에 근거를 2문장 이내로.
```

### 입력 파일 — `%TEMP%\mi-p0-02\mi-019a-ai-verdicts.json`
```json
[{ "caseId": "B01", "verdict": "SAME", "reason": "품번 b226ac010 동일", "raw": "<AI 답변 원문>" }]
```
🔴 하니스가 읽는 칸은 `verdict`(세 단어만 통과) 와 보존용 `reason`/`raw` 뿐이다.
**confidence · 가격 · 판매처 · 「동일상품입니다」 문장은 읽지 않는다**(정규화기가
`"SAME (0.95)"`·산문을 **null** 로 떨어뜨리는 것을 테스트가 잠갔다).
🟢 파일을 놓고 `MI_019A_LIVE=1` 로 재실행하면 **AI Accuracy·False SAME·Agreement·
4분면·충돌 승자가 자동 산출**된다(코드 완비 · 추가 개발 0).

🔴 **독립성 구조로 보장했다** — MI 측정이 AI 파일을 읽기 **전** 에 끝난다. AI 결과가
MI 입력에 들어갈 경로가 코드에 **없다**.

## 11~15. 결론

```
🟢 MI 축: 실측 완료 — Accuracy 10/13 · False SAME 1 · Recall 4/6 (N 명시)
🔴 AI 축: 측정불가 → **「AI / MI / 조합 중 현재 우위」를 지금 판정할 수 없다.**
🔴 그것을 「MI 우위」로도 「AI 열위」로도 적지 않는다(분모가 없다).
🟢 남은 것은 **AI 판정 14건** 하나다 — 그것이 들어오면 §13 의 23항 중 AI 관련 7항이
   재실행 한 번으로 채워진다.
```

## 17~23

```
코드 변경    **0**(엔진·정책·threshold·사전 전부 불변) · 신규는 하니스 1파일 + 이 문서
regression   admin 533 files / 7,791 passed · failed 0 (skipped 50/71)
typecheck    admin 0 · crawler 2 = 변경 전과 동일
build        exit 0
commit       아래 1건 · main **미반영**(ahead 19) · 배포 0
CEO Action   **NONE**
```
