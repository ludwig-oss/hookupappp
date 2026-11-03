import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { discoverAPI, type User } from '../api/discover';
import { formatAxiosError } from '../lib/apiError';
import { Card, ErrorText, Field, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export function DiscoverScreen() {
  const [city, setCity] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!city.trim()) {
      setError('Enter a city.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await discoverAPI.searchByCity(city.trim());
      setUsers(result.users || []);
      setNote(result.message || (result.users?.length ? '' : 'No one is active in that city yet.'));
    } catch (err) {
      setError(formatAxiosError(err, 'Could not search that city.'));
    } finally {
      setLoading(false);
    }
  };

  const interest = async (toUserId: string) => {
    try {
      await discoverAPI.showInterest(toUserId, city.trim());
      setNote('Interest sent.');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send interest.'));
    }
  };

  return (
    <Screen>
      <Title subtitle="City search on /api/discover.">Discover</Title>
      <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
      <PrimaryButton label="Search" onPress={() => void search()} loading={loading} />
      <ErrorText>{error}</ErrorText>
      {note ? <Muted>{note}</Muted> : null}
      {users.map((person) => (
        <Card key={person.id}>
          <Text style={styles.name}>{person.name}</Text>
          <Muted>@{person.username}</Muted>
          <PrimaryButton label="Show interest" onPress={() => void interest(person.id)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
