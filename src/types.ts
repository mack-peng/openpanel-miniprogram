import type {
  OpenPanelOptions,
  TrackHandlerPayload,
  TrackProperties,
  IdentifyPayload,
  TrackPayload,
  IncrementPayload,
  DecrementPayload,
  GroupPayload,
  UpsertGroupPayload,
  AssignGroupPayload,
  AliasPayload,
} from '@openpanel/sdk';

export type {
  AliasPayload,
  AssignGroupPayload,
  DecrementPayload,
  GroupPayload,
  IdentifyPayload,
  IncrementPayload,
  OpenPanelOptions,
  TrackHandlerPayload,
  TrackPayload,
  TrackProperties,
  UpsertGroupPayload,
};

/** wx.request style adapter — allows injecting custom request implementation */
export interface WxRequestAdapter {
  request(options: {
    url: string;
    method: 'POST';
    data: string;
    header: Record<string, string>;
    success: (res: { statusCode: number; data: any }) => void;
    fail: (err: { errMsg: string }) => void;
  }): void;
}

/** Storage adapter interface (synchronous, matching wx.storage API) */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Options for the miniprogram OpenPanel client */
export interface MiniprogramOpenPanelOptions extends OpenPanelOptions {
  /** Custom request adapter. Defaults to wx.request */
  requestAdapter?: WxRequestAdapter;
  /** Custom storage adapter. Defaults to wx.getStorageSync / wx.setStorageSync */
  storageAdapter?: StorageAdapter;
  /** Auto-install Page/App onShow tracking. Defaults to true */
  autoTrackPageView?: boolean;
}
