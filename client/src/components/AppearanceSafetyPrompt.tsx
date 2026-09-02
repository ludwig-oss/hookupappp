import { useEffect, useState } from 'react';
import { personalSafetyAPI } from '../api/personalSafety';
import './AppearanceSafetyPrompt.css';

type Resolver = (saved: string | null) => void;

const EVENT = 'safety:ask-appearance';

/** Ask what the user is wearing before a date / meetup. Resolves with saved text, or null if skipped. */
export function askWhatYouAreWearing(): Promise<string | null> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { resolve } }));
  });
}

export default function AppearanceSafetyPrompt() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resolver, setResolver] = useState<Resolver | null>(null);

  useEffect(() => {
    const onAsk = (e: Event) => {
      const resolve = (e as CustomEvent<{ resolve: Resolver }>).detail?.resolve;
      if (!resolve) return;
      personalSafetyAPI
        .getSettings()
        .then((d) => setText(d.settings.appearanceDescription || ''))
        .catch(() => {});
      setError('');
      setResolver(() => resolve);
      setOpen(true);
    };
    window.addEventListener(EVENT, onAsk);
    return () => window.removeEventListener(EVENT, onAsk);
  }, []);

  const finish = (value: string | null) => {
    resolver?.(value);
    setResolver(null);
    setOpen(false);
  };

  const save = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 4) {
      setError('A short description helps people find you — jacket, colors, shoes.');
      return;
    }
    setSaving(true);
    try {
      await personalSafetyAPI.updateSettings({ appearanceDescription: trimmed });
      finish(trimmed);
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="asp-overlay" role="dialog" aria-labelledby="asp-title">
      <div className="asp-card">
        <h3 id="asp-title">Hey — for your safety</h3>
        <p>
          You&apos;re about to meet someone. What are you wearing and how do you look? We save this just in case someone needs to find you.
        </p>
        <textarea
          className="asp-input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. red jacket, blue jeans, white sneakers, brown hair"
          maxLength={300}
        />
        {error && <p className="asp-error">{error}</p>}
        <button type="button" className="asp-save" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save for safety'}
        </button>
        <button type="button" className="asp-skip" disabled={saving} onClick={() => finish(null)}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
