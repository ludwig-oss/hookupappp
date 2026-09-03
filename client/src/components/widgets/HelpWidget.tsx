import { useState, useEffect, useRef, useMemo } from 'react';
import {
  HELP_FAQ,
  HELP_CATEGORIES,
  HELP_NAV_LINKS,
  HELP_SHORTCUTS,
  getHelpMatch,
  targetsFromText,
  type HelpFaqItem,
  type HelpMatch,
  type HelpNavTarget,
} from '../../data/helpFaq';
import './HelpWidget.css';

const HELP_STORAGE_KEY = 'help_history';

interface HelpEntry {
  id: string;
  question: string;
  answer: string;
  at: string;
}

export interface HelpWidgetProps {
  onOpenChat?: () => void;
  onOpenLoveFeed?: () => void;
  onNavigate?: (target: HelpNavTarget) => void;
}

function HelpAnswerRich({
  text,
  onNavigate,
}: {
  text: string;
  onNavigate: (target: HelpNavTarget) => void;
}) {
  const pattern = HELP_SHORTCUTS
    .slice()
    .sort((a, b) => b.phrase.length - a.phrase.length)
    .map((s) => s.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const re = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(re);
  return (
    <p className="help-answer-text">
      {parts.map((part, i) => {
        const hit = HELP_SHORTCUTS.find((s) => s.phrase.toLowerCase() === part.toLowerCase());
        if (!hit) return <span key={i}>{part}</span>;
        return (
          <button
            key={`${part}-${i}`}
            type="button"
            className="help-shortcut"
            onClick={() => onNavigate(hit.target)}
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

function matchFromFaq(item: HelpFaqItem, asked?: string): HelpMatch {
  return {
    userQuestion: asked || item.q,
    matchedQuestion: item.q,
    answer: item.a,
    targets: targetsFromText(`${item.q} ${item.a}`),
    related: [],
    confidence: 'high',
  };
}

export default function HelpWidget({ onOpenChat, onOpenLoveFeed, onNavigate }: HelpWidgetProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HelpEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [match, setMatch] = useState<HelpMatch | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const listRef = useRef<HTMLDivElement>(null);

  const filteredFaq = useMemo(() => {
    if (activeCategory === 'all') return HELP_FAQ;
    return HELP_FAQ.filter((f) => f.category === activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HELP_STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
  }, []);

  const saveToHistory = (question: string, answer: string) => {
    const entry: HelpEntry = {
      id: Date.now().toString(),
      question,
      answer,
      at: new Date().toISOString(),
    };
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    try {
      localStorage.setItem(HELP_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const applyMatch = (next: HelpMatch) => {
    setMatch(next);
    saveToHistory(next.userQuestion || next.matchedQuestion || 'Help', next.answer);
  };

  const handleSubmit = () => {
    const q = inputValue.trim();
    if (!q) return;
    applyMatch(getHelpMatch(q));
    setInputValue('');
  };

  const handleNav = (target: HelpNavTarget) => {
    if (target === 'chat') onOpenChat?.();
    else if (target === 'lovefeed') onOpenLoveFeed?.();
    else onNavigate?.(target);
  };

  const navLabel = (target: HelpNavTarget) => HELP_NAV_LINKS.find((l) => l.target === target);

  return (
    <div className="help-widget">
      <div className="help-header">
        <div className="help-header-left">
          <div className="help-avatar">💬</div>
          <div>
            <h1 className="help-title">Help</h1>
            <p className="help-subtitle">Ask anything — highlighted words take you there</p>
          </div>
        </div>
      </div>

      <div className="help-scroll" ref={listRef}>
        {!bannerDismissed && (
          <div className="help-banner">
            <span className="help-banner-icon">🧭</span>
            <span className="help-banner-text">
              Type a question at the bottom. Words like <strong>Communication</strong> and <strong>Settings</strong> light up — tap them to jump there.
            </span>
            <button type="button" className="help-banner-dismiss" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <section className="help-nav-section">
          <h2 className="help-section-title">Go where you need</h2>
          <p className="help-section-hint">Tap a card to open that part of the app.</p>
          <div className="help-nav-grid">
            {HELP_NAV_LINKS.map((link) => (
              <button
                key={link.target}
                type="button"
                className="help-nav-card"
                onClick={() => handleNav(link.target)}
              >
                <span className="help-nav-icon">{link.icon}</span>
                <span className="help-nav-label">{link.label}</span>
                <span className="help-nav-hint">{link.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <button type="button" className="help-link" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Hide' : 'View'} past help questions
        </button>

        {showHistory && (
          <div className="help-history">
            {history.length === 0 ? (
              <p className="help-history-empty">No past questions yet.</p>
            ) : (
              history.map((e) => (
                <div key={e.id} className="help-history-item">
                  <strong>Q:</strong> {e.question}
                  <p>
                    <strong>A:</strong> {e.answer}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        <div className="help-main-card">
          <div className="help-main-heading">
            <span className="help-main-icon">?</span>
            <h2>Questions &amp; answers</h2>
          </div>
          <p className="help-main-hint">Filter by topic or tap any question. Or type your own below.</p>

          <div className="help-category-tabs">
            <button
              type="button"
              className={`help-category-tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All
            </button>
            {HELP_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`help-category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="help-faq-buttons">
            {filteredFaq.map((item, i) => (
              <button key={`${item.category}-${i}`} type="button" className="help-faq-btn" onClick={() => applyMatch(matchFromFaq(item))}>
                <span className="help-faq-cat">{item.category}</span>
                {item.q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="help-ask-dock">
        {match && (
          <div className="help-answer-box">
            <h3>{match.confidence === 'low' ? 'Let me guide you' : 'Answer'}</h3>
            {match.userQuestion && <p className="help-answer-q">You asked: {match.userQuestion}</p>}
            {match.matchedQuestion && match.matchedQuestion !== match.userQuestion && (
              <p className="help-answer-matched">Matched: {match.matchedQuestion}</p>
            )}
            <HelpAnswerRich text={match.answer} onNavigate={handleNav} />
            {match.targets.length > 0 && (
              <div className="help-shortcut-row">
                {match.targets.map((t) => {
                  const link = navLabel(t);
                  return (
                    <button key={t} type="button" className="help-shortcut-chip" onClick={() => handleNav(t)}>
                      <span>{link?.icon}</span>
                      {link?.label || t}
                    </button>
                  );
                })}
              </div>
            )}
            {match.related.length > 0 && (
              <div className="help-related">
                <p>Related</p>
                {match.related.map((faq) => (
                  <button key={faq.q} type="button" className="help-related-btn" onClick={() => applyMatch(matchFromFaq(faq, match.userQuestion))}>
                    {faq.q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="help-input-row">
          <input
            type="text"
            className="help-input"
            placeholder="Ask anything (e.g. unmatch, 24h reply, where is Settings)…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button type="button" className="help-send-btn" onClick={handleSubmit}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
