# DISCOVERY-QUERY-ADOPT-01 — 운영 Query 채택 + Production E2E

🔴 Identity · threshold · Market Attribution · MI · 가격공식 · Registry · adapter ·
403 우회 · Browser fallback · UI 구조 **변경 0**. 🟢 바뀐 것은 **Query 꼬리 신호 하나** 다.

---

## 1. Query 변경

```
변경 전   … 동일상품 판매처
변경 후   … **국내해외 동일상품 판매처**     ← CPO 채택(QUERY-SIGNAL-AB 실측 근거)
```
🔴 구조·개수는 그대로다 — `BRAND + [CODE] + PRODUCT NAME + FACTS + 신호` · **상품당 1개**.

### 10개 Preview (채택 신호 적용 후)

| 상품 | Brand | Code | 최종 Query | tok |
|---|---|---|---|---:|
| Bobo Choses | Bobo Choses | `B226AC009` | `"Bobo Choses" "B226AC009" Hug Hairy Monster T-shirt Light blue loose fit 국내해외 동일상품 판매처` | 14 |
| BOSS | BOSS | — | `"BOSS" Baby Boys Logo Top White 100% Cotton 국내해외 동일상품 판매처` | 11 |
| Louis Louise | Louis Louise | — | `"Louis Louise" Holly Hearts Ribbed Velvet Pink 100% Cotton 국내해외 동일상품 판매처` | 12 |
| Main Story | Main Story | `AW26MS185` | `"Main Story" "AW26MS185" Bubble Sweatshirt Melange Grey 100% Organic Cotton relaxed fit 국내해외 동일상품 판매처` | 15 |
| Mini rodini | Mini rodini | — | `"Mini rodini" Violas aop Winter jacket 100% recycled polyester 국내해외 동일상품 판매처` | 12 |
| Damarindo / Cericho / Magro / Racchetto / Trattino | Sergio Tacchini | — | `"Sergio Tacchini" Men's … Brilliant White 100% Cotton true to size 국내해외 동일상품 판매처` | 12~16 |

🟢 **10/10 생성** · 품번 없이 생성 **8** · `NO_MODEL_CODE → Search 0` 구조 **없음**.

---

## 2. Search — **10 / 10**

```
Products 10 → Queries 10 → Search calls **10**
searches = 1 (전건) · retry 0 · query variations 0 · domestic/overseas split 0
failed 0 · raw candidates 합계 **67**
```

---

## 3. Candidate funnel · 상품별

| # | 상품 | raw | pool acc/use | 재투입 | evidence | SAME | PRES | 🇰🇷 | 🌎 | 국내가격 |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Bobo Choses | **0** | — | **10** | **8** | 4 | 4 | **1** | 7 | **₩88,000** |
| 2 | BOSS | 8 | 1/0 | 0 | 7 | 1 | 6 | 0 | 7 | — |
| 3 | Louis Louise | 7 | 2/1 | 0 | 7 | 0 | 7 | 0 | 7 | — |
| 4 | **Main Story** | 9 | 9/8 | 0 | **6** | **2** | 4 | **3** | 3 | **₩117,000** |
| 5 | Mini rodini | **0** | — | 0 | 2 | 0 | 2 | 0 | 2 | — |
| 6 | Damarindo | 7 | 6/0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 7 | Fall Cericho | 9 | 0/0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 8 | Magro | 9 | 3/1 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 9 | Racchetto | 9 | 5/5 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 10 | Trattino Short | 9 | 5/3 | 0 | **3** | 0 | 3 | 0 | 3 | — |
| | **합계** | **67** | | **10** | **33** | **7** | **26** | **4** | **29** | |

🟢 **UNKNOWN 0** (직전 측정에선 2) · 🟢 생산자 — webSearch 4 · reviewedSame **6** · domesticListing 3 · overseasAuto 20.

---

## 4. 🟢🟢 이번 측정의 핵심 둘

### ⒜ **AI Search 국내 후보가 처음으로 SAME · EXACT 까지 갔다**
```
Main Story  WEB_SEARCH  **miniboutique.co.kr · KRW 117,000 · SAME · tier EXACT · market KR**
⟹ 🟢 「URL + 판매처 + 가격 + 동일상품 판정」이 **한 후보 객체** 에 전부 붙어 있다.
   국내 참고가격 3건(deuxbebe 117,000 · donokids 134,000 · miniboutique 117,000)
```

### ⒝ **재투입 누락을 고쳤고 즉시 발화했다**
```
Bobo Choses  재투입 입력 **10** → `__reviewed_same__` evidence **6** → 🇰🇷 1(₩88,000)
🔴 직전 §17 라우트가 `reviewedSameUrls`/`verifiedSameUrlKeys` 를 안 넘겨
   그 생산자가 **한 줄도 돌지 않았다**(내 하니스 결함) — 이번에 넣어 해소됐다.
```

### ⒞ 🟢 **`117` 결함이 사라졌다**
```
Main Story `domesticLowestKrw` = **117000** (직전 117) — deuxbebe 캡처 수정 + 오염행 삭제가 확인됐다.
```

---

## 5. 🔴 측정불가/한계 — 넘겨 읽지 않는다

```
⒜ 🔴 **Bobo Choses · Mini rodini 의 raw 가 0 이다**(이번 실행). 직전 측정에선 4·0,
   그 전엔 9 였다 ⟹ SP-10 이 잰 **실행 간 변동**(같은 질의 URL 겹침 3~30%)이 그대로다.
   🔴 「채택 신호가 raw 를 줄였다」로 적지 않는다 — A/B 측정에선 85(>74)였다.
⒝ 🔴 테니스 5 중 4 가 evidence 0 이다 — raw 는 7~9 인데 pool/crawl 에서 죽는다.
   🔴 원인 분해는 이번 범위가 아니다(§12 「후보 실패 ≠ 파이프라인 실패」).
⒞ 🔴 해외 집계 상한 오염(12,700 GBP 등)은 **그대로** 다 — WU-111 구조 · 가격 정책.
⒟ 🔴 **따져 화면은 CTO 가 볼 수 없다** — DOM 축은 §19 가 Production 31행으로
   **소실 0** 을 증명했고, 마지막 한 칸은 **CEO 확인 1회** 다.
```

---

## 6. 폐기(§10) — 완료

```
token 생성(값 비출력) → Production Sensitive 등록 → 그 라우트에만 사용 → 10회 실행
→ 🟢 **token 즉시 폐기**(env 재조회 **0**) → 🟢 라우트 삭제 → 재배포
→ 🟢 증명은 **source + deployment**(소스 참조 grep **0**) · 🔴 HTTP 404 미사용
```

---

## 7. 회귀 / Git

```
733 files / 9,626 passed / 0 failed · typecheck 0 · build exit 0
계약 — core-1 B-2(한글 고정 키워드 allowlist · **상한 3 유지**) 갱신 ·
       Q13(비교 신호를 «운영이 아닌» 쪽으로 바꿔 양방향 유지)
🔴 커밋 메시지 사고 1건 — 백틱을 쉘이 치환해 본문 일부가 빠졌다(코드/내용은 정상 ·
   이미 push 돼 force-push 하지 않았다 · 상세는 이 문서가 들고 있다)
```

## 8. 최종 판정 — 🟡 **PARTIAL**

```
🟢 Query 채택·배포 완료 · Search 10/10 · 1P=1S 유지
🟢 **국내 축이 처음으로 끝까지 갔다** — AI Search → SAME(EXACT) → URL+가격 → 국내 참고가격
🟢 해외 축도 그대로 — SAME/PRESUMED 29행 · 가격 연결
🔴 남은 한 칸 = **따져 화면 CEO 확인**(CTO 범위 밖)
🔴 분리 보고 — 이번 미달은 **Query 문제가 아니다**:
   테니스 evidence 0 은 **Candidate/Crawl 축** · 화면 축은 **CEO 확인 대기**
```

🟡 **CEO Action 1회** — `/pipeline` **Main Story(Bubble Sweatshirt)**:
① 🇰🇷 국내 참고가격 **₩117,000** ② 후보에 `miniboutique.co.kr` 이 **동일상품**으로 서는가
③ 그 행에 **URL·판매처·가격**이 같이 있는가. 🔴 내부 어휘가 보이면 FAIL.
