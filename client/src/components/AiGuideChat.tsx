import { useEffect, useRef, useState } from 'react';
import { aiGuidesAPI, type AiGuideCharacter, type AiLesson } from '../api/aiGuides';
import { speakGuideLine } from '../lib/aiGuideSpeech';
import './AiGuideChat.css';

type Msg = { id: string; from: 'guide' | 'me'; text: string };

function stripRoleplay(text: string) {
  return text.replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
}

function greetingFor(guide: AiGuideCharacter, lesson?: AiLesson | null) {
  if (lesson?.reply) return stripRoleplay(lesson.reply).slice(0, 420);
  const hook = guide.charStyle?.catchphrases?.[0] || guide.tagline;
  return `${hook} What's on your mind — money, dating, style, or something else? Talk or type. I'm listening.`;
}

export default function AiGuideChat({
  guide,
  lesson,
  onBack,
  onSpeaking,
}: {
  guide: AiGuideCharacter;
  lesson?: AiLesson | null;
  onBack: () => void;
  onSpeaking: (on: boolean) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(() => [
    { id: 'g0', from: 'guide', text: greetingFor(guide, lesson) },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [callOn, setCallOn] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const guideRef = useRef(guide);
  guideRef.current = guide;

  useEffect(() => {
    setMessages([{ id: `g-${guide.id}`, from: 'guide', text: greetingFor(guide, lesson) }]);
    setDraft('');
    setCallOn(false);
  }, [guide.id, lesson?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, callOn]);

  useEffect(() => {
    const first = messages[0];
    if (!first || first.from !== 'guide') return;
    void speakGuideLine(guide.voice, first.text, () => onSpeaking(true), () => onSpeaking(false));
    // only on guide switch / first greet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.id]);

  const speak = (text: string) => {
    void speakGuideLine(guide.voice, text, () => onSpeaking(true), () => onSpeaking(false));
  };

  const replyAsGuide = async (userText: string) => {
    setBusy(true);
    try {
      const guess = await aiGuidesAPI.interpret(userText);
      let text = '';
      if (guess.guess?.id) {
        const r = await aiGuidesAPI.lesson(guess.guess.id, guide.id);
        text = stripRoleplay(r.lesson.reply || `${r.lesson.solution} ${r.lesson.unknown}`);
      } else {
        const hook = guide.charStyle?.catchphrases?.[0] || guide.tagline;
        text = `${hook} I hear you. Give me one concrete detail — numbers, what they said, or what you want next — and I'll give you the next move.`;
      }
      setMessages((prev) => [...prev, { id: `g-${Date.now()}`, from: 'guide', text }]);
      if (callOn) speak(text);
      else speak(text);
    } catch {
      const fallback = `${guide.tagline} Say that again shorter — one sentence.`;
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
          ← Crew
        </button>
        <img src={guide.portrait} alt="" />
        <div>
          <strong>{guide.name}</strong>
          <em>{guide.specialty}</em>
        </div>
        <div className="ai-chat-modes">
          <button type="button" className={!callOn ? 'is-on' : ''} onClick={() => setCallOn(false)}>
            Text
          </button>
          <button
            type="button"
            className={callOn ? 'is-on' : ''}
            onClick={() => {
              setCallOn(true);
              speak(`Hey — it's ${guide.name.split(' ')[0]}. Talk to me.`);
            }}
          >
            Voice call
          </button>
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
