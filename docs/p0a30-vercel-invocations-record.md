# Vercel Function Invocation 75% 경고 — 조사 기록 (P0-A.30.4, 종료)

- 일자: 2026-09-20
- 결론: **원인 확인 불가.** 추가 추측·코드 변경 금지(CEO 종료 지시).
- Production: `d6532c3` (이 조사로 바뀐 코드는 없다)

## 확정된 사실

```
최근 12시간 Function Invocation = 22회   (CEO Observability 화면)
   → 이 속도가 유지되면 월 약 1,300회
   → 75만 경고와 현재 사용 패턴이 전혀 맞지 않는다
```

**이것이 이 조사에서 유일하게 강한 증거다.**

## 증거로 «제외» 한 가설

| 후보 | 증거 |
|---|---|
| payload-preview 재호출 | `setTimeout(1200)` + `clearTimeout` + `AbortController` 디바운스 실재 |
| SmartStore validation | 동일하게 디바운스 |
| Cron | `vercel.json` 에 설정 없음 · `/api/cron/*` 라우트 **존재하지 않음**(코드 주석은 낡은 것) |
| server→server `/api` 연쇄 | 0건 |
| `revalidatePath` / `revalidateTag` | 0건 |
| `setInterval` polling | 0건 |
| 정적 asset | `proxy.ts` matcher 가 `_next/static`·이미지 확장자 제외 |
| Image Optimization 한도 | `next/image` 사용 파일 **0개** — 이 한도를 쓰지 않는다 |
| Supabase webhook/callback | 수신 라우트 없음 |

## 🔴 폐기된 논거 — 다음 사람이 다시 쓰지 않도록 남긴다

조사 중 CTO 가 이렇게 썼다:

> 「DB 전체 행이 2,000건 미만이므로 앱 사용으로 75만 호출이 나올 수 없다」

**이 추론은 성립하지 않는다.** `/api/auth/me` · `/api/snapshots` 같은 **읽기 전용
요청은 행을 남기지 않는다.** DB 행수는 「쓰기」의 상한이지 「호출」의 상한이 아니다.
CEO 지적(2026-09-20)으로 폐기했다.

DB 행수는 여전히 «참고» 로는 쓸 수 있다(쓰기 트래픽이 폭주한 적은 없다는 뜻).
그러나 그것으로 호출량을 논증하면 안 된다.

## 확인 «불가능» 한 것

```
과거 기간의 Route 별 호출량   Hobby 플랜의 Observability 보존 한계
계정 단위 집계 여부            Vercel 계정 화면 접근 권한 없음(CLI 인증 없음)
경고가 어느 메트릭인지          Edge Requests 는 Function Invocations 와 별도 집계
```

즉 **「75만이 언제·어디서 발생했는지」는 지금 볼 방법이 없다.**

## 하지 «않은» 것 (CEO 지시)

Pro 업그레이드 · `robots.txt` 추가 · `sitemap.xml` · crawler 차단 ·
proxy matcher 변경 · debounce 변경 · dependency 변경 · API 캐시 추가.

**원인을 모르는 상태에서 한도만 늘리거나 코드를 고치는 것은 해결이 아니다.**

## 다음에 볼 조건

사용량이 초기화된 뒤 **한 번만** 확인한다.

```
천천히 증가          → 종료. 이 문서는 그대로 둔다.
짧은 시간에 수만 급증  → 🔴 즉시 Route 조사 재개.
                        그때는 «실시간 상승 구간» 이라 과거 데이터가 필요 없다.
```

---

# 부록 — E1 / Vision 현재 상태 (같은 시점)

🔴 **「E1 의 선별력이 입증됐다」고 적지 않는다.** 표본이 작고 Vision 호출이 12회뿐이라
threshold 를 정할 근거가 못 된다. 정확한 표현은 **「현재 표본에서 유망한 초기 결과」** 다.

```
raw candidate 108 · E1 candidate 26 · Vision 호출 12
SAME 1 / DIFF 11 · HIGH 1 / REVIEW 0 / LOW 11
HIGH+DIFF 0 · SAME+LOW 0 · Golden FN 0 · FP 0 · 중복호출 0
점수 분리: SAME 98  vs  DIFF 최대 10
```

- `vision_observations`(migration 057) 분리 완료 — 관측이 `domestic_product_links` 를
  만들지 않는 것을 Production 실측으로 확인(관측 2행 저장 · 해당 스냅샷 링크 0건).
- `VISION_GATE_MODE` **OFF 유지**. 일반 Production 사용자에게 켜지 않았다.
- Vision 은 **어떤 판정에도 쓰이지 않는다**(SAME/EXACT/COMPARISON/priceTier 전부 무관).
- 다음 단계: 더 큰 표본으로 E1 검증 → 그 뒤에야 threshold. 지금 정하지 않는다.
- E1 을 켤 때의 상한은 프로세스 카운터가 아니라 **워크스페이스 한정 + `vision_observations`
  원자적 count** 로 설계한다(인스턴스 수와 무관해야 한다).
