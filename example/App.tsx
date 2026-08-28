import React from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import { Binar, BinarProvider } from '@dhanuwrdhn/binar';

// 1) Init as early as possible — before any request fires.
//    In a real app, put this at the top of index.js.
Binar.init({
  showNotification: true, // floating bubble on new calls; Binar.setNotification(false) to silence
  maxCallsCount: 500,
  // redactedHeaders: ['authorization', 'cookie', 'x-api-key'],
  // ignoredUrls: [/analytics/],
});

const BASE = 'https://jsonplaceholder.typicode.com';

function Demo() {
  // fetch — captured automatically via the fetch wrapper
  const doFetchGet = () => fetch(`${BASE}/todos/1`).catch(() => {});

  // axios — captured automatically via the XHR patch, nothing to attach
  const doAxiosPost = () =>
    axios
      .post(`${BASE}/posts`, { title: 'hello', body: 'from Binar example' })
      .catch(() => {});

  // raw XMLHttpRequest — also captured via the XHR patch
  const doRawXhr = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${BASE}/users/1`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send();
  };

  // error case — shows up red in the list
  const doError = () => fetch(`${BASE}/definitely-not-found-404`).catch(() => {});

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Binar example</Text>
      <View style={styles.buttons}>
        <Button title="GET via fetch" onPress={doFetchGet} />
        <Button title="POST via axios" onPress={doAxiosPost} />
        <Button title="GET via raw XHR" onPress={doRawXhr} />
        <Button title="Trigger 404 error" onPress={doError} />
        <View style={styles.spacer} />
        <Button title="Open inspector" onPress={() => Binar.open()} />
        <Button title="Mute notifications" onPress={() => Binar.setNotification(false)} />
        <Button title="Unmute notifications" onPress={() => Binar.setNotification(true)} />
        <Button title="Clear captured calls" onPress={() => Binar.clear()} />
      </View>
      <Text style={styles.hint}>
        Fire a few requests, then tap the blue bubble (or "Open inspector") and tap a row to see
        headers, bodies, status and timing.
      </Text>
    </SafeAreaView>
  );
}

// 2) Wrap the app once. The Modal-based inspector needs no navigator.
export default function App() {
  return (
    <BinarProvider>
      <Demo />
    </BinarProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  buttons: { gap: 8, marginTop: 12 },
  spacer: { height: 16 },
  hint: { marginTop: 16, color: '#666', fontSize: 13 },
});
