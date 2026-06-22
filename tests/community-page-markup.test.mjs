import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const communityHtml = readFileSync(new URL('../community.html', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const collabsHtml = readFileSync(new URL('../collabs.html', import.meta.url), 'utf8');
const landingFeedJs = readFileSync(new URL('../scripts/landing-feed.js', import.meta.url), 'utf8');
const collabsPageJs = readFileSync(new URL('../scripts/collabs-page.js', import.meta.url), 'utf8');
const collabsFunctionJs = readFileSync(new URL('../netlify/functions/collabs.mjs', import.meta.url), 'utf8');
const worldsFunctionJs = readFileSync(new URL('../netlify/functions/worlds.mjs', import.meta.url), 'utf8');

// -------- community page markup/style guards --------
test('sign-in password field uses the same modal input styling as text fields', () => {
  assert.match(communityHtml, /<input type="password" id="login-password"/);
  assert.match(
    communityHtml,
    /\.c-modal input\[type=text\], \.c-modal input\[type=password\], \.c-modal textarea, \.c-modal select \{/,
  );
});

test('message moderation controls are wired for hide, restore, and delete', () => {
  assert.match(communityHtml, /function canModerateCurrentConversation\(\)/);
  assert.match(communityHtml, /data-msg-hide/);
  assert.match(communityHtml, /data-msg-unhide/);
  assert.match(communityHtml, /data-msg-delete/);
  assert.match(communityHtml, /action, messageId/);
  assert.match(communityHtml, /hidden-message/);
  assert.match(communityHtml, /msg-hidden-badge/);
});

test('community page consumes backend capability flags for moderator UI', () => {
  assert.match(communityHtml, /state\.caps = d\.caps \|\| \{\}/);
  assert.match(communityHtml, /hasCap\('canModerate'\)/);
  assert.match(communityHtml, /hasCap\('canCreateChannels'\)/);
  assert.match(communityHtml, /hasCap\('canManageRoles'\)/);
  assert.match(communityHtml, /grantRole/);
  assert.match(communityHtml, /revokeRole/);
});

test('community member directory only renders online members', () => {
  assert.match(communityHtml, /const onlineMembers = state\.members\.filter\(m => m && m\.online\)/);
  assert.match(communityHtml, /onlineMembers\.map\(m =>/);
  assert.match(communityHtml, /No members online\./);
});

test('landing feed shows public collab observer rooms without auth gating', () => {
  assert.match(indexHtml, /id="tinyworld-auth-importmap"/);
  assert.match(indexHtml, /vendor\/tinyworld-auth\.js/);
  assert.match(indexHtml, /Public collab builds/);
  assert.match(indexHtml, /href="\/collabs"/);
  assert.match(indexHtml, />More worlds</);
  assert.match(landingFeedJs, /fetch\('\/api\/collabs\?limit=5'/);
  assert.match(landingFeedJs, /params\.set\('observe', '1'\)/);
  assert.doesNotMatch(landingFeedJs, /Authorization: 'Bearer '/);
  assert.match(worldsFunctionJs, /if \(!profile\) \{\s*return jsonResponse\(\{ worlds: \[\]/);
});

test('collabs page lists room location, host, and network quality', () => {
  assert.match(collabsHtml, /id="collab-worlds-list"/);
  assert.match(collabsHtml, /scripts\/collabs-page\.js/);
  assert.match(collabsPageJs, /fetch\('\/api\/collabs\?limit=100'/);
  assert.match(collabsPageJs, /\['Location', location\]/);
  assert.match(collabsPageJs, /\['Host', host\]/);
  assert.match(collabsPageJs, /networkQuality/);
  assert.match(collabsPageJs, /params\.set\('observe', '1'\)/);
});

test('public collab registry endpoint stores host heartbeats and returns active rooms', () => {
  assert.match(collabsFunctionJs, /export const config = \{ path: '\/api\/collabs' \}/);
  assert.match(collabsFunctionJs, /CREATE TABLE IF NOT EXISTS collab_rooms/);
  assert.match(collabsFunctionJs, /sameOriginWriteGuard\(request\)/);
  assert.match(collabsFunctionJs, /observerHref\(roomId, shareId, partyHost, request\)/);
  assert.match(collabsFunctionJs, /last_seen > NOW\(\) - \(\$\{ACTIVE_WINDOW_SECONDS\} \* INTERVAL '1 second'\)/);
});
