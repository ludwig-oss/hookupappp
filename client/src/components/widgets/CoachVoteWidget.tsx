import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { coachVoteAPI, CoachVoteCampaign, CoachVoteStatusResponse } from '../../api/improvement';
import './Widget.css';

const TAG_LABELS: Record<string, string> = {
  photos: 'Photos / presentation',
  style: 'Style & grooming',
  confidence: 'Confidence',
  communication: 'Communication vibe',
  authenticity: 'Authenticity',
};

export default function CoachVoteWidget() {
  const { user } = useContext(AuthContext);
  const [pending, setPending] = useState<CoachVoteCampaign[]>([]);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [myStatus, setMyStatus] = useState<CoachVoteStatusResponse | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!user?.id) return;
    setError('');
    try {
      const [p, s] = await Promise.all([coachVoteAPI.getPending(), coachVoteAPI.getMyStatus()]);
      setPending(p.campaigns || []);
      setFeedbackTags(p.feedbackTags || []);
      setMyStatus(s);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not load coach votes');
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const submitVote = async (campaignId: string, vote: 'baddie' | 'not') => {
    setLoading(true);
    setError('');
    try {
      const res = await coachVoteAPI.vote(campaignId, vote, vote === 'not' ? selectedTags : undefined);
      setMessage(res.message || 'Vote recorded');
      setSelectedTags([]);
      await load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Vote failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  if (!user?.id) return null;

  const hasContent =
    pending.length > 0 ||
    (myStatus?.campaign && myStatus.campaign.status === 'voting') ||
    myStatus?.campaign?.status === 'failed';

  if (!hasContent && !myStatus?.campaign) return null;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 10,
        border: '2px solid rgba(255, 0, 255, 0.45)',
        background: 'rgba(255, 0, 255, 0.08)',
      }}
    >
      <div style={{ fontFamily: 'Orbitron, monospace', color: '#ff00ff', fontSize: 13, marginBottom: 8 }}>
        Coach peer review — 48h · 80% &quot;baddie&quot; votes
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {message && <div style={{ color: '#34d399', fontSize: 12, marginBottom: 8 }}>{message}</div>}

      {myStatus?.campaign?.status === 'voting' && myStatus.stats && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#e5e7eb' }}>
          <strong>Your application:</strong> {myStatus.stats.baddiePercent}% yes · {myStatus.stats.total}/{myStatus.stats.minVotes} votes ·{' '}
          {myStatus.stats.hoursLeft}h left
        </div>
      )}

      {myStatus?.campaign?.status === 'passed' && (
        <div style={{ marginBottom: 12, color: '#34d399', fontSize: 12 }}>
          You passed peer review — you can guide clients now.
        </div>
      )}

      {myStatus?.campaign?.status === 'failed' && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#fbbf24' }}>
          Not enough votes this round. Improve and apply again.
          {myStatus.improvementHints?.length ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {myStatus.improvementHints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {pending.map((c) => (
        <div
          key={c.id}
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 8,
            border: '1px solid rgba(0, 212, 255, 0.35)',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            {c.profilePicture ? (
              <img src={c.profilePicture} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#374151' }} />
            )}
            <div>
              <div style={{ color: '#00d4ff', fontWeight: 600 }}>{c.profileName}</div>
              {c.profileAge ? <div style={{ fontSize: 11, color: '#9ca3af' }}>Age {c.profileAge}</div> : null}
              {c.profileBio ? <div style={{ fontSize: 11, color: '#d1d5db', marginTop: 4 }}>{c.profileBio.slice(0, 120)}</div> : null}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#f9a8d4', marginBottom: 8 }}>Would you call them a baddie coach material?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {feedbackTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: selectedTags.includes(tag) ? '1px solid #f87171' : '1px solid #6b7280',
                  background: selectedTags.includes(tag) ? 'rgba(248,113,113,0.2)' : 'transparent',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                {TAG_LABELS[tag] || tag}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={loading}
              onClick={() => submitVote(c.id, 'baddie')}
              style={{
                flex: 1,
                padding: '10px',
                background: 'rgba(52, 211, 153, 0.25)',
                border: '2px solid #34d399',
                borderRadius: 8,
                color: '#34d399',
                cursor: 'pointer',
                fontFamily: 'Orbitron, monospace',
                fontSize: 12,
              }}
            >
              Yes — baddie
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => submitVote(c.id, 'not')}
              style={{
                flex: 1,
                padding: '10px',
                background: 'rgba(248, 113, 113, 0.2)',
                border: '2px solid #f87171',
                borderRadius: 8,
                color: '#f87171',
                cursor: 'pointer',
                fontFamily: 'Orbitron, monospace',
                fontSize: 12,
              }}
            >
              Not yet
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }}>Tags optional — helps them improve if &quot;not&quot;</div>
        </div>
      ))}
    </div>
  );
}
