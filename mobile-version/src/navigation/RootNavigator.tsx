import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import type { AppStackParamList, AuthStackParamList, MainTabParamList } from './types';
import { useAuth } from '../state/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { ConnectionsScreen } from '../screens/ConnectionsScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { ChatThreadScreen } from '../screens/ChatThreadScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { DateMatchScreen } from '../screens/DateMatchScreen';
import { SafetyScreen } from '../screens/SafetyScreen';
import { CompatibilityScreen } from '../screens/CompatibilityScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../ui/theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgRaised,
    text: colors.text,
    border: colors.line,
    primary: colors.accent,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.bgRaised },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  contentStyle: { backgroundColor: colors.bg },
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgRaised },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.bgRaised, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="Connections" component={ConnectionsScreen} />
      <Tabs.Screen name="Feed" component={FeedScreen} />
      <Tabs.Screen name="Chat" component={ChatListScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function SignedOut() {
  return (
    <AuthStack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function SignedIn() {
  const { user } = useAuth();
  if (user?.profileSetupComplete === false) {
    return (
      <AppStack.Navigator screenOptions={screenOptions}>
        <AppStack.Screen name="MainTabs" component={ProfileSetupScreen} options={{ title: 'Profile setup' }} />
      </AppStack.Navigator>
    );
  }
  return (
    <AppStack.Navigator screenOptions={screenOptions}>
      <AppStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <AppStack.Screen name="ChatThread" component={ChatThreadScreen} options={({ route }) => ({ title: route.params.name })} />
      <AppStack.Screen name="Discover" component={DiscoverScreen} />
      <AppStack.Screen name="DateMatch" component={DateMatchScreen} options={{ title: 'Date match' }} />
      <AppStack.Screen name="Safety" component={SafetyScreen} />
      <AppStack.Screen name="Compatibility" component={CompatibilityScreen} />
      <AppStack.Screen name="Settings" component={SettingsScreen} />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.pink} />
        <Text style={styles.bootText}>Opening your session…</Text>
        <StatusBar style="light" />
      </View>
    );
  }
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      {user ? <SignedIn /> : <SignedOut />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootText: { color: colors.text, fontSize: 16 },
});
