import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'doctor' | 'patient';
  employee_id?: string;
  department?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, role: 'doctor' | 'patient') => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on app start
    const savedToken = localStorage.getItem('contextmd_token');
    const savedUser = localStorage.getItem('contextmd_user');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        
        // Verify token is still valid
        apiService.getProfile()
          .then((profile) => {
            setUser(profile);
          })
          .catch(() => {
            // Token is invalid, clear storage
            localStorage.removeItem('contextmd_token');
            localStorage.removeItem('contextmd_user');
            setToken(null);
            setUser(null);
          });
      } catch (error) {
        // Invalid stored data, clear it
        localStorage.removeItem('contextmd_token');
        localStorage.removeItem('contextmd_user');
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, role: 'doctor' | 'patient') => {
    try {
      const response = await apiService.login(email, password, role);
      const { access_token, user: userData } = response;

      setToken(access_token);
      setUser(userData);

      // Store in localStorage
      localStorage.setItem('contextmd_token', access_token);
      localStorage.setItem('contextmd_user', JSON.stringify(userData));
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('contextmd_token');
    localStorage.removeItem('contextmd_user');
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
