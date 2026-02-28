/**
 * Narrator IDE - UI Utilities
 * Helper functions for UI interactions and DOM manipulation
 */

/**
 * Render personas as selectable options
 */
function renderPersonas(personas) {
  appState.personas = personas;

  const select = document.getElementById('personaSelect');
  if (select) {
    select.innerHTML = personas
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join('');
    select.value = appState.persona;
  }
}

/**
 * Render tones as selectable options
 */
function renderTones(tones) {
  appState.tones = tones;

  const select = document.getElementById('toneSelect');
  if (select) {
    select.innerHTML = tones
      .map(t => `<option value="${t.id}">${t.name}</option>`)
      .join('');
    select.value = appState.tone;
  }
}

/**
 * Format timestamp for display
 */
function formatTime(date) {
  if (!date) return 'Never';
  
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return new Date(date).toLocaleDateString();
  }
}

/**
 * Show a temporary toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${getToastColor(type)};
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    animation: slideInUp 300ms ease;
    max-width: 300px;
    word-wrap: break-word;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutDown 300ms ease';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, duration);
}

/**
 * Get toast color by type
 */
function getToastColor(type) {
  const colors = {
    info: 'rgba(88, 166, 255, 0.9)',
    success: 'rgba(63, 185, 80, 0.9)',
    warning: 'rgba(251, 133, 0, 0.9)',
    error: 'rgba(248, 81, 73, 0.9)',
  };
  return colors[type] || colors.info;
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
    return true;
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Failed to copy', 'error');
    return false;
  }
}

/**
 * Debounce function
 */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Get persona color
 */
function getPersonaColor(personaId) {
  const colors = {
    rust: '#ce9178',
    go: '#00add8',
    python: '#3776ab',
    javascript: '#f7df1e',
    c: '#555555',
    java: '#007396',
    lisp: '#3f26bf',
    typescript: '#3178c6',
  };
  return colors[personaId] || '#58a6ff';
}

/**
 * Sanitize HTML to prevent XSS
 */
function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Format narration text with emphasis
 */
function formatNarrationText(text) {
  // Simple markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background: rgba(88, 166, 255, 0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace; color: #58a6ff;">$1</code>');
}

/**
 * Get browser info for compatibility checks
 */
function getBrowserInfo() {
  const ua = navigator.userAgent;
  const browsers = {
    chrome: /Chrome/i,
    firefox: /Firefox/i,
    safari: /Safari/i,
    edge: /Edge/i,
  };

  for (const [name, regex] of Object.entries(browsers)) {
    if (regex.test(ua)) {
      return name;
    }
  }

  return 'unknown';
}

/**
 * Check if browser supports required APIs
 */
function checkBrowserSupport() {
  const required = {
    WebSocket: typeof WebSocket !== 'undefined',
    AudioContext: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined',
    localStorage: typeof localStorage !== 'undefined',
    clipboard: navigator.clipboard !== undefined,
  };

  const missing = Object.entries(required)
    .filter(([, supported]) => !supported)
    .map(([api]) => api);

  if (missing.length > 0) {
    console.warn('Missing browser APIs:', missing);
  }

  return required;
}

/**
 * Detect user's system theme preference
 */
function detectSystemTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

  if (prefersDark) return 'dark';
  if (prefersLight) return 'light';
  return 'auto';
}

/**
 * Get viewport dimensions
 */
function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
  };
}

/**
 * Setup responsive observer for sidebars
 */
function setupResponsiveObserver() {
  const mql = window.matchMedia('(max-width: 768px)');
  
  const handleChange = (e) => {
    const sidebarLeft = document.getElementById('sidebarLeft');
    const sidebarRight = document.getElementById('sidebarRight');
    
    if (e.matches) {
      // Mobile: hide sidebars
      if (sidebarLeft) sidebarLeft.style.display = 'none';
      if (sidebarRight) sidebarRight.style.display = 'none';
    } else {
      // Desktop: show sidebars
      if (sidebarLeft) sidebarLeft.style.display = 'flex';
      if (sidebarRight) sidebarRight.style.display = 'flex';
    }
  };

  mql.addEventListener('change', handleChange);
  handleChange(mql); // Initial check
}

/**
 * Export utilities to window for global access
 */
Object.assign(window, {
  formatTime,
  showToast,
  copyToClipboard,
  debounce,
  throttle,
  getPersonaColor,
  sanitizeHtml,
  formatNarrationText,
  getBrowserInfo,
  checkBrowserSupport,
  detectSystemTheme,
  getViewportSize,
  setupResponsiveObserver,
});

/**
 * Initialize UI utilities on load
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check browser support
  const support = checkBrowserSupport();
  console.log('Browser support:', support);

  // Setup responsive observer
  setupResponsiveObserver();

  // Log viewport info
  console.log('Viewport:', getViewportSize());
  console.log('System theme:', detectSystemTheme());
  console.log('Browser:', getBrowserInfo());

  // Log CSS support
  console.log('CSS Grid support:', CSS.supports('display', 'grid'));
});
