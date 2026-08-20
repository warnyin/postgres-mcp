# Digest — sql-guard-string-literals (2026-08-20)
Shipped: SQL read-only guard rewritten as a single-pass tokenizer (quotes + comments
together, fail closed) + EXPLAIN ANALYZE now runs inside a READ ONLY transaction.
Spec merged: specs/sql-guard/spec.md (3 requirements, 8 scenarios). Tests: 23/23.
Review panel found 1 real bypass (literal-forged /* */ comment, PoC-verified,
reachable via postgres_explain analyze=true) and 2 contract gaps — all fixed.
Assumptions: E'\'' backslash strings conservatively rejected (fail closed).
Verify rounds: 3 (contract RED → fix → panel additions). Human approved ship (deep tier).

Learner proposals (awaiting human):
- add steering `sql-guard.md` (inclusion: paths, src/services/db.ts + src/tools/**):
  "security-surface contracts SHALL include forged-comment/quote adversarial rows".
- no demotions (no prior steering existed) · framework fixes already upstreamed (0.1.2).
