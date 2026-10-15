// Browser permission and registration with a push service are separate steps.
// In Brave, permission may be allowed while its Google push transport is off.
export async function withNotificationDeadline(work, ms, message) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function notificationSetupMessage(problem, stage, brave = false) {
  if (stage === 'push') {
    return brave
      ? 'Brave allowed notifications but could not connect to its push service. In Brave Settings → Privacy and security, turn on “Use Google services for push messaging”, restart Brave, then enable notifications here again.'
      : 'The browser could not connect to its push service. Check its notification settings and connection, restart the browser, then enable this device again.';
  }
  if (stage === 'worker') return 'Quest’s notification worker could not start. Reload this Quest address and try again. If this is a protected preview, make sure you can open it while signed in.';
  return problem?.message || 'Could not enable this device. Please try again.';
}

export function popupCanDisplay({ inApp, desktopPopups }, pageVisible, popupOpen) {
  return !!inApp && (pageVisible || (!!desktopPopups && popupOpen));
}
