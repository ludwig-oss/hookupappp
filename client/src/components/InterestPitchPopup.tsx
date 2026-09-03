import { useEffect, useState } from 'react';
import { dateMatchAPI, PitchOffer } from '../api/dateMatch';

export default function InterestPitchPopup({
  onOpenChat,
}: {
  onOpenChat?: (userId: string) => void;
}) {
  const [toWrite, setToWrite] = useState<PitchOffer[]>([]);
  const [incoming, setIncoming] = useState<PitchOffer[]>([]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  const refresh = () => {
    dateMatchAPI
      .pitches()
      .then((r) => {
        setToWrite(r.toWrite);
        setIncoming(r.incoming);
        if (r.toWrite.length || r.incoming.length) setOpen(true);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
    const onPitch = () => refresh();
    window.addEventListener('date-pitch:update', onPitch);
    return () => window.removeEventListener('date-pitch:update', onPitch);
  }, []);

  if (!open || (!toWrite.length && !incoming.length)) return null;

  const firstWrite = toWrite[0];
  const firstIn = incoming[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          background: '#161018',
          color: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(255,143,171,0.4)',
          padding: 18,
        }}
      >
        {firstWrite && (
          <>
            <h3 style={{ marginTop: 0 }}>They passed — pitch yourself</h3>
            <p style={{ fontSize: 13, color: '#d1d5db' }}>
              {firstWrite.other?.name || 'They'} declined. Plus lets you send one pitch. They will read it and accept or reject.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Who you are, why a date with you is worth it…"
              style={{ width: '100%', minHeight: 90, borderRadius: 8, padding: 10, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="select-user-btn"
                onClick={async () => {
                  await dateMatchAPI.submitPitch(firstWrite.id, text);
                  setText('');
                  refresh();
                  setOpen(false);
                }}
              >
                Send pitch
              </button>
              <button type="button" className="back-btn" onClick={() => setOpen(false)}>Later</button>
            </div>
          </>
        )}
        {!firstWrite && firstIn && (
          <>
            <h3 style={{ marginTop: 0 }}>New offer from {firstIn.other?.name || 'someone'}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.5 }}>{firstIn.text}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="select-user-btn"
                onClick={async () => {
                  const r = await dateMatchAPI.respondPitch(firstIn.id, true);
                  setOpen(false);
                  if (r.openChat && r.chatUserId) onOpenChat?.(r.chatUserId);
                }}
              >
                Accept new offer
              </button>
              <button
                type="button"
                className="back-btn"
                onClick={async () => {
                  await dateMatchAPI.respondPitch(firstIn.id, false);
                  refresh();
                  setOpen(false);
                }}
              >
                Reject
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
