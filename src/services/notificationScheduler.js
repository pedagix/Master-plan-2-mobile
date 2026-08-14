import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getTaskTrackedMs } from '../lib/taskTracking';

const ALERT_CHANNEL_ID = 'master-plan-alerts-v1';
const SILENT_CHANNEL_ID = 'master-plan-silent-v1';
const TASK_NOTIFICATION_IDS = {
  checkIn: 2181001,
  breakEnd: 2181002,
  estimateEnd: 2181003,
};
const TEST_NOTIFICATION_ID = 2181099;
const TASK_NOTIFICATION_DESCRIPTORS = Object.values(TASK_NOTIFICATION_IDS).map((id) => ({ id }));

function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function cleanTaskText(value, max = 110) {
  const text = String(value || 'Current task').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function notificationSettings(data) {
  const settings = data?.settings || {};
  return {
    enabled: settings.notificationsEnabled !== false,
    checkIns: settings.checkInNotificationsEnabled !== false,
    breaks: settings.breakNotificationsEnabled !== false,
    estimates: settings.estimateNotificationsEnabled !== false,
    sound: settings.notificationSoundEnabled !== false,
  };
}

async function ensureChannels() {
  if (!isAndroidNative()) return;
  await LocalNotifications.createChannel({
    id: ALERT_CHANNEL_ID,
    name: 'Timers & check-ins',
    description: 'Task check-ins, break endings and timer reminders from Master Plan.',
    importance: 4,
    visibility: 1,
    vibration: true,
    sound: 'master_plan_alert.wav',
  });
  await LocalNotifications.createChannel({
    id: SILENT_CHANNEL_ID,
    name: 'Silent timers & check-ins',
    description: 'Master Plan task reminders without sound.',
    importance: 3,
    visibility: 1,
    vibration: false,
  });
}

function channelFor(data) {
  return notificationSettings(data).sound ? ALERT_CHANNEL_ID : SILENT_CHANNEL_ID;
}

async function cancelTaskNotifications() {
  if (!isAndroidNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: TASK_NOTIFICATION_DESCRIPTORS });
  } catch (error) {
    console.warn('Could not cancel native task notifications.', error);
  }
}

async function scheduleOne({ id, title, body, at, channelId, kind, taskId }) {
  if (!isAndroidNative()) return;
  const when = Number(at);
  if (!Number.isFinite(when) || when <= Date.now() + 250) return;
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title,
      body,
      channelId,
      autoCancel: true,
      schedule: {
        at: new Date(when),
        allowWhileIdle: true,
      },
      extra: {
        source: 'master-plan',
        kind,
        taskId: taskId || null,
      },
    }],
  });
}

export function isNativeNotificationRuntime() {
  return isAndroidNative();
}

export async function getNotificationStatus() {
  if (!isAndroidNative()) {
    return {
      native: false,
      platform: Capacitor.getPlatform(),
      displayPermission: 'unsupported',
      exactAlarm: 'unsupported',
    };
  }

  let displayPermission = 'unknown';
  let exactAlarm = 'unknown';
  try {
    displayPermission = (await LocalNotifications.checkPermissions()).display;
  } catch (error) {
    console.warn('Could not check notification permission.', error);
  }
  try {
    exactAlarm = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
  } catch (error) {
    console.warn('Could not check exact-alarm setting.', error);
  }
  return { native: true, platform: 'android', displayPermission, exactAlarm };
}

export async function ensureNotificationPermission() {
  if (!isAndroidNative()) return { display: 'unsupported' };
  let status = await LocalNotifications.checkPermissions();
  if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
    status = await LocalNotifications.requestPermissions();
  }
  if (status.display === 'granted') await ensureChannels();
  return status;
}

export async function openExactAlarmSettings() {
  if (!isAndroidNative()) return { exact_alarm: 'unsupported' };
  return LocalNotifications.changeExactNotificationSetting();
}

export async function syncTaskNotifications(data) {
  if (!isAndroidNative()) return { native: false, scheduled: [] };

  const settings = notificationSettings(data);
  await cancelTaskNotifications();
  if (!settings.enabled) return { native: true, scheduled: [] };

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    return { native: true, scheduled: [], permission: permission.display };
  }

  await ensureChannels();
  const active = data?.activeTask;
  if (!active) return { native: true, scheduled: [] };

  const channelId = channelFor(data);
  const taskText = cleanTaskText(active.taskTextSnapshot);
  const scheduled = [];

  if (active.status === 'running' && settings.checkIns && Number(active.nextCheckInAt) > Date.now()) {
    await scheduleOne({
      id: TASK_NOTIFICATION_IDS.checkIn,
      title: 'Master Plan check-in',
      body: `Still working on “${taskText}”?`,
      at: Number(active.nextCheckInAt),
      channelId,
      kind: 'check-in',
      taskId: active.taskNoteId,
    });
    scheduled.push('check-in');
  }

  if (active.status === 'break' && settings.breaks && Number(active.breakEndsAt) > Date.now()) {
    await scheduleOne({
      id: TASK_NOTIFICATION_IDS.breakEnd,
      title: 'Break complete',
      body: `Ready to continue “${taskText}”?`,
      at: Number(active.breakEndsAt),
      channelId,
      kind: 'break-end',
      taskId: active.taskNoteId,
    });
    scheduled.push('break-end');
  }

  if (active.status === 'running' && settings.estimates && Number(active.estimateMinutes) > 0) {
    const estimateMs = Math.max(0, Number(active.estimateMinutes) * 60_000);
    const trackedMs = getTaskTrackedMs(data, active.taskNoteId, Date.now());
    const remainingMs = estimateMs - trackedMs;
    if (remainingMs > 500) {
      await scheduleOne({
        id: TASK_NOTIFICATION_IDS.estimateEnd,
        title: 'Estimated time reached',
        body: `Your estimate for “${taskText}” is up.`,
        at: Date.now() + remainingMs,
        channelId,
        kind: 'estimate-end',
        taskId: active.taskNoteId,
      });
      scheduled.push('estimate-end');
    }
  }

  return { native: true, scheduled, permission: permission.display };
}

export async function sendTestNotification(data) {
  if (!isAndroidNative()) return { native: false, sent: false };
  const permission = await ensureNotificationPermission();
  if (permission.display !== 'granted') return { native: true, sent: false, permission: permission.display };
  await ensureChannels();
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIFICATION_ID }] });
  } catch {
    // Nothing to cancel is fine.
  }
  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_NOTIFICATION_ID,
      title: 'Master Plan notification test',
      body: 'Background reminders are ready.',
      channelId: channelFor(data),
      autoCancel: true,
      schedule: {
        at: new Date(Date.now() + 2500),
        allowWhileIdle: true,
      },
      extra: { source: 'master-plan', kind: 'test' },
    }],
  });
  return { native: true, sent: true, permission: permission.display };
}

export async function initializeNotificationSystem(data) {
  if (!isAndroidNative()) return { native: false };
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'granted') await ensureChannels();
  await syncTaskNotifications(data);
  return getNotificationStatus();
}
