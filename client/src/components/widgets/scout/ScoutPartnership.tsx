import { useState } from 'react';
import type { PartnershipView } from '../../../api/scout';

function euros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function ScoutPartnership({
  item,
  busy,
  onSign,
  onJoin,
  onBlue,
  onAvailability,
  onExpense,
  onHouse,
  onGoal,
  onMediate,
  onTerminate,
  onOpenChat,
}: {
  item: PartnershipView;
  busy: boolean;
  onSign: () => void;
  onJoin: () => void;
  onBlue: () => void;
  onAvailability: (start: string, end: string, label: string) => void;
  onExpense: (title: string, amount: number) => void;
  onHouse: (label: string, price: number, down: number, monthly: number, iterations: number) => void;
  onGoal: (label: string) => void;
  onMediate: (text: string) => void;
  onTerminate: (reason: string) => void;
  onOpenChat: () => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [slotLabel, setSlotLabel] = useState('Train');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [goal, setGoal] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [houseLabel, setHouseLabel] = useState(item.house?.label || 'Joint house');
  const [price, setPrice] = useState(item.house ? String(item.house.priceCents / 100) : '');
  const [down, setDown] = useState(item.house ? String(item.house.downCents / 100) : '');
  const [monthly, setMonthly] = useState(item.house ? String(item.house.monthlyCents / 100) : '');
  const [iterations, setIterations] = useState(item.house?.iterationsPaid || 0);

  return (
    <article className="scout-panel">
      <div className="scout-row">
        <h3>{item.mode === 'building' ? 'BUILDING' : 'JUST TALK'} · {item.partner.name}</h3>
        <button type="button" className="scout-ghost" onClick={onOpenChat}>Open chat</button>
      </div>
      <p className="scout-meta">{item.partner.professionLabel} · {item.status.replace(/_/g, ' ')}</p>
      {item.mode === 'talk' ? <p className="scout-lead">Accepted. They are in Communications → Friends, and chat is unlocked.</p> : null}
      {item.contractText && item.status !== 'ended' ? (
        <>
          <pre className="scout-contract">{item.contractText}</pre>
          <p className="scout-meta">{item.iSigned ? 'You signed.' : 'Your signature is open.'} {item.theySigned ? 'They signed.' : 'Waiting on them.'}</p>
          {!item.iSigned ? <button type="button" disabled={busy} onClick={onSign}>Sign pre-agreement</button> : null}
        </>
      ) : null}
      {item.speedDate && item.status !== 'ended' ? (
        <div className="scout-actions">
          <button type="button" disabled={busy || item.speedDate.iJoined} onClick={onJoin}>
            {item.speedDate.iJoined ? 'You joined Speed Date Live' : 'Join Speed Date Live'}
          </button>
          <button type="button" className="scout-blue" disabled={busy || !item.speedDate.live || item.speedDate.iConfirmed} onClick={onBlue}>
            {item.speedDate.iConfirmed ? 'Blue button sent' : 'Blue button — confirm match'}
          </button>
        </div>
      ) : null}
      {item.mode === 'building' && item.status !== 'awaiting_contract' && item.status !== 'ended' ? (
        <>
          <h4>Shared calendar</h4>
          <div className="scout-actions">
            <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
            <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
            <input value={slotLabel} onChange={(event) => setSlotLabel(event.target.value)} />
            <button type="button" disabled={busy} onClick={() => onAvailability(new Date(start).toISOString(), new Date(end).toISOString(), slotLabel)}>Add free block</button>
          </div>
          {item.slots.map((slot) => (
            <p key={slot.id} className="scout-meta">{slot.label}: {new Date(slot.start).toLocaleString()} – {new Date(slot.end).toLocaleString()}</p>
          ))}
          <h4>Luxury travel, 2–4 weeks out</h4>
          {item.events.map((event) => (
            <p key={event.id} className="scout-meta"><strong>{event.title}</strong> · {event.city} · {new Date(event.startsAt).toLocaleDateString()} — {event.why}</p>
          ))}
          <h4>AI buddy</h4>
          {item.tips.map((tip) => <p key={tip} className="scout-meta">{tip}</p>)}
          <div className="scout-actions">
            <input value={goal} placeholder="Goal, for example 2 training sessions" onChange={(event) => setGoal(event.target.value)} />
            <button type="button" disabled={busy} onClick={() => { onGoal(goal); setGoal(''); }}>Add goal</button>
          </div>
          {item.goals.map((entry) => <p key={entry.id} className="scout-meta">• {entry.label}</p>)}
        </>
      ) : null}
      {item.status === 'active' ? (
        <>
          <h4>Finance</h4>
          <p className="scout-meta">Tracked {euros(item.trackedCents)} · 50/50 share {euros(item.eachShareCents)} each</p>
          <div className="scout-actions">
            <input value={expenseTitle} placeholder="Expense" onChange={(event) => setExpenseTitle(event.target.value)} />
            <input value={expenseAmount} placeholder="Amount €" onChange={(event) => setExpenseAmount(event.target.value)} />
            <button type="button" disabled={busy} onClick={() => onExpense(expenseTitle, Number(expenseAmount))}>Add expense</button>
          </div>
          {item.expenses.map((entry) => <p key={entry.id} className="scout-meta">{entry.title} · {euros(entry.amountCents)}</p>)}
          <div className="scout-actions">
            <input value={houseLabel} onChange={(event) => setHouseLabel(event.target.value)} />
            <input value={price} placeholder="Price €" onChange={(event) => setPrice(event.target.value)} />
            <input value={down} placeholder="Down €" onChange={(event) => setDown(event.target.value)} />
            <input value={monthly} placeholder="Monthly €" onChange={(event) => setMonthly(event.target.value)} />
            <input type="number" min={0} value={iterations} onChange={(event) => setIterations(Number(event.target.value))} />
            <button type="button" disabled={busy} onClick={() => onHouse(houseLabel, Number(price), Number(down), Number(monthly), iterations)}>Save house plan</button>
          </div>
        </>
      ) : null}
      {item.mode === 'building' && item.status !== 'ended' ? (
        <>
          <h4>Mediation log</h4>
          {item.mediation.map((entry) => (
            <div key={entry.id} className="scout-log">
              <p>{entry.text}</p>
              <p className="scout-meta">{entry.reply}</p>
            </div>
          ))}
          <textarea value={note} placeholder="What went wrong?" onChange={(event) => setNote(event.target.value)} />
          <div className="scout-actions">
            <button type="button" disabled={busy} onClick={() => { onMediate(note); setNote(''); }}>Log it</button>
          </div>
          <label>
            Termination reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Unrepairable" />
          </label>
          <button type="button" className="scout-ghost" disabled={busy} onClick={() => onTerminate(reason || 'Unrepairable')}>End partnership 50/50</button>
        </>
      ) : null}
      {item.settlement ? (
        <p className="scout-lead">Ended. Tracked {euros(item.settlement.trackedCents)}. Each person takes {euros(item.settlement.eachShareCents)}. {item.settlement.reason}</p>
      ) : null}
    </article>
  );
}
