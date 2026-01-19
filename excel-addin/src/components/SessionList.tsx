import React from 'react';
import {
  Stack,
  Text,
  IconButton,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
} from '@fluentui/react';
import { SessionSummary } from '../types';

interface SessionListProps {
  sessions: SessionSummary[];
  savedSessionIds: Set<string>;
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectSession: (id: string) => void;
  onSaveSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

interface SessionItemProps {
  session: SessionSummary;
  isSaved: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onSave: () => void;
  onDelete: () => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isSaved,
  isSelected,
  onSelect,
  onSave,
  onDelete,
}) => {
  return (
    <Stack
      onClick={onSelect}
      styles={{
        root: {
          padding: '10px 12px',
          borderBottom: '1px solid #edebe9',
          backgroundColor: isSelected ? '#e1dfdd' : 'transparent',
          cursor: 'pointer',
          ':hover': {
            backgroundColor: isSelected ? '#e1dfdd' : '#f3f2f1',
          },
        },
      }}
    >
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Stack horizontal tokens={{ childrenGap: 6 }} verticalAlign="center">
          <Text variant="small" styles={{ root: { color: '#605e5c' } }}>
            {formatDate(session.captured_at)}
          </Text>
          {isSaved && (
            <Text
              variant="tiny"
              styles={{
                root: {
                  backgroundColor: '#107c10',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: 2,
                },
              }}
            >
              Saved
            </Text>
          )}
        </Stack>
        <Stack horizontal tokens={{ childrenGap: 4 }}>
          {!isSaved && (
            <IconButton
              iconProps={{ iconName: 'Save' }}
              title="Save to workbook"
              ariaLabel="Save to workbook"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              styles={{ root: { height: 24, width: 24 } }}
            />
          )}
          <IconButton
            iconProps={{ iconName: 'Delete' }}
            title="Delete session"
            ariaLabel="Delete session"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            styles={{ root: { height: 24, width: 24 } }}
          />
        </Stack>
      </Stack>
      <Text
        variant="medium"
        styles={{
          root: {
            marginTop: 4,
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          },
        }}
      >
        {truncateText(session.user_prompt_preview, 100) || 'No preview available'}
      </Text>
      <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 6 } }}>
        <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
          {session.model || 'Unknown model'}
        </Text>
        {session.input_tokens !== null && session.output_tokens !== null && (
          <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
            {session.input_tokens + session.output_tokens} tokens
          </Text>
        )}
      </Stack>
    </Stack>
  );
};

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  savedSessionIds,
  selectedSessionId,
  isLoading,
  error,
  onSelectSession,
  onSaveSession,
  onDeleteSession,
}) => {
  if (isLoading) {
    return (
      <Stack
        verticalAlign="center"
        horizontalAlign="center"
        styles={{ root: { padding: 40 } }}
      >
        <Spinner size={SpinnerSize.medium} label="Loading sessions..." />
      </Stack>
    );
  }

  if (error) {
    return (
      <MessageBar messageBarType={MessageBarType.error} styles={{ root: { margin: 12 } }}>
        {error}
      </MessageBar>
    );
  }

  if (sessions.length === 0) {
    return (
      <Stack
        verticalAlign="center"
        horizontalAlign="center"
        styles={{ root: { padding: 40 } }}
      >
        <Text variant="medium" styles={{ root: { color: '#605e5c' } }}>
          No sessions captured yet
        </Text>
        <Text
          variant="small"
          styles={{ root: { color: '#a19f9d', marginTop: 8, textAlign: 'center' } }}
        >
          Use Claude for Excel to start capturing sessions
        </Text>
      </Stack>
    );
  }

  return (
    <Stack styles={{ root: { overflowY: 'auto', flexGrow: 1 } }}>
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isSaved={savedSessionIds.has(session.id)}
          isSelected={selectedSessionId === session.id}
          onSelect={() => onSelectSession(session.id)}
          onSave={() => onSaveSession(session.id)}
          onDelete={() => onDeleteSession(session.id)}
        />
      ))}
    </Stack>
  );
};
