// Standalone development entry only; the shell loads ./mount. Not part of the remote contract.
import { getBus } from '@befreeman/mfe-contract';
import type { CareerContentBundle } from '@befreeman/content';
import { mount } from './mount';

const host = document.createElement('div');
document.body.append(host);
const shadowHost = host.attachShadow({ mode: 'open' });
const el = document.createElement('div');
shadowHost.append(el);
void fetch('/content/content.latest.json')
  .then((r) => r.json() as Promise<{ file: string }>)
  .then((l) => fetch(`/content/${l.file}`))
  .then((r) => r.json() as Promise<CareerContentBundle>)
  .then((content) =>
    mount(el, {
      route: { path: location.pathname, subPath: '', query: new URLSearchParams(location.search) },
      content,
      bus: getBus('dev'),
      theme: 'light',
      meta: { name: 'achievements', version: 'dev', framework: 'angular' },
    }),
  );
