import React from 'react';
import { Stack, Text, Toggle, Spinner, SpinnerSize, IconButton } from '@fluentui/react';
import { ProxyStatus } from '../types';

interface StatusBarProps {
  status: ProxyStatus | null;
  isConnecting: boolean;
  onToggleCapture: (enabled: boolean) => void;
  onOpenSettings: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  isConnecting,
  onToggleCapture,
  onOpenSettings,
}) => {
  if (isConnecting) {
    return (
      <Stack
        horizontal
        verticalAlign="center"
        tokens={{ childrenGap: 8 }}
        styles={{
          root: {
            padding: '8px 12px',
            backgroundColor: '#f3f2f1',
            borderBottom: '1px solid #edebe9',
          },
        }}
      >
        <Spinner size={SpinnerSize.small} />
        <Text variant="small">Connecting to proxy...</Text>
      </Stack>
    );
  }

  if (!status) {
    return (
      <Stack
        horizontal
        verticalAlign="center"
        tokens={{ childrenGap: 8 }}
        styles={{
          root: {
            padding: '8px 12px',
            backgroundColor: '#fde7e9',
            borderBottom: '1px solid #f3d6d8',
          },
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#a80000',
          }}
        />
        <Text variant="small" styles={{ root: { color: '#a80000' } }}>
          Proxy service not running
        </Text>
      </Stack>
    );
  }

  return (
    <Stack
      horizontal
      verticalAlign="center"
      horizontalAlign="space-between"
      styles={{
        root: {
          padding: '8px 12px',
          backgroundColor: status.capturing ? '#dff6dd' : '#f3f2f1',
          borderBottom: '1px solid #edebe9',
        },
      }}
    >
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: status.capturing ? '#107c10' : '#605e5c',
          }}
        />
        <Text variant="small">
          {status.capturing ? 'Capturing' : 'Paused'} · {status.sessionCount} sessions
        </Text>
      </Stack>
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
        <Toggle
          checked={status.capturing}
          onChange={(_, checked) => onToggleCapture(checked ?? false)}
          styles={{ root: { marginBottom: 0 } }}
        />
        <IconButton
          iconProps={{ iconName: 'Settings' }}
          title="Settings"
          ariaLabel="Settings"
          onClick={onOpenSettings}
          styles={{ root: { width: 28, height: 28 } }}
        />
      </Stack>
    </Stack>
  );
};
