import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getTaskTrackedMs } from '../lib/taskTracking';

const ALERT_CHANNEL_ID = 'master-plan-alerts-v1';
const SILENT_CHANNEL_ID = 'master-plan-silent-v1';
const BACKUP_CHANNEL_ID = 'master-plan-backups-v1';
const BACKUP_ACTION_TYPE_ID = 'master-plan-backup-actions';
const TASK_NOTIFICATION_IDS = {
  checkIn: 2181001,
  breakEnd: 2181002,
  estimateEnd: 2181003,
};
const TEST_NOTIFICATION_ID = 2181099;
const BACKUP_REMINDER_IDS = Array.from({ length: 12 }, (_, index) => 2181100 + index);
const BACKUP_REMINDER_DESCRIPTORS = BACKUP_REMINDER_IDS.map((id) => ({ id }));
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
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
    id: BACKUP_CHANNEL_ID,
    name: 'Backup reminders',
    description: 'Weekly reminders to protect your local Master Plan data.',
    importance: 3,
    visibility: 1,
    vibration: true,
    sound: 'master_plan_alert.wav',
  });
  await LocalNotifications.createChannel({
    id: SILENT_CHANNEL_ID,
    name: 'Silent Master Plan reminders',
    description: 'Task and backup reminders without sound.',
    importance: 3,
    visibility: 1,
    vibration: false,
  });
  await LocalNotifications.registerActionTypes({
    types: [{
      id: BACKUP_ACTION_TYPE_ID,
      actions: [
        { id: 'backup-now', title: 'Back up' },
        { id: 'remind-tomorrow', title: 'Remind tomorrow' },
      ],
    }],
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


async function cancelBackupReminderNotifications() {
  if (!isAndroidNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: BACKUP_REMINDER_DESCRIPTORS });
  } catch (error) {
    console.warn('Could not cancel backup reminder notifications.', error);
  }
}

export async function syncBackupReminderNotifications(data) {
  if (!isAndroidNative()) return { native: false, scheduled: [] };
  await cancelBackupReminderNotifications();

  const settings = data?.settings || {};
  if (settings.notificationsEnabled === false || settings.backupReminderEnabled === false) {
    return { native: true, scheduled: [] };
  }

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    return { native: true, scheduled: [], permission: permission.display };
  }

  await ensureChannels();
  const baseAt = Number(settings.lastSuccessfulBackupAt) || Number(settings.backupReminderAnchorAt) || Date.now();
  const snoozeUntil = Number(settings.backupReminderSnoozeUntil) || 0;
  let firstDueAt = Math.max(baseAt + WEEK_MS, snoozeUntil);
  const now = Date.now();
  if (firstDueAt <= now + 1000) {
    const weeksOverdue = Math.floor(Math.max(0, now - firstDueAt) / WEEK_MS);
    firstDueAt += weeksOverdue * WEEK_MS;
    while (firstDueAt <= now + 1000) firstDueAt += WEEK_MS;
  }

  const channelId = settings.notificationSoundEnabled !== false ? BACKUP_CHANNEL_ID : SILENT_CHANNEL_ID;
  const notifications = BACKUP_REMINDER_IDS.map((id, index) => ({
    id,
    title: 'Master Plan backup',
    body: 'A week has passed since your last backup. Protect your local data now or snooze for one day.',
    channelId,
    actionTypeId: BACKUP_ACTION_TYPE_ID,
    autoCancel: true,
    schedule: {
      at: new Date(firstDueAt + (index * WEEK_MS)),
      allowWhileIdle: false,
    },
    extra: { source: 'master-plan', kind: 'backup-reminder' },
  }));

  await LocalNotifications.schedule({ notifications });
  return { native: true, scheduled: notifications.map((item) => item.schedule.at.getTime()), permission: permission.display };
}

export async function addMasterPlanNotificationActionListener(handler) {
  if (!isAndroidNative()) return { remove: async () => {} };
  return LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    handler?.(event);
  });
}
