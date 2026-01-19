import React from 'react';
import { SearchBox, Stack, Dropdown, IDropdownOption } from '@fluentui/react';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterMode: 'all' | 'saved' | 'unsaved';
  onFilterChange: (mode: 'all' | 'saved' | 'unsaved') => void;
}

const filterOptions: IDropdownOption[] = [
  { key: 'all', text: 'All Sessions' },
  { key: 'saved', text: 'Saved to Workbook' },
  { key: 'unsaved', text: 'Not Saved' },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterChange,
}) => {
  return (
    <Stack
      horizontal
      tokens={{ childrenGap: 8 }}
      styles={{
        root: {
          padding: '8px 12px',
          borderBottom: '1px solid #edebe9',
        },
      }}
    >
      <SearchBox
        placeholder="Search sessions..."
        value={searchQuery}
        onChange={(_, value) => onSearchChange(value || '')}
        styles={{ root: { flexGrow: 1 } }}
      />
      <Dropdown
        selectedKey={filterMode}
        options={filterOptions}
        onChange={(_, option) =>
          onFilterChange((option?.key as 'all' | 'saved' | 'unsaved') || 'all')
        }
        styles={{ root: { width: 140 } }}
      />
    </Stack>
  );
};
