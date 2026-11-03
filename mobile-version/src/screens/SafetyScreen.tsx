import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { personalSafetyAPI, type ShieldSettings } from '../api/personalSafety';
import { formatAxiosError } from '../lib/apiError';
import { Card, ErrorText, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export function SafetyScreen() {
  const [settings, setSettings] = useState<ShieldSettings | null>(null);
  const [ready, setReady] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await personalSafetyAPI.getSettings();
      setSettings(result.settings);
      setReady(result.ready?.missing || []);
      setError('');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load the safety shield.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const position = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { lat: undefined, lon: undefined };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  };

  const arm = async (next: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (next) {
        const coords = await position();
        const result = await personalSafetyAPI.arm(coords.lat, coords.lon);
        setSettings(result.settings);
        setMessage(result.message);
      } else {
        const result = await personalSafetyAPI.disarm();
        setMessage(result.message || 'Shield disarmed.');
        await load();
      }
    } catch (err) {
      setError(formatAxiosError(err, 'Could not update the shield.'));
    } finally {
      setBusy(false);
    }
  };

  const help = async () => {
    setBusy(true);
    setError('');
    try {
      const coords = await position();
      if (coords.lat == null || coords.lon == null) {
        setError('Location is required to send a help signal.');
        return;
      }
      const result = await personalSafetyAPI.trigger(coords.lat, coords.lon, 'help_button');
      setMessage(`${result.message} Police: ${result.policeNumber}. Nearby notified: ${result.nearbyNotified}.`);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send the help signal.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Personal safety shield on /api/safety/shield.">Safety</Title>
      <Card>
        <Text style={styles.state}>{settings?.armed ? 'Armed' : 'Disarmed'}</Text>
        <Muted>{ready.length ? `Still needed: ${ready.join(', ')}` : 'Shield settings are on file.'}</Muted>
        {message ? <Muted>{message}</Muted> : null}
      </Card>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton
        label={settings?.armed ? 'Disarm' : 'Arm shield'}
        onPress={() => void arm(!settings?.armed)}
        loading={busy}
      />
      <PrimaryButton label="I need help" tone="danger" onPress={() => void help()} />
      <PrimaryButton label="Cancel false alarm" tone="ghost" onPress={() => void personalSafetyAPI.cancelFalseAlarm().then((r) => setMessage(r.message)).catch((err) => setError(formatAxiosError(err, 'Could not cancel.')))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { color: colors.text, fontSize: 22, fontWeight: '700' },
});
