import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const username = typeof credentials?.username === "string" ? credentials.username : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          jobTitle: user.jobTitle,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.username = (user as { username: string }).username;
        token.role = (user as { role: string }).role;
        token.jobTitle = (user as { jobTitle: string }).jobTitle;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.jobTitle = token.jobTitle as string;
      }
      return session;
    },
  },
});
