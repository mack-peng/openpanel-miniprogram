# openpanel-miniprogram

[OpenPanel](https://openpanel.dev) SDK for WeChat Mini Programs.

## Install

```bash
npm install openpanel-miniprogram
```

## Quick Start

```typescript
// app.ts
import { OpenPanel, installAutoTracking } from 'openpanel-miniprogram';

const op = new OpenPanel({
  clientId: 'YOUR_CLIENT_ID',
  apiUrl: 'https://your-instance.com', // default: https://api.openpanel.dev
});

// Optional: auto-track page_view on every Page.onShow
installAutoTracking(op);

App({
  onLaunch() {
    // identify user when ready
    op.identify({ profileId: 'user-123' });
  },
});
```

```typescript
// pages/index/index.ts
import { OpenPanel } from 'openpanel-miniprogram';

const op = new OpenPanel({ clientId: 'YOUR_CLIENT_ID' });

Page({
  onTap() {
    op.track('button_click', { button: 'buy_now' });
  },
});
```

## Options

```typescript
interface MiniprogramOpenPanelOptions {
  clientId: string;           // Required
  clientSecret?: string;      // Only for server-side events
  apiUrl?: string;            // Default: https://api.openpanel.dev
  requestAdapter?: WxRequestAdapter;  // Default: wx
  storageAdapter?: StorageAdapter;     // Default: wx.getStorageSync/setStorageSync
  autoTrackPageView?: boolean;         // Default: true (via installAutoTracking)
  debug?: boolean;
  filter?: (payload) => boolean;
  disabled?: boolean;
}
```

## API

All methods from `@openpanel/sdk` are available:

```typescript
op.track(name, properties?)
op.identify({ profileId, firstName?, lastName?, email?, properties? })
op.setGroup(groupId)
op.setGroups(groupIds)
op.upsertGroup({ id, type, name, properties? })
op.increment({ profileId, property, value? })
op.decrement({ profileId, property, value? })
op.revenue(amount, properties?)
op.setGlobalProperties(properties)
op.clear()
op.screenView(pagePath, properties?)  // miniprogram-specific
op.destroy()                          // cleanup listeners
```

## Offline Support

Events are automatically queued when the device is offline and flushed when connectivity returns. The queue is persisted to `wx.storage` so events survive app restarts.

## How It Works

- Extends `@openpanel/sdk` core class
- Replaces HTTP layer with `wx.request`
- Persists offline queue + device/session IDs via `wx.storage`
- Listens to network status changes for auto-flush
- Auto-populates global properties: `__platform`, `__os`, `__model`, `__system`, `__screen`, `__wxVersion`, `__sdkVersion`

## License

MIT
