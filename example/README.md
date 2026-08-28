# @dhanuwrdhn/binar example

Minimal app showing how to wire @dhanuwrdhn/binar with the common HTTP clients.

## Run it (Expo, fastest)

```bash
npx create-expo-app binar-demo --template blank-typescript
cd binar-demo
npm install axios
npm install github:Born2Works/bornworks-react-native-network
# replace the generated App.tsx with example/App.tsx from this repo
npx expo start
```

Works in Expo Go — @dhanuwrdhn/binar is JS-only, no native code.

## Run it (bare React Native)

```bash
npx @react-native-community/cli init BinarDemo
cd BinarDemo
npm install axios github:Born2Works/bornworks-react-native-network
# replace App.tsx with example/App.tsx from this repo
npm run android   # or: npm run ios
```

## What to try

1. Tap the request buttons — a blue bubble appears bottom-right with the call count.
2. Tap the bubble (or "Open inspector") → list of calls, newest first, color-coded status.
3. Tap a row → Overview / Request / Response tabs with headers and pretty-printed JSON bodies.
4. "Mute notifications" hides the bubble; the inspector stays reachable via `Binar.open()`.
5. Note `Authorization`/`Cookie` headers show as `***` (redaction on by default).
