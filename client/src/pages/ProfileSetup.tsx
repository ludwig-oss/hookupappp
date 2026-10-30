import { useState, useContext, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import { dateMatchAPI } from '../api/dateMatch';
import { discoverAPI } from '../api/discover';
import { walkMatchAPI } from '../api/walkMatch';
import LookingForChips from '../components/LookingForChips';
import { DATING_GENDERS, datingGender, orientationFitsGender, orientationsForGender } from '../lib/genderOrientation';
import { formatAxiosError } from '../lib/apiError';
import { prepareAndUploadFile } from '../lib/uploadMedia';
import { trimVideoToBlob, clampClipRange, MAX_CLIP_SEC } from '../lib/trimVideo';
import { getAuthToken, getStayLoggedIn } from '../lib/authStorage';
import { extractFaceDescriptorFromImage } from '../lib/faceScan';
import './ProfileSetup.css';

type MediaMode = 'photo' | 'clip';

function asUploadFile(blob: Blob, fallbackName: string): File {
  if (blob instanceof File && blob.name) return blob;
  const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'mp4' : blob.type.startsWith('image/') ? 'jpg' : 'bin';
  return new File([blob], fallbackName.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type || 'application/octet-stream' });
}

const ProfileSetup = () => {
  const { user, login, logout, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadBlob, setUploadBlob] = useState<Blob | null>(null);
  const [mediaMode, setMediaMode] = useState<MediaMode>('photo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [rawVideoBlob, setRawVideoBlob] = useState<Blob | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(MAX_CLIP_SEC);
  const [trimming, setTrimming] = useState(false);
  const [lookingFor, setLookingFor] = useState<string[]>(
    Array.isArray(user?.dateLookingFor) ? user.dateLookingFor.filter((x: unknown) => typeof x === 'string') : []
  );
  const [gender, setGender] = useState(datingGender(typeof user?.gender === 'string' ? user.gender : ''));
  const [orientation, setOrientation] = useState<'' | 'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual'>('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [checkingFace, setCheckingFace] = useState(false);
  const [faceOk, setFaceOk] = useState(false);
  const [capturingSelfie, setCapturingSelfie] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  const isVideo = mediaMode === 'clip' || Boolean(uploadBlob?.type.startsWith('video/'));

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const setMediaFromBlob = (blob: Blob) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setUploadBlob(blob);
  };

  const startOver = () => {
    logout();
    navigate('/', { replace: true });
  };

  const verifyFacePhoto = async (blob: Blob): Promise<boolean> => {
    if (!blob.type.startsWith('image/')) {
      setFaceOk(false);
      setError('Use a still photo. Chest and above is enough, as long as your head is in it. Not a video clip.');
      return false;
    }
    setCheckingFace(true);
    try {
      const url = URL.createObjectURL(blob);
      try {
        const desc = await extractFaceDescriptorFromImage(url);
        if (!desc) {
          setFaceOk(false);
          setError('We need your head in the photo. Chest and above is enough. No group shots, landscapes, or a picture of someone else.');
          return false;
        }
        setFaceOk(true);
        setError('');
        return true;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      // Models may fail to load; still require a photo and tell them it must be their face.
      setFaceOk(true);
      setError('');
      return true;
    } finally {
      setCheckingFace(false);
    }
  };

  const finishSetup = async (blob: Blob | null) => {
    if (!user?.id) {
      setError('Session expired. Please log in again.');
      return;
    }
    if (!blob || !blob.type.startsWith('image/')) {
      setError('Add a photo with your head visible. Chest and above is enough. This step cannot be skipped.');
      return;
    }
    if (!faceOk) {
      const ok = await verifyFacePhoto(blob);
      if (!ok) return;
    }
    const g = datingGender(gender);
    if (!g) {
      setError('Choose Female or Male.');
      return;
    }
    if (orientation && !orientationFitsGender(orientation, g)) {
      setError('That orientation does not match the gender you chose.');
      return;
    }
    if (!agreedToTerms) {
      setError('Agree to Terms and Privacy to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await profileAPI.updateProfile({ gender: g });
      await walkMatchAPI.updateSettings({ gender: g }).catch(() => {});
      if (orientation) {
        await discoverAPI.setPreference({ orientation, userId: user.id });
      }
      if (lookingFor.length > 0) {
        await dateMatchAPI.saveLookingFor(lookingFor);
      }
      updateUser({ dateLookingFor: lookingFor, gender: g });
      const file = asUploadFile(blob, 'photo.jpg');
      const pictureUrl = await prepareAndUploadFile(file, 'profile');
      const response = await profileAPI.completeProfileSetup(pictureUrl, user.id);
      const token = getAuthToken() || '';
      login(
        {
          ...user,
          profileSetupComplete: true,
          profilePicture: response.user?.profilePicture ?? pictureUrl,
          dateLookingFor: lookingFor,
        },
        token,
        { stayLoggedIn: getStayLoggedIn() }
      );
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { code?: string } } })?.response?.status;
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (status === 401 || status === 404 || code === 'SESSION_GONE') {
        logout();
        navigate('/', { replace: true });
        return;
      }
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
    setMediaFromBlob(file);
    setFaceOk(false);
    void verifyFacePhoto(file);
    e.target.value = '';
  };

  const takeSelfie = async () => {
    setError('');
    setCapturingSelfie(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 } },
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      await new Promise((r) => window.setTimeout(r, 450));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) {
        setError('Could not capture a selfie. Try again or upload a clear photo of your face.');
        return;
      }
      setRawVideoBlob(null);
      setMediaMode('photo');
      setMediaFromBlob(blob);
      await verifyFacePhoto(blob);
    } catch {
      setError('Allow camera access, or upload a chest-up photo with your head visible.');
    } finally {
      setCapturingSelfie(false);
    }
  };

  const applyVideoTrim = useCallback(async (blob: Blob, start: number, end: number) => {
    setTrimming(true);
    setError('');
    try {
      const clipped = await trimVideoToBlob(blob, start, end);
      setMediaFromBlob(clipped);
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
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setUploadBlob(null);
    setRawVideoBlob(null);
    setFaceOk(false);
    setError('');
  };

  const canContinue = Boolean(
    uploadBlob && uploadBlob.type.startsWith('image/') && faceOk && datingGender(gender) && agreedToTerms
    && !loading && !trimming && !checkingFace && !capturingSelfie
  );

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-card">
        <Link to="/" className="back-link" onClick={(e) => { e.preventDefault(); startOver(); }}>
          ← Back to start
        </Link>
        <h1 className="setup-title">Finish joining</h1>
        <p className="setup-subtitle">
          Google got you in. Choose gender, orientation, and what you want, then agree to Terms and Privacy. The photo comes after that.
        </p>

        {error && <div className="error-message">{error}</div>}

        <section className="setup-section" aria-labelledby="setup-gender-heading">
          <h2 id="setup-gender-heading" className="setup-section-title">Gender</h2>
          <select
            id="setup-gender"
            className="setup-select"
            value={datingGender(gender)}
            onChange={(e) => {
              const next = e.target.value;
              setGender(next);
              if (orientation && !orientationFitsGender(orientation, next)) setOrientation('');
            }}
          >
            <option value="">Female or Male…</option>
            {DATING_GENDERS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </section>

        <section className="setup-section" aria-labelledby="setup-orientation-heading">
          <h2 id="setup-orientation-heading" className="setup-section-title">Orientation</h2>
          <select
            id="setup-orientation"
            className="setup-select"
            value={orientation}
            disabled={!datingGender(gender)}
            onChange={(e) => setOrientation(e.target.value as typeof orientation)}
          >
            <option value="">{datingGender(gender) ? 'Skip for now…' : 'Choose Female or Male first'}</option>
            {orientationsForGender(gender).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="setup-section-hint">Gay is for men, lesbian is for women. Straight, bi, and pan follow the gender you picked.</p>
        </section>

        <section className="setup-section" aria-labelledby="setup-looking-heading">
          <h2 id="setup-looking-heading" className="setup-section-title">What you&apos;re looking for</h2>
          <LookingForChips value={lookingFor} onChange={setLookingFor} variant="setup" />
        </section>

        <label className="setup-terms">
          <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
          <span>I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy</Link>. 18+.</span>
        </label>

        <section className="setup-section" aria-labelledby="setup-photo-heading">
          <div className="setup-info-note">
            <p><strong>Your photo must show your head</strong> — chest and above is enough. Group shots, landscapes, or pictures of someone else will not work.</p>
            <p>While you use Hook Up, location turns on automatically so nearby people show up. You can show interest or pass. Location turns off when you leave, switch sites, or switch apps.</p>
          </div>
          <h2 id="setup-photo-heading" className="setup-section-title">
            Required: head visible, chest and above
          </h2>
          <p className="setup-section-hint">
            Take a selfie now or upload a clear photo of your face. You cannot continue without it.
          </p>

          <div className="setup-mode-tabs" role="tablist" aria-label="Media type">
            <button type="button" role="tab" aria-selected={mediaMode === 'photo'} className={mediaMode === 'photo' ? 'active' : ''} onClick={() => switchMode('photo')}>
              Photo
            </button>
            <button type="button" role="tab" aria-selected={mediaMode === 'clip'} className={mediaMode === 'clip' ? 'active' : ''} onClick={() => switchMode('clip')}>
              Extra GIF (optional)
            </button>
          </div>

          <div className="profile-picture-upload">
            <button
              type="button"
              className="circle-frame circle-frame-btn"
              onClick={openCirclePicker}
              aria-label={mediaMode === 'photo' ? 'Upload photo' : 'Upload short clip'}
            >
              {previewUrl ? (
                isVideo ? (
                  <video src={previewUrl} className="preview-image" autoPlay loop muted playsInline />
                ) : (
                  <img src={previewUrl} alt="Profile" className="preview-image" />
                )
              ) : (
                <div className="placeholder-circle">
                  <span>+</span>
                  <p>{mediaMode === 'photo' ? 'Tap to upload' : 'Tap to add clip'}</p>
                </div>
              )}
            </button>

            {mediaMode === 'photo' ? (
              <div className="clip-actions">
                <button type="button" onClick={() => void takeSelfie()} className="upload-button clip-record" disabled={loading || capturingSelfie || checkingFace}>
                  {capturingSelfie ? 'Opening camera…' : checkingFace ? 'Checking face…' : 'Take a selfie'}
                </button>
                <button type="button" onClick={() => photoInputRef.current?.click()} className="upload-button" disabled={loading || capturingSelfie}>
                  {previewUrl ? 'Change photo' : 'Upload face photo'}
                </button>
              </div>
            ) : (
              <div className="clip-actions">
                <p className="setup-section-hint">A clip is extra. Switch back to Photo and add a chest-up shot with your head visible — that part cannot be skipped.</p>
                <button type="button" className="upload-button" disabled={loading || recording} onClick={() => videoInputRef.current?.click()}>
                  Upload video
                </button>
                <button type="button" className="upload-button clip-record" disabled={loading || recording} onClick={recording ? stopRecording : startRecording}>
                  {recording ? 'Stop…' : `Record ${MAX_CLIP_SEC}s`}
                </button>
              </div>
            )}

            {mediaMode === 'clip' && rawVideoBlob && videoDuration > 0 && (
              <div className="trim-panel">
                <p className="trim-label">Adjust length (max {MAX_CLIP_SEC}s)</p>
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
        </section>

        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoSelect} />

        <div className="setup-actions">
          <button
            type="button"
            onClick={() => finishSetup(uploadBlob)}
            className="continue-button"
            disabled={!canContinue}
          >
            {loading ? 'Setting up…' : checkingFace ? 'Checking face…' : 'Continue'}
          </button>
          <p className="setup-required-foot">Face photo required — this cannot be skipped.</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
