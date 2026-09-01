import { useEffect, useMemo, useRef, useState } from 'react';
import { EMOJI_GROUPS, GIF_CATEGORIES, searchCatalog } from '../data/gifCatalog';
import {
  encodeChatGif,
  isGifSaved,
  loadSavedGifs,
  saveGif,
  unsaveGif,
  type ChatGifPayload,
} from '../lib/chatGif';
import { isVideoMediaUrl } from '../lib/media';
import { prepareAndUploadFile } from '../lib/uploadMedia';

type Tab = 'gifs' | 'saved' | 'create' | 'emojis';

type Props = {
  userId: string;
  startTab?: Tab;
  onSend: (encoded: string) => void;
  onInsertEmoji: (emoji: string) => void;
  onClose: () => void;
};

function kindForUrl(url: string, fallback: ChatGifPayload['kind'] = 'gif'): ChatGifPayload['kind'] {
  if (fallback === 'emoji') return 'emoji';
  if (isVideoMediaUrl(url) || url.startsWith('data:video/')) return 'video';
  return 'gif';
}

function Tile({
  item,
  saved,
  onSend,
  onToggleSave,
}: {
  item: ChatGifPayload;
  saved: boolean;
  onSend: () => void;
  onToggleSave: () => void;
}) {
  const isEmoji = item.kind === 'emoji';
  const isVideo = item.kind === 'video' || isVideoMediaUrl(item.url);
  return (
    <div className="gif-tile">
      <button type="button" className="gif-tile-main" onClick={onSend} title={item.name}>
        {isEmoji ? (
          <span className="gif-tile-emoji">{item.url}</span>
        ) : isVideo ? (
          <video src={item.url} muted loop autoPlay playsInline />
        ) : (
          <img src={item.url} alt="" loading="lazy" />
        )}
        <span className="gif-tile-name">{item.name}</span>
      </button>
      <button
        type="button"
        className={`gif-tile-save ${saved ? 'saved' : ''}`}
        onClick={onToggleSave}
        title={saved ? 'Remove from saved' : 'Save'}
        aria-label={saved ? 'Unsave' : 'Save'}
      >
        {saved ? '♥' : '♡'}
      </button>
    </div>
  );
}

export default function GifEmojiPicker({ userId, startTab = 'gifs', onSend, onInsertEmoji, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(startTab);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | (typeof GIF_CATEGORIES)[number]>('All');
  const [saved, setSaved] = useState<ChatGifPayload[]>(() => loadSavedGifs(userId));
  const [createName, setCreateName] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setSaved(loadSavedGifs(userId));
  }, [userId]);

  useEffect(() => {
    setTab(startTab);
  }, [startTab]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const filtered = useMemo(() => {
    const list = searchCatalog(query);
    if (category === 'All') return list;
    return list.filter((g) => g.category === category);
  }, [query, category]);

  const sendPayload = (payload: ChatGifPayload) => {
    onSend(encodeChatGif(payload));
  };

  const toggleSave = (payload: ChatGifPayload) => {
    const next = isGifSaved(userId, payload.url)
      ? unsaveGif(userId, payload.url)
      : saveGif(userId, payload);
    setSaved(next);
  };

  const finishCreate = async (file: Blob, fallbackName: string, mime: string) => {
    const name = createName.trim() || fallbackName;
    setCreating(true);
    setCreateError('');
    try {
      let url = '';
      if (file instanceof File) {
        url = await prepareAndUploadFile(file, 'chat-gifs');
      } else {
        const named = new File([file], mime.includes('gif') ? 'sticker.gif' : 'sticker.webm', { type: mime });
        url = await prepareAndUploadFile(named, 'chat-gifs');
      }
      const payload: ChatGifPayload = { url, name, kind: kindForUrl(url, mime.includes('video') ? 'video' : 'gif') };
      const next = saveGif(userId, payload);
      setSaved(next);
      sendPayload(payload);
    } catch (err) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl.startsWith('data:')) {
          setCreateError(err instanceof Error ? err.message : 'Could not create that GIF');
          setCreating(false);
          return;
        }
        const payload: ChatGifPayload = {
          url: dataUrl,
          name,
          kind: dataUrl.startsWith('data:video') ? 'video' : 'gif',
        };
        setSaved(saveGif(userId, payload));
        sendPayload(payload);
        setCreating(false);
      };
      reader.readAsDataURL(file);
      return;
    } finally {
      setCreating(false);
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    const label = createName.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'My GIF';
    await finishCreate(file, label, file.type || 'image/gif');
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    setCreateError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        await finishCreate(blob, createName.trim() || 'My GIF', 'video/webm');
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      window.setTimeout(() => {
        if (recorderRef.current) stopRecording();
      }, 3000);
    } catch {
      setCreateError('Camera access needed to record a GIF.');
    }
  };

  const sendPasted = () => {
    const url = pasteUrl.trim();
    if (!url) return;
    const payload: ChatGifPayload = {
      url,
      name: createName.trim() || 'Sticker',
      kind: kindForUrl(url),
    };
    setSaved(saveGif(userId, payload));
    sendPayload(payload);
    setPasteUrl('');
  };

  return (
    <div className="gif-picker">
      <div className="gif-picker-head">
        <div className="gif-picker-tabs">
          {([
            ['gifs', 'GIFs'],
            ['saved', 'Saved'],
            ['create', 'Create'],
            ['emojis', 'Emojis'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`gif-picker-tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="gif-picker-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {tab === 'gifs' && (
        <>
          <input
            className="gif-picker-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs…"
          />
          <div className="gif-picker-cats">
            <button
              type="button"
              className={category === 'All' ? 'active' : ''}
              onClick={() => setCategory('All')}
            >
              All
            </button>
            {GIF_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? 'active' : ''}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="gif-picker-grid">
            {filtered.map((item) => (
              <Tile
                key={item.id}
                item={item}
                saved={saved.some((s) => s.url === item.url)}
                onSend={() => sendPayload(item)}
                onToggleSave={() => toggleSave(item)}
              />
            ))}
            {filtered.length === 0 && <p className="gif-picker-empty">No GIFs match that search.</p>}
          </div>
        </>
      )}

      {tab === 'saved' && (
        <div className="gif-picker-grid">
          {saved.map((item) => (
            <Tile
              key={item.url}
              item={item}
              saved
              onSend={() => sendPayload(item)}
              onToggleSave={() => toggleSave(item)}
            />
          ))}
          {saved.length === 0 && (
            <p className="gif-picker-empty">Tap ♡ on a GIF to save it. Saved GIFs live on this device.</p>
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className="gif-create">
          <label className="gif-create-label">What is it called?</label>
          <input
            className="gif-picker-search"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Name that flashes under it"
            maxLength={48}
          />
          <p className="gif-create-hint">Record 3 seconds, upload a GIF, or paste a link. Then send — the name flashes under it.</p>
          <div className="gif-create-actions">
            <button type="button" className="gif-create-btn" disabled={creating} onClick={recording ? stopRecording : startRecording}>
              {recording ? 'Stop' : creating ? 'Saving…' : 'Record GIF'}
            </button>
            <button type="button" className="gif-create-btn" disabled={creating || recording} onClick={() => fileRef.current?.click()}>
              Upload
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/gif,image/webp,image/png,image/jpeg,video/mp4,video/webm"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              onPickFile(file);
            }}
          />
          <div className="gif-create-paste">
            <input
              className="gif-picker-search"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="Paste GIF or image URL"
            />
            <button type="button" className="gif-create-btn" disabled={!pasteUrl.trim() || creating} onClick={sendPasted}>
              Send
            </button>
          </div>
          {createError && <p className="gif-create-error">{createError}</p>}
        </div>
      )}

      {tab === 'emojis' && (
        <div className="emoji-picker-body">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.id} className="emoji-group">
              <div className="emoji-group-label">{group.label}</div>
              <div className="emoji-grid">
                {group.emojis.map((emoji) => (
                  <button
                    key={`${group.id}-${emoji}`}
                    type="button"
                    className="emoji-btn"
                    onClick={() => onInsertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="gif-create-hint">Tap an emoji to add it to your message. Want it huge with a name? Send it from GIFs.</p>
        </div>
      )}
    </div>
  );
}
