const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.c': 'c',
  '.cpp': 'cpp',
  '.java': 'java',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.md': 'markdown',
  '.sh': 'shell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.sql': 'sql',
  '.lisp': 'lisp',
};

export function getLanguageFromPath(filePath) {
  const ext = '.' + filePath.split('.').pop().toLowerCase();
  return LANGUAGE_MAP[ext] || 'plaintext';
}

export async function initMonaco(containerId) {
  return new Promise((resolve, reject) => {
    const cdnBase = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min';

    if (typeof window.require === 'undefined') {
      const loaderScript = document.createElement('script');
      loaderScript.src = `${cdnBase}/vs/loader.js`;
      loaderScript.onload = () => loadEditor(cdnBase, containerId, resolve, reject);
      loaderScript.onerror = () => reject(new Error('Failed to load Monaco loader'));
      document.head.appendChild(loaderScript);
    } else {
      loadEditor(cdnBase, containerId, resolve, reject);
    }
  });
}

function loadEditor(cdnBase, containerId, resolve, reject) {
  window.require.config({
    paths: { vs: `${cdnBase}/vs` },
  });

  window.require(['vs/editor/editor.main'], () => {
    const container = document.getElementById(containerId);
    if (!container) {
      reject(new Error(`Container #${containerId} not found`));
      return;
    }

    const editor = monaco.editor.create(container, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      minimap: { enabled: true, scale: 1 },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      bracketPairColorization: { enabled: true },
      padding: { top: 8 },
    });

    resolve(editor);
  }, reject);
}
