import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { dateMatchAPI, type DateMatch, type LookingForOption, type PublicUserCard } from '../api/dateMatch';
import { formatAxiosError } from '../lib/apiError';
import { Card, ErrorText, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

type Row = { match: DateMatch; other: PublicUserCard | null };

export function DateMatchScreen() {
  const [options, setOptions] = useState<LookingForOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catalog, mine] = await Promise.all([dateMatchAPI.catalog(), dateMatchAPI.mine()]);
      setOptions(catalog.lookingFor || []);
      setSelected(catalog.savedLookingFor || []);
      setRows([...(mine.active || []), ...(mine.pending || [])]);
      setStatus(catalog.city ? `Searching around ${catalog.city}` : 'Choose what you want, then search.');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load date match.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const search = async () => {
    if (!selected.length) {
      setError('Pick at least one intention.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await dateMatchAPI.saveLookingFor(selected);
      const result = await dateMatchAPI.search(selected, 'city');
      setStatus(result.searching ? 'Searching…' : result.match ? `Match status: ${result.match.status}` : 'Search started.');
      await load();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not start a search.'));
      setLoading(false);
    }
  };

  const respond = async (matchId: string, accept: boolean) => {
    try {
      await dateMatchAPI.respond(matchId, accept);
      await load();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not respond to that date.'));
    }
  };

  return (
    <Screen>
      <Title subtitle="Same date-match service as the website.">Date match</Title>
      <Muted>{status}</Muted>
      <View style={styles.wrap}>
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <Pressable key={option.id} onPress={() => toggle(option.id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton label="Search my city" onPress={() => void search()} loading={loading} />
      <ErrorText>{error}</ErrorText>
      {rows.map(({ match, other }) => (
        <Card key={match.id}>
          <Text style={styles.name}>{other?.name || 'Match'}</Text>
          <Muted>
            {match.status}
            {match.ideaTitle ? ` · ${match.ideaTitle}` : ''}
          </Muted>
          <View style={styles.row}>
            <View style={styles.flex}>
              <PrimaryButton label="Accept" tone="ok" onPress={() => void respond(match.id, true)} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton label="Decline" tone="danger" onPress={() => void respond(match.id, false)} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  chipText: { color: colors.text },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
