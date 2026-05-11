import type { Config } from '@netlify/functions';
import { db } from '../../db/index.js';
import { builds, profiles } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthUserId, unauthorized, corsHeaders, corsResponse } from './auth.js';

async function getProfileId(auth0Id: string): Promise<number | null> {
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.auth0Id, auth0Id));
  return profile?.id ?? null;
}

export default async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return corsResponse(origin);

  const auth0Id = await getAuthUserId();
  if (!auth0Id) return unauthorized(origin);

  const headers = corsHeaders(origin);
  const url = new URL(req.url);
  const buildId = url.searchParams.get('id');

  try {
    const profileId = await getProfileId(auth0Id);

    if (req.method === 'GET') {
      if (!profileId) return Response.json([], { headers });

      if (buildId) {
        const [build] = await db
          .select()
          .from(builds)
          .where(and(eq(builds.id, parseInt(buildId)), eq(builds.profileId, profileId)));
        if (!build) return Response.json({ error: 'Not found' }, { status: 404, headers });
        return Response.json(build, { headers });
      }

      const userBuilds = await db
        .select()
        .from(builds)
        .where(eq(builds.profileId, profileId))
        .orderBy(desc(builds.updatedAt));
      return Response.json(userBuilds, { headers });
    }

    if (req.method === 'POST') {
      if (!profileId) {
        return Response.json({ error: 'Profile required before saving builds' }, { status: 400, headers });
      }
      const body = await req.json();
      const { name, data } = body;
      if (!name || !data) {
        return Response.json({ error: 'name and data are required' }, { status: 400, headers });
      }
      const [created] = await db
        .insert(builds)
        .values({ profileId, name, data })
        .returning();
      return Response.json(created, { status: 201, headers });
    }

    if (req.method === 'PUT') {
      if (!profileId || !buildId) {
        return Response.json({ error: 'Profile and build id required' }, { status: 400, headers });
      }
      const body = await req.json();
      const { name, data } = body;
      const [updated] = await db
        .update(builds)
        .set({
          ...(name !== undefined && { name }),
          ...(data !== undefined && { data }),
          updatedAt: new Date(),
        })
        .where(and(eq(builds.id, parseInt(buildId)), eq(builds.profileId, profileId)))
        .returning();
      if (!updated) return Response.json({ error: 'Not found' }, { status: 404, headers });
      return Response.json(updated, { headers });
    }

    if (req.method === 'DELETE') {
      if (!profileId || !buildId) {
        return Response.json({ error: 'Profile and build id required' }, { status: 400, headers });
      }
      const [deleted] = await db
        .delete(builds)
        .where(and(eq(builds.id, parseInt(buildId)), eq(builds.profileId, profileId)))
        .returning();
      if (!deleted) return Response.json({ error: 'Not found' }, { status: 404, headers });
      return Response.json({ ok: true }, { headers });
    }

    return new Response('Method not allowed', { status: 405, headers });
  } catch (err) {
    console.error('builds function error:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500, headers },
    );
  }
};

export const config: Config = {
  path: '/api/builds',
};
