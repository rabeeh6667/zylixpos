import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, API_BASE } from '../services/api.ts';
export type NetworkStatus = 'online' | 'offline' | 'reconnecting' | 'server_unavailable';

interface NetworkContextType {
  networkStatus: NetworkStatus;
  isOnline: boolean;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  networkStatus: 'online',
  isOnline: true,
  checkConnection: async () => true,
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? 'online' : 'offline'
  );

  const checkConnection = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      setNetworkStatus('offline');
      return false;
    }

    try {
      // AbortController to enforce 4-second API timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setNetworkStatus('online');
        return true;
      } else {
        setNetworkStatus('server_unavailable');
        return false;
      }
    } catch (e: any) {
      if (!navigator.onLine) {
        setNetworkStatus('offline');
      } else {
        setNetworkStatus('server_unavailable');
      }
      return false;
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus('reconnecting');
      checkConnection();
    };

    const handleOffline = () => {
      setNetworkStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkConnection();

    // Periodic ping every 20 seconds
    const interval = setInterval(() => {
      checkConnection();
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        networkStatus,
        isOnline: networkStatus === 'online',
        checkConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
