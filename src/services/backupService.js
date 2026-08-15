import { Capacitor, registerPlugin } from '@capacitor/core';
import { migrateData } from '../lib/model';

const MasterPlanBackup = registerPlugin('MasterPlanBackup');
const BACKUP_FORMAT = 'master-plan-backup';
const BACKUP_FORMAT_VERSION = 1;
const APP_VERSION = '0.4.0';
const MAX_DRIVE_BACKUPS = 3;

function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function compactTimestamp(date = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(date.getMilliseconds(), 3),
  ].join('');
}

function backupFileName(date = new Date()) {
  return `MasterPlan-${compactTimestamp(date)}.mpbackup`;
}

function getCounts(state) {
  return {
    projects: state.projects?.length || 0,
    notes: state.notes?.length || 0,
    completedTasks: state.completedTasks?.length || 0,
    taskSessions: state.taskSessions?.length || 0,
    galleryImages: (state.projects || []).reduce((sum, project) => sum + (project.gallery?.length || 0), 0),
  };
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) return null;
  const encoded = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isNativeBackupRuntime() {
  return isAndroidNative();
}

export async function createBackupPackage(data) {
  const createdAt = new Date().toISOString();
  const state = migrateData({
    ...data,
    meta: {
      ...(data?.meta || {}),
      appName: 'Master Plan',
      schemaVersion: 11,
      exportType: 'full-backup',
      exportedAt: createdAt,
    },
  });
  const stateJson = JSON.stringify(state);
  const stateDigest = await sha256Hex(stateJson);
  const payload = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appName: 'Master Plan',
    appVersion: APP_VERSION,
    schemaVersion: 11,
    createdAt,
    counts: getCounts(state),
    integrity: stateDigest ? { algorithm: 'SHA-256', stateDigest } : null,
    state,
  };
  return {
    payload,
    text: JSON.stringify(payload),
    fileName: backupFileName(new Date(createdAt)),
  };
}

export async function parseAndValidateBackup(input) {
  let parsed;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error('This file is not valid Master Plan backup JSON.');
    }
  } else {
    parsed = input;
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('Backup file is empty or invalid.');

  if (parsed.format === BACKUP_FORMAT) {
    if (Number(parsed.formatVersion) !== BACKUP_FORMAT_VERSION) {
      throw new Error(`Backup format ${parsed.formatVersion} is not supported by this version of Master Plan.`);
    }
    if (!parsed.state || typeof parsed.state !== 'object') throw new Error('Backup is missing its Master Plan data.');
    if (parsed.integrity?.algorithm === 'SHA-256' && parsed.integrity?.stateDigest) {
      const actual = await sha256Hex(JSON.stringify(parsed.state));
      if (actual && actual !== parsed.integrity.stateDigest) {
        throw new Error('Backup integrity check failed. The file may be incomplete or damaged.');
      }
    }
    return {
      state: migrateData(parsed.state),
      createdAt: parsed.createdAt || null,
      counts: parsed.counts || getCounts(migrateData(parsed.state)),
      legacy: false,
    };
  }

  // Keep restore compatibility with the JSON full backups from earlier builds.
  const looksLegacy = parsed?.meta?.exportType === 'full-backup'
    || Array.isArray(parsed.projects)
    || Array.isArray(parsed.notes)
    || Array.isArray(parsed.completedTasks);
  if (!looksLegacy) throw new Error('This file is not recognized as a Master Plan backup.');
  const state = migrateData(parsed);
  return {
    state,
    createdAt: parsed?.meta?.exportedAt || null,
    counts: getCounts(state),
    legacy: true,
  };
}

export async function getDriveBackupStatus() {
  if (!isAndroidNative()) return { native: false, connected: false, backups: [] };
  return MasterPlanBackup.getStatus();
}

export async function connectDriveBackupFolder() {
  if (!isAndroidNative()) throw new Error('Google Drive folder backup requires the Android app.');
  return MasterPlanBackup.chooseBackupFolder();
}

export async function disconnectDriveBackupFolder() {
  if (!isAndroidNative()) return { connected: false };
  return MasterPlanBackup.disconnect();
}

export async function listDriveBackups() {
  if (!isAndroidNative()) return [];
  const result = await MasterPlanBackup.listBackups();
  return Array.isArray(result?.backups) ? result.backups : [];
}

export async function saveDriveBackup(data) {
  if (!isAndroidNative()) throw new Error('Google Drive backup requires the Android app.');
  const backup = await createBackupPackage(data);
  const result = await MasterPlanBackup.writeBackup({
    fileName: backup.fileName,
    content: backup.text,
    maxBackups: MAX_DRIVE_BACKUPS,
  });
  return { ...result, fileName: backup.fileName, createdAt: backup.payload.createdAt };
}

export async function readDriveBackup(id) {
  if (!isAndroidNative()) throw new Error('Google Drive restore requires the Android app.');
  const result = await MasterPlanBackup.readBackup({ id });
  const validated = await parseAndValidateBackup(result?.content || '');
  return { ...validated, fileName: result?.fileName || null };
}

export async function exportBackupFile(data) {
  const backup = await createBackupPackage(data);
  if (isAndroidNative()) {
    const result = await MasterPlanBackup.exportBackup({ fileName: backup.fileName, content: backup.text });
    return { ...result, fileName: backup.fileName };
  }

  const blob = new Blob([backup.text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backup.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { saved: true, fileName: backup.fileName };
}

export async function pickBackupFileNative() {
  if (!isAndroidNative()) throw new Error('Native file picker unavailable.');
  const result = await MasterPlanBackup.pickBackupFile();
  const validated = await parseAndValidateBackup(result?.content || '');
  return { ...validated, fileName: result?.fileName || null };
}
