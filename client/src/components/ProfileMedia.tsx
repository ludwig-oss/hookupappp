import { isVideoDataUrl } from './trimVideo';

export function isProfileVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (isVideoDataUrl(url)) return true;
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url) || url.includes('/video/upload/');
}

type Props = {
  src: string;
  className?: string;
  alt?: string;
};

/** Renders profile photo or looping short video clip. */
export default function ProfileMedia({ src, className, alt = 'Profile' }: Props) {
  if (isProfileVideoUrl(src)) {
    return <video src={src} className={className} autoPlay loop muted playsInline />;
  }
  return <img src={src} alt={alt} className={className} />;
}
