import { useState } from 'react';
import { schoolAPI, type FinanceLessonClient } from '../api/school';
import { formatAxiosError } from '../lib/apiError';
import './SchoolNotification.css';

type Props = {
  lesson: FinanceLessonClient;
  onClose: () => void;
  onPassed: () => void;
};

export default function FinanceLessonModal({ lesson, onClose, onPassed }: Props) {
  const [step, setStep] = useState<'teach' | 'quiz'>('teach');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [passed, setPassed] = useState(false);

  const submit = async () => {
    const missing = lesson.quiz.some((q) => answers[q.id] === undefined);
    if (missing) {
      setError('Answer all questions');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await schoolAPI.submitFinanceQuiz(lesson.id, answers);
      setResultMsg(res.message);
      if (res.pass) {
        setPassed(true);
        onPassed();
      }
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Quiz failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="school-overlay" role="dialog" aria-modal="true">
      <div className="school-card school-quiz-card">
        <p className="school-badge">
          Money lesson · ~{lesson.minutes} min · Day {lesson.day}
          {lesson.guideName ? ` · ${lesson.guideName}` : ''}
        </p>
        <h2>{lesson.title}</h2>
        <p className="school-sub">{lesson.summary}</p>

        {step === 'teach' && (
          <>
            <ol className="school-alt" style={{ textAlign: 'left', margin: '12px 0', paddingLeft: 20 }}>
              {lesson.teach.map((line) => (
                <li key={line} style={{ marginBottom: 8 }}>
                  {line}
                </li>
              ))}
            </ol>
            <p className="school-workout">
              <strong>Today&apos;s action:</strong> {lesson.workout}
            </p>
            <div className="school-actions">
              <button type="button" className="school-btn-ghost" onClick={onClose}>
                Later
              </button>
              <button type="button" className="school-btn-primary" onClick={() => setStep('quiz')}>
                Check what I learned →
              </button>
            </div>
          </>
        )}

        {step === 'quiz' && (
          <>
            <p className="school-sub">Pass with at least 2 of 3 correct to lock today&apos;s money lesson.</p>
            {error && <div className="school-error">{error}</div>}
            {resultMsg && <div className={passed ? 'school-success' : 'school-error'}>{resultMsg}</div>}
            {lesson.quiz.map((q) => (
              <fieldset key={q.id} className="school-quiz-q">
                <legend>{q.question}</legend>
                {q.options.map((opt, i) => (
                  <label key={i} className="school-quiz-opt">
                    <input
                      type="radio"
                      name={`finance-${q.id}`}
                      checked={answers[q.id] === i}
                      disabled={passed}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                    />
                    {opt}
                  </label>
                ))}
              </fieldset>
            ))}
            <div className="school-actions">
              <button
                type="button"
                className="school-btn-secondary"
                onClick={() => {
                  setStep('teach');
                  setError('');
                  setResultMsg('');
                }}
                disabled={loading || passed}
              >
                Re-read lesson
              </button>
              {passed ? (
                <button type="button" className="school-btn-primary" onClick={onClose}>
                  Done
                </button>
              ) : (
                <button type="button" className="school-btn-primary" onClick={() => void submit()} disabled={loading}>
                  {loading ? 'Checking…' : 'Submit answers'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
