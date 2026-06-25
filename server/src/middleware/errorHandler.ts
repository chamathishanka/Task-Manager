import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

export function notFound(req: Request, res: Response) {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    const status = err instanceof AppError ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ message: err.message || "Internal server error" });
}
