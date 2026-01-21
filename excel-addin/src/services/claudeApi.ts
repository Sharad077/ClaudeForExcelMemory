/**
 * Claude API service for intelligent summarization
 */

import { getApiKey } from '../utils/settings';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

/**
 * Summarize a conversation using Claude API
 * @param messages The conversation messages to summarize
 * @returns Summarized messages or null if API call fails
 */
export async function summarizeWithClaude(
  messages: Message[]
): Promise<Message[] | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  // Build the conversation text for summarization
  const conversationText = messages
    .map((msg) => `[${msg.role.toUpperCase()}]: ${msg.content}`)
    .join('\n\n---\n\n');

  const summaryPrompt = `You are summarizing a conversation between a user and Claude in Excel. Your goal is to compress this conversation while preserving all important context, decisions, data insights, and any code or formulas mentioned.

Rules:
1. Keep user messages short but preserve their intent
2. For assistant responses: Keep key findings, conclusions, numbers, and any code/formulas
3. Remove verbose explanations and filler text
4. Preserve the conversation structure (alternating user/assistant)
5. Output format: Return ONLY a JSON array of messages like [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
6. Target ~30% of the original length while keeping all critical information

Conversation to summarize:

${conversationText}

Return ONLY the JSON array, no other text:`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return null;
    }

    const data: ClaudeResponse = await response.json();
    const responseText = data.content[0]?.text;

    if (!responseText) {
      console.error('Empty response from Claude API');
      return null;
    }

    // Parse the JSON response
    try {
      // Extract JSON array from response (in case there's extra text)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('No JSON array found in response');
        return null;
      }

      const summarizedMessages: Message[] = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!Array.isArray(summarizedMessages)) {
        return null;
      }

      for (const msg of summarizedMessages) {
        if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
          return null;
        }
      }

      return summarizedMessages;
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Claude API request failed:', error);
    return null;
  }
}

/**
 * Test if the API key is valid
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
