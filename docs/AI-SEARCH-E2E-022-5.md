# WU-022-5 — AI Search E2E 실측 (🟡 Discovery 완료 / GT 부분)

🔴 운영 코드 **0** · MI 0 · threshold 0 · 색상사전 0 · Registry 0 · extractor 0 ·
Category/Sourcing 0 · schema 0 · 배포 0 · 비용 **₩0**.
🟡 실제 HTTP — AI Search 단계(검색/페이지 열람) + 후보 검증 **103회**(read-only GET).

---

## 1. 실행 조건 — 🔴🔴 **이것이 무엇이고 무엇이 아닌지 먼저 적는다**

```
실행 주체   **CTO(Claude) 자신의 web search 도구**. 모델 라벨 `cto-websearch`
입력        🟢 **원상품 URL 하나만**(§2). GT·정답후보·MI 결과·confidence 기준 **미제공**
프롬프트    §2 의 권장 prompt 를 글자 그대로 사용(6건 동일)
실행 수     **6** (S1~S6 각 1회)
🟢 §16 금지 전수 대조 — Gemini API 0 · OpenAI API 0 · Search API(SerpAPI/Serper) 0 ·
   Playwright 0 · 소비자 AI Web UI 자동화 0 · CAPTCHA/robots/UA 우회 0 ·
   제품에 새 검색엔진 도입 0 · Registry/extractor 추가 0 · 결제 0
```

🔴🔴 **그러나 이것이 아닌 것 셋을 같이 적는다**:
```
⒜ **제품이 호출할 수 있는 경로가 아니다.** WU-021 이 그 축을 이미 STOP 했다.
   측정한 것은 「AI Search 라는 **능력의 가치**」이고 「제품 배선 가능성」이 아니다.
⒝ 직전 18건(claude/gemini/gpt · 사람 수집)과 **같은 표에 섞지 않는다** —
   그쪽은 **품번 입력**, 이쪽은 **URL 입력** 이다. 조건이 다르다.
⒞ 모델 우열이 아니다 — `cto-websearch` 는 **도구 접근권이 다른** 실행이다.
```

🟢 원문 6건 전부 보존: `raw5-cto-S1.txt` ~ `S6.txt` (요약 0 · 재구성 0 · §4).

---

## 2. Discovery — 🟢🟢 **URL-only 입력에서 가장 좋은 결과가 나왔다**

| 모델 | 입력 | 후보(추출 후) | known-positive | 미검증 신규 | 후보 0 |
|---|---|---:|---|---:|---|
| **cto-websearch** | 🟢 **원상품 URL** | **65** | 🟢 **3/5** | 62 | **없음** |
| claude (사람수집) | 품번 | 17 | 2/5 | 15 | S5 |
| gemini (사람수집) | 품번 | 9 | 0/5 | 9 | S5·S6 |
| gpt (사람수집) | 품번 | 10 | 0/5 | 10 | S1·S2·S5 |

🔴 **「Recall」로 적지 않는다.** known-positive 집합은 019A 가 확정한 **하한**이고
전체 정답집합이 아니다. 분모 5 는 정답 URL 이 지금도 열리는 원상품 수다(S3 제외).

🟢 **S5(Vernice Nero)에서 갈렸다** — 사람수집 3모델 중 둘이 후보 0 이었는데,
URL 입력에서는 **4건**을 냈다. 🔴 이유는 자명하다: 그쪽은 「Vernice Nero」라는 **색상명만**
받았고 이쪽은 **상품 URL** 을 받았다. 즉 **입력 품질 차이이지 모델 차이가 아니다.**

### 🟢 Registry 밖 신규 판매처가 실제로 나왔다 (§11)

`cto-websearch` 가 낸 후보에는 우리 등록부에 **없던** 도메인이 다수다 —
`rboutique.com` · `eraldo.com` · `cissywears.com` · `peachboy.ca` · `kolkid.ca` ·
`blanchou.ca` · `stadtlandkind.ch` · `thefrontshop.com` · `tinybebe.com.au` ·
`kihanan.com` · `lilysourire.com` · `grau.shop` · `biskuit.kr` · `donokids.com` …
🔴 **그 각각이 GT SAME 인지는 §4 에서 일부만 확정됐다**(아래).

---

## 3. 후보 검증 → MI (기존 owner 그대로)

```
후보 행 **101** · HTTP **103회** · 원상품 덤프 누락 **0**
GT 조인 **35** · 🟢 거부 0 · 🟢 **gtToken 불일치 0**
🟡 **GT 미부여 66건** → `mi-022-gt-worklist.json` (🔴 **분모에서 빠졌다** · 0 이 아니다)
```

| 축 | n | Accuracy | Precision | False SAME | missed |
|---|---:|---:|---:|---:|---:|
| MI strict | 35 | 0.829 | 0.806 | 🔴 **6** | 0 |
| MI threeWay | 35 | 0.743 | 🟢 **1.000** | 🟢 **0** | 9 |

🟢 **WU-022-3 의 결론이 더 큰 표본에서 유지된다** — strict 의 False SAME 6 은
**전부 S4 색상 상이 + PRESUMED_SAME** 이고, threeWay 축은 **여전히 False SAME 0** 이다.
🔴 「PRESUMED_SAME → SAME 승격」은 이 표본에서도 **반대된다**.

---

## 4. 🔴 미완 — GT 66건이 남았다 (정직하게 적는다)

```
🔴 `cto-websearch` 가 낸 신규 후보 대부분에 **아직 독립 GT 를 붙이지 못했다.**
   원인은 외부 요인이 아니라 **CTO 세션의 컨텍스트 한계** 다.
🔴 그래서 §11 의 핵심 KPI(「AI 신규 후보 중 GT SAME 이 몇 건인가」)를 **확정하지 않았다.**
   🔴 0 으로도 추정치로도 적지 않는다 — **측정 미완** 이다.
🟢 남은 일은 기계적이다 — 작업표에 `observedTitle`·`factsStatus`·`miRaw` 가 이미 채워져
   있고, GT 규칙(품번·색상·상품명 대조 + gtToken)을 그대로 적용하면 된다. 추가 HTTP 0.
```

## 5. 실패 분류 (§18 · 섞지 않는다)

```
SEARCH_FAILURE      0/6   (6건 전부 검색이 정상 동작)
CANDIDATE_FAILURE   0/6   (6건 전부 후보를 냈다 — 사람수집 축의 S5·S6 0건과 대비)
CANDIDATES_FOUND    6/6
CRAWL_FAILURE       🟡 UNREACHABLE 포함 — 전수는 작업표에 남아 있다(미집계)
IDENTITY_UNCERTAIN  🟡 PRESUMED_SAME/SIMILAR 구간 — GT 미부여 66건과 겹쳐 **미확정**
🔴 outcome 라벨은 전 모델 **UNLABELED** 다 — 이번 프롬프트(§2)에 접두사 규격이 없다.
   그래서 「검색실패 ↔ 후보없음」을 **라벨로는** 가를 수 없고, 위 분류는 후보 수로 센 것이다.
```

## 6. 결론

```
AI Search Discovery   🟢 **GO 신호** — URL-only 입력에서 known-positive 3/5 ·
                      후보 65 · 후보 0 상품 **없음** · Registry 밖 판매처 다수
                      🔴 단 **제품 배선 경로는 여전히 STOP**(WU-021). 가치와 배선을 섞지 않는다.
MI                    🟢 strict False SAME 6(전부 S4 색상) · threeWay **False SAME 0** 유지
§11 핵심 KPI          🔴 **미완** — GT 66건 미부여
Shopify Suggest 비교  🔴 **미실행** — GT 가 닫히기 전에는 비교가 성립하지 않는다
```

🔴 **다음 한 걸음은 작고 기계적이다** — 새 세션에서 작업표 66건에 GT 를 붙이면
§11(신규 SAME) · §14(Suggest 비교) · §13(모델 표)이 **추가 수집·추가 HTTP 0 으로** 닫힌다.
