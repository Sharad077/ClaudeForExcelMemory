import React, { useState, useCallback } from 'react';
import { Stack, initializeIcons } from '@fluentui/react';
import { StatusBar } from './components/StatusBar';
import { SearchBar } from './components/SearchBar';
import { SessionList } from './components/SessionList';
import { SessionDetail } from './components/SessionDetail';
import { useSessions } from './hooks/useSessions';

// Initialize Fluent UI icons
initializeIcons();

export const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'saved' | 'unsaved'>('all');
  const [showDetail, setShowDetail] = useState(false);

  const {
    proxyStatus,
    isConnecting,
    sessions,
    savedSessionIds,
    selectedSession,
    selectedSessionId,
    isLoadingDetail,
    isLoading,
    error,
    selectSession,
    saveSession,
    deleteSession,
    toggleCapturing,
    searchSessions,
  } = useSessions();

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      searchSessions(query);
    },
    [searchSessions]
  );

  const handleFilterChange = useCallback((mode: 'all' | 'saved' | 'unsaved') => {
    setFilterMode(mode);
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      selectSession(id);
      setShowDetail(true);
    },
    [selectSession]
  );

  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
    selectSession(null);
  }, [selectSession]);

  const handleSaveSession = useCallback(
    async (id: string) => {
      try {
        await saveSession(id);
      } catch (err) {
        console.error('Failed to save session:', err);
      }
    },
    [saveSession]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id);
        if (showDetail && selectedSessionId === id) {
          setShowDetail(false);
        }
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    },
    [deleteSession, showDetail, selectedSessionId]
  );

  const handleToggleCapture = useCallback(
    async (enabled: boolean) => {
      try {
        await toggleCapturing(enabled);
      } catch (err) {
        console.error('Failed to toggle capturing:', err);
      }
    },
    [toggleCapturing]
  );

  // Filter sessions based on filter mode
  const filteredSessions = sessions.filter((session) => {
    if (filterMode === 'saved') {
      return savedSessionIds.has(session.id);
    }
    if (filterMode === 'unsaved') {
      return !savedSessionIds.has(session.id);
    }
    return true;
  });

  return (
    <Stack styles={{ root: { height: '100vh', overflow: 'hidden' } }}>
      <StatusBar
        status={proxyStatus}
        isConnecting={isConnecting}
        onToggleCapture={handleToggleCapture}
      />

      {showDetail ? (
        <SessionDetail
          session={selectedSession}
          isLoading={isLoadingDetail}
          isSaved={selectedSessionId ? savedSessionIds.has(selectedSessionId) : false}
          onSave={() => selectedSessionId && handleSaveSession(selectedSessionId)}
          onDelete={() => selectedSessionId && handleDeleteSession(selectedSessionId)}
          onClose={handleCloseDetail}
        />
      ) : (
        <>
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            filterMode={filterMode}
            onFilterChange={handleFilterChange}
          />
          <SessionList
            sessions={filteredSessions}
            savedSessionIds={savedSessionIds}
            selectedSessionId={selectedSessionId}
            isLoading={isLoading}
            error={error}
            onSelectSession={handleSelectSession}
            onSaveSession={handleSaveSession}
            onDeleteSession={handleDeleteSession}
          />
        </>
      )}
    </Stack>
  );
};
