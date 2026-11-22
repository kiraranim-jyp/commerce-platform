# MI-MULTI-CATEGORY-LABEL-01 — CEO 사람 판정용 원상품·후보 비교표

> 🔴🔴 **CTO 는 SAME/DIFFERENT 를 확정하지 않았다.** `ceoVerdict` 는 **전건 null** 이다.
> 🔴 운영 SAME 판정 변경 **0** · 자동 승격 **0** · 8축 완화 **0** · alias 추가 **0** ·
> DB/schema/migration/backfill **0** · 후보 저장 구조 변경 **0** · 가격·등록·seller **0**.

작성 2026-11-22 · 계약 `mmcl01-ceo-label-table.test.ts`(3건) ·
산출 `fixtures/mmcl01-ceo-label.json` · 수집 **HTTP 24회**(22개 URL 한정)

## 🔵 판정 화면

**https://claude.ai/code/artifact/9ab5a95f-59e1-4903-b3d1-a0732b002790**

```
원상품 패널이 **스크롤을 따라온다**(비교 대상이 사라지면 육안 비교가 성립하지 않는다 · WU-099 교훈)
후보마다 **브랜드 · 품번 · 상품명이 한 행 3열** · 각 칸에 「있음/없음/확인 불가」 + **실제 원문 발췌**
원문 전체는 **접힘** 안에(발췌를 먼저 보여준다 · CPO §4)
판정 입력 세 버튼 + 메모 · 🔴 **브라우저에만 남고 시스템에 저장되지 않는다**(§6) ·
   「판정 결과 복사하기」로 한 번에 받아갈 수 있다
```

---

## §1. 수집 현황 — 🟢 **20/22 확보**

| 축 | 수 |
|---|---:|
| 원상품 / 후보 | **5 / 22** |
| 상세설명 원문 확보 | 🟢 **20/22** |
| 🔴 수집 실패 | **2** — 둘 다 `REDIRECTED_AWAY` |
| 이미지 확인 가능 | 19/22 |
| HTTP 호출 | **24**(22개 URL · 리다이렉트 2 포함) |

🔴 **실패 2건을 그대로 적는다**(§5) — `nickis.com/…polo-ralph-lauren-jeans…` ·
`junioredition.com/…handsmock-apron-dress-in-natural…`. 🔴 둘은 세 항목이 전부
**「확인 불가」** 이고 **「없음」으로 적지 않았다**(CPO §2 명시).

---

## §2. 원상품 기준 정보 — 🔴 **DB SKU 와 운영 품번을 혼용하지 않았다**

| 상품군 | 원상품명 | 브랜드 | **DB SKU** | 🟢 **운영 품번** | 출처 | 설명 |
|---|---|---|---|---|---|---:|
| Trousers | Taxi Saurus Tag denim pants | Bobo Choses | 🔴 없음 | **B226AC073** | **URL slug** | 83자 |
| Dress | Handsmock Dress in Little Bouquet by Bonjour | Bonjour | 🔴 없음 | **BJ21** | 설명문 | 545자 |
| Dress | Handsmock Dress in Burgundy Cashmere Print by Bonjour | Bonjour | 🔴 없음 | **BJ44** | 설명문 | 548자 |
| Jacket | Reversible Jacket nº03 in Otter Brown by True Artist | True Artist | 🔴 없음 | 🔴 **없음** | 없음 | 635자 |
| Jacket | Mixed Media Jacket in Ecru Mix by Wynken | Wynken | **WK21W97** | **WK21W97** | 설명문 | 628자 |

🔵 **DB SKU 가 없는데 운영 품번이 있는 원상품이 3건** 이다 ⟹ 🔴 **DB 칸으로 「품번 유무」를
세면 틀린다**(MMCS-01 이 적은 그 사실이 이 묶음에서 다시 나왔다 · 계약이 **3** 으로 잠근다).

---

## §3. 후보별 비교표 (22건 전수)

표기 — `O` 있음 · `-` 없음 · `?` **확인 불가**.

### Trousers — Taxi Saurus Tag denim pants (Bobo Choses · B226AC073)

| 후보 | 설명 | 브랜드 | 품번 | 상품명 | 기존 자동 판정 |
|---|---:|---|---|---|---|
| **junioredition.com** | 235자 | 🟢 **O / 일치** | 🟢 **O / 일치** | 🟢 **O / 일치** | PRESUMED_SAME |
| designerkidswear.com | 121자 | − / 불일치 | − / 불일치 | O / 불일치 | PRESUMED_SAME |
| folkberlin.com | 1,434자 | − / 불일치 | − / 불일치 | − / 불일치 | PRESUMED_SAME |
| kidbizkid.com | 126자 | − / 불일치 | − / 불일치 | O / 불일치 | PRESUMED_SAME |
| 🔴 nickis.com | **0자** | **? / 비교 불가** | **? / 비교 불가** | ? / 불일치 | PRESUMED_SAME |
| petitemaisonkids.com | 627자 | − / 불일치 | − / 불일치 | O / 불일치 | PRESUMED_SAME |
| villagekids.co.uk | 170자 | − / 불일치 | − / 불일치 | O / 불일치 | PRESUMED_SAME |
| (도메인 없음) donokids | 46자 | − / 비교 불가 | − / 불일치 | O / 일치 | 🔴 없음 |

🟢 **`junioredition` 의 품번 발췌** — 「… **Product code B226AC073** AW26 Made in Portugal.」

### Dress ① — Handsmock Dress in Little Bouquet by Bonjour (BJ21)

| 후보 | 설명 | 브랜드 | 품번 | 상품명 | 기존 |
|---|---:|---|---|---|---|
| **junioredition.com** | 503자 | 🟢 **O / 일치** | − / 불일치 | 🟢 O / 일치 | PRESUMED_SAME |
| designerkidswear.com | 537자 | − / 불일치 | − / 불일치 | O / 불일치 | PRESUMED_SAME |
| kidbizkid.com | 79자 | − / 불일치 | − / 불일치 | O / 불일치 | PRESUMED_SAME |
| villagekids.co.uk | 137자 | − / 불일치 | − / 불일치 | O / 불일치 | PRESUMED_SAME |

### Dress ② — Handsmock Dress in Burgundy Cashmere Print by Bonjour (BJ44)

| 후보 | 설명 | 브랜드 | 품번 | 상품명 | 기존 |
|---|---:|---|---|---|---|
| 🔴 junioredition.com | **0자** | **? / 비교 불가** | **? / 비교 불가** | ? / 일치 | PRESUMED_SAME |
| petitemaisonkids.com | 580자 | − / 불일치 | − / 불일치 | O / 일치 | PRESUMED_SAME |
| shoppiccoliandco.com | 441자 | − / 불일치 | − / 불일치 | O / 일치 | PRESUMED_SAME |
| villagekids.co.uk | 154자 | − / 불일치 | − / 불일치 | O / 일치 | PRESUMED_SAME |

### Jacket ① — Reversible Jacket nº03 in Otter Brown by True Artist (🔴 품번 없음)

| 후보 | 설명 | 브랜드 | 품번 | 상품명 | 기존 |
|---|---:|---|---|---|---|
| designerkidswear.com | 522자 | − / 불일치 | − / 불일치 | O / 일치 | PRESUMED_SAME |
| junioredition.com | 319자 | − / 불일치 | − / 불일치 | O / 일치 | PRESUMED_SAME |
| kidbizkid.com | 181자 | − / 불일치 | − / 불일치 | O / 일치 | PRESUMED_SAME |

🔴 **원상품 품번이 없어** 품번 축은 세 건 모두 **비교 기준이 없는 상태** 다.

### Jacket ② — Mixed Media Jacket in Ecru Mix by Wynken (WK21W97)

| 후보 | 설명 | 브랜드 | 품번 | 상품명 | 기존 |
|---|---:|---|---|---|---|
| **junioredition.com** | 622자 | 🟢 **O / 일치** | 🟢 **O / 일치** | 🟢 O / 일치 | PRESUMED_SAME |
| **nickis.com** | 799자 | 🟢 **O / 일치** | − / 불일치 | O / 일치 | PRESUMED_SAME |
| villagekids.co.uk | 294자 | − / 불일치 | − / 불일치 | − / 불일치 | PRESUMED_SAME |

🔴🔴 **`junioredition` 의 비고에 「다른 품번 `B226AC098`」이 같이 적혀 있다**(CPO §7) —
품번 `WK21W97` 은 일치하는데 **다른 품번도 함께 있다** ⟹ 대표님이 그 원문을 보고 판단하실 자리다.

---

## §4. 세 식별정보의 원문 발췌 — 🔴 **「있음」은 전부 발췌를 들고 있다**

| 축 | 있음 | 없음 | 확인 불가 |
|---|---:|---:|---:|
| 브랜드 | **4** | 16 | 2 |
| 품번 | **2** | 18 | 2 |
| 상품명 | **18** | 2 | 2 |

### 🟢 브랜드 「있음」 4건 — 실제 원문
```
[Trousers] junioredition  「Taxi Saurus Tag Denim Pants by Bobo Choses. Midnight blue denim trousers…」
[Dress ①] junioredition  「Handsmock Dress by Bonjour. Bonjour's iconic handsmock style in a longer length…」
[Jacket ②] junioredition 「Mixed Media Jacket by Wynken. This mixed media jacket is perfect for colder days…」
[Jacket ②] nickis.com    「…während die Wynken-Stickerei in Form einer Malpalette einen kreativen Akz…」
```
### 🟢 품번 「있음」 2건 — 실제 원문
```
[Trousers] junioredition  「… 100% Organic Cotton. Product code B226AC073 AW26 Made in Portugal.」
[Jacket ②] junioredition 「… Panel: 100% Nylon. Made in China. Product Code WK21W97 AW26」
```
🔴 「브랜드 있음」만 적거나 구조화 필드 값을 복사한 것이 **하나도 없다**(계약이 발췌 유무와
길이를 행마다 단언한다 · 데이터 변이 **M2b** 가 그것을 FAIL 로 확인했다).

### 🔴 「다른 품번이 명확한」 후보 — 원문을 같이 보여준다(CPO §7)
```
villagekids.co.uk (Trousers)  다른 품번 A2202, J50690
villagekids.co.uk (Dress ①)   다른 품번 A2012
villagekids.co.uk (Dress ②)   다른 품번 A1812
junioredition.com (Jacket ②)  다른 품번 B226AC098  🔴 WK21W97 과 «함께» 있다
```

---

## §5. 사람 판정과 자동 판정 분리 (§6 준수)

```
기존 자동 판정   PRESUMED_SAME **21** · 없음 1 ⟹ 🟢 **그대로 보존** 했다
사람 확인 기록   🔴 `candidate_reviews.human_verdict` 는 이 22건에서 **전건 null** 이다
CEO 판정란       🔴 **전건 비어 있다** — CTO 가 채우지 않았다(계약 + 변이 M8b 가 잠근다)
저장             🔴 DB 저장 **0** · 운영 판정 연결 **0** · 화면 입력은 **브라우저에만** 남는다
```

---

## §6. 🔴 내가 틀린 것 — **1차 표가 CEO 를 오판으로 밀 거짓을 적었다**

```
🔴🔴 기준 품번을 **DB `sku` + 원상품 상세설명의 품번 모양** 으로만 모았다.
   그런데 Trousers 원상품은 DB sku 가 **없고** 설명이 83자라 품번이 없다 —
   운영 `brandModelCode` 는 **URL slug**(`b226ac073-…`)에서 온다.
   ⟹ 후보 `junioredition` 설명의 **`B226AC073`(원상품 자신의 품번)** 을
      **「다른 품번」** 으로 적었다 ⟹ 🔴 **「품번 불일치」로 보여 DIFFERENT 로 밀 거짓** 이었다.
🟢 고친 방법 — **운영 owner 순서**(설명문 → 제목 → URL slug)를 그대로 불러 기준값에 넣었다.
   결과가 「품번 **일치** · `Product code B226AC073 AW26`」로 바뀌었다.
🟢 재발 방지 — 「**원상품 자신의 품번이 「다른 품번」 비고에 등장하면 FAIL**」을 계약으로 넣었고
   데이터 변이 **M6b** 가 그것을 확인했다.
🔴 그리고 자기참조 금지어로 **아홉 번째** 로 자기를 잡았다(앵커 문자열을 쪼개 고쳤다).
🔴 음성 대조를 **처음에 「단언 제거」로 설계해 M1~M7 이 전부 통과** 했다 — 단언을 지우면
   당연히 통과한다. 🟢 **산출물(데이터) 변이 7종** 으로 다시 돌려 전부 FAIL 을 확인했다.
```

---

## §7. 한계와 미측정

```
🔴 ⒜ **수집 실패 2건** 은 세 항목이 「확인 불가」다 — 재시도하지 않았다(§5 무제한 재시도 금지).
🔴 ⒝ **이미지를 화면에 싣지 않았다** — 이미지 CDN 은 「그 22개 URL」이 아니고, CPO §3-B 는
   **「확인 가능 여부」** 만 요구했다. 🟡 **링크로 제공** 했다(19/22 가능).
   🔵 **CPO 결정 1건** — 이미지를 화면에 박아 넣을지(19회 추가 읽기)는 승인 사안이다.
🔴 ⒞ 「상품명 일치」는 **원상품 제목의 핵심어 겹침** 으로 판단한 **관찰** 이다 — 운영
   매칭 규칙이 아니다. 🔴 그래서 「상품명 일치 18건」을 **SAME 근거로 쓰지 않는다**.
🔴 ⒟ **국내 후보가 0** 이다(22건 전부 해외 또는 미확정) ⟹ 국내 축은 이 묶음에서 **측정 불가**.
🔴 ⒠ `donokids` 1건은 `market`·`system_verdict` 가 **null** 이다(기존 데이터 그대로).
🔴 ⒡ 상세설명이 **46~1,434자** 로 편차가 크다 — 짧은 설명에서 「없음」은 **정보가 적어서** 일 수 있다.
🔴 ⒢ 색상·사이즈·구성품·형태 차이는 **별도 축으로 만들지 않았다** — 원문 전체를 접힘에
   넣어 대표님이 직접 보실 수 있게 했다(새 판정 축 신설 금지).
```

---

## §8. 변경 0 확인

```
운영 SAME 판정 변경 0 · 자동 승격 0 · 8축 완화 0 · alias 추가 0 ·
DB/schema/migration/backfill 0 · 후보 저장 구조 변경 0 · 가격·등록·seller 선택 0 ·
운영 코드 0 · UI(제품 화면) 0 · 신규 크롤러 0 · 광범위 재검색 0 · 무제한 재시도 0
🟢 수집은 **운영 추출기 하나**(`factsFromProductUrl`) · **22개 URL 한정** · HTTP 24
🟢 원문과 정규화 **분리** — `descriptionRaw`(원문) ↔ 발췌·정규화는 별 칸
🟢 계약 3 · 데이터 변이 **7종 전부 FAIL → 복구 PASS**
```

**완료 기준 대조** — CEO 가 후보 URL 을 열지 않고도 ⒜ 원상품과 후보의 브랜드·품번·상품명을
**한 행에서** 보고 ⒝ 후보 상세설명의 **실제 원문 발췌** 를 보고 ⒞ 기존 자동 판정·blocker 를
보고 ⒟ 그 자리에서 판정을 입력할 수 있다. 🔴 단 **이미지는 링크** 이고 **국내 후보는 0** 이다.
