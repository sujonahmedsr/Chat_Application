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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      let storedToken = typeof window !== 'undefined' ? localStorage.getItem('chat_token') : null;

      // Extract OAuth callback token directly if present in URL
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
          storedToken = urlToken;
          localStorage.setItem('chat_token', urlToken);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      if (!storedToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      setToken(storedToken);
      const data = await apiRequest('/auth/me');
      setUser(data.user);
    } catch (err) {
      console.error('Failed to load current user:', err);
      localStorage.removeItem('chat_token');
      setToken(null);
      setUser(null);
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
    setToken(data.token);
    setUser(data.user);
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
    setToken(data.token);
    setUser(data.user);
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
    return data.user;
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    localStorage.setItem('chat_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Continue client cleanup even if network fails
    } finally {
      localStorage.removeItem('chat_token');
      setToken(null);
      setUser(null);
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
