import { StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from './src/state/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/ui/theme';

export default function App() {
  return (
    <AuthProvider>
      <View style={styles.screen}>
        <Text style={styles.hello}>Hello World! This is my mobile app.</Text>
        <View style={styles.body}>
          <RootNavigator />
        </View>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  hello: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  body: {
    flexGrow: 0,
  },
});
