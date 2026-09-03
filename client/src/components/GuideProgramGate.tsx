import { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { guideProgramAPI, type GuideProgramGrade, type GuideProgramStatus, type PendingClientEval } from '../api/guideProgram';
import { DEFAULT_IMPROVEMENT_CATEGORIES, COUPLE_GUIDE_CATEGORY_IDS } from '../constants/improvementCategories';
import './SchoolNotification.css';
import './GuideProgramGate.css';

const MAX_AREAS = 5;
const GRADES: GuideProgramGrade[] = ['A', 'B', 'C', 'D', 'F'];

export default function GuideProgramGate() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<GuideProgramStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickingGuide, setPickingGuide] = useState(false);
  const [pendingEvals, setPendingEvals] = useState<PendingClientEval[]>([]);
  const [progressed, setProgressed] = useState<boolean | null>(null);
  const [grade, setGrade] = useState<GuideProgramGrade | ''>('');
  const [evalSaving, setEvalSaving] = useState(false);
  const [coupleSelected, setCoupleSelected] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!user?.id || !user?.profileSetupComplete) return;
    try {
      const next = await guideProgramAPI.getStatus();
      setStatus(next);
      if (next.categoryIds?.length && next.needsOnboarding === false) {
        setSelected(next.categoryIds.slice(0, MAX_AREAS));
      }
      if (next.canUseApp) setPickingGuide(false);
      if (next.isGuide) {
        const evals = await guideProgramAPI.getPendingEvals();
        setPendingEvals(evals.pending || []);
      } else {
        setPendingEvals([]);
      }
    } catch {
      setStatus(null);
    }
  }, [user?.id, user?.profileSetupComplete]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const onUpdated = () => {
      void refresh();
    };
    window.addEventListener('guide-program:updated', onUpdated);
    return () => window.removeEventListener('guide-program:updated', onUpdated);
  }, [refresh]);

  if (!user?.id || !user?.profileSetupComplete || !status) return null;

  const evalClient = pendingEvals[0];
  if (status.isGuide && evalClient) {
    const submitEval = async () => {
      if (progressed === null || !grade) {
        setError('Say whether they progressed, then pick a grade.');
        return;
      }
      setEvalSaving(true);
      setError('');
      try {
        await guideProgramAPI.evaluateClient(evalClient.userId, progressed, grade);
        setProgressed(null);
        setGrade('');
        await refresh();
        window.dispatchEvent(new Event('guide-program:updated'));
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(msg || 'Could not save the grade.');
      } finally {
        setEvalSaving(false);
      }
    };

    return (
      <div className="school-overlay guide-program-overlay" role="dialog" aria-modal="true">
        <div className="school-card school-setup-card">
          <p className="school-badge">Guide evaluation — 2 months</p>
          <h2>Has {evalClient.userName} progressed?</h2>
          <p className="school-sub">
            Their program is over. Grade whether they improved, then they can keep using the app.
          </p>
          {error && <div className="school-error">{error}</div>}
          <div className="guide-program-eval-row">
            <button
              type="button"
              className={`school-btn-secondary${progressed === true ? ' guide-program-selected' : ''}`}
              onClick={() => setProgressed(true)}
            >
              Yes, they progressed
            </button>
            <button
              type="button"
              className={`school-btn-secondary${progressed === false ? ' guide-program-selected' : ''}`}
              onClick={() => setProgressed(false)}
            >
              No, not yet
            </button>
          </div>
          <p className="school-progress">Grade</p>
          <div className="guide-program-grades">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className={`guide-program-grade${grade === g ? ' is-on' : ''}`}
                onClick={() => setGrade(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="school-actions">
            <button type="button" className="school-btn-primary" onClick={() => void submitEval()} disabled={evalSaving}>
              {evalSaving ? 'Saving…' : 'Submit grade'}
            </button>
            <button type="button" className="school-btn-ghost" onClick={() => logout()}>
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status.canUseApp && !status.needsCoupleGuide) return null;

  const coupleCats = DEFAULT_IMPROVEMENT_CATEGORIES.filter((c) => COUPLE_GUIDE_CATEGORY_IDS.includes(c.id));
  const toggleCouple = (id: string) => {
    setCoupleSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_AREAS) return prev;
      return [...prev, id];
    });
  };

  const saveCouple = async () => {
    if (coupleSelected.length < 1) {
      setError('Pick 1 to 5 couple problem areas.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await guideProgramAPI.saveCoupleAreas(coupleSelected);
      setStatus(next);
      const categoryId = coupleSelected[0] || 'couples-relationship';
      setPickingGuide(true);
      navigate('/home');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('guide-program:lock-guides', { detail: { categoryId } }));
      }, 250);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (status.canUseApp && status.needsCoupleGuide) {
    const onHome = location.pathname === '/home' || location.pathname === '/dashboard';
    if (pickingGuide && onHome) {
      return (
        <div className="guide-program-banner" role="status">
          Send a couple-guide request so you and your partner have help with relationship problems.
        </div>
      );
    }
    return (
      <div className="school-overlay guide-program-overlay" role="dialog" aria-modal="true">
        <div className="school-card school-setup-card">
          <p className="school-badge">Couples get a guide too</p>
          <h2>Where do you have problems as a couple?</h2>
          <p className="school-sub">
            You are in a relationship, so you also get a guide for relationship problems. Pick 1 to 5 areas. If you are good at helping couples, you can apply as a guide in Compatibility.
          </p>
          {error && <div className="school-error">{error}</div>}
          <p className="school-progress">{coupleSelected.length} of {MAX_AREAS} selected</p>
          <div className="guide-program-chips">
            {coupleCats.map((cat) => {
              const on = coupleSelected.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`guide-program-chip${on ? ' is-on' : ''}`}
                  disabled={!on && coupleSelected.length >= MAX_AREAS}
                  onClick={() => toggleCouple(cat.id)}
                >
                  <span aria-hidden>{cat.icon}</span> {cat.name}
                </button>
              );
            })}
          </div>
          <div className="school-actions">
            <button type="button" className="school-btn-primary" onClick={() => void saveCouple()} disabled={saving || coupleSelected.length < 1}>
              {saving ? 'Saving…' : 'Continue'}
            </button>
            <button
              type="button"
              className="school-btn-secondary"
              onClick={() => {
                const categoryId = coupleSelected[0] || 'couples-relationship';
                setPickingGuide(true);
                navigate('/home');
                window.setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('guide-program:lock-guides', { detail: { categoryId } }));
                }, 250);
              }}
            >
              Choose a couple guide
            </button>
            <button type="button" className="school-btn-ghost" onClick={() => logout()}>
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status.canUseApp) return null;

  const onHome = location.pathname === '/home' || location.pathname === '/dashboard';
  const showPickBanner = status.needsGuidePick && pickingGuide && onHome;

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_AREAS) return prev;
      return [...prev, id];
    });
  };

  const saveAreas = async () => {
    if (selected.length < 1 || selected.length > MAX_AREAS) {
      setError('Pick between 1 and 5 areas.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await guideProgramAPI.saveAreas(selected);
      setStatus(next);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const openGuides = () => {
    const categoryId = selected[0] || status.categoryIds[0] || DEFAULT_IMPROVEMENT_CATEGORIES[0].id;
    setPickingGuide(true);
    navigate('/home');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('guide-program:lock-guides', { detail: { categoryId } }));
    }, 250);
  };

  if (showPickBanner) {
    return (
      <div className="guide-program-banner" role="status">
        Send a guide request for one of your problem areas to unlock the rest of the app.
      </div>
    );
  }

  return (
    <div className="school-overlay guide-program-overlay" role="dialog" aria-modal="true">
      <div className="school-card school-setup-card">
        {status.waitingOnEval ? (
          <>
            <p className="school-badge">2-month evaluation</p>
            <h2>Waiting on your guide</h2>
            <p className="school-sub">{status.message}</p>
            <p className="school-sub">
              The app is asking your guide whether you progressed. After they give you a grade, you can continue.
            </p>
            <div className="school-actions">
              <button type="button" className="school-btn-ghost" onClick={() => logout()}>
                Log out
              </button>
            </div>
          </>
        ) : status.needsOnboarding ? (
          <>
            <p className="school-badge">Required — pick a guide</p>
            <h2>Where do you have problems the most?</h2>
            <p className="school-sub">
              Choose 1 to 5 areas. A guide is mandatory — there is no skip quiz. After you pick a guide you can use the rest of the app. In 2 months your guide will grade your progress.
            </p>
            {error && <div className="school-error">{error}</div>}
            <p className="school-progress">
              {selected.length} of {MAX_AREAS} selected
            </p>
            <div className="guide-program-chips">
              <p className="school-progress" style={{ width: '100%' }}>Couples &amp; relationship</p>
              {DEFAULT_IMPROVEMENT_CATEGORIES.filter((c) => COUPLE_GUIDE_CATEGORY_IDS.includes(c.id)).map((cat) => {
                const on = selected.includes(cat.id);
                const blocked = !on && selected.length >= MAX_AREAS;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`guide-program-chip${on ? ' is-on' : ''}`}
                    disabled={blocked}
                    onClick={() => toggle(cat.id)}
                  >
                    <span aria-hidden>{cat.icon}</span> {cat.name}
                  </button>
                );
              })}
              <p className="school-progress" style={{ width: '100%' }}>Dating &amp; other areas</p>
              {DEFAULT_IMPROVEMENT_CATEGORIES.filter((c) => !COUPLE_GUIDE_CATEGORY_IDS.includes(c.id)).map((cat) => {
                const on = selected.includes(cat.id);
                const blocked = !on && selected.length >= MAX_AREAS;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`guide-program-chip${on ? ' is-on' : ''}`}
                    disabled={blocked}
                    onClick={() => toggle(cat.id)}
                  >
                    <span aria-hidden>{cat.icon}</span> {cat.name}
                  </button>
                );
              })}
            </div>
            <div className="school-actions">
              <button
                type="button"
                className="school-btn-primary"
                onClick={() => void saveAreas()}
                disabled={saving || selected.length < 1}
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
              <button type="button" className="school-btn-ghost" onClick={() => logout()}>
                Log out
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="school-badge">Required — choose your guide</p>
            <h2>Now pick a guide</h2>
            <p className="school-sub">{status.message}</p>
            <p className="school-sub">
              You can request one guide or work across the areas you selected. After you send a request, you can keep using the app. Two months after they accept, they will grade you.
            </p>
            {error && <div className="school-error">{error}</div>}
            <div className="school-actions">
              <button type="button" className="school-btn-primary" onClick={openGuides}>
                Choose a guide
              </button>
              <button type="button" className="school-btn-ghost" onClick={() => logout()}>
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
