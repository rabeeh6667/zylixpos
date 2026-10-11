
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { API_BASE } from '../services/api';

export type NetworkStatus =
  | 'online'
  | 'offline'
  | 'reconnecting'
  | 'server_unavailable';

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

export const NetworkProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? 'online' : 'offline'
  );

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      setNetworkStatus('offline');
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      // API_BASE already ends with /api, so this resolves to /api/health.
      const healthUrl = `${API_BASE.replace(/\/+$/, '')}/health`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.ok) {
        setNetworkStatus('online');
        return true;
      }

      setNetworkStatus('server_unavailable');
      return false;
    } catch {
      setNetworkStatus(
        navigator.onLine ? 'server_unavailable' : 'offline'
      );
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus('reconnecting');
      void checkConnection();
    };

    const handleOffline = () => {
      setNetworkStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    void checkConnection();

    const intervalId = window.setInterval(() => {
      void checkConnection();
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
    };
  }, [checkConnection]);

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
