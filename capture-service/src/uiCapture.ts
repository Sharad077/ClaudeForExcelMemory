import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { insertSession, updateSession, getActiveSessionByWorkbook } from './storage';
import { CapturedSession } from './types';

let captureInterval: NodeJS.Timeout | null = null;
let lastCapturedHash: string = '';
let isCapturing = false;
let onSessionCaptured: (() => void) | null = null;

export function setOnSessionCaptured(callback: () => void): void {
  onSessionCaptured = callback;
}

// PowerShell script that captures messages with proper user/assistant detection
// User messages: Text outside assistant containers (detected by Y position gaps)
// Assistant messages: Inside Group elements with "justify-start mb-3" className
const CAPTURE_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$excelWindows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)

$result = @{
    found = $false
    messages = @()
    workbookName = ""
}

foreach ($win in $excelWindows) {
    if ($win.Current.ClassName -eq 'XLMAIN') {
        $webContentCondition = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::NameProperty,
            'Claude in Microsoft Office - Web content'
        )

        $webContent = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $webContentCondition)

        if ($webContent) {
            $result.found = $true
            $result.workbookName = $win.Current.Name -replace ' - Excel$', ''

            # Get all Group elements (assistant message containers)
            $groupCondition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::Group
            )
            $groups = $webContent.FindAll([System.Windows.Automation.TreeScope]::Descendants, $groupCondition)

            $textCondition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::Text
            )

            # Collect assistant containers with Y ranges
            $assistantContainers = @()
            foreach ($group in $groups) {
                $className = $group.Current.ClassName
                if ($className -and $className.Contains('justify-start') -and $className.Contains('mb-3')) {
                    $rect = $group.Current.BoundingRectangle
                    $texts = $group.FindAll([System.Windows.Automation.TreeScope]::Descendants, $textCondition)
                    $content = @()
                    foreach ($t in $texts) {
                        $tName = $t.Current.Name
                        if ($tName -and $tName.Length -gt 0) {
                            if ($tName -eq 'Untitled' -or $tName -match '^[A-Z]+[0-9]+(:[A-Z]+[0-9]+)? selected$') { continue }
                            if ($tName -eq 'BETA' -or $tName -eq 'Claude' -or $tName -eq 'Copy' -or $tName -eq 'Retry') { continue }
                            $content += $tName
                        }
                    }
                    if ($content.Count -gt 0) {
                        $assistantContainers += @{
                            yStart = $rect.Y
                            yEnd = $rect.Y + $rect.Height
                            content = $content -join "\`n"
                        }
                    }
                }
            }

            # Find user messages: text with empty className, outside all assistant containers
            $allTexts = $webContent.FindAll([System.Windows.Automation.TreeScope]::Descendants, $textCondition)
            $userMessages = @()

            foreach ($t in $allTexts) {
                $className = $t.Current.ClassName
                $name = $t.Current.Name
                $rect = $t.Current.BoundingRectangle

                # User messages: empty className, substantial text, not UI element
                if ((-not $className -or $className -eq '') -and $name -and $name.Length -gt 15) {
                    # Skip UI elements
                    if ($name -eq 'Untitled' -or $name -match '^[A-Z]+[0-9]+(:[A-Z]+[0-9]+)? selected$') { continue }
                    if ($name -match '^(BETA|Claude|Copy|Retry|Send|Stop|New chat)$') { continue }
                    if ($name -match '^\s*$') { continue }

                    # Check if this text is inside ANY assistant container
                    $isInAssistant = $false
                    foreach ($ac in $assistantContainers) {
                        if ($rect.Y -ge $ac.yStart -and $rect.Y -le $ac.yEnd) {
                            $isInAssistant = $true
                            break
                        }
                    }

                    if (-not $isInAssistant) {
                        $userMessages += @{
                            y = $rect.Y
                            content = $name
                        }
                    }
                }
            }

            # Combine into messages list
            $allMessages = @()

            foreach ($um in $userMessages) {
                $allMessages += @{
                    role = "user"
                    content = $um.content
                    y = $um.y
                }
            }

            foreach ($ac in $assistantContainers) {
                $allMessages += @{
                    role = "assistant"
                    content = $ac.content
                    y = $ac.yStart
                }
            }

            # Sort by Y position (screen order)
            $result.messages = $allMessages | Sort-Object { $_.y }
            break
        }
    }
}

# Convert to JSON and then Base64 to avoid control character issues
$json = $result | ConvertTo-Json -Depth 10 -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$base64 = [Convert]::ToBase64String($bytes)
Write-Output $base64
`;

interface CapturedMessage {
  role: 'user' | 'assistant';
  content: string;
  y: number;
}

interface CaptureResult {
  found: boolean;
  messages: CapturedMessage[];
  workbookName: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
      }
    });

    ps.on('error', reject);
  });
}

// UI elements to filter out (not conversation content)
const UI_ELEMENTS = new Set([
  'BETA',
  'Untitled',
  'Build a new analysis',
  'Import data',
  'Check a different file',
  'Let me know what you\'d like to accomplish!',
  'What can I do for you?',
  'Type a message',
  'Send',
  'Stop',
  'Copy',
  'Retry',
  'New chat',
  'Claude',
]);

function isUIElement(text: string): boolean {
  if (UI_ELEMENTS.has(text)) return true;
  if (text.length < 10) return true;
  // Filter out single words that are likely buttons
  if (text.match(/^[A-Za-z]{1,15}$/) && !text.includes(' ')) return true;
  // Filter out cell selection notifications
  if (/^[A-Z]+\d+(:[A-Z]+\d+)? selected$/.test(text.trim())) return true;
  return false;
}

// Clean up text by removing noise like "X selected" suffixes
function cleanText(text: string): string {
  // Remove "XX selected" suffix that gets appended
  return text.replace(/\n+[A-Z]+\d+(:[A-Z]+\d+)? selected$/g, '').trim();
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function contentHash(text: string): string {
  // Create a hash of the first 100 chars for comparison
  return simpleHash(text.substring(0, 100).toLowerCase().trim());
}

interface ParsedConversation {
  messages: Message[];
  hash: string;
}

// Convert captured messages to our Message format
function parseConversationFromCapture(capturedMessages: CapturedMessage[]): ParsedConversation | null {
  if (capturedMessages.length < 2) {
    return null;
  }

  // Create hash of ALL content to detect any changes
  const fullContent = capturedMessages.map(m => m.content).join('|||');
  const hash = simpleHash(fullContent);

  // Convert to Message format, cleaning text
  const messages: Message[] = capturedMessages.map(m => ({
    role: m.role,
    content: cleanText(m.content)
  })).filter(m => m.content.length > 0);

  // Need at least one user and one assistant message
  const hasUser = messages.some(m => m.role === 'user');
  const hasAssistant = messages.some(m => m.role === 'assistant');

  if (!hasUser || !hasAssistant) {
    return null;
  }

  return { messages, hash };
}

// Merge new messages with existing ones, preserving history and keeping longer versions
function mergeMessages(existing: Message[], newMessages: Message[]): Message[] {
  if (existing.length === 0) {
    return newMessages;
  }

  // Create a map of hash -> message for existing, keeping track of content length
  const existingMap = new Map<string, Message>();
  for (const m of existing) {
    const hash = contentHash(m.content);
    existingMap.set(hash, m);
  }

  // Process new messages: update if longer, add if new
  const result: Message[] = [...existing];

  for (const newMsg of newMessages) {
    const hash = contentHash(newMsg.content);
    const existingMsg = existingMap.get(hash);

    if (existingMsg) {
      // Same message exists - keep the longer version
      if (newMsg.content.length > existingMsg.content.length) {
        // Replace with longer version
        const idx = result.findIndex(m => contentHash(m.content) === hash);
        if (idx >= 0) {
          result[idx] = newMsg;
        }
      }
    } else {
      // New message - add it
      result.push(newMsg);
    }
  }

  return result;
}

// Load existing messages from session
function loadExistingMessages(session: CapturedSession): Message[] {
  try {
    const data = JSON.parse(session.request_body);
    if (data.messages && Array.isArray(data.messages)) {
      return data.messages;
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

async function captureOnce(): Promise<void> {
  if (!isCapturing) return;

  try {
    const base64Output = await runPowerShell(CAPTURE_SCRIPT);

    if (!base64Output) return;

    // Decode Base64 to JSON
    let jsonString: string;
    try {
      jsonString = Buffer.from(base64Output, 'base64').toString('utf8');
    } catch {
      console.error('[UICapture] Failed to decode Base64');
      return;
    }

    const result: CaptureResult = JSON.parse(jsonString);

    if (!result.found || !result.messages || result.messages.length === 0) {
      return;
    }

    // Parse the conversation from pre-classified messages
    const conversation = parseConversationFromCapture(result.messages);

    if (!conversation || conversation.messages.length < 2) {
      return;
    }

    // Check if content has changed (using hash of full conversation)
    if (conversation.hash === lastCapturedHash) {
      return; // No change, skip
    }

    const workbookName = result.workbookName || 'Unknown';

    lastCapturedHash = conversation.hash;

    // Check if we have an existing session for this workbook
    const existingSession = getActiveSessionByWorkbook(workbookName);

    let finalMessages: Message[];

    if (existingSession) {
      // MERGE: Load existing messages and merge with new ones
      const existingMessages = loadExistingMessages(existingSession);
      finalMessages = mergeMessages(existingMessages, conversation.messages);

      console.log('[UICapture] Merging messages for:', workbookName);
      console.log('[UICapture] Existing:', existingMessages.length, '+ New:', conversation.messages.length, '= Final:', finalMessages.length);
    } else {
      finalMessages = conversation.messages;
      console.log('[UICapture] New thread for:', workbookName);
      console.log('[UICapture] Messages:', finalMessages.length);
    }

    // Get user prompts and assistant responses for display
    const userMessages = finalMessages.filter(m => m.role === 'user');
    const assistantMessages = finalMessages.filter(m => m.role === 'assistant');

    const firstUserPrompt = userMessages[0]?.content || '';
    const fullResponse = assistantMessages.map(m => m.content).join('\n\n');

    const sessionData = {
      request_body: JSON.stringify({ messages: finalMessages }),
      response_body: JSON.stringify({ messages: finalMessages }),
      user_prompt: firstUserPrompt,
      assistant_response: fullResponse,
    };

    if (existingSession) {
      // Update the existing session with merged messages
      const updatedSession: CapturedSession = {
        ...existingSession,
        ...sessionData,
        captured_at: new Date().toISOString(),
      };
      updateSession(updatedSession);
      console.log('[UICapture] Thread updated:', existingSession.id);
    } else {
      // Create a new session
      const newSession: CapturedSession = {
        id: uuidv4(),
        workbook_name: workbookName,
        captured_at: new Date().toISOString(),
        model: 'claude-for-excel',
        input_tokens: null,
        output_tokens: null,
        ...sessionData,
      };
      insertSession(newSession);
      console.log('[UICapture] New thread created:', newSession.id);
    }

    if (onSessionCaptured) {
      onSessionCaptured();
    }

  } catch (error) {
    if (error instanceof Error) {
      if (!error.message.includes('Cannot read properties') &&
          !error.message.includes('Unexpected end of JSON')) {
        console.error('[UICapture] Error:', error.message);
      }
    }
  }
}

export function startUICapture(intervalMs: number = 3000): void {
  if (captureInterval) {
    console.log('[UICapture] Already running');
    return;
  }

  isCapturing = true;
  console.log(`[UICapture] Starting capture (every ${intervalMs}ms)`);

  // Initial capture after a short delay
  setTimeout(captureOnce, 1000);

  // Set up interval
  captureInterval = setInterval(captureOnce, intervalMs);
}

export function stopUICapture(): void {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  isCapturing = false;
  console.log('[UICapture] Stopped');
}

export function isUICaptureRunning(): boolean {
  return isCapturing;
}

export function enableCapturing(): void {
  isCapturing = true;
  console.log('[UICapture] Enabled');
}

export function disableCapturing(): void {
  isCapturing = false;
  console.log('[UICapture] Disabled');
}

export function resetLastCaptured(): void {
  lastCapturedHash = '';
}
