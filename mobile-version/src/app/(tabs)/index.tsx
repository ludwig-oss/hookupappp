import { useAuth } from '../../state/AuthContext';
import { Card, Muted, Screen, Title } from '../../ui/components';

export default function HomeScreen() {
  const { user } = useAuth();
  const name = user?.name || user?.email || 'there';

  return (
    <Screen>
      <Title subtitle="Signed in with Google">Home</Title>
      <Card>
        <Muted>Welcome, {name}.</Muted>
      </Card>
    </Screen>
  );
}
