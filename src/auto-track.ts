import type { OpenPanel } from './openpanel';

declare const Page: (config: Record<string, any>) => any;
declare const App: (config: Record<string, any>) => any;
declare const getCurrentPages: () => Array<{ route?: string; __route__?: string }>;

interface AutoTrackerOptions {
  resolvePath?: (page: any) => string;
  extraProperties?: Record<string, unknown>;
}

export function installAutoTracking(
  op: OpenPanel,
  options?: AutoTrackerOptions,
) {
  var resolvePath =
    (options && options.resolvePath) ||
    function (page: any) { return page.route || page.__route__ || 'unknown'; };

  var originalApp = (globalThis as any).App;
  (globalThis as any).App = function (config: Record<string, any>) {
    var originalOnShow = config.onShow;
    config.onShow = function (opts: any) {
      op.track('app_show', { __options: opts });
      if (originalOnShow) originalOnShow.call(this, opts);
    };
    var originalOnHide = config.onHide;
    config.onHide = function () {
      op.track('app_hide');
      if (originalOnHide) originalOnHide.call(this);
    };
    return originalApp(config);
  };

  var originalPage = (globalThis as any).Page;
  (globalThis as any).Page = function (config: Record<string, any>) {
    var originalOnShow = config.onShow;
    config.onShow = function () {
      var pages = getCurrentPages();
      var current = pages[pages.length - 1];
      var path = resolvePath(current);
      op.screenView(path, options && options.extraProperties);
      if (originalOnShow) originalOnShow.call(this);
    };
    return originalPage(config);
  };
}
