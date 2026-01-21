/**
 * Settings storage for Claude Memory add-in
 * Stores settings in localStorage (doesn't travel with workbook for security)
 */

const SETTINGS_KEY = 'claude-memory-settings';

export interface Settings {
  anthropicApiKey: string | null;
}

const defaultSettings: Settings = {
  anthropicApiKey: null,
};

export function getSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return defaultSettings;
}

export function saveSettings(settings: Partial<Settings>): void {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
}

export function getApiKey(): string | null {
  return getSettings().anthropicApiKey;
}

export function setApiKey(key: string | null): void {
  saveSettings({ anthropicApiKey: key });
}

export function hasApiKey(): boolean {
  const key = getApiKey();
  return key !== null && key.trim().length > 0;
}
