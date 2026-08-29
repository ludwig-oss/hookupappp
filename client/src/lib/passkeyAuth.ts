import axios from 'axios';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { API_BASE } from '../api/config';

const API_URL = API_BASE + '/api/auth';

function authHeaders(token?: string) {
  const t = token || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function registerPasskey(token?: string): Promise<string> {
  const optsRes = await axios.post(`${API_URL}/passkey/register/options`, {}, { headers: authHeaders(token) });
  const attResp = await startRegistration({ optionsJSON: optsRes.data });
  const verifyRes = await axios.post(`${API_URL}/passkey/register/verify`, attResp, { headers: authHeaders(token) });
  return verifyRes.data.message || 'Face ID registered';
}

export async function loginWithPasskey(username: string): Promise<{ token: string; user: Record<string, unknown> }> {
  const optsRes = await axios.post(`${API_URL}/passkey/login/options`, { username: username.trim() });
  const { options, userId } = optsRes.data as { options: PublicKeyCredentialRequestOptions; userId: string };
  const assertion = await startAuthentication({ optionsJSON: options });
  const verifyRes = await axios.post(`${API_URL}/passkey/login/verify`, { ...assertion, userId });
  return verifyRes.data;
}

export async function getPasskeyStatus(): Promise<{ registered: boolean; count: number }> {
  const res = await axios.get(`${API_URL}/passkey/status`);
  return res.data;
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

/** After face sign-up: register device Face ID (passkey) using the new session token. */
export async function registerDeviceFaceId(token: string): Promise<void> {
  if (!passkeysSupported()) return;
  try {
    await registerPasskey(token);
  } catch {
    /* optional — user can register later in Settings */
  }
}
