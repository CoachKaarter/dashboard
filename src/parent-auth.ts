import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Fully separate Auth.js instance for the Espace Parents/Joueurs — a
// distinct session cookie name so a staff session (src/auth.ts) and a
// parent session can never be mixed up or read by the wrong code path.
// ParentAccount is intentionally not the User (staff) model: no team
// permissions, no Cockpit access, nothing in common beyond "has a login".
export const { handlers: parentHandlers, auth: parentAuth, signIn: parentSignIn, signOut: parentSignOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/parent/login" },
  trustHost: true,
  cookies: {
    sessionToken: {
      name: "parent-session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
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

        const account = await prisma.parentAccount.findUnique({ where: { username }, include: { player: true } });
        if (!account || !account.active) return null;

        const valid = await bcrypt.compare(password, account.passwordHash);
        if (!valid) return null;

        await prisma.parentAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });

        return {
          id: account.id,
          name: `${account.player.firstName} ${account.player.lastName}`,
          username: account.username,
          playerId: account.playerId,
        };
      },
    }),
  ],
  callbacks: {
    // Only stable identity lives in the JWT. Mutable state (active,
    // mustChangePassword) is always re-read from the database on every
    // request in requireParent() — never trusted from a token that could be
    // stale for as long as the session lives.
    jwt({ token, user }) {
      // Cast away the globally-merged staff JWT type (declared in
      // types/next-auth.d.ts) — TypeScript's module augmentation for
      // "next-auth/jwt" is program-wide, not per NextAuth() instance, so it
      // otherwise wrongly shapes this completely separate parent JWT too.
      const t = token as unknown as Record<string, unknown>;
      if (user) {
        t.parentAccountId = user.id;
        t.username = (user as { username: string }).username;
        t.playerId = (user as { playerId: string }).playerId;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as unknown as Record<string, unknown>;
      const u = session.user as unknown as Record<string, unknown> | undefined;
      if (u) {
        u.id = t.parentAccountId as string;
        u.username = t.username as string;
        u.playerId = t.playerId as string;
      }
      return session;
    },
  },
});
