import { useCallback, useEffect, useState } from 'react';
import { voiceRecordingAPI, VoiceRecordingSession, VoiceGuardSettings } from '../api/voiceRecording';
import { useVoiceSafetyRecorder } from '../hooks/useVoiceSafetyRecorder';
import './VoiceSafetyPanel.css';

type DateProps = {
  mode: 'date';
  planId: string;
  compact?: boolean;
};

type RelationshipProps = {
  mode: 'relationship';
  partnerUserId: string;
  partnerName: string;
};

type Props = DateProps | RelationshipProps;

export default function VoiceSafetyPanel(props: Props) {
  const [session, setSession] = useState<VoiceRecordingSession | null>(null);
  const [guard, setGuard] = useState<VoiceGuardSettings | null>(null);
  const [listenChunks, setListenChunks] = useState<Array<{ id: string; audioDataUrl?: string | null; muted?: boolean }>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [consentMsg, setConsentMsg] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');

  const load = useCallback(async () => {
    try {
      const poll = await voiceRecordingAPI.poll();
      if (poll.needsSensitiveReminder?.id && session?.id === poll.needsSensitiveReminder.id) {
        setMsg('Still in sensitive talk? Tap "Finished sensitive talk" when done to unmute.');
      }
      if (poll.homeReview?.id) {
        setSession(poll.homeReview);
        setMsg('Welcome home — review your recording with your partner if needed.');
      }
      if (props.mode === 'date') {
        const { session: s } = await voiceRecordingAPI.getDateSession(props.planId);
        setSession(s);
      } else {
        const { settings } = await voiceRecordingAPI.getGuardSettings(props.partnerUserId);
        setGuard(settings);
        if (poll.partnerLive) {
          setSession(poll.partnerLive);
          if (poll.partnerLive.id) {
            voiceRecordingAPI.listen(poll.partnerLive.id).then((r) => setListenChunks(r.chunks)).catch(() => {});
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [props, session?.id]);

  useEffect(() => {
    if (!session?.id || session.status !== 'recording') return;
    const t = setInterval(() => {
      setMsg('Reminder: do not record workplaces, private errands, or others without consent. Tap mute for sensitive talk.');
    }, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [session?.id, session?.status]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (props.mode !== 'relationship' || !session?.id || session.userId === props.partnerUserId) return;
    const pollListen = () => {
      voiceRecordingAPI.listen(session.id).then((r) => setListenChunks(r.chunks)).catch(() => {});
    };
    pollListen();
    const t = setInterval(pollListen, 15000);
    return () => clearInterval(t);
  }, [props, session?.id, session?.userId]);

  const { recording } = useVoiceSafetyRecorder({
    session,
    onSessionUpdate: setSession,
    enabled: !!session && (session.status === 'recording' || session.status === 'muted_sensitive'),
  });

  const tapConsent = async () => {
    if (!session?.id) return;
    const res = await voiceRecordingAPI.consent(session.id);
    setSession(res.session);
    setConsentMsg(res.message);
  };

  const startDateRecording = async () => {
    if (props.mode !== 'date') return;
    const pinVal = pin.trim();
    if (pinVal.length >= 4) {
      await voiceRecordingAPI.setPlanPin(props.planId, pinVal);
    }
    const res = await voiceRecordingAPI.createDateSession(props.planId);
    setSession(res.session);
    setConsentMsg(res.message);
    setShowPin(false);
  };

  const toggleGuard = async () => {
    if (props.mode !== 'relationship') return;
    const next = !guard?.enabled;
    const res = await voiceRecordingAPI.toggleGuard(props.partnerUserId, next);
    setGuard(res.settings);
    setMsg(res.message);
  };

  const guardConsentTap = async () => {
    if (props.mode !== 'relationship') return;
    const res = await voiceRecordingAPI.guardConsent(props.partnerUserId);
    setGuard(res.settings);
  };

  const startGathering = async () => {
    if (props.mode !== 'relationship') return;
    const reason = prompt('Where are you going? (party, gathering, event)') || 'Gathering';
    const res = await voiceRecordingAPI.startGathering(props.partnerUserId, reason);
    setSession(res.session);
    setConsentMsg(res.message);
  };

  const muteSensitive = async () => {
    if (!session?.id) return;
    const res = await voiceRecordingAPI.muteSensitive(session.id);
    setSession(res.session);
    setMsg(res.message);
  };

  const unmuteSensitive = async () => {
    if (!session?.id) return;
    const res = await voiceRecordingAPI.unmuteSensitive(session.id);
    setSession(res.session);
    setMsg('Recording resumed.');
  };

  const endRecording = async () => {
    if (!session?.id) return;
    const res = await voiceRecordingAPI.end(session.id);
    setSession(res.session);
    setMsg(res.message);
    if (props.mode === 'relationship') {
      const had = window.confirm('Did you talk about anything sensitive with someone else?');
      const consult = had && window.confirm('Consult your partner and delete the recording together?');
      await voiceRecordingAPI.homeReview(session.id, had, consult);
    }
  };

  if (props.mode === 'date') {
    return (
      <div className="voice-safety-panel">
        <div className="voice-safety-header">
          <span>🎙 Date safety recording</span>
          {recording && <span className="voice-live-dot">LIVE</span>}
        </div>
        <p className="voice-safety-hint">
          Whole date recorded for safety. You cannot delete it — only your emergency contact can access it with a PIN if you go missing. Auto-expires in 7 days.
        </p>
        {!session && (
          <>
            {!showPin ? (
              <button type="button" className="voice-safety-btn" onClick={() => setShowPin(true)}>
                Set emergency PIN &amp; start
              </button>
            ) : (
              <div className="voice-safety-pin-row">
                <input type="password" placeholder="4+ digit PIN for emergency contact" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={8} />
                <button type="button" className="voice-safety-btn" onClick={startDateRecording}>Begin setup</button>
              </div>
            )}
          </>
        )}
        {session && session.consentSteps < session.consentRequired && (
          <button type="button" className="voice-safety-btn voice-consent" onClick={tapConsent}>
            I agree to safety recording ({session.consentSteps}/{session.consentRequired})
          </button>
        )}
        {session && session.consentSteps >= session.consentRequired && session.status !== 'completed' && (
          <div className="voice-safety-actions">
            <button type="button" className="voice-safety-btn secondary" onClick={muteSensitive}>Sensitive talk — mute</button>
            <button type="button" className="voice-safety-btn secondary" onClick={unmuteSensitive}>Done — unmute</button>
            <button type="button" className="voice-safety-btn danger" onClick={endRecording}>End date recording</button>
          </div>
        )}
        {consentMsg && <p className="voice-safety-msg">{consentMsg}</p>}
        {msg && <p className="voice-safety-msg">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="voice-safety-panel relationship">
      <div className="voice-safety-header">
        <span>🎙 Gathering voice guard</span>
        {guard?.enabled && <span className="voice-guard-on">ON</span>}
      </div>
      <p className="voice-safety-hint">
        For parties &amp; events only — not workplaces or daily errands. Both partners agree 3 times before recording. Partner can listen live. Say &quot;sensitive talk&quot; to mute.
      </p>
      <button type="button" className="voice-safety-btn" onClick={toggleGuard}>
        {guard?.enabled ? 'Disable in chat (⋮ menu)' : 'Enable gathering guard'}
      </button>
      {guard?.enabled && !guard.fullyConsented && (
        <button type="button" className="voice-safety-btn voice-consent" onClick={guardConsentTap}>
          I agree ({guard.myConsentSteps ?? 0}/{guard.consentRequired ?? 3}) — faithfulness recording
        </button>
      )}
      {guard?.fullyConsented && !session && (
        <button type="button" className="voice-safety-btn" onClick={startGathering}>
          Going out — start recording
        </button>
      )}
      {session && session.consentSteps < session.consentRequired && (
        <button type="button" className="voice-safety-btn voice-consent" onClick={tapConsent}>
          Confirm recording ({session.consentSteps}/{session.consentRequired})
        </button>
      )}
      {session && session.consentSteps >= session.consentRequired && session.status !== 'completed' && (
        <div className="voice-safety-actions">
          <button type="button" className="voice-safety-btn secondary" onClick={muteSensitive}>Sensitive — mute now</button>
          <button type="button" className="voice-safety-btn secondary" onClick={unmuteSensitive}>Finished sensitive talk</button>
          <button type="button" className="voice-safety-btn danger" onClick={endRecording}>Home — end recording</button>
        </div>
      )}
      {listenChunks.length > 0 && (
        <div className="voice-listen-block">
          <p>Partner live feed (muted segments hidden):</p>
          {listenChunks.map((c) =>
            c.audioDataUrl ? <audio key={c.id} controls src={c.audioDataUrl} /> : <p key={c.id} className="voice-muted-chunk">🔇 Sensitive segment muted</p>
          )}
        </div>
      )}
      {consentMsg && <p className="voice-safety-msg">{consentMsg}</p>}
      {msg && <p className="voice-safety-msg">{msg}</p>}
    </div>
  );
}
