import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { chatAPI, type Conversation } from '../api/chat';
import { formatAxiosError } from '../lib/apiError';
import type { AppStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { Card, ErrorText, Muted, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export function ChatListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await chatAPI.getConversations(user.id);
      setConversations(result.conversations || []);
      setError('');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load conversations.'));
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <Screen>
      <Title subtitle="Messages from /api/chat.">Chat</Title>
      <ErrorText>{error}</ErrorText>
      {conversations.length === 0 ? <Muted>No conversations yet. A buzz or a date match can open one.</Muted> : null}
      {conversations.map((conversation) => (
        <Pressable
          key={conversation.userId}
          onPress={() => navigation.navigate('ChatThread', { otherUserId: conversation.userId, name: conversation.name })}
        >
          <Card>
            <Text style={styles.name}>{conversation.name}</Text>
            <Muted>{conversation.lastMessage?.content || 'No messages yet'}</Muted>
            {conversation.unreadCount > 0 ? <Text style={styles.unread}>{conversation.unreadCount} unread</Text> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  unread: { color: colors.pink, fontWeight: '700' },
});
