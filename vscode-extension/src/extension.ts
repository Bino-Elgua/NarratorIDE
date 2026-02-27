import * as vscode from 'vscode';
import NarratorClient from './narrator-client';

let narratorClient: NarratorClient;
let statusBar: vscode.StatusBarItem;
let isNarratingEnabled = true;

export function activate(context: vscode.ExtensionContext) {
  console.log('Narrator IDE extension activated');

  // Initialize narrator client
  const serverUrl = vscode.workspace.getConfiguration('narrator').get<string>('serverUrl') || 'ws://localhost:3000';
  narratorClient = new NarratorClient(serverUrl);

  // Create status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'narrator.toggleNarration';
  updateStatusBar();
  statusBar.show();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('narrator.toggleNarration', () => {
      isNarratingEnabled = !isNarratingEnabled;
      updateStatusBar();
    }),

    vscode.commands.registerCommand('narrator.nextPersona', async () => {
      const personas = await narratorClient.getPersonas();
      const current = narratorClient.getCurrentState().language;
      const currentIndex = personas.findIndex(p => p.id === current);
      const nextIndex = (currentIndex + 1) % personas.length;
      narratorClient.setPersona(personas[nextIndex].id);
      updateStatusBar();
    }),

    vscode.commands.registerCommand('narrator.nextTone', async () => {
      const tones = await narratorClient.getTones();
      const current = narratorClient.getCurrentState().tone;
      const currentIndex = tones.findIndex(t => t.id === current);
      const nextIndex = (currentIndex + 1) % tones.length;
      narratorClient.setTone(tones[nextIndex].id);
      updateStatusBar();
    }),

    vscode.commands.registerCommand('narrator.setServerUrl', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'Enter Narrator Server URL',
        value: serverUrl,
        placeHolder: 'ws://localhost:3000'
      });

      if (url) {
        vscode.workspace.getConfiguration('narrator').update('serverUrl', url);
        narratorClient.reconnect(url);
      }
    })
  );

  // Watch for text editor changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (!isNarratingEnabled || !narratorClient.isConnected) return;

      const { document, contentChanges } = event;
      
      for (const change of contentChanges) {
        // Get the full document text
        const code = document.getText();
        const language = getLanguageFromFilename(document.fileName);
        const filename = document.fileName.split('/').pop() || 'unknown';

        // Send to narrator
        await narratorClient.sendCodeChange({
          code,
          previousCode: change.text,
          language,
          filename,
          linesChanged: contentChanges.length
        });
      }
    })
  );

  // Listen for narrations
  narratorClient.on('narration', (data: any) => {
    const message = `🎙️ ${data.persona.name}: ${data.text}`;
    vscode.window.showInformationMessage(message, { modal: false });
    
    // Play audio if available
    if (data.audio) {
      playAudio(Buffer.from(data.audio, 'base64'));
    }
  });

  narratorClient.on('persona-changed', (data: any) => {
    updateStatusBar();
    vscode.window.showInformationMessage(`✨ Narrator: ${data.persona.name}`);
  });

  narratorClient.on('tone-changed', (data: any) => {
    updateStatusBar();
    vscode.window.showInformationMessage(`🎨 Tone: ${data.tone}`);
  });
}

function updateStatusBar() {
  const state = narratorClient?.getCurrentState();
  const enabledIcon = isNarratingEnabled ? '🎙️' : '🔇';
  const text = `${enabledIcon} ${state?.language || 'narrator'} (${state?.tone || 'tone'})`;
  statusBar.text = text;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop() || '';
  const map: { [key: string]: string } = {
    'rs': 'rust',
    'go': 'go',
    'py': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'c': 'c',
    'java': 'java',
    'lisp': 'lisp',
    'cl': 'lisp'
  };
  return map[ext] || 'javascript';
}

function playAudio(buffer: Buffer) {
  // This would require additional setup for Node.js audio playback
  // For now, just log it
  console.log('Audio buffer ready for playback:', buffer.length, 'bytes');
}

export function deactivate() {
  if (narratorClient) {
    narratorClient.disconnect();
  }
}
