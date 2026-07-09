import { Check, ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  KeyboardTypeOptions,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../state/AppProvider';
import { Theme } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Animation primitives (shared)
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A spring-based press-scale you can attach to any Pressable/Touchable. */
export function usePressScale(pressedScale = 0.96) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (theme.reducedMotion) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  };
  return {
    scale,
    onPressIn: () => to(pressedScale),
    onPressOut: () => to(1),
  };
}

/** Pressable with a built-in, layout-safe press-scale animation. */
export function PressableScale({
  children,
  onPress,
  disabled,
  style,
  pressedScale = 0.96,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityState?: { disabled?: boolean; selected?: boolean; checked?: boolean };
}) {
  const { scale, onPressIn, onPressOut } = usePressScale(pressedScale);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={[style, { transform: [{ scale }] }]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Spring pop-in (fade + scale) for panels, results, and highlights. */
export function Pop({ children, style, delay = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const theme = useTheme();
  const v = useRef(new Animated.Value(theme.reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (theme.reducedMotion) {
      v.setValue(1);
      return;
    }
    const anim = Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8, delay });
    anim.start();
    return () => anim.stop();
  }, [v, delay, theme.reducedMotion]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** A progress bar whose fill animates smoothly to `value` (0–100). */
export function AnimatedBar({ value, trackStyle, fillStyle }: { value: number; trackStyle?: StyleProp<ViewStyle>; fillStyle?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: Math.max(0, Math.min(100, value)),
      duration: theme.reducedMotion ? 0 : 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, w, theme.reducedMotion]);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={trackStyle}>
      <Animated.View style={[fillStyle, { width }]} />
    </View>
  );
}

/**
 * Memoize a theme-aware StyleSheet. The factory should call StyleSheet.create
 * itself so literal style values keep their proper types.
 */
export function useThemedStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}

// ---------------------------------------------------------------------------
// Text primitives
// ---------------------------------------------------------------------------

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySm' | 'label' | 'tiny';
type Tone = 'ink' | 'inkSoft' | 'muted' | 'brand' | 'danger' | 'onBrand';

export function AppText({
  children,
  variant = 'body',
  tone = 'ink',
  weight,
  center,
  style,
}: {
  children: React.ReactNode;
  variant?: Variant;
  tone?: Tone;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  center?: boolean;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <Text
      style={[
        {
          fontSize: theme.font(variant),
          lineHeight: theme.lineHeight(variant),
          color: theme.colors[tone],
          fontWeight: weight ? theme.weight[weight] : variant === 'body' || variant === 'bodySm' ? theme.weight.regular : theme.weight.bold,
          letterSpacing: variant === 'display' || variant === 'h1' ? -0.5 : 0,
        },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function Btn({
  label,
  onPress,
  icon: Icon,
  variant = 'primary',
  disabled,
  full = true,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  full?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeKit);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const bg = disabled
    ? theme.colors.bgWarm
    : isPrimary
      ? theme.colors.brand
      : isDanger
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.brandTint
          : 'transparent';
  const fg = disabled
    ? theme.colors.faint
    : isPrimary || isDanger
      ? theme.colors.onBrand
      : theme.colors.brand;

  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) => {
    if (theme.reducedMotion) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 7 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, !full && { alignSelf: 'flex-start' }]}>
      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: bg, minHeight: theme.tap(54) },
          variant === 'ghost' && { borderWidth: 1.5, borderColor: theme.colors.line },
          !full && { paddingHorizontal: theme.space.xl },
        ]}
        onPress={onPress}
        onPressIn={() => press(0.96)}
        onPressOut={() => press(1)}
        disabled={disabled}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
      >
        {Icon ? <Icon size={theme.icon(20)} color={fg} strokeWidth={2} /> : null}
        <Text style={{ fontSize: theme.font('body'), fontWeight: theme.weight.bold, color: fg }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Animated toggle (custom switch with a sliding thumb + color transition)
// ---------------------------------------------------------------------------

export function AnimatedToggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (theme.reducedMotion) {
      anim.setValue(value ? 1 : 0);
      return;
    }
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 20, bounciness: 12 }).start();
    // little squish on the thumb as it slides
    pop.setValue(0.82);
    Animated.spring(pop, { toValue: 1, useNativeDriver: false, speed: 18, bounciness: 14 }).start();
  }, [value, anim, pop, theme.reducedMotion]);

  const trackW = theme.tap(58);
  const trackH = theme.tap(34);
  const pad = 3;
  const thumb = trackH - pad * 2;
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [pad, trackW - thumb - pad], extrapolate: 'clamp' });
  const backgroundColor = anim.interpolate({ inputRange: [0, 1], outputRange: [theme.colors.lineStrong, theme.colors.brand] });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={{ width: trackW, height: trackH, borderRadius: trackH / 2, backgroundColor, justifyContent: 'center' }}>
        <Animated.View
          style={{
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
            backgroundColor: theme.colors.white,
            transform: [{ translateX }, { scale: pop }],
            ...theme.shadow('soft'),
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Segmented control (single choice)
// ---------------------------------------------------------------------------

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeKit);
  const [width, setWidth] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const itemW = width > 0 ? (width - 8) / options.length : 0; // container padding is 4 each side
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (itemW <= 0) return;
    if (theme.reducedMotion) {
      x.setValue(idx * itemW);
      return;
    }
    Animated.spring(x, { toValue: idx * itemW, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  }, [idx, itemW, x, theme.reducedMotion]);

  return (
    <View style={[styles.segment, { minHeight: theme.tap(46) }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {itemW > 0 ? (
        <Animated.View style={[styles.segmentPill, { width: itemW, transform: [{ translateX: x }] }]} />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={styles.segmentItem}
            onPress={() => onChange(option.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={{
                fontSize: theme.font('bodySm'),
                fontWeight: active ? theme.weight.bold : theme.weight.medium,
                color: active ? theme.colors.brand : theme.colors.muted,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Selectable option card (used in surveys / preference lists)
// ---------------------------------------------------------------------------

export function OptionCard({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeKit);
  const check = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (theme.reducedMotion) {
      check.setValue(selected ? 1 : 0);
      return;
    }
    Animated.spring(check, { toValue: selected ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
  }, [selected, check, theme.reducedMotion]);
  return (
    <PressableScale
      style={[
        styles.optionCard,
        { minHeight: theme.tap(56), borderColor: selected ? theme.colors.brand : theme.colors.line, backgroundColor: selected ? theme.colors.brandTintSoft : theme.colors.surface },
      ]}
      onPress={onPress}
      accessibilityRole="none"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: theme.font('body'), fontWeight: theme.weight.semibold, color: theme.colors.ink }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: theme.font('label'), color: theme.colors.muted, marginTop: 2, lineHeight: theme.lineHeight('label') }}>{description}</Text>
        ) : null}
      </View>
      <View style={[styles.radio, { borderColor: selected ? theme.colors.brand : theme.colors.lineStrong, backgroundColor: selected ? theme.colors.brand : 'transparent' }]}>
        {selected ? (
          <Animated.View style={{ transform: [{ scale: check }] }}>
            <Check size={theme.icon(15)} color={theme.colors.onBrand} strokeWidth={2.6} />
          </Animated.View>
        ) : null}
      </View>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------
// Switch row
// ---------------------------------------------------------------------------

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  icon: Icon,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: LucideIcon;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeKit);
  return (
    <View style={[styles.switchRow, { minHeight: theme.tap(56) }]}>
      {Icon ? (
        <View style={[styles.rowIcon, { backgroundColor: theme.colors.brandTint }]}>
          <Icon size={theme.icon(22)} color={theme.colors.brand} strokeWidth={1.9} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: theme.font('bodySm'), fontWeight: theme.weight.semibold, color: theme.colors.ink }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: theme.font('label'), color: theme.colors.muted, marginTop: 2, lineHeight: theme.lineHeight('label') }}>{description}</Text>
        ) : null}
      </View>
      <AnimatedToggle value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Text field
// ---------------------------------------------------------------------------

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeKit);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontSize: theme.font('label'), fontWeight: theme.weight.semibold, color: theme.colors.inkSoft }}>{label}</Text> : null}
      <TextInput
        style={[styles.field, { minHeight: multiline ? theme.tap(120) : theme.tap(54), fontSize: theme.font('body') }, multiline && { textAlignVertical: 'top', paddingTop: theme.space.md }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.faint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        accessibilityLabel={label ?? placeholder}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Settings / navigation list row
// ---------------------------------------------------------------------------

export function ListRow({
  icon: Icon,
  label,
  value,
  onPress,
  danger,
  last,
}: {
  icon?: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeKit);
  const color = danger ? theme.colors.danger : theme.colors.ink;
  return (
    <PressableScale
      style={[styles.listRow, { minHeight: theme.tap(58) }, !last && { borderBottomWidth: 1, borderBottomColor: theme.colors.line }]}
      onPress={onPress}
      disabled={!onPress}
      pressedScale={0.98}
      accessibilityLabel={label}
    >
      {Icon ? (
        <View style={[styles.rowIcon, { backgroundColor: danger ? theme.colors.dangerTint : theme.colors.brandTint }]}>
          <Icon size={theme.icon(21)} color={danger ? theme.colors.danger : theme.colors.brand} strokeWidth={1.9} />
        </View>
      ) : null}
      <Text style={{ flex: 1, fontSize: theme.font('bodySm'), fontWeight: theme.weight.semibold, color }}>{label}</Text>
      {value ? <Text style={{ fontSize: theme.font('label'), color: theme.colors.muted, marginRight: 4 }}>{value}</Text> : null}
      {onPress ? <ChevronRight size={theme.icon(20)} color={theme.colors.faint} strokeWidth={1.9} /> : null}
    </PressableScale>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontSize: theme.font('label'),
        fontWeight: theme.weight.bold,
        color: theme.colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: theme.space.sm,
        marginTop: theme.space.sm,
      }}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const styles = useThemedStyles(makeKit);
  return <View style={[styles.card, style]}>{children}</View>;
}

function makeKit(t: Theme) {
  return StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.space.sm,
      borderRadius: t.radius.md,
      paddingHorizontal: t.space.lg,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: t.colors.surfaceMuted,
      borderRadius: t.radius.md,
      padding: 4,
    },
    segmentPill: {
      position: 'absolute',
      left: 4,
      top: 4,
      bottom: 4,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surface,
      ...t.shadow('soft'),
    },
    segmentItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.sm,
      paddingHorizontal: t.space.sm,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space.md,
      borderWidth: 1.5,
      borderRadius: t.radius.md,
      padding: t.space.lg,
    },
    radio: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space.md,
      paddingVertical: t.space.sm,
    },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: t.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    field: {
      backgroundColor: t.colors.surface,
      borderWidth: 1.5,
      borderColor: t.colors.lineStrong,
      borderRadius: t.radius.md,
      paddingHorizontal: t.space.lg,
      color: t.colors.ink,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space.md,
      paddingVertical: t.space.md,
    },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.line,
      padding: t.space.lg,
      gap: t.space.md,
      ...t.shadow('soft'),
    },
  });
}
