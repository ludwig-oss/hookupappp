import { useState, useContext, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import { formatAxiosError } from '../lib/apiError';
import { prepareMediaForUpload } from '../lib/prepareMediaUpload';
import { trimVideoToDataUrl, isVideoDataUrl, clampClipRange, MAX_CLIP_SEC } from '../lib/trimVideo';
import './ProfileSetup.css';

type MediaMode = 'photo' | 'clip';

const ProfileSetup = () => {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profileMedia, setProfileMedia] = useState<string | null>(null);
  const [mediaMode, setMediaMode] = useState<MediaMode>('photo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [rawVideoBlob, setRawVideoBlob] = useState<Blob | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(MAX_CLIP_SEC);
  const [trimming, setTrimming] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  const isVideo = profileMedia ? isVideoDataUrl(profileMedia) : false;

  const finishSetup = async (media: string | null) => {
    if (!user?.id) {
      setError('Session expired. Please log in again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let payload = media;
      if (payload) {
        payload = await prepareMediaForUpload(payload);
      }
      const response = await profileAPI.completeProfileSetup(payload, user.id);
      const token = localStorage.getItem('token') || '';
      login(
        {
          ...user,
          profileSetupComplete: true,
          profilePicture: response.user?.profilePicture ?? payload,
        },
        token
      );
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Failed to complete profile setup'));
    } finally {
      setLoading(false);
    }
  };

  const openCirclePicker = () => {
    if (mediaMode === 'photo') {
      photoInputRef.current?.click();
    } else {
      videoInputRef.current?.click();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image size must be less than 8MB');
      return;
    }
    setError('');
    setRawVideoBlob(null);
    const reader = new FileReader();
    reader.onloadend = () => setProfileMedia(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyVideoTrim = useCallback(async (blob: Blob, start: number, end: number) => {
    setTrimming(true);
    setError('');
    try {
      const dataUrl = await trimVideoToDataUrl(blob, start, end);
      setProfileMedia(dataUrl);
    } catch {
      setError('Could not trim video — try a shorter clip');
    } finally {
      setTrimming(false);
    }
  }, []);

  const loadVideoFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError('Video must be under 40MB');
      return;
    }
    setError('');
    setRawVideoBlob(file);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = async () => {
      const dur = video.duration || MAX_CLIP_SEC;
      const { start, end } = clampClipRange(dur, 0, Math.min(dur, MAX_CLIP_SEC));
      setVideoDuration(dur);
      setTrimStart(start);
      setTrimEnd(end);
      URL.revokeObjectURL(url);
      await applyVideoTrim(file, start, end);
    };
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadVideoFile(file);
    e.target.value = '';
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    recorderRef.current?.stop();
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 } },
        audio: false,
      });
      recordStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setRawVideoBlob(blob);
        setVideoDuration(MAX_CLIP_SEC);
        setTrimStart(0);
        setTrimEnd(MAX_CLIP_SEC);
        await applyVideoTrim(blob, 0, MAX_CLIP_SEC);
      };
      recorderRef.current = recorder;
      recorder.start(200);
      setRecording(true);
      recordTimerRef.current = window.setTimeout(() => stopRecording(), MAX_CLIP_SEC * 1000);
    } catch {
      setError('Camera access needed to record a GIF-length clip');
    }
  };

  const onTrimChange = async (start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
    if (rawVideoBlob) await applyVideoTrim(rawVideoBlob, start, end);
  };

  const switchMode = (mode: MediaMode) => {
    setMediaMode(mode);
    setProfileMedia(null);
    setRawVideoBlob(null);
    setError('');
  };

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-card">
        <h1 className="setup-title">Complete Your Profile</h1>
        <p className="setup-subtitle">Add a photo or GIF-length clip (max {MAX_CLIP_SEC}s) — or skip for now</p>

        <div className="setup-mode-tabs">
          <button type="button" className={mediaMode === 'photo' ? 'active' : ''} onClick={() => switchMode('photo')}>
            Photo
          </button>
          <button type="button" className={mediaMode === 'clip' ? 'active' : ''} onClick={() => switchMode('clip')}>
            GIF clip
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="profile-picture-upload">
          <button
            type="button"
            className="circle-frame circle-frame-btn"
            onClick={openCirclePicker}
            aria-label={mediaMode === 'photo' ? 'Upload photo' : 'Upload short clip'}
          >
            {profileMedia ? (
              isVideo ? (
                <video src={profileMedia} className="preview-image" autoPlay loop muted playsInline />
              ) : (
                <img src={profileMedia} alt="Profile" className="preview-image" />
              )
            ) : (
              <div className="placeholder-circle">
                <span>+</span>
                <p>{mediaMode === 'photo' ? 'Upload Photo' : 'Add GIF clip'}</p>
              </div>
            )}
          </button>

          {mediaMode === 'photo' ? (
            <button type="button" onClick={() => photoInputRef.current?.click()} className="upload-button" disabled={loading}>
              {profileMedia ? 'Change Photo' : 'Choose Photo'}
            </button>
          ) : (
            <div className="clip-actions">
              <button type="button" className="upload-button" disabled={loading || recording} onClick={() => videoInputRef.current?.click()}>
                Upload video
              </button>
              <button type="button" className="upload-button clip-record" disabled={loading || recording} onClick={recording ? stopRecording : startRecording}>
                {recording ? 'Stop…' : `Record ${MAX_CLIP_SEC}s clip`}
              </button>
            </div>
          )}

          {mediaMode === 'clip' && rawVideoBlob && videoDuration > 0 && (
            <div className="trim-panel">
              <p className="trim-label">Adjust length (max {MAX_CLIP_SEC}s, loops like a GIF)</p>
              <label className="trim-slider-row">
                Start: {trimStart.toFixed(1)}s
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, Math.min(videoDuration, MAX_CLIP_SEC) - 0.5)}
                  step={0.1}
                  value={trimStart}
                  disabled={trimming}
                  onChange={(e) => {
                    const s = parseFloat(e.target.value);
                    void onTrimChange(s, Math.max(s + 0.5, trimEnd));
                  }}
                />
              </label>
              <label className="trim-slider-row">
                End: {trimEnd.toFixed(1)}s
                <input
                  type="range"
                  min={trimStart + 0.5}
                  max={Math.min(videoDuration, MAX_CLIP_SEC)}
                  step={0.1}
                  value={trimEnd}
                  disabled={trimming}
                  onChange={(e) => {
                    const end = parseFloat(e.target.value);
                    void onTrimChange(trimStart, end);
                  }}
                />
              </label>
              {trimming && <p className="trim-status">Processing clip…</p>}
            </div>
          )}
        </div>

        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoSelect} />

        <button
          type="button"
          onClick={() => finishSetup(profileMedia)}
          className="continue-button"
          disabled={loading || trimming || !profileMedia}
        >
          {loading ? 'Setting up...' : 'Continue'}
        </button>

        <button type="button" onClick={() => finishSetup(null)} className="upload-button skip-btn" disabled={loading}>
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default ProfileSetup;
