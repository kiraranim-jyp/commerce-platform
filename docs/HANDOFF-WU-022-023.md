# 인수인계 — WU-022 트랙 종료 · WU-023 HOLD (2026-10-15)

🔴 **새 세션은 이 세 페이지만 읽으면 된다.** 조사를 다시 하지 않는다.
🔴 충돌하면 리포 `CLAUDE.md` §12 가 이긴다. 이 문서는 **그 아래**에 붙는 최신 구간이다.

---
---

# 📄 PAGE 1 — 현 위치 (상태 · 품질 · 무엇이 닫혔나)

## 1-1. Git / 배포

```
branch        wu-010-display-provenance   behind 0 / ahead 0   (push 완료)
origin/main   behind 0 / **ahead 60**     HEAD = 9e0ef9e8 (2026-10-14, WU-007A)
worktree      clean
```

🔴🔴 **main 에 안 간 «운영 코드» 7파일** — 머지하면 60커밋이 **한 번에 Production 배포**된다:
```
apps/admin/src/app/api/snapshots/_lib/snapshot.ts
packages/crawler/src/comparison-search/{self-reference, ai-answer-pool, ai-answer-urls,
                                        discovery-url-identity, url-shape, index}.ts
```
🟡 그 7파일은 **WU-007A / 009-C 계열 독립 수정**이라 `origin/main` 분기 브랜치로
**cherry-pick 분리가 가능해 보인다**(🔴 **미검증** — 실행한 적 없다).
🔴 CPO 결정: 「임의 push 금지 · **먼저 배포 경계를 분리**하라」. 자율 범위는 「배포」가
아니라 **「배포 가능한 경계를 만드는 것」** 이다.

## 1-2. 품질 기준선 (이 숫자와 **비교**한다)

```
regression   **545 files / 7,857 passed** · failed 0 · skipped 75
typecheck    **0 errors**   (apps/admin 기준 · `npx tsc --noEmit`)
build        ⚪ 최근 미실행(코드 변경 0 구간이 길었다)
🔴 「재실행 PASS」와 「직전 PASS + 이번 코드 0」을 **구분해서** 적는다
```
🔴 회귀 돌리는 법: `cd apps/admin && npx vitest run` (crawler·pricing·shared 를 함께 끌어온다 ·
`packages/crawler` 단독 실행은 **러너가 없어 안 된다**).

## 1-3. 이번 세션에 닫은 WU (전부 commit·push 완료)

| WU | 결과 |
|---|---|
| 019F·G | Category/Sourcing 전수 — **UNKNOWN 0** · 등록/가격/UI 전부 판정 |
| 020 | Chrome Extension AI Search → 🔴 **STOP**(WU-002 가 1차자료로 닫은 경로) |
| 021 | Chrome Native AI / WebMCP / Gemini in Chrome / Local AI → 🔴 **전부 STOP** |
| 022 ~ 022-4 | AI Search → Identity **다리 구현** + 수집 패킷 |
| 022-5 / 5-1 | AI Search E2E 실측 · GT 전건 종결(미부여 0) |
| 022-6 ~ 022-11 | AI vs MI vs Combination 실측 → **D = GO 후보 · Q6 HOLD** |
| **023** | 병목 A 선정 + transient 경로 차단점 확정 → 🔴 **HOLD** |

## 1-4. 지금 열려 있는 것 — **하나뿐**

```
🔴 병목 A 미해결 — 「Registry 밖 국내 판매처를 운영 경로가 영구히 못 찾는다」
🟡 CPO 가 예고한 다음 WU — 「Registry 밖 후보를 transient pipeline 에 공급할
   **생산자 계약**을 최소 변경으로 만들 수 있는가」
   🔴 **AI 가 후보를 만든다는 전제를 «제거한» 문제** 다 (WU-022 재개가 아니다)
```

🔴🔴 **CPO 판정 (2026-10-15) — 이 문장을 그대로 쓴다**:
> **「이번 보고서는 실패 보고가 아니라 중요한 구조적 발견이다. transient consumer 는
> 이미 Registry 를 우회할 수 있지만, 그 consumer 에 후보를 공급하는 «생산자 계약» 이
> Gemini 에 종속되어 있다.」**

🔴 그래서 **지금 Registry 를 늘리거나 AI Search 를 다시 열지 않는다.**
🟢 그리고 **좁게 닫힌 책임은 CTO 가 아니라 작업지시 설계에 있었다**(CPO 자기정정) —
그 결과로 헌장 **§4-B**(WU 는 한 덩어리 · 전수검토 10축 · 완료조건 10)가 신설됐다.

---
---

# 📄 PAGE 2 — 확정된 결론 (🔴 재조사 금지)

## 2-1. AI Search 트랙 — **외부 경로는 전부 닫혔다**

```
🔴 Gemini API · OpenAI API · Search API(SerpAPI/Serper) · Perplexity · Exa · Brave
   → 전략상 STOP (WU-006R · 비용 «그리고» 저장 약관 둘 다)
🔴 소비자 AI Web UI 자동화 · Chrome Extension 으로 AI UI 조작
   → STOP. 🔴 **우회 기술을 쓰지 않아도 금지** 다(WU-002 1차자료):
      gemini robots.txt `Disallow: /app/ /chat/` · Google ToS automated means ·
      OpenAI ToU "Automatically or programmatically extract data or Output" ·
      CWS §4.4.1(3자 ToS 위반) + §7.2 원격 제거
   🔴 그리고 **제재가 셀러 계정에 떨어진다**(Google ToS 계정 삭제)
   🔴 CWS **2026-08-01 신설** 「circumvent … usage restrictions … of AI-powered services」
🔴 Chrome 내장 AI(Prompt API) → **능력 부재**. 공식 문서: "No data is sent to Google" ·
   "Subsequent use … does not require a network connection" → **웹검색이 구조적으로 불가**
🔴 WebMCP → **방향이 반대**. 사이트가 tool 을 «제공» 하고 agent 가 호출한다.
   IDL 메서드 3개(registerTool/getTools/executeTool)뿐 — 「agent 에게 검색 시키기」가 없다
🔴 Local AI → 로컬 LLM 은 검색하지 않는다. 검색 source 가 필요한데 0원+저장허용 동시 충족 0건
🔴 MCP Sampling(역방향) → `2026-07-28` **Deprecated** · "SHOULD NOT adopt"
🔴 Custom Search JSON API → **신규 차단 · 2027-01-01 종료**(1차자료 재확인)
```

🟢 **승격된 원칙 (그대로 유지)**:
> 「AI 가 만들어낸 URL 문자열을 그대로 믿지 않는다. URL 은 **Discovery signal** 이고,
> **Evidence 는 따져가 직접 검증한다.**」

## 2-2. AI vs MI 실측 — 숫자를 다시 만들지 않는다

**표본: n=51 · 원상품 6 · Anthropic 계열 judge 3(그중 2는 27건만)**

| | Accuracy | Precision | False SAME | missed |
|---|---:|---:|---:|---:|
| AI (cto-judge) | **0.902** | 0.828 | 5 | **0** |
| MI strict | 0.706 | 0.622 | 14 | 1 |
| **MI threeWay** | 0.725 | 🟢 **1.000** | 🟢 **0** | 14 |
| AI+MI 단순조합 | 0.882 | 0.821 | 5 | 1 |

```
🔴🔴 **AI 오류 ⊂ MI 오류** — AI 만 틀린 경우 **0건**, AI 가 단독으로 맞힌 것 10건,
   MI 단독 정답 **0건**. 둘 다 틀린 5건은 **전부 같은 방향(SAME 오판)**.
   → **보완적이지 «않다». ensemble 의 전제가 깨진다.**
🟢 AI 오류 5건은 **전부 reasoning 형**(evidence 부족형 0) — 정보가 부족한 구간에서는
   AI 가 UNCERTAIN 을 냈다. 약점은 **정보가 아니라 판단** 이다.
🔴 「PRESUMED_SAME → SAME 승격」은 n=17·28·60 **세 번 연속 반대**됐다
🟡 폐기된 가설 — 「브랜드+색상 일치 시 AI 가 숫자를 무시한다」(022-10 에서 **반증**)
   같은 축 2번째 사례(`00225`)에서 3자 모두 SAME 을 내지 않았다
```

### D 정책 (MI UNCERTAIN → AI DIFFERENT 일 때만 확정)
```
네 변형 전부 Precision 1.000 · False SAME 0 · **GT SAME 추가손실 0**
UNCERTAIN 27 → opus 14 · haiku 17 · cto 18 · 3자만장일치 19
🔴 Accuracy 는 **안 오른다**(0.725 고정) — 이득은 **보류 감소** 하나다
→ 🟡 **GO 후보** · 🔴 **Q6(production 구현 가치) = HOLD**
   이유: 벤더 독립성 0 · 분모 8~13 · ensemble 전제 붕괴 · **배달 경로가 없다**
```

## 2-3. AI Search Discovery — 🟢 **가치는 증명됐다**

```
`cto-websearch`(URL-only 입력) 후보 **65** · known-positive **3/5** · 후보 0 상품 **없음**
🟢🟢 **신규 true-SAME 21건** (GT SAME 고유 24 = known-positive 3 + 신규 21)
🟢 Registry 밖 GT SAME 도메인 **12곳**
🔴 그러나 **배선 경로는 STOP**(WU-021). **가치 GO 와 배선 GO 를 섞지 않는다.**
🟢 Shopify Suggest 와는 **경쟁이 아니라 보완** — Suggest 는 샵 «안» 에서 148,
   AI Search 는 Registry «밖» 으로 나간다
```

## 2-4. 🔴 데이터 자산 (`%TEMP%\mi-p0-02\`)

```
mi-019a-search-results.json   24행(사람수집 18 + cto-websearch 6) · rawAnswer 원문
raw-{claude,gemini,gpt}.txt · raw5-cto-S1~S6.txt   🔴 원문 보존본
mi-022-gt.json                GT 라벨 51(SAME/DIFFERENT) · mi-022-5-1-gt-all.json 64(4상태)
mi-022-result.json            후보 101 · MI + GT 조인
mi-022-ai-verdicts.json       AI verdict 51(cto-judge)
mi-022-8-items.json           MI UNCERTAIN 27 + opus/haiku 판정
mi-017-e2e-cases.json         원상품 덤프 10행 (🔴 S4 source_url 에 `?_pos&_sid&_ss` 가 붙어 있다)
```
🔴 이 디렉터리는 **TEMP** 다. 지워지면 WU-022 측정을 재현할 수 없다.

---
---

# 📄 PAGE 3 — 다음 착수점 (조사 없이 시작)

## 3-1. 병목 A — 재선정하지 않는다

```
문제   GT 로 확정된 «국내» 판매처 5곳이 **등록부 밖** 이라 `searchDomesticShops` 가
       구조적으로 못 찾는다
       biskuit.kr · m.luxboy.com · m.web.mustit.co.kr · beaumonde.co.kr · donokids.com
근거   핵심 KPI **55/498 = 11.0%** · 병목은 계산 사슬이 아니라 **입구**(NO_LINK 331)
우선순위 다른 후보(무관상품 노출 · `.co.jp` KR 부재 · 스코프 비대칭)는 **UX/설명 축** 이고
       A 만 **「가격비교 자체가 성립하지 않는」 축** 이다
```

## 3-2. 🔴 차단점 — 코드 위치까지 확정됨

```
🟢 **소비자(consumer)는 완비** · Registry 를 요구하지 않는다
   gemini-candidate-pool.ts:47        GEMINI_VIRTUAL_SHOP_ID = "__gemini_discovery__"
   run-domestic-price-check.ts:938    기존 후보 루프 합류
                            :1009    judgeDomesticCandidate — **Gemini 전용 규칙 0**
                            :1067    저장 차단(transient 유지)

🔴🔴 **생산자(producer)가 Gemini 하드결합**  ← 여기가 차단점
   gemini-candidate-pool.ts:212  collectGeminiCandidatePool(input: GeminiPoolInput)
     입력 = {dna, scopedDomains, categoryScopes, maxCandidates, targetUsable,
             maxQueries, existingNormalizedUrls}
     🔴 **후보 URL 목록을 받는 파라미터가 없다.** dna 를 받아 함수가 스스로
        buildPrimaryQuery → Gemini 호출까지 한다(:231~:255)
   run-domestic-price-check.ts:890  호출부 **하나뿐** · `isGeminiDiscoveryEnabled()` 안

현 운영 생산자 둘 다 병목 A 를 못 푼다:
   ① searchDomesticShops — 등록부 «안» 만 뒤진다 (= 병목 A 그 자체)
   ② collectGeminiCandidatePool — Gemini 전용 · flag OFF · 경로 닫힘
```

## 3-3. 다음 WU 가 답할 질문

> **「Registry 밖 후보를 transient pipeline 에 공급할 «생산자 계약» 을
> 최소 변경으로 만들 수 있는가」**

🔴 **AI 가 후보를 만든다는 전제를 제거한 문제다.** WU-022 재개가 아니다.
🔴 **「producer 가 없다 → 불가」로 끝내지 않는다** — 반드시 **최소 계약 변경안을 설계**하고,
막는 것이 **계약인지 정책인지 외부 capability 인지** 를 **코드 위치와 함께** 특정한다.
🔴 끝에 반드시 **GO / HOLD / STOP** 하나를 적는다.

### 전수검토 10축 (CPO 의무화 · 2026-10-15)
```
기존 코드 재사용 · 기존 계약 확장 · 다른 기존 producer · transient 경로 · Registry ·
외부 Search · AI · 데이터/UX 우회 · 현재 금지된 방법 · 새 비용/ToS/보안
각각 — 가능 / 불가능 / 금지 / 비용 / 위험 / 난이도 / 예상효과
```
🔴 ⑨「현재 금지된 방법」을 **빼지 않는다** — 「금지라서 안 적었다」가 아니라 **「금지」로
적는다.** 그래야 CPO 가 정책을 바꿀 때 그 자리가 보인다.

### 🔴 완료 조건 10 (CPO 확정 2026-10-15 · 헌장 §4-B 와 동일)

```
① 모든 producer 조사          ② consumer 전체 downstream 추적
③ 기존/신규 producer 전수 검토  ④ AI·Registry 확대 «없이» 가능한 경로를 먼저
⑤ 계약 변경 필요시 **최소 변경안** 설계 + 구현 가능성 검증
⑥ 구현 가능하면 **실제 GT SAME 국내 판매처로 E2E**
⑦ 불가능하면 **무엇이 막는지** 를 코드 위치와 함께 확정
⑧ 🔴 **GO / HOLD / STOP** 최종 판정 (단순 「조사 종료」 금지)
⑨ 코드 변경시 regression · typecheck · build
⑩ 배포 가능하면 **실제 제품 검증 지점** 까지
```

🔴🔴 **WU 전체 형상은 헌장 §4-B 가 owner 다** — `조사 → 원인 확정 → 전수검토 →
최적안 → 구현 → E2E → 회귀 → 배포 → **보고 1회**`. 중간 보고는 하지 않는다.
🔴 단 **용량 판단은 «착수 전» 에** 한다 — 못 끝낼 크기면 쪼개지 말고 넘긴다.

## 3-4. 🔴 금지 (그대로 유효)

```
AI Search      Gemini/OpenAI/Search API · consumer AI 자동화 · WU-022 재개 · DDG 재시도
Identity       threshold · SKU rule · 색상사전 · PRESUMED_SAME 정책 · MI 임의 변경
범위           Registry 대규모 확장 · Category/Sourcing 개편 · 새 채널 · 새 카테고리 adapter
기타           benchmark 통과용 하드코딩 · 특정 테스트 데이터 전용 예외처리 · 새 abstraction 남발
배포           밀린 커밋을 임의 push 금지 — **먼저 경계를 분리**한다
```

## 3-5. 🔴 이 트랙이 반복해서 밟은 함정 (같은 실수 금지)

```
① **칸 이름을 추측한다** — 이 트랙에서 **열 번 넘게** 틀렸다.
   owner 타입/마이그레이션 SQL/`information_schema` 에서 **읽는다**
   (예: `selectedSource` 는 리포에 **0건** · 실제는 `selected_sourcing_candidate_id`)
② **문자열 완전일치로 URL 을 조회한다** — WU-022-2 에서 S4 가 통째로 빠졌다
   (덤프 source_url 에 `?_pos=1&_sid=…&_ss=r`). **`canonicalizeProductUrl` 을 쓴다**
③ **분모를 섞는다** — 「측정불가」를 0 으로 적지 않는다 · UNVERIFIED/UNREACHABLE 를
   DIFFERENT 로 강제하지 않는다 · 표본과 전수를 같은 표에 넣지 않는다
④ **가드를 대입문으로만 단언한다** — `if (false)` 로 죽여도 통과한다. **술어까지** 잠근다
⑤ **사본을 만든다** — 「사본 금지」. 공용 부품은 `__fixtures__/` 로 빼고 양쪽이 import 한다
⑥ **용량 판단을 늦게 한다** — 착수 **전** 에 끝까지 갈 수 있는지 센다
```

## 3-6. 세션 시작 체크 (3줄)

```bash
git fetch origin --quiet && git status && git rev-list --left-right --count origin/main...HEAD
cd apps/admin && npx tsc --noEmit 2>&1 | grep -c "error TS"      # 기준 0
ls "$TEMP/mi-p0-02/mi-022-result.json"                            # 데이터 자산 생존 확인
```

## 3-7. 다음 WU 초안 — 🔴🔴 **CPO 확정 전 · 착수 금지**

🔴 **이것은 작업지시서가 아니라 CTO 가 «받을 준비» 로 적어 둔 초안이다.** CPO 가
확정·수정해서 주는 것이 지시서다. 🔴 **이 절을 근거로 코드를 만지지 않는다.**
🟢 §4-B 13항 형식으로 비워 뒀으니 CPO 는 **빈칸만 메우면** 된다.

### ① 목표 (CPO 문장 그대로)
> **「Registry 밖 후보를 transient pipeline 에 공급할 수 있는 «생산자 계약/경로» 를
> 어떻게 «최소 변경» 으로 만들 수 있는가」**

🔴 **AI 가 후보를 만든다는 전제를 제거한 문제다.** WU-022(AI Search) 재개가 아니다.

### ② 문제 / KPI (§4-B A — 이미 확정돼 있다)
```
사용자 영향  GT 국내 판매처 5곳(biskuit.kr · m.luxboy.com · m.web.mustit.co.kr ·
             beaumonde.co.kr · donokids.com)이 **등록부 밖** 이라 영구히 안 보인다
빈도        핵심 KPI **55/498 = 11.0%** · NO_LINK **331** (병목은 사슬이 아니라 «입구»)
GT 근거     AI Search 가 찾은 신규 true-SAME **21** · Registry 밖 **12곳** (§2-3)
진입점      run-domestic-price-check.ts:890 (유일한 Gemini 호출부)
운영 경로   searchDomesticShops(등록부 «안» 만) + collectGeminiCandidatePool(Gemini 전용)
```

### ③ 조사 범위 / ④ 코드 경로
🟢 **§3-2 가 이미 코드 위치까지 확정했다 — 조사를 처음부터 반복하지 않는다.**
🔴 새로 열 것은 **생산자 쪽**이다: 「후보 URL 을 넣을 진입점을 어디에 만들 수 있는가」.
🔴 §4-B B 에 따라 **입력 → 생산자 → 후보생성 → 정규화 → 검증 → MI → 가격 → 저장 →
UI → 등록** 을 끝까지 본다(소비자만 보면 WU-023 과 같은 실수를 반복한다).

### ⑤ 금지사항
🟢 §3-4 그대로 + 🔴 **Registry 확대 금지 · AI Search 재개 금지**(CPO 2026-10-15).

### ⑥ 해결안 전수검토 10축 — 🔴 **지금 채우지 않는다**
🔴 아래는 «조사 대상 목록» 이고 **판정이 아니다.** 미리 가능/불가를 적어 두면 다음
세션이 그것을 기정사실로 읽는다(이 트랙이 반복한 함정 ③).
```
① 기존 코드 재사용   ② 기존 계약 확장(GeminiPoolInput 에 후보 URL 주입 파라미터?)
③ 다른 기존 producer ④ transient 경로   ⑤ Registry   ⑥ 외부 Search   ⑦ AI
⑧ 데이터/UX 우회(셀러가 URL 직접 입력? — 🔴 WU-008 의 P0-1 과 같은 자리)
⑨ 현재 금지된 방법(«금지» 로 적는다 · 빼지 않는다)   ⑩ 새 비용/ToS/보안
각 축 — 가능 / 불가능 / 금지 / 비용 / 위험 / 난이도 / 예상효과
```

### ⑦ 구현 조건 / ⑧ E2E 조건
```
구현  최소 계약 변경안 → 단위 테스트 → 음성대조(§5) → 실제 데이터
E2E   🔴 **실제 GT SAME 국내 판매처**(위 5곳)로 돌린다 — fixture 통과는 E2E 가 아니다
      경로 전체: 후보 공급 → judgeDomesticCandidate → MI → 가격 → 화면
```

### ⑨ regression / ⑩ 배포 조건
```
regression  admin 전수 (기준 545 files / 7,857 passed) · 🔴 crawler 단독 실행 불가
typecheck   기준 **0** 과 «비교»     build  exit 0
배포        🔴 origin/main ahead **62** — 머지하면 그 전부가 한 번에 배포된다
            → 임의 push 금지 · **먼저 배포 경계를 분리**한다(CPO 확정)
```

### ⑪ CEO Action 조건
🔴 **실제 상품 화면/URL 테스트가 필요한 순간에만.** 그때도 CTO→CEO 직행 금지(§3).

### ⑫ 최종 보고
🔴 헌장 §7 18절 + **GO / HOLD / STOP 하나** + 완료 조건 10 자가점검(§3-3).
🔴 **중간 보고 없음** — 끝까지 가서 1회.

---

**CEO Action: NONE.** 🔴 실제 상품 화면/URL 테스트가 필요한 순간에만 CPO 가 전달한다.
