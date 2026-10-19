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

const getFromAddress = () => {
  const rawUser = (EMAIL_USER || '').trim();
  if (rawUser && rawUser.includes('@gmail.com')) {
    return `"Shofi Chat" <${rawUser}>`;
  }
  return EMAIL_FROM || (rawUser ? `"Shofi Chat" <${rawUser}>` : '"Shofi Chat" <noreply@shofichat.com>');
};

let transporter = null;

// Initialize Nodemailer transporter
const getTransporter = () => {
  if (transporter) return transporter;

  const rawUser = (EMAIL_USER || '').trim();
  // Strip spaces if user pasted 16-character Google App Password with spaces
  const rawPass = (EMAIL_PASS || '').replace(/\s+/g, '').trim();

  if (!rawUser || !rawPass) {
    console.log('[EmailService] EMAIL_USER or EMAIL_PASS not configured in .env / environment variables. Email notifications skipped.');
    return null;
  }

  try {
    const isGmail = (EMAIL_HOST || '').includes('gmail.com') || rawUser.includes('@gmail.com');

    if (isGmail) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: rawUser,
          pass: rawPass,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_SECURE,
        auth: {
          user: rawUser,
          pass: rawPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
    console.log(`[EmailService] Transporter initialized successfully (${isGmail ? 'Gmail Service' : EMAIL_HOST})`);
    return transporter;
  } catch (err) {
    console.error('[EmailService] Failed to initialize email transporter:', err);
    return null;
  }
};


/**
 * Base email wrapper with responsive HTML styling (Stripe / Linear caliber)
 */
const renderEmailLayout = ({ title, preheader, contentHtml }) => {
  const currentClient = (CLIENT_URL || 'https://shofichat.vercel.app').split(',')[0].trim();

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
        <p style="margin: 0 0 6px 0;">This email was sent by <strong>Shofi Chat</strong> realtime messaging network.</p>
        <p style="margin: 0;">Access your live dashboard at <a href="${currentClient}">${currentClient}</a></p>
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

  const clientUrl = (CLIENT_URL || 'https://shofichat.vercel.app').split(',')[0].trim();
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

  try {
    const info = await mailTransporter.sendMail({
      from: getFromAddress(),
      to,
      subject: `Welcome to Shofi Chat, ${displayName}! 🚀`,
      html: renderEmailLayout({
        title: `Welcome to Shofi Chat, ${displayName}`,
        preheader: `Your Shofi Chat account is ready. Start ultra-fast messaging and HD calls now!`,
        contentHtml,
      }),
    });
    console.log(`[EmailService] Welcome email sent to ${to} (MessageId: ${info.messageId})`);
  } catch (err) {
    console.error(`[EmailService] Error sending welcome email to ${to}:`, err.message);
  }
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

  const clientUrl = (CLIENT_URL || 'https://shofichat.vercel.app').split(',')[0].trim();
  const fromName = senderName || senderEmail?.split('@')[0] || 'A user';
  const recName = recipientName || to.split('@')[0];

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
              <img src="${senderAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fromName)}`}" alt="${fromName}" style="width: 100%; height: 100%; display: block; object-fit: cover;" />
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

  try {
    const info = await mailTransporter.sendMail({
      from: getFromAddress(),
      to,
      subject: `💬 ${fromName} sent you a friend request on Shofi Chat`,
      html: renderEmailLayout({
        title: 'New Friend Request on Shofi Chat',
        preheader: `${fromName} wants to connect with you on Shofi Chat`,
        contentHtml,
      }),
    });
    console.log(`[EmailService] Friend request notification sent to ${to} (MessageId: ${info.messageId})`);
  } catch (err) {
    console.error(`[EmailService] Error sending friend request email to ${to}:`, err.message);
  }
};

module.exports = {
  sendWelcomeEmail,
  sendFriendRequestEmail,
};
