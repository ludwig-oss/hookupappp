import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { chatAPI } from '../api/chat';
import { reportsAPI, type ReportCategory } from '../api/reports';
import { formatAxiosError } from '../lib/apiError';
import { useAuth } from '../state/AuthContext';
import { shell } from './dashboard/chrome';

const REASONS: Array<{ id: ReportCategory; label: string }> = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
];

export const PRIVACY_POLICY_URL = 'https://deinewebsite.com';

export function UgcSafetyActions({
  userId,
  onBlocked,
}: {
  userId?: string | null;
  onBlocked?: (userId: string) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = String(userId || '');
  if (!target || (user?.id && String(user.id) === target)) return null;

  const report = async (category: ReportCategory) => {
    setBusy(true);
    setError('');
    try {
      await reportsAPI.createReport(target, category, 'Reported from a post, photo, or video.');
      setSent(true);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send the report.'));
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    setBusy(true);
    setError('');
    try {
      await chatAPI.blockUser(target);
      onBlocked?.(target);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not block this person.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={() => { setOpen(true); setSent(false); setError(''); }} style={styles.report}>
        <Text style={styles.reportText}>Report (Melden)</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => void block()} style={styles.block}>
        <Text style={styles.blockText}>Block (Blockieren)</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Report (Melden)</Text>
            {sent ? (
              <Text style={styles.body}>Our moderation team will review it within 24 hours.</Text>
            ) : (
              REASONS.map((reason) => (
                <Pressable key={reason.id} disabled={busy} onPress={() => void report(reason.id)} style={styles.reason}>
                  {busy ? <ActivityIndicator color={shell.cyan} /> : <Text style={styles.reasonText}>{reason.label}</Text>}
                </Pressable>
              ))
            )}
            <Pressable onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.reasonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function PrivacyPolicyLink() {
  return (
    <Pressable onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} style={styles.policy}>
      <Text style={styles.policyText}>Privacy Policy (Datenschutzerklärung)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  report: { borderWidth: 1, borderColor: shell.cyan, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  reportText: { color: shell.cyan, fontSize: 12, fontWeight: '700' },
  block: { borderWidth: 1, borderColor: '#ff4d6d', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  blockText: { color: '#ff4d6d', fontSize: 12, fontWeight: '700' },
  error: { color: '#ffb4c8', fontSize: 12, width: '100%' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#16121c', borderRadius: 16, padding: 18, gap: 10 },
  title: { color: shell.white, fontSize: 18, fontWeight: '700' },
  body: { color: shell.text, fontSize: 15, lineHeight: 22 },
  reason: { borderWidth: 1, borderColor: shell.line, borderRadius: 10, padding: 12 },
  reasonText: { color: shell.white, fontWeight: '600' },
  close: { alignSelf: 'flex-end', padding: 8 },
  policy: { marginTop: 12, paddingVertical: 10 },
  policyText: { color: shell.cyan, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
});
