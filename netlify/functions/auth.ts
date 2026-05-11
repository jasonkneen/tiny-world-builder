import { getUser } from '@netlify/identity';

export async function getAuthUserId(): Promise<string | null> {
  try {
    const user = await getUser();
    return user ? user.id : null;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function corsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

export function corsResponse(origin?: string | null) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
