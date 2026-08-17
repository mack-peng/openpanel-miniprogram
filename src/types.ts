export type IProfileId = string | number;

export interface IGroupPayload {
  id: string;
  type: string;
  name: string;
  properties?: Record<string, unknown>;
}

export interface IAssignGroupPayload {
  groupIds: string[];
  profileId?: IProfileId;
}

export interface ITrackPayload {
  name: string;
  properties?: Record<string, unknown>;
  profileId?: IProfileId;
  groups?: string[];
}

export interface IIdentifyPayload {
  profileId: IProfileId;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  properties?: Record<string, unknown>;
}

export interface IIncrementPayload {
  profileId: IProfileId;
  property: string;
  value?: number;
}

export interface IDecrementPayload {
  profileId: IProfileId;
  property: string;
  value?: number;
}

export interface IAliasPayload {
  profileId: IProfileId;
  alias: string;
}

export type ITrackHandlerPayload =
  | { type: 'track'; payload: ITrackPayload }
  | { type: 'identify'; payload: IIdentifyPayload }
  | { type: 'increment'; payload: IIncrementPayload }
  | { type: 'decrement'; payload: IDecrementPayload }
  | { type: 'alias'; payload: IAliasPayload }
  | { type: 'group'; payload: IGroupPayload }
  | { type: 'assign_group'; payload: IAssignGroupPayload };

export type AliasPayload = IAliasPayload;
export type AssignGroupPayload = IAssignGroupPayload;
export type DecrementPayload = IDecrementPayload;
export type GroupPayload = IGroupPayload;
export type IdentifyPayload = IIdentifyPayload;
export type IncrementPayload = IIncrementPayload;
export type TrackHandlerPayload = ITrackHandlerPayload;
export type TrackPayload = ITrackPayload;
export type UpsertGroupPayload = GroupPayload;

export interface TrackProperties {
  [key: string]: unknown;
  profileId?: string;
  groups?: string[];
}

export interface OpenPanelOptions {
  clientId: string;
  clientSecret?: string;
  apiUrl?: string;
  sdkVersion?: string;
  waitForProfile?: boolean;
  filter?: (payload: TrackHandlerPayload) => boolean;
  disabled?: boolean;
  debug?: boolean;
}

/** wx.request style adapter */
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

/** Storage adapter (synchronous, matching wx.storage API) */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Options for the miniprogram OpenPanel client */
export interface MiniprogramOpenPanelOptions extends OpenPanelOptions {
  requestAdapter?: WxRequestAdapter;
  storageAdapter?: StorageAdapter;
  autoTrackPageView?: boolean;
}
