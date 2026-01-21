import React, { useState, useMemo } from 'react';
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
import { compressConversation } from '../utils/textRank';

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
  const [isCompressed, setIsCompressed] = useState(false);

  // Parse and optionally compress messages
  const messages = useMemo(() => {
    if (!session) return [];

    try {
      const data = JSON.parse(session.request_body);
      if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        const msgs = data.messages as Array<{ role: 'user' | 'assistant'; content: string }>;
        return isCompressed ? compressConversation(msgs, 0.3) : msgs;
      }
    } catch {
      // Fall back to user_prompt/assistant_response
    }

    // Fallback: construct messages from fields
    const fallbackMsgs: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (session.user_prompt) {
      fallbackMsgs.push({ role: 'user', content: session.user_prompt });
    }
    if (session.assistant_response) {
      fallbackMsgs.push({ role: 'assistant', content: session.assistant_response });
    }
    return isCompressed ? compressConversation(fallbackMsgs, 0.3) : fallbackMsgs;
  }, [session, isCompressed]);

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

      {/* Compression indicator */}
      {isCompressed && (
        <Stack
          horizontal
          horizontalAlign="center"
          styles={{
            root: {
              padding: '4px 12px',
              backgroundColor: '#fff4ce',
              borderBottom: '1px solid #edebe9',
            },
          }}
        >
          <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
            Compressed view (assistant responses summarized to ~30%)
          </Text>
        </Stack>
      )}

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
        {messages.length > 0 ? (
          messages.map((msg, index) => (
            <MessageBubble key={index} role={msg.role} content={msg.content} />
          ))
        ) : (
          <Text variant="small" styles={{ root: { color: '#605e5c', fontStyle: 'italic' } }}>
            No message content available
          </Text>
        )}
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
          text={isCompressed ? 'Expand' : 'Compress'}
          iconProps={{ iconName: isCompressed ? 'FullScreen' : 'CollapseContent' }}
          onClick={() => setIsCompressed(!isCompressed)}
        />
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
