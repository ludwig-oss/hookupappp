import { useEffect, useState } from 'react';
import { scoutAPI, type Profession, type ScoutCard, type ScoutState } from '../../../api/scout';

export function ScoutBoard({
  state,
  busy,
  onCycle,
  onInterest,
}: {
  state: ScoutState;
  busy: boolean;
  onCycle: (professionId?: string) => void;
  onInterest: (userId: string, mode: 'talk' | 'building') => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Profession[]>([]);
  const [filter, setFilter] = useState(state.professionId || '');

  useEffect(() => {
    const handle = window.setTimeout(() => {
      scoutAPI.professions(query).then(setOptions).catch(() => setOptions([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <section className="scout-panel">
      <div className="scout-row">
        <h3>SCOUT CYCLE</h3>
        <span className="scout-meta">Experience {state.experienceScore} · list {state.listSize} · floor {state.qualityFloor}</span>
      </div>
      <p className="scout-lead">Gender is not a filter. Judgment removes profiles under {state.qualityFloor}. Experience caps this cycle at {state.listSize}.</p>
      <label>
        Profession filter
        <input value={query} placeholder="Search lawyers, judges, footballers…" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="scout-list">
        <button type="button" className={`scout-chip${!filter ? ' is-on' : ''}`} onClick={() => setFilter('')}>Any</button>
        {options.map((item) => (
          <button key={item.id} type="button" className={`scout-chip${filter === item.id ? ' is-on' : ''}`} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="scout-actions">
        <button type="button" disabled={busy} onClick={() => onCycle(filter || undefined)}>Run cycle</button>
      </div>
      {state.board.map((card) => (
        <ScoutRow key={card.userId} card={card} busy={busy} onInterest={onInterest} />
      ))}
      {!state.board.length ? <p className="scout-lead">Run a cycle after at least one other verified scout is in range.</p> : null}
    </section>
  );
}

function ScoutRow({
  card,
  busy,
  onInterest,
}: {
  card: ScoutCard;
  busy: boolean;
  onInterest: (userId: string, mode: 'talk' | 'building') => void;
}) {
  return (
    <article className="scout-card">
      <strong>{card.name}</strong>
      <span className="scout-meta"> {card.username ? `@${card.username}` : ''} · {card.professionLabel}{card.city ? ` · ${card.city}` : ''}</span>
      <p className="scout-meta">Quality {card.quality} · {card.years} years · experience {card.experienceScore}</p>
      <div className="scout-actions">
        <button type="button" disabled={busy} onClick={() => onInterest(card.userId, 'talk')}>Show interest · Just Talk</button>
        <button type="button" className="scout-blue" disabled={busy} onClick={() => onInterest(card.userId, 'building')}>Show interest · Building</button>
      </div>
    </article>
  );
}
