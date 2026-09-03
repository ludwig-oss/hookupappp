import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { dateMatchAPI, DateMatch, DateMatchCatalog, LawyerSession, PitchOffer, PublicUserCard } from '../../api/dateMatch';
import { prepareAndUploadFile } from '../../lib/uploadMedia';
import './DateMatchWidget.css';
import './Widget.css';

type View =
  | 'home'
  | 'disclaimer'
  | 'searching'
  | 'versus'
  | 'arena'
  | 'scheduled'
  | 'cancel'
  | 'review'
  | 'lawyer'
  | 'pitch'
  | 'paywall';

function upcomingSlots() {
  const out: { iso: string; label: string }[] = [];
  const hours = [11, 15, 18, 20];
  for (let d = 1; d <= 7; d++) {
    const day = new Date();
    day.setDate(day.getDate() + d);
    day.setMinutes(0, 0, 0);
    for (const h of hours) {
      const t = new Date(day);
      t.setHours(h);
      out.push({
        iso: t.toISOString(),
        label: t.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' }),
      });
    }
  }
  return out.slice(0, 16);
}

function avatar(u?: PublicUserCard | null) {
  return u?.profilePicture || '/default-avatar.png';
}

function iAccepted(m: DateMatch, userId: string) {
  return m.userId1 === userId ? m.user1Accepted : m.user2Accepted;
}

function theyAccepted(m: DateMatch, userId: string) {
  return m.userId1 === userId ? m.user2Accepted : m.user1Accepted;
}

function mySlots(m: DateMatch, userId: string) {
  return m.userId1 === userId ? m.user1FreeSlots : m.user2FreeSlots;
}

export default function DateMatchWidget({
  onOpenChat,
  onOpenGuides,
  onOpenPremium,
}: {
  onOpenChat?: (userId: string) => void;
  onOpenGuides?: () => void;
  onOpenPremium?: () => void;
}) {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<View>('home');
  const [catalog, setCatalog] = useState<DateMatchCatalog | null>(null);
  const [looking, setLooking] = useState<string[]>([]);
  const [match, setMatch] = useState<DateMatch | null>(null);
  const [me, setMe] = useState<PublicUserCard | null>(null);
  const [other, setOther] = useState<PublicUserCard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickedSlots, setPickedSlots] = useState<string[]>([]);
  const [lists, setLists] = useState<{ active: any[]; pending: any[]; past: any[] }>({ active: [], pending: [], past: [] });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelProof, setCancelProof] = useState('');
  const [reviewGoing, setReviewGoing] = useState<boolean | null>(null);
  const [reviewContinue, setReviewContinue] = useState<boolean | null>(null);
  const [recommendGuide, setRecommendGuide] = useState(false);
  const [pitches, setPitches] = useState<{ toWrite: PitchOffer[]; incoming: PitchOffer[] }>({ toWrite: [], incoming: [] });
  const [pitchText, setPitchText] = useState('');
  const [pitchTargets, setPitchTargets] = useState<PublicUserCard[]>([]);
  const [guides, setGuides] = useState<Array<{ id: string; userId: string; name: string; profilePicture: string | null }>>([]);
  const [lawyerSessions, setLawyerSessions] = useState<LawyerSession[]>([]);
  const [lawyerDraft, setLawyerDraft] = useState('');
  const [activeLawyer, setActiveLawyer] = useState<LawyerSession | null>(null);
  const slots = useMemo(() => upcomingSlots(), []);

  const loadAll = async () => {
    const [c, mine, p, sess] = await Promise.all([
      dateMatchAPI.catalog(),
      dateMatchAPI.mine().catch(() => ({ active: [], pending: [], past: [] })),
      dateMatchAPI.pitches().catch(() => ({ toWrite: [], incoming: [] })),
      dateMatchAPI.lawyerSessions().catch(() => ({ sessions: [] })),
    ]);
    setCatalog(c);
    setLists(mine);
    setPitches(p);
    setLawyerSessions(sess.sessions || []);
    if (!looking.length && c.lookingFor[0]) setLooking([c.lookingFor[0].id, c.lookingFor[1]?.id].filter(Boolean));
  };

  useEffect(() => {
    loadAll().catch((e) => setError(e.response?.data?.error || 'Could not load Date Arena'));
  }, []);

  useEffect(() => {
    if (view !== 'searching' && view !== 'versus' && view !== 'arena') return;
    const t = setInterval(() => {
      dateMatchAPI.poll().then((r) => {
        if (r.match) {
          setMatch(r.match);
          setOther(r.other);
          setMe(r.me);
          if (r.match.status === 'picking_idea') setView('arena');
          else if (r.match.status === 'scheduled') setView('scheduled');
          else if (r.match.status === 'awaiting_accept' || r.match.status === 'pending') setView('versus');
        }
      }).catch(() => {});
    }, 3500);
    return () => clearInterval(t);
  }, [view]);

  const applyMatch = (m: DateMatch, o: PublicUserCard | null, mine?: PublicUserCard | null) => {
    setMatch(m);
    setOther(o);
    if (mine) setMe(mine);
    if (m.status === 'picking_idea') setView('arena');
    else if (m.status === 'scheduled') setView('scheduled');
    else if (m.status === 'completed') setView('review');
    else setView('versus');
  };

  const startSearch = async () => {
    setError('');
    setLoading(true);
    setView('searching');
    try {
      const r = await dateMatchAPI.search(looking);
      setCatalog((c) => (c ? { ...c, quota: r.quota } : c));
      if (r.needUpgrade) {
        setView('paywall');
        return;
      }
      if (r.match) applyMatch(r.match, r.other, r.me);
      else {
        setMe(r.me);
        setView('searching');
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Search failed');
      setView('home');
    } finally {
      setLoading(false);
    }
  };

  const saveSlots = async () => {
    if (!match) return;
    setLoading(true);
    try {
      const { match: next } = await dateMatchAPI.setAvailability(match.id, pickedSlots);
      setMatch(next);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not save times');
    } finally {
      setLoading(false);
    }
  };

  const accept = async (yes: boolean) => {
    if (!match) return;
    setLoading(true);
    try {
      const { match: next } = await dateMatchAPI.respond(match.id, yes);
      setMatch(next);
      if (!yes) {
        setView('home');
        loadAll();
        return;
      }
      if (next.status === 'picking_idea') setView('arena');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not respond');
    } finally {
      setLoading(false);
    }
  };

  const spin = async () => {
    if (!match) return;
    setLoading(true);
    try {
      const { match: next } = await dateMatchAPI.spin(match.id);
      setMatch(next);
      setView('scheduled');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not pick a date');
    } finally {
      setLoading(false);
    }
  };

  const submitCancel = async () => {
    if (!match) return;
    setLoading(true);
    try {
      await dateMatchAPI.cancelDate(match.id, cancelReason, cancelProof || undefined);
      setView('home');
      loadAll();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Cancel failed');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (!match || reviewGoing === null || reviewContinue === null) return;
    setLoading(true);
    try {
      const r = await dateMatchAPI.howGoing(match.id, reviewGoing, reviewContinue);
      setRecommendGuide(r.recommendGuide);
      if (r.removed) setError('They did not want to keep talking. The chat was removed.');
      else if (r.continueTalking) setError('');
      setView('home');
      loadAll();
      if (r.recommendGuide) {
        /* stay on home with banner */
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not save');
    } finally {
      setLoading(false);
    }
  };

  const ideasPreview = (catalog?.ideas || []).slice(0, 13);

  return (
    <div className="widget da-root">
      <h2 className="da-title">Date Arena</h2>
      <p className="da-sub">
        Interest level {catalog?.interestLevel ?? '—'}. Higher interest pairs you with people who get more interest too.
        {catalog?.quota.unlimited
          ? ' Unlimited searches.'
          : ` ${catalog?.quota.remaining ?? 0} of ${catalog?.quota.limit ?? 3} free searches left this month.`}
      </p>
      {error && <div className="da-err">{error}</div>}

      {view === 'home' && (
        <>
          {recommendGuide && (
            <div className="da-warn">
              Dates have not been going how you hoped. A guide can help with what to wear, what to talk about, and how to show up.
              <div style={{ marginTop: 8 }}>
                <button type="button" className="da-btn da-btn-gold" onClick={() => onOpenGuides?.()}>Get a guide</button>
              </div>
            </div>
          )}
          {(pitches.toWrite.length > 0 || pitches.incoming.length > 0) && (
            <div className="da-ok">
              You have pitch{pitches.toWrite.length + pitches.incoming.length > 1 ? 'es' : ''} waiting.
              <button type="button" className="da-btn da-btn-ghost" style={{ marginLeft: 8 }} onClick={() => setView('pitch')}>Open</button>
            </div>
          )}
          {lawyerSessions.length > 0 && (
            <div className="da-ok">
              Lawyer room open.
              <button type="button" className="da-btn da-btn-ghost" style={{ marginLeft: 8 }} onClick={() => { setActiveLawyer(lawyerSessions[0]); setView('lawyer'); }}>Join</button>
            </div>
          )}
          <p style={{ fontSize: 13, marginBottom: 8 }}>What are you looking for? Pick at least one.</p>
          <div className="da-row">
            {(catalog?.lookingFor || []).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`da-chip ${looking.includes(opt.id) ? 'on' : ''}`}
                title={opt.hint}
                onClick={() =>
                  setLooking((prev) => (prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]))
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button type="button" className="da-btn da-btn-primary" disabled={!looking.length} onClick={() => setView('disclaimer')}>
            Search for a date
          </button>
          <div className="da-row" style={{ marginTop: 12 }}>
            {catalog?.features.guideLawyer && (
              <button type="button" className="da-btn da-btn-gold" onClick={async () => {
                const g = await dateMatchAPI.lawyerGuides().catch(() => ({ guides: [] }));
                setGuides(g.guides);
                setView('lawyer');
              }}>Summon a guide lawyer</button>
            )}
            {catalog?.features.directPitch && (
              <button type="button" className="da-btn da-btn-plat" onClick={async () => {
                const r = await dateMatchAPI.pitchCandidates().catch(() => ({ users: [] }));
                setPitchTargets(r.users);
                setView('pitch');
              }}>Direct pitch</button>
            )}
            {!catalog?.features.unlimitedSearches && (
              <button type="button" className="da-btn da-btn-ghost" onClick={() => onOpenPremium?.()}>Upgrade for unlimited</button>
            )}
          </div>

          {lists.pending.length > 0 && (
            <>
              <h3 style={{ marginTop: 22, fontSize: 14 }}>Pending (someone is offline)</h3>
              {lists.pending.map((row) => (
                <div key={row.match.id} className="da-list-item">
                  <img src={avatar(row.other)} alt="" />
                  <div>
                    <strong>{row.other?.name || 'Match'}</strong>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Waiting until you are both online</div>
                  </div>
                  <button type="button" className="da-btn da-btn-ghost" onClick={() => applyMatch(row.match, row.other)}>Open</button>
                </div>
              ))}
            </>
          )}
          {lists.active.length > 0 && (
            <>
              <h3 style={{ marginTop: 18, fontSize: 14 }}>Active</h3>
              {lists.active.map((row) => (
                <div key={row.match.id} className="da-list-item">
                  <img src={avatar(row.other)} alt="" />
                  <div style={{ flex: 1 }}>
                    <strong>{row.other?.name || 'Match'}</strong>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{row.match.status}{row.match.ideaTitle ? ` · ${row.match.ideaTitle}` : ''}</div>
                  </div>
                  <button type="button" className="da-btn da-btn-primary" onClick={() => applyMatch(row.match, row.other)}>Continue</button>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {view === 'disclaimer' && (
        <div>
          <div className="da-warn">
            <strong>Before you search</strong>
            <p>You have to appear at the date you get set up for. You cannot back out for convenience. Cancelling without a sick/emergency proof is a €{catalog?.cancellationFineEur ?? 10} fine paid to the other person.</p>
            <p>How much interest you get on the app — including when you are out — decides who you are paired with. Higher interest meets higher interest. Sometimes you will be matched with someone who has more than you.</p>
            <p>Chat stays locked until the day of the date. After the date, both of you choose whether to keep talking.</p>
          </div>
          <button type="button" className="da-btn da-btn-primary" onClick={startSearch}>I understand — find a match</button>
          <button type="button" className="da-btn da-btn-ghost" style={{ marginLeft: 8 }} onClick={() => setView('home')}>Back</button>
        </div>
      )}

      {view === 'searching' && (
        <div className="da-searching">
          <div className="da-radar" />
          <h3>Finding a match…</h3>
          <p className="da-sub">Pairing by interest level and what you are looking for. Stay here — we will put them on pending if they are offline.</p>
          <button type="button" className="da-btn da-btn-ghost" onClick={async () => { await dateMatchAPI.cancelSearch(); setView('home'); }}>Stop searching</button>
        </div>
      )}

      {view === 'versus' && match && (
        <>
          <div className="da-vs">
            <div className="da-panel da-panel-left">
              <img className="da-avatar" src={avatar(me)} alt="" />
              <p className="da-name">{me?.name || user?.name || 'You'}</p>
              <div className={me?.online ? 'da-online' : 'da-offline'}>{me?.online ? 'Online' : 'Pending'}</div>
              <div className="da-badges"><span className="da-badge">★</span><span className="da-badge">♥</span><span className="da-badge">✦</span></div>
            </div>
            <div className="da-mid">
              <div className="da-e-logo">e</div>
              <div className="da-stat">Interest<br />{match.userId1 === user?.id ? match.interest1 : match.interest2}</div>
              <div className="da-stat" style={{ margin: '10px 0' }}>vs</div>
              <div className="da-stat">Interest<br />{match.userId1 === user?.id ? match.interest2 : match.interest1}</div>
            </div>
            <div className="da-panel da-panel-right">
              <img className="da-avatar" src={avatar(other)} alt="" />
              <p className="da-name">{other?.name || 'Match'}</p>
              <div className={other?.online ? 'da-online' : 'da-offline'}>{other?.online ? 'Online' : 'Pending — they will see this when they open Date Arena'}</div>
              <div className="da-badges"><span className="da-badge">★</span><span className="da-badge">♥</span></div>
            </div>
          </div>
          {match.status === 'pending' && <p className="da-sub">This stays on your pending list until you are both online. Then you both Accept.</p>}
          <h3 style={{ fontSize: 14, marginTop: 16 }}>When are you free?</h3>
          <p className="da-sub">Both of you pick times. If one overlaps, that becomes the date window.</p>
          <div className="da-slots">
            {slots.map((s) => (
              <button
                key={s.iso}
                type="button"
                className={`da-slot ${pickedSlots.includes(s.iso) ? 'on' : ''}`}
                onClick={() => setPickedSlots((prev) => prev.includes(s.iso) ? prev.filter((x) => x !== s.iso) : [...prev, s.iso])}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" className="da-btn da-btn-ghost" onClick={saveSlots} disabled={loading || !pickedSlots.length}>Save my times</button>
          {match.agreedSlot && <p className="da-ok">Overlap found: {new Date(match.agreedSlot).toLocaleString()}</p>}
          <p className="da-sub">You accepted: {iAccepted(match, user?.id || '') ? 'yes' : 'not yet'} · They accepted: {theyAccepted(match, user?.id || '') ? 'yes' : 'not yet'}</p>
          <div className="da-row">
            <button type="button" className="da-btn da-btn-primary" disabled={loading || mySlots(match, user?.id || '').length + pickedSlots.length === 0} onClick={() => accept(true)}>Accept date</button>
            <button type="button" className="da-btn da-btn-ghost" onClick={() => accept(false)}>Decline</button>
          </div>
        </>
      )}

      {view === 'arena' && match && (
        <div className="da-arena">
          <div className="da-arena-top">
            <div className="da-arena-fighter">
              <img src={avatar(me)} alt="" />
              <div>{me?.name || 'You'}</div>
            </div>
            <div className="da-arena-fighter">
              <img src={avatar(other)} alt="" />
              <div>{other?.name || 'Them'}</div>
            </div>
          </div>
          <p className="da-sub">Tap ? to roll a fun date neither of you has done — hobbies, good deeds, or cheap eats/drinks you have never tried. Same idea will not repeat for you.</p>
          <div className="da-grid">
            {ideasPreview.map((idea, i) =>
              i === 3 ? (
                <button key="q" type="button" className="da-tile da-tile-q" onClick={spin} disabled={loading}>?</button>
              ) : (
                <div key={idea.id} className="da-tile">{idea.title}</div>
              )
            )}
          </div>
        </div>
      )}

      {view === 'scheduled' && match && (
        <div>
          <div className="da-ok">
            <strong>{match.ideaTitle}</strong>
            <p>{match.ideaDetail}</p>
            {match.scheduledAt && <p>Show up: {new Date(match.scheduledAt).toLocaleString()}</p>}
            <p>You are in Communications, but you cannot text until the day of the date.</p>
          </div>
          <div className="da-warn">
            Before the date, a guide can check what to wear and what to talk about so the night goes better.
            <div style={{ marginTop: 8 }}>
              <button type="button" className="da-btn da-btn-gold" onClick={() => onOpenGuides?.()}>Talk to a guide</button>
            </div>
          </div>
          <div className="da-row">
            {other && <button type="button" className="da-btn da-btn-ghost" onClick={() => onOpenChat?.(other.id)}>Open chat (locked until date day)</button>}
            <button type="button" className="da-btn da-btn-ghost" onClick={() => setView('cancel')}>I cannot make it</button>
            {match.scheduledAt && new Date(match.scheduledAt).getTime() <= Date.now() && (
              <button type="button" className="da-btn da-btn-primary" onClick={() => setView('review')}>We went / how did it go?</button>
            )}
          </div>
          <button type="button" className="da-btn da-btn-ghost" style={{ marginTop: 8 }} onClick={() => setView('home')}>Back</button>
        </div>
      )}

      {view === 'cancel' && match && (
        <div>
          <div className="da-warn">
            Cancelling without proof of sickness or emergency charges €{catalog?.cancellationFineEur ?? 10} to the other person’s withdrawable balance.
          </div>
          <textarea className="da-textarea" placeholder="Why? If sick or emergency, say so and upload proof." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <input
            type="file"
            accept="image/*"
            style={{ margin: '10px 0' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const url = await prepareAndUploadFile(file, 'date-cancel');
                setCancelProof(url);
              } catch (err: any) {
                setError(err.message || 'Upload failed');
              }
            }}
          />
          {cancelProof && <p className="da-ok">Proof uploaded.</p>}
          <div className="da-row">
            <button type="button" className="da-btn da-btn-primary" onClick={submitCancel} disabled={loading || !cancelReason.trim()}>Submit</button>
            <button type="button" className="da-btn da-btn-ghost" onClick={() => setView('scheduled')}>Back</button>
          </div>
        </div>
      )}

      {view === 'review' && match && (
        <div>
          <h3>How did the date go?</h3>
          <div className="da-row">
            <button type="button" className={`da-chip ${reviewGoing === true ? 'on' : ''}`} onClick={() => setReviewGoing(true)}>Going well</button>
            <button type="button" className={`da-chip ${reviewGoing === false ? 'on' : ''}`} onClick={() => setReviewGoing(false)}>Not going well / not enough dates</button>
          </div>
          <h3>Keep talking?</h3>
          <p className="da-sub">Both of you must say yes. If one says no, the chat is removed and they are told.</p>
          <div className="da-row">
            <button type="button" className={`da-chip ${reviewContinue === true ? 'on' : ''}`} onClick={() => setReviewContinue(true)}>Yes, keep chatting</button>
            <button type="button" className={`da-chip ${reviewContinue === false ? 'on' : ''}`} onClick={() => setReviewContinue(false)}>No</button>
          </div>
          <button type="button" className="da-btn da-btn-primary" disabled={reviewGoing === null || reviewContinue === null || loading} onClick={submitReview}>Send</button>
        </div>
      )}

      {view === 'paywall' && (
        <div>
          <div className="da-warn">You used your 3 free Date Arena searches this month. Plus (€68 / month) unlocks unlimited searches, pitch-after-a-no, and other-country interest.</div>
          <button type="button" className="da-btn da-btn-primary" onClick={() => onOpenPremium?.()}>See plans</button>
          <button type="button" className="da-btn da-btn-ghost" style={{ marginLeft: 8 }} onClick={() => setView('home')}>Back</button>
        </div>
      )}

      {view === 'pitch' && (
        <div>
          <button type="button" className="da-btn da-btn-ghost" onClick={() => setView('home')}>← Back</button>
          <h3>Pitch yourself</h3>
          {pitches.toWrite.map((p) => (
            <div key={p.id} className="da-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <strong>Write a pitch to {p.other?.name || 'them'}</strong>
              <textarea className="da-textarea" value={pitchText} onChange={(e) => setPitchText(e.target.value)} placeholder="Why they should give you another look…" />
              <button type="button" className="da-btn da-btn-primary" onClick={async () => {
                await dateMatchAPI.submitPitch(p.id, pitchText);
                setPitchText('');
                const next = await dateMatchAPI.pitches();
                setPitches(next);
              }}>Send pitch</button>
            </div>
          ))}
          {pitches.incoming.map((p) => (
            <div key={p.id} className="da-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <strong>{p.other?.name || 'Someone'} pitched after you passed</strong>
              <p>{p.text}</p>
              <div className="da-row">
                <button type="button" className="da-btn da-btn-primary" onClick={async () => {
                  const r = await dateMatchAPI.respondPitch(p.id, true);
                  if (r.openChat && r.chatUserId) onOpenChat?.(r.chatUserId);
                  const next = await dateMatchAPI.pitches();
                  setPitches(next);
                }}>Accept new offer</button>
                <button type="button" className="da-btn da-btn-ghost" onClick={async () => {
                  await dateMatchAPI.respondPitch(p.id, false);
                  const next = await dateMatchAPI.pitches();
                  setPitches(next);
                }}>Reject</button>
              </div>
            </div>
          ))}
          {catalog?.features.directPitch && (
            <>
              <h3>Platinum — pitch without showing interest</h3>
              {pitchTargets.map((u) => (
                <div key={u.id} className="da-list-item">
                  <img src={avatar(u)} alt="" />
                  <div style={{ flex: 1 }}><strong>{u.name}</strong></div>
                  <button type="button" className="da-btn da-btn-plat" onClick={async () => {
                    await dateMatchAPI.startDirectPitch(u.id);
                    const next = await dateMatchAPI.pitches();
                    setPitches(next);
                  }}>Pitch</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {view === 'lawyer' && (
        <div>
          <button type="button" className="da-btn da-btn-ghost" onClick={() => setView('home')}>← Back</button>
          <h3>Guide lawyer</h3>
          <p className="da-sub">Gold: summon a guide. They hand-pick someone, then pitch you in a 3-person room. If that person says yes, you move to Communications and this room closes. If they say no, last messages then it disappears.</p>
          {!activeLawyer && (
            <>
              {guides.map((g) => (
                <div key={g.userId} className="da-list-item">
                  <img src={g.profilePicture || '/default-avatar.png'} alt="" />
                  <div style={{ flex: 1 }}><strong>{g.name}</strong></div>
                  <button type="button" className="da-btn da-btn-gold" onClick={async () => {
                    const r = await dateMatchAPI.summonLawyer(g.userId);
                    setActiveLawyer(r.session as LawyerSession);
                    const sess = await dateMatchAPI.lawyerSessions();
                    setLawyerSessions(sess.sessions);
                    setActiveLawyer(sess.sessions.find((s) => s.id === r.session.id) || r.session);
                  }}>Summon</button>
                </div>
              ))}
            </>
          )}
          {activeLawyer && activeLawyer.status === 'picking' && user?.id === activeLawyer.guideUserId && (
            <GuidePickPanel
              sessionId={activeLawyer.id}
              onPicked={(s) => setActiveLawyer(s)}
            />
          )}
          {activeLawyer && activeLawyer.status === 'picking' && user?.id !== activeLawyer.guideUserId && (
            <p className="da-sub">Your guide is hand-picking someone. You will get a notification when the room opens.</p>
          )}
          {activeLawyer && activeLawyer.status !== 'picking' && (
            <div>
              <p className="da-sub">Room: you · guide · them. Status: {activeLawyer.status}</p>
              <div style={{ maxHeight: 240, overflow: 'auto', marginBottom: 8 }}>
                {activeLawyer.messages.map((m) => (
                  <div key={m.id} style={{ fontSize: 13, marginBottom: 6 }}>
                    <strong>{m.fromUserId === user?.id ? 'You' : m.fromUserId === activeLawyer.guideUserId ? 'Guide' : 'Them'}:</strong> {m.content}
                  </div>
                ))}
              </div>
              <div className="da-row">
                <input className="da-input" style={{ flex: 1 }} value={lawyerDraft} onChange={(e) => setLawyerDraft(e.target.value)} placeholder="Message" />
                <button type="button" className="da-btn da-btn-ghost" onClick={async () => {
                  const r = await dateMatchAPI.lawyerMessage(activeLawyer.id, lawyerDraft);
                  setLawyerDraft('');
                  setActiveLawyer(r.session as LawyerSession);
                }}>Send</button>
              </div>
              {user?.id === activeLawyer.targetUserId && activeLawyer.status === 'pitching' && (
                <div className="da-row" style={{ marginTop: 10 }}>
                  <button type="button" className="da-btn da-btn-primary" onClick={async () => {
                    const r = await dateMatchAPI.lawyerRespond(activeLawyer.id, true);
                    if (r.openChat && r.chatUserId) onOpenChat?.(r.chatUserId);
                    setView('home');
                  }}>Accept date</button>
                  <button type="button" className="da-btn da-btn-ghost" onClick={async () => {
                    const r = await dateMatchAPI.lawyerRespond(activeLawyer.id, false);
                    setActiveLawyer(r.session as LawyerSession);
                  }}>Decline</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GuidePickPanel({ sessionId, onPicked }: { sessionId: string; onPicked: (s: LawyerSession) => void }) {
  const [users, setUsers] = useState<PublicUserCard[]>([]);
  const [client, setClient] = useState<PublicUserCard | null>(null);
  useEffect(() => {
    dateMatchAPI.lawyerCandidates(sessionId).then((r) => {
      setUsers(r.users);
      setClient(r.client);
    }).catch(() => {});
  }, [sessionId]);
  return (
    <div>
      <p className="da-sub">Hand-pick a date for {client?.name || 'your client'}.</p>
      {users.map((u) => (
        <div key={u.id} className="da-list-item">
          <img src={avatar(u)} alt="" />
          <div style={{ flex: 1 }}>
            <strong>{u.name}</strong>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Interest {u.interestLevel}</div>
          </div>
          <button
            type="button"
            className="da-btn da-btn-gold"
            onClick={async () => {
              const r = await dateMatchAPI.lawyerPick(sessionId, u.id);
              onPicked(r.session);
            }}
          >
            Pick
          </button>
        </div>
      ))}
    </div>
  );
}
