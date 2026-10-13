# Quest account emails

Templates are ready but must be installed in the hosted Supabase Auth settings; deploying the frontend does not install them.

Project: `nagxpuqdurdcogzudblo`.

1. Open Authentication → URL Configuration. Set Site URL to `https://myquests.me`. Preserve existing allowed URLs and add `https://myquests.me/`, `https://myquests.me/reset-password`, and the exact preview origin with `/` and `/reset-password` if testing previews. Use only domains you control; do not allow all Vercel projects.
2. Open Authentication → Email → SMTP Settings. Verify custom SMTP is enabled and that its sender domain is verified with the email provider. Check the provider delivery logs for rejected, bounced, or suppressed recipients. Check SPF/DKIM and the provider's quotas. Disable click tracking for authentication emails. Do not disable email confirmation to work around delivery errors.
3. In Email Templates → Confirm signup, paste `supabase/templates/confirmation.html`. Subject: **Confirm your Quest email**.
4. In Email Templates → Reset password, paste `supabase/templates/recovery.html`. Subject: **Reset your Quest password**.
5. Keep the `{{ .ConfirmationURL }}` placeholders intact; they carry Supabase's one-time verification link and the requested redirect. The small image uses the existing public app icon; all important text and the button work with images blocked.
6. With your own test account, request one confirmation email, follow its newest link, then request one password reset. Verify the email arrives, the reset page opens, and the new password works. Check Inbox and Spam; a successful API request alone is not proof of delivery.

Live logs checked October 13: unconfirmed-email sign-in errors were present. No recovery requests were visible in the inspected 24-hour summary. SMTP configuration is not exposed by the connected Supabase tools, so delivery and template installation remain unverified. No real email was sent as part of the local tests.

Official references: https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/auth/auth-email-templates .
