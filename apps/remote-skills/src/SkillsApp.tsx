import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { CareerContentBundle } from '@befreeman/content';
import type { EventBus, Theme } from '@befreeman/mfe-contract';
import { resolveMotion } from '@befreeman/design-system';
import { buildRadar, drawRadar } from './radar';

export interface SkillsAppProps {
  content: CareerContentBundle;
  bus: EventBus;
  initialTheme: Theme;
  initialSelected: string | null;
}

const SIZE = 360;

export function SkillsApp({ content, bus, initialTheme, initialSelected }: SkillsAppProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [active, setActive] = useState<string | null>(initialSelected ?? content.skills[0]?.id ?? null);
  const [view, setView] = useState<'radar' | 'table'>('radar');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const model = useMemo(() => buildRadar(content), [content]);
  const ordered = useMemo(() => content.skillCategories.flatMap((c) => c.skills), [content]);
  const skillById = useMemo(() => new Map(content.skills.map((s) => [s.id, s])), [content]);
  const roleById = useMemo(() => new Map(content.roles.map((r) => [r.id, r])), [content]);
  const demonstrating = useMemo(
    () => (selected ? content.achievements.filter((a) => a.skills.includes(selected)) : []),
    [content, selected],
  );

  // Bus: focus a skill from anywhere; redraw on theme changes.
  useEffect(() => {
    const offFocus = bus.subscribe('entity:focus', ({ type, id }) => {
      if (type === 'skill' && skillById.has(id)) {
        setSelected(id);
        setActive(id);
        buttons.current.get(id)?.scrollIntoView({ block: 'center', behavior: resolveMotion().reduced ? 'auto' : 'smooth' });
      }
    });
    const offTheme = bus.subscribe('theme:changed', ({ theme: t }) => setTheme(t));
    return () => {
      offFocus();
      offTheme();
    };
  }, [bus, skillById]);

  // Draw (grow-in once, instant under reduced motion).
  const grown = useRef(false);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const motion = resolveMotion();
    const duration = grown.current ? 0 : motion.durations.dramatic;
    const draw = (progress: number) => {
      drawRadar(ctx, model, { mode: theme, selected, progress, size: SIZE, dpr });
      canvas.dataset['drawnTheme'] = theme;
      canvas.dataset['selected'] = selected ?? '';
    };
    if (!duration || typeof requestAnimationFrame !== 'function') {
      draw(1);
      grown.current = true;
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      draw(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
      else grown.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [model, theme, selected]);

  const select = useCallback(
    (id: string) => {
      setSelected((cur) => (cur === id ? null : id));
      setActive(id);
    },
    [],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!active) return;
    const i = ordered.indexOf(active);
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ordered.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ordered.length) % ordered.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ordered.length - 1;
    if (next === null) return;
    const id = ordered[next];
    if (!id) return;
    e.preventDefault();
    setActive(id);
    buttons.current.get(id)?.focus();
  };

  const go = (path: string) => (e: MouseEvent) => {
    e.preventDefault();
    bus.publish('nav:request', { path });
  };

  const selectedSkill = selected ? skillById.get(selected) : undefined;

  return (
    <div className="text-ink" data-view={view}>
      <div className="mb-6 flex justify-end">
        <div className="inline-flex rounded-pill bg-surface-sunken p-1 ring-1 ring-border" role="group" aria-label="Skills display">
          {(['radar', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`rounded-pill px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'}`}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === 'radar' ? 'Radar' : 'Table view'}
            </button>
          ))}
        </div>
      </div>

      {view === 'radar' ? (
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,22.5rem)_1fr]">
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            data-testid="radar-canvas"
            className="mx-auto aspect-square w-full max-w-[22.5rem]"
            style={{ width: '100%', maxWidth: SIZE }}
          />
          <div>
            <div role="group" aria-label="Skills radar: use arrow keys to move between skills" onKeyDown={onKeyDown} data-testid="skill-group">
              {content.skillCategories.map((cat) => (
                <section key={cat.id} className="mb-5">
                  <h3 className="mb-2 font-display text-lg font-bold">{cat.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {cat.skills.map((id) => {
                      const s = skillById.get(id);
                      if (!s) return null;
                      const isSelected = selected === id;
                      return (
                        <button
                          key={id}
                          ref={(el) => {
                            if (el) buttons.current.set(id, el);
                            else buttons.current.delete(id);
                          }}
                          id={`skill-${id}`}
                          type="button"
                          data-skill={id}
                          tabIndex={active === id ? 0 : -1}
                          aria-pressed={isSelected}
                          onClick={() => select(id)}
                          onFocus={() => setActive(id)}
                          className={`inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm font-medium ring-1 transition-colors duration-token-fast ${
                            isSelected ? 'bg-accent text-accent-ink ring-accent' : 'bg-surface-raised text-ink ring-border hover:ring-accent'
                          }`}
                        >
                          {s.name}
                          <span className="font-mono text-xs opacity-80" aria-label={`proficiency ${s.proficiency} of 5`}>
                            {s.proficiency}/5
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <section aria-live="polite" className="mt-6" data-testid="skill-detail">
              {selectedSkill ? (
                <bf-card variant="glow">
                  <span slot="heading">Where I’ve used {selectedSkill.name}</span>
                  {demonstrating.length ? (
                    <ul className="mt-2 space-y-2">
                      {demonstrating.map((a) => (
                        <li key={a.id}>
                          <a href={`/achievements/${a.id}`} className="font-semibold" onClick={go(`/achievements/${a.id}`)}>
                            {a.title}
                          </a>
                          <span className="block text-sm">{roleById.get(a.role)?.company}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No published achievements use this skill yet.</p>
                  )}
                </bf-card>
              ) : (
                <p className="text-ink-muted">Select a skill to see the achievements that demonstrate it.</p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <table className="w-full border-collapse text-left" data-testid="skills-table">
          <caption className="sr-only">Skills by category with proficiency and supporting achievements</caption>
          <thead>
            <tr className="border-b border-border text-sm text-ink-muted">
              <th scope="col" className="py-2 pr-4">Skill</th>
              <th scope="col" className="py-2 pr-4">Category</th>
              <th scope="col" className="py-2 pr-4">Proficiency</th>
              <th scope="col" className="py-2 pr-4">Years</th>
              <th scope="col" className="py-2">Demonstrated in</th>
            </tr>
          </thead>
          <tbody>
            {content.skillCategories.flatMap((cat) =>
              cat.skills.map((id) => {
                const s = skillById.get(id);
                if (!s) return null;
                const used = content.achievements.filter((a) => a.skills.includes(id));
                return (
                  <tr key={id} className="border-b border-border align-top">
                    <th scope="row" className="py-2 pr-4 font-semibold">{s.name}</th>
                    <td className="py-2 pr-4">{cat.name}</td>
                    <td className="py-2 pr-4">{s.proficiency} of 5</td>
                    <td className="py-2 pr-4">{s.years ?? '—'}</td>
                    <td className="py-2">
                      {used.length
                        ? used.map((a, i) => (
                            <span key={a.id}>
                              {i > 0 && ', '}
                              <a href={`/achievements/${a.id}`} onClick={go(`/achievements/${a.id}`)}>{a.title}</a>
                            </span>
                          ))
                        : '—'}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
