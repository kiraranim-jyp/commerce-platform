# DANAWA POC — 국내 가격비교 소스 검증 기록

작성: 2026-09-21 · 코드 0 · DB 0 · migration 0 · fixture 0 · adapter 0 · registry 0

---

## 0. 이 문서가 답하려 한 질문

> **해외에서 찾은 «바로 그 상품» 이 다나와 가격비교 DB 에 있는가.
> 있다면 그 상품의 최저가는 얼마인가.**

「국내에서 비슷한 상품 가격 하나 더 찾기」가 아니다. 그 구분이 이 POC 전체의 기준선이다.

---

## 1. 🔴 모집단 — 숫자를 섞지 않는다

```text
전체 고유 상품                     72
  ├─ Smallable                    20   🔴 원천 접근 불가 (CloudFront 403) → «미측정»
  └─ 실측 가능 모집단               52
       ├─ 실제 A단계 실행            51
       └─ 미실행                     1   (URL 목록 마지막 줄 개행 누락)
```

⚠️ **`Smallable 20건을 NO_RESULT 로 처리하지 않는다.**
읽지 못한 것이지 다나와에 없는 것이 아니다. 커버리지 분모에도 넣지 않는다.

⚠️ **「52건 측정」이라고 쓰지 않는다. 실제 실행은 51건이다.**

---

## 2. Funnel

| 단계 | 건수 | 비율 | 비고 |
|---|---:|---:|---|
| 실측 가능 모집단 | 52 | — | Smallable 20 제외 |
| A 품번 추출 | **40 / 51** | **78%** | 404 1건 · 추출실패 10건 |
| B 다나와 코드 적중 | **11 / 16** | **69%** | A 중 «층화 표본» 16개 대상 |
| C pcode 확보 | **4 / 11** | **36%** | 🔴 아래 주의 |
| D `/info/?pcode=` 접근 | 4 / 4 | 100% | |
| E 최저가 추출 | 4 / 4 | 100% | `og:description` |

### 🔴 36% 와 80% 를 혼동하지 않는다

```text
POC 전체 C 성공률        4 / 11  =  36%     ← 테스트한 «모든 브랜드» 기준
Bobo Choses 한정 C       4 /  5  =  80%     ← «한 브랜드» 안에서의 비율
```

**둘은 다른 숫자다.** 그리고 **둘 다 「TTAEJYO 전체 상품의 Danawa coverage」가 아니다.**
전체 커버리지는 **아직 미측정**이다(B/C 를 전수로 돌리지 않았고, Smallable 이 빠져 있다).

---

## 3. 브랜드별 — 이 표가 결론을 결정했다

```text
브랜드            A 추출        B 적중     C pcode
Bobo Choses      17/18  94%     5/6       🟢 4/5   (80%)
PèPè               8/8 100%    🔴 0/2      —       코드가 다나와에 «아예 없음»
TAO                3/4          2/2       🔴 0/2   (1건은 오매칭 — §5)
Mini Rodini        2/2          1/2          0/1
Konges             3/4          1/2          0/1
Misha & Puff       2/2          1/2          0/1
기타              5/13  38%      —           —
```

```text
A→B 는 여러 브랜드에서 반복된다        ✅  (Misha K1003W25-907 = 17/17 완전 일치)
B→C 는 Bobo Choses 에 집중된다         🔴  타 브랜드 0/5
```

→ **판정: DANAWA = 보조 Evidence. Primary Source 전환 근거 없음.**

---

## 4. 확인된 가격 — 기존 국내가가 «전부» 과대평가였다

| 모델 | 우리 기존 관측 | 다나와 최저가 | 차이 |
|---|---:|---:|---|
| `B226AC009` | ₩88,000 | **₩60,450** | 🔴 +₩27,550 |
| `B226AC010` | ₩88,000 | **₩76,070** | +₩11,930 |
| `B226AC070` | ₩202,000 | **₩162,320** | 🔴 +₩39,680 |
| `B226AC042` | ₩162,000 | **₩109,500** | 🔴 +₩52,500 |

원인: 우리 국내 소스가 `Bobo Choses Korea(공식)` **한 곳뿐**이라 **브랜드 공식몰 정가**를
국내 가격으로 써왔다. 다나와는 같은 상품을 파는 **10곳**(옥션·G마켓·11번가·SSG·신세계몰·
이마트몰·롯데ON·머스트잇 등)의 실제 유통가를 본다.

🔴 **이건 판매판정을 직접 왜곡한다.** 국내 경쟁가를 높게 잡으면 「경쟁 가능」·「마진 확보」가
실제보다 낙관적으로 나온다.

---

## 5. 🔴 안전 규칙 — 실측으로 «깨져서» 얻은 것들

### ㉠ 이름 기반 검색은 폐기한다

```text
「페페 룰루 T바 슈즈」  →  Lulu Press "Pepe Saves Christmas"       (책)
「PePe Lulu T-Bar」    →  일본 G PROJECT 페페 누루루 로션 220ml    🔴
「보보쇼즈 스웨트셔츠」  →  40건 «전부» 다른 모델코드
```

이름으로 가격을 가져왔다면 **아동 신발 자리에 책과 성인용품 가격**이 들어갔을 것이다.
**이름 fallback 으로 커버리지를 올리려는 시도는 하지 않는다.**

### ㉡ `min()` 으로 최저가를 고르지 않는다 — 회원가 함정

```text
B226AC010   라벨 최저가 ₩76,070   페이지 내 ₩72,280 존재
B226AC070   라벨 최저가 ₩162,320  페이지 내 ₩161,060 존재
```

그 두 값의 정체는 DOM 에서 확인했다 — **`box__membership-price`**, 롯데ON **멤버십 회원가**다.
일반 구매자가 못 사는 가격이다.

→ **추출점은 `<meta property="og:description" content="최저가 60,450원">` 하나로 고정한다.**
4/4 전부 동일 형식이고, robots Disallow 인 `/info/ajax/` 를 건드릴 필요가 없다.

### ㉢ 🔴 짧은 품번의 «부분 문자열» 오매칭 — 「오매칭 0건」이 깨진 지점

`TAO F26100` 검색 결과에서 **pcode 가 붙은 유일한 상품이 다른 브랜드였다.**

```text
pcode=107888573  🔴  랑방 긴팔 티셔츠 RMSS0001 F047P26100 Grey    ← 랑방(Lanvin)
(pcode 없음)     ✅  키즈 펍피쉬 PUPFISH … 네이비 F26100 313DW    ← 진짜 TAO 상품
```

`F26100`(6자)이 랑방 품번 `F047P26100` 의 부분 문자열로 걸렸다.
**「검색결과의 첫 pcode 를 쓴다」였다면 TAO 아동 티셔츠에 랑방 가격을 붙였을 것이다.**

→ 필수 규칙 둘:

```text
① 코드는 «단어 경계» 로 일치해야 한다        \bF26100\b   (부분 문자열 금지)
② pcode 는 «그 코드가 단독 일치한 상품 행» 에서만 가져온다
   검색결과 전체에서 첫 pcode 를 줍는 방식 ❌
```

이 규칙을 적용하면 이번 건은 **`DANAWA_NOT_COMPARABLE`** 로 올바르게 떨어진다.

---

## 6. 채택 정책 (확정)

```text
해외 품번
  ↓
Danawa 검색
  ↓
검색 결과 «각 상품 행» 의 모델코드/상품명 확인
  ↓
단어 경계 기준 «독립적인 정확 일치»
  ↓
그 «행» 의 pcode
  ↓
/info/?pcode=
  ↓
og:description 최저가
```

```text
상품명만 검색            → 가격 사용 ❌
유사상품                 → 가격 사용 ❌
pcode 없는 개별 판매처    → 가격 사용 ❌
페이지 내 최저 금액 min() → 사용 ❌ (회원가 함정)
```

### 🔴 `pcode` 의 의미를 과장하지 않는다

> **`pcode` 는 다나와가 상품 동일성을 «보증» 한다는 뜻이 아니라,
> 다나와가 가격비교 상품으로 «통합한 단위» 까지 올라온 경우에만
> TTAEJYO 가 가격을 채택한다는 내부 정책이다.**

### 🔴 결과 코드의 의미

```text
DANAWA_NO_RESULT         다나와 «가격비교 미확인»   ≠ 국내 가격 없음
DANAWA_NOT_COMPARABLE    코드는 맞으나 미묶임       ≠ 국내 가격 없음
DANAWA_UNAVAILABLE       품번 자체를 못 뽑음
DANAWA_UNRESOLVED        pcode 있으나 가격 추출 실패
```

**어떤 경우에도 다른 상품의 가격을 대신 넣지 않는다.**

---

## 7. robots / 수집 제약

```text
www.danawa.com      Disallow: /user_report/ /elec/Management /my/ /member/ /error/ /404/ /*?iframe=*
search.danawa.com   Disallow: /api_ui/ /classes/ /genfile/ /globalData/ /snippets/ /tpl/
                    🔴 Crawl-delay: 10
prod.danawa.com     Disallow: /api/ /bridge/ /community/ /list/ajax/ /info/ajax/
openapi.danawa.com  🔴 User-agent: * / Disallow: /        ← 포털 페이지 탐색 금지
```

🔴 **표준 규칙 「다나와 `/info/ajax/` 금지」의 출처가 `prod.danawa.com` 임을 확인했다.
규칙은 정확하고 현행이다.** (`www` 의 robots 에는 없어 한때 낡은 규칙으로 의심했으나 정정)

🔴 **`Crawl-delay: 10` 은 설계에 직접 영향을 준다.**
검색 1건당 10초이므로 **MI 실시간 조사 루프에 넣을 수 없다.** 별도 배치/큐가 전제다.

### 공식 API

```text
api.danawa.com        DNS NXDOMAIN — 옛 문서의 엔드포인트가 «존재하지 않음»
openapi.danawa.com    로그인 필요 · robots 전면 Disallow
DANAWA_API_SECRET_KEY Vercel 에만 등록 (로컬 복사 안 함)
```

공식 API 경로는 **엔드포인트·인증 방식·상업적 이용 조건이 모두 미확인**이다.
이번 POC 는 **공개 검색/상품 페이지** 만으로 수행했다.

---

## 8. 상태

```text
DANAWA
────────────────────────────
검색 엔진                GO
모델코드 매칭            GO   (단어 경계 규칙 전제)
pcode 검증               GO
가격 추출                GO   (og:description)
이름 fallback            NO
개별 리스팅 집계          NO

Primary Source           🔴 HOLD
보조 Evidence            GO
추가 국내 소스 조사       🔴 HOLD
Bobo 전용 Adapter        🔴 HOLD
```

### 다른 국내 커머스 (DOMESTIC-SOURCE-01/03 결과)

```text
MUSINSA · KREAM · SSF SHOP · 29CM · W CONCEPT   전부 D
  · robots 가 `User-agent: * → Disallow: /` 이거나 (SSF · W컨셉)
  · WAF 로 robots.txt 조차 못 읽거나 (MUSINSA · 29CM)
  · 서버가 전면 500 (KREAM)
  · 공식 데이터 공급 경로 없음 — 확인되는 건 «판매자 입점/광고» 파트너뿐
```

**기존 소스(LOOXLOO·FORETFORET·RULII·DEUXBEBE·CHOCOEL·Bobo Korea)는 삭제하지 않는다.**
데이터는 유지하고 **신규 소스 확대만 멈춘다.**

---

## 9. 다음 단계에서 답해야 할 것

```text
① 전체 커버리지        B/C 를 전수로 돌리면 실제 몇 %인가 (현재 미측정)
② Smallable 20건       원천 접근이 열리지 않으면 영구 미측정
③ MI 우선순위 설계      Danawa 가격을 EXACT/COMPARISON 중 어디에 넣을 것인가
④ Bobo 전용 어댑터      커버리지 31% 에 개발비를 쓸 가치가 있는가
```

🔴 **③ 이 가장 중요하다.** 다나와 최저가는 «여러 판매처의 집계 결과» 이므로,
우리 `DOMESTIC_SHOP`(국내 한 판매처의 실제 판매가)과 **의미가 같지 않다.**
그 매핑을 정하기 전에는 판매판정에 연결하지 않는다.
