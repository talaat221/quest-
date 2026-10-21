export const desktopBridge = typeof window !== 'undefined' && window.questDesktop?.version === 1 ? window.questDesktop : null;
export const accountWebOrigin = () => desktopBridge ? 'https://myquests.me' : window.location.origin;
