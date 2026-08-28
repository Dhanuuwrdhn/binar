import React from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text } from 'react-native';
import { Binar } from '../core/BinarCore';

const DRAG_SLOP = 6;
/** How long the "confirm clear" (trash) state stays up if the user doesn't tap it. */
const CLEAR_MODE_TIMEOUT_MS = 3000;

/**
 * Persistent floating badge; shows the unseen-call count when there is one.
 * Tap opens the inspector. Long-press swaps it into a "confirm clear" state
 * (trash icon) — tap again to clear all logs, or wait and it reverts.
 * Dragging (past DRAG_SLOP) moves it anywhere on screen instead of tapping.
 * Hidden only when showNotification is false or the inspector is open.
 */
export function NotificationBubble({ count }: { count: number }) {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const [clearMode, setClearMode] = React.useState(false);
  const clearModeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const exitClearMode = React.useCallback(() => {
    if (clearModeTimer.current) clearTimeout(clearModeTimer.current);
    setClearMode(false);
  }, []);

  React.useEffect(() => () => {
    if (clearModeTimer.current) clearTimeout(clearModeTimer.current);
  }, []);

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
    if (clearMode) {
      Binar.clear();
      exitClearMode();
    } else {
      Binar.open();
    }
  };

  const handleLongPress = () => {
    setClearMode(true);
    if (clearModeTimer.current) clearTimeout(clearModeTimer.current);
    clearModeTimer.current = setTimeout(exitClearMode, CLEAR_MODE_TIMEOUT_MS);
  };

  // Always visible while showNotification is on — the bubble is the entry
  // point to the inspector, so it must survive the unseen count hitting 0
  // (e.g. right after the inspector is closed). Only the badge is conditional.
  return (
    <Animated.View
      style={[
        styles.bubble,
        clearMode ? styles.bubbleClear : count > 0 ? styles.bubbleActive : styles.bubbleIdle,
        { transform: pan.getTranslateTransform() },
      ]}
      {...responder.panHandlers}
    >
      <Pressable onPress={handlePress} onLongPress={handleLongPress} hitSlop={8}>
        <Text style={styles.text}>
          {clearMode ? '\u{1F5D1}️' : `⚙️ ${count > 99 ? '99+' : count}`}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    right: 16,
    bottom: 48,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 9999,
  },
  // Not clicked yet / nothing captured: transparent grey.
  bubbleIdle: { backgroundColor: 'rgba(120,120,120,0.35)' },
  // Has captured at least one call: solid blue.
  bubbleActive: { backgroundColor: '#1565c0' },
  // Held: red, offering to clear all logs.
  bubbleClear: { backgroundColor: '#c62828' },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
