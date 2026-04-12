import { initMonaco, getLanguageFromPath } from './monaco-loader.js';

export class EditorManager {
  constructor(editorContainerId, tabBarId) {
    this.editorContainerId = editorContainerId;
    this.tabBarId = tabBarId;
    this.openFiles = new Map();
    this.activeFile = null;
    this.editor = null;
    this.tabBarEl = document.getElementById(tabBarId);
    this.onSave = null;
    this.onContentChange = null;
  }

  async init() {
    this.editor = await initMonaco(this.editorContainerId);

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      this.save();
    });

    this.editor.onDidChangeModelContent(() => {
      if (!this.activeFile) return;
      const file = this.openFiles.get(this.activeFile);
      if (file) {
        file.modified = true;
        this.renderTabs();
        if (this.onContentChange) {
          this.onContentChange(this.activeFile, this.getContent());
        }
      }
    });
  }

  openFile(path, content, language) {
    if (this.openFiles.has(path)) {
      this.switchToFile(path);
      return;
    }

    const lang = language || getLanguageFromPath(path);
    const model = monaco.editor.createModel(content, lang, monaco.Uri.parse(`file://${path}`));

    this.openFiles.set(path, {
      content,
      model,
      viewState: null,
      modified: false,
    });

    this.switchToFile(path);
    this.renderTabs();
  }

  switchToFile(path) {
    if (!this.openFiles.has(path)) return;

    if (this.activeFile && this.openFiles.has(this.activeFile)) {
      this.openFiles.get(this.activeFile).viewState = this.editor.saveViewState();
    }

    const file = this.openFiles.get(path);
    this.editor.setModel(file.model);
    if (file.viewState) {
      this.editor.restoreViewState(file.viewState);
    }

    this.activeFile = path;
    this.renderTabs();
  }

  closeFile(path) {
    const file = this.openFiles.get(path);
    if (!file) return;

    file.model.dispose();
    this.openFiles.delete(path);

    if (this.activeFile === path) {
      const remaining = [...this.openFiles.keys()];
      if (remaining.length > 0) {
        this.switchToFile(remaining[remaining.length - 1]);
      } else {
        this.activeFile = null;
        this.editor.setModel(null);
      }
    }

    this.renderTabs();
  }

  save() {
    if (!this.activeFile) return null;
    const file = this.openFiles.get(this.activeFile);
    if (!file) return null;

    const content = this.editor.getValue();
    file.content = content;
    file.modified = false;
    this.renderTabs();

    const result = { path: this.activeFile, content };
    if (this.onSave) this.onSave(result);
    return result;
  }

  getContent() {
    return this.editor ? this.editor.getValue() : '';
  }

  isModified(path) {
    const target = path || this.activeFile;
    if (!target) return false;
    const file = this.openFiles.get(target);
    return file ? file.modified : false;
  }

  setContent(path, content) {
    const file = this.openFiles.get(path);
    if (!file) return;
    file.content = content;
    file.model.setValue(content);
    file.modified = false;
    this.renderTabs();
  }

  renderTabs() {
    if (!this.tabBarEl) return;
    this.tabBarEl.innerHTML = '';

    for (const [path] of this.openFiles) {
      const file = this.openFiles.get(path);
      const tab = document.createElement('div');
      tab.className = 'tab' + (path === this.activeFile ? ' active' : '');
      tab.dataset.path = path;

      const name = path.split('/').pop();
      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = name;
      tab.appendChild(nameSpan);

      if (file.modified) {
        const dot = document.createElement('span');
        dot.className = 'tab-modified';
        dot.textContent = '●';
        tab.appendChild(dot);
      }

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeFile(path);
      });
      tab.appendChild(closeBtn);

      tab.addEventListener('click', () => this.switchToFile(path));
      this.tabBarEl.appendChild(tab);
    }
  }

  getCursorPosition() {
    if (!this.editor) return { line: 1, column: 1 };
    const pos = this.editor.getPosition();
    return { line: pos.lineNumber, column: pos.column };
  }

  onCursorChange(callback) {
    if (this.editor) {
      this.editor.onDidChangeCursorPosition((e) => {
        callback({ line: e.position.lineNumber, column: e.position.column });
      });
    }
  }
}
