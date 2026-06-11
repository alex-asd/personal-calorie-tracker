// The path the app is mounted at. The server injects `window.__APP_BASE__`
// into the served index.html (see server/app.js): '/' at the site root, or
// e.g. '/calorie/' when BASE_PATH is set behind a reverse proxy. In dev (Vite
// serves index.html directly, no injection) or if anything is off, it falls
// back to '/'. Always normalized to a single trailing slash.
const injected = typeof window !== 'undefined' ? window.__APP_BASE__ : undefined;

export const BASE_PATH =
  typeof injected === 'string' && injected.startsWith('/') ? injected.replace(/\/*$/, '/') : '/';

// Same value without the trailing slash — for prefixing fetch() paths and
// hrefs that already start with '/'. '' at the root, '/calorie' under a proxy.
export const BASE_PREFIX = BASE_PATH.replace(/\/$/, '');

// For <BrowserRouter basename>: undefined at the root (React Router's default).
export const ROUTER_BASENAME = BASE_PREFIX || undefined;
