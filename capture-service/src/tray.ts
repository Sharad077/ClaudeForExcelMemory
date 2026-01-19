import { Tray, Menu, nativeImage, Notification, app } from 'electron';
import {
  enableCapturing,
  disableCapturing,
  isUICaptureRunning,
} from './uiCapture';
import { getSessionCount } from './storage';
import { getApiPort } from './api';
import { TrayState } from './types';

let tray: Tray | null = null;
let currentState: TrayState = {
  capturing: false,
  sessionCount: 0,
};

// Base64 encoded 16x16 PNG icons (simple colored circles)
// Green circle for active state
const ICON_ACTIVE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADDSURBVDiN1ZMxCsIwAEV/ki5O4uYiODo4ufQcHsLRxUP0Cl7AxVvYzUP0AK4ugnQQFwkuLhIdTGNJm1bFwQchhPf/n4QQBn5hEtgDZ+AOLIBDiL4BY+AFnIEFcA3RS0gRQYaAgkJGgaYAtgzfwBNYheib/8F2DdSANfAK1aNuAZ0I0RHQA1bAC8gAuxA9+Z/ZLrACugF6zyLALsQ3QBPo/AF6zzIAbkAWuIboNaDr4f8B9J5F4BoSlg+gaYC+c7sB+gQEJy8bVvkAAAAASUVORK5CYII=';

// Gray circle for inactive state
const ICON_INACTIVE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAC2SURBVDiN1ZOxCsIwFEV/krq4iJuL4Ojg5OQ3+BGOLn6Ev+AFXPwLu/kRfoC7i0gcxEWChYdNW9OqOPgg8Lj33BNCGP6FcaAP3IF7YA4cQvQDGAM+cAbmwCVEzyFFBBkCCgoJGhoq2TL8AU9gGaJv/g/bMbACVsAb6L26qUkE0gHaARbAG8gATYie/I/tEFgCnR69ZxFgF+JrQB2oh/9A75kHboEscA3Raw5dD/8HoM9ZBPYhYfkAmr4EJ7klY3EAAAAASUVORK5CYII=';

function createTrayIcon(capturing: boolean): Electron.NativeImage {
  const base64Data = capturing ? ICON_ACTIVE_BASE64 : ICON_INACTIVE_BASE64;
  return nativeImage.createFromDataURL(`data:image/png;base64,${base64Data}`);
}

function buildContextMenu(): Menu {
  const sessionCount = getSessionCount();
  currentState.sessionCount = sessionCount;

  return Menu.buildFromTemplate([
    {
      label: `Claude Excel Memory Capture`,
      enabled: false,
    },
    {
      label: `(UI Automation - No Proxy)`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: currentState.capturing ? 'Capturing: ON' : 'Capturing: OFF',
      type: 'checkbox',
      checked: currentState.capturing,
      click: () => {
        if (currentState.capturing) {
          disableCapturing();
          currentState.capturing = false;
        } else {
          enableCapturing();
          currentState.capturing = true;
        }
        updateTray();
      },
    },
    {
      label: `Sessions Captured: ${sessionCount}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `API Port: ${getApiPort()}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
}

export function createTray(): void {
  currentState.capturing = isUICaptureRunning();

  const icon = createTrayIcon(currentState.capturing);
  tray = new Tray(icon);

  tray.setToolTip('Claude Excel Memory Capture');
  tray.setContextMenu(buildContextMenu());

  // Handle left-click to show menu
  tray.on('click', () => {
    tray?.popUpContextMenu();
  });
}

export function updateTray(): void {
  if (!tray) return;

  currentState.capturing = isUICaptureRunning();
  currentState.sessionCount = getSessionCount();

  const icon = createTrayIcon(currentState.capturing);
  tray.setImage(icon);
  tray.setContextMenu(buildContextMenu());

  const status = currentState.capturing ? 'Capturing' : 'Paused';
  tray.setToolTip(`Claude Excel Memory - ${status} (${currentState.sessionCount} sessions)`);
}

export function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      silent: true,
    });
    notification.show();
  }
}

export function notifySessionCaptured(): void {
  const count = getSessionCount();
  showNotification(
    'Session Captured',
    `Claude conversation captured. Total: ${count}`
  );
  updateTray();
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
