import { Resend } from 'resend';

export async function sendPasswordResetEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    throw new Error('Email service is not configured');
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_EMAIL_FROM || 'noreply@g-labs.my.id';
  const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `Web Oven <${fromEmail}>`,
      to: [email],
      subject: 'Reset your password - Web Oven',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>We received a request to reset your password for your Web Oven account.</p>
          <p>Click the button below to reset it. This link is valid for 1 hour.</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
          <p style="color: #888; font-size: 12px; text-align: center;">Web Oven App</p>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending reset email:', error);
      throw new Error('Failed to send reset email');
    }

    return data;
  } catch (error) {
    console.error('Error sending reset email:', error);
    throw new Error('Failed to send reset email');
  }
}
