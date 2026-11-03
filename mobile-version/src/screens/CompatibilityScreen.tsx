import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { compatibilityAPI, type CompatibilityQuestion, type CompatibilityResult } from '../api/compatibility';
import { formatAxiosError } from '../lib/apiError';
import { Card, ErrorText, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export function CompatibilityScreen() {
  const [questions, setQuestions] = useState<CompatibilityQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ questionId: string; answer: string | number }>>([]);
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const existing = await compatibilityAPI.getResult().catch(() => null);
      if (existing?.result?.completedAt) {
        setResult(existing.result);
        return;
      }
      const quiz = await compatibilityAPI.getQuestions();
      setQuestions(quiz.questions || []);
      setIndex(0);
      setAnswers([]);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load the compatibility quiz.'));
    } finally {
      setLoading(false);
    }
  };

  const choose = async (answer: string | number) => {
    const question = questions[index];
    if (!question) return;
    const next = [...answers.filter((item) => item.questionId !== question.id), { questionId: question.id, answer }];
    setAnswers(next);
    if (index < questions.length - 1) {
      setIndex(index + 1);
      return;
    }
    setLoading(true);
    try {
      const submitted = await compatibilityAPI.submitQuiz(next);
      setResult(submitted.result);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not submit the quiz.'));
    } finally {
      setLoading(false);
    }
  };

  const question = questions[index];

  return (
    <Screen>
      <Title subtitle="Personality quiz on /api/compatibility.">Compatibility</Title>
      <PrimaryButton label={result ? 'Reload result' : 'Start quiz'} onPress={() => void start()} loading={loading} />
      <ErrorText>{error}</ErrorText>
      {result ? (
        <Card>
          <Text style={styles.prompt}>{result.personalityType || 'Your scores'}</Text>
          {Object.entries(result.scores || {}).map(([key, value]) => (
            <Muted key={key}>{`${key}: ${value}`}</Muted>
          ))}
        </Card>
      ) : null}
      {question && !result ? (
        <Card>
          <Muted>{`${index + 1} of ${questions.length} · ${question.category}`}</Muted>
          <Text style={styles.prompt}>{question.question}</Text>
          <View style={styles.wrap}>
            {(question.options || (question.type === 'yes_no' ? ['yes', 'no'] : ['1', '2', '3', '4', '5'])).map((option) => (
              <Pressable key={String(option)} onPress={() => void choose(question.type === 'scale' ? Number(option) : option)} style={styles.chip}>
                <Text style={styles.chipText}>{String(option)}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prompt: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 24 },
  wrap: { gap: 8 },
  chip: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, backgroundColor: colors.bgRaised },
  chipText: { color: colors.text, textTransform: 'capitalize' },
});
