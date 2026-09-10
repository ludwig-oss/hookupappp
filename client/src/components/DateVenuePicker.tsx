import { useEffect, useState } from 'react';
import { safetyAPI, DateVenueProposal } from '../api/safety';
import { readStoredCoords } from '../lib/locationSession';

interface DateVenuePickerProps {
  otherUserId: string;
  userId: string;
  onAgreed: (venueName: string) => void;
  meetCity?: string;
  meetCountry?: string;
}

const DateVenuePicker = ({ otherUserId, userId, onAgreed, meetCity, meetCountry }: DateVenuePickerProps) => {
  const [proposal, setProposal] = useState<DateVenueProposal | null>(null);
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [voting, setVoting] = useState(false);
  const [shuffleNote, setShuffleNote] = useState('');

  const load = async (refresh = false) => {
    setLoading(true);
    setShuffleNote('');
    try {
      const stored = readStoredCoords();
      const data = await safetyAPI.getDateVenueProposal(otherUserId, refresh, {
        city: meetCity,
        country: meetCountry,
        lat: stored?.lat,
        lon: stored?.lon,
      });
      setProposal(data.proposal);
      setRules(data.rules);
      if (data.proposal.agreedVenue) {
        onAgreed(data.proposal.agreedVenue.name);
      } else if (refresh && data.autoPicked) {
        onAgreed(data.autoPicked.name);
        setShuffleNote(
          `Shuffled near ${data.proposal.meetLabel || meetCity || 'your area'} — your pick: ${data.autoPicked.name}. They still need to pick the same spot to lock it.`
        );
      }
    } catch {
      setProposal(null);
      setShuffleNote('Could not shuffle places. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [otherUserId]);

  const handleVote = async (venueId: string) => {
    setVoting(true);
    try {
      const { proposal: next } = await safetyAPI.voteDateVenue(otherUserId, venueId);
      setProposal(next);
      if (next.agreedVenue) onAgreed(next.agreedVenue.name);
      else {
        const mine = userId === next.userA ? next.userAChoiceId : next.userBChoiceId;
        const picked = next.venues.find((v) => v.id === mine);
        if (picked) onAgreed(picked.name);
      }
    } finally {
      setVoting(false);
    }
  };

  const myChoiceId =
    proposal && userId === proposal.userA ? proposal.userAChoiceId : proposal?.userBChoiceId;
  const theirChoiceId =
    proposal && userId === proposal.userA ? proposal.userBChoiceId : proposal?.userAChoiceId;

  const venues = (proposal?.venues || []).filter(
    (v) =>
      !filter.trim() ||
      v.name.toLowerCase().includes(filter.toLowerCase()) ||
      v.type.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <p className="date-venue-loading">Loading public date spots…</p>;

  if (proposal?.status === 'agreed' && proposal.agreedVenue) {
    return (
      <div className="date-venue-agreed">
        <strong>Agreed spot:</strong> {proposal.agreedVenue.name}
        <p>{proposal.agreedVenue.description}</p>
        <p className="date-venue-cost">{proposal.agreedVenue.estimatedCost} — {proposal.agreedVenue.splitBillNote}</p>
      </div>
    );
  }

  return (
    <div className="date-venue-picker">
      <p className="date-venue-rules">{rules}</p>
      <p className="date-venue-vote-hint">
        Pick one place below. When you both pick the <strong>same</strong> option, it&apos;s locked in. No restaurants or cinemas.
      </p>
      {myChoiceId && <p className="date-venue-your-vote">Your pick submitted — waiting for match.</p>}
      {theirChoiceId && !myChoiceId && <p className="date-venue-their-vote">They picked a spot — choose yours too.</p>}
      {shuffleNote && (
        <p className="date-venue-your-vote" style={{ color: '#00d4ff' }}>{shuffleNote}</p>
      )}
      <input
        type="search"
        className="chat-meetup-input"
        placeholder="Filter spots…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <button type="button" className="chat-send-btn" style={{ width: '100%', marginBottom: 8, color: '#fff' }} onClick={() => load(true)} disabled={loading || voting}>
        {loading ? 'Shuffling…' : 'Shuffle & pick a place for us'}
      </button>
      <p className="date-venue-scroll-hint">Uses real places near your city when available. Scroll for more options.</p>
      <div
        className="date-venue-list"
        onWheel={(e) => e.stopPropagation()}
      >
        {venues.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`date-venue-item ${myChoiceId === v.id ? 'selected' : ''} ${theirChoiceId === v.id ? 'their-pick' : ''}`}
            onClick={() => handleVote(v.id)}
            disabled={voting}
          >
            <span className="date-venue-type">{v.type}</span>
            <strong className="date-venue-name">{v.name}</strong>
            <span className="date-venue-desc">{v.description}</span>
            <span className="date-venue-cost">{v.estimatedCost} · {v.splitBillNote}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DateVenuePicker;
