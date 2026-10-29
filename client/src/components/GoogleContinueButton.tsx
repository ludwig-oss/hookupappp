import { useState } from 'react';
import { redirectToOAuth } from '../lib/oauth';

function GoogleMark() {
  return (
    <svg className="google-continue-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.27A12 12 0 0 0 0 12c0 1.94.46 3.78 1.27 5.37l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export default function GoogleContinueButton({
  label = 'Continue with Google',
  disabled,
  onBusy,
  onError,
}: {
  label?: string;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    onError('');
    setBusy(true);
    onBusy?.(true);
    try {
      await redirectToOAuth('google');
    } catch (e: unknown) {
      setBusy(false);
      onBusy?.(false);
      onError(e instanceof Error ? e.message : 'Could not start Google sign-in. Try again.');
    }
  };

  return (
    <button
      type="button"
      className="google-continue-btn"
      disabled={disabled || busy}
      onClick={() => void start()}
    >
      <GoogleMark />
      <span>{busy ? 'Opening Google…' : label}</span>
    </button>
  );
}
