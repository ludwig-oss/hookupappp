import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aiGuidesAPI, type AiGuideCharacter } from '../api/aiGuides';
import { connectionsAPI } from '../api/connections';
import { postsAPI } from '../api/posts';
import { relationshipAPI } from '../api/relationship';
import { schoolAPI } from '../api/school';
import { settingsAPI } from '../api/settings';
import { useAuth } from '../state/AuthContext';
import { ActivityPanel, AdvicePanel, CompatibilityPanel, ConfessionPanel, DateArenaPanel, HelpPanel, HighlightsPanel, SafetyPanel, SettingsPanel } from '../components/dashboard/FeaturePanels';
import { EventsPanel } from '../components/dashboard/EventsPanel';
import { ChatPanel } from '../components/dashboard/ChatPanel';
import { ConnectionsPanel } from '../components/dashboard/ConnectionsPanel';
import { FeedPanel } from '../components/dashboard/FeedPanel';
import { NearbyInterestPopup } from '../components/dashboard/NearbyInterestPopup';
import { ProfilePanel } from '../components/dashboard/ProfilePanel';
import { ScoutPanel } from '../components/dashboard/ScoutPanel';
import { shell } from '../components/dashboard/chrome';
import { RELATIONSHIP_LOCKED, tabForWidget, tabHomeWidget, type MainTab, type WidgetId } from '../components/dashboard/types';

const DOCK: Array<{ id: MainTab; icon: string; label: string }> = [
  { id: 'Connections', icon: '👥', label: 'Connection' },
  { id: 'Feed', icon: '❤️', label: 'Feed' },
  { id: 'Communications', icon: '💬', label: 'Comms' },
  { id: 'Profile', icon: '👤', label: 'Profile' },
];

type SideEntry =
  | { kind: 'label'; text: string }
  | { kind: 'hint'; text: string }
  | { kind: 'item'; id: WidgetId; icon: string; label: string };

const SIDE: Record<MainTab, SideEntry[]> = {
  Connections: [
    { kind: 'label', text: 'Meet' },
    { kind: 'item', id: 'scout', icon: '🔭', label: 'Scout' },
    { kind: 'item', id: 'datematch', icon: '⚔️', label: 'Date Arena' },
    { kind: 'item', id: 'events', icon: '📅', label: 'Events' },
    { kind: 'label', text: 'International' },
    { kind: 'item', id: 'activity', icon: '🌍', label: 'Search a city' },
  ],
  Feed: [{ kind: 'hint', text: 'Select main panel feature' }],
  Communications: [
    { kind: 'label', text: 'Integrations' },
    { kind: 'item', id: 'advice', icon: '💡', label: 'Dating Advice' },
    { kind: 'item', id: 'confession', icon: '🤫', label: 'Confession Booth' },
    { kind: 'item', id: 'activity', icon: '📈', label: 'Activity Stream' },
  ],
  Profile: [
    { kind: 'label', text: 'Workspace' },
    { kind: 'item', id: 'compatibility', icon: '🧬', label: 'Compatibility' },
    { kind: 'item', id: 'highlights', icon: '✨', label: 'Highlights' },
    { kind: 'label', text: 'Support' },
    { kind: 'item', id: 'safety', icon: '🛡️', label: 'Safety Shield' },
    { kind: 'item', id: 'help', icon: '❓', label: 'Help Center' },
  ],
};

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>('Connections');
  const [openWidget, setOpenWidget] = useState<WidgetId | null>('connections');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [returnTo, setReturnTo] = useState<'help' | null>(null);
  const [inRelationship, setInRelationship] = useState(false);
  const [blowingUp, setBlowingUp] = useState(0);
  const [guide, setGuide] = useState<AiGuideCharacter | null>(null);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [nearbyPulse, setNearbyPulse] = useState(0);
  const [liveNote, setLiveNote] = useState('');
  const sidebarWidth = Math.min(Dimensions.get('window').width * 0.7, 320);
  const slide = useRef(new Animated.Value(-sidebarWidth)).current;
  const stageScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: sidebarOpen ? 0 : -sidebarWidth,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen, sidebarWidth, slide]);

  useEffect(() => {
    if (!user?.id) return;
    void relationshipAPI
      .getMyRelationship()
      .then((res) => {
        const active = res.relationship?.status === 'active';
        setInRelationship(active);
        if (active) {
          setOpenWidget((current) => (current && RELATIONSHIP_LOCKED.includes(current) ? null : current));
        }
      })
      .catch(() => setInRelationship(false));
  }, [user?.id]);

  useEffect(() => {
    void postsAPI
      .getBlowingUpCount()
      .then((res) => setBlowingUp(res.count || 0))
      .catch(() => setBlowingUp(0));
  }, [activeTab]);

  useEffect(() => {
    void aiGuidesAPI
      .me()
      .then((res) => setGuide(res.guide || null))
      .catch(() => setGuide(null));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const pull = async () => {
      const [school, buzzes] = await Promise.all([
        schoolAPI.getToday().catch(() => null),
        connectionsAPI.getMyBuzzes(user.id).catch(() => null),
        settingsAPI.getSettings().catch(() => null),
      ]);
      if (cancelled) return;
      const pending = (buzzes?.received || []).filter((item) => item.status === 'pending').length;
      const lesson = school?.showNotification ? school.currentTopic?.lessonTitle : '';
      const parts = [
        pending ? `${pending} buzz${pending === 1 ? '' : 'es'} from the live inbox` : '',
        lesson ? `Class: ${lesson}` : '',
      ].filter(Boolean);
      setLiveNote(parts.join(' · '));
    };
    void pull();
    const timer = setInterval(() => void pull(), 25000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (openWidget) setActiveTab(tabForWidget(openWidget));
  }, [openWidget]);

  const locked = useCallback(
    (id: WidgetId) => inRelationship && RELATIONSHIP_LOCKED.includes(id),
    [inRelationship]
  );

  const openFeature = useCallback(
    (id: WidgetId) => {
      if (locked(id)) return;
      setReturnTo(null);
      setOpenWidget(id);
      setSidebarOpen(false);
    },
    [locked]
  );

  const selectTab = (tab: MainTab) => {
    setSidebarOpen(false);
    setReturnTo(null);
    setActiveTab(tab);
    setOpenWidget(tabHomeWidget(tab, inRelationship));
  };

  const showBack = Boolean(returnTo) || (openWidget != null && openWidget !== tabHomeWidget(activeTab, inRelationship));

  const goBack = () => {
    if (returnTo) {
      setOpenWidget(returnTo);
      setReturnTo(null);
      return;
    }
    setOpenWidget(tabHomeWidget(activeTab, inRelationship));
  };

  const openChat = (otherUserId: string) => {
    setChatUserId(otherUserId);
    setReturnTo(null);
    setOpenWidget('chat');
    setSidebarOpen(false);
  };

  const clearChatTarget = useCallback(() => setChatUserId(null), []);

  const openFromHelp = (id: WidgetId | 'profile') => {
    if (id === 'profile') {
      setReturnTo(null);
      setActiveTab('Profile');
      setOpenWidget(null);
      return;
    }
    if (locked(id)) return;
    setReturnTo('help');
    setOpenWidget(id);
  };

  const checkNearby = () => {
    if (inRelationship) return;
    setReturnTo(null);
    setActiveTab('Connections');
    setOpenWidget('connections');
    setSidebarOpen(false);
    setNearbyPulse((value) => value + 1);
  };

  const sideEntries = SIDE[activeTab];
  const stage = useMemo(() => {
    if (!user?.id) return null;
    if (openWidget === 'connections') {
      return <ConnectionsPanel userId={user.id} refreshToken={nearbyPulse} onOpenChat={openChat} scrollRef={stageScroll} />;
    }
    if (openWidget === 'lovefeed') return <FeedPanel onShare={() => openFeature('chat')} />;
    if (openWidget === 'chat') {
      return <ChatPanel userId={user.id} openUserId={chatUserId} onOpened={clearChatTarget} />;
    }
    if (openWidget === 'activity') return <ActivityPanel defaultCity={user.city} onOpenChat={openChat} />;
    if (openWidget === 'compatibility') return <CompatibilityPanel />;
    if (openWidget === 'highlights') return <HighlightsPanel />;
    if (openWidget === 'advice') return <AdvicePanel />;
    if (openWidget === 'confession') return <ConfessionPanel />;
    if (openWidget === 'events') return <EventsPanel city={user.city} country={user.country} />;
    if (openWidget === 'help') return <HelpPanel onOpen={openFromHelp} />;
    if (openWidget === 'safety') return <SafetyPanel />;
    if (openWidget === 'datematch') return <DateArenaPanel onOpenGuides={() => openFeature('compatibility')} />;
    if (openWidget === 'scout') return <ScoutPanel onOpenChat={openChat} />;
    if (openWidget === 'settings') return <SettingsPanel />;
    if (activeTab === 'Profile') {
      return <ProfilePanel onSignOut={logout} onOpenSettings={() => openFeature('settings')} />;
    }
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          {activeTab === 'Connections' && inRelationship
            ? 'In a relationship — focus on your partner.'
            : activeTab === 'Feed'
              ? '💖 Love Life Feed'
              : activeTab === 'Communications'
                ? '💬 Messages Inbox'
                : 'Connections'}
        </Text>
      </View>
    );
  }, [user?.id, user?.city, user?.country, openWidget, nearbyPulse, chatUserId, activeTab, inRelationship, clearChatTarget, openFeature, logout]);

  return (
    <View style={styles.shell}>
      <View style={[styles.topbar, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <View style={styles.headerSide}>
          <Pressable
            onPress={() => setSidebarOpen((open) => !open)}
            style={styles.iconBtn}
            accessibilityLabel={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <Text style={styles.iconBtnText}>☰</Text>
          </Pressable>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {activeTab === 'Connections' ? 'CONNECTION' : activeTab.toUpperCase()}
        </Text>
        <View style={[styles.headerSide, styles.headerActions]}>
          {!inRelationship ? (
            <Pressable onPress={checkNearby} style={styles.nearby}>
              <Text style={styles.nearbyText}>50m</Text>
            </Pressable>
          ) : null}
          {showBack ? (
            <Pressable onPress={goBack} style={styles.iconBtn} accessibilityLabel={returnTo === 'help' ? 'Back to help' : 'Back'}>
              <Text style={styles.iconBtnText}>←</Text>
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>
      </View>

      <View style={styles.stage}>
        <ScrollView
          ref={stageScroll}
          key={`${activeTab}-${openWidget || 'home'}`}
          contentContainerStyle={styles.stageContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {liveNote ? <Text style={styles.liveNote}>{liveNote}</Text> : null}
          {stage}
        </ScrollView>

        {sidebarOpen ? (
          <Pressable style={styles.backdrop} onPress={() => setSidebarOpen(false)} accessibilityLabel="Close menu" />
        ) : null}
        <Animated.View
          pointerEvents={sidebarOpen ? 'auto' : 'none'}
          style={[styles.sidebar, { width: sidebarWidth, transform: [{ translateX: slide }] }]}
        >
          <ScrollView contentContainerStyle={styles.sideInner} keyboardShouldPersistTaps="handled">
            {sideEntries.map((entry, index) => {
              if (entry.kind === 'label') {
                return (
                  <Text key={`label-${entry.text}-${index}`} style={[styles.sideLabel, index === 0 && styles.sideLabelFirst]}>
                    {entry.text}
                  </Text>
                );
              }
              if (entry.kind === 'hint') {
                return (
                  <Text key="hint" style={styles.sideHint}>
                    {entry.text}
                  </Text>
                );
              }
              const isLocked = locked(entry.id);
              const active = openWidget === entry.id;
              return (
                <Pressable
                  key={entry.id}
                  disabled={isLocked}
                  onPress={() => openFeature(entry.id)}
                  style={[styles.sideItem, active && styles.sideItemOn, isLocked && styles.locked]}
                >
                  <Text style={styles.sideIcon}>{entry.icon}</Text>
                  <Text style={styles.sideItemText}>{entry.label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setSidebarOpen(false);
                logout();
              }}
              style={[styles.sideItem, styles.logout]}
            >
              <Text style={styles.sideIcon}>↩</Text>
              <Text style={[styles.sideItemText, styles.logoutText]}>Logout</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>

        {guide ? (
          <Pressable style={styles.fab} onPress={() => openFeature('compatibility')}>
            {guide.portrait ? <Image source={{ uri: guide.portrait }} style={styles.fabImage} /> : <View style={styles.fabImage} />}
            <Text style={styles.fabText}>Ask {guide.name.split(' ')[0]}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom, height: 65 + insets.bottom }]}>
        {DOCK.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => selectTab(tab.id)} style={styles.dockTab}>
              <Text style={styles.dockIcon}>{tab.icon}</Text>
              {tab.id === 'Feed' && blowingUp > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{blowingUp > 99 ? '99' : blowingUp}</Text>
                </View>
              ) : null}
              <Text style={[styles.dockLabel, active && styles.dockLabelOn]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {user?.id && !inRelationship ? (
        <NearbyInterestPopup userId={user.id} onOpenChat={openChat} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: shell.bg },
  topbar: {
    backgroundColor: shell.bar,
    borderBottomWidth: 1,
    borderBottomColor: shell.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerSide: { width: 112, flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { color: shell.white, fontSize: 24 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: shell.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerActions: { justifyContent: 'flex-end' },
  nearby: {
    borderWidth: 1,
    borderColor: shell.cyan,
    backgroundColor: 'rgba(0, 212, 255, 0.16)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nearbyText: { color: '#7ef0ff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  stage: { flex: 1, backgroundColor: shell.bg },
  stageContent: { flexGrow: 1, paddingBottom: 88 },
  placeholder: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholderText: { color: shell.muted, fontSize: 18, fontWeight: '500', textAlign: 'center' },
  liveNote: {
    color: shell.cyan,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: shell.side,
    borderRightWidth: 1,
    borderRightColor: shell.sideLine,
  },
  sideInner: { padding: 20, paddingBottom: 32 },
  sideLabel: {
    marginTop: 25,
    marginBottom: 12,
    color: shell.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sideLabelFirst: { marginTop: 0 },
  sideHint: { color: shell.text, fontSize: 14, fontWeight: '500', marginTop: 8 },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: shell.sideLine,
  },
  sideItemOn: { backgroundColor: shell.active, borderRadius: 6, paddingLeft: 10, borderBottomColor: 'transparent' },
  sideIcon: { width: 24, textAlign: 'center', fontSize: 16 },
  sideItemText: { color: shell.text, fontSize: 14, fontWeight: '500', flex: 1 },
  locked: { opacity: 0.4 },
  logout: { marginTop: 28, borderBottomWidth: 0 },
  logoutText: { color: shell.pink },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: shell.gold,
    borderRadius: 999,
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 6,
  },
  fabImage: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222' },
  fabText: { color: shell.white, fontSize: 13, fontWeight: '700' },
  dock: {
    backgroundColor: shell.bar,
    borderTopWidth: 1,
    borderTopColor: shell.line,
    flexDirection: 'row',
  },
  dockTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dockIcon: { fontSize: 22 },
  dockLabel: { color: shell.muted, fontSize: 9 },
  dockLabelOn: { color: shell.white },
  badge: {
    position: 'absolute',
    top: 6,
    marginLeft: 22,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: shell.badge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: shell.white, fontSize: 10, fontWeight: '700' },
});
