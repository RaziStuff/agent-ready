import fs from "node:fs/promises";
import path from "node:path";
import { availableSchemaIds, loadSchemaById } from "./catalog.js";

const SCHEMA_VERSION = "0.1.0";

function jsonText(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function issue(pathValue, code, message, details = {}) {
  return {
    path: pathValue,
    code,
    message,
    ...details
  };
}

function pointerParts(ref) {
  return ref
    .replace(/^#\//, "")
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function localRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) {
    return null;
  }
  return pointerParts(ref).reduce((value, part) => value?.[part], rootSchema);
}

function typeName(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function isType(value, expectedType) {
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "null") return value === null;
  if (expectedType === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expectedType === "number") return typeof value === "number" && Number.isFinite(value);
  if (expectedType === "integer") return Number.isInteger(value);
  return typeof value === expectedType;
}

function describeTypes(types) {
  return types.join(" or ");
}

function validateCombinators(rootSchema, schema, value, pathValue) {
  const issues = [];

  if (Array.isArray(schema.oneOf)) {
    const branchIssues = schema.oneOf.map((item) => validateValue(rootSchema, item, value, pathValue));
    const matches = branchIssues.filter((itemIssues) => itemIssues.length === 0);
    if (matches.length !== 1) {
      issues.push(issue(
        pathValue,
        "oneOf",
        `Expected value to match exactly one allowed schema, matched ${matches.length}.`,
        { matchedSchemas: matches.length }
      ));
      if (matches.length === 0) {
        issues.push(...branchIssues.flat());
      }
    }
  }

  if (Array.isArray(schema.anyOf)) {
    const branchIssues = schema.anyOf.map((item) => validateValue(rootSchema, item, value, pathValue));
    const matches = branchIssues.filter((itemIssues) => itemIssues.length === 0);
    if (matches.length === 0) {
      issues.push(issue(pathValue, "anyOf", "Expected value to match at least one allowed schema."));
      issues.push(...branchIssues.flat());
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const [index, item] of schema.allOf.entries()) {
      issues.push(...validateValue(rootSchema, item, value, `${pathValue} allOf[${index}]`));
    }
  }

  return issues;
}

function validateArray(rootSchema, schema, value, pathValue) {
  const issues = [];
  if (!Array.isArray(value)) {
    return issues;
  }

  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    issues.push(issue(pathValue, "minItems", `Expected at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}.`, {
      minItems: schema.minItems,
      actual: value.length
    }));
  }
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    issues.push(issue(pathValue, "maxItems", `Expected no more than ${schema.maxItems} item${schema.maxItems === 1 ? "" : "s"}.`, {
      maxItems: schema.maxItems,
      actual: value.length
    }));
  }
  if (schema.items) {
    for (const [index, item] of value.entries()) {
      issues.push(...validateValue(rootSchema, schema.items, item, `${pathValue}[${index}]`));
    }
  }

  return issues;
}

function validateObject(rootSchema, schema, value, pathValue) {
  const issues = [];
  if (!isType(value, "object")) {
    return issues;
  }

  for (const requiredKey of schema.required ?? []) {
    if (!Object.hasOwn(value, requiredKey)) {
      issues.push(issue(`${pathValue}.${requiredKey}`, "required", "Required property is missing.", {
        required: requiredKey
      }));
    }
  }

  const properties = schema.properties ?? {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (Object.hasOwn(value, key)) {
      issues.push(...validateValue(rootSchema, propertySchema, value[key], `${pathValue}.${key}`));
    }
  }

  const additional = schema.additionalProperties;
  const knownKeys = new Set(Object.keys(properties));
  const extraKeys = Object.keys(value).filter((key) => !knownKeys.has(key));
  if (additional === false) {
    for (const key of extraKeys) {
      issues.push(issue(`${pathValue}.${key}`, "additionalProperties", "Unexpected property is not allowed.", {
        property: key
      }));
    }
  } else if (additional && typeof additional === "object") {
    for (const key of extraKeys) {
      issues.push(...validateValue(rootSchema, additional, value[key], `${pathValue}.${key}`));
    }
  }

  return issues;
}

export function validateValue(rootSchema, schema, value, pathValue = "$") {
  const issues = [];
  if (!schema || typeof schema !== "object") {
    return [issue(pathValue, "schema", "Invalid schema node.")];
  }

  if (schema.$ref) {
    const refSchema = localRef(rootSchema, schema.$ref);
    if (!refSchema) {
      return [issue(pathValue, "ref", `Could not resolve schema reference: ${schema.$ref}`, {
        ref: schema.$ref
      })];
    }
    return validateValue(rootSchema, refSchema, value, pathValue);
  }

  issues.push(...validateCombinators(rootSchema, schema, value, pathValue));

  const types = Array.isArray(schema.type) ? schema.type : (schema.type ? [schema.type] : []);
  if (types.length > 0 && !types.some((expectedType) => isType(value, expectedType))) {
    issues.push(issue(pathValue, "type", `Expected ${describeTypes(types)}, got ${typeName(value)}.`, {
      expected: types,
      actual: typeName(value)
    }));
    return issues;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    issues.push(issue(pathValue, "enum", `Expected one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}.`, {
      allowed: schema.enum,
      actual: value
    }));
  }

  if (typeof schema.pattern === "string" && typeof value === "string") {
    const pattern = new RegExp(schema.pattern);
    if (!pattern.test(value)) {
      issues.push(issue(pathValue, "pattern", `Expected string to match pattern ${schema.pattern}.`, {
        pattern: schema.pattern
      }));
    }
  }

  issues.push(...validateArray(rootSchema, schema, value, pathValue));
  issues.push(...validateObject(rootSchema, schema, value, pathValue));

  return issues;
}

export function validateAgainstSchema(schema, data) {
  return validateValue(schema, schema, data);
}

function baseReport({ reportPath, schemaId }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    reportFile: path.resolve(reportPath),
    requestedSchema: schemaId
  };
}

export async function verifyContract({ reportPath, schemaId }) {
  const base = baseReport({ reportPath, schemaId });
  const schemaResult = await loadSchemaById(schemaId);
  if (!schemaResult) {
    return {
      ...base,
      ok: false,
      status: "unknown_schema",
      schema: null,
      errors: [
        issue("$.schema", "unknown_schema", `Unknown schema id: ${schemaId}`, {
          availableSchemas: availableSchemaIds()
        })
      ]
    };
  }

  let data;
  try {
    data = JSON.parse(await fs.readFile(path.resolve(reportPath), "utf8"));
  } catch (error) {
    return {
      ...base,
      ok: false,
      status: error instanceof SyntaxError ? "invalid_json" : "read_error",
      schema: schemaResult.entry,
      errors: [
        issue("$", error instanceof SyntaxError ? "invalid_json" : "read_error", error.message)
      ]
    };
  }

  const errors = validateAgainstSchema(schemaResult.schema, data);
  return {
    ...base,
    ok: errors.length === 0,
    status: errors.length === 0 ? "valid" : "invalid",
    schema: schemaResult.entry,
    issueCount: errors.length,
    errors
  };
}

export function formatContractVerification(report) {
  const lines = [
    "# Agent Ready Contract Verification",
    "",
    `Status: ${report.status}`,
    `Report: ${report.reportFile}`,
    report.schema ? `Schema: ${report.schema.id} (${report.schema.file})` : `Schema: ${report.requestedSchema}`,
    `Issues: ${report.errors?.length ?? report.issueCount ?? 0}`,
    ""
  ];

  if (report.ok) {
    lines.push("The report matches the requested schema.");
    lines.push("");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Issues");
  lines.push("");
  for (const item of report.errors ?? []) {
    lines.push(`- \`${item.path}\` ${item.message}`);
  }
  lines.push("");

  if (report.status === "unknown_schema") {
    const available = report.errors?.[0]?.availableSchemas ?? [];
    lines.push("## Available Schemas");
    lines.push("");
    for (const schema of available) {
      lines.push(`- \`${schema}\``);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function contractVerificationOutput(report, json = false) {
  return json ? jsonText(report) : formatContractVerification(report);
}
