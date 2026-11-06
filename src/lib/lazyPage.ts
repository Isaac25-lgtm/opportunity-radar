import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'or_chunk_reload';

/**
 * React.lazy with resilience for code-split pages: retries a failed chunk once (transient network or edge
 * errors), and if it still fails — typically a stale chunk name after a new deployment — reloads the page once.
 */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load().catch(() => new Promise((r) => setTimeout(r, 800)).then(load));
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }
  });
}
