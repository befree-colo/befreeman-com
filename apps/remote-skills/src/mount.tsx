import { createRoot } from 'react-dom/client';
import type { CareerContentBundle } from '@befreeman/content';
import { adoptStyles, createShadowStyles } from '@befreeman/design-system';
import { defineRemote } from '@befreeman/mfe-contract';
import css from './styles.css?inline';
import { SkillsApp } from './SkillsApp';

/** Skills radar remote (React). Exposed as `./mount`. */
export const mount = defineRemote<CareerContentBundle>(async (el, ctx) => {
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) adoptStyles(root, createShadowStyles(css));

  // Deep links such as /skills#<skill-id> preselect that skill.
  const hash = decodeURIComponent(location.hash.slice(1));
  const initialSelected = ctx.content.skills.some((s) => s.id === hash) ? hash : null;

  const reactRoot = createRoot(el);
  const render = (c: typeof ctx) =>
    reactRoot.render(<SkillsApp content={c.content} bus={c.bus} initialTheme={c.theme} initialSelected={initialSelected} />);
  render(ctx);

  return {
    async unmount() {
      reactRoot.unmount();
    },
    update(next) {
      render(next);
    },
  };
});

export default mount;
