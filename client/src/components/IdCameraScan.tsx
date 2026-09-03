import { useEffect, useRef, useState } from 'react';

type Side = 'front' | 'back';

interface IdCameraScanProps {
  front: string | null;
  back: string | null;
  onFront: (dataUrl: string) => void;
  onBack: (dataUrl: string) => void;
}

export default function IdCameraScan({ front, back, onFront, onBack }: IdCameraScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [side, setSide] = useState<Side>(front ? 'back' : 'front');
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => stop(), []);

  const start = async (which: Side) => {
    setError('');
    setSide(which);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError('Allow camera access, then hold your ID in front of the lens.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    if (side === 'front') onFront(dataUrl);
    else onBack(dataUrl);
    stop();
  };

  return (
    <div className="id-camera-scan">
      <p className="id-camera-copy">
        Hold the front of your ID in the camera, scan it, then the back. Saved until you arrive home safe.
      </p>
      <div className="id-camera-previews">
        <div className={`id-camera-thumb ${front ? 'done' : ''}`}>
          {front ? <img src={front} alt="ID front" /> : <span>Front</span>}
        </div>
        <div className={`id-camera-thumb ${back ? 'done' : ''}`}>
          {back ? <img src={back} alt="ID back" /> : <span>Back</span>}
        </div>
      </div>
      {error && <p className="id-camera-error">{error}</p>}
      {cameraOn ? (
        <div className="id-camera-live">
          <video ref={videoRef} playsInline muted autoPlay className="id-camera-video" />
          <p className="id-camera-frame-hint">Hold the {side} of your ID in the frame</p>
          <div className="id-camera-live-actions">
            <button type="button" className="chat-send-btn" onClick={capture}>
              Scan {side}
            </button>
            <button type="button" className="chat-back-btn" onClick={stop}>
              Cancel camera
            </button>
          </div>
        </div>
      ) : (
        <div className="id-camera-start-row">
          <button type="button" className="chat-send-btn" onClick={() => start('front')}>
            {front ? 'Rescan ID front' : 'Hold ID — scan front'}
          </button>
          <button type="button" className="chat-send-btn" onClick={() => start('back')} disabled={!front}>
            {back ? 'Rescan ID back' : 'Hold ID — scan back'}
          </button>
        </div>
      )}
    </div>
  );
}
