  // -------- chat emotes (extracted from 47-worlds-room.js) --------
  // Single source of truth: command token -> rig state + duration + hold flag.
  // `ms` for jump/attack matches the rig's own clock (JUMP_DUR 0.46s, attack
  // DUR 0.45s) so the emote field clears about when the one-shot rig pose ends.
  // `hold:true` poses (sit/crouch/dance) are re-asserted each frame by the
  // emote layer until the timer expires; `hold:false` one-shots are set once
  // and left to the rig's own clock. Server allowlist (EMOTE_CMDS in
  // party/index.js) must list the same six tokens.
  const EMOTES = {
    wave:   { state: 'wave',   ms: 1600, hold: false },
    dance:  { state: 'dance',  ms: 3000, hold: true  },
    jump:   { state: 'jump',   ms: 460,  hold: false },
    sit:    { state: 'sit',    ms: 4000, hold: true  },
    crouch: { state: 'crouch', ms: 2500, hold: true  },
    attack: { state: 'attack', ms: 460,  hold: false },
  };
  // Classify a chat input: an emote command, an unknown slash command, or a
  // plain chat line. Pure (no side effects) so it is unit-testable.
  function resolveChatInput(text) {
    const t = String(text == null ? '' : text).trim();
    if (t[0] === '/') {
      const cmd = t.slice(1).split(/\s+/)[0].toLowerCase();
      return EMOTES[cmd] ? { kind: 'emote', cmd } : { kind: 'unknown', cmd };
    }
    return { kind: 'chat', text: t };
  }
  // Set the per-entity emote field that animVoxel consumes (self or peer).
  // _emoteFresh marks the rising edge so one-shot poses are set exactly once.
  function applyEmote(ent, cmd) {
    if (!ent) return;
    const def = EMOTES[cmd];
    if (!def) return;
    ent.emote = { state: def.state, until: Date.now() + def.ms, hold: def.hold };
    ent._emoteFresh = true;
  }
  // The emote layer clears the field when the timer expires, OR when the
  // entity moves AND the emote is a HOLD pose (sit/crouch/dance). One-shot
  // emotes (wave/jump/attack) are NOT cancelled by movement — they finish on
  // the rig's own clock, matching how the jump/attack poses run today.
  function emoteShouldClear(emote, now, moving) {
    return now >= emote.until || (moving && emote.hold);
  }
