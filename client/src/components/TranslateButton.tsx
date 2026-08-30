import { useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { translateText } from '../lib/translateText';

type Props = {
  text: string;
  className?: string;
};

export default function TranslateButton({ text, className }: Props) {
  const { language } = useTranslation();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!text?.trim()) return null;

  const handleClick = async () => {
    if (translated) {
      setTranslated(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await translateText(text, language);
      setTranslated(out);
    } catch {
      setError('Translation unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      {translated && (
        <div
          style={{
            fontSize: 12,
            color: '#a5b4fc',
            marginTop: 4,
            marginBottom: 4,
            fontStyle: 'italic',
          }}
        >
          {translated}
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#818cf8',
          fontSize: 11,
          cursor: 'pointer',
          padding: '2px 0',
          textDecoration: 'underline',
        }}
      >
        {loading ? 'Translating…' : translated ? 'Show original' : 'Translate'}
      </button>
    </div>
  );
}
