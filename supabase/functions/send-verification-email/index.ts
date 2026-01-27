import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCSRFToken, validateOrigin, getCorsHeaders, authenticateFromCookie } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Validate API key is configured
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not configured. Please set it in Supabase Edge Functions secrets.");
}

interface SendVerificationEmailRequest {
  userId: string;
  email: string;
  fullName: string;
  origin: string;
}

// Rate limiting per user to prevent abuse
const userRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const USER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_EMAILS_PER_USER = 3; // Reduced to 3 verification emails per user per hour for security

function isUserRateLimited(userId: string): boolean {
  const now = Date.now();
  const record = userRateLimitMap.get(userId);

  if (!record || now > record.resetTime) {
    userRateLimitMap.set(userId, { count: 1, resetTime: now + USER_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_EMAILS_PER_USER) {
    return true;
  }

  record.count++;
  return false;
}

// Clean up old entries periodically
function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [key, value] of userRateLimitMap.entries()) {
    if (now > value.resetTime) {
      userRateLimitMap.delete(key);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Origin header
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    console.warn(`Origin validation failed: ${originValidation.error}`);
    return new Response(
      JSON.stringify({ error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Cleanup old entries occasionally
  if (Math.random() < 0.01) {
    cleanupRateLimitMap();
  }

  try {
    // Parse request body first
    const { userId, email, fullName, origin: requestOrigin }: SendVerificationEmailRequest = await req.json();

    // Create Supabase admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Validate the userId exists in the database (prevents abuse)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email_verified")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      console.error(`User not found: ${userId}`);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Don't send if already verified
    if (userProfile.email_verified) {
      console.log(`User ${userId} is already verified, skipping email`);
      return new Response(
        JSON.stringify({ success: true, alreadyVerified: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending verification email to ${email} for user ${userId}`);

    // Check rate limit
    if (isUserRateLimited(userId)) {
      console.warn(`Rate limit exceeded for user: ${userId}`);
      return new Response(
        JSON.stringify({ error: "Too many verification emails sent. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 254) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a secure token
    const verificationToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    
    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Delete any existing tokens for this user
    await supabaseAdmin
      .from("email_verification_tokens")
      .delete()
      .eq("user_id", userId);

    // Insert new token
    const { error: insertError } = await supabaseAdmin
      .from("email_verification_tokens")
      .insert({
        user_id: userId,
        email: email,
        token: verificationToken,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error inserting token:", insertError);
      throw new Error("Failed to create verification token");
    }

    // ALWAYS use production domain for verification links
    // This ensures emails only link to clinicalhours.org regardless of where signup occurred
    const productionDomain = 'https://clinicalhours.org';
    const verificationLink = `${productionDomain}/verify-email?token=${verificationToken}`;

    // Sanitize fullName for HTML
    const safeName = fullName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Validate API key before attempting to send
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service is not configured. Please contact support." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Banner image URL
    const bannerUrl = "https://sysbtcikrbrrgafffody.supabase.co/storage/v1/object/public/email-assets/email-banner.png";

    // Send branded email via Resend HTTP API - minimalistic dark theme
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClinicalHours <support@clinicalhours.org>",
        to: [email],
        subject: "Verify Your Email — ClinicalHours",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0a0a0a;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="width: 100%; max-width: 520px; border-collapse: collapse;">
                    
                    <!-- Banner Image -->
                    <tr>
                      <td style="padding: 0;">
                        <img src="${bannerUrl}" alt="" style="width: 100%; height: 120px; object-fit: cover; object-position: center 30%; display: block; border-radius: 4px 4px 0 0;" />
                      </td>
                    </tr>
                    
                    <!-- Logo/Brand -->
                    <tr>
                      <td style="padding: 32px 0 24px 0; text-align: center; background-color: #111111;">
                        <p style="margin: 0; font-size: 24px; letter-spacing: 0.1em; color: #ffffff;">
                          <span style="font-weight: 300;">Clinical</span><span style="font-weight: 600;">Hours</span>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 0 40px 40px 40px; background-color: #111111;">
                        <p style="margin: 0 0 8px 0; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em;">
                          Email Verification
                        </p>
                        <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 0.02em; line-height: 1.3;">
                          Welcome, ${safeName}
                        </h1>
                        <p style="margin: 0 0 32px 0; color: #a0a0a0; font-size: 15px; line-height: 1.7; font-weight: 300;">
                          Thank you for creating an account. Please verify your email address to complete your registration and begin exploring clinical opportunities.
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td align="center" style="padding: 0 0 32px 0;">
                              <a href="${verificationLink}" style="display: inline-block; padding: 14px 48px; background-color: #ffffff; color: #0a0a0a; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase;">
                                Verify Email
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Divider -->
                        <div style="height: 1px; background-color: #222222; margin: 0 0 24px 0;"></div>
                        
                        <p style="margin: 0 0 16px 0; color: #666666; font-size: 13px; line-height: 1.6;">
                          This link expires in 24 hours. If you did not create an account, please disregard this email.
                        </p>
                        
                        <!-- Alternative Link -->
                        <p style="margin: 0; color: #555555; font-size: 11px; line-height: 1.6;">
                          If the button doesn't work, copy this link:<br/>
                          <span style="color: #888888; word-break: break-all;">${verificationLink}</span>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 40px; background-color: #0d0d0d; text-align: center; border-radius: 0 0 4px 4px;">
                        <p style="margin: 0; color: #444444; font-size: 11px; letter-spacing: 0.05em;">
                          © ${new Date().getFullYear()} ClinicalHours. All rights reserved.
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}));
      console.error("Failed to send verification email:", errorData);
      
      // Provide helpful error messages for common issues
      let errorMessage = "Failed to send email";
      if (errorData.message) {
        if (errorData.message.includes("domain") || errorData.message.includes("Domain")) {
          errorMessage = "Email domain not verified. Please verify your domain in Resend dashboard.";
        } else if (errorData.message.includes("API key") || errorData.message.includes("Unauthorized")) {
          errorMessage = "Email service configuration error. Please contact support.";
        } else {
          errorMessage = errorData.message;
        }
      }
      
      throw new Error(errorMessage);
    }

    console.log("Verification email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-verification-email function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
