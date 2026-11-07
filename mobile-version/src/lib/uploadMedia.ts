import * as ImagePicker from 'expo-image-picker';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { MEDIA_API_BASE } from '../api/config';
import { getAuthToken } from '../session/authStorage';

export type UploadedMedia = {
  url: string;
  contentType: 'image' | 'video';
};

/** Pick a photo or video and store it on the production media API. */
export async function pickAndUploadPostMedia(): Promise<UploadedMedia | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos', 'Allow photo and video access to post on your profile.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.7,
    videoMaxDuration: 90,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  return uploadMediaFile(asset.uri, mime, 'posts');
}

export async function uploadMediaFile(uri: string, mime: string, folder = 'posts'): Promise<UploadedMedia> {
  const token = getAuthToken();
  if (!token) throw new Error('Sign in required');
  const type = mime.startsWith('video/') || mime.startsWith('image/') ? mime : 'application/octet-stream';
  const endpoint = `${MEDIA_API_BASE}/api/posts/upload-file`;
  const result = await uploadAsync(endpoint, uri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': type,
      'X-Upload-Folder': folder,
      'X-Upload-Content-Type': type,
    },
  });
  let data: { url?: string; contentType?: string; error?: string } = {};
  try {
    data = JSON.parse(result.body || '{}') as typeof data;
  } catch {
    data = {};
  }
  if (result.status < 200 || result.status >= 300 || !data.url) {
    throw new Error(data.error || `Upload failed (HTTP ${result.status})`);
  }
  const contentType = data.contentType === 'video' || type.startsWith('video/') ? 'video' : 'image';
  return { url: data.url, contentType };
}
