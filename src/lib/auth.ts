import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, AdminLocale } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    adminLocale: AdminLocale;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      adminLocale: AdminLocale;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          adminLocale: user.adminLocale,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.adminLocale = user.adminLocale;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.adminLocale = token.adminLocale as AdminLocale;
      return session;
    },
  },
});

/** 記事の編集権限: admin/editor は全記事、author/contributor は自分の記事のみ */
export function canEditArticle(
  user: { id: string; role: Role },
  article: { authorId: string }
): boolean {
  if (user.role === "admin" || user.role === "editor") return true;
  return article.authorId === user.id;
}

/** 公開権限: contributor 以外 */
export function canPublish(user: { role: Role }): boolean {
  return user.role !== "contributor";
}
