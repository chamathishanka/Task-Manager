import type { Request, Response, NextFunction } from "express";

export function notFound(req: Request, res: Response) {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error(err);
    res.status(500).json({ message: err.message || "Internal server error" });
}
