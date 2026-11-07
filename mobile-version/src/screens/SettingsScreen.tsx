import { useCallback, useState } from 'react';
import { Switch, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsAPI, type UserSettings } from '../api/settings';
import { formatAxiosError } from '../lib/apiError';
import { PrivacyPolicyCopy } from '../components/PrivacyPolicyCopy';
import { AccountControls } from '../components/AccountControls';
import { Card, ErrorText, Muted, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await settingsAPI.getSettings();
      setSettings(result.settings);
      setError('');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load settings.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const setNotify = async (patch: Partial<UserSettings['notifications']>) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, notifications: { ...settings.notifications, ...patch } });
    try {
      const result = await settingsAPI.updateNotifications(patch);
      setSettings(result.settings);
    } catch (err) {
      setSettings(previous);
      setError(formatAxiosError(err, 'Could not update notifications.'));
    }
  };

  const setPrivacy = async (patch: Partial<UserSettings['privacy']>) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, privacy: { ...settings.privacy, ...patch } });
    try {
      const result = await settingsAPI.updatePrivacy(patch);
      setSettings(result.settings);
    } catch (err) {
      setSettings(previous);
      setError(formatAxiosError(err, 'Could not update privacy.'));
    }
  };

  return (
    <Screen>
      <Title subtitle="Writes to /api/settings, the same store as the website.">Settings</Title>
      <ErrorText>{error}</ErrorText>
      {!settings ? <Muted>Loading settings…</Muted> : null}
      {settings ? (
        <>
          <Card>
            <Text style={styles.heading}>Notifications</Text>
            <Toggle label="Push" value={settings.notifications.push} onChange={(push) => void setNotify({ push })} />
            <Toggle label="Messages" value={settings.notifications.messages} onChange={(messages) => void setNotify({ messages })} />
            <Toggle label="Matches" value={settings.notifications.matches} onChange={(matches) => void setNotify({ matches })} />
            <Toggle label="Likes" value={settings.notifications.likes} onChange={(likes) => void setNotify({ likes })} />
          </Card>
          <Card>
            <Text style={styles.heading}>Privacy</Text>
            <Toggle label="Show location" value={settings.privacy.showLocation} onChange={(showLocation) => void setPrivacy({ showLocation })} />
            <Toggle label="Online status" value={settings.privacy.showOnlineStatus} onChange={(showOnlineStatus) => void setPrivacy({ showOnlineStatus })} />
            <Toggle label="Read receipts" value={settings.privacy.readReceipts} onChange={(readReceipts) => void setPrivacy({ readReceipts })} />
            <Muted>{`Distance filter: ${settings.filters.maxDistance} km · ages ${settings.filters.minAge}-${settings.filters.maxAge}`}</Muted>
          </Card>
        </>
      ) : null}
      <Card>
        <PrivacyPolicyCopy />
      </Card>
      <AccountControls />
    </Screen>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.line }} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15 },
});
