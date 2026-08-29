import { useEffect, useRef, useState } from 'react';

type Props = {
  onScan: (text: string) => void;
  onError?: (msg: string) => void;
};

/** Camera QR scanner with manual fallback (BarcodeDetector when available). */
export default function QrScannerPanel({ onScan, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let raf = 0;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        if (!Detector) {
          setHint('Camera on — paste a link below if scan is not supported on this device.');
          return;
        }
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const val = codes[0]?.rawValue;
            if (val) {
              onScan(val);
              setActive(false);
              return;
            }
          } catch {
            /* ignore frame errors */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        onError?.('Camera access denied. Use manual link entry or the QR image to share.');
        setActive(false);
      }
    };

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active, onScan, onError]);

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)' }}>
      <p style={{ fontSize: 12, marginBottom: 8, opacity: 0.9 }}>Scan a friend&apos;s sign-up QR or paste their invite link</p>
      {!active ? (
        <button type="button" className="auth-button" style={{ fontSize: 13, padding: '8px 12px' }} onClick={() => setActive(true)}>
          📷 Open QR scanner
        </button>
      ) : (
        <div>
          <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 180, borderRadius: 8, background: '#000' }} />
          <button type="button" className="auth-button" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setActive(false)}>
            Stop camera
          </button>
        </div>
      )}
      {hint && <p style={{ fontSize: 11, marginTop: 8, opacity: 0.75 }}>{hint}</p>}
      <input
        type="text"
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder="Or paste signup URL"
        style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 6 }}
      />
      <button
        type="button"
        className="auth-button"
        style={{ marginTop: 8, fontSize: 12 }}
        disabled={!manual.trim()}
        onClick={() => onScan(manual.trim())}
      >
        Use link
      </button>
    </div>
  );
}
