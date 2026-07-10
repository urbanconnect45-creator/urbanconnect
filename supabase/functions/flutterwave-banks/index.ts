// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { withSupabase } from "@supabase/server";

console.log("Hello from Functions!");

type SupabaseFunctionContext = {
  authMode?: "publishable" | "secret" | string;
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: (userId: string) => Promise<{
          data?: {
            user?: {
              email?: string | null;
            } | null;
          };
        }>;
      };
    };
  };
};

// This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// Use publishable for Client-facing, key-validated endpoints
// Use secret for Server-to-server, internal calls
export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req: Request, _ctx: SupabaseFunctionContext) => {
      // Called by another service with a secret key
      // ctx.supabaseAdmin bypasses RLS - use for privileged operations
      /*
      if (ctx.authMode === "secret") {
        const { user_id } = await req.json();
        const { data } = await ctx.supabaseAdmin.auth.admin.getUserById(user_id);

        return Response.json({
          email: data?.user?.email,
        });
      }
      */

      const { name } = await req.json();

      return Response.json({
        message: `Hello ${name}!`,
      });
    },
  ),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/flutterwave-banks' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/
