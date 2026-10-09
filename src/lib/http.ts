import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { logger } from "./logger";

// Machine-readable error codes (spec section 6 "Error contract").
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_SIGNATURE"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_SIGNATURE: 401,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public fields?: Record<string, string>,
  ) {
    super(message ?? code);
  }
}

export function newRequestId() {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function json(data: unknown, status: number, requestId: string) {
  return NextResponse.json(data, { status, headers: { "x-request-id": requestId } });
}

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Converts any thrown error into the public error contract. Never leaks internals. */
export function errorResponse(err: unknown, requestId: string) {
  if (err instanceof ZodError) {
    return json({ error: "VALIDATION_ERROR", requestId, fields: zodFields(err) }, 422, requestId);
  }
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = { error: err.code, requestId };
    if (err.fields) body.fields = err.fields;
    if (err.message && err.message !== err.code) body.message = err.message;
    return json(body, STATUS[err.code], requestId);
  }
  logger.error("unhandled_error", { requestId, error: err });
  return json({ error: "INTERNAL_ERROR", requestId }, 500, requestId);
}

/**
 * Template-method style wrapper for route handlers: assigns a request ID,
 * runs the handler, and maps errors to the contract in one place.
 */
export function handler<C>(fn: (req: Request, ctx: C, requestId: string) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    const requestId = req.headers.get("x-request-id") ?? newRequestId();
    try {
      return await fn(req, ctx, requestId);
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
