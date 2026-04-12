export class ClawbotClient {
  constructor(socket) {
    this.socket = socket;
  }

  sendPrompt(prompt, context = {}) {
    this.socket.send(JSON.stringify({
      type: 'clawbot-prompt',
      prompt,
      context,
    }));
  }

  executeSkill(skillName, params) {
    this.socket.send(JSON.stringify({
      type: 'clawbot-execute-skill',
      skill: skillName,
      params,
    }));
  }

  handleResponse(data) {
    return {
      text: data.text || data.response || '',
      persona: data.persona || 'Clawbot',
      streaming: data.streaming || false,
      done: data.done || false,
      error: data.error || null,
    };
  }
}
