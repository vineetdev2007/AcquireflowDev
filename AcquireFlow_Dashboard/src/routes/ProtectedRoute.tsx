import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore, selectAuth } from '../store';

type Props = {
  children: React.ReactNode;
};

export const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const auth = useAppStore(selectAuth);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let timer: any;
    // @ts-ignore
    const unsub = useAppStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
      if (timer) clearTimeout(timer);
    });
    // Fallback in case onFinishHydration is unavailable in this build
    timer = setTimeout(() => setHydrated(true), 700);
    // @ts-ignore
    if (useAppStore.persist?.hasHydrated?.()) {
      setHydrated(true);
      if (timer) clearTimeout(timer);
    }
    return () => {
      if (typeof unsub === 'function') unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);
  // Check persisted auth directly to avoid premature redirects during hydration
  let persistedAuth: any = null;
  try {
    const raw = localStorage.getItem('acquireflow-app-store');
    if (raw) persistedAuth = JSON.parse(raw)?.state?.auth || JSON.parse(raw)?.auth || null;
  } catch {}
  const hasPersistedSession = !!(persistedAuth && (persistedAuth.isAuthenticated || persistedAuth.accessToken));
  if (!hydrated || auth.isLoading || (!auth.isAuthenticated && hasPersistedSession)) {
    return <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="text-center">
        <svg className="animate-spin h-12 w-12 mx-auto text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg text-gray-600">Loading AcquireFlow...</p>
      </div>
    </div>;
  }
  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;

