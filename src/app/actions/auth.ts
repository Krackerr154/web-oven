"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone must be at least 8 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterResult = {
  success: boolean;
  message: string;
};

export async function registerUser(data: Record<string, any>): Promise<RegisterResult> {
  try {
    const raw = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
    };

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0].message,
      };
    }

    const { name, email, phone, password } = parsed.data;

    // Check uniqueness
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      return {
        success: false,
        message:
          existingUser.email === email
            ? "Email already registered"
            : "Phone number already registered",
      };
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: "USER",
        status: "PENDING",
      },
    });

    return {
      success: true,
      message: "Registration submitted. Please wait for admin approval.",
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
