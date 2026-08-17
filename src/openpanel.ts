import type {
  OpenPanelOptions,
  TrackHandlerPayload,
  TrackProperties,
} from '@openpanel/sdk';
import { OpenPanel as OpenPanelBase } from '@openpanel/sdk';
import { WxApi } from './wx-api';
import { defaultStorageAdapter } from './storage';
import type { MiniprogramOpenPanelOptions, StorageAdapter } from './types';

declare const PKG_VERSION: string;

declare const wx: {
  getSystemInfoSync(): {
    platform: string;
    model: string;
    system: string;
    screenWidth: number;
    screenHeight: number;
    version: string;
    SDKVersion: string;
  };
  getNetworkType(options: {
    success: (res: { networkType: string }) => void;
  }): void;
  onNetworkStatusChange(
    callback: (res: { isConnected: boolean }) => void,
  ): void;
  offNetworkStatusChange(
    callback: (res: { isConnected: boolean }) => void,
  ): void;
};

const QUEUE_STORAGE_KEY = 'openpanel_offline_queue';
const DEVICE_ID_KEY = 'openpanel_device_id';
const SESSION_ID_KEY = 'openpanel_session_id';

export class OpenPanel extends OpenPanelBase {
  private storage: StorageAdapter;
  private isOnline = true;
  private networkListener?: (res: { isConnected: boolean }) => void;

  constructor(public options: MiniprogramOpenPanelOptions) {
    super({
      ...options,
      sdk: 'miniprogram',
      sdkVersion: options.sdkVersion || PKG_VERSION,
    });

    const requestAdapter =
      options.requestAdapter ||
      (typeof wx !== 'undefined'
        ? (wx as unknown as import('./types').WxRequestAdapter)
        : undefined);

    if (!requestAdapter) {
      throw new Error(
        '[openpanel-miniprogram] No request adapter found. ' +
          'Pass `requestAdapter` in options or ensure `wx` global is available.',
      );
    }

    // Replace the base Api with our wx.request-based implementation
    (this as any).api = new WxApi({
      baseUrl: options.apiUrl || 'https://api.openpanel.dev',
      defaultHeaders: {
        'openpanel-client-id': options.clientId,
        ...(options.clientSecret
          ? { 'openpanel-client-secret': options.clientSecret }
          : {}),
        'openpanel-sdk-name': 'miniprogram',
        'openpanel-sdk-version': options.sdkVersion || PKG_VERSION,
      },
      requestAdapter,
    });

    this.storage = options.storageAdapter || defaultStorageAdapter;

    this.setDefaultProperties();
    this.setupNetworkListener();
    this.loadPersistedState();
  }

  private setDefaultProperties() {
    if (typeof wx === 'undefined') return;
    try {
      const info = wx.getSystemInfoSync();
      this.setGlobalProperties({
        __platform: 'miniprogram',
        __os: info.platform,
        __model: info.model,
        __system: info.system,
        __screen: `${info.screenWidth}x${info.screenHeight}`,
        __wxVersion: info.version,
        __sdkVersion: info.SDKVersion,
      });
    } catch {
      // ignore
    }
  }

  private setupNetworkListener() {
    if (typeof wx === 'undefined') return;

    wx.getNetworkType({
      success: (res) => {
        this.isOnline = res.networkType !== 'none';
      },
    });

    this.networkListener = (res) => {
      const wasOffline = !this.isOnline;
      this.isOnline = res.isConnected;
      if (wasOffline && this.isOnline) {
        this.flush();
      }
    };

    wx.onNetworkStatusChange(this.networkListener);
  }

  private loadPersistedState() {
    try {
      const deviceId = this.storage.getItem(DEVICE_ID_KEY);
      if (deviceId) this.deviceId = deviceId;

      const sessionId = this.storage.getItem(SESSION_ID_KEY);
      if (sessionId) this.sessionId = sessionId;

      const stored = this.storage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored);
        if (Array.isArray(items) && items.length > 0) {
          this.queue = [...items, ...this.queue];
          this.flush();
        }
      }
    } catch {
      this.log('Failed to load persisted state');
    }
  }

  private persistQueue() {
    try {
      this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      this.log('Failed to persist queue');
    }
  }

  private persistIds() {
    try {
      if (this.deviceId) {
        this.storage.setItem(DEVICE_ID_KEY, this.deviceId);
      }
      if (this.sessionId) {
        this.storage.setItem(SESSION_ID_KEY, this.sessionId);
      }
    } catch {
      this.log('Failed to persist ids');
    }
  }

  addQueue(payload: TrackHandlerPayload) {
    super.addQueue(payload);
    this.persistQueue();
  }

  async send(payload: TrackHandlerPayload) {
    if (this.options.filter && !this.options.filter(payload)) {
      return null;
    }

    if (!this.isOnline) {
      this.addQueue(payload);
      return null;
    }

    const result = await super.send(payload);

    if (result) {
      this.persistIds();
      this.persistQueue();
    }

    return result;
  }

  flush() {
    if (!this.isOnline) return;
    super.flush();
    this.persistQueue();
  }

  screenView(pagePath: string, properties?: Record<string, unknown>) {
    return this.track('screen_view', {
      __path: pagePath,
      ...properties,
    });
  }

  destroy() {
    if (this.networkListener && typeof wx !== 'undefined') {
      try {
        wx.offNetworkStatusChange(this.networkListener);
      } catch {
        // ignore
      }
    }
    this.networkListener = undefined;
  }
}
