import { useState } from 'react';
import { schoolAPI, SchoolTopic } from '../api/school';
import { formatAxiosError } from '../lib/apiError';
import './SchoolNotification.css';

type Props = {
  topic: SchoolTopic;
  onClose: () => void;
  onResult: (passed: boolean) => void;
};

export default function SchoolQuizModal({ topic, onClose, onResult }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultMsg, setResultMsg] = useState('');

  const submit = async () => {
    const missing = topic.quiz.some((q) => answers[q.id] === undefined);
    if (missing) {
      setError('Answer all questions');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await schoolAPI.submitQuiz(topic.id, answers);
      setResultMsg(res.message);
      onResult(res.pass);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Quiz failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="school-overlay" role="dialog" aria-modal="true">
      <div className="school-card school-quiz-card">
        <p className="school-badge">Skip quiz — {topic.title}</p>
        <p className="school-sub">Think you&apos;re already good? Pass to skip to the next class.</p>
        {error && <div className="school-error">{error}</div>}
        {resultMsg && <div className="school-success">{resultMsg}</div>}
        {topic.quiz.map((q) => (
          <fieldset key={q.id} className="school-quiz-q">
            <legend>{q.question}</legend>
            {q.options.map((opt, i) => (
              <label key={i} className="school-quiz-opt">
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === i}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                />
                {opt}
              </label>
            ))}
          </fieldset>
        ))}
        <div className="school-actions">
          <button type="button" className="school-btn-secondary" onClick={onClose} disabled={loading}>
            Back
          </button>
          <button type="button" className="school-btn-primary" onClick={submit} disabled={loading || !!resultMsg}>
            {loading ? 'Checking…' : 'Submit quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
