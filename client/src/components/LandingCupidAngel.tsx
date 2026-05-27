import './LandingCupidAngel.css';

/** Decorative cherub on the landing page — floats and “shoots” a love arrow. */
export default function LandingCupidAngel() {
  return (
    <div className="landing-cupid" aria-hidden>
      <div className="landing-cupid-inner">
        <svg viewBox="0 0 200 240" className="cupid-svg" role="img" aria-label="">
          <defs>
            <linearGradient id="lc-skin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff0e6" />
              <stop offset="100%" stopColor="#ffc9a8" />
            </linearGradient>
            <linearGradient id="lc-wing" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#ffe8f0" />
              <stop offset="100%" stopColor="#ffd0e0" />
            </linearGradient>
            <linearGradient id="lc-halo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff9c4" />
              <stop offset="100%" stopColor="#ffd54f" />
            </linearGradient>
            <linearGradient id="lc-arrow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff8fab" />
              <stop offset="100%" stopColor="#e91e63" />
            </linearGradient>
            <filter id="lc-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Soft glow behind angel */}
          <ellipse cx="100" cy="130" rx="70" ry="75" fill="rgba(255, 182, 193, 0.2)" filter="url(#lc-glow)" />

          {/* Wings (back) */}
          <g className="cupid-wings">
            <path
              fill="url(#lc-wing)"
              opacity="0.92"
              d="M38 95 C8 70 5 40 28 32 C42 48 48 72 52 88 L58 100 C40 108 38 95 38 95 Z"
            />
            <path
              fill="url(#lc-wing)"
              opacity="0.92"
              d="M162 95 C192 70 195 40 172 32 C158 48 152 72 148 88 L142 100 C160 108 162 95 162 95 Z"
            />
            <path fill="rgba(255,255,255,0.5)" d="M48 88 Q30 65 35 48 Q44 62 50 78 Z" />
            <path fill="rgba(255,255,255,0.5)" d="M152 88 Q170 65 165 48 Q156 62 150 78 Z" />
          </g>

          {/* Halo */}
          <ellipse
            className="cupid-halo"
            cx="100"
            cy="38"
            rx="32"
            ry="8"
            fill="none"
            stroke="url(#lc-halo)"
            strokeWidth="4"
            opacity="0.9"
          />

          {/* Body */}
          <ellipse cx="100" cy="145" rx="38" ry="48" fill="url(#lc-skin)" />
          {/* Head */}
          <circle cx="100" cy="82" r="34" fill="url(#lc-skin)" />
          {/* Hair curls */}
          <circle cx="78" cy="58" r="10" fill="#e8a87c" opacity="0.85" />
          <circle cx="100" cy="50" r="11" fill="#e8a87c" opacity="0.9" />
          <circle cx="122" cy="58" r="10" fill="#e8a87c" opacity="0.85" />
          {/* Face */}
          <ellipse cx="88" cy="84" rx="4" ry="5" fill="#5c4033" />
          <ellipse cx="112" cy="84" rx="4" ry="5" fill="#5c4033" />
          <path
            fill="none"
            stroke="#d4846a"
            strokeWidth="2"
            strokeLinecap="round"
            d="M90 98 Q100 106 110 98"
          />
          {/* Cheeks */}
          <circle cx="82" cy="92" r="6" fill="#ffb3c6" opacity="0.45" />
          <circle cx="118" cy="92" r="6" fill="#ffb3c6" opacity="0.45" />

          {/* Bow (held) */}
          <g className="cupid-bow">
            <path
              fill="none"
              stroke="#c44569"
              strokeWidth="3.5"
              strokeLinecap="round"
              d="M62 118 Q100 88 138 118"
            />
            <path fill="#ff6b9d" d="M58 112 L68 118 L58 124 Z" />
            <path fill="#ff6b9d" d="M142 112 L132 118 L142 124 Z" />
            <line x1="68" y1="118" x2="132" y2="118" stroke="#ff8fab" strokeWidth="1.5" opacity="0.6" />
          </g>

          {/* Love arrow — animates up/down separately */}
          <g className="cupid-arrow-group">
            <line
              x1="138"
              y1="108"
              x2="188"
              y2="58"
              stroke="url(#lc-arrow)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <polygon fill="#e91e63" points="184,54 196,62 188,70 180,62" />
            <path
              fill="#ff6b9d"
              d="M188 70 C182 64 176 68 172 74 C178 82 188 78 188 70 Z"
            />
            <path
              fill="#ff1744"
              opacity="0.9"
              d="M172 74 C168 70 164 72 162 76 C166 82 174 80 172 74 Z"
            />
          </g>

          {/* Sparkle hearts from arrow tip */}
          <g className="cupid-sparkles">
            <text x="175" y="48" fontSize="14" fill="#ff6b9d" opacity="0.9">
              ♥
            </text>
            <text x="192" y="72" fontSize="10" fill="#ff8fab" opacity="0.7">
              ♥
            </text>
            <text x="158" y="42" fontSize="8" fill="#ffb3c6" opacity="0.6">
              ♥
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
