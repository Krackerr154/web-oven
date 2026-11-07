"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { sendVerificationOtpEmail } from "@/lib/email";
import { SUPERVISORS } from "@/lib/supervisors";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^62\d+$/, "Phone must start with 62 and contain only numbers"),
  nim: z.string().min(3, "NIM or Student ID is required"),
  supervisors: z.array(z.string().min(2, "Supervisor name must be at least 2 characters")).min(1, "At least one supervisor is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Resolve submitted supervisor names against the department directory.
 *
 * The picker constrains what the UI can send, but a Server Action is a public
 * endpoint: the request can be forged with any string. Storing an unresolvable
 * name would recreate exactly the problem this registry exists to fix — a
 * supervisor on a student record who matches nobody in the directory.
 *
 * Names are matched case- and whitespace-insensitively but stored canonically,
 * so "aep patah" and "Aep Patah, Ph.D." cannot become two different people.
 */
async function resolveSupervisors(names: string[]): Promise<
  { ok: true; canonical: string[] } | { ok: false; unknown: string[] }
> {
  let directory: { name: string }[] = [];
  try {
    directory = await prisma.supervisor.findMany({
      where: { active: true },
      select: { name: true },
    });
  } catch {
    // fall through to the bundled copy
  }
  if (directory.length === 0) directory = SUPERVISORS.map((s) => ({ name: s.name }));

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const byNorm = new Map(directory.map((r) => [norm(r.name), r.name]));

  const canonical: string[] = [];
  const unknown: string[] = [];
  for (const n of names) {
    const hit = byNorm.get(norm(n));
    if (hit) {
      if (!canonical.includes(hit)) canonical.push(hit);
    } else {
      unknown.push(n);
    }
  }

  if (unknown.length > 0) return { ok: false, unknown };
  if (canonical.length === 0) return { ok: false, unknown: names };
  return { ok: true, canonical };
}

export type RegisterResult = {
  success: boolean;
  message: string;
  redirectUrl?: string;
};

export async function registerUser(data: Record<string, any>): Promise<RegisterResult> {
  try {
    const raw = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      nim: data.nim,
      supervisors: data.supervisors,
      password: data.password,
    };

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0].message,
      };
    }

    const { name, email, phone, nim, supervisors, password } = parsed.data;

    // Resolve supervisors against the directory before anything is written, so
    // a forged request cannot store a name that matches no real person.
    const resolved = await resolveSupervisors(supervisors);
    if (!resolved.ok) {
      return {
        success: false,
        message: `Not in the supervisor directory: ${resolved.unknown.join(", ")}. Pick from the list.`,
      };
    }
    const canonicalSupervisors = resolved.canonical;

    // Check uniqueness
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email && !existingUser.emailVerified) {
        // User exists but isn't verified. We will send a new OTP instead of blocking registration.
        await prisma.emailOtp.deleteMany({ where: { email } });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.emailOtp.create({
          data: { email, otp, expiresAt },
        });

        try {
          await sendVerificationOtpEmail(email, otp);
        } catch (e) {
          console.error("Failed to send OTP:", e);
        }

        return {
          success: true,
          message: "Account already exists but email is not verified. A new verification code has been sent.",
          redirectUrl: `/verify-email?email=${encodeURIComponent(email)}`
        };
      }
      return {
        success: false,
        message:
          existingUser.email === email
            ? "Email already registered and verified"
            : "Phone number already registered",
      };
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        nim,
        supervisors: canonicalSupervisors,
        passwordHash,
        roles: ["USER"],
        status: "PENDING",
      },
    });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.emailOtp.create({
      data: {
        email,
        otp,
        expiresAt,
      },
    });

    try {
      await sendVerificationOtpEmail(email, otp);
    } catch (e) {
      console.error("Failed to send OTP:", e);
      // Continue anyway, they can request a resend
    }

    return {
      success: true,
      message: "Registration successful. Please check your email for the verification code.",
      redirectUrl: `/verify-email?email=${encodeURIComponent(email)}`,
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

export async function verifyOtp(email: string, otp: string) {
  try {
    const otpRecord = await prisma.emailOtp.findFirst({
      where: { email, otp },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      return { success: false, message: "Invalid OTP code." };
    }

    if (new Date() > otpRecord.expiresAt) {
      return { success: false, message: "OTP code has expired. Please request a new one." };
    }

    // Mark user as verified
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() }
    });

    // Delete all OTPs for this email
    await prisma.emailOtp.deleteMany({ where: { email } });

    return { success: true, message: "Email verified successfully." };
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return { success: false, message: "Internal server error." };
  }
}

export async function resendOtp(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: false, message: "User not found." };
    }
    if (user.emailVerified) {
      return { success: false, message: "Email is already verified." };
    }

    // Delete old OTPs to prevent confusion
    await prisma.emailOtp.deleteMany({ where: { email } });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailOtp.create({
      data: { email, otp, expiresAt }
    });

    await sendVerificationOtpEmail(email, otp);

    return { success: true, message: "New OTP sent." };
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return { success: false, message: "Failed to resend OTP." };
  }
}
