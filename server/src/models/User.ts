import mongoose, { Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "admin" | "user";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user" },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.set("toJSON", {
  transform(_doc, ret) {
    const {
      passwordHash: _ph,
      __v: _v,
      ...rest
    } = ret as unknown as Record<string, unknown>;
    return rest;
  },
});

export const User = mongoose.model<IUser, UserModel>("User", userSchema);
