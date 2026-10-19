# WU-083 — 판매처 SKU ↔ 제조사 품번 연결 가능성 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「Smallable 전용 파서 금지 · OCR 금지 · 검색엔진 금지 ·
> `430700 → B226AC112` 추론 금지 · 보호축 전부 유지」

---

# WU-083 FINAL

## 0. 결론 — 🔴 **품번 복원 REJECT** · 🟡 **그러나 진짜 원인은 따로 있다**

```
① 상품 데이터를 못 가져오는가?  🔴🔴 **그렇다. 그리고 원인이 «파싱» 이 아니다.**
② 가져오면 읽히는가?            🟢 **전부 읽힌다**(brand · color · 가격 · 통화 · 사이즈 · 소재)
③ 제조사 품번이 없어서 막히는가? 🔴🔴 **그렇다 — 페이지 어디에도 «없다»**(8건 전수 0)
```

🔴 **그러므로 「Smallable 은 원래 파싱 불가」도, 「품번을 복원할 수 있다」도 둘 다 틀렸다.**

---

## 1. ① fetch — 🔴🔴 **헤더 크기** 다

```
운영 owner `factsFromProductUrl`   → **UNREACHABLE** (fetchPath PLAIN_HTML)
raw `fetch()`                      → **TypeError: fetch failed**

🟢 `node:https` 로 maxHeaderSize 를 바꿔 **원인을 특정** 했다:
   16,384B (Node 기본)  → 🔴 **Parse Error: Header overflow**
   65,536B              → 🟢 **200 · 본문 745,320B · 응답 헤더 19,197B**
  262,144B              → 🟢 200 (동일)
```

🔴 즉 Smallable 은 **응답 헤더가 19KB** 라 Node 기본 상한(16KB)을 넘는다.
🟢 메모 `smallable-market-is-shipping-destination`(「fetch() 로 재면 헤더초과로 못 받는다」)과
WU-016 의 「Smallable UNREACHABLE」이 **같은 원인** 이었음이 확정됐다.

### 🔴 그러나 **일반화되지 않는다** — 분모를 적는다

WU-076 의 `UNREACHABLE 15/90` 을 전수 재측정(16K ↔ 128K 비교):

```
🔴 헤더 초과가 원인: **0/15**
   나머지는 404(6) · 403(2) · 503(2) · socket hang up(4) · timeout(1) — **다른 이유** 다
⟹ 헤더 초과로 관측된 호스트는 **Smallable 하나** 다(분모 1).
```

---

## 2. ② 가져오면 무엇이 읽히는가 — 🟢 **거의 전부**

| 필드 | Smallable 실측 | 비고 |
|---|---|---|
| title | `Bobo Choses Organic Cotton T-shirt \| Ecru` | 🟢 JSON-LD `name` |
| **brand** | **`Bobo Choses`** | 🟢 JSON-LD `brand.name` — **정확하다** |
| price / currency | **`82673` / `KRW`** | 🟢 JSON-LD `offers` |
| **seller SKU** | **`AAA1804916`** | 🔴 Smallable 자체 체계 |
| **manufacturer code** | 🔴 **없음** | `mpn` **null** · 본문 0건 |
| color | **`Ecru`** | 🟢 JSON-LD `color` |
| size | `2/3 years … 12/13 years` | 🟢 state(141 declination) |
| material | `Composition` 섹션 존재 | 🟡 구조화 아님 |

🟢 **JSON-LD `Product` 가 완전히 정상** 이다 — 우리 공통 extractor 가 **그대로 읽을 수 있는 모양**이다.
🔴 `price = 82673 KRW` 는 **한국 방문자용 표시가** 다 → `classifyCandidateMarket` 가
`KRW_WITHOUT_DOMAIN_EVIDENCE` → **UNKNOWN** 으로 둔다(🟢 WU-051 대로 올바르다).

---

## 3. ③ 제조사 품번 — 🔴🔴 **CPO §3 분기 C 확정**

검색 대상 전수(JSON-LD · HTML attribute · product metadata · variant data · JS state ·
이미지 alt · URL · description · hidden field):

```
B226AC112 / b226ac112        → ❌ **0건**
Bobo 품번 «모양»(B###AA###)   → ❌ **0건**
mpn / manufacturer            → ❌ **0건**
430700                        → 🟢 있다 (Smallable 상품번호 · URL)
sku AAA1804916                → 🟢 있다 (Smallable variant SKU · 141개)
```

🔴 **1건이 아니라 8건 전수** 에서 확인했다(Smallable 내부 Bobo Choses 상품 8종):

| Smallable 상품 | SKU | 색상 | 가격 | Bobo 품번 |
|---|---|---|---|---|
| Organic Cotton T-shirt | AAA1804916 | Ecru | ₩82,673 | ❌ |
| Organic cotton sailor dress | AAA1804970 | Red | ₩188,965 | ❌ |
| Recycled Fiber Cap | AAA1805120 | Red | ₩74,237 | ❌ |
| Organic Cotton Denim Floral Skirt | AAA1804787 | Navy blue | ₩123,165 | ❌ |
| Recycled Fiber Mushroom Down Jacket | AAA1804867 | Red | ₩296,945 | ❌ |
| Organic Cotton Flower Socks | AAA1805070 | Purple | ₩25,308 | ❌ |
| Organic cotton blouse | AAA1804950 | Ecru | ₩131,601 | ❌ |

⟹ **8/8 에서 제조사 품번 0건.** CPO §3 **C** 에 해당 ⟹ **추론 금지 · 전용 mapping 금지.**

🟢 **추론하지 않았다** — `430700`/`AAA…` 를 `B226AC112` 로 바꾸는 코드는 **쓰지 않았다**.

---

## 4. Control (CPO §8)

| | 대상 | 결과 |
|---|---|---|
| **A** 제조사 품번이 정상 표시 | `bobochoses.com`(공식) | 🟢 `OK` · `SHOPIFY_JSON` |
| **B** 판매처 SKU + 품번 둘 다 | `miniboutique.co.kr` | 🟢 `OK` · 제목에 `B226AC112` |
| **C** 판매처 SKU 만 | `smallable.com` | 🔴 `UNREACHABLE`(헤더) · 품번 **0** |
| (덤) SSG | `shinsegaemall.ssg.com` | 🔴 `NOT_PRODUCT_URL` — **WU-073 이 이미 「오차단」으로 기록** |

🟢 목표대로다 — **정상 품번은 추출되고, 판매처 SKU 만 있으면 UNKNOWN 으로 남는다.**
🔴 오인 연결 **0**(연결을 시도하는 코드를 만들지 않았으므로 구조적으로 0).

---

## 5. GO 조건 대조 (§10)

| | 조건 | 결과 |
|---|---|---|
| ① | 제조사 품번 **또는 동등한 독립 식별자** 존재 | 🔴 **불충족** — 품번 0 · `mpn` null |
| ② | 기존 공통 parser 로 일반화 가능 | 🟢 (JSON-LD 가 정상이라 **읽기만 하면 된다**) |
| ③ | hostname 조건 불필요 | 🟢 |
| ④ | Control A/B/C false mapping 0 | 🟢 (mapping 자체를 안 만들었다) |
| ⑤ | GT precision regression 0 | 🟢 (운영 변경 0) |
| ⑥ | Smallable→Bobo 가 가격비교까지 연결 | 🔴 **불충족** |

⟹ ①⑥ 불충족 ⟹ 🔴 **REJECT (품번 복원)**. **Smallable 전용 특수처리를 만들지 않는다.**

---

## 6. 🟡 그런데 **별개의 레버가 하나 발견됐다** (CPO 판정 사안 · 구현 0)

```
Smallable 이 MI 에 못 들어가는 «직접» 원인은 품번이 아니라 **fetch 실패** 다.
🟢 그 페이지에는 WU-016 이 「품번 없이 SAME(0.81)」에 닿을 때 쓴 다섯 축이
   **전부 구조화 데이터로** 있다 — brand · 상품명 · 색상 · 상품군 · (소재).
🔴 지금은 그 다섯 축을 **하나도** 못 쓴다. 헤더 16KB 에서 끊기기 때문이다.
```

🟡 **최소안 설계(구현하지 않았다)**:
```
`fetchPlainHtmlWithFinalUrl`(WU-075 가 만든 **단일 fetch owner**)에서
`fetch` 가 실패했을 때 **1회만** `node:https`(maxHeaderSize 64KB)로 재시도한다.
🟢 hostname 조건 **0** · 추가 요청은 **실패했을 때만** · 성공 경로 **불변**
🔴 그러나 이 WU 의 GO 조건은 「품번 복원」에 대한 것이고 **이 변경을 승인하지 않는다.**
🔴 그리고 **분모가 1 호스트** 다 — 이 트랙의 「N=1 로 일반화하지 않는다」에 걸린다.
⟹ **CPO 판정 사안으로 올린다. CTO 가 임의로 운영 fetch 를 바꾸지 않았다.**
```

---

## 7. 회귀 / typecheck / build

```
apps/admin  **594 files / 8,328 passed** / failed **0** (skipped 102)
typecheck **0** · build **exit 0** · WU-082 baseline(593/8,327)에서 **+1 file / +1 test**
🔴 운영 코드 변경 **0** · MI 0 · 보호축 0 · AI/Vision/OCR/검색엔진 **0** · 배포 0
🟡 HTTP 약 **30 요청**(read-only GET · 키 0 · 결제 0)
```

## 8. Known Unknowns

```
① 🔴 Smallable 상품 **8건** 에서만 봤다. 전 카탈로그가 아니다
② 🔴 헤더 초과 관측 호스트는 **1곳** 이다(UNREACHABLE 15건 중 0건이 같은 원인)
③ 🔴 Smallable 의 「Composition」(소재)은 **구조화 데이터가 아니다** — 추출 가능성 미측정
④ 🔴 헤더 수정 뒤 Smallable 후보가 **실제로 SAME 에 닿는지** 는 미측정(구현을 안 했다)
⑤ 🔴 `AAA…` SKU 가 **다른 판매처에도 나타나는지**(공용 식별자인지)는 미조사
⑥ 🔴 SSG 가 `NOT_PRODUCT_URL` 인 것은 WU-073 의 분류기 오차단이고 이 WU 범위 밖이다
```

## 9. 🔴 **REJECT** (품번 복원) · 🟡 **HOLD** (헤더 수정 — CPO 판정)

## 10. CEO Action — **육안 비교 1회**(아래 §11)

---

## 11. 🟢 CEO 육안 검토용 비교 목록

> CEO 요청: 「스몰러블 제품 몇 가지를 비교 요청하면 내가 육안으로 검토해 줄게」

🔴 **우리가 확인하고 싶은 것은 「같은 상품인가」가 아니라
「Smallable 페이지에 Bobo 공식 품번이 정말 없는가」** 입니다.

| # | Smallable 상품 (실측값) | 확인해 주실 것 |
|---|---|---|
| 1 | **Organic Cotton T-shirt · Ecru · ₩82,673**<br>`smallable.com/en/product/bobo-choses-organic-cotton-t-shirt-ecru-bobo-choses-430700` | 화면 어디에든 **`B226AC112`** 같은 Bobo 품번이 보이는지 |
| 2 | **Organic cotton sailor dress · Red · ₩188,965**<br>`…bobo-choses-430712`(SKU AAA1804970) | 동일 |
| 3 | **Recycled Fiber Mushroom Down Jacket · Red · ₩296,945**<br>(SKU AAA1804867) | 동일 |
| 4 | **Organic Cotton Flower Socks · Purple · ₩25,308**<br>(SKU AAA1805070) | 동일 |

🔴 **질문은 셋입니다**:
```
① 상품 페이지(접힘·탭·「Details」 포함) 어디에도 **B226AC112 류 품번이 없습니까?**
   — 우리 측정으로는 HTML 전체에 **0건** 입니다
② 혹시 **「Reference」·「Ref.」·「Product code」** 같은 칸이 화면에 보입니까?
③ 1번 상품이 공식 Bobo Choses `B226AC112`(Pop T-shirt)와 **같은 상품입니까?**
   — 🔴 우리는 이름이 달라서(「Organic Cotton T-shirt」 ↔ 「Pop T-shirt」) 단정하지 않았습니다
```

🟢 ①②가 「없다」로 확인되면 **Smallable 품번 복원은 영구히 닫습니다**(추론 금지).
🟡 ③의 답에 따라 **헤더 수정의 사업 가치**(= Smallable 을 다섯 축으로라도 비교에 넣을지)를
CPO 가 판정합니다.
