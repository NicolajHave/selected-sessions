import { NextRequest, NextResponse } from 'next/server';
import { getHostCookieName } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const passcode = formData.get('passcode')?.toString() || '';
  const expected = process.env.HOST_PASSCODE || '';

  if (!expected || passcode !== expected) {
    return NextResponse.redirect(new URL('/host?error=1', req.url));
  }

  const response = NextResponse.redirect(new URL('/host/dashboard', req.url));
  response.cookies.set(getHostCookieName(), 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return response;
}
