import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  TextField,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IconButton,
  Link,
} from '@fluentui/react';
import { getApiKey, setApiKey } from '../utils/settings';
import { testApiKey } from '../services/claudeApi';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [apiKey, setApiKeyState] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: MessageBarType; text: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    const existingKey = getApiKey();
    if (existingKey) {
      // Show masked version
      setApiKeyState('sk-ant-' + '•'.repeat(20));
      setHasExistingKey(true);
    }
  }, []);

  const handleSave = async () => {
    // If user hasn't changed the masked key, just close
    if (hasExistingKey && apiKey.includes('•')) {
      onClose();
      return;
    }

    const trimmedKey = apiKey.trim();

    // Allow clearing the key
    if (!trimmedKey) {
      setApiKey(null);
      setMessage({ type: MessageBarType.success, text: 'API key removed' });
      setTimeout(onClose, 1000);
      return;
    }

    // Validate format
    if (!trimmedKey.startsWith('sk-ant-')) {
      setMessage({ type: MessageBarType.error, text: 'Invalid key format. Should start with sk-ant-' });
      return;
    }

    // Test the key
    setIsTesting(true);
    setMessage(null);

    const isValid = await testApiKey(trimmedKey);

    setIsTesting(false);

    if (isValid) {
      setApiKey(trimmedKey);
      setMessage({ type: MessageBarType.success, text: 'API key saved and verified!' });
      setTimeout(onClose, 1500);
    } else {
      setMessage({ type: MessageBarType.error, text: 'API key is invalid or API is unreachable' });
    }
  };

  const handleClear = () => {
    setApiKeyState('');
    setHasExistingKey(false);
    setApiKey(null);
    setMessage({ type: MessageBarType.info, text: 'API key cleared. Using TextRank for compression.' });
  };

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
        <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
          Settings
        </Text>
        <IconButton
          iconProps={{ iconName: 'Cancel' }}
          title="Close"
          ariaLabel="Close"
          onClick={onClose}
        />
      </Stack>

      {/* Content */}
      <Stack
        styles={{
          root: {
            padding: 16,
            flexGrow: 1,
            overflowY: 'auto',
          },
        }}
        tokens={{ childrenGap: 16 }}
      >
        <Stack tokens={{ childrenGap: 8 }}>
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
            Anthropic API Key
          </Text>
          <Text variant="small" styles={{ root: { color: '#605e5c' } }}>
            Optional. Enables intelligent compression using Claude API. Without a key,
            compression uses local TextRank algorithm (less accurate but free).
          </Text>
        </Stack>

        <TextField
          label="API Key"
          type="password"
          canRevealPassword
          value={apiKey}
          onChange={(_, value) => {
            setApiKeyState(value || '');
            if (hasExistingKey) setHasExistingKey(false);
          }}
          placeholder="sk-ant-..."
          disabled={isTesting}
        />

        <Text variant="tiny" styles={{ root: { color: '#605e5c' } }}>
          Get your API key from{' '}
          <Link href="https://console.anthropic.com/settings/keys" target="_blank">
            console.anthropic.com
          </Link>
        </Text>

        {message && (
          <MessageBar messageBarType={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </MessageBar>
        )}

        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <PrimaryButton
            text={isTesting ? 'Verifying...' : 'Save'}
            onClick={handleSave}
            disabled={isTesting}
          />
          {isTesting && <Spinner size={SpinnerSize.small} />}
          {hasExistingKey && (
            <DefaultButton text="Clear Key" onClick={handleClear} disabled={isTesting} />
          )}
          <DefaultButton text="Cancel" onClick={onClose} disabled={isTesting} />
        </Stack>

        {/* Info section */}
        <Stack
          styles={{
            root: {
              marginTop: 24,
              padding: 12,
              backgroundColor: '#f3f2f1',
              borderRadius: 4,
            },
          }}
          tokens={{ childrenGap: 8 }}
        >
          <Text variant="small" styles={{ root: { fontWeight: 600 } }}>
            Compression Methods
          </Text>
          <Stack tokens={{ childrenGap: 4 }}>
            <Text variant="small">
              <strong>With API Key:</strong> Uses Claude to intelligently summarize conversations,
              preserving context, decisions, and important data.
            </Text>
            <Text variant="small">
              <strong>Without API Key:</strong> Uses TextRank algorithm for basic extractive
              summarization. Works offline but less accurate for structured content.
            </Text>
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
};
