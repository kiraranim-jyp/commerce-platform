# DISCOVERY-TO-MI-CANONICAL-01 — ① AI Search 목록 → ② MI SAME 목록

🔴 Query · Search · Identity · threshold · Market Attribution · MI 계산식 **변경 0** ·
Registry · adapter · 403 우회 · Browser fallback · 국내/해외 분리 **0** · **새 Search 0**.
🟢 이번 산출물은 **추적표와 계약** 이다(운영 코드 변경 0).

---

## §12 후보 전 이력 추적표 — Bobo Choses `B226AC009`

원본 — `brand=Bobo Choses` · `code=B226AC009` · `title=Hug Hairy Monster T-shirt` · `color=Light blue`

| # | 후보 | ① AI Search | ② shape | ③ policy | ④ crawl | ⑤ evidence | ⑥⑦ MI 판정 | ⑩ market | ⑨ 가격 | ⑪ 최종 |
|---|---|---|---|---|---|---|---|---|---:|---|
| A | `bobochoses.com` | 발견 | PRODUCT_PAGE | 통과 | OK | 있음 | **SAME** | UNKNOWN | **EUR 40** | 해외 집계 |
| B | `www.tinyapple.net` | 발견 | PRODUCT_PAGE | 통과 | OK | 있음 | **SAME** | OVERSEAS | **USD 58** | 해외 소싱 |
| C | `www.junioredition.com` | 발견 | PRODUCT_PAGE | 통과 | OK | 있음 | **SAME** | OVERSEAS | **GBP 37** | 해외 소싱 |
| D | `bridge.babyshop.com` | 발견 | PRODUCT_PAGE | 통과 | 🔴 **FAIL** | 없음 | — | — | — | 🔴 `UNREACHABLE` 에서 탈락 |

🟢🟢 **후보가 줄어든 단계는 «하나» 다 — ④ crawl 에서 1건.** ②③⑤⑥⑦ 손실 **0**.

### §11 — MI 가 **왜 SAME 인지**(운영이 낸 근거 그대로 · 새 규칙 0)

`bobochoses.com` 예:
```
모델명 유사도 100% · 카테고리 일치 · URL slug 일치 · 브랜드 일치
근거: 핵심 상품명 hairy/hug/monster · 브랜드 품번 일치 · 상품군 shirts ·
      색상 BLUE · 소재 organic cotton:100 · 핏 loose fit · 대상 KIDS ·
      사이즈 체계 AGE ↔ AGE
판정방법: MODEL_CODE_EXACT — 브랜드 품번 완전 일치
판정근거: 텍스트등급=very_high · 품번증거=exact (B226AC009 ↔ B226AC009) ·
          교차판매처=SAME → EXACT_IDENTIFIER(순위 5)
```
🟢 **보류사유 0 · 충돌 0** — 세 후보 모두 blocker/conflict 가 비어 있다.
🔴 **새 판단 규칙을 만들지 않았다** — 위 문장은 전부 운영 엔진이 생성한 것이다.

---

## §15 분모

```
원본 상품            1
AI Search            **1회**        (`searches: 1` · failed 0 · skipped 0)
AI Search 후보       **4**
Crawl                3              🔴 −1  `UNREACHABLE`
Evidence             3              손실 0
SAME                 **3**          PRESUMED_SAME 0 · SIMILAR 0 · DIFFERENT 0 · UNKNOWN 0
KR SAME              **0**
OVERSEAS SAME        2  (+ market UNKNOWN 1 = `bobochoses.com`)
국내 가격 후보       **0**          국내 판매처 URL **0**
해외 가격 후보       3              해외 판매처 URL **3**
API                  3  →  Client 3  →  mounted DOM 3   (§19 에서 소실 0 확인)
따져 노출            🔴 **CEO 미확인**
```

🔴 **후보가 줄어든 곳 = ④ crawl 한 곳뿐이다.** ⟹ 🟢 **② 비교→MI SAME 은 손실 0 이다.**

---

## §14 PASS 조건 대조

| | 조건 | 결과 |
|---|---|---|
| PASS 1 | 최초 URL → AI Search 후보 목록 · 건수 | 🟢 **4건** |
| PASS 2 | 각 후보가 원본과 비교된다 | 🟢 **3/3**(crawl 된 전건) |
| PASS 3 | MI 가 SAME/…/UNKNOWN 으로 판단 | 🟢 **SAME 3** · 근거까지 확보 |
| PASS 4 | SAME 후보의 URL+판매처+가격+Market 보존 | 🟢 **3/3** |
| PASS 5 | KR SAME → 국내 참고가격 + 국내 URL | 🔴 **입력이 0** — AI Search 가 국내 URL 을 0건 냈다 |
| PASS 6 | OVERSEAS SAME → 해외 최저 + 해외 URL | 🟢 **GBP 37 · USD 58** + URL 3 |
| PASS 7 | 따져에서 실제로 보인다 | 🟡 DOM 소실 0(§19) · 🔴 **CEO 확인 미완** |

---

## §16 STOP 판정 — **어느 경우에 해당하는가**

```
🔴 「AI Search 후보가 정상인데 MI SAME 이 비정상」   → 해당 없음(3/3 SAME · 근거 정상)
🔴 「MI SAME 은 정상인데 가격이 연결 안 됨」          → 해당 없음(3/3 가격 있음)
🔴 「가격은 정상인데 판매처 URL 이 사라짐」            → 해당 없음(URL 3/3 보존)
🔴 「API 에는 있는데 Client/DOM 에서 사라짐」          → 해당 없음(§19 소실 0)
🔴 「DOM 에는 있는데 따져에서 안 보임」                → 🔴 **미확인**(CEO 축)
🔴🔴 **실제로 해당하는 것은 목록에 없는 한 가지** —
     **AI Search 가 국내 URL 을 애초에 0건 낸다** ⟹ PASS 5 의 분모가 0 이다
```
⟹ 🔴 **owner 는 Search 축** 이고, §10 이 Query 변경을 금지했으므로 **CTO 가 열지 않았다**.

---

## 🟢 §4·§5·§6 구조 확인 — **이미 하나의 집합이다**

```
국내/해외가 **같은 evidence 배열**(`GeminiTransientEvidence`)에서 나오고
가격도 **같은 함수**(`summarizeCandidateOverseasPrices`)가 만든다.
갈리는 곳은 `market === "KR"` **한 줄** 이다.
⟹ 🟢 「국내 AI Search / 해외 AI Search / 국내 전용 모델」을 **만들지 않았고 만들 필요도 없다**.
⟹ 🟢 「가격만 있고 URL 이 없는 별도 국내 축」도 **구조적으로 존재하지 않는다** —
   직전 WU 에서 `biskuit.kr` 이 **URL + ₩88,000 + 판정** 을 한 행으로 낸 것이 그 증거다.
```

---

## 계약 5 + 회귀

```
① AI Search 분모는 Production 기록에서 나온다(손으로 적지 않는다)
② 🔴 [현상 고정] **AI Search 후보에 한국 TLD 0** — 국내가 들어오면 **FAIL 로 뒤집힌다**
③ 후보 4건 전 이력이 한 표로 나온다(라이브)
④⑤ (직전 WU) human 라벨 분모 · 한국 TLD 1건 · 타 TLD 한국 소비자용 분리

회귀 **733 files / 9,622 passed / 0 failed** · typecheck **0** · build exit **0**
```

🔴 **하니스를 두 번 틀렸고 둘 다 적는다** — ⒜ pool 단계에서 `crossSellerVerdict` 를 읽으려
했는데 **그 칸이 없다**(판정은 runner 안이다) → 전건 `verdict=-` 였다 ⒝ evidence 의
`domain` 에 `www.` 가 없어 **2건을 놓쳤다**. 🟢 둘 다 출력이 이상해서 잡았고 고쳤다.

---

## 최종 판정 — 🟡 **PARTIAL**

```
🟢 ① AI Search 목록 → ② MI SAME 목록 → ③ 가격/판매처 연결  **구조적으로 닫혔다**
   (해외 축에서 끝까지 실측: SAME 3 → URL 3 → 가격 3 → 해외 최저 GBP 37 · USD 58)
🔴 남은 둘
   ⒜ **PASS 5** — AI Search 가 국내 URL 을 0건 낸다(분모 0) ⟹ **Search 축 · CPO 지정**
   ⒝ **PASS 7** — 따져 화면 CEO 확인(그 한 칸은 CTO 가 볼 수 없다)
```
