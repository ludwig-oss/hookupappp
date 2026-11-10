import { useEffect, useState } from 'react';
import { scoutAPI, type Profession } from '../../../api/scout';

export function ScoutOnboarding({ onSaved }: { onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Profession[]>([]);
  const [professionId, setProfessionId] = useState('');
  const [years, setYears] = useState(3);
  const [judgment, setJudgment] = useState(50);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => {
      scoutAPI.professions(query).then(setOptions).catch(() => setOptions([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <form
      className="scout-panel"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        scoutAPI.saveProfile({ professionId, years, judgment }).then(onSaved).catch(() => setError('Pick a profession from the list.'));
      }}
    >
      <h3>VERIFY YOUR PROFESSION</h3>
      <p className="scout-lead">Scout opens after you confirm what you do. Experience sets the list length. Judgment drops weak profiles.</p>
      <label>
        Search professions
        <input value={query} placeholder="Lawyer, footballer, producer…" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="scout-list">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`scout-chip${professionId === item.id ? ' is-on' : ''}`}
            onClick={() => setProfessionId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label>
        Years of experience
        <input type="number" min={0} max={60} value={years} onChange={(event) => setYears(Number(event.target.value))} />
      </label>
      <label>
        Judgment ({judgment})
        <input type="range" min={0} max={100} value={judgment} onChange={(event) => setJudgment(Number(event.target.value))} />
      </label>
      {error ? <p className="scout-error">{error}</p> : null}
      <button type="submit" disabled={!professionId}>Verify and enter Scout</button>
    </form>
  );
}
