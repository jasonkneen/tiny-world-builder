import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const communityHtml = readFileSync(new URL('../community.html', import.meta.url), 'utf8');

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
