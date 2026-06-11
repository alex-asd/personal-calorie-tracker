// Normalize a configured base path (the BASE_PATH env var / createApp option)
// to either '' (served at the site root) or '/segment' — leading slash, no
// trailing slash, ready to concatenate in front of route paths.
//
//   undefined | '' | '/'        -> ''
//   '/calorie' | 'calorie/'     -> '/calorie'
//   '/calorie/' | '//calorie//' -> '/calorie'
//   'app/calorie'               -> '/app/calorie'
export function normalizeBasePath(raw) {
  if (!raw) return '';
  const trimmed = String(raw)
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return trimmed ? '/' + trimmed : '';
}

// Adapt the built index.html to a (normalized) base path: prefix the
// root-absolute asset URLs Vite emits (src="/assets/…", href="/favicon.ico")
// so they resolve under the sub-path, and inject the mount point as
// `window.__APP_BASE__` for the client (client/src/basePath.js). Protocol-
// relative URLs (src="//…") are left alone. At the root (base === '') only
// the injection happens. Pure function of (html, base).
export function applyBasePathToHtml(html, base) {
  const out = base ? html.replace(/((?:src|href)=")\/(?!\/)/g, `$1${base}/`) : html;
  const inject = `<script>window.__APP_BASE__=${JSON.stringify(`${base}/`)}</script>`;
  return out.replace('</head>', `${inject}</head>`);
}
