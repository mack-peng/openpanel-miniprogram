# openpanel-miniprogram

[OpenPanel](https://openpanel.dev) SDK for WeChat Mini Programs. Zero external runtime dependencies.

## Install

```bash
npm install openpanel-miniprogram
```

## Quick Start

```typescript
// app.ts
import { OpenPanel } from 'openpanel-miniprogram';

const op = new OpenPanel({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET', // required for self-hosted instances
  apiUrl: 'https://your-instance.com/api', // default: https://api.openpanel.dev
});

App({
  onLaunch() {
    // identify user when ready
    op.identify({ profileId: 'user-123', firstName: 'Alice' });
  },
  logout() {
    op.clear();
  },
});
```

```typescript
// pages/index/index.ts
import { op } from '~/app';

Page({
  onTap() {
    op.track('button_click', { button: 'buy_now' });
  },
});
```

## Options

```typescript
interface MiniprogramOpenPanelOptions {
  clientId: string;                  // Required
  clientSecret?: string;             // Required for self-hosted instances
  apiUrl?: string;                   // Default: https://api.openpanel.dev
  requestAdapter?: WxRequestAdapter; // Default: wx
  storageAdapter?: StorageAdapter;   // Default: wx.getStorageSync/setStorageSync
  waitForProfile?: boolean;          // Queue events until identify() is called
  filter?: (payload) => boolean;     // Filter events before sending
  disabled?: boolean;                // Disable all tracking
  debug?: boolean;                   // Log to console
}
```

## API

### Tracking

```typescript
op.track(name, properties?)
op.screenView(pagePath, properties?)  // shorthand for track('screen_view', { __path: pagePath })
op.revenue(amount, properties?)       // shorthand for track('revenue', { __revenue: amount })
```

### User Identity

```typescript
op.identify({ profileId, firstName?, lastName?, email?, avatar?, properties? })
op.clear()  // clear user identity, groups, device/session IDs
```

### Groups (B2B)

```typescript
op.setGroup(groupId)                  // add user to a group
op.setGroups(groupIds)                // add user to multiple groups
op.upsertGroup({ id, type, name, properties? })  // create/update a group
```

### User Properties

```typescript
op.increment({ profileId, property, value? })
op.decrement({ profileId, property, value? })
```

### Global Properties

```typescript
op.setGlobalProperties({ key: 'value' })  // merged into every event
```

### Lifecycle

```typescript
op.ready()          // enable SDK + flush queued events
op.flush()          // manually flush offline queue
op.destroy()        // cleanup network listeners
op.getDeviceId()    // get persisted device ID
op.getSessionId()   // get persisted session ID
```

## Auto Tracking (Optional)

Automatically track common scenarios with per-event switches. **All events are enabled by default**, disable individually as needed.

| Event | Trigger | Properties | Semantics |
|-------|---------|------------|-----------|
| `screen_view` | every `Page.onShow` | `__path` page path | Fires on every page show, including hot start re-entry |
| `app_launch` | `App.onLaunch` | `__scene` / `__query` / `__path` from `wx.getLaunchOptionsSync()` | Fires **once per cold start** (new process). Hot start (background → foreground) triggers `onShow` only, so it does NOT re-fire. `__scene` is the WeChat scene value (scan / share / search entry etc.) |
| `page_share` | `onShareAppMessage` / `onShareTimeline` | `__path` page path, `__entry` (`menu` / `timeline`) | Fires when the share panel opens. WeChat cannot confirm whether the share actually completed, so treat it as a share-intent metric |

### Configuration

```typescript
import { OpenPanel, installAutoTracking } from 'openpanel-miniprogram';

const op = new OpenPanel({ clientId: 'YOUR_CLIENT_ID' });
installAutoTracking(op); // all events on (default)

// disable specific events
installAutoTracking(op, { events: { screen_view: false } });
installAutoTracking(op, { events: { screen_view: false, page_share: false } });

// advanced: resolve page path / add extra properties
installAutoTracking(op, {
  resolvePath: page => page.route || 'unknown',
  extraProperties: { source: 'home' },
  events: { app_launch: true },
});
```

How auto tracking works:

- Wraps the global `App()` / `Page()` registrations at install time, so **call it before `App({...})` / `Page({...})`** are registered
- Disabled events are not wrapped at all — no intercept, no overhead
- `screen_view` wraps `Page.onShow` and still calls your original `onShow`; `app_launch` wraps `App.onLaunch`; `page_share` wraps the share handlers and still returns your original share config

## Offline Support

Events are automatically queued when the device is offline and flushed when connectivity returns. The queue is persisted to `wx.storage` so events survive app restarts.

## How It Works

- Self-contained implementation (zero runtime dependencies)
- HTTP layer uses `wx.request` via configurable adapter
- Persists offline queue + device/session IDs via `wx.storage`
- Listens to network status changes for auto-flush
- Auto-populates global properties: `__platform`, `__os`, `__model`, `__system`, `__screen`, `__wxVersion`, `__sdkVersion`

## License

MIT
