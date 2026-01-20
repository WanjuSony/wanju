# UX Research System Setup

Because the system default Node.js was missing, I have installed a local version of Node.js v20 in `.tools`.

## How to Run

1. Open your terminal in VS Code.
2. Navigate to the project folder:
   ```bash
   cd "ux-research-system"
   ```
3. Source the environment script (this adds node to your path for this session):
   ```bash
   source ./env_setup.sh
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features Ready
- **Dashboard**: Lists all transcripts from the Archive folder.
- **Transcript Viewer**: Click "View Raw" to see the parsed dialogue of any podcast.
