// Notification service.
//
// Wraps expo-notifications for local scheduled reminders and immediate
// detection alerts. Every call is wrapped defensively so a missing module,
// denied permission, or unsupported platform never crashes the app — the
// in-app activity feed (AppProvider detections) remains the source of truth.

import { DetectionEvent, DetectionKind, NotificationCadence, RiskLevel } from '../types/app';

// Loaded lazily and loosely typed so the app degrades gracefully across
// expo-notifications versions and when running where it is unavailable.
let Notifications: any = null;
let loadAttempted = false;

function getModule(): any {
  if (loadAttempted) return Notifications;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Notifications = require('expo-notifications');
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
          // Older API keys (ignored by newer versions):
          shouldShowAlert: true,
        }),
      });
    }
  } catch {
    Notifications = null;
  }
  return Notifications;
}

const REMINDER_IDENTIFIER = 'shield.safety.reminder';

export async function ensureNotificationPermission(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    const current = await mod.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const requested = await mod.requestPermissionsAsync();
    return Boolean(requested.granted);
  } catch {
    return false;
  }
}

function detectionCopy(kind: DetectionKind, level: RiskLevel, uncertain?: boolean): { title: string; body: string } {
  const strong = level === 'stop' || level === 'high';
  switch (kind) {
    case 'call':
      return {
        title: uncertain ? 'Possible scam call' : strong ? 'Likely scam call' : 'Call worth checking',
        body: uncertain
          ? 'This number shows possible spoofing signs. We could not confirm it — verify before trusting it.'
          : 'Signs of a scam or spoofed number were found. Do not share money, codes, or personal details.',
      };
    case 'message':
      return {
        title: strong ? 'Likely scam message' : 'Message worth checking',
        body: 'Risky patterns were found in this message. Do not tap links or reply until you verify it.',
      };
    case 'email':
      return {
        title: strong ? 'Likely phishing email' : 'Email worth checking',
        body: 'Possible phishing or impersonation was found. Do not click links or open attachments yet.',
      };
    case 'link':
      return { title: 'Risky link detected', body: 'This link shows warning signs. Open it only if you were expecting it.' };
    case 'payment':
      return { title: 'Risky payment request', body: 'This payment method is often used by scammers. Pause and verify first.' };
    default:
      return { title: 'Safety check', body: 'Open Shield Our Elders to review this.' };
  }
}

/** Show an immediate local notification for a detected risk. */
export async function notifyDetection(event: DetectionEvent): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    const copy = detectionCopy(event.kind, event.level, event.uncertain);
    await mod.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: event.detail || copy.body,
        data: { kind: event.kind, level: event.level },
      },
      trigger: null, // deliver now
    });
  } catch {
    // Silent — the in-app feed still records the event.
  }
}

const cadenceToSeconds: Record<Exclude<NotificationCadence, 'off'>, number> = {
  weekly: 7 * 24 * 60 * 60,
  biweekly: 14 * 24 * 60 * 60,
};

/**
 * Schedule recurring safety-summary + learning reminders. Cancels any existing
 * reminder first so changing cadence never stacks duplicates.
 */
export async function scheduleSafetyReminders(cadence: NotificationCadence): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    // Remove previously scheduled reminders.
    const scheduled = (await mod.getAllScheduledNotificationsAsync?.()) ?? [];
    await Promise.all(
      scheduled
        .filter((item: any) => item?.content?.data?.reminder === true)
        .map((item: any) => mod.cancelScheduledNotificationAsync(item.identifier)),
    );

    if (cadence === 'off') return;
    const granted = await ensureNotificationPermission();
    if (!granted) return;

    await mod.scheduleNotificationAsync({
      identifier: REMINDER_IDENTIFIER,
      content: {
        title: 'Your safety check-in',
        body: 'A quick scam-awareness tip and this period’s safety summary are ready. Open to review.',
        data: { reminder: true },
      },
      trigger: { seconds: cadenceToSeconds[cadence], repeats: true } as any,
    });
  } catch {
    // Ignore scheduling failures.
  }
}

export async function cancelAllReminders(): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    await mod.cancelAllScheduledNotificationsAsync?.();
  } catch {
    // Ignore.
  }
}
