export class SplitPane {
  constructor(splitterEl, topEl, bottomEl, options = {}) {
    this.splitter = typeof splitterEl === 'string' ? document.getElementById(splitterEl) : splitterEl;
    this.topEl = typeof topEl === 'string' ? document.getElementById(topEl) : topEl;
    this.bottomEl = typeof bottomEl === 'string' ? document.getElementById(bottomEl) : bottomEl;
    this.minTop = options.minTop || 150;
    this.minBottom = options.minBottom || 80;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._startY = 0;
    this._startTopHeight = 0;
  }

  init() {
    this.splitter.addEventListener('mousedown', this._onMouseDown);
  }

  _onMouseDown(e) {
    e.preventDefault();
    this._startY = e.clientY;
    this._startTopHeight = this.topEl.getBoundingClientRect().height;
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  _onMouseMove(e) {
    const delta = e.clientY - this._startY;
    const parentHeight = this.topEl.parentElement.getBoundingClientRect().height;
    const splitterHeight = this.splitter.getBoundingClientRect().height;
    let newTopHeight = this._startTopHeight + delta;
    const maxTop = parentHeight - splitterHeight - this.minBottom;

    newTopHeight = Math.max(this.minTop, Math.min(newTopHeight, maxTop));

    this.topEl.style.height = `${newTopHeight}px`;
    this.bottomEl.style.height = `${parentHeight - newTopHeight - splitterHeight}px`;
  }

  _onMouseUp() {
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  destroy() {
    this.splitter.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }
}
