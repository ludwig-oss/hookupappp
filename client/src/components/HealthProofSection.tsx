import { useCallback, useEffect, useRef, useState } from 'react';
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

type Props = {
  inRelationship?: boolean;
};

function statusDotClass(test: HealthTest | undefined, status: string): string {
  if (!test?.documentUrl) return 'missing';
  if (test.result === 'positive') return 'positive';
  if (status === 'expiring') return 'expiring';
  if (status === 'stale' || status === 'missing') return 'stale';
  return 'ok';
}

export default function HealthProofSection({ inRelationship }: Props) {
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

  return (
    <div className="profile-health-section" style={{ marginTop: 20, padding: 16, border: '1px solid rgba(0,212,255,0.3)', borderRadius: 12, background: 'rgba(0,0,0,0.2)' }}>
      <div className="highlights-title" style={{ marginBottom: 8 }}>🩺 Stamped lab reports (before you meet)</div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 10 }}>
        Go to your doctor, get tested, and upload a <strong>photo of each real report with the hospital/clinic stamp visible</strong>.
        Update at least <strong>monthly</strong> (valid for the latest <strong>2 months</strong>). Matches can request to see these only after you plan a meetup.
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
          const resultLabel = test?.result === 'positive' ? 'Positive' : test?.result === 'pending' ? 'Pending' : test ? 'Negative' : 'No proof';

          return (
            <div key={condition} className="health-proof-card">
              <div className="health-proof-card-head">
                <span className={`health-status-dot ${dotClass}`} title={resultLabel} />
                <strong style={{ fontSize: 13, flex: 1 }}>{condition}</strong>
                <span style={{ fontSize: 11, color: test?.result === 'positive' ? '#f87171' : test ? '#86efac' : '#9ca3af' }}>
                  {resultLabel}
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
              <button
                type="button"
                className="profile-location-btn"
                style={{ width: '100%', marginTop: 6, fontSize: 11 }}
                disabled={loading}
                onClick={() => openUpload(condition)}
              >
                {test?.documentUrl ? 'Replace proof' : 'Upload proof'}
              </button>
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

      {viewDoc && (
        <div className="health-doc-fullscreen" onClick={() => setViewDoc(null)}>
          <img src={viewDoc} alt="Lab report" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="profile-location-btn" style={{ marginTop: 12 }} onClick={() => setViewDoc(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
