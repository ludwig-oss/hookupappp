import { useState, useEffect, useRef, useMemo } from 'react';
import {
  HELP_FAQ,
  HELP_CATEGORIES,
  HELP_NAV_LINKS,
  getAnswerForQuestion,
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

export default function HelpWidget({ onOpenChat, onOpenLoveFeed, onNavigate }: HelpWidgetProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HelpEntry[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [reply, setReply] = useState<string | null>(null);
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

  const showAnswer = (q: string, a: string) => {
    setSelectedQuestion(q);
    setSelectedAnswer(a);
    setReply(null);
    saveToHistory(q, a);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleSubmit = () => {
    const q = inputValue.trim();
    if (!q) return;
    const a = getAnswerForQuestion(q);
    setReply(a);
    setSelectedAnswer(null);
    setSelectedQuestion(q);
    setInputValue('');
    saveToHistory(q, a);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleNav = (target: HelpNavTarget) => {
    if (target === 'chat') onOpenChat?.();
    else if (target === 'lovefeed') onOpenLoveFeed?.();
    else onNavigate?.(target);
  };

  return (
    <div className="help-widget">
      <div className="help-header">
        <div className="help-header-left">
          <div className="help-avatar">💬</div>
          <div>
            <h1 className="help-title">Help</h1>
            <p className="help-subtitle">Guide &amp; navigation</p>
          </div>
        </div>
      </div>

      {!bannerDismissed && (
        <div className="help-banner">
          <span className="help-banner-icon">🧭</span>
          <span className="help-banner-text">
            New here? Use <strong>Go where you need</strong> below to jump to any section, or tap a question for full answers on chat rules, meetups, reviews, and safety.
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

      <div className="help-main" ref={listRef}>
        <div className="help-main-card">
          <div className="help-main-heading">
            <span className="help-main-icon">?</span>
            <h2>Questions &amp; answers</h2>
          </div>
          <p className="help-main-hint">Filter by topic or tap any question.</p>

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
              <button key={`${item.category}-${i}`} type="button" className="help-faq-btn" onClick={() => showAnswer(item.q, item.a)}>
                <span className="help-faq-cat">{item.category}</span>
                {item.q}
              </button>
            ))}
          </div>
        </div>

        {(selectedAnswer || reply) && (
          <div className="help-answer-box">
            <h3>{selectedQuestion ? 'Answer' : 'Answer'}</h3>
            {selectedQuestion && <p className="help-answer-q">{selectedQuestion}</p>}
            <p>{selectedAnswer || reply || ''}</p>
          </div>
        )}

        <div className="help-actions">
          <button type="button" className="help-action-btn help-action-primary" onClick={() => onOpenChat?.()}>
            <span className="help-action-icon">◉</span>
            Open Communication
          </button>
          <button type="button" className="help-action-btn" onClick={() => onNavigate?.('profile')}>
            <span className="help-action-icon">👤</span>
            Open Profile
          </button>
          <button type="button" className="help-action-btn" onClick={() => onNavigate?.('settings')}>
            <span className="help-action-icon">⚙️</span>
            Open Settings
          </button>
          <button
            type="button"
            className="help-action-btn"
            onClick={() => showAnswer(HELP_FAQ.find((f) => f.q.includes('report'))!.q, HELP_FAQ.find((f) => f.q.includes('report'))!.a)}
          >
            <span className="help-action-icon">🛡️</span>
            Safety &amp; reporting
          </button>
        </div>

        <div className="help-input-row">
          <input
            type="text"
            className="help-input"
            placeholder="Ask anything (e.g. unmatch review, 24h reply, SOS)…"
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
