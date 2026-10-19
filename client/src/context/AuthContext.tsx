'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types';
import { apiRequest } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (payload: {
    credential?: string;
    email?: string;
    name?: string;
    avatar?: string;
    googleId?: string;
  }) => Promise<User>;
  updateProfile: (data: {
    name?: string;
    username?: string;
    avatar?: string;
    bio?: string;
    settings?: {
      saveChatHistory?: boolean;
      chatRetentionDays?: number;
      hasCompletedSetup?: boolean;
    };
  }) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('chat_user');
        return cached ? JSON.parse(cached) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chat_token');
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // If user & token exist in cache, unlock UI in 0ms!
      return !localStorage.getItem('chat_token') || !localStorage.getItem('chat_user');
    }
    return true;
  });

  const refreshUser = async () => {
    try {
      let storedToken = typeof window !== 'undefined' ? localStorage.getItem('chat_token') : null;
      let storedUser = typeof window !== 'undefined' ? localStorage.getItem('chat_user') : null;

      // Extract OAuth callback token and user payload directly if present in URL
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const urlUser = params.get('user');

        if (urlToken) {
          storedToken = urlToken;
          localStorage.setItem('chat_token', urlToken);
          setToken(urlToken);
        }

        if (urlUser) {
          try {
            const parsedUser = JSON.parse(decodeURIComponent(urlUser));
            storedUser = JSON.stringify(parsedUser);
            localStorage.setItem('chat_user', storedUser);
            setUser(parsedUser);
            setLoading(false); // 0ms instant display!
          } catch (e) {}
        }

        if (urlToken || urlUser) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      if (storedUser && !user) {
        try {
          setUser(JSON.parse(storedUser));
          setLoading(false);
        } catch (e) {}
      }

      if (!storedToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      setToken(storedToken);

      // Background revalidation with /auth/me (stale-while-revalidate pattern)
      const data = await apiRequest('/auth/me');
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem('chat_user', JSON.stringify(data.user));
      }
    } catch (err: any) {
      console.warn('Session background validation notice:', err?.message || err);
      // Only wipe session if server explicitly rejected with 401 Unauthorized
      if (err instanceof Error && (err.message.includes('401') || err.message.includes('token') || err.message.includes('Authentication required'))) {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('chat_token', data.token);
    localStorage.setItem('chat_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
  };

  const googleLogin = async (payload: {
    credential?: string;
    email?: string;
    name?: string;
    avatar?: string;
    googleId?: string;
  }) => {
    const data = await apiRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    localStorage.setItem('chat_token', data.token);
    localStorage.setItem('chat_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
    return data.user;
  };

  const updateProfile = async (updateData: {
    name?: string;
    username?: string;
    avatar?: string;
    bio?: string;
    settings?: {
      saveChatHistory?: boolean;
      chatRetentionDays?: number;
      hasCompletedSetup?: boolean;
    };
  }) => {
    const data = await apiRequest('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    setUser(data.user);
    localStorage.setItem('chat_user', JSON.stringify(data.user));
    return data.user;
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    localStorage.setItem('chat_token', data.token);
    localStorage.setItem('chat_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Continue client cleanup even if network fails
    } finally {
      localStorage.removeItem('chat_token');
      localStorage.removeItem('chat_user');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        googleLogin,
        updateProfile,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
