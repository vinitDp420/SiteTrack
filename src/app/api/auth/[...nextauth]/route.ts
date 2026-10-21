import NextAuth from 'next-auth';
import { authOptions } from './auth-options';

const handler = NextAuth(authOptions);

async function auth(req: any, ctx: any) {
  const params = await ctx?.params;
  return handler(req, { ...ctx, params });
}

export { auth as GET, auth as POST };
