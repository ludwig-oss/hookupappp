import { useContext, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { safetyAPI } from '../api/safety';
import { useVolumeTripleSOS } from '../hooks/useVolumeTripleSOS';
import './WomenSafetySOS.css';

const isWomanProfile = (gender?: string) => {
  if (!gender) return false;
  const g = gender.toLowerCase();
  return g === 'woman' || g === 'female' || g === 'women' || g.includes('woman') || g.includes('female');
};

const WomenSafetySOS = () => {
  const { user } = useContext(AuthContext);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  const triggerSOS = useCallback(async () => {
    if (!user?.id) return;
    setSending(true);
    setStatus('');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
      });
      const { latitude: lat, longitude: lon } = pos.coords;
      const result = await safetyAPI.triggerWomenSOS(lat, lon);
      setStatus(
        `${result.message} Notified ${result.nearbyWomenNotified} nearby women. Calling emergency services…`
      );
      window.location.href = `tel:${result.policeNumber}`;
    } catch (e: any) {
      setStatus(e.response?.data?.error || e.message || 'Could not send alert. Call 911 if you are in danger.');
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }, [user?.id]);

  useVolumeTripleSOS(() => {
    if (isWomanProfile(user?.gender)) setConfirmOpen(true);
  }, isWomanProfile(user?.gender));

  if (!isWomanProfile(user?.gender)) return null;

  return (
    <>
      <button
        type="button"
        className="women-sos-fab"
        onClick={() => setConfirmOpen(true)}
        title="I feel unsafe — hold for help"
        aria-label="Women safety alert"
      >
        <span className="women-sos-fab-icon">🆘</span>
        <span className="women-sos-fab-label">I feel unsafe</span>
      </button>
      <p className="women-sos-hint">Tip: press volume down 3 times quickly to trigger (where supported)</p>

      {confirmOpen && (
        <div className="women-sos-overlay" role="dialog" aria-modal="true">
          <div className="women-sos-modal">
            <h3>Emergency — get help now</h3>
            <p>
              This will alert the app, notify nearby women on Hook Up, share your live location, and open a call to{' '}
              <strong>911</strong> (or your device emergency dialer).
            </p>
            <p className="women-sos-warning">Only use if you feel unsafe or in danger.</p>
            <div className="women-sos-actions">
              <button type="button" className="women-sos-cancel" onClick={() => setConfirmOpen(false)} disabled={sending}>
                Cancel
              </button>
              <button type="button" className="women-sos-confirm" onClick={triggerSOS} disabled={sending}>
                {sending ? 'Sending…' : 'Alert & call for help'}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="women-sos-status" role="status">
          {status}
          <button type="button" onClick={() => setStatus('')}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
};

export default WomenSafetySOS;
