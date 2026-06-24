/* achievements.js — TinyWorld Achievements catalog + helper
 *
 * Exposes window.TinyWorldAchievements:
 *   .catalog   — ordered array of badge definitions
 *   .earnedBadges(worldsPublished, rank) — returns array of earned badge ids
 *
 * Pure, zero-network-dependency module.
 * SVG strings are static developer markup (not user data).
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Pixel-art SVG badge icons (64x64 viewBox, rect-based pixel art)
   * ------------------------------------------------------------------ */

  var SVG_FIRST_LIGHT = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    /* background */ '<rect width="64" height="64" rx="10" fill="#1a2a1a"/>' +
    /* ground strip */ '<rect x="8" y="48" width="48" height="6" fill="#3a5c2a"/>' +
    /* stem */ '<rect x="30" y="32" width="4" height="18" fill="#4a8c3a"/>' +
    /* left leaf */ '<rect x="18" y="36" width="12" height="4" fill="#5ab04a"/>' +
    '<rect x="14" y="32" width="8" height="4" fill="#5ab04a"/>' +
    /* right leaf */ '<rect x="34" y="30" width="12" height="4" fill="#5ab04a"/>' +
    '<rect x="42" y="26" width="8" height="4" fill="#5ab04a"/>' +
    /* sprout top */ '<rect x="28" y="24" width="8" height="8" fill="#78d058"/>' +
    '<rect x="26" y="20" width="12" height="6" fill="#78d058"/>' +
    '<rect x="28" y="16" width="8" height="6" fill="#9ae870"/>' +
    /* sun rays */ '<rect x="8" y="8" width="6" height="6" fill="#f5d060"/>' +
    '<rect x="16" y="6" width="4" height="4" fill="#f5d060"/>' +
    '<rect x="6" y="16" width="4" height="4" fill="#f5d060"/>' +
    /* glow dot */ '<rect x="10" y="10" width="4" height="4" fill="#fff8a0"/>' +
  '</svg>';

  var SVG_SETTLER = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    /* background */ '<rect width="64" height="64" rx="10" fill="#0d2020"/>' +
    /* ground */ '<rect x="4" y="50" width="56" height="6" fill="#2a5050"/>' +
    /* house walls */ '<rect x="14" y="34" width="36" height="18" fill="#3a8080"/>' +
    /* door */ '<rect x="26" y="42" width="12" height="10" fill="#1a4040"/>' +
    /* window left */ '<rect x="16" y="38" width="8" height="6" fill="#7fd0d0"/>' +
    /* window right */ '<rect x="40" y="38" width="8" height="6" fill="#7fd0d0"/>' +
    /* roof */ '<rect x="10" y="28" width="44" height="6" fill="#2db8b8"/>' +
    '<rect x="16" y="22" width="32" height="6" fill="#2db8b8"/>' +
    '<rect x="22" y="16" width="20" height="6" fill="#48d8d8"/>' +
    '<rect x="28" y="10" width="8" height="6" fill="#48d8d8"/>' +
    /* chimney */ '<rect x="44" y="12" width="6" height="16" fill="#2db8b8"/>' +
    /* smoke */ '<rect x="44" y="8" width="4" height="4" fill="#7fd0d0" opacity="0.7"/>' +
    '<rect x="46" y="4" width="4" height="4" fill="#7fd0d0" opacity="0.4"/>' +
  '</svg>';

  var SVG_ARCHITECT = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    /* background */ '<rect width="64" height="64" rx="10" fill="#0d1a30"/>' +
    /* blueprint paper */ '<rect x="8" y="10" width="48" height="44" rx="2" fill="#1a3a6a"/>' +
    /* grid lines h */ '<rect x="8" y="20" width="48" height="2" fill="#2a5a9a" opacity="0.7"/>' +
    '<rect x="8" y="32" width="48" height="2" fill="#2a5a9a" opacity="0.7"/>' +
    '<rect x="8" y="44" width="48" height="2" fill="#2a5a9a" opacity="0.7"/>' +
    /* grid lines v */ '<rect x="20" y="10" width="2" height="44" fill="#2a5a9a" opacity="0.7"/>' +
    '<rect x="32" y="10" width="2" height="44" fill="#2a5a9a" opacity="0.7"/>' +
    '<rect x="44" y="10" width="2" height="44" fill="#2a5a9a" opacity="0.7"/>' +
    /* building outline */ '<rect x="22" y="26" width="20" height="22" fill="none"/>' +
    '<rect x="22" y="26" width="20" height="2" fill="#3a72c8"/>' +
    '<rect x="22" y="46" width="20" height="2" fill="#3a72c8"/>' +
    '<rect x="22" y="26" width="2" height="22" fill="#3a72c8"/>' +
    '<rect x="40" y="26" width="2" height="22" fill="#3a72c8"/>' +
    /* roof triangle */ '<rect x="26" y="22" width="12" height="4" fill="#3a72c8"/>' +
    '<rect x="28" y="18" width="8" height="4" fill="#3a72c8"/>' +
    '<rect x="30" y="14" width="4" height="4" fill="#5a92e8"/>' +
    /* compass needle */ '<rect x="50" y="14" width="4" height="16" fill="#f5d060"/>' +
    '<rect x="50" y="14" width="4" height="6" fill="#f09030"/>' +
  '</svg>';

  var SVG_WORLDSMITH = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    /* background */ '<rect width="64" height="64" rx="10" fill="#1a0d2e"/>' +
    /* anvil base */ '<rect x="10" y="46" width="44" height="6" fill="#5a3a8a"/>' +
    '<rect x="6" y="50" width="52" height="6" fill="#6a4a9a"/>' +
    /* anvil body */ '<rect x="14" y="36" width="36" height="12" fill="#7a5aaa"/>' +
    '<rect x="10" y="40" width="44" height="8" fill="#8a6aba"/>' +
    /* anvil horn */ '<rect x="44" y="38" width="12" height="6" fill="#7a5aaa"/>' +
    '<rect x="52" y="40" width="6" height="4" fill="#6a4a9a"/>' +
    /* hammer handle */ '<rect x="36" y="10" width="6" height="28" fill="#8b5e3c"/>' +
    /* hammer head */ '<rect x="26" y="8" width="26" height="14" fill="#9a6aba"/>' +
    '<rect x="26" y="8" width="26" height="6" fill="#ba8ada"/>' +
    /* sparks */ '<rect x="20" y="30" width="4" height="4" fill="#f5d060"/>' +
    '<rect x="14" y="24" width="4" height="4" fill="#f5a020"/>' +
    '<rect x="24" y="22" width="4" height="4" fill="#f5d060"/>' +
    '<rect x="8" y="30" width="4" height="4" fill="#f5a020" opacity="0.7"/>' +
  '</svg>';

  var SVG_PIONEER = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    /* background */ '<rect width="64" height="64" rx="10" fill="#2a1a08"/>' +
    /* pole */ '<rect x="18" y="10" width="4" height="46" fill="#8b6030"/>' +
    /* flag body */ '<rect x="22" y="10" width="30" height="22" fill="#c87828"/>' +
    /* flag highlight stripe */ '<rect x="22" y="10" width="30" height="6" fill="#d89040"/>' +
    '<rect x="22" y="16" width="30" height="4" fill="#c87828"/>' +
    /* flag detail - star */ '<rect x="32" y="16" width="10" height="10" fill="#f5d060"/>' +
    '<rect x="30" y="18" width="14" height="6" fill="#f5d060"/>' +
    '<rect x="34" y="14" width="6" height="14" fill="#f5d060"/>' +
    /* ground */ '<rect x="4" y="52" width="56" height="6" fill="#3a2a10"/>' +
    /* ground rocks */ '<rect x="10" y="50" width="8" height="4" fill="#4a3818"/>' +
    '<rect x="24" y="50" width="6" height="4" fill="#4a3818"/>' +
    /* sky stars */ '<rect x="48" y="10" width="4" height="4" fill="#f5d060"/>' +
    '<rect x="54" y="16" width="4" height="4" fill="#f5d060" opacity="0.6"/>' +
    '<rect x="44" y="20" width="4" height="4" fill="#f5d060" opacity="0.4"/>' +
  '</svg>';

  var SVG_TRAILBLAZER = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    /* background */ '<rect width="64" height="64" rx="10" fill="#1e1a08"/>' +
    /* trophy base */ '<rect x="14" y="52" width="36" height="6" fill="#c9a227"/>' +
    '<rect x="10" y="48" width="44" height="6" fill="#b8860b"/>' +
    /* trophy stem */ '<rect x="26" y="40" width="12" height="10" fill="#c9a227"/>' +
    /* trophy cup */ '<rect x="14" y="20" width="36" height="22" fill="#d4aa22"/>' +
    '<rect x="10" y="20" width="44" height="8" fill="#c9a227"/>' +
    '<rect x="14" y="18" width="36" height="4" fill="#d4aa22"/>' +
    /* handles */ '<rect x="6" y="24" width="8" height="12" fill="#c9a227"/>' +
    '<rect x="50" y="24" width="8" height="12" fill="#c9a227"/>' +
    /* shine */ '<rect x="20" y="22" width="8" height="12" fill="#f0c840" opacity="0.6"/>' +
    '<rect x="20" y="22" width="4" height="6" fill="#fff8a0" opacity="0.5"/>' +
    /* star above */ '<rect x="28" y="6" width="8" height="8" fill="#f5d060"/>' +
    '<rect x="24" y="8" width="16" height="4" fill="#f5d060"/>' +
    '<rect x="26" y="4" width="12" height="4" fill="#fff8a0"/>' +
  '</svg>';

  var SVG_FIRST_SALE = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect width="64" height="64" rx="10" fill="#2b2410"/>' +
    '<rect x="20" y="16" width="24" height="4" fill="#e8c84a"/>' +
    '<rect x="16" y="20" width="32" height="8" fill="#e8c84a"/>' +
    '<rect x="12" y="28" width="40" height="12" fill="#c9a227"/>' +
    '<rect x="16" y="40" width="32" height="8" fill="#9f7d1e"/>' +
    '<rect x="20" y="48" width="24" height="4" fill="#6f5618"/>' +
    '<rect x="24" y="24" width="8" height="8" fill="#fff0a0"/>' +
    '<rect x="32" y="20" width="8" height="4" fill="#fff0a0"/>' +
    '<rect x="36" y="32" width="8" height="8" fill="#a57b16"/>' +
    '<rect x="28" y="36" width="8" height="4" fill="#e8c84a"/>' +
    '</svg>';

  var SVG_TASTEMAKER = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect width="64" height="64" rx="10" fill="#14243f"/>' +
    '<rect x="16" y="12" width="28" height="36" fill="#3a72c8"/>' +
    '<rect x="20" y="16" width="20" height="28" fill="#5f98e8"/>' +
    '<rect x="24" y="20" width="12" height="4" fill="#d7f0ff"/>' +
    '<rect x="24" y="28" width="16" height="4" fill="#d7f0ff"/>' +
    '<rect x="24" y="36" width="8" height="4" fill="#d7f0ff"/>' +
    '<rect x="36" y="28" width="16" height="16" fill="#c9a227"/>' +
    '<rect x="44" y="24" width="8" height="4" fill="#c9a227"/>' +
    '<rect x="40" y="32" width="8" height="4" fill="#fff0a0"/>' +
    '<rect x="44" y="40" width="8" height="4" fill="#8d6a18"/>' +
    '</svg>';

  var SVG_CONNECTOR = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect width="64" height="64" rx="10" fill="#102c30"/>' +
    '<rect x="16" y="20" width="16" height="8" fill="#2db8b8"/>' +
    '<rect x="12" y="28" width="8" height="16" fill="#2db8b8"/>' +
    '<rect x="20" y="44" width="16" height="8" fill="#2db8b8"/>' +
    '<rect x="20" y="28" width="12" height="8" fill="#84eeee"/>' +
    '<rect x="32" y="28" width="8" height="8" fill="#e8c84a"/>' +
    '<rect x="36" y="12" width="16" height="8" fill="#3a72c8"/>' +
    '<rect x="44" y="20" width="8" height="16" fill="#3a72c8"/>' +
    '<rect x="28" y="12" width="16" height="8" fill="#84eeee"/>' +
    '<rect x="32" y="36" width="16" height="8" fill="#84eeee"/>' +
    '</svg>';

  var SVG_PROSPECTOR = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect width="64" height="64" rx="10" fill="#2a1d15"/>' +
    '<rect x="36" y="36" width="16" height="16" fill="#6d5a48"/>' +
    '<rect x="40" y="32" width="12" height="4" fill="#9a8370"/>' +
    '<rect x="44" y="40" width="8" height="8" fill="#c9a227"/>' +
    '<rect x="48" y="36" width="4" height="4" fill="#e8c84a"/>' +
    '<rect x="16" y="16" width="24" height="8" fill="#8f6b45"/>' +
    '<rect x="24" y="24" width="8" height="8" fill="#8f6b45"/>' +
    '<rect x="28" y="32" width="8" height="8" fill="#8f6b45"/>' +
    '<rect x="32" y="40" width="8" height="8" fill="#8f6b45"/>' +
    '<rect x="12" y="20" width="8" height="8" fill="#d0d7dc"/>' +
    '<rect x="20" y="12" width="24" height="8" fill="#d0d7dc"/>' +
    '<rect x="36" y="20" width="8" height="8" fill="#8f969b"/>' +
    '<rect x="20" y="16" width="8" height="4" fill="#ffffff"/>' +
    '</svg>';

  /* ------------------------------------------------------------------
   * Badge catalog — ordered by tier (ascending)
   * ------------------------------------------------------------------ */
  var CATALOG = [
    {
      id: 'first-light',
      name: 'First Light',
      criteria: 'Publish your first world',
      tierColor: '#3a8c3a',
      tierLabel: 'green',
      svg: SVG_FIRST_LIGHT,
      worldsRequired: 1,
      rankRequired: null
    },
    {
      id: 'settler',
      name: 'Settler',
      criteria: 'Publish 5 worlds',
      tierColor: '#2db8b8',
      tierLabel: 'teal',
      svg: SVG_SETTLER,
      worldsRequired: 5,
      rankRequired: null
    },
    {
      id: 'architect',
      name: 'Architect',
      criteria: 'Publish 10 worlds',
      tierColor: '#3a72c8',
      tierLabel: 'blue',
      svg: SVG_ARCHITECT,
      worldsRequired: 10,
      rankRequired: null
    },
    {
      id: 'worldsmith',
      name: 'Worldsmith',
      criteria: 'Publish 25 worlds',
      tierColor: '#8a6aba',
      tierLabel: 'purple',
      svg: SVG_WORLDSMITH,
      worldsRequired: 25,
      rankRequired: null
    },
    {
      id: 'pioneer',
      name: 'Pioneer',
      criteria: 'Reach the Top 10 builders',
      tierColor: '#c87828',
      tierLabel: 'amber',
      svg: SVG_PIONEER,
      worldsRequired: null,
      rankRequired: 10
    },
    {
      id: 'trailblazer',
      name: 'Trailblazer',
      criteria: 'Reach the Top 3 builders',
      tierColor: '#c9a227',
      tierLabel: 'gold',
      svg: SVG_TRAILBLAZER,
      worldsRequired: null,
      rankRequired: 3
    },
    {
      id: 'first-sale',
      name: 'First Sale',
      criteria: 'Earn your first GOLD from a template sale',
      tierColor: '#c9a227',
      tierLabel: 'gold',
      svg: SVG_FIRST_SALE,
      worldsRequired: null,
      rankRequired: null
    },
    {
      id: 'tastemaker',
      name: 'Tastemaker',
      criteria: 'List a world as a paid template',
      tierColor: '#3a72c8',
      tierLabel: 'blue',
      svg: SVG_TASTEMAKER,
      worldsRequired: null,
      rankRequired: null
    },
    {
      id: 'connector',
      name: 'Connector',
      criteria: 'Refer a friend who joins',
      tierColor: '#2db8b8',
      tierLabel: 'teal',
      svg: SVG_CONNECTOR,
      worldsRequired: null,
      rankRequired: null
    },
    {
      id: 'prospector',
      name: 'Prospector',
      criteria: 'Sell harvested resources for GOLD',
      tierColor: '#c87828',
      tierLabel: 'amber',
      svg: SVG_PROSPECTOR,
      worldsRequired: null,
      rankRequired: null
    }
  ];

  /* ------------------------------------------------------------------
   * earnedBadges(worldsPublished, rank) -> string[]
   *
   * Pure function. Returns array of earned badge ids.
   * worldsPublished: number of published worlds (or null/undefined)
   * rank: leaderboard rank position (1 = top; null/undefined = unranked)
   * ------------------------------------------------------------------ */
  function earnedBadges(worldsPublished, rank) {
    var w = Number(worldsPublished) || 0;
    var r = (rank != null && rank !== '') ? Number(rank) : null;
    var earned = [];

    for (var i = 0; i < CATALOG.length; i++) {
      var badge = CATALOG[i];
      if (badge.worldsRequired !== null && w >= badge.worldsRequired) {
        earned.push(badge.id);
      } else if (badge.rankRequired !== null && r !== null && r >= 1 && r <= badge.rankRequired) {
        earned.push(badge.id);
      }
    }

    return earned;
  }

  /* ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------ */
  window.TinyWorldAchievements = {
    catalog: CATALOG,
    earnedBadges: earnedBadges
  };

}());
