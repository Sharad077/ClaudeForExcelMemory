import { SavedSession, SavedMessage, CapturedSession } from '../types';

const CLAUDE_MEMORY_NAMESPACE = 'http://claudeforexcel.memory';

function parseMessagesFromRequest(requestBody: string): SavedMessage[] {
  try {
    const request = JSON.parse(requestBody);
    if (!request.messages || !Array.isArray(request.messages)) {
      return [];
    }

    return request.messages
      .filter((msg: { role: string }) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg: { role: string; content: string | { type: string; text?: string }[] }) => {
        let content = '';
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .filter((block) => block.type === 'text' && block.text)
            .map((block) => block.text)
            .join('\n');
        }
        return {
          role: msg.role as 'user' | 'assistant',
          content,
        };
      });
  } catch {
    return [];
  }
}

function parseAssistantResponseFromResponse(responseBody: string): SavedMessage | null {
  try {
    const response = JSON.parse(responseBody);
    if (!response.content || !Array.isArray(response.content)) {
      return null;
    }

    const content = response.content
      .filter((block: { type: string; text?: string }) => block.type === 'text' && block.text)
      .map((block: { text: string }) => block.text)
      .join('\n');

    if (!content) return null;

    return {
      role: 'assistant',
      content,
    };
  } catch {
    return null;
  }
}

export function convertCapturedToSaved(session: CapturedSession): SavedSession {
  const messages = parseMessagesFromRequest(session.request_body);
  const assistantResponse = parseAssistantResponseFromResponse(session.response_body);

  if (assistantResponse) {
    messages.push(assistantResponse);
  }

  return {
    id: session.id,
    capturedAt: session.captured_at,
    model: session.model,
    inputTokens: session.input_tokens,
    outputTokens: session.output_tokens,
    messages,
  };
}

function sessionsToXml(sessions: SavedSession[]): string {
  const escapeXml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const sessionElements = sessions
    .map((session) => {
      const messagesXml = session.messages
        .map(
          (msg) => `
        <Message role="${msg.role}">
          <Content><![CDATA[${msg.content}]]></Content>
          ${msg.cellContext ? `<CellContext>${escapeXml(msg.cellContext)}</CellContext>` : ''}
        </Message>`
        )
        .join('');

      return `
    <Session id="${escapeXml(session.id)}" capturedAt="${escapeXml(session.capturedAt)}">
      <Model>${session.model ? escapeXml(session.model) : ''}</Model>
      <TokenUsage input="${session.inputTokens || 0}" output="${session.outputTokens || 0}" />
      <Messages>${messagesXml}
      </Messages>
    </Session>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ClaudeMemory xmlns="${CLAUDE_MEMORY_NAMESPACE}">
  <Sessions>${sessionElements}
  </Sessions>
</ClaudeMemory>`;
}

function parseSessionsFromXml(xmlString: string): SavedSession[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const sessions: SavedSession[] = [];
  const sessionElements = doc.getElementsByTagName('Session');

  for (let i = 0; i < sessionElements.length; i++) {
    const sessionEl = sessionElements[i];
    const id = sessionEl.getAttribute('id') || '';
    const capturedAt = sessionEl.getAttribute('capturedAt') || '';

    const modelEl = sessionEl.getElementsByTagName('Model')[0];
    const model = modelEl?.textContent || null;

    const tokenUsageEl = sessionEl.getElementsByTagName('TokenUsage')[0];
    const inputTokens = tokenUsageEl
      ? parseInt(tokenUsageEl.getAttribute('input') || '0', 10)
      : null;
    const outputTokens = tokenUsageEl
      ? parseInt(tokenUsageEl.getAttribute('output') || '0', 10)
      : null;

    const messages: SavedMessage[] = [];
    const messageElements = sessionEl.getElementsByTagName('Message');

    for (let j = 0; j < messageElements.length; j++) {
      const msgEl = messageElements[j];
      const role = msgEl.getAttribute('role') as 'user' | 'assistant';
      const contentEl = msgEl.getElementsByTagName('Content')[0];
      const content = contentEl?.textContent || '';
      const cellContextEl = msgEl.getElementsByTagName('CellContext')[0];
      const cellContext = cellContextEl?.textContent || undefined;

      messages.push({ role, content, cellContext });
    }

    sessions.push({
      id,
      capturedAt,
      model,
      inputTokens,
      outputTokens,
      messages,
    });
  }

  return sessions;
}

export async function getSavedSessions(): Promise<SavedSession[]> {
  return Excel.run(async (context) => {
    const customXmlParts = context.workbook.customXmlParts;
    const matchingParts = customXmlParts.getByNamespace(CLAUDE_MEMORY_NAMESPACE);
    matchingParts.load('items');

    await context.sync();

    if (matchingParts.items.length === 0) {
      return [];
    }

    const xmlPart = matchingParts.items[0];
    const xmlBlob = xmlPart.getXml();
    await context.sync();

    return parseSessionsFromXml(xmlBlob.value);
  });
}

export async function saveSessions(sessions: SavedSession[]): Promise<void> {
  return Excel.run(async (context) => {
    const customXmlParts = context.workbook.customXmlParts;
    const matchingParts = customXmlParts.getByNamespace(CLAUDE_MEMORY_NAMESPACE);
    matchingParts.load('items');

    await context.sync();

    // Delete existing parts
    for (const part of matchingParts.items) {
      part.delete();
    }

    await context.sync();

    // Add new XML part
    const xmlContent = sessionsToXml(sessions);
    customXmlParts.add(xmlContent);

    await context.sync();
  });
}

export async function addSession(session: SavedSession): Promise<void> {
  const existingSessions = await getSavedSessions();
  const updatedSessions = [...existingSessions, session];
  await saveSessions(updatedSessions);
}

export async function removeSession(sessionId: string): Promise<void> {
  const existingSessions = await getSavedSessions();
  const updatedSessions = existingSessions.filter((s) => s.id !== sessionId);
  await saveSessions(updatedSessions);
}

export async function clearSavedSessions(): Promise<void> {
  await saveSessions([]);
}

export async function getWorkbookName(): Promise<string> {
  return Excel.run(async (context) => {
    const workbook = context.workbook;
    workbook.load('name');
    await context.sync();
    return workbook.name;
  });
}
