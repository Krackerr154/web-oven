import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { token, newPassword } = await req.json();

        if (!token || !newPassword) {
            return NextResponse.json(
                { error: 'Token and new password are required' },
                { status: 400 }
            );
        }

        // Check if the token is valid and not expired
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
        }

        if (resetToken.expiresAt < new Date()) {
            // Token is expired, delete it and return an error
            await prisma.passwordResetToken.delete({
                where: { id: resetToken.id },
            });
            return NextResponse.json({ error: 'Token has expired' }, { status: 400 });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password
        await prisma.user.update({
            where: { email: resetToken.email },
            data: { passwordHash: hashedPassword },
        });

        // Delete the used token
        await prisma.passwordResetToken.deleteMany({
            where: { email: resetToken.email },
        });

        return NextResponse.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: 'An error occurred while resetting your password. Please try again later.' },
            { status: 500 }
        );
    }
}
