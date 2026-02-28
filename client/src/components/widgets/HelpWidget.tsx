import { useState, useEffect, useRef } from 'react';
import './HelpWidget.css';

const HELP_STORAGE_KEY = 'help_history';

interface HelpEntry {
  id: string;
  question: string;
  answer: string;
  at: string;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How does the whole app work?',
    a: 'The app is your home for dating and connections. From the home screen you open cards: Profile (edit your info), Activity Stream (find people by country/city), Compatibility (guides and improvement sessions), Connections (nearby users and venues), Highlights (spin wheel games), Love Life Feed (posts and community), Communication (chat), Events (create or join meetups), Help (this), and Settings (language, safety, account). Set your country and city in Profile first so others can find you. Send interests from Activity Stream or the wheel games; when someone accepts, chat in Communication.',
  },
  {
    q: 'How do I get started?',
    a: 'After sign-up, complete Profile setup and set your country and city. Then open Activity Stream, confirm your region, and tap "See active users in this region" to find people. You can also try the Highlights spin wheel for fun games that match you with others. Use Communication to chat once you’ve sent or accepted an interest.',
  },
  {
    q: 'How do I edit my profile?',
    a: 'Tap the Profile card on the home screen (or the PROFILE button at the bottom). There you can change your photo, age, country, city, and add or remove highlights. Changes save automatically when you edit the fields. For more options (bio, preferences, visibility), go to Settings.',
  },
  {
    q: 'How do I find people in my region?',
    a: 'Open Activity Stream from the home screen. Search and select your country (and optionally city), then tap "Confirm region". After that, tap "See active users in this region" to view people near you. Make sure your own country and city are set in Profile so others can find you too.',
  },
  {
    q: 'How does the Love Life Feed work?',
    a: 'Love Life Feed shows posts about dating, relationships, and marriage. Tap the heart (♥) widget on home. You can read posts, like them, comment, or share to Communication. Tap "+ Post" to create your own post with a statement or image. Posts are ordered by engagement so popular and recent content appears first.',
  },
  {
    q: 'How do I chat with someone?',
    a: 'Open Communication (◉) from the home screen. You’ll see your conversations. Tap a chat to open it, or use Activity Stream or Love Life Feed to send interest and then chat once you’re connected. You can also open Communication from the bottom bar anytime.',
  },
  {
    q: 'How do I send or receive interests?',
    a: 'In Activity Stream, after you confirm your region and tap "See active users in this region", you’ll see a list of people. Tap "Send interest" on someone’s card to send an interest. To see who sent you interests, tap "View received interests". From there you can accept or decline and start chatting.',
  },
  {
    q: 'How do I change my language?',
    a: 'Go to Settings (⚙️) from the home screen, then open the "Accessibility & Appearance" tab. Use the "Language" dropdown to choose your preferred language. The app will update immediately. You can also open Settings from your Profile page.',
  },
  {
    q: 'How do I add or remove highlights?',
    a: 'On the Profile page, scroll to the HIGHLIGHTS section. Tap the "+" on an existing highlight to add more items, or tap the empty "Add Highlight" card to create a new one. To delete a highlight, use the × button on the highlight card on your Profile (not in the Highlights widget on home).',
  },
  {
    q: 'What is the green "Photo verified" badge?',
    a: 'To reduce catfishing, after you upload a profile photo we ask you to verify it\'s really you. You take a quick selfie scan (look left, at camera, then right). Once verified, a green "✓ Photo verified" badge appears on your profile and next to your name in Activity Stream so others know your photos are verified. If you change your profile picture, you\'ll need to verify again.',
  },
  {
    q: 'What is the spin wheel in Highlights?',
    a: 'The spin wheel picks one of 6 mini-games to play with other users in your region. Tap the wheel to spin; when it stops you’ll play that game (e.g. Blind Date, Picture Pick, Lucky Like). You need other people in your country/city to play—if there’s no one, you’ll see “No other users to play with yet.”',
  },
  {
    q: 'What is Compatibility (⚡)?',
    a: 'Compatibility lets you browse guides and book improvement sessions (e.g. video calls) to work on yourself. You can search by category, see recommended guides, send requests, and pay for sessions. Your bookings and requests appear in the widget.',
  },
  {
    q: 'What is Connections (▣)?',
    a: 'Connections shows who’s nearby (when you allow location) and lets you discover users at venues (cafés, parks, etc.). You can “buzz” to show interest to people near you or at a place. Enable location so others can see you too.',
  },
  {
    q: 'What are Events (📅)?',
    a: 'Events are meetups you can create or join. Open Events, filter by city, and browse. Create an event with a title, type, and details. Others can send requests to join; you approve them and can chat and share meetup details. Always meet in a public place first.',
  },
  {
    q: 'How do I use Settings?',
    a: 'Open Settings from the home screen (⚙️). You’ll find: profile and preferences, privacy, notifications, filters, verification, Reports & Blocking (block or report users), Accessibility & Appearance (language, theme, font size), and account (password). Changes save when you update them.',
  },
  {
    q: 'How does Blind Date work?',
    a: 'You’re matched with one random person from your area. You get a short “call” with conversation prompts (e.g. “They said: I love hiking”) and a timer. When time’s up you answer “Do you think they’re a match?” — Yes or No. If you both say Yes, you can reveal who they are and send a connection request to chat in Communication.',
  },
  {
    q: 'How does Picture Pick work?',
    a: 'You see 5 cards with vibe hints (e.g. Night owl, Loves travel). Pick the vibe that calls to you; we reveal that person from your region. You can send them a connection request and optionally “See who you missed.” If they accept, chat in Communication.',
  },
  {
    q: 'How does Compatibility Rush work?',
    a: 'We show a “chemistry” percentage building up, then reveal one person from your area with a match score. You have a short countdown to decide: “Yes, send request” or “Pass.” If you send a request and they accept, you can chat in Communication.',
  },
  {
    q: 'How does Lucky Like work?',
    a: 'One random profile is shown blurred. You get one “peek” at a hint (e.g. “They have a dog”), then choose Like or Pass. If you Like, a connection request is sent and you see who it was. If you Pass, spin again for another chance.',
  },
  {
    q: 'How does Speed Pick work?',
    a: 'You see 3 people from your area; a 5-second countdown runs and the cards shake. Pick one before time runs out—or we pick for you. Then send them a connection request. If they accept, chat in Communication.',
  },
  {
    q: 'How does Mystery Message work?',
    a: 'You get one random user from your area (anonymous). You pick a one-liner (e.g. “The wheel chose you!”) to send with your connection request. If they accept, you’ll see them in Communication and can chat.',
  },
  {
    q: 'How do I report or block someone?',
    a: 'Go to Settings → Reports & Blocking to see blocked users, unblock, or report a user. In Communication (chat), open the conversation and use the menu (⋮) to block that user. Blocking and reporting help keep the app safe.',
  },
  {
    q: 'Where can I get relationship advice?',
    a: 'Check the Love Life Feed for posts and tips about dating and relationships. You can also use Compatibility to see how you match with others. The app is designed to inform, warn, and educate around love and relationships.',
  },
];

function getAnswerForQuestion(input: string): string {
  const lower = input.toLowerCase().trim();
  for (const faq of FAQ) {
    if (faq.q.toLowerCase().includes(lower) || lower.includes(faq.q.toLowerCase().slice(0, 20))) return faq.a;
  }
  const reportIdx = FAQ.findIndex((f) => f.q.toLowerCase().includes('report'));
  const keywords: [RegExp, string][] = [
    [/how does the (whole )?app work|overview|getting started|get started/i, FAQ[0].a],
    [/get started|getting started|start using/i, FAQ[1].a],
    [/profile|edit (my )?profile|photo|age|country|city/i, FAQ[2].a],
    [/region|activity|stream|find people|location/i, FAQ[3].a],
    [/love life|feed|post/i, FAQ[4].a],
    [/chat|message|talk|communication/i, FAQ[5].a],
    [/interest|send|receive|match/i, FAQ[6].a],
    [/language|translate|english|spanish/i, FAQ[7].a],
    [/highlight|story/i, FAQ[8].a],
    [/photo verified|verify photo|catfish|selfie verification|green badge/i, FAQ[9].a],
    [/wheel|spin/i, FAQ[10].a],
    [/compatibility (widget|⚡)|guides|improvement sessions/i, FAQ[11].a],
    [/connections|▣|nearby|venues|buzz/i, FAQ[12].a],
    [/events|📅|meetup|create event/i, FAQ[13].a],
    [/settings|⚙️|preferences|accessibility/i, FAQ[14].a],
    [/blind date/i, FAQ[15].a],
    [/picture pick|pick a card|vibe/i, FAQ[16].a],
    [/compatibility rush/i, FAQ[17].a],
    [/lucky like/i, FAQ[18].a],
    [/speed pick/i, FAQ[19].a],
    [/mystery message/i, FAQ[20].a],
    [/report|block|safety/i, reportIdx >= 0 ? FAQ[reportIdx].a : FAQ[21].a],
    [/advice|relationship|dating|marriage/i, FAQ[FAQ.length - 1].a],
  ];
  for (const [re, ans] of keywords) {
    if (re.test(lower)) return ans;
  }
  return "We've saved your question. Tap \"How does the whole app work?\" above for an overview, or try: how to get started, edit profile, find people in my region, chat, Love Life Feed, wheel games, Events, or Settings.";
}

export default function HelpWidget({ onOpenChat, onOpenLoveFeed }: { onOpenChat?: () => void; onOpenLoveFeed?: () => void }) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HelpEntry[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const handleFaqClick = (q: string, a: string) => {
    setSelectedAnswer(a);
    setReply(null);
    saveToHistory(q, a);
    listRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = () => {
    const q = inputValue.trim();
    if (!q) return;
    const a = getAnswerForQuestion(q);
    setReply(a);
    setSelectedAnswer(null);
    setInputValue('');
    saveToHistory(q, a);
    listRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="help-widget">
      <div className="help-header">
        <div className="help-header-left">
          <div className="help-avatar">💬</div>
          <div>
            <h1 className="help-title">Help</h1>
            <p className="help-subtitle">Here for you</p>
          </div>
        </div>
      </div>

      {!bannerDismissed && (
        <div className="help-banner">
          <span className="help-banner-icon">💡</span>
          <span className="help-banner-text">Tip: Set your country and city in Profile so others can find you in Activity Stream.</span>
          <button type="button" className="help-banner-dismiss" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">×</button>
        </div>
      )}

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
                <p><strong>A:</strong> {e.answer}</p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="help-main" ref={listRef}>
        <div className="help-main-card">
          <div className="help-main-heading">
            <span className="help-main-icon">?</span>
            <h2>Have questions about the following?</h2>
          </div>
          <p className="help-main-hint">Tap a question for an answer.</p>
          <div className="help-faq-buttons">
            {FAQ.map((item, i) => (
              <button
                key={i}
                type="button"
                className="help-faq-btn"
                onClick={() => handleFaqClick(item.q, item.a)}
              >
                {item.q}
              </button>
            ))}
          </div>
        </div>

        {(selectedAnswer || reply) && (
          <div className="help-answer-box">
            <h3>Answer</h3>
            <p>{(selectedAnswer || reply) || ''}</p>
          </div>
        )}

        <div className="help-actions">
          <button type="button" className="help-action-btn help-action-primary" onClick={() => onOpenChat?.()}>
            <span className="help-action-icon">💬</span>
            Chat now
          </button>
          <button type="button" className="help-action-btn" onClick={() => onOpenLoveFeed?.()}>
            <span className="help-action-icon">♥</span>
            Love Life Feed
          </button>
          <button type="button" className="help-action-btn" onClick={() => { const faq = FAQ.find(f => f.q.toLowerCase().includes('report')); if (faq) handleFaqClick(faq.q, faq.a); }}>
            <span className="help-action-icon">🛡️</span>
            Safety &amp; reporting
          </button>
        </div>

        <div className="help-input-row">
          <input
            type="text"
            className="help-input"
            placeholder="Enter your question here"
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
