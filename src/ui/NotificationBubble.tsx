import React from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Binar } from '../core/BinarCore';
import { colors } from './theme';

const DRAG_SLOP = 6;
/** How long the "confirm clear" (trash) state stays up if the user doesn't tap it. */
const CLEAR_MODE_TIMEOUT_MS = 3000;
/** How long the first-run coach mark stays up if the user doesn't interact with the bubble. */
const COACH_MARK_TIMEOUT_MS = 5000;

/** Shown once per app session — resets on reload/cold start, which is fine for a dev tool: most confusion happens the first time someone sees the bubble in a given run. */
let hasShownCoachMark = false;

/**
 * Persistent floating badge; shows the unseen-call count when there is one.
 * Tap opens the inspector. Long-press swaps it into a "confirm clear" state
 * (trash icon) — tap again to clear all logs, or wait and it reverts.
 * Dragging (past DRAG_SLOP) moves it anywhere on screen instead of tapping.
 * Hidden only when showNotification is false or the inspector is open.
 */
export function NotificationBubble({ count }: { count: number }) {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const scale = React.useRef(new Animated.Value(1)).current;
  const [clearMode, setClearMode] = React.useState(false);
  const clearModeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCoachMark, setShowCoachMark] = React.useState(!hasShownCoachMark);
  const coachMarkOpacity = React.useRef(new Animated.Value(0)).current;
  const coachMarkTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const exitClearMode = React.useCallback(() => {
    if (clearModeTimer.current) clearTimeout(clearModeTimer.current);
    setClearMode(false);
  }, []);

  const dismissCoachMark = React.useCallback(() => {
    if (coachMarkTimer.current) clearTimeout(coachMarkTimer.current);
    Animated.timing(coachMarkOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => setShowCoachMark(false)
    );
  }, [coachMarkOpacity]);

  React.useEffect(() => {
    if (!showCoachMark) return;
    hasShownCoachMark = true;
    Animated.timing(coachMarkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    coachMarkTimer.current = setTimeout(dismissCoachMark, COACH_MARK_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => () => {
    if (clearModeTimer.current) clearTimeout(clearModeTimer.current);
    if (coachMarkTimer.current) clearTimeout(coachMarkTimer.current);
  }, []);

  // A brief pulse whenever a new call bumps the unseen count — the color
  // change alone (grey → blue) is easy to miss in peripheral vision.
  const prevCount = React.useRef(count);
  React.useEffect(() => {
    if (count > prevCount.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    prevCount.current = count;
  }, [count, scale]);

  const responder = React.useRef(
    PanResponder.create({
      // Capture phase so the drag steals the gesture from the inner Pressable
      // once the finger actually moves; plain taps stay with the Pressable.
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        Math.abs(gesture.dx) > DRAG_SLOP || Math.abs(gesture.dy) > DRAG_SLOP,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => pan.extractOffset(),
      onPanResponderTerminate: () => pan.extractOffset(),
    }),
  ).current;

  const handlePress = () => {
    if (showCoachMark) dismissCoachMark();
    if (clearMode) {
      Binar.clear();
      exitClearMode();
    } else {
      Binar.open();
    }
  };

  const handleLongPress = () => {
    if (showCoachMark) dismissCoachMark();
    setClearMode(true);
    if (clearModeTimer.current) clearTimeout(clearModeTimer.current);
    clearModeTimer.current = setTimeout(exitClearMode, CLEAR_MODE_TIMEOUT_MS);
  };

  // Always visible while showNotification is on — the bubble is the entry
  // point to the inspector, so it must survive the unseen count hitting 0
  // (e.g. right after the inspector is closed). Only the badge is conditional.
  return (
    <Animated.View
      style={[styles.wrap, { transform: pan.getTranslateTransform() }]}
      {...responder.panHandlers}
    >
      {showCoachMark && (
        <Animated.View style={[styles.coachMark, { opacity: coachMarkOpacity }]}>
          <Text style={styles.coachMarkText}>Tap to view network calls · Hold for more</Text>
        </Animated.View>
      )}
      <Animated.View
        style={[
          styles.bubble,
          clearMode ? styles.bubbleClear : count > 0 ? styles.bubbleActive : styles.bubbleIdle,
          { transform: [{ scale }] },
        ]}
      >
        <Pressable onPress={handlePress} onLongPress={handleLongPress} hitSlop={8} style={styles.pressable}>
          {clearMode ? (
            <>
              <Text style={styles.icon}>{'\u{1F5D1}️'}</Text>
              <Text style={styles.caption}>Clear</Text>
            </>
          ) : (
            <Text style={styles.text}>{`⇅ ${count > 99 ? '99+' : count}`}</Text>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    bottom: 48,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  coachMark: {
    marginBottom: 8,
    maxWidth: 220,
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  coachMarkText: { color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  bubble: {
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pressable: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  // Not clicked yet / nothing captured: transparent grey.
  bubbleIdle: { backgroundColor: 'rgba(120,120,120,0.35)' },
  // Has captured at least one call: solid accent color.
  bubbleActive: { backgroundColor: colors.accent },
  // Held: danger color, offering to clear all logs.
  bubbleClear: { backgroundColor: colors.danger },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
  icon: { fontSize: 16 },
  caption: { color: '#fff', fontWeight: '600', fontSize: 9, marginTop: 1 },
});
