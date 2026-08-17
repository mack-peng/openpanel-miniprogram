import type { OpenPanel } from './openpanel';

declare const Page: (config: Record<string, any>) => any;
declare const App: (config: Record<string, any>) => any;
declare const getCurrentPages: () => Array<{ route?: string; __route__?: string }>;
declare const wx: any;

export interface AutoTrackEvents {
  /** 页面 onShow 自动上报 screen_view（默认 true） */
  screen_view?: boolean;
  /** App onLaunch 自动上报 app_launch，携带微信场景值（默认 true） */
  app_launch?: boolean;
  /** onShareAppMessage / onShareTimeline 触发时上报 page_share（默认 true） */
  page_share?: boolean;
}

interface AutoTrackerOptions {
  resolvePath?: (page: any) => string;
  extraProperties?: Record<string, unknown>;
  events?: AutoTrackEvents;
}

const DEFAULT_EVENTS: Required<AutoTrackEvents> = {
  screen_view: true,
  app_launch: true,
  page_share: true,
};

export function installAutoTracking(
  op: OpenPanel,
  options?: AutoTrackerOptions,
) {
  const resolvePath =
    (options && options.resolvePath) ||
    function (page: any) {
      return page.route || page.__route__ || 'unknown';
    };

  const events: Required<AutoTrackEvents> = {
    ...DEFAULT_EVENTS,
    ...(options && options.events),
  };

  const currentPagePath = () => {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    return resolvePath(current);
  };

  if (events.app_launch) {
    const originalApp = (globalThis as any).App;
    (globalThis as any).App = function (config: Record<string, any>) {
      const originalOnLaunch = config.onLaunch;
      config.onLaunch = function (...args: any[]) {
        try {
          let launch: any = null;
          if (typeof wx !== 'undefined' && wx.getLaunchOptionsSync) {
            launch = wx.getLaunchOptionsSync();
          }
          op.track('app_launch', {
            __scene: launch ? launch.scene : undefined,
            __query: launch ? launch.query : undefined,
            __path: launch ? launch.path : undefined,
          });
        } catch {
          // never break app launch
        }
        if (originalOnLaunch) originalOnLaunch.apply(this, args);
      };
      return originalApp(config);
    };
  }

  const originalPage = (globalThis as any).Page;
  (globalThis as any).Page = function (config: Record<string, any>) {
    if (events.screen_view) {
      const originalOnShow = config.onShow;
      config.onShow = function () {
        op.screenView(currentPagePath(), options && options.extraProperties);
        if (originalOnShow) originalOnShow.call(this);
      };
    }

    if (events.page_share) {
      const originalShare = config.onShareAppMessage;
      config.onShareAppMessage = function (...args: any[]) {
        op.track('page_share', {
          __path: currentPagePath(),
          __entry: 'menu',
        });
        if (originalShare) return originalShare.apply(this, args);
      };

      const originalTimeline = config.onShareTimeline;
      config.onShareTimeline = function (...args: any[]) {
        op.track('page_share', {
          __path: currentPagePath(),
          __entry: 'timeline',
        });
        if (originalTimeline) return originalTimeline.apply(this, args);
      };
    }

    return originalPage(config);
  };
}
