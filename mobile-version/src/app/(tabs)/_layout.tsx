import { Tabs } from 'expo-router';
import { shell } from '../../components/dashboard/chrome';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: shell.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
