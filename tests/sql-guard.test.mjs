// Contract tests for isReadOnlySql — generated from
// sdlc/changes/sql-guard-string-literals/contract/tests.md (rows 1-9).
// Run against the compiled output: npm run build && node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReadOnlySql } from '../dist/services/db.js';

const ACCEPT = [
  ["keyword inside single-quoted literal", "SELECT * FROM audit WHERE action = 'please delete row'"],
  ['keyword inside dollar-quoted literal', 'SELECT $tag$please DROP TABLE x$tag$'],
  ["doubled-quote escape", "SELECT 'it''s time to update the app'"],
];
const REJECT = [
  ['unterminated literal fails closed', "SELECT 'abc"],
  ['multi-statement smuggle', 'SELECT 1; DROP TABLE users'],
  ['data-modifying CTE', 'WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d'],
  ['plain write', 'INSERT INTO t VALUES (1)'],
  ["write after a literal", "SELECT 'x'; DELETE FROM t"],
  ['comment smuggle', 'SELECT 1 /* x */; DROP TABLE t'],
];

for (const [name, sql] of ACCEPT) {
  test(`accepts: ${name}`, () => assert.equal(isReadOnlySql(sql), true, sql));
}
for (const [name, sql] of REJECT) {
  test(`rejects: ${name}`, () => assert.equal(isReadOnlySql(sql), false, sql));
}

// Rows 10-13 — added from the review panel's blockers/improvements.
test('accepts: positional parameters are untouched', () =>
  assert.equal(isReadOnlySql('SELECT * FROM t WHERE id = $1 AND status = $2'), true));
for (const sql of ['UPDATE t SET x = 1', 'DELETE FROM t', 'DROP TABLE t', 'TRUNCATE t', 'ALTER TABLE t ADD c int']) {
  test(`rejects: plain write ${sql.split(' ')[0]}`, () => assert.equal(isReadOnlySql(sql), false, sql));
}
test('accepts: mixed literal types adjacent', () =>
  assert.equal(isReadOnlySql(`SELECT 'delete' || $t$update$t$ || "drop"`), true));
test('accepts: different-tag dollar nesting (postgres semantics)', () =>
  assert.equal(isReadOnlySql('SELECT $a$ x $b$ DROP TABLE t $b$ y $a$'), true));

// Security-panel blockers — literal-forged comments must never hide a write.
for (const [name, sql] of [
  ["single-quote forged comment", "SELECT '/*' ; DROP TABLE t; SELECT '*/'"],
  ['double-quote forged comment', 'SELECT "/*" ; DROP TABLE t; SELECT "*/"'],
  ['dollar-quote forged comment', 'SELECT $$/*$$ ; DROP TABLE t; SELECT $$*/$$'],
  ['unterminated block comment', 'SELECT 1 /* x'],
]) {
  test(`rejects: ${name}`, () => assert.equal(isReadOnlySql(sql), false, sql));
}
test('accepts: nested block comment fully stripped', () =>
  assert.equal(isReadOnlySql('SELECT 1 /* a /* b */ c */'), true));
test('accepts: line comment containing a write keyword', () =>
  assert.equal(isReadOnlySql('SELECT 1 -- DROP TABLE t'), true));
