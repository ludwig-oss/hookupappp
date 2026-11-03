import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authAPI } from '../api/auth';
import { formatAxiosError } from '../lib/apiError';
import type { AuthStackParamList } from '../navigation/types';
import { Card, ErrorText, Field, Muted, PrimaryButton, Screen, Title } from '../ui/components';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setMessage('');
    setHints([]);
    if (!username.trim() && !email.trim()) {
      setError('Enter the username or email on the account.');
      return;
    }
    setLoading(true);
    try {
      const result = await authAPI.forgotPassword(username.trim() || undefined, undefined, email.trim() || undefined);
      setMessage(result.message);
      setHints([result.hint1, result.hint2, result.hint3].filter((h): h is string => Boolean(h)));
    } catch (err) {
      setError(formatAxiosError(err, 'Could not start password recovery.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="We ask the same recovery endpoint the website uses.">Reset password</Title>
      <Field label="Username" value={username} onChangeText={setUsername} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <ErrorText>{error}</ErrorText>
      {message ? (
        <Card>
          <Muted>{message}</Muted>
          {hints.map((hint) => (
            <Muted key={hint}>{hint}</Muted>
          ))}
        </Card>
      ) : null}
      <PrimaryButton label="Send recovery" onPress={() => void submit()} loading={loading} />
      <PrimaryButton label="Back to sign in" tone="ghost" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}
