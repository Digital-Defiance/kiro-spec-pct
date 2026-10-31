// Pure parser: no vscode imports, so it's easy to test and tweak.
//
// Recognised task lines (any indent, "-" or "*" or "1." bullets):
//   - [x] done          - [X] done
//   - [ ] todo          - [-] in progress   - [~] queued / in progress
//   - [ ]* optional     (Kiro marks optional tasks with a * after the box)

const TASK_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX\-~])\](\*)?\s*(.*)$/;

function parseTasks(text, opts = {}) {
  const { includeOptional = true, topLevelOnly = false } = opts;
  const tasks = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = TASK_RE.exec(line);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, '  ').length;
    const mark = m[2];
    tasks.push({
      indent,
      title: m[4].trim(),
      done: mark === 'x' || mark === 'X',
      inProgress: mark === '-' || mark === '~',
      optional: !!m[3],
    });
  }

  const minIndent = tasks.length ? Math.min(...tasks.map(t => t.indent)) : 0;
  const counted = tasks.filter(t =>
    (includeOptional || !t.optional) && (!topLevelOnly || t.indent === minIndent));

  const total = counted.length;
  const done = counted.filter(t => t.done).length;
  const inProgress = counted.filter(t => t.inProgress).length;
  const next = counted.find(t => !t.done);
  return {
    total,
    done,
    inProgress,
    todo: total - done,
    optional: tasks.filter(t => t.optional).length,
    percent: total ? Math.round((done / total) * 100) : 0,
    nextTask: next ? next.title : null,
  };
}

module.exports = { parseTasks };
