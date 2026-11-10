import { useCallback, useEffect, useState } from 'react';
import { scoutAPI, type ScoutState } from '../../../api/scout';
import { formatAxiosError } from '../../../lib/apiError';
import { ScoutBoard } from './ScoutBoard';
import { ScoutOnboarding } from './ScoutOnboarding';
import { ScoutPartnership } from './ScoutPartnership';
import './ScoutWidget.css';

export default function ScoutWidget({ onOpenChat }: { onOpenChat: (userId: string) => void }) {
  const [state, setState] = useState<ScoutState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    scoutAPI.state().then(setState).catch((err) => setError(formatAxiosError(err, 'Could not open Scout.')));
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (task: () => Promise<ScoutState>) => {
    setBusy(true);
    setError('');
    try {
      setState(await task());
    } catch (err) {
      setError(formatAxiosError(err, 'That action failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <section className="scout"><p className="scout-lead">{error || 'Loading Scout…'}</p></section>;

  return (
    <section className="scout">
      <h3>SCOUT</h3>
      <p className="scout-lead">Profession first. Then a cycle sized by experience and cut by judgment.</p>
      {error ? <p className="scout-error">{error}</p> : null}
      {!state.onboarded ? <ScoutOnboarding onSaved={load} /> : (
        <>
          <ScoutBoard
            state={state}
            busy={busy}
            onCycle={(professionId) => void run(() => scoutAPI.cycle(professionId))}
            onInterest={(userId, mode) => void run(() => scoutAPI.interest(userId, mode))}
          />
          {state.incoming.length ? (
            <section className="scout-panel">
              <h3>INCOMING</h3>
              {state.incoming.map((item) => (
                <article key={item.id} className="scout-card">
                  <strong>{item.from.name}</strong>
                  <span className="scout-meta"> · {item.from.professionLabel} · {item.mode === 'building' ? 'Building' : 'Just Talk'}</span>
                  <div className="scout-actions">
                    <button type="button" disabled={busy} onClick={() => void run(() => scoutAPI.accept(item.id))}>Accept</button>
                    <button type="button" className="scout-ghost" disabled={busy} onClick={() => void run(() => scoutAPI.reject(item.id))}>Decline</button>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
          {state.partnerships.map((item) => (
            <ScoutPartnership
              key={item.id}
              item={item}
              busy={busy}
              onOpenChat={() => onOpenChat(item.partner.id)}
              onSign={() => void run(() => scoutAPI.sign(item.id))}
              onJoin={() => void run(() => scoutAPI.joinLive(item.id))}
              onBlue={() => void run(() => scoutAPI.confirmBlue(item.id))}
              onAvailability={(start, end, label) => void run(() => scoutAPI.availability(item.id, { start, end, label }))}
              onExpense={(title, amount) => void run(() => scoutAPI.expense(item.id, { title, amount }))}
              onHouse={(label, price, down, monthly, iterations) => void run(() => scoutAPI.house(item.id, { label, price, down, monthly, iterations }))}
              onGoal={(label) => void run(() => scoutAPI.goal(item.id, label))}
              onMediate={(text) => void run(() => scoutAPI.mediate(item.id, text))}
              onTerminate={(reason) => void run(() => scoutAPI.terminate(item.id, reason))}
            />
          ))}
        </>
      )}
    </section>
  );
}
