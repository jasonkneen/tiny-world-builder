import type { Config } from '@netlify/functions';
import { db } from '../../db/index.js';
import { profiles } from '../../db/schema.js';
import { and, eq, ne, sql } from 'drizzle-orm';
import { getAuthUserId, unauthorized, corsHeaders, corsResponse } from './auth.js';

async function ensureProfileSchema() {
  // Netlify can deploy function code before database migrations have applied.
  // Make the new profile fields safe to use and avoid opaque 502s.
  await db.execute(sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "display_name" text DEFAULT ''`);
  try {
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "profiles_username_unique" ON "profiles" ("username")`);
  } catch (err) {
    console.warn('Could not create username unique index yet:', err);
  }
}

export default async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    if (req.method === 'OPTIONS') return corsResponse(origin);

    const auth0Id = await getAuthUserId();
    if (!auth0Id) return unauthorized();

    await ensureProfileSchema();

    if (req.method === 'GET') {
    const [profile] = await db.select().from(profiles).where(eq(profiles.auth0Id, auth0Id));
    if (!profile) return Response.json(null, { headers });
    return Response.json(profile, { headers });
  }

    if (req.method === 'PUT') {
    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const about = String(body.about || '').trim();
    const image = String(body.image || '').trim();

    if (!username) {
      return Response.json({ error: 'username is required' }, { status: 400, headers });
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return Response.json({ error: 'username must be 3-24 chars: lowercase letters, numbers, underscores' }, { status: 400, headers });
    }
    if (!displayName) {
      return Response.json({ error: 'display name is required' }, { status: 400, headers });
    }
    if (image && image.length > 750_000) {
      return Response.json({ error: 'photo is too large; choose a smaller image' }, { status: 400, headers });
    }

    const [existing] = await db.select().from(profiles).where(eq(profiles.auth0Id, auth0Id));
    const duplicateWhere = existing
      ? and(eq(profiles.username, username), ne(profiles.auth0Id, auth0Id))
      : eq(profiles.username, username);
    const [duplicate] = await db.select().from(profiles).where(duplicateWhere).limit(1);
    if (duplicate) {
      return Response.json({ error: 'username is already taken' }, { status: 409, headers });
    }

    if (existing) {
      const [updated] = await db
        .update(profiles)
        .set({
          username,
          displayName,
          about,
          image,
          updatedAt: new Date(),
        })
        .where(eq(profiles.auth0Id, auth0Id))
        .returning();
      return Response.json(updated, { headers });
    }

    const [created] = await db
      .insert(profiles)
      .values({ auth0Id, username, displayName, about, image })
      .returning();
    return Response.json(created, { status: 201, headers });
  }

    return new Response('Method not allowed', { status: 405, headers });
  } catch (err) {
    console.error('profile function failed:', err);
    const message = err instanceof Error ? err.message : 'Profile save failed';
    return Response.json({ error: message }, { status: 500, headers });
  }
};

export const config: Config = {
  path: '/api/profile',
};
