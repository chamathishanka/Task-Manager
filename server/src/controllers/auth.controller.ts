import type { Request, Response } from "express";
import { registerUser, verifyCredentials } from "../services/auth.service.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from "../utils/tokens.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

const REFRESH_COOKIE = "refreshToken";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

export async function register(req: Request, res: Response) {
  const user = await registerUser(req.body);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await verifyCredentials(email, password);
  if (!user) throw new AppError("Invalid credentials", 401);

  const payload: JwtPayload = { sub: user.id, role: user.role };
  setRefreshCookie(res, signRefreshToken(payload));
  res.json({ accessToken: signAccessToken(payload), user });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new AppError("No refresh token", 401);

  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError("Invalid refresh token", 401);
  }

  const next: JwtPayload = { sub: payload.sub, role: payload.role };
  setRefreshCookie(res, signRefreshToken(next)); // rotation
  res.json({ accessToken: signAccessToken(next) });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ message: "Logged out" });
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user) throw new AppError("User not found", 404);
  res.json({ user });
}
