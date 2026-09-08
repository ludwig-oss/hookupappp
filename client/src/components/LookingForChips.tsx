import { DATE_LOOKING_FOR } from '../data/dateLookingFor';

export default function LookingForChips({
  value,
  onChange,
  variant = 'auth',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  variant?: 'auth' | 'setup';
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className={`looking-for-chips looking-for-chips-${variant}`}>
      <p className="looking-for-chips-label">
        {variant === 'setup' ? 'Pick at least one.' : 'What are you looking for? Pick at least one.'}
      </p>
      <div className="looking-for-chips-row">
        {DATE_LOOKING_FOR.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`looking-for-chip${value.includes(opt.id) ? ' is-on' : ''}`}
            title={opt.hint}
            onClick={() => toggle(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
