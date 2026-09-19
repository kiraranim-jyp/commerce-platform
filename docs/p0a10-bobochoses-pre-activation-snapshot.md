# P0-A.10 — Bobo Choses 사전 스냅샷 (BEFORE)

CEO 지시(2026-09-18). **SELECT only.** 소스를 켜지 않았고, 코드도 DB도 바꾸지 않았다.

이 문서는 `p0a10-bobochoses-pre-activation-snapshot.json`(32행 전체)의 요약이자 **비교 절차서**다.
`bobochoses.com` 소스를 `enabled=true`로 되돌릴지 결정하기 전에, 되돌렸을 때 **무엇이 얼마나
움직이는지를 숫자로 말할 수 있게** 현재 상태를 고정해 둔다.

## 왜 이 스냅샷이 필요한가

```
bobochoses enabled=false           (2026-09-11 08:35 KST에 이 소스만 따로 꺼짐)
  ↓
기존 링크 32건의 마지막 판정        2026-09-10
  ↓
교차판매처 판정기 배포              2026-09-13   ← 이 32건은 이 판정기를 한 번도 본 적이 없다
  ↓
소스를 켜고 「가격 다시 확인」       → 32건이 새 판정기로 재판정된다
  ↓
match_truth 가 바뀔 수 있고 → priceTierFromLink 가 바뀌고 → 국내 비교가격이 바뀐다
```

즉 활성화는 «측정 장치를 켜는 일»이 아니라 **실제 가격 산출 결과가 움직일 수 있는 재판정**이다.

## 현재 상태 (BEFORE)

| | 값 |
|---|---:|
| 링크 | 32 |
| 고유 URL | 18 |
| **가격 공급 중인 EXACT 고유 URL** | **13** |
| `cross_seller_verdict` 채워진 행 | **0** |

**price_tier** (= `priceTierFromLink` 결과, 실제 가격 경로가 쓰는 값)

| tier | 링크 |
|---|---:|
| EXACT | 27 |
| COMPARISON | 5 |
| EXCLUDED | 0 |

**match_truth**

| 값 | 링크 |
|---|---:|
| EXACT_IDENTIFIER | 23 |
| TEXT_CONFIRMED | 4 |
| SIMILAR | 1 |
| null (030 이전 레거시) | 4 |

> 🔴 **앞선 보고의 「10개」를 13개로 정정한다.** 그때는 `match_truth in (EXACT_IDENTIFIER,
> STRONG_IDENTIFIER)`만 셌는데, 실제 가격 경로(`priceTierFromLink`)는 `match_truth=null +
> verified=true`인 레거시 4행도 EXACT로 취급한다. 가격이 실제로 걸려 있는 수는 **13**이다.

## 되돌아온 뒤 무엇을 비교하는가

`id`가 안정 키다. 활성화 후 같은 쿼리를 다시 떠서 행 단위로 맞춘다.

| 비교 항목 | 바뀌면 뜻하는 것 |
|---|---|
| `cross_seller_verdict` | null → 값 : **측정 장치가 도달했다**(이 작업의 목적) |
| `match_truth` | 재판정으로 판정이 **실제로 바뀌었다** |
| `price_tier` | 🔴 **국내 비교가격 공급이 바뀌었다** — 가장 중요한 칸 |
| `verified` | 자동 검증 결과가 바뀌었다 |
| `match_confidence` | 텍스트 점수가 바뀌었다(재검색으로 후보가 달라졌을 수 있다) |
| `n_obs` / `min_price_krw` | 가격 관측 자체의 변화 |
| `reasons` | 판정 근거 문장. 「사람 확인:」 줄은 upsert가 보존한다 |

**판정 기준**

```
EXACT → COMPARISON/EXCLUDED 로 내려간 URL 수  =  국내 비교가격을 «잃은» 상품 수
그 수가 0 이면 → 활성화는 가격에 영향이 없었고, verdict 만 얻었다 (최선)
0 이 아니면   → 그 차이가 곧 A/B/C 논의에 쓸 «실측 가격 영향» 이다
```

## 이 스냅샷이 답하지 못하는 것

- **왜 껐는지**는 여전히 모른다. `access_status`는 null이고 차단 흔적이 없으며, `last_success_at`
  (2026-09-10 17:26)은 끄기 직전까지 정상 수집 중이었음을 보여준다. 코드에 이 소스를 끄는
  경로는 없다 — 설정 화면 토글(사람) 또는 직접 UPDATE뿐이다.
- 재판정 결과는 **돌려놓을 수 없다.** 소스는 다시 `false`로 되돌릴 수 있지만, 한 번 덮어쓴
  `match_truth`는 이 스냅샷 없이는 복원할 근거가 없다. 그래서 이 파일을 먼저 남긴다.

## STOP

`bobochoses` 활성화는 **CEO 승인 전까지 하지 않는다.**
