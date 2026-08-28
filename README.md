<p align="center">
  <img src="https://raw.githubusercontent.com/Dhanuuwrdhn/binar/main/assets/binar-banner.svg" alt="Binar — in-app HTTP inspector for React Native" width="100%">
</p>

<p align="center">
  <img alt="npm version" src="https://img.shields.io/npm/v/@dhanuwrdhn/binar?style=flat-square&color=FFB627&labelColor=0E1420">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-E8EDF7?style=flat-square&labelColor=0E1420">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-6BA5FF?style=flat-square&labelColor=0E1420">
  <img alt="React Native" src="https://img.shields.io/badge/React_Native-Expo_%7C_bare-6BA5FF?style=flat-square&labelColor=0E1420">
  <img alt="Native modules: none" src="https://img.shields.io/badge/native_modules-none-3DD68C?style=flat-square&labelColor=0E1420">
  <img alt="24 tests" src="https://img.shields.io/badge/tests-24_passing-3DD68C?style=flat-square&labelColor=0E1420">
</p>

---

See every HTTP call your app makes, from inside your app. Binar captures **fetch**, **axios**, and raw **XMLHttpRequest** traffic and shows it on an in-app screen — call list, then tap through to headers, bodies, status, and timing. A floating bubble tells you when requests fire.

## One patch, three clients

In React Native, `fetch` is a polyfill built on `XMLHttpRequest`, and axios ships an XHR adapter. Binar patches XHR once and wraps `fetch` for full body access, using an internal dedupe marker so a single call is never recorded twice.

Axios needs zero configuration. So does everything else.

## Install

```bash
npm install @dhanuwrdhn/binar
```

Metro transpiles the TypeScript source directly — there is no build step.

> Running Jest in the host app? Add the package to `transformIgnorePatterns`, or Jest will fail to parse the shipped TypeScript.

## Wire it in

**1. Install the interceptors** — as early as possible, before the first request fires.

```tsx
// index.js
import { Binar } from '@dhanuwrdhn/binar';

Binar.init({ showNotification: true });
```

**2. Wrap your app root.** The inspector renders as a Modal, so no navigator is required.

```tsx
import { BinarProvider } from '@dhanuwrdhn/binar';

export default function App() {
  return (
    <BinarProvider>
      <YourApp />
    </BinarProvider>
  );
}
```

That's the whole setup. Fire requests and tap the bubble, or call `Binar.open()` from a debug menu.

## API

```ts
Binar.init(config?)            // install interceptors (no-op when enabled: false)
Binar.open() / Binar.close()   // show or hide the inspector
Binar.setNotification(bool)    // toggle the floating bubble at runtime
Binar.setScreen(name | null)   // report the active app screen (see below)
Binar.clear()                  // wipe captured calls
Binar.uninstall()              // restore the original XHR and fetch
```

### Config

| Option | Default | What it does |
|---|---|---|
| `enabled` | `__DEV__` | When `false`, nothing is patched and every API is a no-op — safe to ship |
| `showNotification` | `true` | Floating bubble with an unseen-call count; tap to open the inspector |
| `showScreenLabel` | `true` | Floating pill with the active screen name; only appears once `Binar.setScreen` is wired |
| `maxCallsCount` | `1000` | Ring buffer size; oldest calls are evicted first |
| `maxBodySize` | `1_000_000` | Bodies longer than this (in chars) are truncated with a marker |
| `redactedHeaders` | `authorization`, `cookie`, `set-cookie` | Values render as `***`, matched case-insensitively |
| `ignoredUrls` | `[]` | Strings or RegExps to skip; Metro's `/symbolicate` noise is skipped already |

### Screen label (Alice-style)

Tell Binar which screen is active and it shows a draggable floating pill with the
route name (`/Home`) on top of your app — and stamps every captured call with the
screen that fired it (visible in the call list and detail Overview).

With react-navigation:

```tsx
import { createNavigationContainerRef } from '@react-navigation/native';
import { Binar } from '@dhanuwrdhn/binar';

const navRef = createNavigationContainerRef();
const reportScreen = () => Binar.setScreen(navRef.getCurrentRoute()?.name ?? null);

<NavigationContainer ref={navRef} onReady={reportScreen} onStateChange={reportScreen}>
```

`setScreen` is a no-op when Binar is disabled, so the wiring is safe in release builds.

### Mounting as a route

`BinarProvider` needs no navigator. If you'd rather give the inspector its own route:

```tsx
import { BinarScreen } from '@dhanuwrdhn/binar';

<Stack.Screen name="BinarInspector" component={BinarScreen} />
// navigation.navigate('BinarInspector')
```

## Example app

[`example/`](./example) is a runnable app wiring up fetch, axios, and raw XHR side by side.

## What Binar does not do

- **Native traffic stays invisible.** Requests from native SDKs (Firebase, native networking libraries) never pass through JS, so they are not captured.
- **It is a dev tool.** `enabled` defaults to `__DEV__`. Leave it that way.
- **Nothing persists.** Captured calls live in memory and disappear on reload.
- **The dedupe marker.** Binar adds `x-binar-trace` to fetch requests and strips it at the XHR layer before sending, so it never reaches your server under RN's default fetch. Replace the fetch polyfill with a non-XHR transport and capture still works, but the marker may go out — strip it in your transport or ignore it server-side in dev.

## Development

```bash
npm install
npm test          # store, redaction, XHR and fetch interceptors
npm run typecheck
```

## License

MIT © [Dhanu Wardhana](https://github.com/Dhanuuwrdhn)
