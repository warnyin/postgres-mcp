---
id: sql-guard-string-literals
tier: deep
status: shipped
---
# Change: SQL read-only guard must ignore string literals
<!-- cap:150 · deep tier: touches isReadOnlySql (security surface, hard-floor). -->

## Why (≤5 lines)
`isReadOnlySql` scans the whole statement for write keywords, including inside
string literals — so legitimate read-only queries like
`SELECT * FROM audit WHERE action = 'please delete row'` are rejected (false positive).
The guard must ignore literal content without ever weakening real rejection.

## Assumptions
- E-strings with backslash-escaped quotes (`E'\''`) are rare in read-only analytics
  queries; conservatively rejecting them is acceptable (fail closed, documented out of scope).

## Delta: sql-guard

### ADDED Requirement: Write-keyword rejection outside literals
The system SHALL classify SQL as not read-only when a write keyword
(INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE/...) appears in
executable text — including multi-statement payloads and data-modifying CTEs.

#### Scenario: multi-statement smuggle
- WHEN sql is `SELECT 1; DROP TABLE users`
- THEN the statement is rejected as not read-only

#### Scenario: data-modifying CTE
- WHEN sql is `WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d`
- THEN the statement is rejected as not read-only

#### Scenario: literal-forged comment cannot hide a write
- WHEN sql is `SELECT '/*' ; DROP TABLE t; SELECT '*/'`
- THEN the statement is rejected as not read-only

### ADDED Requirement: EXPLAIN ANALYZE engine backstop
The system SHALL run EXPLAIN ANALYZE inside a READ ONLY transaction so the
engine rejects any write the client-side classifier might miss.

#### Scenario: analyze path is engine-guarded
- WHEN postgres_explain is called with analyze=true
- THEN the statement executes inside a READ ONLY transaction

### ADDED Requirement: String literals do not affect classification
The system SHALL NOT reject a read-only statement merely because a write keyword
appears inside a string literal ('single-quoted' with '' doubling, or
$tag$dollar-quoted$tag$). An unterminated or ambiguous literal SHALL classify
the statement as not read-only (fail closed).

#### Scenario: keyword inside single-quoted literal
- WHEN sql is `SELECT * FROM audit WHERE action = 'please delete row'`
- THEN the statement is accepted as read-only

#### Scenario: keyword inside dollar-quoted literal
- WHEN sql is `SELECT $tag$please DROP TABLE x$tag$`
- THEN the statement is accepted as read-only

#### Scenario: doubled-quote escape
- WHEN sql is `SELECT 'it''s time to update the app'`
- THEN the statement is accepted as read-only

#### Scenario: unterminated literal fails closed
- WHEN sql is `SELECT 'abc`
- THEN the statement is rejected as not read-only

## Design
- decision: strip string literals (single-quoted with '' doubling + dollar-quoted) from the
  remainder BEFORE the write-keyword scan · alternatives: full SQL parser (new dependency —
  forbidden by constitution) / leave as-is (false positives stay) · because: stripping only
  removes text so it can never unhide a write keyword; unbalanced quote → reject = fail closed.
- decision: tokenize comments AND quotes in ONE pass (security panel PoC: quote-unaware
  comment regex let two literals spelling /* and */ delete a real DROP between them) ·
  alternatives: keep comments-then-quotes order (exploitable) · because: single scanner =
  no ordering hazard; unterminated comment fails closed like unterminated quote.
- decision: keep the engine-level READ ONLY transaction untouched — client parser stays a
  first line of defense, the transaction remains the guarantee.

## Tasks
- [x] T1 add literal-stripping to isReadOnlySql in src/services/db.ts (fail closed) [tier:balanced]
- [x] T2 wire `npm test` (build + node --test) and add regression tests for all scenarios [P] [tier:cheap]
