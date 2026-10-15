# WU-022-5-1 완료 보고 — GT worklist 전건 종결

## 1. 실행 범위
```
기존 worklist **66행**(고유 64) · 추가 Search **0** · 추가 후보 **0** · 추가 HTTP **0**
🟢 기존 factsStatus/observedTitle/miRaw 만으로 전건 판정 — 후보 페이지 재조회 0
```

## 2. GT — 🟢 **미부여 0**
```
신규 부여 64 =  SAME **8** · DIFFERENT **17** · UNVERIFIED **22** · UNREACHABLE **17**
기존 라벨 26 과 합쳐 GT 파일 SAME/DIFFERENT **51** · GT 조인 행 **60**
🔴 UNVERIFIED·UNREACHABLE 을 DIFFERENT 로 강제하지 않았다 — 정상 GT 상태이고
   KPI 분모에서 «정당하게» 빠진다. 🔴 「미부여」와 구분된다(미부여 = 0).
🟢 gtToken 불일치 **0** · GT 거부 **0**
```
🔴 판정 규칙(AI·MI 미사용 · 관측 제목만): **SAME** = 품번 in 제목 OR 고유 디자인명+품목(+색상)
완전일치 · **DIFFERENT** = 다른 품번/색상/품목/baby 가 제목에 적극적으로 드러남 ·
**UNVERIFIED** = 열렸으나 식별 증거 없음(샵이름·깨진 제목) · **UNREACHABLE** = 읽기 실패.

## 3. AI Search Discovery (`cto-websearch` · URL 입력)
```
후보 **65** · known-positive **3/5** · 후보 0 상품 **없음**
🟢🟢 **신규 true-SAME 21건** (GT SAME 고유 24 = known-positive 3 + 신규 **21**)
🔴 「Recall」로 적지 않는다 — known-positive 는 하한이다
```
🟢 **Registry 밖 GT SAME 도메인**(등록부에 없던 곳): `tinyapple.net` · `global.trenbe.com` ·
`kihanan.com` · `biskuit.kr` · `m.luxboy.com` · `donokids.com` · `m.web.mustit.co.kr` ·
`beaumonde.co.kr` · `blanchou.ca` · `main-story.com` · `tinybebe.com.au` · `bobochoses.co.jp`
🔴 **Registry 에 추가하지 않았다** — 이번 WU 는 발견 «가치» 만 잰다.

## 4. 모델별 (🔴 입력 조건이 달라 합산·우열 금지)
| 모델 | 입력 | 후보 | GT행 | SAME | DIFF | strict Acc | False SAME |
|---|---|---:|---:|---:|---:|---:|---:|
| **cto-websearch** | **URL** | **65** | 32 | **15** | 17 | 0.72 | 8 |
| claude | 품번 | 17 | 13 | 9 | 4 | 0.85 | 2 |
| gemini | 품번 | 9 | 6 | 5 | 1 | 0.83 | 1 |
| gpt | 품번 | 10 | 9 | 4 | 5 | 0.67 | 3 |

🔴 strict Acc 의 주어는 **MI** 다. AI 정확도가 아니다. 분모·난이도가 달라 우열을 말하지 않는다.

## 5. MI (n=60)
| 축 | Accuracy | Precision | **False SAME** | missed |
|---|---:|---:|---:|---:|
| strict | 0.750 | 0.696 | 🔴 **14** | 1 |
| threeWay | 0.733 | 🟢 **1.000** | 🟢 **0** | 16 |

🟢🟢 **n=17 → 28 → 60 으로 표본이 세 배 넘게 커지는 동안 `threeWay` 의 False SAME 은
계속 0 이다.** 🔴 「`PRESUMED_SAME` → SAME 승격」은 세 번 연속 반대됐다.

## 6. S4 (AW26MS185 / Grey Melange) — 13 후보
```
GT SAME 4      Grey Melange ×4 (junioredition · 도노키즈 ×2 · main-story 공식)
               MI: SAME 1 · PRESUMED_SAME 3
GT DIFFERENT 9 Blue Topaz · Chocolate Brown · Rose Shadow → 🟢 MI **CONFLICT**(정답)
               Conker Stripe ×2 · Graystone ×4        → 🔴 MI **PRESUMED_SAME**(False SAME)
```
🔴 갈리는 색상은 여전히 **Conker Stripe · Graystone 둘** 뿐이다. 🟢 색상사전·MI 변경 **0**.

## 7. Shopify Suggest 비교 (🔴 재실행 0 · ALT-3 기존값 인용)
| | Shopify Suggest(ALT-3) | AI Search(`cto-websearch`) |
|---|---|---|
| 후보 수 | **148** | 65 |
| GT 부여 | **11**(MI SAME/PRESUMED 만) | **32** |
| GT SAME | 5 | **15** |
| GT DIFFERENT | 6 | 17 |
| Registry 밖 SAME | ⚪ 미집계 | 🟢 **다수**(§3) |
| known-positive | ⚪ 미측정 | 3/5 |

🔴 **두 숫자를 직접 비기면 틀린다** — ALT-3 은 **148 전수 GT 를 하지 않았고**(11건만),
AI Search 는 후보 집합 자체가 다르다. 🟢 비교 가능한 것은 **성질** 이다:
```
Shopify Suggest  🟢 샵 «안» 에서 많이 — 148. 🔴 Registry 밖으로 나가지 못한다
AI Search        🟢 Registry «밖» 으로 나간다 — 신규 true-SAME 21 · 신규 도메인 12곳
→ 🟢 **두 경로는 경쟁이 아니라 보완이다.**
```

## 8. 실패/미측정
```
SEARCH_FAILURE 0/6 · CANDIDATE_FAILURE 0/6 · CANDIDATES_FOUND 6/6
CRAWL_FAILURE  **17**(UNREACHABLE) · IDENTITY_UNCERTAIN **22**(UNVERIFIED)
🔴 outcome 라벨은 전 모델 **UNLABELED 그대로 보존**했다(§11) — 사후 추측으로 바꾸지 않았다
```

## 9. 결론
```
AI Search Discovery = 🟢 **GO (가치 축)**
  근거 — URL 입력에서 후보 0 상품 없음 · known-positive 3/5 · **신규 true-SAME 21** ·
         Registry 밖 신규 도메인 12곳에서 GT SAME
  🔴 **단 배선은 여전히 STOP**(WU-021). 가치 GO 와 배선 GO 를 섞지 않는다.
Shopify Suggest 대비 = 🟢 **보완재**(대체재 아님)
MI = 🟢 threeWay 축 False SAME 0 유지 → **현 보수 정책 유지**가 데이터로 지지된다
다음 WU 필요 = 🟡 AI Identity(WU-022-4 패킷) — 하니스·패킷은 이미 준비됨
```

## 10. 변경/품질
```
코드 변경 **0** · 문서 **1**(이 파일) · 추가 HTTP **0** · ₩0 · 배포 0
MI/threshold/색상사전/PRESUMED_SAME/Registry/extractor/normalizer/Category/Sourcing — 전부 0
typecheck **0 errors**
🔴 코드 변경이 0 이라 전체 회귀를 새로 돌리지 않았다 —
   **직전 regression PASS(545 files / 7,857) 이며 이번 변경에서 코드 0** 이다.
   「재실행 PASS」로 적지 않는다.
```
