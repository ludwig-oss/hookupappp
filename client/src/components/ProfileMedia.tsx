import { isVideoMediaUrl } from '../lib/media';

type Props = {
  src: string;
  className?: string;
  alt?: string;
};

/** Renders profile photo or looping short video clip (GIF-style). */
export default function ProfileMedia({ src, className, alt = 'Profile' }: Props) {
  if (isVideoMediaUrl(src)) {
    return <video src={src} className={className} autoPlay loop muted playsInline />;
  }
  return <img src={src} alt={alt} className={className} />;
}
