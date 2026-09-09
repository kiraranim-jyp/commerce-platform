import type { RadarAxis, RadarResult } from "@commerce/pricing";
import { RADAR_LEVEL_SCORE } from "@commerce/pricing";

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
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 66;
const MAX_SCORE = 3;

/** 12시 방향부터 시계방향. 축 순서는 computeRadar()가 준 배열 그대로다. */
function axisPoint(index: number, total: number, ratio: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * RADIUS * ratio,
    y: CENTER + Math.sin(angle) * RADIUS * ratio,
  };
}

const LEVEL_LABEL: Record<string, string> = { HIGH: "높음", MEDIUM: "보통", LOW: "낮음" };

function stateLabel(axis: RadarAxis): string {
  const s = axis.state;
  if (s.status === "SCORED") return LEVEL_LABEL[s.level];
  if (s.status === "NO_DATA") return "데이터 없음";
  return "확인 불가";
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
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-[200px] w-[200px] shrink-0" role="img" aria-label="판단 근거 4축">
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
              x1={CENTER}
              y1={CENTER}
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
          const p = axisPoint(i, total, 1.34);
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
      <ul className="w-full space-y-0.5">
        {radar.axes.map((axis) => {
          const missing = axis.state.status !== "SCORED";
          return (
            <li key={axis.key} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className={missing ? "text-text-tertiary" : "text-text-secondary"}>
                {axis.icon} {axis.label}
              </span>
              <span className={missing ? "text-text-tertiary" : "font-medium text-text-primary"}>
                {stateLabel(axis)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 레이더 옆 판단 요약. 확인된 것(✓)과 모르는 것(⚪)을 섞어 나열하지 않는다. */
export function MiRadarSummary({ radar, notes }: { radar: RadarResult; notes: string[] }) {
  const missing = radar.axes.filter((a) => a.state.status !== "SCORED");
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
      {missing.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {missing.map((a) => (
            <li key={a.key} className="text-text-tertiary">
              ⚪ {a.state.status === "SCORED" ? "" : a.state.reason}
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
