import { app, dialog } from 'electron';
import { initDatabase, closeDatabase } from './storage';
import {
  startUICapture,
  stopUICapture,
  setOnSessionCaptured,
} from './uiCapture';
import { startApi, stopApi } from './api';
import { createTray, destroyTray, notifySessionCaptured } from './tray';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Already Running',
      message: 'Claude Excel Memory Capture is already running in the system tray.',
    });
  });
}

// Hide dock icon on macOS (we're a tray-only app)
if (process.platform === 'darwin') {
  app.dock?.hide();
}

async function initialize(): Promise<void> {
  try {
    console.log('Initializing Claude Excel Memory Capture...');

    // Initialize database
    await initDatabase();
    console.log('Database initialized');

    // Set up session capture callback
    setOnSessionCaptured(() => {
      notifySessionCaptured();
    });

    // Start UI capture (polls every 3 seconds)
    startUICapture(3000);
    console.log('UI Capture started');

    // Start API server
    startApi();
    console.log('API server started');

    // Create system tray
    createTray();
    console.log('System tray created');

    console.log('Claude Excel Memory Capture is running');
  } catch (error) {
    console.error('Failed to initialize:', error);
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start Claude Excel Memory Capture:\n${error}`
    );
    app.quit();
  }
}

async function cleanup(): Promise<void> {
  console.log('Cleaning up...');
  destroyTray();
  stopApi();
  stopUICapture();
  closeDatabase();
  console.log('Cleanup complete');
}

// App lifecycle events
app.whenReady().then(initialize);

app.on('before-quit', async (event) => {
  event.preventDefault();
  await cleanup();
  app.exit(0);
});

app.on('window-all-closed', () => {
  // Keep the app running (tray only)
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred:\n${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
