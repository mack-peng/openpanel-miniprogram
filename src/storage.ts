import type { StorageAdapter } from './types';

declare const wx: {
  getStorageSync(key: string): any;
  setStorageSync(key: string, value: any): void;
  removeStorageSync(key: string): void;
};

export const defaultStorageAdapter: StorageAdapter = {
  getItem(key: string): string | null {
    try {
      const v = wx.getStorageSync(key);
      return v ? String(v) : null;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      wx.setStorageSync(key, value);
    } catch {
      // silently ignore
    }
  },

  removeItem(key: string): void {
    try {
      wx.removeStorageSync(key);
    } catch {
      // silently ignore
    }
  },
};
