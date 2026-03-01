import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Return a success response even if the user is not found to prevent email enumeration
            return NextResponse.json({ message: 'If an account exists, a password reset link has been sent.' });
        }

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');

        // Token expires in 1 hour
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        // Save or update the password reset token in the DB
        // First, delete any existing token for this email to invalidate old ones
        await prisma.passwordResetToken.deleteMany({
            where: { email },
        });

        await prisma.passwordResetToken.create({
            data: {
                email,
                token,
                expiresAt,
            },
        });

        // Send the email
        await sendPasswordResetEmail(email, token);

        return NextResponse.json({ message: 'If an account exists, a password reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'An error occurred while processing your request. Please try again later.' },
            { status: 500 }
        );
    }
}
