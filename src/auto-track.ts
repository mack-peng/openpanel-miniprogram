import type { OpenPanel } from './openpanel';

declare const Page: (config: Record<string, any>) => any;
declare const App: (config: Record<string, any>) => any;
declare const getCurrentPages: () => Array<{ route?: string; __route__?: string }>;

interface AutoTrackerOptions {
  /** Custom page path resolver */
  resolvePath?: (page: any) => string;
  /** Extra properties for every page_view event */
  extraProperties?: Record<string, unknown>;
}

/**
 * Install automatic page_view tracking by wrapping Page() and App().
 *
 * Usage:
 * ```ts
 * const op = new OpenPanel({ clientId: '...' });
 * installAutoTracking(op);
 * App({ onLaunch() {} });
 * ```
 */
export function installAutoTracking(
  op: OpenPanel,
  options?: AutoTrackerOptions,
) {
  const resolvePath =
    options?.resolvePath ||
    ((page: any) => page.route || page.__route__ || 'unknown');

  // Wrap App to track onShow / onHide
  const originalApp = (globalThis as any).App;
  (globalThis as any).App = function (config: Record<string, any>) {
    const originalOnShow = config.onShow;
    config.onShow = function (opts: any) {
      op.track('app_show', { __options: opts });
      originalOnShow?.call(this, opts);
    };
    const originalOnHide = config.onHide;
    config.onHide = function () {
      op.track('app_hide');
      originalOnHide?.call(this);
    };
    return originalApp(config);
  };

  // Wrap Page to track onShow
  const originalPage = (globalThis as any).Page;
  (globalThis as any).Page = function (config: Record<string, any>) {
    const originalOnShow = config.onShow;
    config.onShow = function () {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const path = resolvePath(current);
      op.screenView(path, options?.extraProperties);
      originalOnShow?.call(this);
    };
    return originalPage(config);
  };
}
