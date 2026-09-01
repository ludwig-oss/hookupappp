import { useCallback, useEffect, useRef, useState } from 'react';
import { confessionAPI, ConfessionCallState } from '../api/confession';
import { createConfessionVoiceVeil, VoiceVeilHandle } from '../lib/confessionVoiceMask';
import { formatAxiosError } from '../lib/apiError';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

type CallUi = 'idle' | 'calling' | 'ringing' | 'connected';

export default function ConfessionMaskedCall({
  sessionId,
  role,
}: {
  sessionId: string;
  role: 'seeker' | 'guide';
}) {
  const [ui, setUi] = useState<CallUi>('idle');
  const [error, setError] = useState('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const veilRef = useRef<VoiceVeilHandle | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const seenIce = useRef(new Set<string>());
  const appliedAnswer = useRef(false);
  const appliedOffer = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(async (notifyServer: boolean) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pcRef.current?.getSenders().forEach((s) => {
      try {
        s.track?.stop();
      } catch {
        /* ignore */
      }
    });
    pcRef.current?.close();
    pcRef.current = null;
    veilRef.current?.stop();
    veilRef.current = null;
    seenIce.current.clear();
    appliedAnswer.current = false;
    appliedOffer.current = false;
    setUi('idle');
    if (notifyServer) {
      await confessionAPI.hangupCall(sessionId).catch(() => {});
    }
  }, [sessionId]);

  const attachRemote = (stream: MediaStream) => {
    const el = remoteAudioRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  };

  const startPeer = async (asCaller: boolean) => {
    const veil = await createConfessionVoiceVeil(role, sessionId);
    veilRef.current = veil;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    veil.maskedStream.getTracks().forEach((track) => pc.addTrack(track, veil.maskedStream));
    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) attachRemote(stream);
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      confessionAPI.sendCallIce(sessionId, JSON.stringify(ev.candidate.toJSON())).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setUi('connected');
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        void cleanup(true);
      }
    };
    if (asCaller) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      await confessionAPI.sendCallOffer(sessionId, offer.sdp || '');
      setUi('calling');
    }
    return pc;
  };

  const applyRemoteIce = async (call: ConfessionCallState) => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const item of call.ice) {
      if (item.fromRole === role) continue;
      if (seenIce.current.has(item.id)) continue;
      if (!pc.remoteDescription) continue;
      seenIce.current.add(item.id);
      seenIce.current.add(item.id);
      try {
        const init = JSON.parse(item.candidate) as RTCIceCandidateInit;
        if (init.candidate) await pc.addIceCandidate(init);
      } catch {
        /* ignore malformed */
      }
    }
  };

  const poll = useCallback(async () => {
    try {
      const { call } = await confessionAPI.getCall(sessionId);
      if (!call.offer && ui !== 'idle') {
        await cleanup(false);
        return;
      }
      if (call.incoming && ui === 'idle') {
        setUi('ringing');
      }
      const pc = pcRef.current;
      if (pc && call.answer?.sdp && !appliedAnswer.current && ui === 'calling') {
        appliedAnswer.current = true;
        await pc.setRemoteDescription({ type: 'answer', sdp: call.answer.sdp });
      }
      if (pc) await applyRemoteIce(call);
    } catch {
      /* keep polling */
    }
  }, [sessionId, role, ui, cleanup]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      void poll();
    }, 1200);
    void poll();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  useEffect(() => {
    return () => {
      void cleanup(false);
    };
  }, [cleanup]);

  const startCall = async () => {
    setError('');
    try {
      await startPeer(true);
    } catch (e) {
      setError(formatAxiosError(e, 'Could not start veiled call. Allow the microphone.'));
      await cleanup(true);
    }
  };

  const answerCall = async () => {
    setError('');
    try {
      const { call } = await confessionAPI.getCall(sessionId);
      if (!call.offer?.sdp) {
        setError('Call expired');
        setUi('idle');
        return;
      }
      const pc = await startPeer(false);
      appliedOffer.current = true;
      await pc.setRemoteDescription({ type: 'offer', sdp: call.offer.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await confessionAPI.sendCallAnswer(sessionId, answer.sdp || '');
      await applyRemoteIce(call);
      setUi('connected');
    } catch (e) {
      setError(formatAxiosError(e, 'Could not answer. Allow the microphone.'));
      await cleanup(true);
    }
  };

  const hangup = () => {
    void cleanup(true);
  };

  return (
    <div className="confession-call-panel">
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      <div className="confession-call-booth" aria-hidden>
        <div className="confession-call-side">
          <div className="confession-call-silhouette" />
          <span>You</span>
        </div>
        <div className="confession-call-screen" />
        <div className="confession-call-side">
          <div className="confession-call-silhouette other" />
          <span>Unknown</span>
        </div>
      </div>
      <p className="confession-call-hint">
        Voices are deepened on your device before they leave. They never hear your real voice — and you never hear theirs.
      </p>
      {error && <div className="error-message" style={{ marginBottom: 8 }}>{error}</div>}
      {ui === 'idle' && (
        <button type="button" className="select-user-btn" style={{ width: '100%' }} onClick={startCall}>
          Veiled voice call
        </button>
      )}
      {ui === 'calling' && (
        <button type="button" className="chat-back-btn" style={{ width: '100%' }} onClick={hangup}>
          Calling through the screen… Cancel
        </button>
      )}
      {ui === 'ringing' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="select-user-btn" style={{ flex: 1 }} onClick={answerCall}>
            Answer veiled call
          </button>
          <button type="button" className="chat-back-btn" style={{ flex: 1 }} onClick={hangup}>
            Decline
          </button>
        </div>
      )}
      {ui === 'connected' && (
        <button type="button" className="chat-back-btn" style={{ width: '100%' }} onClick={hangup}>
          End veiled call
        </button>
      )}
    </div>
  );
}
