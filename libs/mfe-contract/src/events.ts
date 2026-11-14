import { z } from 'zod';

/**
 * Contract version of the event catalog. Bump the major when an existing
 * event's payload changes incompatibly or an event is removed.
 */
export const CONTRACT_VERSION = 1 as const;

export const entityTypeSchema = z.enum(['profile', 'role', 'achievement', 'caseStudy', 'skill']);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const themeSchema = z.enum(['light', 'dark']);
export type Theme = z.infer<typeof themeSchema>;

/** The published catalog: every event name with the schema its payload must satisfy. */
export const eventCatalog = {
  /** Ask the shell to navigate. Any participant may publish; only the shell acts on it. */
  'nav:request': z.object({
    path: z.string().startsWith('/'),
    replace: z.boolean().optional(),
  }),
  /** Published by the shell after every top-level navigation. */
  'route:changed': z.object({
    path: z.string().startsWith('/'),
    subPath: z.string(),
    owner: z.string().nullable(),
  }),
  /** Highlight and reveal an entity wherever it is displayed. */
  'entity:focus': z.object({
    type: entityTypeSchema,
    id: z.string().min(1),
  }),
  /** Published by the shell when the light/dark mode changes. */
  'theme:changed': z.object({ theme: themeSchema }),
  /** Published by the shell when a remote fails to load, mount, or unmount. */
  'remote:error': z.object({
    name: z.string(),
    version: z.string(),
    phase: z.enum(['load', 'mount', 'unmount', 'runtime']),
    message: z.string(),
  }),
} as const;

export type EventCatalog = typeof eventCatalog;
export type EventName = keyof EventCatalog;
export type EventPayload<N extends EventName> = z.infer<EventCatalog[N]>;

/** Wire format carried in `CustomEvent.detail`. */
export interface EventEnvelope<N extends EventName = EventName> {
  v: typeof CONTRACT_VERSION;
  name: N;
  payload: EventPayload<N>;
  source?: string;
}

export function isEventName(value: string): value is EventName {
  return Object.prototype.hasOwnProperty.call(eventCatalog, value);
}
