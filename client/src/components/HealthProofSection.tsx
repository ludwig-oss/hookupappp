import { useCallback, useEffect, useRef, useState, type ReactNode, type Touch } from 'react';
import {
  healthAPI,
  HealthComplianceStatus,
  HealthResults,
  HealthTest,
  HealthTestResult,
  HealthViewRequest,
  HEALTH_LEGAL_TEXT,
  REQUIRED_STI_CONDITIONS,
} from '../api/health';
import { prepareMediaForUpload } from '../lib/prepareMediaUpload';
import './HealthProofSection.css';

type OwnProps = {
  mode?: 'own';
  inRelationship?: boolean;
};

type VisitorProps = {
  mode: 'visitor';
  visitorTests?: HealthTest[];
  visitorLastUpdated?: string | null;
  /** Request / pending copy. Never includes upload. */
  visitorGate?: ReactNode;
};

type Props = OwnProps | VisitorProps;

function statusDotClass(test: HealthTest | undefined, status: string): string {
  if (!test?.documentUrl) return 'missing';
  if (test.result === 'positive') return 'positive';
  if (status === 'expiring') return 'expiring';
  if (status === 'stale' || status === 'missing') return 'stale';
  return 'ok';
}

function resultLabel(test: HealthTest | undefined): string {
  if (!test?.documentUrl) return 'No proof';
  if (test.result === 'positive') return 'Positive';
  if (test.result === 'pending') return 'Pending';
  return 'Negative';
}

function pinchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function HealthDocZoom({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const clamp = (n: number) => Math.min(4, Math.max(0.6, n));
  return (
    <div className="health-doc-fullscreen" role="dialog" aria-modal>
      <div className="health-zoom-toolbar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="profile-location-btn" onClick={() => setZoom((z) => clamp(z - 0.25))}>Zoom out</button>
        <button type="button" className="profile-location-btn" onClick={() => setZoom(1)}>Reset</button>
        <button type="button" className="profile-location-btn" onClick={() => setZoom((z) => clamp(z + 0.25))}>Zoom in</button>
        <button type="button" className="profile-save-btn" style={{ padding: '6px 12px' }} onClick={onClose}>Close</button>
      </div>
      <div
        className="health-zoom-stage"
        onClick={onClose}
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => clamp(z + (e.deltaY < 0 ? 0.15 : -0.15)));
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            pinchRef.current = {
              startDist: pinchDistance(e.touches[0], e.touches[1]),
              startZoom: zoom,
            };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchRef.current) {
            e.preventDefault();
            const dist = pinchDistance(e.touches[0], e.touches[1]);
            setZoom(clamp(pinchRef.current.startZoom * (dist / pinchRef.current.startDist)));
          }
        }}
        onTouchEnd={() => {
          pinchRef.current = null;
        }}
      >
        <img
          src={src}
          alt="Lab report"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

function VisitorReports({
  tests,
  lastUpdated,
  gate,
}: {
  tests: HealthTest[];
  lastUpdated?: string | null;
  gate?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const withDocs = tests.filter((t) => t.documentUrl);

  return (
    <div className="health-stamped-wrap">
      <button type="button" className="health-stamped-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>STAMPED REPORTS</span>
        <span className="health-stamped-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="health-stamped-body">
          {gate}
          {!gate && lastUpdated && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}>
              Last updated: {new Date(lastUpdated).toLocaleDateString()}
            </p>
          )}
          {!gate && withDocs.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>No stamped documents shared yet.</p>
          ) : null}
          {!gate && withDocs.length > 0 && (
            <div className="health-proof-grid">
              {withDocs.map((t) => {
                const openCard = expandedId === t.id;
                return (
                  <div key={t.id} className="health-proof-card">
                    <button
                      type="button"
                      className="health-proof-card-head health-proof-card-head-btn"
                      onClick={() => setExpandedId(openCard ? null : t.id)}
                    >
                      <span className={`health-status-dot ${t.result === 'positive' ? 'positive' : t.result === 'pending' ? 'expiring' : 'ok'}`} />
                      <strong style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>{t.condition}</strong>
                      <span style={{ fontSize: 11, color: t.result === 'positive' ? '#f87171' : '#86efac' }}>
                        {t.result === 'positive' ? 'Positive' : t.result === 'pending' ? 'Pending' : 'Negative'}
                      </span>
                      <span className="health-stamped-chevron">{openCard ? '▾' : '▸'}</span>
                    </button>
                    {openCard && t.documentUrl && (
                      <>
                        <img
                          src={t.documentUrl}
                          alt={`${t.condition} lab report`}
                          className="health-doc-preview"
                          onClick={() => setViewDoc(t.documentUrl!)}
                        />
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                          Test date: {new Date(t.testedAt).toLocaleDateString()} · tap photo to zoom
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {viewDoc && <HealthDocZoom src={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

function OwnReports({ inRelationship }: OwnProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<HealthResults | null>(null);
  const [compliance, setCompliance] = useState<HealthComplianceStatus | null>(null);
  const [requests, setRequests] = useState<{ incoming: HealthViewRequest[]; outgoing: HealthViewRequest[] }>({
    incoming: [],
    outgoing: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadCondition, setUploadCondition] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<HealthTestResult>('clear');
  const [testedAt, setTestedAt] = useState(new Date().toISOString().slice(0, 10));
  const [signatureName, setSignatureName] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, reqs] = await Promise.all([healthAPI.getMyResults(), healthAPI.getMyRequests()]);
      setResults(data.results);
      setCompliance(data.compliance);
      setRequests(reqs);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Could not load health proofs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const testForCondition = (condition: string): HealthTest | undefined => {
    const fromCompliance = compliance?.byCondition?.[condition]?.test;
    if (fromCompliance?.documentUrl) return fromCompliance;
    return results?.tests
      ?.filter((t) => t.condition === condition && t.documentUrl)
      .sort((a, b) => new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime())[0];
  };

  const openUpload = (condition: string) => {
    setUploadCondition(condition);
    setUploadResult('clear');
    setTestedAt(new Date().toISOString().slice(0, 10));
    setSignatureName('');
    setLegalAccepted(false);
    setPendingDoc(null);
    setPreviewDoc(null);
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingDoc(reader.result as string);
      setPreviewDoc(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const submitProof = async () => {
    if (!uploadCondition || !pendingDoc) {
      setError('Add a photo of your stamped lab report.');
      return;
    }
    if (!signatureName.trim()) {
      setError('Type your full name to sign.');
      return;
    }
    if (!legalAccepted) {
      setError('You must agree to the legal statement.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const documentImage = await prepareMediaForUpload(pendingDoc);
      const res = await healthAPI.uploadProof({
        condition: uploadCondition,
        result: uploadResult,
        testedAt: new Date(testedAt).toISOString(),
        documentImage,
        signatureName: signatureName.trim(),
        legalAccepted: true,
      });
      setResults(res.results);
      setCompliance(res.compliance);
      setUploadCondition(null);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setError(ax.response?.data?.error || ax.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const removeProof = async (test: HealthTest) => {
    if (!test.id || !confirm(`Remove ${test.condition} proof so you can upload a new one?`)) return;
    setLoading(true);
    setError('');
    try {
      const res = await healthAPI.deleteTest(test.id);
      setResults(res.results);
      setCompliance(res.compliance);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Could not remove proof');
    } finally {
      setLoading(false);
    }
  };

  const headerBadge = !compliance?.exempt && compliance?.warningMessage
    ? (compliance.limited ? 'Needs update' : 'Expires soon')
    : null;

  return (
    <div className="profile-health-section health-stamped-wrap" style={{ marginTop: 20 }}>
      <button type="button" className="health-stamped-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>STAMPED REPORTS</span>
        {headerBadge && (
          <span className={`health-stamped-badge ${compliance?.limited ? 'warn' : 'soon'}`}>{headerBadge}</span>
        )}
        <span className="health-stamped-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {headerBadge && !open && (
        <p className={`health-stamped-compact-warn ${compliance?.limited ? 'warn' : 'soon'}`}>
          {compliance?.limited
            ? 'Proofs missing or older than 30 days — tap STAMPED REPORTS to update.'
            : 'Reports expire soon — tap STAMPED REPORTS to update before they run out.'}
        </p>
      )}

      {open && (
        <div className="health-stamped-body">
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 10 }}>
            Go to your doctor, get tested, and upload a <strong>photo of each real report with the hospital/clinic stamp visible</strong>.
            Update at least <strong>monthly</strong> (valid for the latest <strong>2 months</strong>). You will get a reminder before they expire. Matches can request these only after you plan a meetup.
          </p>

          {inRelationship || compliance?.exempt ? (
            <p style={{ fontSize: 12, color: '#86efac', marginBottom: 10 }}>
              You&apos;re in a relationship — monthly STI proof requirements are paused.
            </p>
          ) : null}

          {compliance?.warningMessage && !compliance.exempt && (
            <p style={{ fontSize: 12, color: compliance.limited ? '#fca5a5' : '#fde047', marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.35)' }}>
              {compliance.warningMessage}
            </p>
          )}

          {compliance?.lastUpdated && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}>
              Last updated: {new Date(compliance.lastUpdated).toLocaleDateString()}
            </p>
          )}

          {error && (
            <p style={{ fontSize: 12, color: '#fca5a5', marginBottom: 10 }}>{error}</p>
          )}

          <div className="health-proof-grid">
            {REQUIRED_STI_CONDITIONS.map((condition) => {
              const meta = compliance?.byCondition?.[condition];
              const test = testForCondition(condition);
              const status = meta?.status || (test ? 'ok' : 'missing');
              const dotClass = statusDotClass(test, status);
              const label = resultLabel(test);

              return (
                <div key={condition} className="health-proof-card">
                  <div className="health-proof-card-head">
                    <span className={`health-status-dot ${dotClass}`} title={label} />
                    <strong style={{ fontSize: 13, flex: 1 }}>{condition}</strong>
                    <span style={{ fontSize: 11, color: test?.result === 'positive' ? '#f87171' : test ? '#86efac' : '#9ca3af' }}>
                      {label}
                    </span>
                  </div>
                  {test?.documentUrl ? (
                    <>
                      <img
                        src={test.documentUrl}
                        alt={`${condition} lab report`}
                        className="health-doc-preview"
                        onClick={() => setViewDoc(test.documentUrl!)}
                      />
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                        Test date: {new Date(test.testedAt).toLocaleDateString()}
                        {test.signedAt ? ` · Signed ${new Date(test.signedAt).toLocaleDateString()}` : ''}
                      </p>
                    </>
                  ) : (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>Upload stamped proof</p>
                  )}
                  {status === 'expiring' && (
                    <p style={{ fontSize: 10, color: '#fde047', margin: '4px 0 0' }}>
                      Reminder: update this report soon (refresh every 30 days).
                    </p>
                  )}
                  {status === 'stale' && (
                    <p style={{ fontSize: 10, color: '#fca5a5', margin: '4px 0 0' }}>
                      Older than 30 days — remove and upload a new stamped report.
                    </p>
                  )}
                  <div className="health-own-actions">
                    <button
                      type="button"
                      className="profile-location-btn"
                      style={{ flex: 1, fontSize: 11 }}
                      disabled={loading}
                      onClick={() => openUpload(condition)}
                    >
                      {test?.documentUrl ? 'Update proof' : 'Upload proof'}
                    </button>
                    {test?.id && (
                      <button
                        type="button"
                        className="profile-location-btn"
                        style={{ fontSize: 11, borderColor: '#f87171', color: '#f87171' }}
                        disabled={loading}
                        onClick={() => removeProof(test)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {requests.incoming.filter((r) => r.status === 'pending').length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="highlights-title" style={{ marginBottom: 8 }}>Requests to see your reports</div>
              {requests.incoming.filter((r) => r.status === 'pending').map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{r.fromUser?.name || 'Someone'} wants to see your stamped lab reports before meeting</span>
                  <button type="button" className="profile-save-btn" style={{ padding: '6px 12px', fontSize: 12 }} disabled={loading} onClick={async () => {
                    setLoading(true);
                    try {
                      await healthAPI.respondToRequest(r.id, true);
                      await load();
                    } finally {
                      setLoading(false);
                    }
                  }}>Approve</button>
                  <button type="button" className="profile-location-btn" style={{ padding: '6px 12px', fontSize: 12 }} disabled={loading} onClick={async () => {
                    setLoading(true);
                    try {
                      await healthAPI.respondToRequest(r.id, false);
                      await load();
                    } finally {
                      setLoading(false);
                    }
                  }}>Decline</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFilePicked} />

      {uploadCondition && (
        <div className="health-upload-modal" role="dialog" aria-modal>
          <div className="health-upload-panel">
            <h3 style={{ margin: '0 0 8px', color: '#00d4ff', fontSize: 16 }}>Upload {uploadCondition} proof</h3>
            <div className="health-legal-box">
              <strong style={{ color: '#fca5a5' }}>Legal agreement</strong>
              <p style={{ margin: '8px 0 0' }}>{HEALTH_LEGAL_TEXT}</p>
              <p style={{ margin: '8px 0 0' }}>
                Forging a test may result in a <strong>€4,000 fine</strong>, and a harmed partner may <strong>sue you</strong>.
              </p>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, marginBottom: 10 }}>
              <input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} />
              <span>I agree — this is my real stamped lab report and I accept the terms above.</span>
            </label>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>What does the report show?</label>
            <select value={uploadResult} onChange={(e) => setUploadResult(e.target.value as HealthTestResult)} className="profile-input" style={{ width: '100%', marginBottom: 8 }}>
              <option value="clear">Negative / clear</option>
              <option value="positive">Positive</option>
              <option value="pending">Pending</option>
            </select>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Test date on the report</label>
            <input type="date" value={testedAt} onChange={(e) => setTestedAt(e.target.value)} className="profile-input" style={{ width: '100%', marginBottom: 8 }} />
            <button type="button" className="profile-location-btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => fileRef.current?.click()}>
              {previewDoc ? 'Change photo' : 'Take / choose photo of stamped report'}
            </button>
            {previewDoc && (
              <img src={previewDoc} alt="Preview" className="health-doc-preview" style={{ marginBottom: 8 }} onClick={() => setViewDoc(previewDoc)} />
            )}
            <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Virtual signature (full legal name)</label>
            <input type="text" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Your full name" className="profile-input" style={{ width: '100%', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="profile-save-btn" disabled={loading} onClick={submitProof}>
                {loading ? 'Uploading…' : 'Submit proof'}
              </button>
              <button type="button" className="profile-location-btn" disabled={loading} onClick={() => setUploadCondition(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewDoc && <HealthDocZoom src={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

export default function HealthProofSection(props: Props) {
  if (props.mode === 'visitor') {
    return (
      <VisitorReports
        tests={props.visitorTests || []}
        lastUpdated={props.visitorLastUpdated}
        gate={props.visitorGate}
      />
    );
  }
  return <OwnReports inRelationship={props.inRelationship} />;
}
