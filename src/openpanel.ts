import { WxApi } from './wx-api';
import { defaultStorageAdapter } from './storage';
import type {
  MiniprogramOpenPanelOptions,
  StorageAdapter,
  TrackHandlerPayload,
  TrackProperties,
  IdentifyPayload,
  UpsertGroupPayload,
  IncrementPayload,
  DecrementPayload,
  ITrackHandlerPayload,
} from './types';

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

export class OpenPanel {
  private api: WxApi;
  private options: MiniprogramOpenPanelOptions;
  private profileId?: string | number;
  private groups: string[] = [];
  private deviceId?: string;
  private sessionId?: string;
  private globalProps?: Record<string, unknown>;
  private queue: TrackHandlerPayload[] = [];
  private storage: StorageAdapter;
  private isOnline = true;
  private networkListener?: (res: { isConnected: boolean }) => void;

  constructor(options: MiniprogramOpenPanelOptions) {
    this.options = {
      apiUrl: 'https://api.openpanel.dev',
      sdkVersion: PKG_VERSION,
      ...options,
    };

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

    this.api = new WxApi({
      baseUrl: this.options.apiUrl!,
      defaultHeaders: {
        'openpanel-client-id': options.clientId,
        ...(options.clientSecret
          ? { 'openpanel-client-secret': options.clientSecret }
          : {}),
        'openpanel-sdk-name': 'miniprogram',
        'openpanel-sdk-version': this.options.sdkVersion!,
      },
      requestAdapter,
    });

    this.storage = options.storageAdapter || defaultStorageAdapter;

    this.setDefaultProperties();
    this.setupNetworkListener();
    this.loadPersistedState();
  }

  ready() {
    this.options.disabled = false;
    this.options.waitForProfile = false;
    this.flush();
  }

  private shouldQueue(payload: TrackHandlerPayload): boolean {
    if (this.options.disabled) return true;
    if (this.options.waitForProfile && !this.profileId) return true;
    return false;
  }

  private addQueue(payload: TrackHandlerPayload) {
    if (payload.type === 'track') {
      payload.payload.properties = {
        ...(payload.payload.properties || {}),
        __timestamp: new Date().toISOString(),
      };
    }
    this.queue.push(payload);
    this.persistQueue();
  }

  private async send(payload: TrackHandlerPayload) {
    if (this.options.filter && !this.options.filter(payload)) {
      return null;
    }

    if (this.shouldQueue(payload)) {
      this.addQueue(payload);
      return null;
    }

    if (!this.isOnline) {
      this.addQueue(payload);
      return null;
    }

    const result = await this.api.fetch<
      TrackHandlerPayload,
      { deviceId: string; sessionId: string }
    >('/track', payload);

    if (result) {
      this.deviceId = result.deviceId;
      const hadSession = !!this.sessionId;
      this.sessionId = result.sessionId;
      this.persistIds();
      this.persistQueue();

      if (!hadSession && this.sessionId) {
        this.flush();
      }
    }

    return result;
  }

  setGlobalProperties(properties: Record<string, unknown>) {
    this.globalProps = {
      ...(this.globalProps || {}),
      ...properties,
    };
  }

  track(name: string, properties?: TrackProperties) {
    this.log('track event', name, properties);
    const { groups: groupsOverride, profileId, ...rest } = properties || {};
    const mergedGroups = [
      ...new Set([...this.groups, ...(groupsOverride || [])]),
    ];
    return this.send({
      type: 'track',
      payload: {
        name,
        profileId: profileId || this.profileId,
        groups: mergedGroups.length > 0 ? mergedGroups : undefined,
        properties: {
          ...(this.globalProps || {}),
          ...rest,
        },
      },
    });
  }

  identify(payload: IdentifyPayload) {
    this.log('identify user', payload);
    if (payload.profileId) {
      this.profileId = payload.profileId;
      this.flush();
    }

    if (payload.profileId && Object.keys(payload).length > 1) {
      return this.send({
        type: 'identify',
        payload: {
          ...payload,
          properties: {
            ...(this.globalProps || {}),
            ...payload.properties,
          },
        },
      });
    }
  }

  upsertGroup(payload: UpsertGroupPayload) {
    this.log('upsert group', payload);
    return this.send({ type: 'group', payload });
  }

  setGroup(groupId: string) {
    this.log('set group', groupId);
    if (!this.groups.includes(groupId)) {
      this.groups = [...this.groups, groupId];
    }
    return this.send({
      type: 'assign_group',
      payload: { groupIds: [groupId], profileId: this.profileId },
    });
  }

  setGroups(groupIds: string[]) {
    this.log('set groups', groupIds);
    this.groups = [...new Set([...this.groups, ...groupIds])];
    return this.send({
      type: 'assign_group',
      payload: { groupIds, profileId: this.profileId },
    });
  }

  increment(payload: IncrementPayload) {
    return this.send({ type: 'increment', payload });
  }

  decrement(payload: DecrementPayload) {
    return this.send({ type: 'decrement', payload });
  }

  revenue(amount: number, properties?: TrackProperties & { deviceId?: string }) {
    const deviceId = properties?.deviceId;
    if (properties) delete properties.deviceId;
    return this.track('revenue', {
      ...(properties || {}),
      ...(deviceId ? { __deviceId: deviceId } : {}),
      __revenue: amount,
    });
  }

  getDeviceId(): string {
    return this.deviceId || '';
  }

  getSessionId(): string {
    return this.sessionId || '';
  }

  clear() {
    this.profileId = undefined;
    this.groups = [];
    this.deviceId = undefined;
    this.sessionId = undefined;
  }

  private buildFlushPayload(item: TrackHandlerPayload) {
    if (item.type === 'track') {
      const queuedGroups = item.payload.groups || [];
      const mergedGroups = [...new Set([...this.groups, ...queuedGroups])];
      return {
        ...item.payload,
        profileId: item.payload.profileId || this.profileId,
        groups: mergedGroups.length > 0 ? mergedGroups : undefined,
      };
    }
    if (
      item.type === 'identify' ||
      item.type === 'increment' ||
      item.type === 'decrement'
    ) {
      return {
        ...item.payload,
        profileId: item.payload.profileId || this.profileId,
      };
    }
    if (item.type === 'assign_group') {
      return {
        ...item.payload,
        profileId: item.payload.profileId || this.profileId,
      };
    }
    return item.payload;
  }

  flush() {
    if (!this.isOnline) return;
    const remaining: TrackHandlerPayload[] = [];
    for (const item of this.queue) {
      if (this.shouldQueue(item)) {
        remaining.push(item);
        continue;
      }
      const payload = this.buildFlushPayload(item);
      this.send({ ...item, payload } as TrackHandlerPayload);
    }
    this.queue = remaining;
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

  // --- miniprogram-specific private methods ---

  private setDefaultProperties() {
    if (typeof wx === 'undefined') return;
    try {
      const info = wx.getSystemInfoSync();
      this.setGlobalProperties({
        __platform: 'miniprogram',
        __os: info.platform,
        __model: info.model,
        __system: info.system,
        __screen: info.screenWidth + 'x' + info.screenHeight,
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
          this.queue = items.concat(this.queue);
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

  private log(...args: any[]) {
    if (this.options.debug) {
      console.log('[openpanel-miniprogram]', ...args);
    }
  }
}
