import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { schoolAPI, TodayLesson } from '../api/school';
import SchoolScheduleModal from './SchoolScheduleModal';
import SchoolQuizModal from './SchoolQuizModal';
import './SchoolNotification.css';

type Props = {
  onOpenGuides: (categoryId: string) => void;
};

export default function SchoolDailyNotification({ onOpenGuides }: Props) {
  const { user } = useContext(AuthContext);
  const [lesson, setLesson] = useState<TodayLesson | null>(null);
  const [visible, setVisible] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await schoolAPI.getToday();
      setLesson(data);
      if (!data.setupComplete) {
        setShowSetup(true);
        setVisible(false);
        return;
      }
      setShowSetup(false);
      const shouldShow = !data.alreadyCompletedToday && (data.showNotification || data.showOnLogin);
      setVisible(shouldShow);
    } catch {
      /* API offline */
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const dismiss = async () => {
    try {
      await schoolAPI.dismiss();
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const complete = async () => {
    setLoading(true);
    try {
      const res = await schoolAPI.completeToday();
      setToast(res.message || 'Class complete!');
      setVisible(false);
      await refresh();
    } catch {
      setToast('Could not mark complete — try again');
    } finally {
      setLoading(false);
    }
  };

  if (showSetup) {
    return <SchoolScheduleModal onDone={() => { setShowSetup(false); refresh(); }} />;
  }

  if (!lesson || !visible) return null;

  const topic = lesson.currentTopic;

  if (showQuiz) {
    return (
      <SchoolQuizModal
        topic={topic}
        onClose={() => setShowQuiz(false)}
        onResult={(passed) => {
          setShowQuiz(false);
          if (passed) {
            setToast('You passed — next class unlocked!');
            setVisible(false);
            refresh();
          } else {
            setToast('Keep practicing with a guide today.');
          }
        }}
      />
    );
  }

  return (
    <div className="school-overlay" role="dialog" aria-modal="true">
      <div className="school-card">
        <div className="school-gym-pulse">{topic.icon}</div>
        <p className="school-badge">Today&apos;s class · Day {lesson.dayNumber}</p>
        <h2>
          {lesson.alreadyCompletedToday
            ? 'Rest day — you crushed it'
            : `Hey! Time to work on ${topic.title}`}
        </h2>
        <p className="school-sub">
          {lesson.alreadyCompletedToday
            ? 'Come back tomorrow for the next topic. Other features are still open.'
            : topic.description}
        </p>
        {!lesson.alreadyCompletedToday && (
          <p className="school-workout">
            <strong>Today&apos;s workout:</strong> {topic.dailyWorkout}
          </p>
        )}
        <p className="school-progress">
          Class {lesson.completedCount + 1} of {lesson.totalClasses} · {lesson.progressPercent}% complete
        </p>
        <div className="school-progress-bar">
          <div className="school-progress-fill" style={{ width: `${lesson.progressPercent}%` }} />
        </div>
        {lesson.alternateSuggestion && !lesson.alreadyCompletedToday && (
          <p className="school-alt">
            You might also need: <strong>{lesson.alternateSuggestion.title}</strong> — we can suggest that after this class.
          </p>
        )}
        {toast && <div className="school-success">{toast}</div>}
        <div className="school-actions">
          {!lesson.alreadyCompletedToday && (
            <>
              <button
                type="button"
                className="school-btn-primary"
                onClick={() => {
                  onOpenGuides(topic.guideCategoryId);
                  dismiss();
                }}
              >
                Go to guides → {topic.title}
              </button>
              <button type="button" className="school-btn-secondary" onClick={complete} disabled={loading}>
                {loading ? '…' : 'I did today’s lesson ✓'}
              </button>
              <button type="button" className="school-btn-secondary" onClick={() => setShowQuiz(true)}>
                I&apos;m already good — take skip quiz
              </button>
            </>
          )}
          <button type="button" className="school-btn-ghost" onClick={dismiss}>
            {lesson.alreadyCompletedToday ? 'Close' : 'Remind me later'}
          </button>
        </div>
      </div>
    </div>
  );
}
