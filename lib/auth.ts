import { cookies } from 'next/headers';

const HOST_COOKIE = 'ss_host_session';

export function isHostAuthenticated(): boolean {
  const cookieStore = cookies();
  const session = cookieStore.get(HOST_COOKIE);
  return session?.value === 'authenticated';
}

export function getHostCookieName() {
  return HOST_COOKIE;
}
