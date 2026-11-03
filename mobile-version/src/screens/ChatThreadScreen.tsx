import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { chatAPI, type Message } from '../api/chat';
import { formatAxiosError } from '../lib/apiError';
import type { AppStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { Card, ErrorText, Field, Muted, PrimaryButton, Screen } from '../ui/components';
import { colors } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'ChatThread'>;

export function ChatThreadScreen({ route }: Props) {
  const { otherUserId, name } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await chatAPI.getConversation(otherUserId, user.id);
      setMessages(result.messages || []);
      await chatAPI.markAsRead(otherUserId, user.id).catch(() => undefined);
      setError('');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load this conversation.'));
    }
  }, [otherUserId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 4000);
      return () => clearInterval(timer);
    }, [load])
  );

  const send = async () => {
    if (!user?.id) return;
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      await chatAPI.sendMessage(otherUserId, content, user.id);
      setDraft('');
      await load();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send that message.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>{name}</Text>
      <ErrorText>{error}</ErrorText>
      {messages.length === 0 ? <Muted>Say hello.</Muted> : null}
      {messages.map((message) => {
        const mine = message.fromUserId === user?.id;
        return (
          <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
            <Text style={styles.body}>{message.content}</Text>
          </View>
        );
      })}
      <Card>
        <Field label="Message" value={draft} onChangeText={setDraft} placeholder="Write a message" />
        <PrimaryButton label="Send" onPress={() => void send()} loading={sending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  bubble: { borderRadius: 14, padding: 12, maxWidth: '90%' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accentDeep },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card },
  body: { color: colors.text, fontSize: 15 },
});
