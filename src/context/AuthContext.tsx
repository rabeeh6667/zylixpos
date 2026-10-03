import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Business } from '../types/index.ts';
import { apiFetch } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  business: Business | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerBusiness: (data: any) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('zylix_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [business, setBusiness] = useState<Business | null>(() => {
    const cached = localStorage.getItem('zylix_business');
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('zylix_token'));
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      if (!token) return;
      const res = await apiFetch('/auth/me');
      if (res.success) {
        setUser(res.user);
        setBusiness(res.business);
        localStorage.setItem('zylix_user', JSON.stringify(res.user));
        localStorage.setItem('zylix_business', JSON.stringify(res.business));
      }
    } catch (err) {
      console.warn('Failed to verify session profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refreshProfile();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      setBusiness(res.business);
      localStorage.setItem('zylix_token', res.token);
      localStorage.setItem('zylix_user', JSON.stringify(res.user));
      localStorage.setItem('zylix_business', JSON.stringify(res.business));
    }
  };

  const registerBusiness = async (formData: any) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      setBusiness(res.business);
      localStorage.setItem('zylix_token', res.token);
      localStorage.setItem('zylix_user', JSON.stringify(res.user));
      localStorage.setItem('zylix_business', JSON.stringify(res.business));
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore logout network errors
    } finally {
      setToken(null);
      setUser(null);
      setBusiness(null);
      localStorage.removeItem('zylix_token');
      localStorage.removeItem('zylix_user');
      localStorage.removeItem('zylix_business');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        registerBusiness,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
