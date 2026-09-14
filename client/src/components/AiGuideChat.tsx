import { useEffect, useRef, useState } from 'react';
import { aiGuidesAPI, type AiGuideCharacter, type AiLesson } from '../api/aiGuides';
import { speakGuideLine } from '../lib/aiGuideSpeech';
import './AiGuideChat.css';

type Msg = { id: string; from: 'guide' | 'me'; text: string };

function stripRoleplay(text: string) {
  return text.replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
}

function greetingFor(guide: AiGuideCharacter) {
  const first = guide.name.split(' ')[0];
  const warm = (guide.ratings?.warmth ?? 5) >= 6;
  if (warm) {
    return `Hey — it's ${first}. How's your day going? What's on your mind? Talk or type. I'm here.`;
  }
  return `Hey. ${first} here. What's the real situation — say it straight. I'm listening.`;
}

export default function AiGuideChat({
  guide,
  lesson: _lesson,
  onBack,
  onSpeaking,
  onOpenFashion,
  onOpenAppearance,
  onOpenTopic,
  onClose,
}: {
  guide: AiGuideCharacter;
  lesson?: AiLesson | null;
  onBack: () => void;
  onSpeaking: (on: boolean) => void;
  onOpenFashion?: () => void;
  onOpenAppearance?: () => void;
  onOpenTopic?: (topicId: string) => void;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(() => [
    { id: 'g0', from: 'guide', text: greetingFor(guide) },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [callOn, setCallOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [clarify, setClarify] = useState<{ id: string; title: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const guideRef = useRef(guide);
  guideRef.current = guide;

  useEffect(() => {
    setMessages([{ id: `g-${guide.id}`, from: 'guide', text: greetingFor(guide) }]);
    setDraft('');
    setCallOn(false);
    setClarify([]);
  }, [guide.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, callOn, clarify]);

  useEffect(() => {
    const first = messages[0];
    if (!first || first.from !== 'guide') return;
    void speakGuideLine(guide.voice, first.text, () => onSpeaking(true), () => onSpeaking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.id]);

  const speak = (text: string) => {
    void speakGuideLine(guide.voice, text, () => onSpeaking(true), () => onSpeaking(false));
  };

  const replyAsGuide = async (userText: string) => {
    setBusy(true);
    setClarify([]);
    try {
      const history = messages.slice(-12).map((m) => ({
        from: (m.from === 'me' ? 'me' : 'guide') as 'me' | 'guide',
        text: m.text,
      }));
      const turn = await aiGuidesAPI.chat(guideRef.current.id, userText, history);
      const text = stripRoleplay(turn.reply || 'Say that again in one sentence.');
      setMessages((prev) => [...prev, { id: `g-${Date.now()}`, from: 'guide', text }]);
      if (turn.mode === 'clarify' && turn.clarifyOptions?.length) {
        setClarify(turn.clarifyOptions);
      }
      speak(text);
    } catch {
      const fallback = `Hey — say that again shorter. One sentence. What's actually going on?`;
      setMessages((prev) => [...prev, { id: `g-${Date.now()}`, from: 'guide', text: fallback }]);
      speak(fallback);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, from: 'me', text }]);
    await replyAsGuide(text);
  };

  const pickClarify = async (opt: { id: string; title: string }) => {
    setClarify([]);
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, from: 'me', text: opt.title }]);
    if (onOpenTopic && ['fashion', 'appearance', 'hair', 'intimacy-flow'].includes(opt.id)) {
      onOpenTopic(opt.id);
    }
    await replyAsGuide(opt.title);
  };

  const stopMic = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* */
    }
    recRef.current = null;
    setListening(false);
  };

  const startMic = () => {
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    stopMic();
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const said = ev.results?.[0]?.[0]?.transcript || '';
      if (said.trim()) {
        setDraft(said.trim());
        setMessages((prev) => [...prev, { id: `m-${Date.now()}`, from: 'me', text: said.trim() }]);
        void replyAsGuide(said.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  type SpeechRec = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: ((ev: { error?: string }) => void) | null;
    start: () => void;
    stop: () => void;
  };

  return (
    <div className={`ai-chat${callOn ? ' is-call' : ''}`}>
      <header className="ai-chat-head">
        <button type="button" className="ai-chat-back" onClick={onBack}>
          ← Back
        </button>
        <img src={guide.portrait} alt="" />
        <div>
          <strong>{guide.name}</strong>
          <em>{guide.specialty}</em>
        </div>
        <div className="ai-chat-modes">
          {(guide.desk === 'fashion' || guide.id === 'elena') && onOpenFashion && (
            <button type="button" onClick={onOpenFashion}>
              Outfits
            </button>
          )}
          {(guide.desk === 'appearance' || guide.desk === 'hair' || guide.id === 'elena') && onOpenAppearance && (
            <button type="button" onClick={onOpenAppearance}>
              Face
            </button>
          )}
          <button type="button" className={!callOn ? 'is-on' : ''} onClick={() => setCallOn(false)}>
            Text
          </button>
          <button
            type="button"
            className={callOn ? 'is-on' : ''}
            onClick={() => {
              setCallOn(true);
              speak(`Hey — it's ${guide.name.split(' ')[0]}. How's your day? Talk to me.`);
            }}
          >
            Voice call
          </button>
          {onClose && (
            <button type="button" className="ai-chat-close" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </header>

      {callOn ? (
        <div className="ai-chat-call">
          <img src={guide.portrait} alt="" className="ai-chat-call-face" />
          <p>{listening ? 'Listening…' : busy ? 'Thinking…' : 'On call — tap mic and talk'}</p>
          <div className="ai-chat-call-actions">
            <button type="button" className={listening ? 'is-on' : ''} onClick={listening ? stopMic : startMic}>
              {listening ? 'Stop' : 'Mic'}
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                stopMic();
                setCallOn(false);
                if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
                onSpeaking(false);
              }}
            >
              End call
            </button>
          </div>
        </div>
      ) : (
        <div className="ai-chat-thread" role="log">
          {messages.map((m) => (
            <div key={m.id} className={`ai-chat-bubble ${m.from === 'me' ? 'is-me' : 'is-guide'}`}>
              {m.from === 'guide' && <img src={guide.portrait} alt="" />}
              <p>{m.text}</p>
            </div>
          ))}
          {clarify.length > 0 && (
            <div className="ai-chat-clarify">
              <span>Which one?</span>
              {clarify.map((c) => (
                <button key={c.id} type="button" disabled={busy} onClick={() => void pickClarify(c)}>
                  {c.title}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {!callOn && (
        <form
          className="ai-chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <button type="button" className={listening ? 'is-on' : ''} onClick={listening ? stopMic : startMic} title="Voice">
            {listening ? '■' : '🎤'}
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${guide.name.split(' ')[0]}…`}
            disabled={busy}
          />
          <button type="submit" disabled={busy || draft.trim().length < 1}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
