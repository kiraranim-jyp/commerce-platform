import type { RadarAxis, RadarAxisKey, RadarLevel, RadarResult } from "@commerce/pricing";
import { RADAR_LEVEL_SCORE } from "@commerce/pricing";
import { emptyStateForAxis } from "./mi-empty-state";

/**
 * MI 2.0 PHASE 1(CPO 지시, 2026-09-09) — 판매 판단의 근거를 4축으로 보여준다.
 *
 * 차트 라이브러리를 쓰지 않고 SVG로 직접 그린다. 이유가 두 가지다:
 *  ① 결측 축을 "0점이 아니라 없음"으로 그리려면 폴리곤에서 그 축만 빼야
 *     하는데, 일반 차트 라이브러리는 보통 결측을 0으로 채운다.
 *  ② Landing에서 이미 client component 없이 SVG로 처리한 전례가 있고,
 *     의존성을 늘리지 않는 편이 이 프로젝트 방침에 맞는다.
 *
 * 이 컴포넌트는 계산하지 않는다 — computeRadar()가 낸 결과를 그리기만 한다.
 */
/**
 * MI-UI-1(CEO 지시, 2026-09-11) — 뷰박스를 정사각형(200×200)에서 가로로 넓힌다.
 *
 * 정사각형이었던 탓에 두 가지가 동시에 나빴다. ① 부모가 200px 고정 컬럼이라
 * 넓은 화면에서 차트가 왼쪽에 몰려 붙어 있었고, ② 3시 방향 라벨("국내 가격
 * 경쟁력")은 반지름 끝에서 textAnchor=middle로 그려져 오른쪽 절반이 뷰박스
 * 밖으로 잘렸다. 가로를 넓히면 둘 다 사라진다 — 폴리곤 좌표 계산(반지름/등급
 * 비율)은 그대로라 그림이 말하는 내용은 하나도 바뀌지 않는다.
 */
const VIEW_W = 300;
const VIEW_H = 220;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = 106;
const RADIUS = 72;
const MAX_SCORE = 3;
/** 라벨은 축 끝보다 조금 바깥에 둔다(격자선과 글자가 겹치지 않는 최소 여백). */
const LABEL_RATIO = 1.3;

/** 12시 방향부터 시계방향. 축 순서는 computeRadar()가 준 배열 그대로다. */
function axisPoint(index: number, total: number, ratio: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: CENTER_X + Math.cos(angle) * RADIUS * ratio,
    y: CENTER_Y + Math.sin(angle) * RADIUS * ratio,
  };
}

/**
 * MI-UI-1(CEO 지시, 2026-09-11) — "수익성 · 국내 가격 경쟁력을 주식 시세처럼
 * 한눈에 읽히게."
 *
 * 처음엔 ▲▼ 시세 표기로 만들었다가 CEO 지시로 별점으로 바꿨다 — MI는 오르내리는
 * 방향을 보여주는 지표가 아니라 "지금 팔기에 얼마나 좋은가"를 보여주는 지표라
 * 별점이 그 의미에 맞다.
 *
 * 별칸이 5개인데 쓰는 값이 3개뿐인 것은 의도한 것이다. computeRadar()가 내는
 * 등급은 HIGH/MEDIUM/LOW 셋뿐이고(RADAR_LEVEL_SCORE = 3/2/1), ★★★★☆나 ★★☆☆☆를
 * 채우려면 우리가 실제로는 구분하지 못하는 중간 등급을 지어내야 한다. 5칸 틀은
 * 읽는 사람에게 익숙해서 그대로 두되, 없는 해상도를 있는 척하지 않는다 —
 * 그 두 값은 영영 나오지 않는다.
 *
 * 등급 단어(매우 좋음/보통/낮음)는 지우지 않는다. 별만 남기면 색과 모양에만
 * 의존하게 되고(색각 이상·흑백 출력), 스크린리더에서는 ★ 반복만 읽힌다.
 * 색은 보조일 뿐 색만으로 판단하게 만들지 않는다. 숫자 점수는 노출하지 않는다 —
 * 3단계를 점수로 보여주면 없는 정밀도가 있는 것처럼 읽힌다.
 *
 * 데이터가 없는 축은 여기서 다루지 않는다. ☆☆☆☆☆로 그리면 "낮다"로 읽히는데
 * 모르는 것과 낮은 것은 다르다 — 호출부에서 "—"와 사유 문장으로 따로 그린다.
 */
const LEVEL_STARS: Record<RadarLevel, { mark: string; word: string; className: string }> = {
  HIGH: { mark: "★★★★★", word: "매우 좋음", className: "font-bold text-success" },
  MEDIUM: { mark: "★★★☆☆", word: "보통", className: "font-semibold text-warning" },
  LOW: { mark: "★☆☆☆☆", word: "낮음", className: "font-bold text-error" },
};

/**
 * MI-RADAR-REASON-1(CPO 지시, 2026-09-10) — 결측 축을 "확인 불가"라고만 쓰지 않는다.
 *
 * 같은 화면에 "📈 예상 수익 ₩34,000"이 찍혀 있는데 바로 아래 "💰 수익성 — 확인 불가"가
 * 붙으면 둘 중 하나가 고장 난 것처럼 읽힌다. 실제로는 서로 다른 질문에 답하고 있다 —
 * 예상 수익은 "내가 정한 판매가에서 얼마 남는가"라는 산술이고(국내 시세와 무관),
 * 수익성 축은 "그게 시장 대비 좋은 수익인가"라는 판단이라 국내 가격을 모르면
 * 계산 자체가 안 된다.
 *
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 여기에 한 겹을 더한다. 결측에도 종류가 있어서
 * "정상 조회했는데 결과가 없음"과 "조회/계산 자체를 못 함"은 셀러가 할 일이 다르다.
 * 그 구분은 mi-empty-state.ts 한 곳에서만 문구로 번역한다 — 판정이나 사유 문장은
 * computeRadar가 낸 값 그대로다.
 *
 * ── 축 줄을 별도 컴포넌트로 뺀 이유 ─────────────────────────────────────
 * 같은 4축 별점을 판단 헤드라인("판단 근거")과 접힘 상세(레이더 그림 옆)에서
 * 둘 다 써야 한다. 두 곳에 같은 매핑을 복사하면 언젠가 한쪽만 고쳐져서 같은
 * 상품이 화면 위아래에서 다른 등급으로 보인다 — 이 프로젝트에서 반복된 버그
 * 유형이라 구조로 막는다.
 */
export function MiAxisStars({ radar, className = "" }: { radar: RadarResult; className?: string }) {
  return (
    <ul className={`w-full space-y-0.5 ${className}`}>
      {radar.axes.map((axis) => {
        const empty = emptyStateForAxis(axis.state);
        const stars = axis.state.status === "SCORED" ? LEVEL_STARS[axis.state.level] : null;
        return (
          <li key={axis.key} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className={empty ? "text-text-tertiary" : "text-text-secondary"}>
              {axis.icon} {axis.label}
            </span>
            {stars ? (
              <span className={`shrink-0 text-right ${stars.className}`}>
                {/* 별을 붙여 써야 채운 칸 수가 한 덩어리로 읽힌다 — 자간을 좁힌다. */}
                <span className="tracking-[-0.1em]">{stars.mark}</span> {stars.word}
              </span>
            ) : (
              // 모르는 축을 ☆☆☆☆☆로 그리면 "낮다"로 읽힌다 — 별점 대신 상태와 사유를 쓴다.
              <span className="text-right text-text-tertiary">
                — {empty?.chip}
                {empty?.reason ? ` · ${empty.reason}` : ""}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * MI-TEXT-1(CEO 지시, 2026-09-12) — "3초 안에 판단하고, 자세한 건 펼쳐서 본다."
 *
 * 판정 바로 아래에 서는 세 줄. 지금까지 이 자리에는 문장이 있었다
 * (representativeVerdict.description — "국내 동일상품 대비 가격 경쟁력이 있고
 * 목표 마진도 확보됩니다" 같은 한두 줄). 틀린 문장은 아니지만 3초 안에 읽히지
 * 않고, 무엇보다 **같은 사실을 이미 축 등급이 말하고 있었다**. 문장은 지우지
 * 않고 접힘 상세 첫 줄로 내렸다(정보 이동이지 삭제가 아니다).
 *
 * ── 왜 세 축만인가 ───────────────────────────────────────────────────────
 * computeRadar가 내는 축은 넷이다. 그중 🎯 상품 판단 신뢰도는 "시장이 어떤가"가
 * 아니라 "우리 매칭을 얼마나 믿을 수 있나"라 판매 판단과 층위가 다르다 —
 * 아래 ⑤ 판단 근거에 네 축이 전부 그대로 있으므로 여기서 빼도 사라지지 않는다.
 * 순서는 CEO 지시문의 순서 그대로다(가격 경쟁력 → 시장 수요 → 수익성).
 *
 * ── 등급 어휘를 새로 만들지 않는다 ───────────────────────────────────────
 * 별점·등급 단어는 아래 MiAxisStars와 **같은 LEVEL_STARS 하나**에서 나온다.
 * 컴포넌트를 따로 둔 것은 모양(요약/상세) 때문이지 판정 때문이 아니다 —
 * 같은 상품의 같은 축이 화면 위아래에서 다른 등급으로 보이는 일은 구조적으로
 * 불가능하다. 결측 축도 ☆☆☆☆☆로 그리지 않는다(모르는 것 ≠ 낮은 것).
 */
const VERDICT_AXIS_ORDER: RadarAxisKey[] = ["priceCompetitiveness", "marketDemand", "profitability"];

export function MiVerdictAxes({ radar }: { radar: RadarResult }) {
  const axes = VERDICT_AXIS_ORDER.map((key) => radar.axes.find((a) => a.key === key)).filter(
    (a): a is RadarAxis => a != null,
  );
  if (axes.length === 0) return null;
  return (
    <dl className="mt-1.5 space-y-0.5">
      {axes.map((axis) => {
        const empty = emptyStateForAxis(axis.state);
        const stars = axis.state.status === "SCORED" ? LEVEL_STARS[axis.state.level] : null;
        return (
          <div key={axis.key} className="flex items-baseline gap-2 text-xs">
            {/* 라벨 폭을 고정해 세 줄의 등급이 같은 세로줄에 선다 — 줄마다
                등급 위치가 달라지면 "한눈에 비교"가 되지 않는다. */}
            <dt className="w-[104px] shrink-0 opacity-70">{axis.label}</dt>
            <dd className={stars ? stars.className : "opacity-70"}>
              {stars ? (
                <>
                  <span className="tracking-[-0.1em]">{stars.mark}</span> {stars.word}
                </>
              ) : (
                // 사유는 여기서 말하지 않는다(⑤가 말한다) — 첫 화면은 결론만.
                empty?.chip
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function MiRadar({ radar }: { radar: RadarResult }) {
  const total = radar.axes.length;

  // 등급이 있는 축만 폴리곤에 넣는다. 결측 축 방향으로 선을 중심까지
  // 끌어당기면 "0점"으로 읽히는데, 그건 사실이 아니다.
  const scored = radar.axes
    .map((axis, index) => ({ axis, index }))
    .filter(({ axis }) => axis.state.status === "SCORED");

  const polygon = scored
    .map(({ axis, index }) => {
      const level = axis.state.status === "SCORED" ? axis.state.level : "LOW";
      const p = axisPoint(index, total, RADAR_LEVEL_SCORE[level] / MAX_SCORE);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {/* MI-UI-1 — 고정 200px 대신 부모 폭을 쓰되(w-full) 너무 커지지 않게만
          막는다(max-w). 가운데 정렬은 부모가 아니라 여기서 보장한다 — 이
          컴포넌트가 어디에 놓이든 차트가 왼쪽에 붙지 않아야 한다. */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mx-auto h-auto w-full max-w-[300px]"
        role="img"
        aria-label="판단 근거 4축"
      >
        {/* 격자 — 축이 몇 개든 항상 4각형 구조를 유지한다. 결측이 있어도
            도형 자체가 바뀌지 않아야 상품 간 비교가 가능하다. */}
        {[1, 2 / 3, 1 / 3].map((r) => (
          <polygon
            key={r}
            points={radar.axes
              .map((_, i) => {
                const p = axisPoint(i, total, r);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(" ")}
            className="fill-none stroke-border"
            strokeWidth="1"
          />
        ))}

        {/* 축선 — 결측 축은 점선으로 그려 "값이 없다"를 시각적으로 알린다. */}
        {radar.axes.map((axis, i) => {
          const p = axisPoint(i, total, 1);
          const missing = axis.state.status !== "SCORED";
          return (
            <line
              key={axis.key}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={p.x}
              y2={p.y}
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray={missing ? "3 3" : undefined}
            />
          );
        })}

        {/* 값 폴리곤 — 등급이 있는 축만. 2개 미만이면 면이 안 되므로 점만 찍는다. */}
        {scored.length >= 3 && (
          <polygon points={polygon} className="fill-primary/20 stroke-primary" strokeWidth="1.5" />
        )}
        {scored.map(({ axis, index }) => {
          const level = axis.state.status === "SCORED" ? axis.state.level : "LOW";
          const p = axisPoint(index, total, RADAR_LEVEL_SCORE[level] / MAX_SCORE);
          return <circle key={axis.key} cx={p.x} cy={p.y} r="3" className="fill-primary" />;
        })}

        {/* 라벨 — 결측 축도 라벨을 남긴다(축이 사라지면 비교가 안 된다). */}
        {radar.axes.map((axis, i) => {
          const p = axisPoint(i, total, LABEL_RATIO);
          const missing = axis.state.status !== "SCORED";
          return (
            <text
              key={axis.key}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-[9px] ${missing ? "fill-text-tertiary" : "fill-text-secondary"}`}
            >
              {missing ? "⚪ " : ""}
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* 축별 상태를 텍스트로도 준다 — 차트만으로는 스크린리더/모바일에서
          읽기 어렵고, 결측 이유는 그림으로 표현할 수 없다. */}
      <MiAxisStars radar={radar} />
    </div>
  );
}

/** 레이더 옆 판단 요약. 확인된 것(✓)과 모르는 것(⚪)을 섞어 나열하지 않는다. */
export function MiRadarSummary({ radar, notes }: { radar: RadarResult; notes: string[] }) {
  /* MI-UI-1(CEO 지시, 2026-09-11: "글이 너무 많다") — "판단 근거가 없는 축"
     한 줄을 지운다. 정보를 지우는 게 아니라 중복을 지우는 것이다: 같은 화면
     바로 왼쪽 축 목록이 이미 결측 축마다 ⚪와 사유 문장까지 보여주고 있어서,
     이 줄은 그 축 이름을 한 번 더 나열하기만 했다(사유는 여기 없었다 —
     즉 덜 정확한 쪽이 중복이었다). 보여줄 것이 하나도 남지 않으면 빈 칸을
     남기지 않고 아예 렌더하지 않는다 — 그래야 레이더가 폭을 다 쓴다. */
  if (notes.length === 0 && !radar.contradiction) return null;
  return (
    <div className="space-y-2 text-xs">
      <p className="text-[11px] font-medium text-text-tertiary">판단 요약</p>
      {notes.length > 0 && (
        <ul className="space-y-1">
          {notes.map((n) => (
            <li key={n} className="text-text-secondary">
              ✓ {n}
            </li>
          ))}
        </ul>
      )}
      {radar.contradiction && (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-[11px] text-text-primary">
          ⚠ {radar.contradiction}
        </p>
      )}
    </div>
  );
}
