// Central permission requests. Called once when onboarding finishes (with an
// explanation shown first) and re-checkable from individual screens so we can
// prompt again politely if a permission was declined.

import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { ensureNotificationPermission } from './notifications';

export type PermissionKey = 'notifications' | 'camera' | 'photos';

export interface PermissionStatus {
  notifications: boolean;
  camera: boolean;
  photos: boolean;
}

export async function requestCamera(): Promise<boolean> {
  try {
    const res = await Camera.requestCameraPermissionsAsync();
    return Boolean(res.granted);
  } catch {
    return false;
  }
}

export async function requestPhotos(): Promise<boolean> {
  try {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return Boolean(res.granted);
  } catch {
    return false;
  }
}

/** Request everything the app uses, in sequence, returning what was granted. */
export async function requestAllPermissions(): Promise<PermissionStatus> {
  const notifications = await ensureNotificationPermission();
  const camera = await requestCamera();
  const photos = await requestPhotos();
  return { notifications, camera, photos };
}
