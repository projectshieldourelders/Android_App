import {
  Accessibility,
  Contrast,
  Eye,
  FileText,
  Languages,
  MousePointerClick,
  Shield,
  Trash2,
  UserRound,
  Zap,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, TouchableOpacity, View } from 'react-native';

import { privacyFull, termsFull } from '../data/legal';
import { cancelAllReminders, scheduleSafetyReminders } from '../services/notifications';
import { useApp, useTheme } from '../state/AppProvider';
import {
  AiResponseStyle,
  AlertSensitivity,
  Difficulty,
  LearningFrequency,
  NotificationCadence,
  ScalePref,
  ThemePref,
} from '../types/app';
import { AppText, Btn, Card, ListRow, SectionLabel, SegmentedControl, SwitchRow, TextField } from '../ui/kit';

export default function Settings() {
  const theme = useTheme();
  const { profile, prefs, updatePrefs, updateAccessibility, updateProfile, resetAll } = useApp();
  const a = prefs.accessibility;

  const [name, setName] = useState(profile?.name ?? '');
  const [age, setAge] = useState(profile?.age ?? '');
  const [legal, setLegal] = useState<null | 'tos' | 'privacy'>(null);

  const scaleOptions: Array<{ value: ScalePref; label: string }> = [
    { value: 'default', label: 'Default' },
    { value: 'large', label: 'Large' },
    { value: 'larger', label: 'Largest' },
  ];

  function changeCadence(value: NotificationCadence) {
    updatePrefs({ notificationCadence: value });
    scheduleSafetyReminders(value);
  }

  function confirmReset() {
    Alert.alert(
      'Delete all data?',
      'This erases your profile, preferences, contacts, progress, and history from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            cancelAllReminders();
            resetAll();
          },
        },
      ],
    );
  }

  return (
    <View style={{ gap: theme.space.xl }}>
      {/* Profile */}
      <View>
        <SectionLabel>Profile</SectionLabel>
        <Card>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Your first name" autoCapitalize="words" />
          <TextField label="Age" value={age} onChangeText={setAge} placeholder="Optional" keyboardType="number-pad" />
          <Btn
            label="Save profile"
            variant="secondary"
            icon={UserRound}
            onPress={() => {
              updateProfile({ name: name.trim(), age: age.trim(), createdAt: profile?.createdAt ?? new Date().toISOString() });
              Alert.alert('Saved', 'Your profile was updated on this device.');
            }}
          />
        </Card>
      </View>

      {/* Appearance & accessibility */}
      <View>
        <SectionLabel>Appearance</SectionLabel>
        <Card style={{ gap: theme.space.lg }}>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              Theme
            </AppText>
            <SegmentedControl<ThemePref>
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'Automatic' },
              ]}
              value={prefs.theme}
              onChange={(value) => updatePrefs({ theme: value })}
            />
          </View>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              Text size
            </AppText>
            <SegmentedControl<ScalePref> options={scaleOptions} value={a.textSize} onChange={(value) => updateAccessibility({ textSize: value })} />
          </View>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              Icon size
            </AppText>
            <SegmentedControl<ScalePref> options={scaleOptions} value={a.iconSize} onChange={(value) => updateAccessibility({ iconSize: value })} />
          </View>
        </Card>
      </View>

      <View>
        <SectionLabel>Accessibility</SectionLabel>
        <Card style={{ gap: 0 }}>
          <SwitchRow icon={Contrast} label="High contrast" description="Stronger colors and borders" value={a.highContrast} onValueChange={(v) => updateAccessibility({ highContrast: v })} />
          <SwitchRow icon={Eye} label="Dark mode" description="Overrides theme to dark" value={prefs.theme === 'dark'} onValueChange={(v) => updatePrefs({ theme: v ? 'dark' : 'light' })} />
          <SwitchRow icon={Zap} label="Reduce motion" description="Fewer animations" value={a.reduceMotion} onValueChange={(v) => updateAccessibility({ reduceMotion: v })} />
          <SwitchRow icon={MousePointerClick} label="Larger tap targets" description="Bigger buttons and rows" value={a.largeTapTargets} onValueChange={(v) => updateAccessibility({ largeTapTargets: v })} />
          <SwitchRow icon={Languages} label="Simple language" description="Shorter, plainer wording" value={a.simplifiedLanguage} onValueChange={(v) => updateAccessibility({ simplifiedLanguage: v })} />
          <SwitchRow icon={Accessibility} label="Screen reader support" description="Optimized labels for voice-over" value={a.screenReader} onValueChange={(v) => updateAccessibility({ screenReader: v })} />
        </Card>
      </View>

      {/* Notifications */}
      <View>
        <SectionLabel>Notifications</SectionLabel>
        <Card style={{ gap: theme.space.lg }}>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              Safety reminders
            </AppText>
            <SegmentedControl<NotificationCadence>
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Every 2 weeks' },
                { value: 'off', label: 'Off' },
              ]}
              value={prefs.notificationCadence}
              onChange={changeCadence}
            />
          </View>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              Alert sensitivity
            </AppText>
            <SegmentedControl<AlertSensitivity>
              options={[
                { value: 'low', label: 'Fewer' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'high', label: 'More' },
              ]}
              value={prefs.alertSensitivity}
              onChange={(value) => updatePrefs({ alertSensitivity: value })}
            />
            <AppText variant="label" tone="muted">
              Controls how cautious detection is when checking calls and messages.
            </AppText>
          </View>
        </Card>
      </View>

      {/* Learning */}
      <View>
        <SectionLabel>Learning</SectionLabel>
        <Card style={{ gap: theme.space.lg }}>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              How we explain things
            </AppText>
            <SegmentedControl<AiResponseStyle>
              options={[
                { value: 'simple', label: 'Simple' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'detailed', label: 'Detailed' },
              ]}
              value={prefs.aiResponseStyle}
              onChange={(value) => updatePrefs({ aiResponseStyle: value })}
            />
          </View>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              Lesson difficulty
            </AppText>
            <SegmentedControl<Difficulty>
              options={[
                { value: 'beginner', label: 'Gentle' },
                { value: 'intermediate', label: 'Medium' },
                { value: 'advanced', label: 'In-depth' },
              ]}
              value={prefs.difficulty}
              onChange={(value) => updatePrefs({ difficulty: value })}
            />
          </View>
          <View style={{ gap: theme.space.sm }}>
            <AppText variant="bodySm" weight="semibold">
              Learning reminders
            </AppText>
            <SegmentedControl<LearningFrequency>
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Every 2 weeks' },
                { value: 'off', label: 'Off' },
              ]}
              value={prefs.learningFrequency}
              onChange={(value) => updatePrefs({ learningFrequency: value })}
            />
          </View>
        </Card>
      </View>

      {/* Privacy & legal */}
      <View>
        <SectionLabel>Privacy &amp; security</SectionLabel>
        <Card style={{ gap: 0, padding: 0, paddingHorizontal: theme.space.lg }}>
          <ListRow icon={Shield} label="How your data is protected" onPress={() => setLegal('privacy')} />
          <ListRow icon={FileText} label="Terms of Service" onPress={() => setLegal('tos')} />
          <ListRow icon={FileText} label="Privacy Policy" onPress={() => setLegal('privacy')} last />
        </Card>
      </View>

      <View>
        <SectionLabel>Data controls</SectionLabel>
        <Card style={{ gap: 0, padding: 0, paddingHorizontal: theme.space.lg }}>
          <ListRow icon={Trash2} label="Delete all my data" onPress={confirmReset} danger last />
        </Card>
        <AppText variant="label" tone="muted" style={{ marginTop: theme.space.sm }}>
          Everything is stored only on this device. Deleting is permanent.
        </AppText>
      </View>

      <Modal visible={legal !== null} animationType="slide" onRequestClose={() => setLegal(null)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 54,
              paddingHorizontal: theme.space.xl,
              paddingBottom: theme.space.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.line,
              backgroundColor: theme.colors.surface,
            }}
          >
            <AppText variant="h2" weight="bold">
              {legal === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
            </AppText>
            <TouchableOpacity onPress={() => setLegal(null)} accessibilityLabel="Close">
              <AppText variant="bodySm" tone="brand" weight="bold">
                Done
              </AppText>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: theme.space.xl, paddingBottom: 60, gap: theme.space.md }}>
            {(legal === 'tos' ? termsFull : privacyFull).split('\n\n').map((line, i) => (
              <AppText key={i} variant="bodySm" tone="inkSoft">
                {line}
              </AppText>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
