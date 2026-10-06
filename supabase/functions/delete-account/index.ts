import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedReasons = new Set([
  "no_longer_need",
  "not_useful",
  "hard_to_use",
  "missing_features",
  "bugs_performance",
  "privacy_concerns",
  "other",
  "prefer_not_to_say",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Sign in again before deleting your account." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Quest delete-account function is missing required Supabase environment variables.");
      return json({ error: "Account deletion is temporarily unavailable." }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return json({ error: "Your session could not be verified. Please sign in again." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const confirmation = String(body?.confirmation || "").trim();
    const reasonCode = String(body?.reason_code || "").trim();
    const reasonText = String(body?.reason_text || "").trim().slice(0, 500);

    if (confirmation !== "DELETE") {
      return json({ error: "Type DELETE exactly to confirm permanent account deletion." }, 400);
    }
    if (!allowedReasons.has(reasonCode)) {
      return json({ error: "Choose a deletion reason before continuing." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Quest account deletion failed:", deleteError.message);
      return json({ error: "Quest could not delete your account. Please try again." }, 500);
    }

    const { error: feedbackError } = await admin
      .from("quest_account_deletion_feedback")
      .insert({
        reason_code: reasonCode,
        reason_text: reasonText || null,
        privacy_notice_version: "2026-10-06",
      });

    if (feedbackError) {
      console.error("Quest deletion feedback could not be recorded:", feedbackError.message);
    }

    return json({ deleted: true, feedback_recorded: !feedbackError });
  } catch (error) {
    console.error(
      "Quest delete-account unexpected error:",
      error instanceof Error ? error.message : String(error)
    );
    return json({ error: "Quest could not delete your account. Please try again." }, 500);
  }
});
