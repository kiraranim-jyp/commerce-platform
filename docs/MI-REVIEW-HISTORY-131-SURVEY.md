# WU-131 §2 — **기존 육안 검토는 어디 있는가** (전수 조사 · 구현 0)

> 🔴 지시서 §2 가 「가장 먼저」로 지정한 조사다. 🔴 **운영 코드 변경 0 · DB 쓰기 0 ·
> schema 변경 0 · 작업트리 clean.** 🔴 복원 불가한 것을 **지어내지 않았다**(§12).

---

## 1 🔴🔴🔴 핵심 질문의 답 — **GT 는 «테스트 fixture» 에 있고 운영은 그것을 읽지 않는다**

```
위치   apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/*.json
🔴 그 경로는 **테스트 디렉터리** 다 — 운영 코드가 import 하는 곳이 **0** 이다.
🔴 DB 에 review/GT 테이블이 **없다**(public 31개 전수 — `review|gt|judg|human|label` 매칭 **0**).
```

## 2 🟢 동일상품 GT 전수 — **49건** (가치 라벨과 «섞지 않는다»)

| 파일 | 건수 | 키 | 원상품 |
|---|---:|---|---|
| `wu-093-human-gt.json` | 10 | **sku** | `S1`/`S2` (코드 미기재) |
| `wu-111-human-gt.json` | 2 | url | B226AC010 |
| `wu-112-human-gt.json` | 27 | url | B226AC010 / B226AC009 |
| `wu-116-human-gt.json` | 1 | url | B226AC010 |
| `wu-125-human-gt.json` | 9 | url | B226AC010 / B226AC009 |
| **합계** | **49** | url 39 · sku 10 | — |

```
판단별   SAME **28** · DIFFERENT **19** · UNCERTAIN **2**
고유 URL **37**
```

🔴🔴 **`wu-099`(26) · `wu-100`(26) 은 이 49 에 «넣지 않았다»** — 그 둘은
`USEFUL / NOISE / UNSURE` 라는 **「후보로서 가치가 있는가」** 라벨이고
**SAME/DIFFERENT 판단이 아니다**. 합치면 분모가 거짓이 된다.

## 3 🔴🔴 **연결 가능 범위 — 지시서 §5 가 요구한 지표**

```
원상품별   B226AC010 **21** · B226AC009 **18** · 「S1/S2」만 적힌 것 **10**

🟢 B226AC009 **18건**  → 스냅샷이 DB 에 **있다**(90a3c2fe-…) ⟹ **연결 가능**
🔴 B226AC010 **21건**  → 🔴🔴 **그 상품의 스냅샷이 DB 에 없다**(WU-130 에서 전수 검색 확인)
                        ⟹ **붙일 원상품 자체가 없다.** 원상품을 먼저 만들어야 한다
🔴 wu-093 **10건**     → 원상품이 「S1/S2」 로만 적혀 있고 키가 **판매처 자체 SKU**
                        (`76A7D-L30-05` 등 looxloo 재고번호)
                        ⟹ 🔴 **보고서를 읽어 원상품을 확정하기 전에는 붙이지 않는다**(추측 금지)
```

🟢 **즉 지금 당장 화면에 복원할 수 있는 것은 `B226AC009` 의 18건이다.**
🔴 나머지 31건은 「데이터가 없다」가 **아니라** 「붙일 원상품이 없다/미확정」이다 — **다른 사실**이다.

## 4 🔴 왜 현재 상품 화면에서 안 보이는가 — **원인이 넷이고 전부 다르다**

```
⒜ GT 가 **테스트 fixture** 에 있다 — 운영이 읽는 경로가 **0**
⒝ WU-081 의 셀러 판단이 **`useState({})` 뿐** 이다
   (`DomesticPriceIntelligencePanel.tsx:2648` · `handleDomesticReview` 는 `fetch` **0회**)
   ⟹ 🔴 **새로고침하면 사라진다.** 설계가 그랬다(「시스템 판정을 덮지 않는다」가 당시 목표였다)
⒞ 후보 자체가 **transient** 라 저장되지 않는다(일시 shopId 가드 · WU-024/130)
   ⟹ 🔴 이번 검색에 다시 안 걸리면 **후보가 사라진다** — 지시서 §3-B 가 지적한 그것
⒟ **DB 에 담을 칸이 없다** — review/GT 테이블 0
   🔴 `domestic_product_links.verified` 는 **「관리자 승인」** 이고 SAME/DIFFERENT GT 가 **아니다**
      (029 주석: 「REVIEW_REQUIRED 후보를 직접 확인하고 승인한 경우」 — 가격 수집 자격이다)
```

## 5 🔴🔴 **선행 조건 — migration 적용은 «자동이 아니다»**

```
`prisma/migrations` 에는 **init 하나뿐** 이고 실제 schema 는 `migrations_manual/` **79개** 다.
package.json 에 그것을 적용하는 스크립트가 **없다** ⟹ **사람이 손으로 돌린다.**

🔴🔴 그리고 **밀린 것이 실재한다**(DB 실측):
   sourcing_candidates(075) 🟢 · price_alerts(039) 🟢 · domestic_product_links 🟢
   🔴 **commerce_egress_events(078) «없음»**
⟹ 🔴 새 테이블을 만들고 **적용하지 않은 채 배포하면 화면이 깨진다**(부분 구현 금지 원칙).
```

🟢 **권한은 확인했다**(read-only 조회 · DDL 실행 **안 함**):
```
current_user = **postgres** · has_schema_privilege(CREATE) = **true** · INSERT = **true**
```
🔴🔴 **그러므로 메모 `production-secrets-are-write-only` 의 「CTO 는 운영 DB 에 쓸 수 없다」를
   정정한다** — service-role **키** 는 없지만 `DATABASE_URL` 로는 **쓸 수 있다**.
🔴 그래서 이것은 **Production schema 변경** 이고 헌장 §3 의 STOP 과 맞닿는다.
   🟢 단 WU-131 지시서가 영속화를 **명시적으로 요구** 했고(§11 「local state only 금지」)
   이 리포에 같은 방식의 선례가 **79건** 있다 ⟹ **승인 범위 안** 으로 읽는다.

## 6 🟢 확정 설계 (다음 실행이 그대로 쓴다 · 🔴 이번에 구현하지 않았다)

```
⒜ migrations_manual/079_candidate_reviews.sql  — 🔴 **새 테이블 하나만**
   candidate_reviews(
     id uuid pk, workspace_id uuid, snapshot_id uuid references product_snapshots,
     origin_code text,                     -- 🔴 스냅샷이 없는 GT(B226AC010)를 담을 자리
     candidate_url text not null,          -- 🟢 정규화 키 = canonicalizeProductUrl
     candidate_domain text, candidate_title text, image_url text,
     price_amount numeric, price_currency text,
     system_verdict text, system_match_truth text, system_price_tier text,
     system_blockers jsonb,                -- 🔴 MI 근거를 «그대로» 보존(판단 덮어쓰기 금지)
     human_verdict text check (human_verdict in ('SAME','SIMILAR','DIFFERENT','UNDECIDED')),
     human_note text, source text,         -- OVERSEAS_AUTO | DOMESTIC_REGISTRY | SELLER_URL | GEMINI | GT_IMPORT
     market text, first_seen_at, last_seen_at, reviewed_at
   )
   unique (snapshot_id, candidate_url)  🔴 같은 후보가 매 조회마다 쌓이지 않게
⒝ GET/POST /api/price-history/[id]/candidate-reviews   (읽기 · 판단 저장)
⒞ UI — 후보 카드에 **4상태**(🟢동일 · 🟡유사 · 🔴다름 · ⚪보류) ·
   구역 둘: **A 이번 자동검색 후보** / **B 📚 이전에 확인한 후보**(이력)
   🔴 국내/해외가 **같은 카드·같은 판단 체계** 를 쓴다(§8)
⒟ GT 시딩 — `GT_IMPORT` 로 **B226AC009 18건** 먼저. 🔴 나머지 31건은 §3 사유를 기록한 채 보류
```

🔴 **보존 원칙(§6)** — `system_*` 와 `human_verdict` 는 **다른 칸** 이고 서로 덮지 않는다.
🔴 **이번 WU 에서 MI 가 그 판단을 학습하거나 판정 규칙을 바꾸지 않는다**(§7).
🔴 **가격은 참고 표시만**(§9) — `priceStatus`·집계·alert **전부 HOLD**.

## 7 🔴 용량 판단 (헌장 §4-B) — **착수 전에 적는다**

```
남은 실행 = migration 작성 + **적용** + API 2 + UI(4상태·이력·국내/해외) + GT 시딩 49건
            + 계약 + 음성대조 + 회귀(8,438) + build + 배포 + E2E
🔴 이 세션의 남은 용량으로 **끝까지 갈 수 없다.** §4-B: 「작업트리를 더럽힌 채
   중간에 끊기는 것이 가장 나쁘다」 ⟹ **조사·설계까지만** 하고 작업트리를 clean 으로 둔다.
🟢 그리고 지시서 §2/§5 가 요구한 **조사와 지표는 이 문서로 충족됐다** —
   그 결과가 설계를 **바꿨다**(B226AC010 21건은 붙일 원상품이 없다 · migration 이 수동이다).
```
