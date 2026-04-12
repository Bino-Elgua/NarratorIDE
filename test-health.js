#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

const SERVER_SCRIPT = 'src/server.js';
const PORT = process.env.PORT || 3000;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 1000;

const serverProcess = spawn('node', [SERVER_SCRIPT], {
  detached: false,
  stdio: 'ignore'
});

let attempts = 0;
let shutdownCalled = false;

function shutdown(code = 0) {
  if (shutdownCalled) return;
  shutdownCalled = true;
  if (!serverProcess.killed) {
    serverProcess.kill();
  }
  process.exit(code);
}

function checkHealth() {
  attempts += 1;
  const req = http.get(HEALTH_URL, (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Health endpoint succeeded');
        console.log(body);
        shutdown(0);
      } else if (attempts < MAX_ATTEMPTS) {
        setTimeout(checkHealth, RETRY_DELAY_MS);
      } else {
        console.error(`❌ Health check failed after ${attempts} attempts. Status: ${res.statusCode}`);
        console.error(body);
        shutdown(1);
      }
    });
  });

  req.on('error', (err) => {
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(checkHealth, RETRY_DELAY_MS);
      return;
    }

    console.error(`❌ Unable to reach health endpoint: ${err.message}`);
    shutdown(1);
  });

  req.setTimeout(5000, () => {
    req.abort();
  });
}

setTimeout(checkHealth, 1000);
