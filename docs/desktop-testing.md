# Quest for Windows — first testing version

1. Download **Quest-Windows-Setup** from the completed “Build Quest for Windows” run in GitHub Actions. Unzip it.
2. Open **Quest-Setup-0.1.0.exe** and follow the installer. This version is for Windows 10/11, Intel or AMD 64-bit PCs.
3. Open Quest and sign in with your existing Quest email and password. Your saved quests sync with your account; you do not need a new account.
4. Open **Settings → Notifications** and press **Try a reminder**. Switch to another app to try it there too.
5. Leave **Automatic pop-up reminders** and **Keep Quest running when I close the window** on. Close the main window using its ×. Quest remains in the tray near the Windows clock (sometimes under the small up arrow).
6. Schedule a task a minute or two ahead. Its small reminder should appear near the top of your screen. **Start session** starts the real task timer without opening the main Quest window. **In 5 min** postpones it. The reminder disappears automatically.

You can turn the custom popups off and use ordinary Windows notifications. Enable Quest banners in Windows Settings → System → Notifications for that mode. All enabled reminder types use the same choice, including daily anchors, tasks, Pomodoro, planned-time checks, friends and daily check-ins.

**Start quietly with Windows** is optional and off initially. To pause alerts, right-click the Quest tray icon and choose **Pause reminders for 30 minutes**. To stop the desktop app entirely, choose **Quit Quest**. No alerts run after quitting, while the PC is asleep, or while it is off. Timers use saved timestamps, so their elapsed time remains correct after sleep. Old alerts are not replayed in a flood on waking.

This first testing installer is **unsigned**, so Windows may identify it as an unrecognized app. Verify that it came from this repository’s successful build; `SHA256SUMS.txt` contains the installer checksum. Do not disable antivirus or Windows protection. If your PC blocks it, stop and share the exact message. Signing and automatic app updates can be added before a wider release.

Sign-up confirmation and password recovery emails open the public Quest website. After confirming/resetting, return to the desktop app and sign in. Desktop login is separate from the browser login; both use the same account. Keep friend updates online. Tasks already loaded on the desktop continue to remind you offline. Account deletion currently opens the secure website settings, where you can confirm it.

For this version, use the desktop app for laptop reminders. A separately enabled browser/PWA is another device and may also send a normal system notification; disable that browser’s Quest notification connection if you only want the desktop alert. Your iPhone notification settings are separate.

## Developer commands

Use Node 24 and `npm ci`. Run `npm run desktop:dev` to compile and open the local desktop app. Run `npm test` and `npm run test:desktop` to verify it. On Windows, `npm run desktop:win` builds the installer under `release/`.

The app packages the actual React frontend; it does not depend on a Vercel preview staying available. Its own sandboxed Chromium window runs in the tray, separate from Brave. There is no always-open Document Picture-in-Picture requirement, screen recording, or monitoring of other apps. The reminder window opens with `showInactive()` and never calls `focus()`; only an explicit **Open Quest** action brings the main window forward.

The app uses a restricted `quest://` protocol for packaged files, context isolation, renderer sandboxing, validated IPC senders and bounded message payloads. Browser APIs, shell access and filesystem access are not exposed to the frontend. Production packages disable Node options/inspector fuses and require the packaged ASAR. No service-role key or other private backend credential is included.
