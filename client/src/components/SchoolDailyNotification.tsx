import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { schoolAPI, TodayLesson } from '../api/school';
import SchoolScheduleModal from './SchoolScheduleModal';
import FinanceLessonModal from './FinanceLessonModal';
import './SchoolNotification.css';

const SETUP_SNOOZE_MS = 2 * 60 * 60 * 1000; // 2 hours after "Not now"

type Props = {
  onOpenGuides: (categoryId: string) => void;
};

function setupSnoozeKey(userId: string) {
  return `school-setup-snooze-${userId}`;
}

function isSetupSnoozed(userId: string): boolean {
  try {
    const until = Number(localStorage.getItem(setupSnoozeKey(userId)) || 0);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function snoozeSetup(userId: string) {
  try {
    localStorage.setItem(setupSnoozeKey(userId), String(Date.now() + SETUP_SNOOZE_MS));
  } catch {
    /* ignore */
  }
}

export default function SchoolDailyNotification({ onOpenGuides }: Props) {
  const { user } = useContext(AuthContext);
  const setupStorageKey = user?.id ? `school-setup-${user.id}` : null;
  const [lesson, setLesson] = useState<TodayLesson | null>(null);
  const [visible, setVisible] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showFinanceLesson, setShowFinanceLesson] = useState(false);
  const [setupSavedLocally, setSetupSavedLocally] = useState(
    () => setupStorageKey != null && localStorage.getItem(setupStorageKey) === '1',
  );
  const [loading, setLoading] = useState(false);
  const [optInLoading, setOptInLoading] = useState(false);
  const [toast, setToast] = useState('');

  const markSetupSaved = useCallback(() => {
    if (setupStorageKey) localStorage.setItem(setupStorageKey, '1');
    setSetupSavedLocally(true);
    setShowSetup(false);
  }, [setupStorageKey]);

  const dismissSetupForNow = useCallback(() => {
    if (user?.id) snoozeSetup(user.id);
    setShowSetup(false);
  }, [user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await schoolAPI.getToday();
      setLesson(data);
      if (data.setupComplete) {
        markSetupSaved();
      } else if (!setupSavedLocally && !isSetupSnoozed(user.id)) {
        setShowSetup(true);
        setVisible(false);
        return;
      }
      setShowSetup(false);
      const financeOpen = Boolean(data.finance?.required && !data.finance.alreadyCompletedToday);
      const schoolOpen = !data.alreadyCompletedToday;
      const shouldShow = (schoolOpen || financeOpen) && (data.showNotification || data.showOnLogin);
      setVisible(shouldShow);
    } catch {
      /* API offline — keep local setup flag so we do not nag again this session */
      if (setupSavedLocally) setShowSetup(false);
    }
  }, [user?.id, setupSavedLocally, markSetupSaved]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const dismiss = async () => {
    try {
      const res = await schoolAPI.dismiss();
      if (res?.message) setToast(res.message);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const exception = async (reason: 'work' | 'busy' | 'emergency') => {
    try {
      const res = await schoolAPI.exception(reason);
      if (res?.message) setToast(res.message);
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
      await refresh();
    } catch {
      setToast('Could not mark complete — try again');
    } finally {
      setLoading(false);
    }
  };

  const toggleFinanceOptIn = async (optIn: boolean) => {
    setOptInLoading(true);
    try {
      const res = await schoolAPI.setFinanceOptIn(optIn);
      setLesson((prev) => (prev ? { ...prev, finance: res.finance } : prev));
      setToast(optIn ? 'Money lessons on — ~10 min a day when you want them.' : 'Money lessons turned off.');
      await refresh();
    } catch {
      setToast('Could not update money-lesson preference');
    } finally {
      setOptInLoading(false);
    }
  };

  if (showSetup) {
    return (
      <SchoolScheduleModal
        onDone={() => {
          markSetupSaved();
          refresh();
        }}
        onDismiss={dismissSetupForNow}
      />
    );
  }

  if (showFinanceLesson && lesson?.finance?.lesson) {
    return (
      <FinanceLessonModal
        lesson={lesson.finance.lesson}
        onClose={() => setShowFinanceLesson(false)}
        onPassed={() => {
          setToast('Money lesson complete for today.');
          void refresh();
        }}
      />
    );
  }

  if (!lesson || !visible) return null;

  const topic = lesson.currentTopic;
  const finance = lesson.finance;
  const financeDue = Boolean(finance?.required && !finance.alreadyCompletedToday);
  const schoolDue = !lesson.alreadyCompletedToday;

  return (
    <div className="school-overlay" role="dialog" aria-modal="true">
      <div className="school-card">
        <div className="school-gym-pulse">{topic.icon}</div>
        <p className="school-badge">Today&apos;s class · Day {lesson.dayNumber}</p>
        <h2>
          {!schoolDue && financeDue
            ? 'Money lesson still open'
            : lesson.alreadyCompletedToday
              ? 'Rest day — you crushed it'
              : `Hey! Time to work on ${topic.title}`}
        </h2>
        {schoolDue && (
          <>
            <p className="school-sub">{topic.description}</p>
            <p className="school-workout">
              <strong>Today&apos;s workout:</strong> {topic.dailyWorkout}
            </p>
          </>
        )}
        {lesson.compliance?.enabled && lesson.compliance.policyText && (schoolDue || financeDue) && (
          <p className="school-alt" style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}>
            <strong>Men&apos;s rule:</strong> {lesson.compliance.policyText}
          </p>
        )}

        {finance && (
          <div className="school-alt" style={{ marginTop: 12, textAlign: 'left' }}>
            <p style={{ margin: '0 0 6px' }}>
              <strong>Financial literacy</strong>
              {finance.required ? ' · required today' : finance.optIn ? ' · opted in' : ' · optional'}
            </p>
            {finance.policyText && <p className="school-sub" style={{ margin: '0 0 8px' }}>{finance.policyText}</p>}
            {finance.alreadyCompletedToday ? (
              <p className="school-sub" style={{ margin: 0 }}>
                Done for today: {finance.lesson.title}
              </p>
            ) : finance.required ? (
              <>
                <p style={{ margin: '0 0 8px' }}>
                  Day {finance.dayNumber}/{finance.totalLessons}: <strong>{finance.lesson.title}</strong> (~
                  {finance.lesson.minutes} min)
                </p>
                <p className="school-sub" style={{ margin: '0 0 8px' }}>{finance.lesson.summary}</p>
                <button type="button" className="school-btn-primary" onClick={() => setShowFinanceLesson(true)}>
                  Start money lesson + quiz
                </button>
              </>
            ) : finance.optionalAvailable ? (
              <button
                type="button"
                className="school-btn-secondary"
                disabled={optInLoading}
                onClick={() => void toggleFinanceOptIn(true)}
              >
                {optInLoading ? '…' : 'Opt in to daily money lessons'}
              </button>
            ) : null}
            {finance.optionalAvailable && finance.optIn && !finance.alreadyCompletedToday && (
              <button
                type="button"
                className="school-btn-ghost"
                style={{ marginTop: 8 }}
                disabled={optInLoading}
                onClick={() => void toggleFinanceOptIn(false)}
              >
                Turn off money lessons
              </button>
            )}
          </div>
        )}

        <p className="school-progress">
          Class {lesson.completedCount + 1} of {lesson.totalClasses} · {lesson.progressPercent}% complete
        </p>
        <div className="school-progress-bar">
          <div className="school-progress-fill" style={{ width: `${lesson.progressPercent}%` }} />
        </div>
        {lesson.alternateSuggestion && schoolDue && (
          <p className="school-alt">
            You might also need: <strong>{lesson.alternateSuggestion.title}</strong> — we can suggest that after this class.
          </p>
        )}
        {toast && <div className="school-success">{toast}</div>}
        <div className="school-actions">
          {schoolDue && (
            <>
              <button
                type="button"
                className="school-btn-primary"
                onClick={() => {
                  onOpenGuides(topic.guideCategoryId);
                  void dismiss();
                }}
              >
                Go to guides → {topic.title}
              </button>
              <button type="button" className="school-btn-secondary" onClick={() => void complete()} disabled={loading}>
                {loading ? '…' : "I did today's lesson ✓"}
              </button>
            </>
          )}
          {!schoolDue && !financeDue && (
            <button
              type="button"
              className="school-btn-secondary"
              onClick={() => onOpenGuides('financial-literacy')}
            >
              Open finance guides
            </button>
          )}
          <button type="button" className="school-btn-ghost" onClick={() => void dismiss()}>
            {!schoolDue && !financeDue ? 'Close' : 'Remind me later'}
          </button>
          {(schoolDue || financeDue) && lesson.compliance?.enabled && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="school-btn-ghost" onClick={() => void exception('work')}>
                Work busy (exception)
              </button>
              <button type="button" className="school-btn-ghost" onClick={() => void exception('emergency')}>
                Emergency (exception)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
