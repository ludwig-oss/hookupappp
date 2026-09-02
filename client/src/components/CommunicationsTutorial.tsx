import { useEffect, useState } from 'react';
import './CommunicationsTutorial.css';

const STORAGE_KEY = 'aswp_comms_tutorial_v1';

export function commsTutorialSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markCommsTutorialSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

const STEPS = [
  {
    title: 'Welcome to Communications',
    body: 'This is where your chats live. Matches, friends, and people you are getting to know all show up here. Reply within 24 hours or the match can end.',
  },
  {
    title: 'Organize your chats',
    body: 'Scroll the tabs at the top: Serious relationship, Casual, and Friends. Each conversation can live in one of those lists so you are not mixing dating goals.',
  },
  {
    title: 'Set it on the conversation',
    body: 'Open a chat and tap Serious, Casual, or Friends under their name. Only you see this label — it is how you sort them, not a public profile.',
  },
  {
    title: 'How the rest of the app works',
    body: 'Home tiles: Profile is you. Connections is people nearby. Compatibility is expert guides. Events is going out. Safety shield is your secret word and false-alarm button. Love Life Feed is posts. Confession Booth is anonymous talks.',
  },
  {
    title: 'Dates & staying safe',
    body: 'If you plan to meet, the app will ask what you are wearing (just in case), and you can arm the safety shield. Shout your secret word on this device to send a signal. False alarm is a button that tells everyone who got the alert.',
  },
];

export default function CommunicationsTutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const finish = () => {
    markCommsTutorialSeen();
    onDone();
  };

  return (
    <div className="comms-tut-overlay" role="dialog" aria-labelledby="comms-tut-title">
      <div className="comms-tut-card">
        <p className="comms-tut-step">
          {step + 1} / {STEPS.length}
        </p>
        <h3 id="comms-tut-title">{current.title}</h3>
        <p>{current.body}</p>
        <div className="comms-tut-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="comms-tut-actions">
          {step > 0 && (
            <button type="button" className="comms-tut-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          <button type="button" className="comms-tut-skip" onClick={finish}>
            Skip
          </button>
          <button
            type="button"
            className="comms-tut-next"
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
          >
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
