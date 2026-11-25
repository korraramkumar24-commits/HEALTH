import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const readCachedUser = () => {
  try {
    const cached = JSON.parse(localStorage.getItem('user') || 'null');
    if (
      cached
      && typeof cached.name === 'string'
      && ['patient', 'doctor', 'admin'].includes(cached.role)
      && (typeof cached.id === 'string' || typeof cached._id === 'string')
    ) return cached;
  } catch {
    return null;
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth:logout', handleUnauthorized);

    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/profile');
        const currentUser = response.data?.data?.user;

        if (currentUser) {
          setUser(currentUser);
          localStorage.setItem('user', JSON.stringify(currentUser));
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch {
        if (!navigator.onLine) {
          setUser(readCachedUser());
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
    return () => window.removeEventListener('auth:logout', handleUnauthorized);
  }, []);

  const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const authData = response.data?.data;

    if (authData?.token) {
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
      setUser(authData.user);
    }

    return response.data;
  };

  const register = async (credentials) => {
    const response = await api.post('/auth/register', credentials);
    const authData = response.data?.data;

    if (authData?.token) {
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
      setUser(authData.user);
    }

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
