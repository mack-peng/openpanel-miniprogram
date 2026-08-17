import type { WxRequestAdapter } from './types';

interface WxApiConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  maxRetries?: number;
  initialRetryDelay?: number;
  requestAdapter: WxRequestAdapter;
}

interface FetchOptions {
  keepalive?: boolean;
  retries?: number;
}

export class WxApi {
  private baseUrl: string;
  private headers: Record<string, string>;
  private maxRetries: number;
  private initialRetryDelay: number;
  private requestAdapter: WxRequestAdapter;

  constructor(config: WxApiConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ...(config.defaultHeaders || {}),
    };
    this.maxRetries = config.maxRetries || 3;
    this.initialRetryDelay = config.initialRetryDelay || 500;
    this.requestAdapter = config.requestAdapter;
  }

  public addHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  private wxRequest(
    url: string,
    data: string,
    header: Record<string, string>,
  ): Promise<{ statusCode: number; data: any }> {
    return new Promise((resolve, reject) => {
      this.requestAdapter.request({
        url,
        method: 'POST',
        data,
        header,
        success: resolve,
        fail: reject,
      });
    });
  }

  private async post<ReqBody, ResBody>(
    url: string,
    data: ReqBody,
    attempt: number,
  ): Promise<ResBody | null> {
    try {
      const res = await this.wxRequest(
        url,
        data ? JSON.stringify(data) : '',
        this.headers,
      );

      if (res.statusCode === 401) return null;

      if (res.statusCode !== 200 && res.statusCode !== 202) {
        throw new Error('HTTP error! status: ' + res.statusCode);
      }

      if (typeof res.data === 'string') {
        return res.data ? JSON.parse(res.data) : null;
      }
      return res.data || null;
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.initialRetryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.post<ReqBody, ResBody>(url, data, attempt + 1);
      }
      console.error('[openpanel-miniprogram] Max retries reached:', error);
      return null;
    }
  }

  async fetch<ReqBody, ResBody>(
    path: string,
    data: ReqBody,
    _options?: FetchOptions,
  ): Promise<ResBody | null> {
    const url = this.baseUrl + path;
    return this.post<ReqBody, ResBody>(url, data, 0);
  }
}
