export interface SessionSummary {
  id: string;
  workbook_name: string | null;
  captured_at: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  user_prompt_preview: string | null;
}

export interface CapturedSession {
  id: string;
  workbook_name: string | null;
  captured_at: string;
  request_body: string;
  response_body: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  user_prompt: string | null;
  assistant_response: string | null;
}

export interface ProxyStatus {
  running: boolean;
  capturing: boolean;
  sessionCount: number;
  port: number;
  apiPort: number;
}

export interface SavedSession {
  id: string;
  capturedAt: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  messages: SavedMessage[];
}

export interface SavedMessage {
  role: 'user' | 'assistant';
  content: string;
  cellContext?: string;
}

export interface ClaudeMemoryXml {
  sessions: SavedSession[];
}
