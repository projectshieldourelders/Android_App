// Global typography: Plus Jakarta Sans.
//
// React Native does not auto-select weight variants for a custom font, so we
// export thin Text / TextInput wrappers that translate any `fontWeight` in a
// style into the matching Plus Jakarta Sans family. Screens import Text /
// TextInput from here instead of from 'react-native', so every piece of text
// upgrades in one place without touching hundreds of style declarations.

import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
} from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

export const appFonts = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

const weightToFamily: Record<string, string> = {
  '100': 'PlusJakartaSans_400Regular',
  '200': 'PlusJakartaSans_400Regular',
  '300': 'PlusJakartaSans_400Regular',
  '400': 'PlusJakartaSans_400Regular',
  normal: 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
};

function fontStyleFor(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const family = flat.fontFamily || weightToFamily[flat.fontWeight != null ? String(flat.fontWeight) : '400'] || weightToFamily['400'];
  // Put font family first, keep the caller's style, then clear fontWeight so
  // platforms don't apply synthetic bolding on top of an already-weighted font.
  return [{ fontFamily: family }, style, { fontWeight: undefined }];
}

export type TextInstance = React.ComponentRef<typeof RNText>;
export type TextInputInstance = React.ComponentRef<typeof RNTextInput>;

export const Text = React.forwardRef<TextInstance, TextProps>((props, ref) => (
  <RNText ref={ref} {...props} style={fontStyleFor(props.style)} />
));
Text.displayName = 'Text';

export const TextInput = React.forwardRef<TextInputInstance, TextInputProps>((props, ref) => (
  <RNTextInput ref={ref} {...props} style={fontStyleFor(props.style)} />
));
TextInput.displayName = 'TextInput';
