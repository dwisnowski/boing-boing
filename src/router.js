/**
 * Lightweight hash router (react-router–style SPA navigation for static hosting).
 *
 * Routes:
 *   #/        home chooser
 *   #/game    bouncing game
 *   #/morse   Morse trainer
 */

/**
 * @param {Record<string, (ctx: { path: string, params: Record<string, string> }) => void>} routes
 * @param {{ fallback?: string }} [opts]
 */
export function createRouter(routes, opts = {}) {
  const fallback = opts.fallback ?? "/";
  let current = null;

  function parse() {
    const raw = (location.hash || "#/").replace(/^#/, "") || "/";
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const clean = path.replace(/\/+$/, "") || "/";
    return clean;
  }

  function navigate(path, { replace = false } = {}) {
    const next = path.startsWith("#") ? path : `#${path.startsWith("/") ? path : `/${path}`}`;
    if (replace) location.replace(next);
    else location.hash = next;
  }

  function render() {
    const path = parse();
    const handler = routes[path] || routes[fallback];
    if (!handler) return;
    current = path;
    handler({ path, params: {} });
    document.body.dataset.route = path === "/" ? "home" : path.slice(1);
  }

  function start() {
    window.addEventListener("hashchange", render);
    if (!location.hash || location.hash === "#") {
      navigate(fallback, { replace: true });
    }
    render();
  }

  function getPath() {
    return current || parse();
  }

  return { start, navigate, getPath, render };
}
