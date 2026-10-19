const nodemailer = require('nodemailer');
const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
  CLIENT_URL,
} = require('../config/config');

const getLiveClientUrl = () => {
  const envUrl = process.env.CLIENT_URL || CLIENT_URL || 'https://shofichat.vercel.app';
  const urls = envUrl.split(',').map((u) => u.trim());
  const prod = urls.find((u) => u.includes('vercel.app') || u.startsWith('https://'));
  return prod || 'https://shofichat.vercel.app';
};

const getFromAddress = () => {
  const rawUser = (EMAIL_USER || process.env.EMAIL_USER || 'shofiqul.sujon2201@gmail.com').trim();
  if (rawUser && rawUser.includes('@gmail.com')) {
    return `"Shofi Chat" <${rawUser}>`;
  }
  return EMAIL_FROM || (rawUser ? `"Shofi Chat" <${rawUser}>` : '"Shofi Chat" <shofiqul.sujon2201@gmail.com>');
};

let transporter = null;

// Initialize Nodemailer transporter (Production-Grade Gmail SMTP)
const getTransporter = () => {
  if (transporter) return transporter;

  const rawUser = (EMAIL_USER || process.env.EMAIL_USER || 'shofiqul.sujon2201@gmail.com').trim();
  const rawPass = (EMAIL_PASS || process.env.EMAIL_PASS || 'ykiq zcfo dxep cntz').replace(/\s+/g, '').trim();

  if (!rawUser || !rawPass) {
    console.log('[EmailService] EMAIL_USER or EMAIL_PASS not configured in environment. Skipping email.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: rawUser,
        pass: rawPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });
    console.log(`[EmailService] Production Transporter initialized successfully (${rawUser})`);
    return transporter;
  } catch (err) {
    console.error('[EmailService] Failed to initialize email transporter:', err);
    return null;
  }
};

/**
 * Universal email dispatcher (Supports Resend/Brevo HTTPS port 443 + Gmail SMTP)
 */
const dispatchEmail = async ({ to, subject, html, preheader, title }) => {
  if (!to) return { success: false, error: 'Recipient email required' };

  const currentClient = getLiveClientUrl();
  const finalHtml = renderEmailLayout({ title, preheader, contentHtml: html, to });

  // 1. Vercel HTTPS Serverless Relay (Port 443 - sends via Gmail to ANY recipient with zero domain or SMTP port blocks)
  const relayUrl = `${currentClient.replace(/\/+$/, '')}/api/send-email`;
  const isCloudEnv = process.env.NODE_ENV === 'production' || !currentClient.includes('localhost');
  if (isCloudEnv && relayUrl.startsWith('https://')) {
    try {
      console.log(`[EmailService] Attempting delivery via Vercel HTTPS relay (${relayUrl})...`);
      const resp = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          html: finalHtml,
          secret: 'chat_app_email_relay',
        }),
      });
      const data = await resp.json();
      if (resp.ok && data?.success) {
        console.log(`[EmailService] Email sent via Vercel Relay to ${to} (MessageId: ${data.messageId})`);
        return { success: true, messageId: data.messageId, provider: 'vercel-relay' };
      }
      console.warn('[EmailService] Vercel relay returned error, falling back:', data?.error || resp.statusText);
    } catch (relayErr) {
      console.warn('[EmailService] Vercel relay unreachable, falling back:', relayErr.message);
    }
  }

  // 2. Resend HTTPS API (Port 443 - 100% unblocked on Render Free tier)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Shofi Chat <onboarding@resend.dev>',
          to: [to],
          subject,
          html: finalHtml,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || JSON.stringify(data));
      }
      console.log(`[EmailService] Email sent via Resend HTTPS to ${to} (Id: ${data.id})`);
      return { success: true, messageId: data.id, provider: 'resend-https' };
    } catch (err) {
      console.error('[EmailService] Resend HTTPS failed, falling back to SMTP:', err.message);
    }
  }

  // 2. Brevo HTTPS API (Port 443 - 100% unblocked on Render Free tier)
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const rawUser = (EMAIL_USER || process.env.EMAIL_USER || 'shofiqul.sujon2201@gmail.com').trim();
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Shofi Chat', email: rawUser },
          to: [{ email: to }],
          subject,
          htmlContent: finalHtml,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || JSON.stringify(data));
      }
      console.log(`[EmailService] Email sent via Brevo HTTPS to ${to} (MessageId: ${data.messageId})`);
      return { success: true, messageId: data.messageId, provider: 'brevo-https' };
    } catch (err) {
      console.error('[EmailService] Brevo HTTPS failed, falling back to SMTP:', err.message);
    }
  }

  // 3. Fallback to Gmail SMTP / Nodemailer
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.warn(`[EmailService] No transporter configured. Email to ${to} skipped.`);
    return { success: false, error: 'SMTP transporter not configured' };
  }

  try {
    const cleanText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const info = await mailTransporter.sendMail({
      from: getFromAddress(),
      to,
      replyTo: (EMAIL_USER || 'shofiqul.sujon2201@gmail.com').trim(),
      subject,
      text: cleanText,
      html: finalHtml,
      headers: {
        'X-Mailer': 'ShofiChat Notification Engine',
        'X-Priority': '3',
      },
    });
    console.log(`[EmailService] Email sent via SMTP to ${to} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId, provider: 'smtp' };
  } catch (err) {
    console.error(`[EmailService] SMTP error sending to ${to}:`, err.message);
    if (err.message.includes('ETIMEDOUT') || err.code === 'ETIMEDOUT') {
      console.error('[EmailService] NOTE: Render Free Web Services block outbound SMTP ports (25, 465, 587). Use Vercel relay or add RESEND_API_KEY in Render.');
    }
    return { success: false, error: err.message, code: err.code };
  }
};



/**
 * Base email wrapper with responsive HTML styling (Clean White Base, Zero Overflow/Scroll issues)
 */
const renderEmailLayout = ({ title, preheader, contentHtml, to }) => {
  const currentClient = getLiveClientUrl();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, span { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    * { box-sizing: border-box; }
    body, html {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f1f5f9;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
      max-width: 100%;
      display: block;
    }
    a {
      text-decoration: none;
      color: #059669;
    }
    .email-container {
      max-width: 580px !important;
      width: 100% !important;
      margin: 40px auto !important;
      table-layout: fixed !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-padding {
        padding: 24px 16px !important;
      }
      .header-padding {
        padding: 24px 16px 18px 16px !important;
      }
      .mobile-stack {
        display: block !important;
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <!-- Hidden preheader text -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${preheader || title}
  </div>

  <!-- Outer background wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 30px 12px 40px 12px; table-layout: fixed;">
    <tr>
      <td align="center" valign="top" style="padding: 0;">
        
        <!-- Main Card Container (Pure White Base) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04); table-layout: fixed;">
          
          <!-- Header Bar -->
          <tr>
            <td align="center" class="header-padding" style="padding: 32px 28px 20px 28px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="vertical-align: middle;">
                    <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; text-align: center; color: #ffffff; font-size: 22px; font-weight: bold; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">
                      &#128172;
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.4px;">Shofi Chat</h1>
                    <p style="margin: 3px 0 0 0; font-size: 13px; font-weight: 500; color: #64748b;">Realtime Encrypted Communication Platform</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="content-padding" style="padding: 32px 30px; font-size: 14px; line-height: 1.6; color: #334155; word-break: break-word;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Clean Light Footer -->
          <tr>
            <td style="padding: 24px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; line-height: 1.5; color: #64748b;">
              <p style="margin: 0 0 6px 0; color: #475569; font-weight: 500;">
                Sent securely by <strong>Shofi Chat</strong> &bull; Production Notification Engine
              </p>
              <p style="margin: 0 0 10px 0;">
                Live Web Dashboard: <a href="${currentClient}" target="_blank" style="color: #059669; font-weight: 600; text-decoration: underline;">${currentClient}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                This automated activity update was dispatched to <strong style="color: #64748b;">${to || 'your registered account'}</strong>.<br />
                &copy; ${new Date().getFullYear()} Shofi Chat. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Main Card Container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * 1. Send Welcome Email on Account Creation
 */
const sendWelcomeEmail = async ({ to, name, avatar }) => {
  if (!to) return;

  const clientUrl = getLiveClientUrl();
  const displayName = name || to.split('@')[0];

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">
      Welcome to Shofi Chat, ${displayName}! &#128075;
    </h2>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Your account is now fully provisioned and ready for use. Connect with friends, teams, and colleagues with lightning-fast encrypted messaging and HD calling.
    </p>

    <!-- Account Details Card -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; table-layout: fixed;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
          <strong style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">&#128100; Account Credentials &amp; Status</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; line-height: 1.8; color: #334155;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 120px; color: #64748b; font-weight: 500; vertical-align: top;">Registered Email:</td>
              <td style="color: #0f172a; font-weight: 600; word-break: break-all;">${to}</td>
            </tr>
            <tr>
              <td style="width: 120px; color: #64748b; font-weight: 500; vertical-align: top;">Account Status:</td>
              <td>
                <span style="display: inline-block; padding: 2px 8px; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; border-radius: 9999px; font-size: 11px; font-weight: 700;">
                  ACTIVE &amp; VERIFIED
                </span>
              </td>
            </tr>
            <tr>
              <td style="width: 120px; color: #64748b; font-weight: 500; vertical-align: top;">Security Mode:</td>
              <td style="color: #0f172a; font-weight: 500;">End-to-End Encrypted (AES-256 + ECDH)</td>
            </tr>
            <tr>
              <td style="width: 120px; color: #64748b; font-weight: 500; vertical-align: top;">Direct Web App:</td>
              <td><a href="${clientUrl}" target="_blank" style="color: #059669; font-weight: 600; text-decoration: underline;">${clientUrl}</a></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Platform Capabilities List -->
    <div style="margin: 22px 0 24px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #0f172a;">
        What you can do right now:
      </h3>

      <!-- Feature item 1 -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 14px; vertical-align: top; width: 34px;">
            <div style="font-size: 18px;">&#9889;</div>
          </td>
          <td style="padding: 12px 14px 12px 0; vertical-align: top;">
            <strong style="color: #0f172a; font-size: 14px; display: block;">Ultra-Fast Realtime Messaging</strong>
            <span style="color: #475569; font-size: 13px; line-height: 1.4; display: block; margin-top: 2px;">
              Redis-powered in-memory pub/sub synchronization delivering instant, sub-millisecond messages with typing indicators and read receipts.
            </span>
          </td>
        </tr>
      </table>

      <!-- Feature item 2 -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 14px; vertical-align: top; width: 34px;">
            <div style="font-size: 18px;">&#128274;</div>
          </td>
          <td style="padding: 12px 14px 12px 0; vertical-align: top;">
            <strong style="color: #0f172a; font-size: 14px; display: block;">End-to-End Client Encryption</strong>
            <span style="color: #475569; font-size: 13px; line-height: 1.4; display: block; margin-top: 2px;">
              Direct messages and shared media files are cryptographically protected in your browser so only you and the recipient can read them.
            </span>
          </td>
        </tr>
      </table>

      <!-- Feature item 3 -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 14px; vertical-align: top; width: 34px;">
            <div style="font-size: 18px;">&#128222;</div>
          </td>
          <td style="padding: 12px 14px 12px 0; vertical-align: top;">
            <strong style="color: #0f172a; font-size: 14px; display: block;">HD Peer-to-Peer Voice &amp; Video Calls</strong>
            <span style="color: #475569; font-size: 13px; line-height: 1.4; display: block; margin-top: 2px;">
              Crystal-clear WebRTC audio and video calling with globally distributed TURN relays for flawless connectivity across any network.
            </span>
          </td>
        </tr>
      </table>

      <!-- Feature item 4 -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 14px; vertical-align: top; width: 34px;">
            <div style="font-size: 18px;">&#128101;</div>
          </td>
          <td style="padding: 12px 14px 12px 0; vertical-align: top;">
            <strong style="color: #0f172a; font-size: 14px; display: block;">Channels &amp; Voice Messaging</strong>
            <span style="color: #475569; font-size: 13px; line-height: 1.4; display: block; margin-top: 2px;">
              Form public or private group channels, record and send audio voice notes, and collaborate effortlessly.
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Centered Call to Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 20px 0;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color: #059669; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                <a href="${clientUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: 8px; letter-spacing: -0.2px;">
                  Open Shofi Chat Dashboard &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Pro Tip Notice Box -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #166534;">
          <strong style="color: #15803d;">&#128161; Quick Start Tip:</strong>
          You can add friends by searching for their username or email directly from the contacts tab. Once accepted, you can initiate one-click HD calls instantly!
        </td>
      </tr>
    </table>
  `;

  return dispatchEmail({
    to,
    subject: `Welcome to Shofi Chat, ${displayName}`,
    title: `Welcome to Shofi Chat, ${displayName}`,
    preheader: `Your Shofi Chat account is ready. Start ultra-fast messaging and HD calls now!`,
    html: contentHtml,
  });
};

/**
 * 2. Send Friend Request Notification Email
 */
const sendFriendRequestEmail = async ({ to, recipientName, senderName, senderAvatar, senderEmail }) => {
  if (!to) return;

  const clientUrl = getLiveClientUrl();
  const fromName = senderName || senderEmail?.split('@')[0] || 'A member';
  const recName = recipientName || to.split('@')[0];
  const safeAvatar = (senderAvatar && !senderAvatar.endsWith('.svg'))
    ? senderAvatar
    : `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(fromName)}&backgroundColor=059669&textColor=ffffff`;

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">
      New Friend Request Received &#129309;
    </h2>
    
    <p style="margin: 0 0 18px 0; font-size: 15px; color: #475569; line-height: 1.6;">
      Hi ${recName}, you have received a new connection request on Shofi Chat.
    </p>

    <!-- Requester User Card (Clean White Base) -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 18px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; table-layout: fixed;">
      <tr>
        <td style="padding: 18px 20px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 52px; vertical-align: middle;">
                <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background-color: #e2e8f0; border: 2px solid #059669;">
                  <img src="${safeAvatar}" alt="${fromName}" width="48" height="48" style="width: 48px; height: 48px; display: block; object-fit: cover; border-radius: 50%;" />
                </div>
              </td>
              <td style="padding-left: 16px; vertical-align: middle;">
                <div style="font-weight: 700; color: #0f172a; font-size: 16px;">${fromName}</div>
                <div style="font-size: 13px; color: #64748b; margin-top: 2px;">${senderEmail || 'Shofi Chat Member'}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      Once you accept this invitation, you and <strong style="color: #0f172a;">${fromName}</strong> can exchange real-time encrypted messages, share media attachments, and start HD voice &amp; video calls directly inside Shofi Chat.
    </p>

    <!-- Centered Call to Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 26px 0 18px 0;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color: #059669; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                <a href="${clientUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: 8px; letter-spacing: -0.2px;">
                  View &amp; Accept Invitation &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
      If you do not recognize this person, you can simply ignore or decline this request in your notifications panel.
    </p>
  `;

  return dispatchEmail({
    to,
    subject: `${fromName} sent you a friend request on Shofi Chat`,
    title: 'New Friend Request on Shofi Chat',
    preheader: `${fromName} wants to connect with you on Shofi Chat`,
    html: contentHtml,
  });
};

module.exports = {
  sendWelcomeEmail,
  sendFriendRequestEmail,
};
