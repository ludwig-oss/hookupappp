import axios from 'axios';
import { clearAuth } from './authStorage';

const FLAG = 'hookup_logged_out';

export function isLoggedOutFlag(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export function clearLoggedOutFlag(): void {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    /* private mode */
  }
}

let leaving = false;

/** Drop the saved session and open Sign in. Safe to call more than once. */
export function endSession(to = '/login'): void {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    /* private mode */
  }
  clearAuth();
  delete axios.defaults.headers.common['Authorization'];
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path === to) return;
  if (leaving) return;
  leaving = true;
  window.location.replace(to);
}
