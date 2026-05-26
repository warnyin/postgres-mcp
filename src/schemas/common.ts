import { z } from "zod";
import { ResponseFormat } from "../constants.js";

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' (human-readable) or 'json' (machine-readable)");

export const SqlParamsSchema = z
  .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .max(64, "At most 64 parameters per query")
  .default([])
  .describe("Positional parameter values for the SQL ($1, $2, ...). Strongly recommended over inline values to avoid SQL injection.");

export const SchemaNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_$]*$/, "Schema names must be valid PostgreSQL identifiers")
  .describe("PostgreSQL schema name");

export const TableNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_$]*$/, "Table names must be valid PostgreSQL identifiers")
  .describe("PostgreSQL table name (unquoted)");
