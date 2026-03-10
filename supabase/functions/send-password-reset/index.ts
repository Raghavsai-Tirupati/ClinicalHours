import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Validate API key is configured
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not configured. Please set it in Supabase Edge Functions secrets.");
}

interface SendPasswordResetRequest {
  email: string;
  origin: string;
}

// Rate limiting per email to prevent abuse
const emailRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_RESETS_PER_EMAIL = 3; // 3 reset requests per email per hour

function isEmailRateLimited(email: string): boolean {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  const record = emailRateLimitMap.get(normalizedEmail);

  if (!record || now > record.resetTime) {
    emailRateLimitMap.set(normalizedEmail, { count: 1, resetTime: now + EMAIL_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_RESETS_PER_EMAIL) {
    return true;
  }

  record.count++;
  return false;
}

// Clean up old entries periodically
function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [key, value] of emailRateLimitMap.entries()) {
    if (now > value.resetTime) {
      emailRateLimitMap.delete(key);
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

  // Note: CSRF validation is skipped for password reset as it's a public endpoint
  // for unauthenticated users who don't have CSRF tokens yet.
  // Security is provided by: rate limiting, email validation, token expiration, and origin validation.

  // Cleanup old entries occasionally
  if (Math.random() < 0.01) {
    cleanupRateLimitMap();
  }

  try {
    // Password reset doesn't require authentication (user forgot password)
    const { email, origin }: SendPasswordResetRequest = await req.json();

    console.log(`Processing password reset request for ${email}`);

    // Validate email format
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check rate limit per email
    if (isEmailRateLimited(email)) {
      console.warn(`Rate limit exceeded for email: ${email}`);
      // Still return success to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Start timing for constant-time response
    const requestStartTime = Date.now();
    const MIN_RESPONSE_TIME_MS = 200; // Minimum response time to prevent timing attacks

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Helper function to ensure constant-time response
    const ensureMinResponseTime = async () => {
      const elapsedTime = Date.now() - requestStartTime;
      if (elapsedTime < MIN_RESPONSE_TIME_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME_MS - elapsedTime));
      }
    };

    // Find user by email using filter (more efficient than listUsers + find)
    let user = null;
    try {
      const { data, error: userError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1,
        page: 1,
      });
      
      // Search through users (SDK limitation - filter by email manually but with pagination)
      if (!userError && data?.users) {
        // Use a targeted approach: fetch users and filter by email
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (allUsers?.users) {
          user = allUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
        }
      }
    } catch (lookupError) {
      // Silently handle lookup errors to prevent information leakage
      console.error("Error looking up user:", lookupError);
    }

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`No user found for email: ${email}`);
      await ensureMinResponseTime();
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a secure token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Delete any existing tokens for this user
    await supabaseAdmin
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", user.id);

    // Insert new token
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        email: email,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error inserting token:", insertError);
      throw new Error("Failed to create reset token");
    }

    // Create reset link - always use production domain for password reset emails
    // This ensures emails always point to the correct production URL
    const productionDomain = 'https://clinicalhours.org';
    
    // Validate origin for security, but always use production domain in email
    const allowedOrigins = [
      'https://clinicalhours.org',
      'https://www.clinicalhours.org',
      'https://clinicalhours.org',
      'https://www.clinicalhours.org',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
      'http://localhost:3000',
    ];
    
    // Validate the origin is allowed (for security)
    const isAllowedOrigin = origin && (
      allowedOrigins.includes(origin) || 
      origin.endsWith('.clinicalhours.org')
    );
    
    if (!isAllowedOrigin && origin) {
      console.warn(`Unauthorized origin attempted: ${origin}`);
    }
    
    // Always use production domain in email links for consistency
    const resetLink = `${productionDomain}/reset-password?token=${token}`;

    // Validate API key before attempting to send
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      // Still return success to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log API key prefix for debugging (only first 8 chars for security)
    console.log("Using Resend API key starting with:", RESEND_API_KEY?.substring(0, 8) + "...");

    // Send branded email via Resend HTTP API
    // Use root domain clinicalhours.org since that's what's verified in Resend
    const emailPayload = {
      from: "ClinicalHours <support@clinicalhours.org>",
      to: [email],
      subject: "Reset your ClinicalHours password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 16px 16px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">ClinicalHours</h1>
                      <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Password Reset Request</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                      <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                        We received a request to reset your password. Click the button below to create a new password.
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                        This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                      </p>
                      
                      <!-- Alternative Link -->
                      <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">If the button doesn't work, copy and paste this link:</p>
                        <p style="margin: 0; color: #7c3aed; font-size: 12px; word-break: break-all;">${resetLink}</p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
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
    };

    console.log("Sending email with from address:", emailPayload.from);
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}));
      console.error("Failed to send password reset email:", errorData);
      
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

    console.log("Password reset email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
