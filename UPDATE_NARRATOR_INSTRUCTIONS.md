# Update narrator.js for Multi-LLM

In `src/narrator.js`, make these changes:

1. **At the top**, add:
```javascript
const { generateNarration: generateNarrationLLM } = require('./llm-provider');
```

2. **In the `narrate()` method** (around line 116), replace:
```javascript
const response = await this.client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 150,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: userMessage
    }
  ]
});

const narration = response.content[0].text;
```

With:
```javascript
// Multi-LLM: generates narration via configured provider
const narration = await generateNarrationLLM(
  codeChange.after,
  this.currentLanguage,
  this.currentTone
);
```

3. Remove the old Anthropic client initialization (line 14):
```javascript
this.client = new Anthropic({ apiKey: this.apiKey });
```

Done! Now your narrator uses the multi-LLM router.
