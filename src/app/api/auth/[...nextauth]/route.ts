import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getUserById, createUser } from "../../../../services/userService";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      
      const existingUser = await getUserById(user.email);
      if (!existingUser) {
        // Create a basic user node. Onboarding details will be filled later.
        await createUser({
          id: user.email, // using email as unique ID
          name: user.name || "Unknown",
          email: user.email,
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user && user.email) {
        token.id = user.email;
        // Optionally fetch user from DB to check if onboarding is complete
        const dbUser = await getUserById(user.email);
        token.onboardingComplete = !!(dbUser?.gradeOrAge && dbUser?.purpose);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.onboardingComplete = token.onboardingComplete as boolean;
      }
      return session;
    }
  },
  pages: {
    signIn: '/', // Using standard NextAuth pages or custom ones
    newUser: '/onboarding', // Redirect new users to onboarding
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
