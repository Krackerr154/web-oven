import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    status: string;
    image?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: string;
      status: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    status: string;
    userId: string;
    image?: string | null;
  }
}
