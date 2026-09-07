type DemoId = string;

export default function AiGuideDemo({ kind }: { kind: DemoId }) {
  if (kind === 'swipe') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <rect x="20" y="10" width="50" height="70" rx="8" fill="#1a1a1a" stroke="#f59e0b" />
        <rect x="95" y="10" width="50" height="70" rx="8" fill="#111" stroke="#444" />
        <rect x="170" y="10" width="50" height="70" rx="8" fill="#111" stroke="#333" />
        <path d="M70 45 L88 45" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#a)" />
        <text x="28" y="50" fill="#fbbf24" fontSize="9">KEEP</text>
        <text x="104" y="50" fill="#777" fontSize="9">SKIP</text>
        <defs>
          <marker id="a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>
    );
  }
  if (kind === 'texts') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <rect x="12" y="18" width="90" height="22" rx="11" fill="#333" />
        <text x="22" y="33" fill="#888" fontSize="9">hey</text>
        <rect x="138" y="18" width="90" height="22" rx="11" fill="#b45309" />
        <text x="146" y="33" fill="#fff" fontSize="8">that hike photo — where?</text>
        <text x="22" y="70" fill="#666" fontSize="8">ignored</text>
        <text x="138" y="70" fill="#fbbf24" fontSize="8">they can answer this</text>
      </svg>
    );
  }
  if (kind === 'timer') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <circle cx="120" cy="45" r="28" fill="none" stroke="#f59e0b" strokeWidth="4" />
        <line x1="120" y1="45" x2="120" y2="28" stroke="#fff" strokeWidth="3" />
        <line x1="120" y1="45" x2="136" y2="45" stroke="#fbbf24" strokeWidth="3" />
        <text x="88" y="84" fill="#fbbf24" fontSize="9">send, then leave it</text>
      </svg>
    );
  }
  if (kind === 'two-doors') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <rect x="30" y="12" width="70" height="66" rx="4" fill="#1a1a1a" stroke="#f59e0b" />
        <text x="42" y="50" fill="#fbbf24" fontSize="9">DATE</text>
        <rect x="140" y="12" width="70" height="66" rx="4" fill="#111" stroke="#555" />
        <text x="150" y="50" fill="#888" fontSize="9">MAYBE</text>
      </svg>
    );
  }
  if (kind === 'mirror') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <ellipse cx="80" cy="45" rx="28" ry="36" fill="none" stroke="#f59e0b" strokeWidth="3" />
        <circle cx="80" cy="38" r="10" fill="#f59e0b" opacity="0.4" />
        <text x="124" y="40" fill="#fff" fontSize="10">Fit + one signature</text>
        <text x="124" y="56" fill="#fbbf24" fontSize="9">not more logos</text>
      </svg>
    );
  }
  if (kind === 'photos') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <rect x="24" y="12" width="70" height="66" rx="6" fill="#1a1a1a" stroke="#f59e0b" />
        <text x="36" y="48" fill="#fbbf24" fontSize="8">PHOTO</text>
        <text x="102" y="48" fill="#f59e0b" fontSize="16">≠</text>
        <rect x="146" y="12" width="70" height="66" rx="6" fill="#111" stroke="#888" />
        <text x="160" y="48" fill="#aaa" fontSize="8">IN PERSON</text>
      </svg>
    );
  }
  if (kind === 'wallet') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <rect x="70" y="22" width="100" height="48" rx="8" fill="#1a1a1a" stroke="#f59e0b" />
        <rect x="82" y="36" width="40" height="8" rx="2" fill="#f59e0b" />
        <text x="88" y="64" fill="#fbbf24" fontSize="8">coffee &gt; dinner 1</text>
      </svg>
    );
  }
  if (kind === 'flag') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <line x1="70" y1="16" x2="70" y2="78" stroke="#aaa" strokeWidth="3" />
        <polygon points="70,16 118,32 70,48" fill="#dc2626" />
        <text x="130" y="40" fill="#fff" fontSize="10">twice = exit</text>
        <text x="130" y="56" fill="#f87171" fontSize="9">no debate</text>
      </svg>
    );
  }
  if (kind === 'heart-split') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <path d="M90 30 C90 18 74 18 74 32 C74 48 90 58 100 66 C110 58 126 48 126 32 C126 18 110 18 110 30 Z" fill="none" stroke="#f59e0b" strokeWidth="2" />
        <line x1="100" y1="22" x2="100" y2="70" stroke="#f87171" strokeWidth="2" strokeDasharray="4 3" />
        <text x="140" y="48" fill="#fbbf24" fontSize="9">pause 14 days</text>
      </svg>
    );
  }
  if (kind === 'boundary') {
    return (
      <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
        <rect x="20" y="20" width="80" height="50" rx="6" fill="#111" stroke="#555" />
        <rect x="140" y="20" width="80" height="50" rx="6" fill="#1a1a1a" stroke="#f59e0b" />
        <line x1="110" y1="10" x2="110" y2="80" stroke="#f59e0b" strokeWidth="3" />
        <text x="36" y="50" fill="#888" fontSize="8">their pace</text>
        <text x="154" y="50" fill="#fbbf24" fontSize="8">your pace</text>
      </svg>
    );
  }
  return (
    <svg className="ai-demo-svg" viewBox="0 0 240 90" aria-hidden>
      <circle cx="90" cy="40" r="8" fill="#f59e0b" />
      <circle cx="120" cy="28" r="5" fill="#fbbf24" />
      <circle cx="148" cy="42" r="7" fill="#f59e0b" opacity="0.6" />
      <text x="70" y="78" fill="#fbbf24" fontSize="9">notice · name · pause</text>
    </svg>
  );
}
