import express, { Request, Response, Express } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllSessions,
  getSessionById,
  getSessionsByWorkbook,
  deleteSession,
  getSessionCount,
  searchSessions,
  clearAllSessions,
  insertSession,
} from './storage';
import { CapturedSession } from './types';
import {
  isUICaptureRunning,
  enableCapturing,
  disableCapturing,
} from './uiCapture';

// Compatibility functions
function isCapturingEnabled(): boolean {
  return isUICaptureRunning();
}

const API_PORT = 3847;

let server: Server | null = null;
let expressApp: Express | null = null;

export function startApi(): void {
  if (server) {
    console.log('API already running');
    return;
  }

  expressApp = express();

  // Enable CORS for all origins (needed for Excel add-in)
  expressApp.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  expressApp.use(express.json());

  // Get capture status
  expressApp.get('/status', (_req: Request, res: Response) => {
    res.json({
      running: isUICaptureRunning(),
      capturing: isCapturingEnabled(),
      sessionCount: getSessionCount(),
      captureMethod: 'ui-automation',
      apiPort: API_PORT,
    });
  });

  // Enable/disable capturing
  expressApp.post('/capturing', (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled === 'boolean') {
      if (enabled) {
        enableCapturing();
      } else {
        disableCapturing();
      }
      res.json({ capturing: isCapturingEnabled() });
    } else {
      res.status(400).json({ error: 'enabled must be a boolean' });
    }
  });

  // List all sessions
  expressApp.get('/sessions', (req: Request, res: Response) => {
    try {
      const { search } = req.query;
      if (search && typeof search === 'string') {
        const sessions = searchSessions(search);
        res.json(sessions);
      } else {
        const sessions = getAllSessions();
        res.json(sessions);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
  });

  // Get session by ID
  expressApp.get('/sessions/:id', (req: Request<{ id: string }>, res: Response) => {
    try {
      const session = getSessionById(req.params.id);
      if (session) {
        res.json(session);
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve session' });
    }
  });

  // Get sessions by workbook name
  expressApp.get('/sessions/workbook/:name', (req: Request<{ name: string }>, res: Response) => {
    try {
      const sessions = getSessionsByWorkbook(req.params.name);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
  });

  // Delete session
  expressApp.delete('/sessions/:id', (req: Request<{ id: string }>, res: Response) => {
    try {
      const deleted = deleteSession(req.params.id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  // Clear all sessions
  expressApp.delete('/sessions', (_req: Request, res: Response) => {
    try {
      clearAllSessions();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear sessions' });
    }
  });

  // Health check endpoint
  expressApp.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Test endpoint: Add a mock session
  expressApp.post('/test/session', (req: Request, res: Response) => {
    try {
      const { userPrompt, assistantResponse } = req.body;

      const session: CapturedSession = {
        id: uuidv4(),
        workbook_name: 'TestWorkbook.xlsx',
        captured_at: new Date().toISOString(),
        request_body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: userPrompt || 'Test prompt' }],
        }),
        response_body: JSON.stringify({
          content: [{ type: 'text', text: assistantResponse || 'Test response from Claude' }],
          model: 'claude-3-haiku-20240307',
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        model: 'claude-3-haiku-20240307',
        input_tokens: 10,
        output_tokens: 20,
        user_prompt: userPrompt || 'Test prompt',
        assistant_response: assistantResponse || 'Test response from Claude',
      };

      insertSession(session);
      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create test session' });
    }
  });

  server = expressApp.listen(API_PORT, 'localhost', () => {
    console.log(`API server running on http://localhost:${API_PORT}`);
  });
}

export function stopApi(): void {
  if (server) {
    server.close();
    server = null;
    expressApp = null;
    console.log('API server stopped');
  }
}

export function getApiPort(): number {
  return API_PORT;
}
