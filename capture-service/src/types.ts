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

export interface SessionSummary {
  id: string;
  workbook_name: string | null;
  captured_at: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  user_prompt_preview: string | null;
}

export interface ProxyStatus {
  running: boolean;
  capturing: boolean;
  sessionCount: number;
  port: number;
  apiPort: number;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  [key: string]: unknown;
}

export interface AnthropicRequest {
  model?: string;
  messages?: AnthropicMessage[];
  max_tokens?: number;
  system?: string | AnthropicContentBlock[];
  [key: string]: unknown;
}

export interface AnthropicResponse {
  id?: string;
  type?: string;
  role?: string;
  content?: AnthropicContentBlock[];
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  [key: string]: unknown;
}

export interface TrayState {
  capturing: boolean;
  sessionCount: number;
}
