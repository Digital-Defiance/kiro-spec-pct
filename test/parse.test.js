// Run with: node test/parse.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseTasks } = require('../src/parse');

const auth = fs.readFileSync(path.join(__dirname, 'fixtures/.kiro/specs/auth-flow/tasks.md'), 'utf8');

let r = parseTasks(auth);
assert.deepStrictEqual([r.done, r.total, r.inProgress, r.optional, r.percent], [4, 8, 1, 1, 50]);
assert.strictEqual(r.nextTask, '2. Implement login');

r = parseTasks(auth, { includeOptional: false });
assert.deepStrictEqual([r.done, r.total, r.percent], [4, 7, 57]);

r = parseTasks(auth, { topLevelOnly: true });
assert.deepStrictEqual([r.done, r.total, r.percent], [1, 3, 33]);

r = parseTasks('- [x] a\n- [X] b\n* [ ] c\n1. [ ] d\n\t- [x] e');
assert.deepStrictEqual([r.done, r.total], [3, 5]);

r = parseTasks('# nothing here');
assert.deepStrictEqual([r.total, r.percent, r.nextTask], [0, 0, null]);

console.log('all parser tests passed');
