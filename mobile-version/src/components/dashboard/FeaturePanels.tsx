import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { adviceAPI, type AdviceQuestion } from '../../api/advice';
import { aiGuidesAPI, type AiGuideCharacter } from '../../api/aiGuides';
import { ConfessionPanel } from './ConfessionPanel';
import { dateMatchAPI, type DateMatchCatalog } from '../../api/dateMatch';
import { discoverAPI, type User } from '../../api/discover';
import { personalSafetyAPI, type ShieldSettings } from '../../api/personalSafety';
import { settingsAPI, type UserSettings } from '../../api/settings';
import { formatAxiosError } from '../../lib/apiError';
import { PrivacyPolicyCopy } from '../PrivacyPolicyCopy';
import { Field, Hint, NeonButton, Notice, PanelTitle, PersonRow, StageFrame, shell } from './chrome';
import { AccountControls } from '../AccountControls';
import { PrivacyPolicyLink } from '../UgcSafetyActions';
import type { WidgetId } from './types';

const HELP_LINKS: Array<{ id: WidgetId | 'profile'; icon: string; label: string; hint: string }> = [
  { id: 'profile', icon: '👤', label: 'Profile', hint: 'Photo, city, reviews, health' },
  { id: 'settings', icon: '⚙️', label: 'Settings', hint: 'Privacy, safety, language' },
  { id: 'activity', icon: '🌍', label: 'Activity Stream', hint: 'Find people in your region' },
  { id: 'chat', icon: '💬', label: 'Communication', hint: 'Chats, meetups, unmatch' },
  { id: 'lovefeed', icon: '♥', label: 'Love Life Feed', hint: 'Posts & community' },
  { id: 'highlights', icon: '✨', label: 'Highlights', hint: 'Spin wheel games' },
  { id: 'compatibility', icon: '🧬', label: 'Compatibility', hint: 'Guides & sessions' },
  { id: 'connections', icon: '👥', label: 'Connections', hint: 'Nearby & venues' },
  { id: 'events', icon: '📅', label: 'Events', hint: 'Create or join meetups' },
  { id: 'datematch', icon: '⚔️', label: 'Date Arena', hint: 'Match, accept, fun date roll' },
];

const BABY_STEPS = [
  'Finish Profile (photo + city) so people can find you.',
  'Pick an AI guide in Compatibility — they coach texting and dates.',
  'Use Activity Stream, Connections, or Date Arena to meet people.',
  'Chat in Communication.',
  'Arm the Personal safety shield when you go out.',
];

const WHEEL = [
  { short: 'Blind', name: 'Blind Date', blurb: 'Voice icebreakers; faces stay blurred.' },
  { short: 'Pick', name: 'Picture Pick', blurb: 'Choose a photo and a vibe hint.' },
  { short: 'Rush', name: 'Compatibility Rush', blurb: 'Quick vibe questions.' },
  { short: 'Lucky', name: 'Lucky Like', blurb: 'One lucky interest shot.' },
  { short: 'Speed', name: 'Speed Pick', blurb: 'Fast yes or no picks.' },
  { short: 'Mystery', name: 'Mystery Message', blurb: 'Send a typed mystery line.' },
];

export function ActivityPanel({
  defaultCity,
  onOpenChat,
}: {
  defaultCity?: string;
  onOpenChat: (userId: string) => void;
}) {
  const [city, setCity] = useState(defaultCity || '');
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
      const res = await discoverAPI.showInterest(toUserId, city.trim());
      setNote(res.interest.status === 'accepted' ? 'They accepted. Opening chat.' : 'Interest sent. Chat opens after they accept.');
      if (res.interest.status === 'accepted') onOpenChat(toUserId);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send interest.'));
    }
  };

  return (
    <StageFrame>
      <Text style={styles.kicker}>ACTIVITY STREAM — CONNECT WORLDWIDE</Text>
      <Hint>Search any city. Send interest — chat opens in Communications only after they accept.</Hint>
      <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" placeholder="Berlin" />
      <NeonButton label={loading ? 'Searching…' : 'Search this city'} onPress={() => void search()} disabled={loading} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Hint>{note}</Hint> : null}
      {users.map((person) => (
        <PersonRow
          key={person.id}
          name={person.name || person.username}
          meta={person.username ? `@${person.username}` : city}
          action="Interest"
          onAction={() => void interest(person.id)}
        />
      ))}
    </StageFrame>
  );
}

export function CompatibilityPanel({ onAsk }: { onAsk?: (guide: AiGuideCharacter) => void }) {
  const [guides, setGuides] = useState<AiGuideCharacter[]>([]);
  const [active, setActive] = useState<AiGuideCharacter | null>(null);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void aiGuidesAPI
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = res.guides || [];
        setGuides(list);
        setActive((current) => current || list[0] || null);
      })
      .catch((err) => {
        if (!cancelled) setError(formatAxiosError(err, 'Could not load guides.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async () => {
    if (!active || !draft.trim()) return;
    const message = draft.trim();
    setDraft('');
    setError('');
    try {
      const res = await aiGuidesAPI.chat(active.id, message);
      setReply(res.reply);
      onAsk?.(active);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not reach that guide.'));
    }
  };

  return (
    <StageFrame>
      <Text style={styles.kicker}>IMPROVE YOURSELF — EXPERT HELPERS</Text>
      <View style={styles.goldCard}>
        <Text style={styles.goldTitle}>AI Crew — pick your guide</Text>
        <Text style={styles.goldBody}>Choose one to coach texting, dates, and how you show up.</Text>
      </View>
      {loading ? <ActivityIndicator color={shell.cyan} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <ScrollView style={styles.guideList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {guides.map((guide) => (
          <Pressable key={guide.id} onPress={() => setActive(guide)} style={[styles.guide, active?.id === guide.id && styles.guideOn]}>
            <Text style={styles.personName}>{guide.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{guide.tagline || guide.specialty}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {active ? (
        <>
          <Hint>{`Ask ${active.name.split(' ')[0]}`}</Hint>
          <Field placeholder="What do you want help with?" value={draft} onChangeText={setDraft} />
          <NeonButton label="Ask" tone="gold" onPress={() => void send()} disabled={!draft.trim()} />
          {reply ? <Notice tone="gold">{reply}</Notice> : null}
        </>
      ) : null}
    </StageFrame>
  );
}

export function HighlightsPanel() {
  const [spin] = useState(() => new Animated.Value(0));
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<(typeof WHEEL)[number] | null>(null);
  const [turns, setTurns] = useState(0);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    const slice = Math.floor(Math.random() * WHEEL.length);
    const next = turns + 4 + slice / WHEEL.length;
    setTurns(next);
    Animated.timing(spin, {
      toValue: next,
      duration: 2800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setLanded(WHEEL[slice]);
      setSpinning(false);
    });
  };

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <StageFrame>
      <PanelTitle icon="✨">Highlights</PanelTitle>
      <Hint>{spinning ? 'Spinning...' : 'Tap the wheel to spin a chat game.'}</Hint>
      <View style={styles.wheelWrap}>
        <Text style={styles.pointer}>▼</Text>
        <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
          {WHEEL.map((game, index) => {
            const angle = ((index * 60 - 90) * Math.PI) / 180;
            const radius = 78;
            return (
              <Text
                key={game.short}
                style={[
                  styles.slice,
                  {
                    left: 120 + radius * Math.cos(angle) - 28,
                    top: 120 + radius * Math.sin(angle) - 10,
                    color: index % 2 === 0 ? shell.cyan : shell.magentaSoft,
                  },
                ]}
              >
                {game.short}
              </Text>
            );
          })}
          <Pressable onPress={handleSpin} disabled={spinning} style={styles.hub}>
            <Text style={styles.hubText}>SPIN</Text>
          </Pressable>
        </Animated.View>
      </View>
      {landed ? (
        <Notice>{`${landed.name}. ${landed.blurb}`}</Notice>
      ) : null}
    </StageFrame>
  );
}

export function AdvicePanel() {
  const [questions, setQuestions] = useState<AdviceQuestion[]>([]);
  const [query, setQuery] = useState('');
  const [cohort, setCohort] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await adviceAPI.getFeed(q);
      setQuestions(data.questions || []);
      setCohort(data.cohortLabel || '');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load advice.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ask = async () => {
    if (!query.trim()) return;
    setError('');
    try {
      await adviceAPI.search(query.trim());
      setQuery('');
      await load();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not ask that.'));
    }
  };

  return (
    <StageFrame>
      <PanelTitle icon="💡">Dating Advice</PanelTitle>
      {cohort ? <Hint>{cohort}</Hint> : null}
      <Field placeholder="Ask the cohort…" value={query} onChangeText={setQuery} />
      <NeonButton label="Ask" onPress={() => void ask()} disabled={!query.trim()} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? <ActivityIndicator color={shell.cyan} /> : null}
      {questions.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.personName}>{item.query}</Text>
          <Text style={styles.meta}>{item.answers?.length || 0} answers</Text>
        </View>
      ))}
    </StageFrame>
  );
}

export { ConfessionPanel };

export function HelpPanel({ onOpen }: { onOpen: (id: WidgetId | 'profile') => void }) {
  return (
    <StageFrame>
      <PanelTitle icon="❓">Help</PanelTitle>
      <Hint>Tap a feature card. It opens that part of the dashboard.</Hint>
      <Text style={styles.kicker}>How Hook Up works</Text>
      {BABY_STEPS.map((step, index) => (
        <Text key={step} style={styles.step}>
          {index + 1}. {step}
        </Text>
      ))}
      <View style={styles.grid}>
        {HELP_LINKS.map((link) => (
          <Pressable key={link.id} onPress={() => onOpen(link.id)} style={styles.helpCard}>
            <Text style={styles.helpIcon}>{link.icon}</Text>
            <Text style={styles.helpLabel}>{link.label}</Text>
            <Text style={styles.meta}>{link.hint}</Text>
          </Pressable>
        ))}
      </View>
    </StageFrame>
  );
}

export function SafetyPanel() {
  const [settings, setSettings] = useState<ShieldSettings | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [word, setWord] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmHelp, setConfirmHelp] = useState(false);

  const load = async () => {
    try {
      const res = await personalSafetyAPI.getSettings();
      setSettings(res.settings);
      setMissing(res.ready?.missing || []);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load the safety shield.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveWord = async () => {
    if (!word.trim()) return;
    setBusy(true);
    setError('');
    try {
      await personalSafetyAPI.updateSettings({ activationSecret: word.trim() });
      setWord('');
      setNotice('Activation word saved.');
      await load();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not save that word.'));
    } finally {
      setBusy(false);
    }
  };

  const arm = async (next: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (next) await personalSafetyAPI.arm();
      else await personalSafetyAPI.disarm();
      setNotice(next ? 'Shield armed.' : 'Shield disarmed.');
      await load();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not update the shield.'));
    } finally {
      setBusy(false);
    }
  };

  const sendHelp = async () => {
    if (!confirmHelp) {
      setConfirmHelp(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location is required to send a safety signal.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const res = await personalSafetyAPI.trigger(pos.coords.latitude, pos.coords.longitude, 'help_button');
      setNotice(res.message || 'Safety signal sent.');
      setConfirmHelp(false);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send the safety signal.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <StageFrame>
      <PanelTitle icon="🛡️">Personal safety shield</PanelTitle>
      {settings?.armed ? <Notice>Shield armed</Notice> : null}
      <Hint>
        Your safety signal shares location with nearby people and your emergency contact. Shout your secret word, or use Help.
      </Hint>
      {missing.length > 0 ? <Notice tone="gold">{`Setup needed: ${missing.join(', ')}`}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice>{notice}</Notice> : null}
      <Field label="Activation word" value={word} onChangeText={setWord} placeholder="A phrase only you know" autoCapitalize="none" />
      <NeonButton label={busy ? 'Saving…' : 'Save activation word'} onPress={() => void saveWord()} disabled={busy || !word.trim()} />
      {settings?.armed ? (
        <NeonButton label="Disarm shield" tone="ghost" onPress={() => void arm(false)} disabled={busy} />
      ) : (
        <NeonButton label="Arm shield" onPress={() => void arm(true)} disabled={busy} />
      )}
      <NeonButton
        label={confirmHelp ? 'Tap again to send the safety signal' : 'Help'}
        tone="danger"
        disabled={busy}
        onPress={() => void sendHelp()}
      />
      <Hint>The second tap sends your location to nearby people and your emergency contact.</Hint>
    </StageFrame>
  );
}

export function DateArenaPanel({ onOpenGuides }: { onOpenGuides: () => void }) {
  const [catalog, setCatalog] = useState<DateMatchCatalog | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void dateMatchAPI
      .catalog()
      .then((data) => {
        setCatalog(data);
        setPicked(data.savedLookingFor || []);
      })
      .catch((err) => setError(formatAxiosError(err, 'Could not load Date Arena.')));
  }, []);

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const search = async () => {
    if (picked.length === 0) {
      setError('Pick what you are looking for.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await dateMatchAPI.saveLookingFor(picked);
      const res = await dateMatchAPI.search(picked, 'city');
      if (res.needUpgrade) setStatus('Free searches are used up. Plus, Gold, or Platinum unlocks more.');
      else if (res.other) setStatus(`Paired with ${res.other.name}. Check Communications if a chat opens.`);
      else if (res.searching) setStatus('Matching in the background. You will get a pair at a similar interest level.');
      else setStatus('Search is in. Stay in the app.');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not start a search.'));
    } finally {
      setLoading(false);
    }
  };

  const quota = catalog?.quota;

  return (
    <StageFrame>
      <PanelTitle icon="⚔️">Date Arena</PanelTitle>
      <Hint>
        {quota?.unlimited
          ? 'Matching runs quietly in the background. Unlimited searches.'
          : `Matching runs quietly in the background. ${quota?.remaining ?? 0} of ${quota?.limit ?? 3} free searches left this month.`}
      </Hint>
      <NeonButton label="Get a guide" tone="gold" onPress={onOpenGuides} />
      <View style={styles.chips}>
        {(catalog?.lookingFor || []).map((option) => {
          const on = picked.includes(option.id);
          return (
            <Pressable key={option.id} onPress={() => toggle(option.id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? <Notice>{status}</Notice> : null}
      <NeonButton label={loading ? 'Searching…' : 'Search my city'} onPress={() => void search()} disabled={loading} />
    </StageFrame>
  );
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [tab, setTab] = useState<'notifications' | 'privacy' | 'filters'>('notifications');
  const [error, setError] = useState('');
  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('99');
  const [distance, setDistance] = useState('50');
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');

  useEffect(() => {
    void settingsAPI
      .getSettings()
      .then((res) => {
        setSettings(res.settings);
        setMinAge(String(res.settings.filters.minAge));
        setMaxAge(String(res.settings.filters.maxAge));
        setDistance(String(res.settings.filters.maxDistance));
        setQuietStart(res.settings.notifications.quietHours.start);
        setQuietEnd(res.settings.notifications.quietHours.end);
      })
      .catch((err) => setError(formatAxiosError(err, 'Could not load settings.')));
  }, []);

  const saveNotifications = async (notifications: UserSettings['notifications']) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, notifications });
    try {
      const res = await settingsAPI.updateNotifications(notifications);
      setSettings(res.settings);
    } catch (err) {
      setSettings(previous);
      setError(formatAxiosError(err, 'Could not update notifications.'));
    }
  };

  const savePrivacy = async (privacy: UserSettings['privacy']) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, privacy });
    try {
      const res = await settingsAPI.updatePrivacy(privacy);
      setSettings(res.settings);
    } catch (err) {
      setSettings(previous);
      setError(formatAxiosError(err, 'Could not update privacy.'));
    }
  };

  const saveFilters = async () => {
    if (!settings) return;
    const filters = {
      ...settings.filters,
      minAge: Math.min(99, Math.max(18, Number(minAge) || 18)),
      maxAge: Math.min(99, Math.max(18, Number(maxAge) || 99)),
      maxDistance: Math.min(1000, Math.max(1, Number(distance) || 50)),
    };
    const previous = settings;
    setSettings({ ...settings, filters });
    try {
      const res = await settingsAPI.updateFilters(filters);
      setSettings(res.settings);
    } catch (err) {
      setSettings(previous);
      setError(formatAxiosError(err, 'Could not update filters.'));
    }
  };

  return (
    <StageFrame>
      <PanelTitle icon="⚙️">Settings</PanelTitle>
      <View style={styles.chips}>
        {(['notifications', 'privacy', 'filters'] as const).map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.chip, tab === item && styles.chipOn]}>
            <Text style={[styles.chipText, tab === item && styles.chipTextOn]}>
              {item === 'notifications' ? 'Alerts' : item === 'privacy' ? 'Privacy' : 'Filters'}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!settings ? <ActivityIndicator color={shell.cyan} /> : null}
      {settings && tab === 'notifications' ? (
        <>
          <Toggle label="Push" value={settings.notifications.push} onChange={(push) => void saveNotifications({ ...settings.notifications, push })} />
          <Toggle label="Email" value={settings.notifications.email} onChange={(email) => void saveNotifications({ ...settings.notifications, email })} />
          <Toggle label="Messages" value={settings.notifications.messages} onChange={(messages) => void saveNotifications({ ...settings.notifications, messages })} />
          <Toggle label="Matches" value={settings.notifications.matches} onChange={(matches) => void saveNotifications({ ...settings.notifications, matches })} />
          <Toggle label="Likes" value={settings.notifications.likes} onChange={(likes) => void saveNotifications({ ...settings.notifications, likes })} />
          <Toggle label="Interest alerts" value={settings.notifications.interestAlerts !== false} onChange={(interestAlerts) => void saveNotifications({ ...settings.notifications, interestAlerts })} />
          <Toggle label="Vibrate for interest" value={settings.notifications.interestVibrate !== false} onChange={(interestVibrate) => void saveNotifications({ ...settings.notifications, interestVibrate })} />
          <Toggle label="Sound" value={settings.notifications.sound} onChange={(sound) => void saveNotifications({ ...settings.notifications, sound })} />
          <Toggle
            label="Quiet hours"
            value={settings.notifications.quietHours.enabled}
            onChange={(enabled) => void saveNotifications({ ...settings.notifications, quietHours: { ...settings.notifications.quietHours, enabled, start: quietStart, end: quietEnd } })}
          />
          {settings.notifications.quietHours.enabled ? (
            <>
              <Field label="Quiet from" value={quietStart} onChangeText={setQuietStart} placeholder="22:00" autoCapitalize="none" />
              <Field label="Quiet until" value={quietEnd} onChangeText={setQuietEnd} placeholder="08:00" autoCapitalize="none" />
              <NeonButton
                label="Save quiet hours"
                onPress={() => void saveNotifications({ ...settings.notifications, quietHours: { enabled: true, start: quietStart, end: quietEnd } })}
              />
            </>
          ) : null}
        </>
      ) : null}
      {settings && tab === 'privacy' ? (
        <>
          <Toggle label="Show profile picture" value={settings.privacy.showProfilePicture !== false} onChange={(showProfilePicture) => void savePrivacy({ ...settings.privacy, showProfilePicture })} />
          <Toggle label="Show location" value={settings.privacy.showLocation} onChange={(showLocation) => void savePrivacy({ ...settings.privacy, showLocation })} />
          <Toggle label="Real-time location" value={settings.privacy.realTimeLocation} onChange={(realTimeLocation) => void savePrivacy({ ...settings.privacy, realTimeLocation })} />
          <Toggle label="Show online" value={settings.privacy.showOnlineStatus} onChange={(showOnlineStatus) => void savePrivacy({ ...settings.privacy, showOnlineStatus })} />
          <Toggle label="Read receipts" value={settings.privacy.readReceipts} onChange={(readReceipts) => void savePrivacy({ ...settings.privacy, readReceipts })} />
          <Text style={styles.kicker}>Location accuracy</Text>
          <View style={styles.chips}>
            {(['exact', 'approximate', 'city'] as const).map((item) => (
              <Pressable key={item} onPress={() => void savePrivacy({ ...settings.privacy, locationAccuracy: item })} style={[styles.chip, settings.privacy.locationAccuracy === item && styles.chipOn]}>
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.kicker}>Who can see you</Text>
          <View style={styles.chips}>
            {(['public', 'friends', 'private'] as const).map((item) => (
              <Pressable key={item} onPress={() => void savePrivacy({ ...settings.privacy, profileVisibility: item })} style={[styles.chip, settings.privacy.profileVisibility === item && styles.chipOn]}>
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <PrivacyPolicyCopy />
        </>
      ) : null}
      {settings && tab === 'filters' ? (
        <>
          <Field label="Min age" value={minAge} onChangeText={setMinAge} keyboardType="number-pad" />
          <Field label="Max age" value={maxAge} onChangeText={setMaxAge} keyboardType="number-pad" />
          <Field label="Max distance (km)" value={distance} onChangeText={setDistance} keyboardType="number-pad" />
          <Toggle label="Verified people only" value={settings.filters.verifiedOnly} onChange={(verifiedOnly) => setSettings({ ...settings, filters: { ...settings.filters, verifiedOnly } })} />
          <Toggle label="Active people only" value={settings.filters.activeOnly} onChange={(activeOnly) => setSettings({ ...settings, filters: { ...settings.filters, activeOnly } })} />
          <NeonButton label="Save filters" tone="magenta" onPress={() => void saveFilters()} />
        </>
      ) : null}
      <AccountControls />
      <PrivacyPolicyLink />
    </StageFrame>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.personName}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: shell.cyan, false: '#333' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { color: shell.cyan, fontSize: 13, fontWeight: '700', letterSpacing: 0.8 },
  goldCard: {
    borderWidth: 2,
    borderColor: shell.gold,
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(234, 88, 12, 0.22)',
    gap: 4,
  },
  goldTitle: { color: shell.goldText, fontSize: 14, fontWeight: '700' },
  goldBody: { color: '#e7c9a0', fontSize: 12, lineHeight: 18 },
  guideList: { maxHeight: 280 },
  guide: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  guideOn: { backgroundColor: shell.active, borderRadius: 8, paddingHorizontal: 8 },
  personName: { color: shell.white, fontSize: 15, fontWeight: '700' },
  meta: { color: shell.faint, fontSize: 12, marginTop: 2 },
  card: { gap: 4, paddingVertical: 8 },
  hero: { fontSize: 48, textAlign: 'center' },
  confessionTitle: { color: shell.cream, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  step: { color: shell.text, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  helpCard: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: shell.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#161616',
    gap: 4,
  },
  helpIcon: { fontSize: 18 },
  helpLabel: { color: shell.white, fontSize: 13, fontWeight: '700' },
  wheelWrap: { alignItems: 'center', paddingTop: 8 },
  pointer: { color: shell.pink, fontSize: 18, marginBottom: 4 },
  wheel: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 3,
    borderColor: shell.cyan,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slice: { position: 'absolute', width: 56, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  hub: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: shell.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubText: { color: shell.white, fontWeight: '800', letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { borderColor: shell.cyan, backgroundColor: 'rgba(0, 212, 255, 0.16)' },
  chipText: { color: shell.text, fontSize: 13 },
  chipTextOn: { color: shell.cyan, fontWeight: '700' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
});
