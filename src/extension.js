const vscode = require('vscode');
const { parseTasks } = require('./parse');

/** Find every .kiro/specs/<name>/ in every workspace folder and parse its tasks.md. */
async function scanSpecs() {
  const cfg = vscode.workspace.getConfiguration('kiroSpecProgress');
  const opts = {
    includeOptional: cfg.get('includeOptional', true),
    topLevelOnly: cfg.get('topLevelOnly', false),
  };
  const multiRoot = (vscode.workspace.workspaceFolders || []).length > 1;
  const specs = [];

  for (const folder of vscode.workspace.workspaceFolders || []) {
    const specsDir = vscode.Uri.joinPath(folder.uri, '.kiro', 'specs');
    let entries;
    try { entries = await vscode.workspace.fs.readDirectory(specsDir); }
    catch { continue; } // no .kiro/specs here

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.Directory) continue;
      const tasksUri = vscode.Uri.joinPath(specsDir, name, 'tasks.md');
      let stats = null;
      try {
        // Use the open editor's (possibly unsaved) text if there is one, else read from disk.
        const open = vscode.workspace.textDocuments.find(d => d.uri.toString() === tasksUri.toString());
        const text = open ? open.getText() : Buffer.from(await vscode.workspace.fs.readFile(tasksUri)).toString('utf8');
        stats = parseTasks(text, opts);
      } catch { /* spec has no tasks.md yet */ }
      specs.push({
        name,
        label: multiRoot ? `${folder.name} / ${name}` : name,
        uri: tasksUri.toString(),
        hasTasks: !!stats,
        ...(stats || { total: 0, done: 0, inProgress: 0, todo: 0, percent: 0, nextTask: null }),
      });
    }
  }
  // Least complete first, so what needs attention is at the top.
  specs.sort((a, b) => (a.hasTasks === b.hasTasks ? a.percent - b.percent || a.label.localeCompare(b.label) : a.hasTasks ? -1 : 1));
  return specs;
}

class SpecProgressView {
  constructor(context) { this.context = context; this.view = null; this.specs = []; }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'open') vscode.window.showTextDocument(vscode.Uri.parse(msg.uri));
      if (msg.type === 'refresh') vscode.commands.executeCommand('kiroSpecProgress.refresh');
    });
    view.onDidChangeVisibility(() => view.visible && this.render());
    this.render();
  }

  update(specs) { this.specs = specs; this.render(); }

  render() {
    if (this.view) this.view.webview.html = renderHtml(this.specs, this.view.webview.cspSource);
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderHtml(specs, cspSource) {
  const nonce = Math.random().toString(36).slice(2);
  const withTasks = specs.filter(s => s.hasTasks);
  const allDone = withTasks.reduce((n, s) => n + s.done, 0);
  const allTotal = withTasks.reduce((n, s) => n + s.total, 0);
  const overall = allTotal ? Math.round((allDone / allTotal) * 100) : 0;

  const rows = specs.map(s => {
    const cls = !s.hasTasks ? 'none' : s.percent === 100 ? 'complete' : s.percent === 0 ? 'zero' : '';
    const meta = s.hasTasks
      ? `${s.done}/${s.total} done${s.inProgress ? ` · ${s.inProgress} in progress` : ''}`
      : 'no tasks.md yet';
    return `
      <div class="spec ${cls}" data-uri="${esc(s.uri)}" title="${esc(s.nextTask ? 'Next: ' + s.nextTask : s.label)}">
        <div class="row"><span class="name">${esc(s.label)}</span><span class="pct">${s.hasTasks ? s.percent + '%' : '–'}</span></div>
        <div class="bar"><div class="fill" style="width:${s.percent}%"></div></div>
        <div class="meta">${meta}</div>
        ${s.nextTask && s.percent < 100 ? `<div class="next">Next: ${esc(s.nextTask)}</div>` : ''}
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { padding: 8px 12px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); }
  .overall { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--vscode-panel-border, transparent); }
  .overall .row .name { font-weight: 600; }
  .spec { padding: 6px 6px 8px; margin: 0 -6px 4px; border-radius: 4px; cursor: pointer; }
  .spec:hover { background: var(--vscode-list-hoverBackground); }
  .row { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pct { font-variant-numeric: tabular-nums; font-weight: 600; }
  .bar { height: 8px; margin: 4px 0; border-radius: 4px; overflow: hidden;
         background: var(--vscode-editorWidget-background, rgba(128,128,128,.2)); border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25)); }
  .fill { height: 100%; background: var(--vscode-progressBar-background, #0e70c0); transition: width .3s; }
  .complete .fill { background: var(--vscode-testing-iconPassed, #73c991); }
  .meta, .next { font-size: 0.9em; opacity: .75; }
  .next { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .none { opacity: .55; }
  .empty { opacity: .7; line-height: 1.5; }
  code { font-family: var(--vscode-editor-font-family); }
</style></head><body>
${specs.length === 0
    ? `<div class="empty">No specs found.<br>Looking for <code>.kiro/specs/*/tasks.md</code> in the open workspace.</div>`
    : `<div class="overall">
         <div class="row"><span class="name">All specs</span><span class="pct">${overall}%</span></div>
         <div class="bar"><div class="fill" style="width:${overall}%"></div></div>
         <div class="meta">${allDone}/${allTotal} tasks across ${withTasks.length} spec${withTasks.length === 1 ? '' : 's'}</div>
       </div>${rows}`}
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.querySelectorAll('.spec').forEach(el =>
    el.addEventListener('click', () => vscode.postMessage({ type: 'open', uri: el.dataset.uri })));
</script>
</body></html>`;
}

function activate(context) {
  const view = new SpecProgressView(context);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = 'kiroSpecProgress.show';
  context.subscriptions.push(status);

  let timer;
  const refresh = async () => {
    const specs = await scanSpecs();
    view.update(specs);
    const withTasks = specs.filter(s => s.hasTasks);
    const done = withTasks.reduce((n, s) => n + s.done, 0);
    const total = withTasks.reduce((n, s) => n + s.total, 0);
    if (total && vscode.workspace.getConfiguration('kiroSpecProgress').get('statusBar', true)) {
      status.text = `$(checklist) Specs ${Math.round((done / total) * 100)}%`;
      status.tooltip = withTasks.map(s => `${s.label}: ${s.percent}% (${s.done}/${s.total})`).join('\n');
      status.show();
    } else {
      status.hide();
    }
  };
  const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(refresh, 250); };

  const watcher = vscode.workspace.createFileSystemWatcher('**/.kiro/specs/**');
  watcher.onDidCreate(refreshSoon); watcher.onDidChange(refreshSoon); watcher.onDidDelete(refreshSoon);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('kiroSpecProgress.view', view),
    vscode.commands.registerCommand('kiroSpecProgress.refresh', refresh),
    vscode.commands.registerCommand('kiroSpecProgress.show', () =>
      vscode.commands.executeCommand('workbench.view.extension.kiroSpecProgress')),
    watcher,
    // Live-update while typing in a tasks.md, before it's even saved.
    vscode.workspace.onDidChangeTextDocument(e => {
      if (/[\\/]\.kiro[\\/]specs[\\/][^\\/]+[\\/]tasks\.md$/.test(e.document.uri.fsPath)) refreshSoon();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(refreshSoon),
    vscode.workspace.onDidChangeConfiguration(e => e.affectsConfiguration('kiroSpecProgress') && refreshSoon()),
  );
  refresh();
}

function deactivate() {}

module.exports = { activate, deactivate };
