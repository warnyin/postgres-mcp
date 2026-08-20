# Spec: sql-guard

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: Write-keyword rejection outside literals
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

### Requirement: EXPLAIN ANALYZE engine backstop
The system SHALL run EXPLAIN ANALYZE inside a READ ONLY transaction so the
engine rejects any write the client-side classifier might miss.

#### Scenario: analyze path is engine-guarded
- WHEN postgres_explain is called with analyze=true
- THEN the statement executes inside a READ ONLY transaction

### Requirement: String literals do not affect classification
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