import { useState, useEffect, useCallback } from 'react';
import {
  getProxyStatus,
  getAllSessions,
  getSessionById,
  deleteSession as apiDeleteSession,
  setCapturing,
  createPollingInterval,
} from '../services/proxyApi';
import {
  getSavedSessions,
  addSession,
  removeSession,
  convertCapturedToSaved,
} from '../services/storage';
import { SessionSummary, CapturedSession, ProxyStatus, SavedSession } from '../types';

interface UseSessionsResult {
  // Proxy status
  proxyStatus: ProxyStatus | null;
  isConnecting: boolean;

  // Sessions
  sessions: SessionSummary[];
  savedSessions: SavedSession[];
  savedSessionIds: Set<string>;

  // Selected session
  selectedSession: CapturedSession | null;
  selectedSessionId: string | null;
  isLoadingDetail: boolean;

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Actions
  refreshSessions: () => Promise<void>;
  selectSession: (id: string | null) => void;
  saveSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  toggleCapturing: (enabled: boolean) => Promise<void>;
  searchSessions: (query: string) => Promise<void>;
}

export function useSessions(): UseSessionsResult {
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<CapturedSession | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedSessionIds = new Set(savedSessions.map((s) => s.id));

  const checkProxyStatus = useCallback(async () => {
    try {
      const status = await getProxyStatus();
      setProxyStatus(status);
      setIsConnecting(false);
    } catch {
      setProxyStatus(null);
      setIsConnecting(false);
    }
  }, []);

  const loadSavedSessions = useCallback(async () => {
    try {
      // Check if Excel API is available
      if (typeof Excel === 'undefined' || !Excel.run) {
        console.warn('Excel API not available yet, skipping saved sessions load');
        return;
      }
      const saved = await getSavedSessions();
      setSavedSessions(saved);
    } catch (err) {
      console.error('Failed to load saved sessions:', err);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      setError(null);
      const sessionList = await getAllSessions();
      setSessions(sessionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectSession = useCallback(async (id: string | null) => {
    setSelectedSessionId(id);

    if (!id) {
      setSelectedSession(null);
      return;
    }

    setIsLoadingDetail(true);
    try {
      const session = await getSessionById(id);
      setSelectedSession(session);
    } catch (err) {
      console.error('Failed to load session detail:', err);
      setSelectedSession(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const saveSession = useCallback(async (id: string) => {
    try {
      const session = await getSessionById(id);
      const savedSession = convertCapturedToSaved(session);
      await addSession(savedSession);
      await loadSavedSessions();
    } catch (err) {
      console.error('Failed to save session:', err);
      throw err;
    }
  }, [loadSavedSessions]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      // Remove from proxy service
      await apiDeleteSession(id);

      // Also remove from saved sessions if it exists
      if (savedSessionIds.has(id)) {
        await removeSession(id);
        await loadSavedSessions();
      }

      // Clear selection if this session was selected
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
        setSelectedSession(null);
      }

      // Refresh session list
      await refreshSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
      throw err;
    }
  }, [savedSessionIds, selectedSessionId, loadSavedSessions, refreshSessions]);

  const toggleCapturing = useCallback(async (enabled: boolean) => {
    try {
      await setCapturing(enabled);
      await checkProxyStatus();
    } catch (err) {
      console.error('Failed to toggle capturing:', err);
      throw err;
    }
  }, [checkProxyStatus]);

  const searchSessions = useCallback(async (query: string) => {
    try {
      setError(null);
      const sessionList = await getAllSessions(query);
      setSessions(sessionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await checkProxyStatus();
      await loadSavedSessions();
      await refreshSessions();
    };
    init();
  }, [checkProxyStatus, loadSavedSessions, refreshSessions]);

  // Poll for updates
  useEffect(() => {
    const stopPolling = createPollingInterval(async () => {
      await checkProxyStatus();
      await refreshSessions();
    }, 5000);

    return stopPolling;
  }, [checkProxyStatus, refreshSessions]);

  return {
    proxyStatus,
    isConnecting,
    sessions,
    savedSessions,
    savedSessionIds,
    selectedSession,
    selectedSessionId,
    isLoadingDetail,
    isLoading,
    error,
    refreshSessions,
    selectSession,
    saveSession,
    deleteSession,
    toggleCapturing,
    searchSessions,
  };
}
