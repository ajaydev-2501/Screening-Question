import { cn } from "@/lib/utils";

export type RadarAxis = {
  label: string;
  /** 0-100. */
  value: number;
};

const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_RADIUS = 116;
const RING_RATIOS = [0.25, 0.5, 0.75, 1];
const LABEL_RADIUS = MAX_RADIUS + 26;

/**
 * The section radar, hand-drawn as inline SVG in the scoresheet's hairline style.
 *
 * One axis per section, each plotted at its normalized 0-100 value, so the shape reads as a skill
 * profile and the tallest spoke answers "which skill is strongest". The adjacent section table is
 * the data source of record; this graphic is a glance, so it carries no chart library, no client
 * JavaScript and no tooltips beyond the dot titles.
 */
export function SkillRadar({
  axes,
  className,
}: {
  axes: RadarAxis[];
  className?: string;
}) {
  const count = axes.length;
  if (count < 3) return null;

  const angleAt = (index: number) => (Math.PI * 2 * index) / count - Math.PI / 2;
  const pointAt = (index: number, ratio: number) => {
    const angle = angleAt(index);
    const radius = MAX_RADIUS * ratio;
    return {
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
      cos: Math.cos(angle),
      sin: Math.sin(angle),
    };
  };
  const polygon = (points: { x: number; y: number }[]) =>
    points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const valuePoints = axes.map((axis, index) =>
    pointAt(index, clampValue(axis.value) / 100),
  );
  const labelPoints = axes.map((_, index) => pointAt(index, LABEL_RADIUS / MAX_RADIUS));

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Section scores as a radar: ${axes
        .map((axis) => `${axis.label} ${clampValue(axis.value)} percent`)
        .join(", ")}.`}
      className={cn("block h-auto w-full", className)}
    >
      {RING_RATIOS.map((ratio) => (
        <polygon
          key={ratio}
          points={polygon(axes.map((_, index) => pointAt(index, ratio)))}
          className="stroke-rule"
          fill="none"
          strokeWidth={ratio === 1 ? 1 : 0.75}
        />
      ))}

      {axes.map((axis, index) => {
        const spoke = pointAt(index, 1);
        return (
          <line
            key={axis.label}
            x1={CENTER}
            y1={CENTER}
            x2={spoke.x}
            y2={spoke.y}
            className="stroke-rule"
            strokeWidth={0.75}
          />
        );
      })}

      <polygon
        points={polygon(valuePoints)}
        className="fill-navy/10 stroke-navy"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {valuePoints.map((point, index) => (
        <circle key={axes[index]!.label} cx={point.x} cy={point.y} r={2.4} className="fill-navy">
          <title>
            {axes[index]!.label}: {clampValue(axes[index]!.value)}%
          </title>
        </circle>
      ))}

      {axes.map((axis, index) => {
        const point = labelPoints[index]!;
        const anchor =
          point.cos > 0.35 ? "start" : point.cos < -0.35 ? "end" : "middle";
        return (
          <text
            key={axis.label}
            x={point.x}
            y={point.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="mono fill-soft text-[10px] tracking-[0.08em] uppercase"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

function clampValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
