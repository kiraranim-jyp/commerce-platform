# WU-022-9 완료 보고 — D 안전성 경계 · S5 모델축 원인 분리

## 1. 범위
```
기존 데이터만(022-6/7/8) · 51건 · UNCERTAIN 27건
🔴 새 Search 0 · 새 후보 0 · 새 AI 수집 0 · 외부 API 0 · **HTTP 0** · GT 재작성 0 · 코드 0
```

## 2. Part A — D 3자 비교 (n=51)
| 정책 | Precision | **False SAME** | UNCERTAIN | **GT SAME 손실** |
|---|---:|---:|---:|---:|
| A. MI threeWay | 1.000 | 🟢 0 | **27** | **1** |
| D / cto | 1.000 | 🟢 0 | 18 | **1** |
| D / opus | 1.000 | 🟢 0 | 🟢 **14** | **1** |
| D / haiku | 1.000 | 🟢 0 | 17 | **1** |
| D / 3자 만장일치 | 1.000 | 🟢 0 | 19 | **1** |

🔴🔴 **새로 드러난 사실 — 「GT SAME 손실 1」은 D 가 만든 것이 아니다.**
A(baseline)에 **이미 1건** 있고 네 D 변형 전부 **그대로 1** 이다.
→ 🟢 **D 가 추가로 잃은 진짜 동일상품은 0건** 이다. 그 1건은 MI 가 UNCERTAIN 구간
«밖에서» 이미 DIFFERENT 로 확정한 건이므로 D 의 책임이 아니다.
🔴 WU-022-7·8 에서 이 칸을 따로 세지 않았다 — 이번에 고정했다.

### §4 3자 합의 분해 (27건)
```
S/S/S 14 · **D/D/D 8** · S/D/D 2 · S/D/S 2 · D/D/S 1     (순서: cto/opus/haiku)
3자 만장일치 DIFFERENT **8건** → GT DIFFERENT **8** · 🔴 GT SAME **0**
🔴 불일치 5건(S/D/D·S/D/S·D/D/S)은 **자동 확정하지 않았다** — 생산 정책 결정 0(§4).
```

## 3. §5 — `DIFFERENT → GT SAME` 분모 고정
| 판정자 | **분모 = DIFFERENT 판정 수** | → GT SAME |
|---|---:|---:|
| cto (sonnet) | **9** | 🟢 **0** |
| opus | **13** | 🟢 **0** |
| haiku | **10** | 🟢 **0** |
| 3자 만장일치 | **8** | 🟢 **0** |

🔴 이 「0」의 정확한 의미: **분모 9·13·10·8 에서 0건** 이다. 「0%」나 「안전하다」로 적지 않는다.

## 4. D 보류 감소
```
27 → cto 18(−9) · haiku 17(−10) · 3자 만장일치 19(−8) · **opus 14(−13)**
🟢 안전 지표(Precision 1.000 · False SAME 0 · GT SAME 추가손실 0)를 **깨지 않고** 줄었다
🔴 Accuracy 는 전 변형 0.725 로 고정 — 이 정의에서 `UNCERTAIN + GT DIFFERENT` 를
   이미 「맞음」으로 세기 때문이다. **D 의 이득은 정확도가 아니라 보류 감소다.**
```

## 5·6. Part B — S5 모델축 evidence 전수

| 항목 | 값 |
|---|---|
| 원상품 | PèPè Lulu T-Bar Shoes · 품번 **01195-VERNICE-NERO** |
| 후보 | `225 Pepe Shoes Vernice Nero` · tinyapple.net/products/**225**-pepe-shoes-vernice-nero-2 |
| GT | **DIFFERENT** |
| MI | raw **PRESUMED_SAME** · strict SAME · threeWay UNCERTAIN · factsStatus **OK** |
| cto / opus / haiku | **SAME / SAME / SAME** (3/3 오판) |
| 판정자에게 간 블록 | 원상품 줄에 **「품번 01195-VERNICE-NERO」** · 후보 줄에 **「225 …」** · URL 에도 `225` |

### 🔴🔴 원인이 **MI 와 AI 가 서로 다르다** — 하나로 묶으면 틀린다

```
AI(3자)  → **Case B · 공통 reasoning failure**
  🟢 두 식별자가 **같은 화면에 글자로 둘 다 있었다**(01195 · 225 · URL 의 225).
  🔴 그런데 셋 다 SAME 을 냈다. 브랜드(PèPè)와 색상명(Vernice Nero)이 일치하자
     **숫자 불일치를 넘겼다.** → 증거 부족이 아니라 **추론 실패** 다.
  🟡 단서 하나(단정하지 않는다) — 후보 쪽 `225` 에는 **「품번」이라는 라벨이 없었다**.
     원상품에만 라벨이 있었다. 그래서 **완전한 Case B 가 아니라 「라벨 비대칭이 있는 Case B」** 다.

MI       → **Case A · evidence 부족**
  🔴 후보 제목에 원상품 품번 **「01195」이 없다.** 이 리포의 확정된 동작
     (`confirmBrandCodeInTitle` 은 원본 품번이 후보 제목에 **토큰으로 그대로** 있을 때만
     `brandModelCode` 를 채운다 · 헌장 §12)에 따라 **품번 축이 애초에 생성되지 않는다.**
  → MI 는 브랜드+색상+상품명만으로 판단했고 그 결과가 `PRESUMED_SAME` 이다.
  🔴 **이것은 설계된 보수 동작이고 MI 의 추론 실패가 아니다.**
  🔴 단 「MI 가 225 를 읽었다면 어떻게 됐을까」는 **미측정** 이다(코드 변경 금지).
```

🟢 **그래서 「AI·MI 공통 failure」라는 022-8 의 표현을 정정한다** — 결과는 같았지만
**원인이 다르다**. AI 는 보고도 넘겼고(B), MI 는 볼 수 없었다(A).

## 7. D 판정 — 🟡 **GO 후보 유지**
```
🟢 안전성: 네 변형 전부 Precision 1.000 · False SAME 0 · **GT SAME 추가손실 0**
🟢 독립 모델 반복: 「아니다」 방향이 3자에서 재현(만장일치 8건 전부 GT DIFFERENT)
🟢 판정자 차이는 **보류 감소량** 에만 나타났다(14~19) — **안전 지표는 셋 다 동일**
🔴 그러나 운영 채택 아님 — ⒜ 벤더 독립성 미확보(전부 Anthropic 계열)
   ⒝ 분모 8~13 ⒞ production fallback 구현 **0**(§9)
```

## 8. 모델축 후속 필요성
```
🟡 **필요하다 — 단 AI 쪽만 그렇다.**
   AI 는 「브랜드+색상이 같으면 숫자 불일치를 넘긴다」가 n=3/3 으로 재현됐다.
   🔴 n=1 사례다. 같은 성질의 쌍을 더 모아야 축으로 확정된다 → **UNKNOWN 유지**.
🟢 MI 쪽은 후속이 아니라 **이미 알려진 설계** 다(품번이 제목에 없으면 축이 없다).
🔴 그리고 D 는 이 실패를 **고치지 못하지만 악화시키지도 않는다** —
   세 판정자가 전부 SAME 이라 D 는 그 건을 **UNCERTAIN 으로 남긴다**(False SAME 아님).
🔴 SKU rule·threshold·색상사전·MI·AI prompt **변경 0**(§8).
```

## 9. 변경/품질
```
code **0** · HTTP **0** · AI/API **0** · 새 Search 0 · ₩0 · 배포 0 · 문서 1
ensemble/fallback/MI/threshold/색상사전/PRESUMED_SAME/Category/Sourcing — 전부 0
typecheck **0 errors**
🔴 코드 변경 0 이므로 regression 을 재실행하지 않았다 —
   **직전 regression PASS(545 files / 7,857) · 이번 변경에서 코드 0.**
```

## 10. CEO Action — **NONE**
