import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// No CORS headers needed - this function is only invoked by cron jobs (server-side)
const responseHeaders = {
  "Content-Type": "application/json",
};

const handler = async (req: Request): Promise<Response> => {
  // This function should only be called by cron jobs, reject browser preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 405 });
  }

  try {
    console.log("Starting send-reminders function...");

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch due reminders that haven't been sent
    const { data: reminders, error: remindersError } = await supabaseAdmin
      .from("reminders")
      .select(`
        id,
        user_id,
        opportunity_id,
        remind_at
      `)
      .lte("remind_at", new Date().toISOString())
      .eq("sent", false);

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError);
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} due reminders`);

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No due reminders found", sent: 0 }),
        {
          status: 200,
          headers: responseHeaders,
        }
      );
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const reminder of reminders) {
      try {
        // Fetch user profile to get email
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
          reminder.user_id
        );

        if (userError || !userData?.user?.email) {
          console.error(`Could not get user email for user ${reminder.user_id}:`, userError);
          errors.push(`User ${reminder.user_id}: No email found`);
          continue;
        }

        // Fetch user's full_name from profiles
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", reminder.user_id)
          .single();

        if (profileError) {
          console.error(`Could not get profile for user ${reminder.user_id}:`, profileError);
        }

        // Fetch opportunity details
        const { data: opportunity, error: oppError } = await supabaseAdmin
          .from("opportunities")
          .select("name, type, location, hours_required")
          .eq("id", reminder.opportunity_id)
          .single();

        if (oppError || !opportunity) {
          console.error(`Could not get opportunity ${reminder.opportunity_id}:`, oppError);
          errors.push(`Opportunity ${reminder.opportunity_id}: Not found`);
          continue;
        }

        const userName = profile?.full_name || "Student";
        const userEmail = userData.user.email;

        // Send reminder email using Resend HTTP API
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Clinical Hours <onboarding@resend.dev>",
            to: [userEmail],
            subject: `Reminder: Follow up on ${opportunity.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #4F46E5;">Clinical Hours Reminder</h1>
                <p>Hi ${userName},</p>
                <p>This is a friendly reminder about your clinical opportunity:</p>
                
                <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="color: #1F2937; margin-top: 0;">${opportunity.name}</h2>
                  <p style="margin: 5px 0;"><strong>Type:</strong> ${opportunity.type}</p>
                  <p style="margin: 5px 0;"><strong>Location:</strong> ${opportunity.location}</p>
                  <p style="margin: 5px 0;"><strong>Hours Required:</strong> ${opportunity.hours_required}</p>
                </div>
                
                <p>Don't forget to follow up on your application or reach out to the organization!</p>
                
                <p>Best of luck,<br>The Clinical Hours Team</p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error(`Failed to send email to ${userEmail}:`, errorData);
          errors.push(`Email to ${userEmail}: ${errorData.message || "Failed"}`);
          continue;
        }

        console.log(`Email sent successfully to ${userEmail}`);

        // Mark reminder as sent
        const { error: updateError } = await supabaseAdmin
          .from("reminders")
          .update({ sent: true })
          .eq("id", reminder.id);

        if (updateError) {
          console.error(`Error marking reminder ${reminder.id} as sent:`, updateError);
        } else {
          sentCount++;
        }
      } catch (err: any) {
        console.error(`Error processing reminder ${reminder.id}:`, err);
        errors.push(`Reminder ${reminder.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${reminders.length} reminders`,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error: any) {
    console.error("Error in send-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
};

serve(handler);
