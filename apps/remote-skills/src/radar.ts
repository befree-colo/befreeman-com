import type { CareerContentBundle, Skill } from '@befreeman/content';
import { colors } from '@befreeman/design-system';
import type { Mode } from '@befreeman/design-system';

export interface RadarPoint {
  skill: Skill;
  /** Unit-circle coordinates in [-1, 1]. */
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface RadarModel {
  axes: { id: string; name: string; angle: number }[];
  points: RadarPoint[];
}

/**
 * One axis per skill category; each skill sits near its category axis, spread
 * slightly, at a radius proportional to proficiency (1..5).
 */
export function buildRadar(content: CareerContentBundle): RadarModel {
  const cats = content.skillCategories;
  const step = (Math.PI * 2) / Math.max(cats.length, 1);
  const byId = new Map(content.skills.map((s) => [s.id, s]));
  const axes = cats.map((c, i) => ({ id: c.id, name: c.name, angle: -Math.PI / 2 + i * step }));
  const points: RadarPoint[] = [];
  cats.forEach((c, i) => {
    const spread = step * 0.6;
    c.skills.forEach((id, j) => {
      const skill = byId.get(id);
      if (!skill) return;
      const offset = c.skills.length > 1 ? (j / (c.skills.length - 1) - 0.5) * spread : 0;
      const angle = (axes[i]?.angle ?? 0) + offset;
      const radius = skill.proficiency / 5;
      points.push({ skill, angle, radius, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
  });
  return { axes, points };
}

export interface DrawOptions {
  mode: Mode;
  selected: string | null;
  /** 0..1 grow-in progress (1 = final frame). */
  progress: number;
  size: number;
  dpr?: number;
}

/** Draw the radar with the design-system palette for the given mode. */
export function drawRadar(ctx: CanvasRenderingContext2D, model: RadarModel, o: DrawOptions): void {
  const p = colors[o.mode];
  const dpr = o.dpr ?? 1;
  const size = o.size;
  const c = size / 2;
  const R = c * 0.82;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  // rings
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.border;
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath();
    ctx.arc(c, c, (R * ring) / 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // axes
  for (const axis of model.axes) {
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(axis.angle) * R, c + Math.sin(axis.angle) * R);
    ctx.stroke();
  }
  // filled shape through the points (in angle order)
  const ordered = [...model.points].sort((a, b) => a.angle - b.angle);
  if (ordered.length > 2) {
    ctx.beginPath();
    ordered.forEach((pt, i) => {
      const x = c + pt.x * R * o.progress;
      const y = c + pt.y * R * o.progress;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // points
  for (const pt of model.points) {
    const selected = pt.skill.id === o.selected;
    ctx.beginPath();
    ctx.arc(c + pt.x * R * o.progress, c + pt.y * R * o.progress, selected ? 9 : 5, 0, Math.PI * 2);
    ctx.fillStyle = selected ? p['accent-2'] : p.accent;
    ctx.fill();
    if (selected) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.focus;
      ctx.stroke();
    }
  }
}
