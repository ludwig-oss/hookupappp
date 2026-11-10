import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { scoutAPI, type Profession, type ScoutState } from '../../api/scout';
import { formatAxiosError } from '../../lib/apiError';
import { shell } from './chrome';

function euros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function ScoutPanel({ onOpenChat }: { onOpenChat: (userId: string) => void }) {
  const [state, setState] = useState<ScoutState | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Profession[]>([]);
  const [professionId, setProfessionId] = useState('');
  const [years, setYears] = useState('3');
  const [judgment, setJudgment] = useState('50');
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    scoutAPI.state().then(setState).catch((err) => setError(formatAxiosError(err, 'Could not open Scout.')));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => {
      scoutAPI.professions(query).then(setOptions).catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const run = async (task: () => Promise<ScoutState>) => {
    setError('');
    try {
      setState(await task());
    } catch (err) {
      setError(formatAxiosError(err, 'That action failed.'));
    }
  };

  if (!state) return <Text style={styles.lead}>{error || 'Loading Scout…'}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>SCOUT</Text>
      <Text style={styles.lead}>Verify a profession, then run a cycle. Experience sets the list size. Judgment drops weak profiles. Gender is not a filter.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!state.onboarded ? (
        <View style={styles.card}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search professions" placeholderTextColor={shell.faint} style={styles.input} />
          <View style={styles.chips}>
            {options.map((item) => (
              <Pressable key={item.id} onPress={() => setProfessionId(item.id)} style={[styles.chip, professionId === item.id && styles.chipOn]}>
                <Text style={styles.chipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={years} onChangeText={setYears} keyboardType="number-pad" placeholder="Years" placeholderTextColor={shell.faint} style={styles.input} />
          <TextInput value={judgment} onChangeText={setJudgment} keyboardType="number-pad" placeholder="Judgment 0-100" placeholderTextColor={shell.faint} style={styles.input} />
          <Pressable style={styles.primary} onPress={() => void run(() => scoutAPI.saveProfile({ professionId, years: Number(years), judgment: Number(judgment) }))}>
            <Text style={styles.primaryText}>Verify and enter Scout</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.meta}>Experience {state.experienceScore} · list {state.listSize} · floor {state.qualityFloor}</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Filter profession" placeholderTextColor={shell.faint} style={styles.input} />
          <View style={styles.chips}>
            <Pressable onPress={() => setFilter('')} style={[styles.chip, !filter && styles.chipOn]}><Text style={styles.chipText}>Any</Text></Pressable>
            {options.map((item) => (
              <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.chip, filter === item.id && styles.chipOn]}>
                <Text style={styles.chipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primary} onPress={() => void run(() => scoutAPI.cycle(filter || undefined))}>
            <Text style={styles.primaryText}>Run cycle</Text>
          </Pressable>
          {state.board.map((card) => (
            <View key={card.userId} style={styles.card}>
              <Text style={styles.name}>{card.name}</Text>
              <Text style={styles.meta}>{card.professionLabel} · quality {card.quality} · {card.years} years</Text>
              <Pressable style={styles.primary} onPress={() => void run(() => scoutAPI.interest(card.userId, 'talk'))}>
                <Text style={styles.primaryText}>Show interest · Just Talk</Text>
              </Pressable>
              <Pressable style={[styles.primary, styles.blue]} onPress={() => void run(() => scoutAPI.interest(card.userId, 'building'))}>
                <Text style={styles.primaryText}>Show interest · Building</Text>
              </Pressable>
            </View>
          ))}
          {state.incoming.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.from.name}</Text>
              <Text style={styles.meta}>{item.from.professionLabel} · {item.mode}</Text>
              <Pressable style={styles.primary} onPress={() => void run(() => scoutAPI.accept(item.id))}>
                <Text style={styles.primaryText}>Accept</Text>
              </Pressable>
              <Pressable style={styles.ghost} onPress={() => void run(() => scoutAPI.reject(item.id))}>
                <Text style={styles.ghostText}>Decline</Text>
              </Pressable>
            </View>
          ))}
          {state.partnerships.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.mode === 'building' ? 'Building' : 'Just Talk'} · {item.partner.name}</Text>
              <Text style={styles.meta}>{item.status.replace(/_/g, ' ')} · share {euros(item.eachShareCents)}</Text>
              <Pressable style={styles.ghost} onPress={() => onOpenChat(item.partner.id)}>
                <Text style={styles.ghostText}>Open chat</Text>
              </Pressable>
              {item.contractText && !item.iSigned && item.status !== 'ended' ? (
                <Pressable style={styles.primary} onPress={() => void run(() => scoutAPI.sign(item.id))}>
                  <Text style={styles.primaryText}>Sign pre-agreement</Text>
                </Pressable>
              ) : null}
              {item.speedDate && item.status !== 'ended' ? (
                <>
                  <Pressable style={styles.primary} onPress={() => void run(() => scoutAPI.joinLive(item.id))}>
                    <Text style={styles.primaryText}>{item.speedDate.iJoined ? 'Joined Speed Date Live' : 'Join Speed Date Live'}</Text>
                  </Pressable>
                  <Pressable style={[styles.primary, styles.blue]} onPress={() => void run(() => scoutAPI.confirmBlue(item.id))}>
                    <Text style={styles.primaryText}>Blue button — confirm match</Text>
                  </Pressable>
                </>
              ) : null}
              {item.mode === 'building' && item.status === 'active' ? (
                <Pressable style={styles.ghost} onPress={() => void run(() => scoutAPI.terminate(item.id, 'Unrepairable'))}>
                  <Text style={styles.ghostText}>End 50/50</Text>
                </Pressable>
              ) : null}
              {item.settlement ? <Text style={styles.meta}>Ended. Each person takes {euros(item.settlement.eachShareCents)}.</Text> : null}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 24 },
  title: { color: shell.white, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  lead: { color: shell.muted, lineHeight: 20, marginBottom: 8 },
  error: { color: '#fda4af', marginBottom: 8 },
  meta: { color: shell.muted, marginBottom: 6 },
  name: { color: shell.white, fontWeight: '800', marginBottom: 4 },
  card: { backgroundColor: '#14141c', borderRadius: 14, padding: 12, marginTop: 10 },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: 10, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  chipOn: { borderWidth: 2, borderColor: '#00E6FF' },
  chipText: { color: '#e5e7eb' },
  primary: { backgroundColor: '#00E6FF', borderRadius: 8, padding: 12, marginTop: 8 },
  blue: { backgroundColor: '#2563eb' },
  primaryText: { color: '#041016', fontWeight: '800', textAlign: 'center' },
  ghost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 12, marginTop: 8 },
  ghostText: { color: '#fff', textAlign: 'center' },
});
