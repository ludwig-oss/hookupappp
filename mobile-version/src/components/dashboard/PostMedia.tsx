import { Image, Linking, Pressable, StyleSheet, Text } from 'react-native';
import type { VideoPlayer, VideoView as VideoViewType } from 'expo-video';

type ExpoVideo = {
  useVideoPlayer: (source: string, setup?: (player: VideoPlayer) => void) => VideoPlayer;
  VideoView: typeof VideoViewType;
};

function loadExpoVideo(): ExpoVideo | null {
  try {
    return require('expo-video') as ExpoVideo;
  } catch {
    return null;
  }
}

const expoVideo = loadExpoVideo();

export function isVideoMedia(contentType: string | undefined, url: string): boolean {
  if (contentType === 'video') return true;
  return /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(url);
}

export function PostMedia({ uri, video }: { uri: string; video: boolean }) {
  if (!uri) return null;
  if (video && expoVideo) return <Clip uri={uri} />;
  if (video) {
    return (
      <Pressable style={styles.fallback} onPress={() => void Linking.openURL(uri)}>
        <Text style={styles.fallbackText}>Play video</Text>
      </Pressable>
    );
  }
  return <Image source={{ uri }} style={styles.media} />;
}

function Clip({ uri }: { uri: string }) {
  const player = expoVideo!.useVideoPlayer(uri, (next) => {
    next.loop = true;
    next.muted = true;
  });
  const View = expoVideo!.VideoView;
  return <View player={player} style={styles.media} contentFit="cover" nativeControls />;
}

const styles = StyleSheet.create({
  media: { width: '100%', height: 220, backgroundColor: '#000' },
  fallback: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { color: '#00d4ff', fontWeight: '700', fontSize: 16 },
});
