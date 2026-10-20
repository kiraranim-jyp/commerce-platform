# 🔴 인수인계 — WU-131 **후보 검토 이력 + 셀러 GT** (CPO 작업지시 2026-10-20)

> 🔴🔴 **새 세션은 이 문서 하나만 읽고 §6 설계부터 «바로 구현» 에 들어간다.** 재조사 금지.
> 🟢 조사는 끝났다 — 전문 `docs/MI-REVIEW-HISTORY-131-SURVEY.md`.
> 🔴 중간 보고 없이 **완료 보고 1회** 만 올린다.

```
시작점   §6 확정 설계 → migration 작성/**적용** → API → UI → GT import
        → E2E → 회귀 → 배포 → 보고 1회
현재     작업트리 clean · origin/main ahead 0 / behind 0 · WU-130 배포 완료(d84d4229)
```

---

## 0. 🔴 이 WU 가 만드는 것은 «새 계층» 이다 (CPO 확정)

> 기존 49건 GT 를 **버리고 새로 만드는 것이 아니라**, 운영에 **없던 「후보 검토 이력」
> 계층** 을 새로 만드는 것이다.

```
원상품 → 🇰🇷 국내 자동검색 + 🌎 해외 자동검색 → 후보 → facts/MI
      → [ 이번 자동검색 후보 ] + [ 📚 이전 검토 후보 ]
      → 셀러 판단(SAME / SIMILAR / DIFFERENT / UNDECIDED) → 검토 이력 보존
🔴 가격 정확도 개선은 이번 WU 에서 **하지 않는다.**
```

## 1. 🟢 전제로 «그대로» 쓰는 확정 사실 (다시 조사하지 않는다)

```
· 운영 DB 에 GT/review 테이블 **없음**(public 31개 전수)
· 기존 Human GT **49건** 은 **테스트 fixture 에만** 있다(운영 import 경로 0)
· **B226AC009 연결 가능** · **B226AC010 은 원상품 snapshot 이 없어 자동 연결 안 함**
· WU-081 review 는 `useState` 뿐 → 새로고침 소멸(`handleDomesticReview` fetch 0회)
· transient 후보는 검색 종료 후 **보존되지 않는다**
· `domestic_product_links.verified` 는 **「관리자 승인」** 이고 Human GT 저장소가 **아니다**
· `migrations_manual` 은 **자동 적용되지 않는다**(사람이 손으로)
🔴 그러므로 **기존 코드를 억지로 재활용하지 않는다.**
```

## 2. 🔴🔴🔴 **완료조건 숫자를 정정한다 — 「18건」이 아니라 「17건」이다**

CPO §10 이 「18건 입력 → 18건 조회 · candidate_url 중복 없음」을 요구했는데,
🔴 **그 둘이 동시에 성립하지 않는다**(2026-10-20 실측):

```
B226AC009 GT **행 18** → 🔴 **고유 candidate_url 17**
중복 1건 — `global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-…`
           (`wu-111` 과 `wu-112` 에 **같은 후보**)
🟢 **판단 상충 0** — 둘 다 `SAME` 이다(그래서 병합이 안전하다 · 임의 선택이 아니다)

⟹ 🟢 기대값(고유 URL 기준) — **17행** · **SAME 13 · DIFFERENT 4**
⟹ 🔴 **UNCERTAIN 0** — §9 의 `UNCERTAIN → UNDECIDED` 매핑은 **이 시딩에서 발화하지 않는다**
   (UNCERTAIN 2건은 **전부 B226AC010** 쪽이고 그것은 §9 대로 **보류** 다)
🔴 그래도 매핑 규칙은 **문서/테스트에 명시** 한다(나중 import 에서 쓰인다).
```

🔴 **보고에 「18건」으로 적지 않는다.** 적는 방식 — 「GT 행 18 → 고유 후보 **17**(중복 1 · 상충 0)」.

## 3. 저장 — `migrations_manual/079_candidate_reviews.sql` **한 테이블**

```sql
snapshot_id · origin_code · candidate_url (UNIQUE 키)
system_verdict · match_truth · price_tier · blockers      -- MI 산출을 «그대로» 보존
human_verdict  -- SAME | SIMILAR | DIFFERENT | UNDECIDED
source         -- OVERSEAS_AUTO | DOMESTIC_REGISTRY | SELLER_URL | GEMINI | GT_IMPORT
first_seen_at · last_seen_at (· reviewed_at)
+ 표시용 — candidate_domain · candidate_title · image_url · price_amount · price_currency · market
```
🔴🔴 **`system_*` 와 `human_verdict` 는 절대 서로 덮지 않는다.**
`system=PRESUMED_SAME` + `human=DIFFERENT` 를 **둘 다 보존** 한다.

🔴 UNIQUE 는 **(snapshot_id, candidate_url)** 로 둔다 — `candidate_url` 단독 UNIQUE 로 하면
**다른 원상품이 같은 판매처 URL 을 가질 때 충돌** 한다(B226AC009/AC010 이 실제로 같은 호스트를 공유).
🔴 단 `origin_code` 만 있고 `snapshot_id` 가 null 인 GT 행(B226AC010 류)을 나중에 넣으려면
그 조합도 유일해야 하므로 **부분 유니크 둘**(snapshot 있는 행 / origin_code 행)로 설계한다.

## 4. 🔴 Migration 은 **실제 적용까지** 한다

```
🟢 권한 확인됨(read-only 조회) — `current_user=postgres` · CREATE **true** · INSERT **true**
   ⟹ `packages/database/.env` 의 `DIRECT_URL`(5432)로 DDL 을 실행한다(pgbouncer 6543 아님)
🔴 **079 만** 적용한다 — `commerce_egress_events`(078) 같은 **기존 누락분을 같이 밀지 않는다**
   (그것은 다른 스프린트의 것이고 이번 범위 밖이다 · CPO §4 명시)
적용 후 실제 DB 로 검증 — table 존재 · columns · unique constraint · index · insert · select
🔴 **적용 전에 배포하지 않는다**(테이블 없이 배포하면 화면이 깨진다 — 부분 구현 금지)
```

## 5. API

```
GET  /api/price-history/[id]/candidate-reviews   이번 자동검색 후보 + 📚 이전 검토 후보
POST /api/price-history/[id]/candidate-reviews   { candidateUrl, humanVerdict } 저장
🔴 인증은 기존 `requireUser()` + 스냅샷 소유권 검사를 **그대로** 쓴다(check/route 선례).
```

## 6. 후보 식별 · UI · 버튼

```
🔴 국내/해외를 **별도 데이터 구조로 만들지 않는다** — 식별 기준은 `snapshot/origin + candidate_url`
🔴 URL 정규화는 **`canonicalizeProductUrl`** 을 쓴다(새 정규화기 금지 · 식별 파라미터 보존)
UI — ① 이번 자동검색(🇰🇷 국내 / 🌎 해외) ② 📚 이전에 확인한 후보(이전 MI · 셀러 판단 · 마지막 확인일)
버튼 **넷** — 🟢 동일상품 · 🟡 유사상품 · 🔴 다른상품 · ⚪ 판단보류
🔴 선택 **즉시 저장** 하고 **저장 성공 여부가 화면에 보여야** 한다
🟢 국내·해외가 **같은 카드 · 같은 판단 체계** 를 쓴다
```

## 7. GT import

```
🟢 B226AC009 — `source = GT_IMPORT` 로 **17행**(위 §2) 시딩
   기존 SAME/DIFFERENT 의미를 **임의 변경하지 않는다** · MI 결과는 `system_*` · 사람은 `human_verdict`
🔴 B226AC010 **21건 보류** — 원상품 snapshot 이 없다(임의 생성 금지)
🔴 wu-093 **10건 보류** — 원상품이 「S1/S2」 이고 키가 **판매처 SKU** 다(추정 연결 금지)
🔴 `wu-099`/`wu-100`(26+26)은 **가치 라벨** 이라 GT 가 **아니다** — 넣지 않는다
```

## 8. E2E (B226AC009) · 반대 테스트 · 독립성

```
진입 → 이번 후보 확인 → 📚 이전 후보 확인 → 기존 GT 판단 표시 확인
→ 새 후보 하나 「동일상품」 → POST 확인 → **새로고침** → 유지 → **재진입** → 이력에서 확인
반대 — 같은 흐름을 「다른상품」으로 1회 더
독립성 — system=PRESUMED_SAME + human=DIFFERENT 가 **둘 다 그대로** · 그 역도 동일
🔴 이번 WU 에서 Human GT 를 **MI 학습/판정 규칙에 반영하지 않는다**
```

## 9. 🔴 범위 밖 / 금지

```
MI 8축 · AI 학습 · 자동 GT 반영 · threshold · 가격 정확도 · priceStatus · priceTier ·
가격 qualification · 시장가격 계산 · alert · 국내/해외 가격 수집 로직 ·
신규 국내 어댑터 · Registry 확대 · 외부 AI/Gemini · snapshot 재사용 구조 ·
**B226AC010 snapshot 임의 생성** · **S1/S2 원상품 추정**
🟢 가격은 후보 카드의 **참고 표시** 만 허용.
```

## 10. 계약 / 회귀

```
신규 — migration 계약 · GET/POST API 계약 · UI 4상태 계약 · GT import 계약 ·
       **refresh persistence 계약** · system↔human 독립 계약
회귀 — 국내 후보 · 해외 후보 · MI · WU-081 · **WU-130**(일시 샵 셋 · sink 경계 · 통합 영역)
전체 regression(기준 **8,438**) · typecheck **0** · build exit 0 · 배포 · Production E2E · clean worktree
```

## 11. 🔴 이 트랙에서 반복된 실수 (먼저 읽는다)

```
🔴 **칸 이름을 추측하지 않는다** — `information_schema` 로 읽고 쓴다(이 트랙 12회 오류)
🔴 **변이가 «적용됐는지» grep 으로 확인한다** — 이 세션에서 `python3` 부재로 치환이 안 됐는데
   테스트가 **통과** 했다(거짓 통과를 그 절차가 잡았다)
🔴 **미커밋 구현 복구에 `git checkout --` 를 쓰지 않는다**(파일 백업 사용)
🔴 **정규식을 쉘/스크립트 문자열로 편집하지 않는다**(백슬래시 소실 · Edit 로 쓴다)
🔴 **하니스가 운영 경로를 그대로 베낀다** — 함수를 직접 부르면 **배선 결함을 못 본다**(소스 앵커 병행)
```

## 12. CEO 최종 확인 (배포 후 **1회**)

> `B226AC009` 를 열어서 ① 🇰🇷 국내 후보 ② 🌎 해외 후보 ③ 후보 하나를
> **동일/유사/다름/보류** 로 판단 ④ **새로고침 후 유지** ⑤ **이전 검토 이력이 보이는가**

🔴 🇰🇷 국내 후보는 **0** 일 수 있다 — WU-130 ②가 그 원인을 **어댑터 부재 12/18** 로 확정했다
(화면·MI 결함이 아니다). 그때도 「조회했지만 후보를 찾지 못했습니다」가 **정상** 이다.
