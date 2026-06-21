const TINYVERSE_ACCESS_DEFAULT_EMAILS = [
  'jason@bouncingfish.com',
  'jason.kneen@bouncingfish.com',
  'jason.kneen@gmail.com',
];

function cleanTinyverseEmail(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

export function tinyverseAccessEmails() {
  return new Set(TINYVERSE_ACCESS_DEFAULT_EMAILS);
}

export function isTinyverseAccessEmail(email) {
  const e = cleanTinyverseEmail(email);
  if (!e) return false;
  return tinyverseAccessEmails().has(e);
}

export function tinyverseLobbyAccessForEmail(email) {
  return isTinyverseAccessEmail(email);
}
