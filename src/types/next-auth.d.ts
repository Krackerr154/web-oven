import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    roles: string[];
    status: string;
    image?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      roles: string[];
      status: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles: string[];
    status: string;
    userId: string;
    image?: string | null;
  }
}
