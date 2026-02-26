import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or NIM", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Email/NIM and password are required");
        }

        const isEmail = credentials.identifier.includes("@");
        const user = isEmail
          ? await prisma.user.findUnique({ where: { email: credentials.identifier } })
          : await prisma.user.findUnique({ where: { nim: credentials.identifier } });

        if (!user) {
          throw new Error("Invalid credentials");
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        if (user.status === "PENDING") {
          throw new Error("Your account is pending admin approval");
        }

        if (user.status === "REJECTED") {
          throw new Error("Your account has been rejected");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Intentionally omitting 'image' to prevent massive Base64 strings from entering the JWT cookie payload!
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.status = user.status;
        token.userId = user.id;
        // Intentionally do NOT store user.image in JWT due to Base64 size limits!
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;

        if (token.userId) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { image: true },
          });
          session.user.image = dbUser?.image as string | null | undefined;
        }
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
