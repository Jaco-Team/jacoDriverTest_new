// Reused from jaco-cook-app: native keyboard frames and a stable form canvas.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  Keyboard,
  Dimensions,
  Platform,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type TextInput,
  type View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { getKeyboardAnimationDuration, KEYBOARD_SCROLL_DURATION_MS } from './duration';
import { getKeyboardScrollGeometry, type Rect } from './geometry';

type Focus = { id: string; input: ComponentRef<typeof TextInput> | null };

export function useKeyboardScroll(gap: number) {
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const canvasRef = useRef<ComponentRef<typeof View>>(null);
  const fieldsRef = useRef<ComponentRef<typeof View>>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [spacer, setSpacer] = useState(0);
  const geometry = useRef({
    viewportHeight: 0,
    viewportWidth: 0,
    canvasHeight: 0,
    contentHeight: 0,
    frozen: false,
    keyboard: null as Rect | null,
    focus: null as Focus | null,
    version: 0,
    mounted: true,
    duration: 0,
    target: 0,
    appliedTarget: 0,
    pending: false,
    desiredSpacer: 0,
    requestVersion: 0,
    androidSessionTarget: 0,
    androidReserveGap: false,
  });
  const animatedOffset = useSharedValue(0);
  const actualOffset = useSharedValue(0);
  const request = useSharedValue({
    target: 0,
    duration: 0,
    version: 0,
    geometryVersion: 0,
  });
  const finishScroll = useCallback(
    (version: number, epoch: number, finished: boolean) => {
      const state = geometry.current;
      if (
        !state.mounted ||
        state.requestVersion !== version ||
        (state.keyboard && state.version !== epoch) ||
        (!finished && state.keyboard)
      ) {
        return;
      }
      setSpacer(state.keyboard ? state.desiredSpacer : 0);
    },
    [],
  );

  useAnimatedReaction(
    () => request.get(),
    next => {
      cancelAnimation(animatedOffset);
      animatedOffset.set(actualOffset.get());
      animatedOffset.set(
        withTiming(next.target, { duration: next.duration }, finished => {
          // A drag may cancel the return. Cleanup must still run, while the
          // request version prevents an old return from touching a new IME.
          scheduleOnRN(
            finishScroll,
            next.version,
            next.geometryVersion,
            Boolean(finished),
          );
        }),
      );
    },
  );
  useAnimatedReaction(
    () => animatedOffset.get(),
    offset => scrollTo(scrollRef, 0, offset, false),
  );
  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      actualOffset.set(event.contentOffset.y);
    },
    onBeginDrag: () => {
      cancelAnimation(animatedOffset);
    },
  });

  const applyTarget = useCallback(
    (force = false) => {
      const state = geometry.current;
      // Wait for native content size to acknowledge the spacer. Otherwise the
      // scroll command can be clamped and never reach its calculated target.
      if (
        Math.max(0, state.contentHeight - state.viewportHeight) + 0.5 <
          state.target ||
        (!force && !state.pending)
      ) {
        return;
      }
      state.appliedTarget = state.target;
      state.pending = false;
      request.set({
        target: state.target,
        duration: state.duration,
        version: ++state.requestVersion,
        geometryVersion: state.version,
      });
    },
    [request],
  );

  const sync = useCallback(() => {
    const state = geometry.current;
    const version = ++state.version;
    state.pending = false;
    const focus = state.focus;
    const canvas = canvasRef.current;
    const fields = fieldsRef.current ?? focus?.input;
    if (!focus || !canvas || !fields || !state.keyboard) return;
    const current = () =>
      state.mounted && state.version === version && state.focus === focus;
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (!current() || !width || !height) return;
      fields.measureLayout(canvas, (gx, gy, gw, gh) => {
        if (!current()) return;
        const commit = (active?: Rect) => {
          if (!current()) return;
          const next = getKeyboardScrollGeometry({
            viewport: { x, y, width, height: state.viewportHeight },
            canvasHeight: state.canvasHeight,
            group: { x: gx, y: gy, width: gw, height: gh },
            active,
            keyboard: state.keyboard,
            gap,
          });
          if (Platform.OS === 'android') {
            // Reserve one gap for the numeric IME's next height change. Keep
            // the native-frame snapshot across focus changes until didShow.
            const reservedTarget =
              next.target > 0 && state.androidReserveGap
                ? next.target + gap
                : next.target;
            next.target = Math.max(state.androidSessionTarget, reservedTarget);
            state.androidSessionTarget = next.target;
            next.spacer = Math.max(
              next.spacer,
              next.target + state.viewportHeight - state.canvasHeight,
            );
          }
          state.target = next.target;
          state.pending = true;
          state.desiredSpacer = next.spacer;
          // Shrinking the native range before the offset reaches its smaller
          // target would clamp the scroll instead of animating it.
          setSpacer(previous => Math.max(previous, next.spacer));
          applyTarget(true);
        };
        // Group geometry is a single native measurement, never assembled
        // from independently delivered child layout events.
        if (focus.input) {
          focus.input.measureLayout(canvas, (ax, ay, aw, ah) =>
            commit({ x: ax, y: ay, width: aw, height: ah }),
          );
        } else {
          commit();
        }
      });
    });
  }, [applyTarget, gap]);

  const onViewportLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      const state = geometry.current;
      const resized =
        (state.viewportWidth > 0 &&
          Math.abs(layout.width - state.viewportWidth) > 1) ||
        (Platform.OS === 'ios' && layout.height !== state.viewportHeight);
      state.viewportHeight = layout.height;
      state.viewportWidth = layout.width;
      if (!state.frozen || !state.canvasHeight || resized) {
        state.canvasHeight = layout.height;
        setCanvasHeight(layout.height);
      }
      sync();
      applyTarget();
    },
    [applyTarget, sync],
  );

  const onFocus = useCallback(
    (id: string, input: ComponentRef<typeof TextInput> | null) => {
      const state = geometry.current;
      state.focus = { id, input };
      // Android can resize before delivering didShow.
      state.frozen = true;
      state.duration =
        Platform.OS === 'android' ? KEYBOARD_SCROLL_DURATION_MS : 180;
      sync();
    },
    [sync],
  );
  const onBlur = useCallback((id: string) => {
    const state = geometry.current;
    if (state.focus?.id === id) {
      state.focus = null;
      state.pending = false;
      state.version++;
    }
  }, []);

  useEffect(() => {
    const state = geometry.current;
    state.mounted = true;
    const hide = (event: KeyboardEvent) => {
      state.version++;
      state.keyboard = null;
      state.frozen = false;
      state.duration = getKeyboardAnimationDuration(
        Platform.OS,
        event.duration,
      );
      state.target = 0;
      if (Platform.OS === 'android') {
        state.androidSessionTarget = 0;
        state.androidReserveGap = false;
      }
      state.pending = true;
      state.desiredSpacer = 0;
      // Do not remove range while the return animation still needs it.
      // The next full viewport layout restores the canvas. In particular,
      // Android didHide can arrive before the restored viewport onLayout.
      applyTarget(true);
    };
    const change = (event: KeyboardEvent) => {
      const end = event.endCoordinates;
      if (end.height <= 0 || end.screenY >= Dimensions.get('screen').height) {
        hide(event);
        return;
      }
      state.keyboard = {
        x: end.screenX,
        y: end.screenY,
        width: end.width,
        height: end.height,
      };
      if (Platform.OS === 'android') {
        state.androidReserveGap = state.focus?.id === 'auth-login-input';
      }
      state.frozen = true;
      state.duration = getKeyboardAnimationDuration(
        Platform.OS,
        event.duration,
      );
      sync();
    };
    const changed = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      change,
    );
    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      hide,
    );
    return () => {
      state.mounted = false;
      state.version++;
      changed.remove();
      hidden.remove();
    };
  }, [applyTarget, sync]);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      geometry.current.contentHeight = height;
      applyTarget();
    },
    [applyTarget],
  );

  return {
    rootRef,
    canvasRef,
    fieldsRef,
    scrollRef,
    canvasHeight,
    spacer,
    onViewportLayout,
    onContentSizeChange,
    onScroll,
    onFocus,
    onBlur,
    onFieldsLayout: sync,
  };
}
