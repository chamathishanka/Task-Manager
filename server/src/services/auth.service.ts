import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw new AppError("Email already in use", 409);

  const passwordHash = await bcrypt.hash(input.password, 10);
  return User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: "user",
  });
}

export async function verifyCredentials(email: string, password: string) {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) return null;
  const ok = await user.comparePassword(password);
  return ok ? user : null;
}
