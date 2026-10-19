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
 * Base email wrapper with responsive HTML styling (Stripe / Linear caliber)
 */
const renderEmailLayout = ({ title, preheader, contentHtml, to }) => {
  const currentClient = getLiveClientUrl();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Helvetica, Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f4f4f5;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100% !important;
      background-color: #09090b;
      padding: 48px 16px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: #121215;
      border: 1px solid #27272a;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7);
    }
    .header {
      padding: 36px 36px 28px 36px;
      text-align: center;
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(18, 18, 21, 0) 100%);
      border-bottom: 1px solid #202024;
    }
    .logo-badge {
      display: inline-block;
      width: 52px;
      height: 52px;
      line-height: 52px;
      background: linear-gradient(135deg, #10b981 0%, #0d9488 100%);
      border-radius: 14px;
      text-align: center;
      font-size: 26px;
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #a1a1aa;
      margin: 0;
    }
    .content {
      padding: 36px;
      line-height: 1.65;
      font-size: 15px;
      color: #d4d4d8;
    }
    .content h2 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 14px;
      letter-spacing: -0.3px;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 12px;
      margin: 28px 0 16px 0;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
      letter-spacing: 0.2px;
    }
    .feature-grid {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 14px;
      padding: 20px;
      margin: 24px 0;
    }
    .feature-item {
      padding: 10px 0;
      border-bottom: 1px solid #222226;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .feature-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .feature-item:first-child {
      padding-top: 0;
    }
    .card-box {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 14px;
      padding: 20px;
      margin: 22px 0;
    }
    .footer {
      padding: 26px 36px;
      text-align: center;
      font-size: 12px;
      color: #71717a;
      border-top: 1px solid #202024;
      background: #0d0d10;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
    .preheader-text {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <span class="preheader-text">${preheader || title}</span>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">💬</div>
        <h1 class="brand-title">Shofi Chat</h1>
        <p class="brand-subtitle">Realtime Communication Platform</p>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">This email was sent by <strong>Shofi Chat</strong> Realtime Platform.</p>
        <p style="margin: 0 0 8px 0;">Access your live dashboard at <a href="${currentClient}" target="_blank" style="color: #10b981; font-weight: 600; text-decoration: none;">${currentClient}</a></p>
        <p style="margin: 0; font-size: 11px; color: #52525b; line-height: 1.4;">Shofi Chat Realtime Network &bull; Account Security & Activity Notification &bull; Sent to ${to || 'you'}</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * 1. Send Welcome Email on Account Creation
 */
const sendWelcomeEmail = async ({ to, name, avatar }) => {
  if (!to) return;

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.log(`[EmailService] SMTP credentials not configured. Welcome email for ${to} skipped.`);
    return;
  }

  const clientUrl = getLiveClientUrl();
  const displayName = name || to.split('@')[0];

  const contentHtml = `
    <h2>Welcome to Shofi Chat, ${displayName}! 👋</h2>
    <p style="margin-top: 0; color: #a1a1aa; font-size: 15px;">
      Your account is now active and ready. Experience lightning-fast, cryptographically secured realtime communication.
    </p>
    
    <div class="feature-grid">
      <div style="font-weight: 700; color: #10b981; font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">
        ⚡ Key Features Overview
      </div>
      
      <div style="margin-bottom: 12px;">
        <strong style="color: #ffffff;">⚡ Ultra-Fast Messaging:</strong>
        <span style="color: #a1a1aa; display: block; font-size: 13px; margin-top: 2px;">
          Redis-powered in-memory synchronization delivering instant, sub-millisecond chat delivery.
        </span>
      </div>

      <div style="margin-bottom: 12px;">
        <strong style="color: #ffffff;">🔒 End-to-End Encryption:</strong>
        <span style="color: #a1a1aa; display: block; font-size: 13px; margin-top: 2px;">
          Direct messages and media are cryptographically shielded client-side for maximum confidentiality.
        </span>
      </div>

      <div style="margin-bottom: 12px;">
        <strong style="color: #ffffff;">📞 HD WebRTC Audio & Video:</strong>
        <span style="color: #a1a1aa; display: block; font-size: 13px; margin-top: 2px;">
          Crystal-clear peer-to-peer calling with Metered global TURN relay across mobile networks.
        </span>
      </div>

      <div>
        <strong style="color: #ffffff;">👥 Group Channels:</strong>
        <span style="color: #a1a1aa; display: block; font-size: 13px; margin-top: 2px;">
          Build collaborative group channels, share multimedia voice notes, and host live audio calls.
        </span>
      </div>
    </div>

    <div style="text-align: center; margin: 30px 0 10px 0;">
      <a href="${clientUrl}" class="btn">Launch Shofi Chat Dashboard →</a>
    </div>

    <div style="background: #141416; border: 1px dashed #27272a; border-radius: 12px; padding: 14px 18px; margin-top: 24px; text-align: left;">
      <span style="color: #10b981; font-weight: 600; font-size: 13px;">💡 Pro Tip:</span>
      <span style="color: #a1a1aa; font-size: 13px; display: block; margin-top: 3px;">
        Invite your team or friends by sharing the direct platform link. You can start voice calls or search contacts instantly!
      </span>
    </div>
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

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.log(`[EmailService] SMTP credentials not configured. Friend request email to ${to} skipped.`);
    return;
  }

  const clientUrl = getLiveClientUrl();
  const fromName = senderName || senderEmail?.split('@')[0] || 'A user';
  const recName = recipientName || to.split('@')[0];
  const safeAvatar = (senderAvatar && !senderAvatar.endsWith('.svg'))
    ? senderAvatar
    : `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(fromName)}&backgroundColor=10b981&textColor=ffffff`;

  const contentHtml = `
    <h2>New Friend Invitation 🤝</h2>
    <p style="margin-top: 0; color: #a1a1aa; font-size: 15px;">
      Hi ${recName}, you have received a new connection request on Shofi Chat.
    </p>

    <div class="card-box" style="text-align: left;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="width: 54px; vertical-align: middle;">
            <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: #27272a; border: 2px solid #10b981;">
              <img src="${safeAvatar}" alt="${fromName}" style="width: 100%; height: 100%; display: block; object-fit: cover;" />
            </div>
          </td>
          <td style="padding-left: 14px; vertical-align: middle;">
            <div style="font-weight: 700; color: #ffffff; font-size: 16px;">${fromName}</div>
            <div style="font-size: 13px; color: #a1a1aa; margin-top: 2px;">${senderEmail || 'Shofi Chat Member'}</div>
          </td>
        </tr>
      </table>
    </div>

    <p style="color: #a1a1aa; font-size: 14px;">
      Accepting this invitation will allow you and <strong>${fromName}</strong> to start instant encrypted messaging, share media, and start HD voice/video calls.
    </p>

    <div style="text-align: center; margin: 30px 0 10px 0;">
      <a href="${clientUrl}" class="btn">View & Accept Invitation →</a>
    </div>
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
