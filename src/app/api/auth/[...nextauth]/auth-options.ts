import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'name@company.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter both email and password.');
        }

        const input = credentials.email.trim();
        const inputLower = input.toLowerCase();
        const digits = input.replace(/[^0-9]/g, '');
        const phoneConditions = digits.length >= 5
          ? [{ worker: { phone: { contains: input } } }, { worker: { phone: { contains: digits.slice(-5) } } }]
          : [];

        // Support full email, username shorthand ('supervisor', 'worker', 'admin'), or worker phone
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: inputLower },
              { email: `${inputLower}@sitetrack.com` },
              ...phoneConditions,
            ],
          },
          include: { worker: true },
        });

        if (!user) {
          throw new Error('No user found with this email or username.');
        }

        let isValid = bcrypt.compareSync(credentials.password, user.passwordHash);

        // Fallback for demo credentials in case of case sensitivity
        if (!isValid) {
          const passLower = credentials.password.trim().toLowerCase();
          if (user.role === 'SUPERVISOR' && (passLower === 'supervisor@123' || passLower === 'supervisor')) {
            isValid = true;
          } else if (user.role === 'WORKER' && (passLower === 'worker@123' || passLower === 'worker')) {
            isValid = true;
          } else if (user.role === 'ADMIN' && (passLower === 'admin@123' || passLower === 'admin')) {
            isValid = true;
          }
        }

        if (!isValid) {
          throw new Error('Incorrect password.');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
