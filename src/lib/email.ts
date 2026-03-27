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
      from: `AP-Lab <${fromEmail}>`,
      to: email,
      subject: 'Reset your password - AP-Lab',
      html: `
                <div style="font-family: Arial, sans-serif; p-4 max-w-md mx-auto">
                    <h2 style="color: #3b82f6; font-weight: bold;">Password Reset Request</h2>
                    <p>You recently requested to reset your password for your AP-Lab account.</p>
                    <p>Click the link below to reset it. This link is valid for 1 hour.</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
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
      from: `AP-Lab <${fromEmail}>`,
      to: email,
      subject: 'Verify your email - AP-Lab',
      html: `
                <div style="font-family: Arial, sans-serif; p-4 max-w-md mx-auto text-center">
                    <h2 style="color: #3b82f6; font-weight: bold;">Verify Your Email</h2>
                    <p>Thank you for registering at AP-Lab.</p>
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

export async function sendCPDBookingRequestEmail(
  adminEmails: string[],
  booking: {
    id: string;
    userName: string;
    userEmail: string;
    instrumentName: string;
    startDate: string;
    endDate: string;
    purpose: string;
    sample: string;
    cpdMode: string;
    cpdModeDetails?: string | null;
  }
) {
  const resend = getResendClient();
  if (!resend) return;

  const fromEmail = process.env.RESEND_EMAIL_FROM || 'noreply@g-labs.my.id';
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3005';

  await resend.emails.send({
    from: `AP-Lab <${fromEmail}>`,
    to: adminEmails,
    subject: `[CPD] New booking request from ${booking.userName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0f172a; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fb923c; margin: 0; font-size: 20px;">New CPD Booking Request</h2>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Requires your approval</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">User</td><td style="padding: 6px 0; font-weight: 600;">${booking.userName} &lt;${booking.userEmail}&gt;</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Instrument</td><td style="padding: 6px 0; font-weight: 600;">${booking.instrumentName}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Start</td><td style="padding: 6px 0;">${booking.startDate}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">End</td><td style="padding: 6px 0;">${booking.endDate}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Purpose</td><td style="padding: 6px 0;">${booking.purpose}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Sample</td><td style="padding: 6px 0;">${booking.sample}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">CPD Mode</td><td style="padding: 6px 0;">${booking.cpdMode}${booking.cpdModeDetails ? ` — ${booking.cpdModeDetails}` : ''}</td></tr>
          </table>
          <div style="margin-top: 24px;">
            <a href="${appUrl}/cpd-admin" style="display: inline-block; padding: 10px 20px; background-color: #fb923c; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
              Review &amp; Approve
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Booking ID: ${booking.id}</p>
        </div>
      </div>
    `,
  });
}

export async function sendCPDBookingDecisionEmail(
  userEmail: string,
  approved: boolean,
  booking: {
    instrumentName: string;
    startDate: string;
    endDate: string;
    purpose: string;
  },
  reason?: string
) {
  const resend = getResendClient();
  if (!resend) return;

  const fromEmail = process.env.RESEND_EMAIL_FROM || 'noreply@g-labs.my.id';
  const statusColor = approved ? '#22c55e' : '#ef4444';
  const statusText = approved ? 'Approved' : 'Rejected';
  const subject = approved
    ? '[CPD] Your booking has been approved'
    : '[CPD] Your booking request was not approved';

  await resend.emails.send({
    from: `AP-Lab <${fromEmail}>`,
    to: userEmail,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0f172a; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: ${statusColor}; margin: 0; font-size: 20px;">CPD Booking ${statusText}</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">Instrument</td><td style="padding: 6px 0; font-weight: 600;">${booking.instrumentName}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Start</td><td style="padding: 6px 0;">${booking.startDate}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">End</td><td style="padding: 6px 0;">${booking.endDate}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Purpose</td><td style="padding: 6px 0;">${booking.purpose}</td></tr>
            ${reason ? `<tr><td style="padding: 6px 0; color: #64748b;">Reason</td><td style="padding: 6px 0;">${reason}</td></tr>` : ''}
          </table>
          <p style="margin-top: 20px; font-size: 14px; color: #475569;">
            ${approved
              ? 'Your CPD booking has been approved. You may proceed with your scheduled session.'
              : 'Your CPD booking request was not approved. Please contact the CPD admin for more information.'}
          </p>
        </div>
      </div>
    `,
  });
}
