import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../../../state/AuthContext';
import { colors } from '../../../ui/theme';

/** Google sends the browser here. The session is finished in AuthProvider. */
export default function OAuthReturn() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
