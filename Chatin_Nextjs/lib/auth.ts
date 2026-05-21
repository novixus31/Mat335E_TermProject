import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const backendUrl =
            process.env.BACKEND_URL ||
            process.env.NEXT_PUBLIC_BACKEND_URL ||
            "http://localhost:3001";

          const loginUrl = `${backendUrl}/api/auth/login`;
          console.log("🔍 Login URL:", loginUrl);
          console.log("📧 Email:", credentials?.email);

          const res = await fetch(
            loginUrl,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userEmail: credentials?.email,
                password: credentials?.password,
              }),
            }
          );

          console.log("📡 Response status:", res.status);

          if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ Backend error response:", errorText);
            throw new Error(`Login request failed with ${res.status}`);
          }

          const data = await res.json();
          console.log("✅ Backend response:", JSON.stringify(data, null, 2));

          if (data.success && data.user) {
            return {
              id: data.user.id,
              email: data.user.userEmail,
              role: data.user.role,
              companyId: data.user.companyId,
              accessToken: data.token,
            };
          }
          console.log("⚠️ Success false or user not found in response");
          return null;
        } catch (error) {
          console.error("💥 Login error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.companyId = user.companyId;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.companyId = token.companyId as string;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
