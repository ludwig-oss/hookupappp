import { ReactNode, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/** Login/signup pages — redirect finished accounts (avoids /login ↔ /home loops). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useContext(AuthContext);

  if (!user) return <>{children}</>;
  if (user.profileSetupComplete) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

/** App pages that require a session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useContext(AuthContext);
  const hasToken =
    typeof localStorage !== 'undefined' && !!localStorage.getItem('token');

  if (user) return <>{children}</>;

  // Token without React user yet — App is restoring /me; don't flash to login
  if (hasToken) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          fontSize: '18px',
        }}
      >
        Restoring session…
      </div>
    );
  }

  return <Navigate to="/" replace />;
}
