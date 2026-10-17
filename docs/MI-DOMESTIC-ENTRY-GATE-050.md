# WU-050 — 국내 동일상품 후보가 가격비교에 못 들어가는 «구조적» 지점

> 🔴🔴 **판정 = HOLD.** 🔴 그리고 **HOLD 의 이유가 예상과 다르다** — 「생산자가 없다」가
> 아니라 **「생산자를 만들어도 뒤의 게이트 둘이 더 막는다」** 다.
> 🔴 P0-1~P0-4 **수치는 미측정** — 6개 URL **문자열이 전달되지 않았다**(§15).
> 🔴 운영 코드 변경 **0** · Registry **0** · AI **0** · Gemini **0**.

---

## 1. 결론 먼저 — 차단층이 **셋** 이고 전부 코드 위치가 확정됐다

```
① 생산자 부재      Registry 밖 URL 을 «자동으로» 만드는 producer 가 없다
                   🟢 이미 확정(WU-023/024) · 🔴 AI 금지라 정책상 만들 수 없다
② 🔴🔴 시장 게이트  수동으로 넣어도 — **`.kr` TLD 가 아니면 market = UNKNOWN**
                   → 국내 축 진입 **불가**            ← 🔴 **이 WU 의 새 발견**
③ 🔴 가격 검증      한국 샵 가격이 `UNVERIFIED_SEARCH` 면 `priceKrw` 가 **null**
                   → 국내 축 진입 **불가**            ← 🔴 실측으로 확인
```

🔴🔴 **그래서 전략적 결론이 바뀐다** — ①만 보고 「producer 를 만들면 풀린다」로 읽으면
틀린다. **②③이 그 뒤에서 또 막는다.** ①을 해결해도 국내 가격비교는 생기지 않는다.

---

## 2. ② 시장 게이트 — 전개 (🔴 코드 두 줄의 «교차» 다)

```
market-intelligence.ts:216   if (e.market !== "KR") { … continue }   ← 국내 축 자격
candidate-market.ts:85-90    KRW 일 때 KR 이 되는 조건은 **둘뿐**
                               ⒜ hasKrTld(domain)        `.kr` / `.co.kr`
                               ⒝ isRegisteredDomesticShop  등록부 소속
────────────────────────────────────────────────────────────────────────
transient 후보는 **정의상 Registry 밖** ⟹ ⒝ 가 언제나 false
⟹ 🔴 **`.kr` 이 아닌 한국 쇼핑몰은 SAME + VERIFIED KRW 를 다 통과해도 진입 불가**
```

🔴 **버그가 아니다 — 정책의 귀결이다.** CPO 가 WU-020 §4 에서 「**통화 단독으로 시장을
결정하지 않는다**」를 명시했고(근거: `bobochoses.com` 이 등록부 샵인데 EUR), 그 안전
규칙이 이 결과를 만든다. 🔴 그래서 **완화하지 않았다** — CPO 판정 사안이다.

🟢 **우연이 아니라는 증거**: 기존 테스트 `mi-020-candidate-price-evidence.test.ts:107`
가 예시 도메인으로 쓴 것이 **`tinyapple.net`** 이다 — 한국 쇼핑몰이고 `.net` 이다.
우리 등록부도 `looxloo.com` · `rulii.com` · `chocoel.com` 처럼 **대부분 non-`.kr`** 이다.
그 샵들은 **등록부에 있어서** KR 로 분류돼 왔다.

🟢 이 WU 에서 그 조합을 실행해 **9건 전부 고정** 했다
(`wu-050-domestic-entry-gate.test.ts` · 외부 호출 0 · DB 0).

---

## 3. 🔴🔴 그 귀결 하나 — **「해외 참고가격」에 KRW 가 뜬다** (내 WU-049 작업의 결함)

```
market !== "KR" && 가격 있음  →  overseasEvidence  (market-intelligence.ts:216-228)
🔴 UNKNOWN 도 여기 포함된다 ⟹ 한국 샵의 **KRW 가격** 이
   WU-049 「🌐 **해외** 참고가격」 구역에 **`KRW 88,000`** 으로 표시된다
```

🟢 실행으로 확인했다 — `buildOverseasReference` 가 `"KRW 88,000"` 을 낸다.
🟢 유일한 완충은 「N곳은 판매 시장을 확인하지 못했습니다」 한 줄이고 **제목은 그대로
「해외」** 다 → **제목이 거짓이 된다.**

🔴 **고치지 않았다** — CPO 가 WU-050 §1 에서 「기존 WU-049 해외 참고가격 기능 변경」을
금지했다. 🟢 대신 **현재 동작을 단언으로 고정** 했다 → 고치면 그 테스트가 FAIL 로
뒤집히고 그것이 수정의 증거가 된다(쿠팡 고시 선례와 같은 방식).

---

## 4. §5-B CONTROL — 🟢 **PASS** (본 측정 전에 먼저 돌렸다)

운영 경로(`collectUrlCandidatePool → withConfidence → enrichCandidatePrices`)로
WU-038 의 측정값이 **전건 재현** 됐다. 실제 HTTP · 읽기만.

```
B226AC009  입력 4 · 추출 4 · MI SAME 3 · PRESUMED 1 · 가격 VERIFIED 2
  bobochoses.com  SAME          EUR 40  VERIFIED_CURRENT     human SAME
  tinyapple.net   SAME          USD 58  VERIFIED_CURRENT     human SAME
  trenbe.com      SAME          가격 없음 UNVERIFIED_SEARCH   human DIFFERENT  🔴 False SAME
  luxboy.com      PRESUMED_SAME KRW 59,000 UNVERIFIED_SEARCH human DIFFERENT
B226AC043  입력 1 · SAME 1 · bobochoses.com EUR 75 VERIFIED_CURRENT
🔴 ⑧ 가격비교 진입(DB 링크) = **0 / 0** (양 케이스)
```

🔴🔴 **이 실측이 ②③을 살아 있는 데이터로 보여준다**:
```
bobochoses.com  EUR  → 해외 공식몰. 🟢 OVERSEAS 가 맞다
tinyapple.net   USD  → 🔴 **한국 샵인데 달러로 표기** → KR 증거와 불일치 → 국내 축 밖
trenbe.com      가격 없음 · UNVERIFIED_SEARCH         → ③에서 막힌다
luxboy.com      🔴 **KRW 있는데** UNVERIFIED_SEARCH + non-`.kr` → ②③ **이중 차단**
⟹ 국내 KRW 축에 들어간 후보 **0** — 그리고 그 이유가 전부 다르다
```

---

## 5. 🔴 P0-1 ~ P0-4 — **미측정 (입력 미전달)**

```
P0-1 공급률      분모 6 (CPO 확정) → 🔴 **6개 URL «문자열» 이 내 쪽에 오지 않았다**
P0-2 MI 통과율   P0-1 의존 → 미측정
P0-3 가격 도달률 P0-1 의존 → 미측정
P0-4 UI 노출률   P0-1 의존 → 미측정
```

🔴 전달받은 것은 **개수(A 1 · B 2 · C 3 = 6)** 와 **가격 요약 4개**(88,000 · 162,000 ·
124,710 · 163,990) 뿐이고 **URL 문자열이 없다.**
🔴🔴 **URL 을 추정해서 만들지 않았다** — 그러면 그 측정 전체가 무효다(§5-B · 그리고
이 트랙에서 「칸 이름을 추측해 거짓 P0 를 보고한」 전례가 아홉 번 있다).

🟢 **측정 준비는 끝났다 — 도착하면 한 번에 돈다**:
```
하니스   wu-038-direct-url-e2e.test.ts  (CASES 배열에 6개를 넣는다)
origins  $TEMP/mi-p0-02/wu-038-origins.json  🟢 **남아 있다**(10-16 생성)
실행     WU_038_LIVE=1 npx vitest run …wu-038-direct-url-e2e.test.ts
CONTROL  🟢 위 §4 가 그 하니스로 이미 PASS 했다
```

---

## 6. Human GT

🟢 CONTROL 케이스의 GT 4건은 **CTO 가 직접 페이지를 확인해 확정한 값** 이고 재사용했다.
🔴 6개 AI URL 의 GT 는 **URL 이 와야 만들 수 있다**. 🔴 AI 의 「동일상품 ✅」는 쓰지 않는다.

🔴 **B226AC042 ↔ B226AC043 보호는 이미 코드에 있다**(CPO §7):
`compareModelCode` 가 「공통 접두 4자 이상 뒤 분기 → **conflict**」이고 그것이
`B226AC042 ↔ B226AC043` 을 가른다(WU-048 전수검증). 🟢 새로 만들 것이 없다.

---

## 7. 기존 `searchDomesticShops` 와 비교 — 🔴 **합산하지 않는다**

```
Registry 안 자동 검색   후보 **175** · very_high **1** (3.8%) · `high` **0건**   [WU-017/018 인용]
Registry 밖 수동 공급   위 §4 — 입력 5 · SAME 4 · VERIFIED 3 · 🔴 국내 축 진입 **0**
🔴 모집단이 다르다. 분모를 섞지 않았다.
🟢 그런데 **둘의 실패 지점이 다르다** — 이것이 이번 비교의 핵심이다:
   Registry 안  → 🔴 **MI 에서 죽는다**(축 부족 · 점수 거의 0)
   Registry 밖  → 🟢 **MI 는 통과한다**(SAME 4/5) · 🔴 **시장·가격 게이트에서 죽는다**
```

🔴🔴 **그러므로 「MI 정확도」와 「국내 축 진입」은 서로 다른 문제다.** Registry 밖
후보에서 MI 는 이미 잘 돈다 — 막는 것은 MI 가 아니다.

---

## 8. Registry-outside 후보의 실제 생존 경로 (전수)

```
URL → extractCandidateUrlsFromAiAnswer   🟢 Registry 참조 0
    → isPubliclyRoutableHttpUrl (SSRF)   🟢 WU-025/026 경계 유지
    → factsFromProductUrl                🟢 열어서 읽는다 · JSON-LD 가격까지
    → groupCandidatesByHost(__url_candidates__)
    → withConfidence → judgeDomesticCandidate  🟢 **Gemini 와 같은 함수 · 전용 규칙 0**
    → enrichCandidatePrices                    🟢 transient 에도 적용된다(:1080)
    → priceKrw = VERIFIED_CURRENT && KRW       🔴 **게이트 ③**
    → classifyCandidateMarket                  🔴 **게이트 ②**
    → market === "KR" ? 국내 축 : 해외 축      🔴 분기
    → 저장: isTransientShopId 가 차단          🟢 불변식 유지
```

🟢 즉 **소비자는 완성돼 있다**(CPO §10 의 전제가 맞다). 🔴 그러나 ②③ 때문에
**국내 축 종점에는 닿지 않는다.**

---

## 9. 10축 — ①~③ 재조사 안 함(CPO §9)

| 축 | 판정 | 근거 |
|---|---|---|
| ① Registry | 🟢 우회 가능 (기존 확정) | 재조사 0 |
| ② transient | 🟢 재사용 | 재조사 0 |
| ③ candidateUrls | 🟢 공급 계약 정상 | 재조사 0 |
| ④ searchDomesticShops | 🟡 **다른 실패 지점** | §7 — MI 에서 죽는다 |
| ⑤ 외부 AI | 🔴 **금지** | AUP·전략(006R) |
| ⑥ 직접 URL | 🟢 구현됨 | WU-049-R 가 경로 확정 |
| ⑦ extraction | 🟢 **정상** | 실측 5/5 추출 성공 |
| ⑧ MI | 🟢 **정상** | SAME 4/5 · 🔴 False SAME 1(trenbe) |
| ⑨ price gate | 🔴 **차단 1** | UNVERIFIED_SEARCH → priceKrw null |
| ⑩ UI / 시장 게이트 | 🔴🔴 **차단 2** | non-`.kr` → UNKNOWN → 국내 축 밖 |

🔴 **최종안을 고르지 않았다** — ②를 완화하는 모든 안이 CPO 의 「통화 단독 결정 금지」와
정면으로 만난다. 선택지만 적는다:
```
⒜ 현상 유지 — 국내 축은 Registry/`.kr` 로 한정하고 나머지는 해외 참고가격으로 보여준다
   🔴 단 §3 의 「KRW 가 해외 참고가격에 뜨는」 문구 결함은 남는다
⒝ KR 증거를 **셋째** 로 늘린다 — 예: 한국어 페이지 + KRW · `ko` 로케일 + KRW
   🔴 WU-020 §4 재개정 필요 · False KR 위험을 측정해야 한다
⒞ 셀러가 직접 넣은 URL 을 「국내 선언」으로 쓴다
   🔴 **셀러 주장을 증거로 승격** 한다 → 이 저장소가 반복해서 거부해 온 패턴
⒟ 국내/해외를 가르지 않고 **「시장 미확인 가격」 축** 을 하나 더 만든다
   🔴 새 축 신설 → 제품 정책
```

---

## 10. 구현 — **하지 않았다**

🔴 §10 의 「단순 wiring 누락」이 **아니다.** 막는 것은 배선이 아니라 **판정 규칙**(②)과
**검증 기준**(③)이고, 둘 다 CPO 가 명시적으로 세운 안전장치다. 🔴 임의 완화는
측정 조작에 가깝다.

🔴 Registry 에 6개 판매처를 넣어 통과시키는 것도 하지 않았다(CPO §4 — 측정 조작).

---

## 11. 검증

```
신규 하니스  wu-050-domestic-entry-gate.test.ts  **9 passed** (외부 0 · DB 0 · 순수)
CONTROL      wu-038-direct-url-e2e  **PASS** (실제 HTTP · 읽기만 · 전건 재현)
회귀         admin **559 files / 8,171 passed · failed 0**  (직전 558/8,162 → +1파일 +9)
typecheck    **0**
build        🔴 미실행 — **운영 코드 변경 0** 이고 테스트는 번들에 들어가지 않는다.
             🟢 같은 tsconfig 의 tsc --noEmit 이 0 이므로 타입 축은 덮였다
security     🟢 fetch/URL 경로 **무변경** — SSRF/redirect/DNS rebinding/사설IP 경계
             (`classifyOutboundUrl` · `guardedLookup`) 한 줄도 건드리지 않았다.
             🔴 client bundle 위험도 없다(새 import 0 · 테스트 파일만 추가)
mutation     🔴 **만들지 않았다** — 바꾼 운영 코드가 **0** 이라 변이 대상이 없다.
             🟢 대신 §3 의 단언이 「고치면 뒤집히는」 역방향 잠금 역할을 한다
```

---

## 12. 최종 판정

```
🟢 GO    — 아니다. 기존 연결 결함(wiring)이 아니었다
🟡 HOLD  — **그렇다.** 소비자는 완성돼 있고(①) 막는 것은 **정책 게이트 둘**(②③)이다.
           그 완화는 전부 CPO 제품정책 판정 사안이다
🔴 STOP  — 아니다. 보안/ToS/비용/파괴적 변경 요인 없음
──────────────────────────────────────────
**HOLD**
```

🔴 **그리고 CPO §11 의 HOLD 정의를 한 줄 정정한다**:
> 기술된 HOLD 는 「transient 로 완전히 처리 가능하지만 **자동 producer 가 정책상 존재할
> 수 없음**」이었다. 🔴 실측은 그보다 **한 겹 더** 다 — **transient 로도 «국내 축» 은
> 완전히 처리되지 않는다.** producer 를 얻어도 ②③이 남는다.

---

## 13. Production 상태

```
운영 코드 변경 0 → 기능 변화 0 · 배포 영향 0
커밋 내용은 테스트 1 + 문서 1
```

---

## 14. 남은 문제

```
🔴 P0-1~P0-4 수치 — **6개 URL 문자열 대기**(§5). 도착하면 한 번에 측정된다
🔴 §3 의 「해외 참고가격에 KRW 가 뜬다」 문구 결함 — WU-049 변경 금지라 고정만 했다
🔴 ②의 완화안 ⒜~⒟ — CPO 판정
🟡 False SAME 1건(trenbe.com · SAME 인데 GT DIFFERENT) — WU-037 트랙의 기존 과제이고
   이 WU 에서 건드리지 않았다
```

---

## 15. 🔴 CEO Action — **NONE**

🔴 **필요한 것은 CEO 가 아니라 «전달» 이다.** CPO 가 확정한 6개 URL 의 **문자열** 이
CTO 쪽 메시지에 포함되지 않았다(개수와 가격 요약만 왔다).

```
필요 형태 — 원상품별로 URL 만 있으면 된다. AI 의 판정·설명·가격은 쓰지 않는다.
A · B226AC009  https://…
B · B226AC042  https://…   https://…
C · B226AC043  https://…   https://…   https://…
```

🟢 그것만 오면 **같은 세션 안에서** P0-1~P0-4 · A/B/C/D/E 분류 · Human GT 까지 끝낸다.
