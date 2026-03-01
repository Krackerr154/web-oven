import { Resend } from 'resend';

// Helper function to lazily initialize Resend only when actually needed
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set. Emails will not be sent.");
    return null;
  }
  return new Resend(apiKey);
};

export async function sendPasswordResetEmail(email: string, token: string) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Email service is not configured");
  }

  const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  const fromEmail = process.env.RESEND_EMAIL_FROM || 'noreply@g-labs.my.id';

  try {
    const data = await resend.emails.send({
      from: `Lab Oven <${fromEmail}>`,
      to: email,
      subject: 'Reset your password - Lab Oven Booking',
      html: `
                <div style="font-family: Arial, sans-serif; p-4 max-w-md mx-auto">
                    <h2 style="color: #ea580c; font-weight: bold;">Password Reset Request</h2>
                    <p>You recently requested to reset your password for your Lab Oven Booking account.</p>
                    <p>Click the link below to reset it. This link is valid for 1 hour.</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #ea580c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Reset Password
                    </a>
                    <p style="font-size: 12px; color: #666;">
                        If you did not request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                </div>
            `,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send reset email");
  }
}

export async function sendVerificationOtpEmail(email: string, otp: string) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Email service is not configured");
  }

  const fromEmail = process.env.RESEND_EMAIL_FROM || 'noreply@g-labs.my.id';

  try {
    const data = await resend.emails.send({
      from: `Lab Oven <${fromEmail}>`,
      to: email,
      subject: 'Verify your email - Lab Oven Booking',
      html: `
                <div style="font-family: Arial, sans-serif; p-4 max-w-md mx-auto text-center">
                    <h2 style="color: #ea580c; font-weight: bold;">Verify Your Email</h2>
                    <p>Thank you for registering at Lab Oven Booking.</p>
                    <p>Please use the following 6-digit code to verify your email address. This code is valid for 10 minutes.</p>
                    <div style="margin: 24px 0; padding: 16px; background-color: #f1f5f9; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">
                        ${otp}
                    </div>
                    <p style="font-size: 12px; color: #666;">
                        If you did not request this code, please ignore this email.
                    </p>
                </div>
            `,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    throw new Error("Failed to send verification email");
  }
}
