import { useState } from 'react';
import { isVideoMediaUrl } from '../lib/media';
import { isLegacyChatMediaUrl, parseChatGif, type ChatGifPayload } from '../lib/chatGif';

function GifFrame({ payload }: { payload: ChatGifPayload }) {
  const [broken, setBroken] = useState(false);
  const isEmoji = payload.kind === 'emoji';
  const isVideo = payload.kind === 'video' || isVideoMediaUrl(payload.url);

  return (
    <div className="chat-gif-bubble">
      {isEmoji ? (
        <div className="chat-gif-emoji" aria-label={payload.name}>
          {payload.url}
        </div>
      ) : broken ? (
        <div className="chat-gif-fallback" aria-label={payload.name}>
          {payload.name}
        </div>
      ) : isVideo ? (
        <video
          className="chat-bubble-media"
          src={payload.url}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setBroken(true)}
        />
      ) : (
        <img
          className="chat-bubble-media"
          src={payload.url}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
      <div className="chat-gif-name">{payload.name}</div>
    </div>
  );
}

export function renderMessageContent(content: string) {
  const gif = parseChatGif(content);
  if (gif) return <GifFrame payload={gif} />;

  const raw = String(content || '').trim();
  if (raw.startsWith('data:audio/')) {
    return <audio src={raw} className="chat-bubble-audio" controls />;
  }
  if (raw.startsWith('data:video/') || (raw.startsWith('https://') && isVideoMediaUrl(raw))) {
    return (
      <GifFrame
        payload={{ url: raw, name: 'Clip', kind: 'video' }}
      />
    );
  }
  if (raw.startsWith('data:image/') || isLegacyChatMediaUrl(raw)) {
    return <GifFrame payload={{ url: raw, name: 'Sticker', kind: 'gif' }} />;
  }
  return <div className="chat-bubble-content">{content}</div>;
}

export function messageTranslateText(content: string): string {
  const gif = parseChatGif(content);
  if (gif) return '';
  const raw = String(content || '').trim();
  if (raw.startsWith('data:') || isLegacyChatMediaUrl(raw)) return '';
  return content.replace(/\[Safety\]/g, '').trim();
}
