import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { aiGuidesAPI, type AiGuideCharacter, type AiLesson } from '../api/aiGuides';
import { guideHelpAPI, type GuideHelpKind, type GuideHelpStatus } from '../api/guideHelp';
import { getLanguageName } from '../constants/languages';
import { speakGuideLine, translateGuideText } from '../lib/aiGuideSpeech';
import AiGuideDemo from './AiGuideDemo';
import AiGuideChat from './AiGuideChat';
import FashionDesk from './fashion/FashionDesk';
import AppearanceDesk from './appearance/AppearanceDesk';
import IntimacyDesk from './intimacy/IntimacyDesk';
import GuideHelpGate from './GuideHelpGate';
import './AiGuideStudio.css';

const STATS: { key: keyof AiGuideCharacter['ratings']; label: string }[] = [
  { key: 'directness', label: 'Direct' },
  { key: 'warmth', label: 'Warmth' },
  { key: 'datingIq', label: 'Dating' },
  { key: 'texting', label: 'Texting' },
  { key: 'style', label: 'Style' },
  { key: 'boundaries', label: 'Bounds' },
  { key: 'healing', label: 'Heal' },
  { key: 'attraction', label: 'Spark' },
];

function stripRoleplay(text: string) {
  return text.replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
}

function speak(guide: AiGuideCharacter, text: string, onStart: () => void, onEnd: () => void) {
  void speakGuideLine(guide.voice, stripRoleplay(text), onStart, onEnd);
}

type Kind = 'choose' | 'ai' | 'human';

export default function AiGuideStudio({
  mode = 'gate',
  onUnlocked,
  onChooseHuman,
  onClose,
  initialQuery = '',
  openTermAct = false,
  initialGuideId,
  startInChat = false,
}: {
  mode?: 'gate' | 'app';
  onUnlocked?: () => void;
  onChooseHuman?: () => void;
  onClose?: () => void;
  initialQuery?: string;
  openTermAct?: boolean;
  /** Jump straight into chat with this guide (Character.AI-style). */
  initialGuideId?: string;
  startInChat?: boolean;
}) {
  const { user, updateUser } = useContext(AuthContext);
  const { language } = useTranslation();
  const [kind, setKind] = useState<Kind>(mode === 'app' ? 'ai' : 'choose');
  const [guides, setGuides] = useState<AiGuideCharacter[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [lesson, setLesson] = useState<AiLesson | null>(null);
  const [lessonLocal, setLessonLocal] = useState<AiLesson | null>(null);
  const [ranked, setRanked] = useState<AiGuideCharacter[]>([]);
  const [selected, setSelected] = useState<AiGuideCharacter | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showFashion, setShowFashion] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showIntimacy, setShowIntimacy] = useState(false);
  const [startOnHair, setStartOnHair] = useState(false);
  const [startOnTermAct, setStartOnTermAct] = useState(openTermAct);
  const [inChat, setInChat] = useState(Boolean(startInChat && initialGuideId));
  const [paywall, setPaywall] = useState<GuideHelpStatus | null>(null);
  const [helpStatus, setHelpStatus] = useState<GuideHelpStatus | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeStudio = onClose || (mode === 'app' ? onUnlocked : undefined);

  const tryHelp = async (kindHelp: GuideHelpKind, then: () => void) => {
    setError('');
    try {
      const r = await guideHelpAPI.consume(kindHelp);
      setHelpStatus(r);
      setPaywall(null);
      then();
    } catch (e: any) {
      // Local testing never blocks — even if a remote API returns 402
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        setPaywall(null);
        then();
        return;
      }
      if (e.response?.status === 402) {
        setPaywall(e.response.data);
        return;
      }
      setError(e.response?.data?.error || 'Could not start that help.');
    }
  };

  useEffect(() => {
    guideHelpAPI.status().then(setHelpStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!lesson) {
      setLessonLocal(null);
      return;
    }
    if (language === 'en') {
      setLessonLocal(lesson);
      return;
    }
    let cancelled = false;
    (async () => {
      const [title, cause, solution, prevention, unknown, reply] = await Promise.all([
        translateGuideText(lesson.title, language),
        translateGuideText(lesson.cause, language),
        translateGuideText(lesson.solution, language),
        translateGuideText(lesson.prevention, language),
        translateGuideText(lesson.unknown, language),
        translateGuideText(lesson.reply || `${lesson.solution} ${lesson.unknown}`, language),
      ]);
      if (!cancelled) {
        setLessonLocal({ ...lesson, title, cause, solution, prevention, unknown, reply });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lesson, language]);

  useEffect(() => {
    if (!openTermAct) return;
    void tryHelp('termact', () => {
      setStartOnTermAct(true);
      setShowIntimacy(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTermAct]);

  useEffect(() => {
    aiGuidesAPI.list().then((r) => {
      setGuides(r.guides);
      setSelected((prev) => prev || r.guides.find((g) => g.id === user?.aiGuideId) || r.guides[0] || null);
    }).catch(() => setError('Could not load guides.'));
    aiGuidesAPI.me().then((r) => {
      if (r.guide) setSelected(r.guide);
    }).catch(() => {});
  }, [user?.aiGuideId]);

  const featured = selected || ranked[0] || guides[0] || null;
  const crew = useMemo(() => {
    const list = ranked.length ? ranked : guides;
    return list;
  }, [ranked, guides]);
  const fashionCrew = useMemo(
    () => guides.filter((g) => g.desk === 'fashion' || g.id === 'elena'),
    [guides]
  );
  const appearanceCrew = useMemo(
    () => guides.filter((g) => g.desk === 'appearance' || g.id === 'elena'),
    [guides]
  );
  const hairCrew = useMemo(
    () => guides.filter((g) => g.desk === 'hair' || g.id === 'elena'),
    [guides]
  );

  const runSearch = async (raw?: string) => {
    const q = (raw ?? query).trim();
    if (!q) return;
    setBusy(true);
    setError('');
    try {
      const r = await aiGuidesAPI.interpret(q);
      setLesson(null);

      const openTalk = (preferFinance?: boolean) => {
        const g =
          (preferFinance ? guides.find((x) => x.desk === 'finance') : null) ||
          selected ||
          ranked[0] ||
          guides[0] ||
          null;
        if (!g) {
          setError('Pick any coach avatar and talk — no menu.');
          return;
        }
        setSelected(g);
        if (mode === 'gate') onUnlocked?.();
        setInChat(true);
      };

      // Never show category chips — open chat or a specialist desk
      if (r.openChat || !r.guess || (r.guess.confidence != null && r.guess.confidence < 0.7)) {
        const moneyCue = /\b(money|debt|budget|income|business|saas|hustle|broke|spend)\b/i.test(q);
        openTalk(moneyCue);
        return;
      }

      const termCue = /\b(termact|foreplay|boy to girl|girl to boy)\b/i.test(q);
      if (r.guess?.id === 'fashion') {
        await tryHelp('fashion', () => setShowFashion(true));
      } else if (r.guess?.id === 'appearance') {
        setStartOnHair(false);
        await tryHelp('appearance', () => setShowAppearance(true));
      } else if (r.guess?.id === 'hair') {
        setStartOnHair(true);
        await tryHelp('appearance', () => {
          setShowAppearance(true);
          setSelected((prev) =>
            prev && (prev.desk === 'hair' || prev.id === 'elena')
              ? prev
              : guides.find((g) => g.id === 'kayra-theodore') || hairCrew[0] || prev
          );
        });
      } else if (r.guess?.id === 'intimacy-flow' || termCue) {
        await tryHelp(termCue ? 'termact' : 'intimacy', () => {
          setStartOnTermAct(termCue);
          setShowIntimacy(true);
          setSelected((prev) => guides.find((g) => g.id === 'mei') || prev);
        });
      } else {
        // Dating / money / anything else → straight into Character.AI-style chat
        openTalk(r.guess?.id === 'cash-flow-execution');
      }
    } catch {
      setError('Could not read that. Try fewer words.');
    } finally {
      setBusy(false);
    }
  };

  const searchedInitial = useRef(false);

  useEffect(() => {
    if (searchedInitial.current || !initialQuery || !guides.length) return;
    searchedInitial.current = true;
    void runSearch(initialQuery);
  }, [initialQuery, guides.length]);

  const switchGuideOnLesson = async (g: AiGuideCharacter) => {
    setSelected(g);
    if (!lesson?.id) return;
    try {
      const r = await aiGuidesAPI.lesson(lesson.id, g.id);
      setLesson(r.lesson);
      setRanked(r.guides);
    } catch {
      /* keep prior lesson text */
    }
  };

  const pickGuide = async (g: AiGuideCharacter) => {
    setSelected(g);
    setBusy(true);
    try {
      // Keep studio mounted over the gate (holdAiChat) so area chips don't flash under chat
      if (mode === 'gate') onUnlocked?.();
      await aiGuidesAPI.assign(g.id, lesson?.id);
      updateUser({ aiGuideId: g.id });
      window.dispatchEvent(new Event('guide-program:updated'));
      setInChat(true);
      setShowFashion(false);
      setShowAppearance(false);
      setShowIntimacy(false);
    } catch {
      setError('Could not start with this guide.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!initialGuideId || !guides.length) return;
    const g = guides.find((x) => x.id === initialGuideId);
    if (g) {
      setSelected(g);
      setKind('ai');
      if (startInChat) setInChat(true);
    }
  }, [initialGuideId, guides, startInChat]);

  if (kind === 'choose') {
    return (
      <div className="ai-studio-overlay">
        <div className="ai-studio-top">
          <span className="ai-studio-brand">Crew</span>
          {closeStudio && (
            <button type="button" className="ai-pill ai-pill-ghost" onClick={() => closeStudio()}>
              Close
            </button>
          )}
        </div>
        <div className="ai-kind">
          <button type="button" className="ai-kind-card" onClick={() => { setKind('ai'); inputRef.current?.focus(); }}>
            <h3>AI crew — ready now</h3>
            <p>Pick a character. They cover dating, texting, style, sex, healing, red flags, and more. Short advice. You can switch anytime.</p>
          </button>
          <button
            type="button"
            className="ai-kind-card"
            onClick={() => setKind('human')}
          >
            <h3>Human guide — later</h3>
            <p>People can apply to become guides after they learn the system. You can wait for a human, or start with the crew today.</p>
          </button>
        </div>
      </div>
    );
  }

  if (kind === 'human') {
    return (
      <div className="ai-studio-overlay">
        <div className="ai-human">
          <p className="ai-studio-brand">Human guides</p>
          <h2>How applying works</h2>
          <p>Humans apply with proof in Compatibility. First reviews take a couple of days. They are not the default — the crew is. You can still request a person after you pick an AI guide.</p>
          <div className="ai-session-actions">
            <button type="button" className="ai-pill ai-pill-primary" onClick={() => onChooseHuman?.()}>
              Browse humans
            </button>
            <button type="button" className="ai-pill ai-pill-ghost" onClick={() => setKind('ai')}>
              Use the AI crew instead
            </button>
            {closeStudio && (
              <button type="button" className="ai-pill ai-pill-ghost" onClick={() => closeStudio()}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (inChat && featured) {
    return (
      <div className="ai-studio-overlay ai-studio-overlay--chat">
        {showFashion ? (
          <FashionDesk
            guide={
              featured.desk === 'fashion' || featured.id === 'elena'
                ? featured
                : guides.find((g) => g.id === 'elena') || fashionCrew[0] || featured
            }
            stylists={fashionCrew}
            onPickStylist={(g) => setSelected(g)}
            onClose={() => setShowFashion(false)}
            onSpeaking={setSpeaking}
          />
        ) : showAppearance ? (
          <AppearanceDesk
            key={startOnHair ? 'hair' : 'face'}
            guide={
              featured.desk === 'appearance' || featured.desk === 'hair' || featured.id === 'elena'
                ? featured
                : startOnHair
                  ? hairCrew.find((g) => g.id === 'kayra-theodore') || hairCrew[0] || featured
                  : appearanceCrew[0] || featured
            }
            stylists={appearanceCrew}
            hairStylists={hairCrew}
            initialTab={startOnHair ? 'hair' : 'scan'}
            onPickStylist={(g) => setSelected(g)}
            onClose={() => {
              setShowAppearance(false);
              setStartOnHair(false);
            }}
            onSpeaking={setSpeaking}
          />
        ) : (
          <AiGuideChat
            guide={featured}
            lesson={lessonLocal || lesson}
            onSpeaking={setSpeaking}
            onOpenFashion={() =>
              void tryHelp('fashion', () => {
                setShowFashion(true);
                setShowAppearance(false);
              })
            }
            onOpenAppearance={() =>
              void tryHelp('appearance', () => {
                setStartOnHair(featured.desk === 'hair');
                setShowAppearance(true);
                setShowFashion(false);
              })
            }
            onBack={() => {
              setInChat(false);
              if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
              setSpeaking(false);
            }}
            onClose={
              closeStudio
                ? () => {
                    if (mode === 'gate') onUnlocked?.();
                    closeStudio();
                  }
                : undefined
            }
          />
        )}
        {closeStudio && (showFashion || showAppearance) && (
          <button
            type="button"
            className="ai-pill ai-pill-ghost ai-studio-chat-close"
            onClick={() => {
              if (mode === 'gate') onUnlocked?.();
              closeStudio();
            }}
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ai-studio-overlay">
      {paywall && (
        <GuideHelpGate
          status={paywall}
          onPaid={(next) => {
            setHelpStatus(next);
            setPaywall(null);
          }}
          onClose={() => setPaywall(null)}
        />
      )}
      <div className="ai-studio-top">
        <span className="ai-studio-brand">
          Crew
          {helpStatus?.testingFree || helpStatus?.isPremium
            ? helpStatus?.testingFree
              ? ' · testing · unlimited'
              : ' · premium unlimited'
            : helpStatus
              ? ` · ${helpStatus.freeRemaining} free left`
              : ''}
          {language !== 'en' ? ` · ${getLanguageName(language)}` : ''}
        </span>
        <div className="ai-studio-top-actions">
          <button type="button" className="ai-pill ai-pill-ghost" onClick={() => setKind('choose')}>
            Human or AI
          </button>
          <button
            type="button"
            className="ai-pill ai-pill-primary"
            onClick={() =>
              void tryHelp('fashion', () => {
                setShowFashion(true);
                setShowAppearance(false);
                setShowIntimacy(false);
                setSelected((prev) =>
                  prev && (prev.desk === 'fashion' || prev.id === 'elena')
                    ? prev
                    : guides.find((g) => g.id === 'elena') || fashionCrew[0] || prev
                );
              })
            }
          >
            Outfit help
          </button>
          <button
            type="button"
            className="ai-pill ai-pill-primary"
            onClick={() =>
              void tryHelp('appearance', () => {
                setStartOnHair(false);
                setShowAppearance(true);
                setShowFashion(false);
                setShowIntimacy(false);
                setSelected((prev) =>
                  prev && (prev.desk === 'appearance' || prev.id === 'elena')
                    ? prev
                    : guides.find((g) => g.id === 'elena') || appearanceCrew[0] || prev
                );
              })
            }
          >
            Face & look
          </button>
          {(featured?.id === 'mei' || showIntimacy) && (
            <button
              type="button"
              className="ai-pill ai-pill-primary"
              onClick={() =>
                void tryHelp('intimacy', () => {
                  setStartOnTermAct(false);
                  setShowIntimacy(true);
                  setShowFashion(false);
                  setShowAppearance(false);
                })
              }
            >
              Bedroom flow
            </button>
          )}
          {(featured?.id === 'mei' || showIntimacy) && (
            <button
              type="button"
              className="ai-pill ai-pill-primary"
              onClick={() =>
                void tryHelp('termact', () => {
                  setStartOnTermAct(true);
                  setShowIntimacy(true);
                  setShowFashion(false);
                  setShowAppearance(false);
                })
              }
            >
              TermAct
            </button>
          )}
          {closeStudio && (
            <button type="button" className="ai-pill ai-pill-ghost" onClick={() => closeStudio()}>
              Close
            </button>
          )}
        </div>
      </div>
      {!showFashion && !showAppearance && !showIntimacy && (
      <form
        className="ai-studio-search"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type what is going on — ghosting, last longer, what to wear…"
          autoComplete="off"
        />
        <button type="submit" className="ai-pill ai-pill-primary" disabled={busy}>
          {busy ? '…' : 'Find it'}
        </button>
      </form>
      )}
      {error && <p className="school-error" style={{ margin: '0 20px 8px' }}>{error}</p>}
      <div className="ai-stage">
        {featured && (
          <div className="ai-featured">
            <img src={featured.portrait} alt="" />
            <div className={`ai-wave ${speaking ? '' : 'idle'}`}>
              <span /><span /><span /><span /><span />
            </div>
            <div className="ai-featured-meta">
              <strong>{featured.name}</strong>
              <span>{featured.specialty}</span>
            </div>
          </div>
        )}
        <div className="ai-right">
          {showIntimacy && featured ? (
            <IntimacyDesk
              key={startOnTermAct ? 'termact' : 'positions'}
              guide={featured}
              onClose={() => setShowIntimacy(false)}
              onSpeaking={setSpeaking}
              startOnTermAct={startOnTermAct}
            />
          ) : showAppearance && featured ? (
            <AppearanceDesk
              key={startOnHair ? 'hair' : 'face'}
              guide={
                featured.desk === 'appearance' || featured.desk === 'hair' || featured.id === 'elena'
                  ? featured
                  : startOnHair
                    ? hairCrew.find((g) => g.id === 'kayra-theodore') || hairCrew[0] || featured
                    : appearanceCrew[0] || featured
              }
              stylists={appearanceCrew}
              hairStylists={hairCrew}
              initialTab={startOnHair ? 'hair' : 'scan'}
              onPickStylist={(g) => setSelected(g)}
              onClose={() => {
                setShowAppearance(false);
                setStartOnHair(false);
              }}
              onSpeaking={setSpeaking}
            />
          ) : showFashion && featured ? (
            <FashionDesk
              guide={featured.desk === 'fashion' || featured.id === 'elena' ? featured : fashionCrew[0] || featured}
              stylists={fashionCrew}
              onPickStylist={(g) => setSelected(g)}
              onClose={() => setShowFashion(false)}
              onSpeaking={setSpeaking}
            />
          ) : (
            <>
          {lesson && (
            <div className="ai-session">
              <h4>{(lessonLocal || lesson).title}</h4>
              <AiGuideDemo kind={lesson.demo} />
              <div className="ai-reply" aria-label="Guide reply">
                {((lessonLocal || lesson).reply || `${(lessonLocal || lesson).solution} ${(lessonLocal || lesson).unknown}`)
                  .split('\n')
                  .map((line, i) => (
                    <p key={i} className={/\*[^*]+\*/.test(line) ? 'ai-reply-thought' : 'ai-reply-line'}>
                      {line}
                    </p>
                  ))}
              </div>
              {featured && (
                <p style={{ fontSize: 12, color: '#f59e0b', margin: '0 0 10px' }}>
                  Hearing {featured.name.split(' ')[0]}’s take — switch avatars for a different mind.
                </p>
              )}
              <div className="ai-switch" aria-label="Switch guide">
                {crew.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={featured?.id === g.id ? 'is-on' : ''}
                    title={`${g.name} — ${g.specialty}`}
                    onClick={() => void switchGuideOnLesson(g)}
                  >
                    <img src={g.portrait} alt="" />
                  </button>
                ))}
              </div>
              <div className="ai-session-actions">
                {featured && (
                  <button type="button" className="ai-pill ai-pill-primary" onClick={() => void pickGuide(featured)} disabled={busy}>
                    Work with {featured.name.split(' ')[0]}
                  </button>
                )}
                {featured && (
                  <button
                    type="button"
                    className="ai-pill ai-pill-ghost"
                    onClick={() =>
                      speak(
                        featured,
                        lesson.reply || `${lesson.solution} ${lesson.unknown}`,
                        () => setSpeaking(true),
                        () => setSpeaking(false)
                      )
                    }
                  >
                    Say it{language !== 'en' ? ` (${getLanguageName(language)})` : ''}
                  </button>
                )}
                {lesson.id === 'fashion' && (
                  <button type="button" className="ai-pill ai-pill-primary" onClick={() => void tryHelp('fashion', () => setShowFashion(true))}>
                    Open outfit desk
                  </button>
                )}
                {(lesson.id === 'appearance' || lesson.id === 'hair') && (
                  <button
                    type="button"
                    className="ai-pill ai-pill-primary"
                    onClick={() =>
                      void tryHelp('appearance', () => {
                        setStartOnHair(lesson.id === 'hair');
                        setShowAppearance(true);
                      })
                    }
                  >
                    {lesson.id === 'hair' ? 'Open hair desk' : 'Open face desk'}
                  </button>
                )}
                {lesson.id === 'couples-counseling' && featured && (
                  <button type="button" className="ai-pill ai-pill-primary" onClick={() => void pickGuide(featured)} disabled={busy}>
                    Work with {featured.name.split(' ')[0]}
                  </button>
                )}
                {lesson.id === 'financial-literacy' && (
                  <button
                    type="button"
                    className="ai-pill ai-pill-primary"
                    onClick={() => {
                      const lead =
                        (featured?.desk === 'finance' ? featured : null) ||
                        guides.find((g) => g.id === 'george-clason') ||
                        guides.find((g) => g.desk === 'finance') ||
                        featured;
                      if (lead) void pickGuide(lead);
                    }}
                    disabled={busy}
                  >
                    Open finance desk
                  </button>
                )}
                {(lesson.id === 'intimacy-flow' || lesson.id === 'sex-mismatch') && (
                  <button type="button" className="ai-pill ai-pill-primary" onClick={() => void tryHelp('intimacy', () => { setStartOnTermAct(false); setShowIntimacy(true); })}>
                    Open bedroom flow
                  </button>
                )}
                {(lesson.id === 'intimacy-flow' || lesson.id === 'sex-mismatch') && (
                  <button type="button" className="ai-pill ai-pill-primary" onClick={() => void tryHelp('termact', () => { setStartOnTermAct(true); setShowIntimacy(true); })}>
                    Open TermAct
                  </button>
                )}
              </div>
            </div>
          )}
          {!lesson && (
            <div className="ai-crew">
              {crew.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`ai-card ${featured?.id === g.id ? 'is-on' : ''}`}
                  onClick={() => {
                    void pickGuide(g);
                  }}
                >
                  <div className="ai-card-head">
                    <div>
                      <b>{g.name.toUpperCase()}</b>
                      <em>{g.specialty}</em>
                      {g.lens === 'feminine' && <span className="ai-lens-tag">Feminine lens</span>}
                      {g.desk === 'fashion' && <span className="ai-lens-tag ai-lens-fashion">Fashion desk</span>}
                      {g.desk === 'appearance' && <span className="ai-lens-tag ai-lens-face">Face desk</span>}
                      {g.desk === 'hair' && <span className="ai-lens-tag ai-lens-hair">Hair desk</span>}
                      {g.desk === 'relationship' && <span className="ai-lens-tag ai-lens-couple">Couples desk</span>}
                      {g.desk === 'finance' && <span className="ai-lens-tag ai-lens-text">Finance desk</span>}
                      {g.desk === 'texting' && <span className="ai-lens-tag ai-lens-text">Texting desk</span>}
                    </div>
                    <img src={g.portrait} alt="" />
                  </div>
                  {STATS.map((s) => (
                    <div key={s.key} className="ai-stat">
                      {s.label}
                      <i><em style={{ width: `${g.ratings[s.key] * 10}%` }} /></i>
                    </div>
                  ))}
                </button>
              ))}
            </div>
          )}
          {featured && !lesson && (
            <p className="ai-blurb">
              {featured.personality} {featured.thinking}
              {' '}
              <button type="button" className="ai-pill ai-pill-primary" onClick={() => void pickGuide(featured)} disabled={busy}>
                Choose {featured.name.split(' ')[0]}
              </button>
              <button type="button" className="ai-pill ai-pill-ghost" onClick={() => void tryHelp('fashion', () => setShowFashion(true))}>
                Outfit help
              </button>
              <button type="button" className="ai-pill ai-pill-ghost" onClick={() => void tryHelp('appearance', () => setShowAppearance(true))}>
                Face & look
              </button>
              {featured.id === 'mei' && (
                <button type="button" className="ai-pill ai-pill-ghost" onClick={() => void tryHelp('intimacy', () => { setStartOnTermAct(false); setShowIntimacy(true); })}>
                  Bedroom flow
                </button>
              )}
              {featured.id === 'mei' && (
                <button type="button" className="ai-pill ai-pill-ghost" onClick={() => void tryHelp('termact', () => { setStartOnTermAct(true); setShowIntimacy(true); })}>
                  TermAct
                </button>
              )}
            </p>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AiGuideFab() {
  const { user } = useContext(AuthContext);
  const [guide, setGuide] = useState<AiGuideCharacter | null>(null);
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const [openTermAct, setOpenTermAct] = useState(false);
  const [startInChat, setStartInChat] = useState(true);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ query?: string; termact?: boolean; chat?: boolean }>).detail || {};
      setInitialQuery(detail.query || '');
      setOpenTermAct(Boolean(detail.termact));
      setStartInChat(detail.chat !== false);
      setOpen(true);
    };
    window.addEventListener('ai-guide:open', onOpen);
    return () => window.removeEventListener('ai-guide:open', onOpen);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const mine = await aiGuidesAPI.me();
        if (!cancelled && mine.guide) {
          setGuide(mine.guide);
          return;
        }
      } catch {
        /* fall through to the id on the session */
      }
      if (!user?.aiGuideId) {
        if (!cancelled) setGuide(null);
        return;
      }
      try {
        const r = await aiGuidesAPI.list();
        if (!cancelled) setGuide(r.guides.find((g) => g.id === user.aiGuideId) || null);
      } catch {
        if (!cancelled) setGuide(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.aiGuideId]);

  if (!guide) return null;
  return (
    <>
      {!open && (
        <button
          type="button"
          className="ai-fab"
          onClick={() => {
            setStartInChat(true);
            setOpen(true);
          }}
        >
          <img src={guide.portrait} alt="" />
          Ask {guide.name.split(' ')[0]}
        </button>
      )}
      {open && (
        <AiGuideStudio
          mode="app"
          onClose={() => {
            setOpen(false);
            setInitialQuery('');
            setOpenTermAct(false);
          }}
          initialQuery={initialQuery}
          openTermAct={openTermAct}
          initialGuideId={guide.id}
          startInChat={startInChat && !openTermAct}
        />
      )}
    </>
  );
}
