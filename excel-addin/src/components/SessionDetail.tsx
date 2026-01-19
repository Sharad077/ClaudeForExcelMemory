import React from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Spinner,
  SpinnerSize,
  Separator,
  IconButton,
} from '@fluentui/react';
import { CapturedSession } from '../types';

interface SessionDetailProps {
  session: CapturedSession | null;
  isLoading: boolean;
  isSaved: boolean;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content }) => {
  const isUser = role === 'user';

  return (
    <Stack
      styles={{
        root: {
          maxWidth: '90%',
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 12,
        },
      }}
    >
      <Text
        variant="tiny"
        styles={{
          root: {
            color: '#605e5c',
            marginBottom: 4,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
          },
        }}
      >
        {isUser ? 'You' : 'Claude'}
      </Text>
      <Stack
        styles={{
          root: {
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: isUser ? '#0078d4' : '#f3f2f1',
            color: isUser ? 'white' : '#323130',
          },
        }}
      >
        <Text
          variant="small"
          styles={{
            root: {
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            },
          }}
        >
          {content}
        </Text>
      </Stack>
    </Stack>
  );
};

export const SessionDetail: React.FC<SessionDetailProps> = ({
  session,
  isLoading,
  isSaved,
  onSave,
  onDelete,
  onClose,
}) => {
  if (isLoading) {
    return (
      <Stack
        verticalAlign="center"
        horizontalAlign="center"
        styles={{ root: { padding: 40, flexGrow: 1 } }}
      >
        <Spinner size={SpinnerSize.medium} label="Loading session..." />
      </Stack>
    );
  }

  if (!session) {
    return (
      <Stack
        verticalAlign="center"
        horizontalAlign="center"
        styles={{ root: { padding: 40, flexGrow: 1 } }}
      >
        <Text variant="medium" styles={{ root: { color: '#605e5c' } }}>
          Select a session to view details
        </Text>
      </Stack>
    );
  }

  return (
    <Stack styles={{ root: { height: '100%', display: 'flex', flexDirection: 'column' } }}>
      {/* Header */}
      <Stack
        horizontal
        horizontalAlign="space-between"
        verticalAlign="center"
        styles={{
          root: {
            padding: '12px',
            borderBottom: '1px solid #edebe9',
          },
        }}
      >
        <Stack>
          <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
            Session Details
          </Text>
          <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
            {formatDate(session.captured_at)}
          </Text>
        </Stack>
        <IconButton
          iconProps={{ iconName: 'Cancel' }}
          title="Close"
          ariaLabel="Close"
          onClick={onClose}
        />
      </Stack>

      {/* Metadata */}
      <Stack
        horizontal
        tokens={{ childrenGap: 16 }}
        styles={{
          root: {
            padding: '8px 12px',
            backgroundColor: '#faf9f8',
            borderBottom: '1px solid #edebe9',
          },
        }}
      >
        <Stack>
          <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
            Model
          </Text>
          <Text variant="small">{session.model || 'Unknown'}</Text>
        </Stack>
        <Stack>
          <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
            Input Tokens
          </Text>
          <Text variant="small">{session.input_tokens?.toLocaleString() || '-'}</Text>
        </Stack>
        <Stack>
          <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
            Output Tokens
          </Text>
          <Text variant="small">{session.output_tokens?.toLocaleString() || '-'}</Text>
        </Stack>
        {isSaved && (
          <Text
            variant="small"
            styles={{
              root: {
                backgroundColor: '#107c10',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 4,
                alignSelf: 'center',
              },
            }}
          >
            Saved
          </Text>
        )}
      </Stack>

      {/* Messages */}
      <Stack
        styles={{
          root: {
            flexGrow: 1,
            overflowY: 'auto',
            padding: 12,
          },
        }}
      >
        {(() => {
          // Try to parse messages from request_body for full conversation
          try {
            const data = JSON.parse(session.request_body);
            if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
              return data.messages.map((msg: { role: 'user' | 'assistant'; content: string }, index: number) => (
                <MessageBubble key={index} role={msg.role} content={msg.content} />
              ));
            }
          } catch {
            // Fall back to simple display
          }

          // Fallback: show user_prompt and assistant_response if no parsed messages
          return (
            <>
              {session.user_prompt && (
                <MessageBubble role="user" content={session.user_prompt} />
              )}
              {session.assistant_response && (
                <MessageBubble role="assistant" content={session.assistant_response} />
              )}
              {!session.user_prompt && !session.assistant_response && (
                <Text variant="small" styles={{ root: { color: '#605e5c', fontStyle: 'italic' } }}>
                  No message content available
                </Text>
              )}
            </>
          );
        })()}
      </Stack>

      <Separator />

      {/* Actions */}
      <Stack
        horizontal
        tokens={{ childrenGap: 8 }}
        styles={{
          root: {
            padding: 12,
          },
        }}
      >
        {!isSaved && (
          <PrimaryButton text="Save to Workbook" onClick={onSave} />
        )}
        <DefaultButton
          text="Delete"
          onClick={onDelete}
          styles={{
            root: { color: '#a80000' },
            rootHovered: { color: '#a80000' },
          }}
        />
      </Stack>
    </Stack>
  );
};
