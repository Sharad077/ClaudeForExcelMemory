import React, { useState, useMemo, useCallback } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Spinner,
  SpinnerSize,
  Separator,
  IconButton,
  MessageBar,
  MessageBarType,
} from '@fluentui/react';
import { CapturedSession } from '../types';
import { compressConversation } from '../utils/textRank';
import { summarizeWithClaude } from '../services/claudeApi';
import { hasApiKey } from '../utils/settings';

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

type Message = { role: 'user' | 'assistant'; content: string };

export const SessionDetail: React.FC<SessionDetailProps> = ({
  session,
  isLoading,
  isSaved,
  onSave,
  onDelete,
  onClose,
}) => {
  const [isCompressed, setIsCompressed] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedMessages, setCompressedMessages] = useState<Message[] | null>(null);
  const [compressionMethod, setCompressionMethod] = useState<'claude' | 'textrank' | null>(null);
  const [compressionError, setCompressionError] = useState<string | null>(null);

  // Parse original messages from session
  const originalMessages = useMemo((): Message[] => {
    if (!session) return [];

    try {
      const data = JSON.parse(session.request_body);
      if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        return data.messages as Message[];
      }
    } catch {
      // Fall back to user_prompt/assistant_response
    }

    // Fallback: construct messages from fields
    const fallbackMsgs: Message[] = [];
    if (session.user_prompt) {
      fallbackMsgs.push({ role: 'user', content: session.user_prompt });
    }
    if (session.assistant_response) {
      fallbackMsgs.push({ role: 'assistant', content: session.assistant_response });
    }
    return fallbackMsgs;
  }, [session]);

  // Handle compression toggle
  const handleCompress = useCallback(async () => {
    if (isCompressed) {
      // Expand - just toggle off
      setIsCompressed(false);
      setCompressedMessages(null);
      setCompressionMethod(null);
      setCompressionError(null);
      return;
    }

    // Compress
    setIsCompressing(true);
    setCompressionError(null);

    // Try Claude API first if API key is configured
    if (hasApiKey()) {
      const claudeResult = await summarizeWithClaude(originalMessages);
      if (claudeResult) {
        setCompressedMessages(claudeResult);
        setCompressionMethod('claude');
        setIsCompressed(true);
        setIsCompressing(false);
        return;
      }
      // Claude API failed, fall through to TextRank
      setCompressionError('Claude API failed, using TextRank fallback');
    }

    // Use TextRank as fallback
    const textRankResult = compressConversation(originalMessages, 0.3);
    setCompressedMessages(textRankResult);
    setCompressionMethod('textrank');
    setIsCompressed(true);
    setIsCompressing(false);
  }, [isCompressed, originalMessages]);

  // Messages to display
  const messages = isCompressed && compressedMessages ? compressedMessages : originalMessages;

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
      {compressionError && (
        <MessageBar
          messageBarType={MessageBarType.warning}
          onDismiss={() => setCompressionError(null)}
          styles={{ root: { borderBottom: '1px solid #edebe9' } }}
        >
          {compressionError}
        </MessageBar>
      )}
      {isCompressed && compressionMethod && (
        <Stack
          horizontal
          horizontalAlign="center"
          styles={{
            root: {
              padding: '4px 12px',
              backgroundColor: compressionMethod === 'claude' ? '#e6f4ea' : '#fff4ce',
              borderBottom: '1px solid #edebe9',
            },
          }}
        >
          <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
            {compressionMethod === 'claude'
              ? 'Compressed with Claude AI'
              : 'Compressed with TextRank (local)'}
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
          text={isCompressing ? 'Compressing...' : isCompressed ? 'Expand' : 'Compress'}
          iconProps={{ iconName: isCompressed ? 'FullScreen' : 'CollapseContent' }}
          onClick={handleCompress}
          disabled={isCompressing}
        />
        {isCompressing && <Spinner size={SpinnerSize.small} />}
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
