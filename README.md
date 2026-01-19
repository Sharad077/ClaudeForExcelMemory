# Claude for Excel Memory

> Never lose your Claude for Excel conversation history again.

An open-source tool that automatically captures and persists your Claude for Excel sessions using Windows UI Automation. View, search, and save your conversation history directly within Excel.

## Features

- **Automatic Capture**: Runs silently in system tray, capturing conversations as you work
- **Full History**: Stores complete conversation threads with user prompts and Claude responses
- **Save to Workbook**: Persist sessions to your Excel file - history travels with the workbook
- **No Proxy/Certificates**: Uses Windows UI Automation - no network interception required
- **Privacy First**: All data stays local, nothing sent to external services

## Screenshot
<img width="360" height="920" alt="image" src="https://github.com/user-attachments/assets/5bfb4680-5ef8-43bc-81e6-e7d63e594bb6" />



## Quick Start

### Download & Run

1. **Download** the latest release from [Releases](../../releases)
2. **Run** `Claude Excel Memory.exe` - look for green icon in system tray
3. **Install Add-in** in Excel: Insert → My Add-ins → Upload → select `manifest.xml`
4. **Use Claude for Excel** normally - your history is automatically captured!

### Build from Source

```bash
# Clone the repository
git clone https://github.com/Sharad077/ClaudeForExcelMemory.git
cd claude-excel-memory

# Build capture service
cd capture-service
npm install
npm run package    # Creates portable .exe in release/

# Build Excel add-in
cd ../excel-addin
npm install
npm run build      # Creates dist/ for hosting
```

## Architecture

```
┌─────────────────────┐
│  Claude for Excel   │
│    (Task Pane)      │
└─────────────────────┘
           │
           │ UI Automation (reads visible content)
           ▼
┌─────────────────────┐
│   Capture Service   │
│  (System Tray App)  │
│                     │
│  - Reads UI content │
│  - Stores locally   │
│  - REST API :3847   │
└─────────────────────┘
           ▲
           │ localhost:3847
           │
┌─────────────────────┐
│   Excel Add-in      │
│   (Claude Memory)   │
│                     │
│  - View sessions    │
│  - Save to workbook │
│  - Search history   │
└─────────────────────┘
```

## Components

### Capture Service (Electron)
A lightweight system tray application that:
- Polls every 3 seconds using Windows UI Automation API
- Detects user messages and Claude responses
- Merges captures to keep the most complete version
- Exposes REST API for the Excel add-in

### Excel Add-in (Office.js + React)
A task pane add-in that:
- Displays captured conversation history
- Allows saving sessions to workbook (Custom XML Parts)
- Sessions saved to workbook travel with the file

## API Endpoints

The capture service exposes a REST API on `localhost:3847`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Service status |
| `/sessions` | GET | List all sessions |
| `/sessions/:id` | GET | Get session details |
| `/sessions/:id` | DELETE | Delete a session |
| `/health` | GET | Health check |

## Limitations

- **Windows only**: Uses Windows UI Automation API
- **Visible content**: Can only capture what's visible on screen (scroll to capture more)
- **Best results**: Keep Claude pane visible and let responses complete before scrolling

## Development

```bash
# Capture Service
cd capture-service
npm run dev        # Build and run
npm run build      # Build only
npm run package    # Create distributable

# Excel Add-in
cd excel-addin
npm run dev        # Start dev server (https://localhost:3000)
npm run build      # Production build
```

## Hosting the Add-in

The Excel add-in needs HTTPS hosting. Options:

1. **Local Development**: `npm run dev` + sideload manifest.xml
2. **GitHub Pages**: Push `dist/` to Pages, update manifest URLs
3. **Azure Static Web Apps**: Deploy for production use

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This is an independent open-source project and is not affiliated with, endorsed by, or connected to Anthropic or Microsoft. "Claude" is a trademark of Anthropic.
