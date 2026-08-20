# Test contract — sql-guard-string-literals
<!-- cap:60 · written BEFORE code. Failing tests are generated from this table. -->

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | `SELECT * FROM audit WHERE action = 'please delete row'` → accepted | unit | String literals do not affect classification |
| 2 | `SELECT $tag$please DROP TABLE x$tag$` → accepted | unit | String literals do not affect classification |
| 3 | `SELECT 'it''s time to update the app'` → accepted | unit | String literals do not affect classification |
| 4 | `SELECT 'abc` (unterminated) → rejected | unit | String literals do not affect classification |
| 5 | `SELECT 1; DROP TABLE users` → rejected | unit | Write-keyword rejection outside literals |
| 6 | `WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d` → rejected | unit | Write-keyword rejection outside literals |
| 7 | `INSERT INTO t VALUES (1)` → rejected | unit | Write-keyword rejection outside literals |
| 8 | `SELECT 'x'; DELETE FROM t` (write AFTER a literal) → rejected | unit | Write-keyword rejection outside literals |
| 9 | comment smuggle `SELECT 1 /* x */; DROP TABLE t` → rejected | unit | Write-keyword rejection outside literals |
| 10 | parameterized `SELECT * FROM t WHERE id = $1` → accepted | unit | String literals do not affect classification |
| 11 | plain `UPDATE t SET x = 1` and `DELETE FROM t` and `DROP TABLE t` → rejected | unit | Write-keyword rejection outside literals |
| 12 | mixed literal types `SELECT 'delete' || $t$update$t$ || "drop"` → accepted | unit | String literals do not affect classification |
| 14 | literal-forged comment `SELECT '/*' ; DROP TABLE t; SELECT '*/'` (+ `"` and `$$` variants) → rejected | unit | Write-keyword rejection outside literals |
| 15 | unterminated block comment `SELECT 1 /* x` → rejected (fail closed) | unit | String literals do not affect classification |
| 16 | nested block comment `SELECT 1 /* a /* b */ c */` → accepted · line comment `SELECT 1 -- DROP TABLE t` → accepted | unit | String literals do not affect classification |
| 13 | different-tag nesting `SELECT $a$ x $b$ DROP TABLE t $b$ y $a$` → accepted (matches postgres semantics) | unit | String literals do not affect classification |

## Out of scope (explicitly untested + why)
- E'\'' backslash-escape strings — rare in read-only analytics; conservative rejection is acceptable (fail closed).
- Live-database behavior — the READ ONLY transaction is engine-enforced and unchanged by this change.
- `EXPLAIN (ANALYZE, ...)` stays rejected by the client guard (pre-existing behavior for `EXPLAIN ANALYZE`; engine READ ONLY txn is the real guarantee) — candidate future change.
