# CEO Ground Truth **원장** — 2026-11-08 세션 육안 판단 9건

> 🔴🔴 **이 문서는 «데이터 원장» 이고 작업 좌표가 아니다.** 진입점은 `docs/START-HERE.md` ·
> CTO 좌표는 `docs/CTO-HANDOVER-NEXT.md` 다. 🔴 **두 번째 진입점으로 쓰지 않는다.**
>
> 🔴 **DB 에 적재하지 않았다**(CPO 지시). `ceo_judgments` INSERT **0** ·
> `candidate_reviews` 변경 **0** · migration/RPC **0** · 기존 CEO 판단 수정·삭제 **0** ·
> CEO 판단을 Matcher 규칙으로 변환 **0**.
> 🟢 DB 기록은 **별도 설계·승인 대상** 이다(`docs/CEO-GT-IMPORT-SPEC.md` 가 그 명세의 선례다).

---

## 0. 🔴 이 원장을 만든 이유 — **유실 위험**

```
대표님이 2026-11-08 세션에서 **사유까지 포함해** 판단을 주셨다.
🔴 그런데 그 판단이 **어디에도 저장되지 않았다**:
   `ceo_judgments`            **0행**(DB 실측 · 내 검증 행도 정리됨)
   `ceo_judgment_axes`        **0행**
   `candidate_reviews.human_note`  **0행**(칸은 있고 내용이 없다)
⟹ 🔴 세션이 닫히면 사라진다. 그래서 **문서로 먼저** 보존한다(CPO P0).
🟢 기존 CEO 판단은 별개로 **살아 있다** — `candidate_reviews` **38행**
   (SAME 22 · DIFFERENT 15 · SIMILAR 1). 🔴 이 원장은 그것을 **대체하지 않는다**.
```

## 0-B. 🔴 읽는 규칙 — **네 칸을 섞지 않는다**

```
🔵 CEO 원문      대표님이 «직접» 쓰신 문장. 🔴 한 글자도 바꾸지 않았다
🟡 CTO 해석      내가 저장 데이터와 대조한 결과. 🔴 **판단이 아니다**
🟢 현재 MI 판정   운영 함수 산출(측정값). 🔴 비면 **미확인** 이고 0 이 아니다
🔴 차이          CEO 판단 ↔ 현재 MI 판정이 갈리는 지점
```
🔴 **명시되지 않은 verdict 를 확정하지 않았다** — 「동일 및 유사」는 **그대로** 적고
`SAME` 으로 좁히지 않았다.

---

## 1. 원장 — 9건 (CPO 지시서 1-1 대상)

### C14 · `kihanan.com`
```
🔵 CEO 원문   「c14는, 후보상품 상품명에 브랜드와 품번이 있음」
🟡 CTO 해석   후보 title = `★DROP2★2026AW★BOBOCHOSES ボボショーズ B.C. Embossed
              tracksuit jacket B226AC117` — 브랜드·품번 **둘 다 문자열로 확인**
🟢 현재 MI    기존 fixture `PRESUMED_SAME` · 재캡처 `PRESUMED_SAME`
              blocker **`BRAND_UNCONFIRMED`** · corePoints **6/5** ·
              품번 `codeAfterFill = B226AC117`(제목에서 복구됨) · description 362자
🔴 차이       CEO = 동일 근거 충족 ↔ MI = **원상품 brand 가 null** 이라 보류
              🔴 후보 brand 는 **있다**(`BOBOCHOSES ボボショーズ`)
```

### S1-4 · `kolkid.ca`
```
🔵 CEO 원문   「s1-4는, 소재, 상품명 비교하면 동일 판단 가능, 그리고 evidence로는 가능성이
              있어, 이미지 경우 100% 판단 가능」
🟡 CTO 해석   후보 `materialText` = `Heather grey t-shirt Organic Cotton 100% Loose fit
              Responsibly made in Portugal …` · 후보 이미지 **2장** 보유
🟢 현재 MI    `PRESUMED_SAME`(기존·재캡처 동일) · blocker **`FIT`** · corePoints **7/5** ·
              description 104자 · 품번 `null`(복구 안 됨)
🔴 차이       CEO = 동일 ↔ MI = `FIT` 보류
🔴🔴 **이미지 축을 가른다**(CPO 지시 1-2):
   ⒜ 대표님이 **이미지를 실제로 검토하셨다** — 🟢 사실
   ⒝ 그 이미지 근거가 **시스템 SAME 판정에 반영되는가** — 🔴 **반영되지 않는다**
      `IMAGE` 축은 `corePoints` 에서 **제외** 되고(`cross-seller.ts:1319`)
      `STANDARD-V1.md §2.2` 가 「SAME 정원에서 제외」로 고정했다
   ⟹ 🔴 ⒜ 를 ⒝ 로 읽지 않는다. 이미지 축 반영은 **표준 개정 사안** 이다
```

### S2-3 · `bobochoses.com`
```
🔵 CEO 원문   「s2-3, s2-4, s1-7은, 키즈와 베이비 차이이며, 동일제품이긴 함 연령이 다른데
              이정도면 동일 및 유사로 봐도됨」  (세 건 공용 문장)
🟡 CTO 해석   후보 품번 `B226AB040`(AB=baby) ↔ 원상품 `B226AC009`(AC=kids)
🟢 현재 MI    `PRESUMED_SAME` · blocker **`MODEL_CODE_AGE_LINE` + `FIT`** · core **6/5** ·
              description 81자 · 품번 복구 🟢(상세설명에서 `B226AB040`)
🔴 차이       CEO = 동일 **또는** 유사 허용 ↔ MI = 보류
🔴 **SAME 을 요구하신 것이 아니다** — 「동일 및 유사로 봐도됨」을 그대로 보존한다
```

### S2-4 · `kids21.com`
```
🔵 CEO 원문   (위 S2-3 과 **같은 문장** · 세 건 공용)
🟡 CTO 해석   🔴 **기전이 다르다** — 기존 fixture 의 품번이 `700005621LBL` 로
              **kids21 판매처 자체 SKU** 였다(브랜드 품번이 아니다)
🟢 현재 MI    기존 `PRESUMED_SAME`(blocker `MODEL_CODE_AGE_LINE`) →
              🟢 재캡처 **`SAME`** · blocker **없음** · core **5/5** · 품번 `null`
              ⟹ 자체 SKU 승격이 **사라졌다**
🔴 차이       🟢 **현재는 CEO 판단과 일치한다**(재캡처 기준)
🔴 단 그 변화를 「개선」으로 확정하지 않는다 — 분모 18/22 · FP 검증 분모 0(CPO 판정)
```

### S1-7 · `bobochoses.com`
```
🔵 CEO 원문   (위 S2-3 과 **같은 문장** · 세 건 공용)
🟡 CTO 해석   후보 품번 `B226AB046`(AB) ↔ 원상품 `B226AC010`(AC)
🟢 현재 MI    **`CONFLICT`** · conflicts **`MODEL_CODE`** · corePoints **0** ·
              🔴 품번 충돌로 **조기 반환** 되어 축이 하나도 세지 않는다 · description 89자
🔴 차이       CEO = 동일 또는 유사 ↔ MI = **충돌(다른 상품)**
🔴 세 건 중 **가장 멀다** — 보류가 아니라 충돌이고, 그 자리는 `cross-seller.ts` 의
   조기 반환이다(WU-143 이 되돌린 지점 · false SAME 13건 **구성 미기록**)
```

### C27 · `beaumonde.co.kr`
```
🔵 CEO 원문   「c27은, 상품명에서 영문/한글 차이임 품번 코드도 상품명에 드러가있음」
🟡 CTO 해석   후보 title = `보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010`
              — 「보보쇼즈」(브랜드) + `B226AC010`(품번) **둘 다 제목에 있다**
🟢 현재 MI    기존 `PRESUMED_SAME`(blocker `BRAND_UNCONFIRMED` · core 2) →
              🟢 재캡처 **`SAME`** · blocker **없음** · core **2 → 5** ·
              품번 `codeAfterFill = B226AC010` · 🟢 **브랜드도 복구됨**(`null → Bobo Choses`)
🔴 차이       🟢 **현재는 CEO 판단과 일치한다**(재캡처 기준)
🔴 그런데 재캡처에서 `descriptionLen` 이 **null** 이다 ⟹ 근거는 **제목 경로** 다
```

### S1-1 · `www.rboutique.com`
```
🔵 CEO 원문   「s1-1은, 후보상품에서 상세정보에 Description … 동일 구분이 드러가 있음」
🔵 **원문 보존**(대표님이 붙여 주신 그대로):
   Description
   Details
   Model code: B226AC010
   Color code: 041
   Season: FW26
   Material: 100% CO
   Made in: Portugal
   Sku: 38533
   Color: Grey
   Brand: BOBO CHOSES
🟡 CTO 해석   후보 title 에는 품번이 **없다**(확인) ⟹ 근거는 **상세정보에만** 있다
🟢 현재 MI    기존 fixture `SIMILAR` · corePoints **1/5** · blocker 없음 ·
              🔴 재캡처 **측정 불가** — HTTP **429 `local_rate_limited`**(즉시·지연 재시도 모두 실패)
🔴 차이       CEO = 동일(상세정보 근거) ↔ MI = `SIMILAR`
🔴 **현재 운영이 그 상세정보를 읽는지 «확인되지 않았다»** — 429 로 막혀 미확인이다.
   🔴 「읽지 못한다」로 적지 않는다
```

### S2-1 · `www.stockmann.ee`
```
🔵 CEO 원문   「s2-1는 동일상품 상세정보에 드러가 있음」
🔵 **원문 보존**(대표님이 붙여 주신 그대로 · 에스토니아어):
   Tooteinfo
   See pikkade varrukatega pluus on valmistatud pehmest mahepuuvillast, mis tundub lapse
   naha vastas meeldiv ja on hästi hingav. Vaba lõikega mudelil on ümar kaelus. Esikülge
   kaunistab lõbus käsitsi joonistatud stiilis trükk, kus karvane koletis ja rõõmus tegelane
   kallistavad teineteist. Mänguline muster lisab igapäevasele riietusele rõõmsat ilmet.
   Mahepuuvill teeb pluusi vastupidavaks ja mugavaks.

   Materjal                100% puuvill
   Hooldusjuhendid         Masinpesu 30° C
   Värv                    451 LIGHT BLUE
   Tootjamaa               PORTUGAL
   Valmistaja tootenumber  B226AC009
   Tootja                  Bobo Choses
   Tootja aadress          Bobo Choses Headquarters. C / Jaume Balmes, 14, 08301 Mataró
                           (Barcelona), Spain
   Digitaalne aadress      https://bobochoses.com/pages/contact
   Märksõnad               bobo choses, trikoosärk, pikkade varrukatega särk,
                           orgaanilisest puuvillast särk, laste särk
🟡 CTO 해석   라벨이 에스토니아어(`Valmistaja tootenumber`)지만 값 `B226AC009` 는
              승인 품번 패턴(`B\d{3}[A-Z]{2}\d{3}`)에 **들어맞는다** ⟹ 언어 무관
🟢 현재 MI    기존 `SIMILAR` · 재캡처 **`SIMILAR`**(status OK) ·
              corePoints **0/5** · blocker **없음** · 품번 **`null`** ·
              🟢 `description` **398자 공급됨** · `evidence` 🟢 보유
🔴🔴 차이 — **이 건이 MI-2 의 가장 중요한 증거다**
   `description` 이 **398자 왔는데 품번이 복구되지 않았다.**
   🔴 대표님 원문의 사양 표(`Valmistaja tootenumber B226AC009`)는 **윗단 산문 분량과
      맞지 않는다**(산문만으로도 약 400자다) ⟹ 🟡 **가설**: 운영이 읽는
      JSON-LD `@type=Product` 의 `description` 에는 **산문만** 들어 있고
      **사양 표는 그 블록 밖** 에 있다.
   🔴 **단정하지 않는다** — 재캡처 산출에 `description` **원문을 저장하지 않았다**
      (길이만 저장했다 · 내 하니스 한계) ⟹ **미확인**
```

### S3-1 · `www.stadtlandkind.ch`
```
🔵 CEO 원문   「s3-1 동일상품이지만, 판단 기준이 없음 유사상품으로 판단이 가능하면 노출하고
              아니면 제거해도됨」
🟡 CTO 해석   후보 품번 **없음** · `materialText` **없음** · 이미지 **0장** ·
              title `UV Sonnenhut Curious Turnip Green`(독일어)
🟢 현재 MI    기존 `SIMILAR` · corePoints **1/5**(COLOR + TITLE 1점) ·
              🔴 재캡처 **측정 불가** — HTTP **429**
🔴 차이 — **둘을 갈라 적는다**(CPO 지시 1-2)
   ⒜ 대표님 판단 = **동일 상품** 🟢
   ⒝ 시스템 근거 상태 = **부족**(축 1/5 · 품번·소재·이미지 전무) 🔴
   ⟹ 🔴 ⒝ 를 「대표님 판단이 틀렸다」로 읽지 않는다. **근거가 없다** 가 정확하다
🟡 대표님이 **제거를 허용** 하셨다 — 🔴 노출/제거 결정은 **제품 정책** 이고 CTO 가 정하지 않는다
```

---

## 2. 🟡 추가 기록 — **지시서 9건 «밖»**(같은 세션 · 같은 유실 위험)

🔴 CPO 지시서 1-1 목록에는 없지만 **같은 세션에서 대표님이 내리신 판단** 이라 함께 보존한다.
🔴 **9건과 섞지 않는다.**

```
① C11 · C48 · C37     🔵 「4. G-3 부분 Shadow — 동일상품으로 바뀐 3건 * 모두정상」
                      🟢 현재 MI — 셋 다 `PRESUMED_SAME` · blocker `BRAND_UNCONFIRMED` ·
                         corePoints 7 · 11 · 7
                      🔴 **부분 Shadow 에서만** SAME 이고 **운영 반영 0** 이다
② C19 · C20           🔵 「c19, c20 는 제외 브랜드 메인스토리라 제외함. 나머지는 정상」
                      🔵 「5. … main story 는 모두 제거 (판단 불필요)」
                      🟢 이것이 **공식 평가 분모 22쌍**(Main Story 6쌍 제외)의 근거다
                      🔴 그리고 그 둘이 「품번 exact + human DIFFERENT」 2건이었으므로
                         **FP 검증 분모가 0 이 됐다**(CPO 확정)
```

---

## 3. 🔴 불명확 · 추가 확인 필요

```
① S2-1  `description` 398자가 왔는데 품번 미복구 — **원문 미저장** 이라 원인 미확인
        🔵 확인 방법 = 그 페이지의 JSON-LD `description` 원문 확보(🔴 fetch 필요 · 현재 429)
② S1-1 · S3-1  HTTP **429** 로 재캡처 측정 불가 ⟹ 대표님 판단을 **평가에 넣을 수 없다**
③ S1-4  이미지 근거의 시스템 반영 — 🔴 **표준 §2.2 가 SAME 정원 제외로 고정** ⟹ 표준 개정 사안
④ S2-3 · S2-4 · S1-7  「동일 **및 유사**」의 제품 정책 해석 — 🔴 CTO 가 좁히지 않았다
⑤ S1-7  품번 충돌 조기 반환 — WU-143 false SAME **13건의 구성이 기록에 없다** ⟹ 대조 불가
⑥ 🔴 이 원장의 **DB 적재 여부 · 적재 형식**(`ceo_judgments` ↔ `candidate_reviews.human_note`)
   — **미승인** 이다
```

---

## 4. 🟢 변경 통제

```
DB INSERT/UPDATE/DELETE   **0**      migration · RPC            **0**
`candidate_reviews` 변경   **0**      기존 CEO 판단 수정·삭제      **0**
GT fixture 변경            **0**      Matcher 규칙 변환           **0**
운영 코드 변경              **0**      커밋 · 배포                 **0**
🟢 이 문서 **신규 생성** 하나뿐이다 · 기준 HEAD `ec823158`
```
