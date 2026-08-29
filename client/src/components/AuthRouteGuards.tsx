import { ReactNode, useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function postLoginPath(user: { profileSetupComplete?: boolean }) {
  return user.profileSetupComplete ? '/home' : '/profile-setup';
}

/** Login/signup pages — redirect signed-in users once (avoids /login ↔ /home loops). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useContext(AuthContext);

  if (!user) return <>{children}</>;
  return <Navigate to={postLoginPath(user)} replace />;
}

/** App pages that require a session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const hasToken =
    typeof localStorage !== 'undefined' && !!localStorage.getItem('token');

  if (user) return <>{children}</>;

  if (location.pathname === '/login') return <>{children}</>;

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

  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

/** Landing `/` when already signed in. */
export function LandingOrRedirect() {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  if (!user) return null;

  const target = postLoginPath(user);
  if (location.pathname === target) return null;

  return <Navigate to={target} replace />;
}
