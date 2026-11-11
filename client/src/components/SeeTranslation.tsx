import { useEffect, useMemo, useState } from 'react';
import { filterLanguages } from '../constants/languages';
import { isRtlLanguage } from '../i18n/countryLanguage';
import type { InterestCopy } from '../i18n/interestCopy';
import { useInterestLocale } from '../i18n/useInterestLocale';
import { localizeLine } from '../lib/localizeCopy';
import './SeeTranslation.css';

type Props = {
  texts: string[];
  sourceLang: string;
  labels: Pick<
    InterestCopy,
    'seeTranslation' | 'seeOriginal' | 'searchLanguage' | 'translating' | 'translationUnavailable' | 'noLanguageMatch'
  >;
};

/** Manual translation under a notice. Nothing is translated until a language is chosen. */
export default function SeeTranslation({ texts, sourceLang, labels }: Props) {
  const lines = texts.map((line) => line.trim()).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const matches = useMemo(() => filterLanguages(query), [query]);

  if (!lines.length) return null;

  const choose = async (code: string) => {
    setPicked(code);
    setError('');
    if (code === sourceLang.split('-')[0]) {
      setTranslated(lines);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const out: string[] = [];
      for (const line of lines) {
        out.push(await localizeLine(line, code, sourceLang));
      }
      setTranslated(out);
      setOpen(false);
    } catch {
      setTranslated(null);
      setError(labels.translationUnavailable);
    } finally {
      setLoading(false);
    }
  };

  const showOriginal = () => {
    setTranslated(null);
    setPicked('');
    setOpen(false);
    setError('');
    setQuery('');
  };

  return (
    <div className="see-translation">
      {translated && (
        <div className="see-translation-result" dir={isRtlLanguage(picked) ? 'rtl' : 'ltr'}>
          {translated.map((line, index) => (
            <p key={`${index}-${line.slice(0, 24)}`}>{line}</p>
          ))}
        </div>
      )}
      {error && <p className="see-translation-error">{error}</p>}
      <button
        type="button"
        className="see-translation-link"
        onClick={() => (translated ? showOriginal() : setOpen((value) => !value))}
        disabled={loading}
      >
        {loading ? labels.translating : translated ? labels.seeOriginal : labels.seeTranslation}
      </button>
      {open && !translated && (
        <div className="see-translation-picker">
          <input
            type="search"
            value={query}
            placeholder={labels.searchLanguage}
            aria-label={labels.searchLanguage}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="see-translation-list" role="listbox">
            {matches.length === 0 && <p className="see-translation-empty">{labels.noLanguageMatch}</p>}
            {matches.map((lang) => (
              <button key={lang.code} type="button" onClick={() => void choose(lang.code)}>
                <span>{lang.native === lang.name ? lang.name : `${lang.name} · ${lang.native}`}</span>
                <span className="see-translation-code">{lang.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Server text starts in English. Show it in the location language, with a manual translate under it. */
export function LocationSentence({ text, profileCountry }: { text: string; profileCountry?: string }) {
  const { lang, copy } = useInterestLocale(profileCountry);
  const [shown, setShown] = useState(text);
  const [from, setFrom] = useState('en');

  useEffect(() => {
    let cancel = false;
    localizeLine(text, lang, 'en')
      .then((line) => {
        if (cancel) return;
        setShown(line);
        setFrom(lang);
      })
      .catch(() => {
        if (cancel) return;
        setShown(text);
        setFrom('en');
      });
    return () => {
      cancel = true;
    };
  }, [text, lang]);

  return (
    <div dir={isRtlLanguage(from) ? 'rtl' : 'ltr'}>
      <div className="see-translation-result"><p>{shown}</p></div>
      <SeeTranslation texts={[shown]} sourceLang={from} labels={copy} />
    </div>
  );
}
