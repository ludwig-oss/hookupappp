import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { accountAPI } from '../api/account';
import { profileAPI } from '../api/profile';
import { formatAxiosError } from '../lib/apiError';
import { useAuth } from '../state/AuthContext';
import { shell } from './dashboard/chrome';

const DELETE_COPY = 'Are you sure you want to permanently delete your account? This action cannot be undone.';
const PAUSE_COPY = 'Pausing hides your profile from discovery and other users. Your photos, posts, and account stay saved so you can come back later.';

export function AccountControls() {
  const { logout, updateUser } = useAuth();
  const [paused, setPaused] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    profileAPI
      .getCurrentUser()
      .then((profile) => {
        if (!cancelled) setPaused(profile.isPaused === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const savePause = async (next: boolean) => {
    setError('');
    setBusy(true);
    try {
      const result = await accountAPI.setPaused(next);
      setPaused(result.isPaused);
      updateUser({ isPaused: result.isPaused });
      setPauseOpen(false);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not update pause.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setError('');
    setBusy(true);
    try {
      await accountAPI.deleteAccount();
      setDeleteOpen(false);
      logout();
    } catch (err) {
      setBusy(false);
      setError(formatAxiosError(err, 'Could not delete the account.'));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>ACCOUNT</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Pause Account</Text>
          <Text style={styles.hint}>Go invisible. Your data stays until you turn this off.</Text>
        </View>
        <Switch
          value={paused}
          disabled={busy}
          onValueChange={(next) => {
            if (next) setPauseOpen(true);
            else void savePause(false);
          }}
          trackColor={{ true: shell.cyan, false: '#333' }}
        />
      </View>
      <Pressable disabled={busy} onPress={() => logout()} style={styles.logoutBtn}>
        <Text style={styles.logoutLabel}>Log out</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => setDeleteOpen(true)} style={styles.deleteBtn}>
        <Text style={styles.deleteLabel}>Delete Account</Text>
      </Pressable>
      <Confirm
        visible={pauseOpen}
        title="Pause Account"
        body={PAUSE_COPY}
        yesLabel="Pause account"
        busy={busy}
        onYes={() => void savePause(true)}
        onNo={() => setPauseOpen(false)}
      />
      <Confirm
        visible={deleteOpen}
        title="Delete Account"
        body={DELETE_COPY}
        yesLabel="Yes"
        danger
        busy={busy}
        onYes={() => void confirmDelete()}
        onNo={() => setDeleteOpen(false)}
      />
    </View>
  );
}

function Confirm({
  visible,
  title,
  body,
  yesLabel,
  danger,
  busy,
  onYes,
  onNo,
}: {
  visible: boolean;
  title: string;
  body: string;
  yesLabel: string;
  danger?: boolean;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Pressable disabled={busy} onPress={onNo} style={styles.noBtn}>
              <Text style={styles.noLabel}>No</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={onYes} style={[styles.yesBtn, danger && styles.yesDanger]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.yesLabel}>{yesLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.16)', gap: 12 },
  kicker: { color: shell.cyan, fontSize: 13, fontWeight: '700', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  copy: { flex: 1, gap: 4 },
  title: { color: shell.white, fontSize: 16, fontWeight: '700' },
  hint: { color: shell.faint, fontSize: 13, lineHeight: 18 },
  error: { color: '#ffb4c8', fontSize: 13, lineHeight: 18 },
  deleteBtn: { borderWidth: 1, borderColor: '#ff4d6d', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteLabel: { color: '#ff4d6d', fontWeight: '700' },
  logoutBtn: { borderWidth: 1, borderColor: shell.cyan, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  logoutLabel: { color: shell.cyan, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#16121c', borderRadius: 16, padding: 18, gap: 12 },
  body: { color: shell.text, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  noBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  noLabel: { color: shell.white, fontWeight: '600' },
  yesBtn: { backgroundColor: shell.cyan, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minWidth: 88, alignItems: 'center' },
  yesDanger: { backgroundColor: '#ff4d6d' },
  yesLabel: { color: '#fff', fontWeight: '700' },
});
