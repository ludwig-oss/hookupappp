import { createContext } from 'react';

interface AuthContextType {
  user: any;
  login: (userData: any, token: string, options?: { stayLoggedIn?: boolean }) => void;
  logout: () => void;
  updateUser: (updates: Partial<Record<string, any>>) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
});
