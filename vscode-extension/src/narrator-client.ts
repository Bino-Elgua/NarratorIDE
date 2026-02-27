import * as WebSocket from 'ws';
import { EventEmitter } from 'events';

interface NarratorState {
  language: string;
  tone: string;
  persona: any;
  isNarrating: boolean;
}

class NarratorClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private state: NarratorState = {
    language: 'javascript',
    tone: 'casual',
    persona: {},
    isNarrating: false
  };
  public isConnected = false;

  constructor(serverUrl: string) {
    super();
    this.serverUrl = serverUrl;
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        console.log('Connected to Narrator Server');
        this.isConnected = true;
        this.emit('connected');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from Narrator Server');
        this.isConnected = false;
        this.emit('disconnected');
        // Attempt reconnect after 5 seconds
        setTimeout(() => this.connect(), 5000);
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });
    } catch (error) {
      console.error('Connection error:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'state':
        this.state = message.data;
        this.emit('state-updated', this.state);
        break;

      case 'narration':
        this.emit('narration', message.data);
        break;

      case 'persona-changed':
        this.state.language = message.data.language;
        this.state.persona = message.data.persona;
        this.emit('persona-changed', message.data);
        break;

      case 'tone-changed':
        this.state.tone = message.data.tone;
        this.emit('tone-changed', message.data);
        break;

      case 'personas':
        this.emit('personas', message.data);
        break;

      case 'tones':
        this.emit('tones', message.data);
        break;

      case 'error':
        this.emit('error', message.error);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  async sendCodeChange(change: any) {
    if (!this.isConnected) {
      console.warn('Not connected to Narrator Server');
      return;
    }

    this.ws?.send(JSON.stringify({
      type: 'code-change',
      ...change
    }));
  }

  setPersona(language: string) {
    if (!this.isConnected) return;
    this.ws?.send(JSON.stringify({
      type: 'set-persona',
      language
    }));
  }

  setTone(tone: string) {
    if (!this.isConnected) return;
    this.ws?.send(JSON.stringify({
      type: 'set-tone',
      tone
    }));
  }

  async getPersonas() {
    return new Promise((resolve) => {
      if (!this.isConnected) {
        resolve([]);
        return;
      }

      const handler = (personas: any[]) => {
        this.removeListener('personas', handler);
        resolve(personas);
      };

      this.on('personas', handler);
      this.ws?.send(JSON.stringify({ type: 'get-personas' }));
    });
  }

  async getTones() {
    return new Promise((resolve) => {
      if (!this.isConnected) {
        resolve([]);
        return;
      }

      const handler = (tones: any[]) => {
        this.removeListener('tones', handler);
        resolve(tones);
      };

      this.on('tones', handler);
      this.ws?.send(JSON.stringify({ type: 'get-tones' }));
    });
  }

  getCurrentState(): NarratorState {
    return this.state;
  }

  reconnect(newUrl: string) {
    this.disconnect();
    this.serverUrl = newUrl;
    this.connect();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export default NarratorClient;
