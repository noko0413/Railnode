import type { ErrorRequestHandler } from "express";

type Logger = (message: string) => void;

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export class HttpError extends Error {
    public readonly status: number;
    public readonly details?: unknown;

    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.details = details;
    }
}

function pickStatus(err: unknown): number {
    if (err instanceof HttpError) return err.status;

    // express.json() parse errors typically come through as SyntaxError with status 400.
    if (err instanceof SyntaxError) {
        const anyErr = err as unknown as { status?: unknown; statusCode?: unknown; type?: unknown };
        const status = typeof anyErr.status === "number" ? anyErr.status : undefined;
        const statusCode = typeof anyErr.statusCode === "number" ? anyErr.statusCode : undefined;
        if (status === 400 || statusCode === 400) return 400;
        if (anyErr.type === "entity.parse.failed") return 400;
    }

    if (isRecord(err)) {
        const status = err["status"];
        const statusCode = err["statusCode"];
        const code = typeof status === "number" ? status : typeof statusCode === "number" ? statusCode : null;
        if (code && code >= 400 && code <= 599) return code;
    }

    return 500;
}

function safeClientMessage(status: number, err: unknown): { message: string; details?: unknown } {
    if (status === 400 && err instanceof SyntaxError) {
        return { message: "Invalid JSON" };
    }

    if (err instanceof HttpError) {
        return { message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) };
    }

    // Default: don’t leak stack traces, but keep error message (adapters already sanitize).
    const msg = errorMessage(err);
    return { message: msg || (status >= 500 ? "Internal server error" : "Request failed") };
}

export function createErrorMiddleware(opts: { log?: Logger } = {}): ErrorRequestHandler {
    const log = opts.log ?? (message => console.error(message));

    return (err, req, res, _next) => {
        const status = pickStatus(err);
        const { message, details } = safeClientMessage(status, err);

        // Log full error server-side.
        log(`[error] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
        if (err instanceof Error && err.stack) {
            log(err.stack);
        }

        if (res.headersSent) return;

        res.status(status).json({
            message,
            ...(details !== undefined ? { details } : {}),
        });
    };
}
