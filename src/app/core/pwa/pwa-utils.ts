/** iPhone, iPad aur iPad jo Mac bankar aata hai (touch points > 1). */
export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** App home screen se (standalone) khuli hai ya normal browser tab mein. */
export function isStandalone(
  nav: { standalone?: boolean },
  matchMedia?: (query: string) => { matches: boolean },
): boolean {
  if (nav.standalone === true) return true;
  return matchMedia ? matchMedia('(display-mode: standalone)').matches : false;
}