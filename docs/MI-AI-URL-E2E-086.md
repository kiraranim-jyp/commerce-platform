# WU-086 — 외부 AI 후보 URL → 국내 가격비교 E2E (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「Registry 추가 ❌ · 8축 완화 ❌ · `matchTruth`/`priceTier`
> 임의 주입 ❌ · AI 의 SAME 판단을 evidence 로 ❌ · 검색엔진 ❌ · SSG 수정 ❌」

---

# WU-086 FINAL

## 0. 결론 — 🟢🟢 **GO · 경로는 «이미 존재하고 작동한다» · 코드 변경 0**

```
외부 AI 답변(산문)
   → A 우리 시스템이 URL 추출            🟢 발견 11 → **통과 8**
   → B Registry 에 없어도 후보로 전달     🟢🟢 **Registry 참조 «코드» 0**
   → C 우리 fetch / evidence 검증         🟢 usable 후보 **6** · provider 호출 **0**
   → 우리 MI 판정 · 시장 분류             🟢 KR 4 · UNKNOWN 2
   → 국내 가격 자격                       🟢 **market KR + KRW 4건**
```

🔴 CPO §5 의 「코드 변경 0 도 정상적인 결론」에 해당한다.

---

## 1. ① AI URL 추출 — 🟢 **된다**

🔴 **URL 을 지어내지 않았다** — WU-073 표본에서 **AI 가 실제로 낸** 한국 쇼핑몰 URL
(feelway · beaumonde · donokids · biskuit · miniboutique · littleluna)을 **AI 답변 산문**
형태로 다시 넣었다(「1. 판매처 … — https://…」 섞인 문장).

| | 건수 |
|---|---:|
| 문장에서 발견 | **11** |
| 🟢 **통과** | **8** |
| 🔴 탈락 | 3 — 전부 `NOT_PRODUCT_PAGE` |

탈락 3건은 **홈/카테고리/쿠팡 스토어** 다:
```
🔴 beaumonde.co.kr/                      (홈)
🔴 shop.coupang.com/beaumondekr?ocid=…    (스토어)
🔴 biskuit.kr/category/𝐁𝐎𝐁𝐎-𝐂𝐇𝐎𝐒𝐄𝐒/70/    (카테고리)
🟢 **정확한 차단** 이다 — 상품 페이지가 아니다.
```

## 2. ② Registry 미등록 URL 처리 — 🟢🟢 **코드가 Registry 를 보지 않는다**

전수 grep(코드 기준 · 주석 제외):

| 파일 | Registry 참조 |
|---|---:|
| `ai-answer-urls.ts` | **0** |
| `ai-answer-pool.ts` | **0** |
| `url-candidate-pool.ts` | **0** (「Registry」 2회는 **주석**) |

🟢 그 주석이 설계를 직접 말한다 —
> 「소비자(`run-domestic-price-check` 의 일시 분기)는 **Registry 를 요구하지 않는다**」

🔴 그리고 실측으로도 확인했다 — 탈락 사유에 **Registry 계열이 하나도 없다**
(`UNREACHABLE` 2건뿐 · 계약으로 잠갔다).

## 3. ③ 후보 전달 — 🟢

```
suppliedUrls 8 · acceptedUrls 8 · **usableProductUrls 6** · miEligibleCandidates 6
dropped 2 (feelway ×2 · UNREACHABLE) · **providerCalls 0** · fetchCalls 8
```

🔴 **내가 1차에 라벨을 틀렸다** — `searchResults.length`(=4)를 「통과 4」로 적었는데
그것은 **도메인 묶음 수** 다. 후보 수는 **6** 이다. 🟢 계약을 `usableProductUrls` 로 고쳤다.

## 4~6. ④⑤⑥ fetch / market / 가격 자격

| 판매처 | code | 가격 | priceStatus | market | basis |
|---|---|---|---|---|---|
| **miniboutique.co.kr** | **`B226AC112`** | **₩108,000** | VERIFIED_CURRENT | **KR** | `KR_TLD_AND_KRW` |
| miniboutique.co.kr | null | ₩117,000 | VERIFIED_CURRENT | **KR** | `KR_TLD_AND_KRW` |
| biskuit.kr | null | ₩88,000 | VERIFIED_CURRENT | **KR** | `KR_TLD_AND_KRW` |
| littleluna.co.kr | null | ₩117,000 | VERIFIED_CURRENT | **KR** | `KR_TLD_AND_KRW` |
| donokids.com ×2 | null | ₩117,000 / ₩134,000 | VERIFIED_CURRENT | UNKNOWN | `KRW_WITHOUT_DOMAIN_EVIDENCE` |

🟢 **market KR + KRW 가격 = 4건.**
🟢 `donokids` 가 UNKNOWN 인 것은 **올바르다**(`.com` + KRW · WU-051/077 계약).

## 7. ⑦ UI 노출

🟢 그 뒤 경로는 **WU-081/082 가 이미 열었다** —
`domesticReference`(국내 참고가격) · 🇰🇷 **국내 후보 검토** 구역 · 자동 1회차 응답 전달.
🔴 **이 WU 는 UI 를 다시 재지 않았다**(그 축은 WU-081/082 가 마운트 DOM 으로 잠갔다).

## 8. ⑧ 실제 B226AC112 결과

🟢🟢 **AI 가 낸 URL 에서 출발해 `B226AC112` 가 품번까지 확인되고 ₩108,000 KRW · KR 로
국내 가격 자격에 도달했다.** WU-085 의 「직접 입력」 결과가 **AI 경로에서 재현됐다.**

## 9. ⑨ 코드 변경 — **0**

```
운영 코드 변경 0 · Registry 0 · 8축 0 · matchTruth/priceTier 주입 0 ·
AI API 0 · 검색엔진 0 · Smallable 특수처리 0 · SSG classifier 0 · 배포 0
```

## 10~12. regression / typecheck / build / production

```
apps/admin  **595 files / 8,333 passed** / failed **0** (skipped 104)
typecheck **0** · build **exit 0** · Production **200**
🟡 HTTP 약 10 요청(read-only) · provider 호출 **0**
```

## 13. 🟢🟢 **GO** (코드 변경 0)

§5 의 성공 기준 경로가 **전부 존재하고 작동한다**:
```
AI URL → 추출 🟢 → Registry 없이 후보 전달 🟢🟢 → fetch/evidence 🟢
     → MI 판정 🟢 → 시장 분류 🟢 → 국내 가격 자격 🟢(4건)
```

🔴 **「중간에서 버리는 코드」는 발견되지 않았다.** 탈락은 둘뿐이고 둘 다 **올바른 이유** 다:
```
A 단계 3건  NOT_PRODUCT_PAGE — 홈/카테고리/스토어(상품 페이지가 아니다)
B 단계 2건  UNREACHABLE     — feelway 접속 실패(사이트 쪽)
```

---

## 🔴 Known Unknowns

```
① 🔴 **tier 게이트는 이 하니스가 만들지 않았다** — `priceTier` 의 입력은
   `judgeDomesticCandidate` 가 만든다. WU-085 에서 **지어내다 걸렸으므로** 반복하지 않았다.
   ⟹ 「국내 가격비교 UI 에 **실제로** 4건이 뜬다」로 적지 않는다. **자격까지** 다.
② 🔴 CoupleShot · BBambam · Feelway(접속 실패) · Beaumonde 상품 URL · SSG 는
   **B226AC112 의 확인된 URL 을 확보하지 못했다** → 미측정(URL 을 지어내지 않았다)
③ 🔴 AI 답변은 **WU-073 표본의 URL 을 산문으로 재구성** 한 것이다 — 실제 AI 를
   다시 호출하지 않았다(금지). 추출기의 입력 형태는 재현했지만 **AI 품질은 미측정** 이다
④ 🔴 `isRegisteredDomesticShop` 을 **false 로 고정** 했다 — 이 WU 의 요점이 「Registry
   없이 되는가」라서 의도적이다. 운영은 등록부 소속을 **충돌 감지** 에만 쓴다
⑤ 🔴 donokids 2건이 UNKNOWN 인 것은 WU-077 이 「회수 후보 4건」으로 센 바로 그 군이고
   그 완화는 **이미 REJECT** 다
```

## CEO Action — **없음**
