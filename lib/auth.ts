import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { getSupabaseAdmin } from "./supabase-admin";

type VerifiedUserRow = {
  user_id: string | number;
  username: string;
  salesperson_name: string | null;
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;

        if (!username || !password) {
          return null;
        }

        const supabaseAdmin = getSupabaseAdmin();

        const { data, error } = await supabaseAdmin.rpc(
          "verify_app_user_password",
          {
            p_username: username,
            p_password: password,
          },
        );

        if (error) {
          console.error("verify_app_user_password RPC failed", error);
          return null;
        }

        const user = Array.isArray(data)
          ? (data[0] as VerifiedUserRow | undefined)
          : (data as VerifiedUserRow | null);

        if (!user?.user_id || !user.username) {
          return null;
        }

        return {
          id: String(user.user_id),
          name: user.username,
          salespersonName: user.salesperson_name?.trim() || user.username,
        };
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }

      if (user?.salespersonName) {
        token.salespersonName = user.salespersonName;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.userId || token.sub) {
          session.user.id = (token.userId ?? token.sub) as string;
        }

        if (token.salespersonName) {
          session.user.salespersonName = token.salespersonName as string;
        }
      }

      return session;
    },
  },
};
