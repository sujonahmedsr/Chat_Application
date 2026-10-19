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
 * Base email wrapper with responsive HTML styling
 */
const renderEmailLayout = ({ title, preheader, contentHtml }) => {
  const currentClient = (CLIENT_URL || 'https://shofichat.vercel.app').split(',')[0].trim();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0a0a0a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e5e5e5;
    }
    .wrapper {
      width: 100%;
      background-color: #0a0a0a;
      padding: 40px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #141414;
      border: 1px solid #262626;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .header {
      padding: 32px 32px 24px 32px;
      text-align: center;
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 20, 20, 0) 100%);
      border-bottom: 1px solid #262626;
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #059669 0%, #14b8a6 100%);
      border-radius: 16px;
      margin-bottom: 12px;
      font-size: 26px;
      color: #ffffff;
      box-shadow: 0 8px 16px rgba(16, 185, 129, 0.25);
    }
    .brand-title {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px;
      line-height: 1.6;
      font-size: 15px;
      color: #a3a3a3;
    }
    .content h2 {
      color: #f5f5f5;
      font-size: 20px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .btn {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, #10b981 0%, #0d9488 100%);
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 12px;
      margin: 24px 0 16px 0;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    }
    .card-box {
      background: #1c1c1c;
      border: 1px solid #2e2e2e;
      border-radius: 16px;
      padding: 20px;
      margin: 20px 0;
    }
    .footer {
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #737373;
      border-top: 1px solid #262626;
      background: #0d0d0d;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">💬</div>
        <h1 class="brand-title">Shofi Chat</h1>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">This email was sent by <strong>Shofi Chat</strong> realtime communication system.</p>
        <p style="margin: 0;">Visit your dashboard at <a href="${currentClient}" style="color: #10b981; text-decoration: none;">${currentClient}</a></p>
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
    <h2>Welcome to Shofi Chat, ${displayName}! 🎉</h2>
    <p>Your account has been created successfully. You're all set to experience lightning-fast, secure realtime messaging, voice and video calling.</p>
    
    <div class="card-box">
      <h3 style="color: #10b981; font-size: 15px; margin: 0 0 10px 0;">🚀 What you can do with Shofi Chat:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #d4d4d4; font-size: 14px;">
        <li style="margin-bottom: 6px;"><strong>Ultra-Fast Realtime Messaging:</strong> Redis-accelerated instant chat synchronization.</li>
        <li style="margin-bottom: 6px;"><strong>End-to-End Encryption:</strong> Client-side cryptographic protection for privacy.</li>
        <li style="margin-bottom: 6px;"><strong>HD WebRTC Voice & Video:</strong> Crystal-clear peer-to-peer calling with TURN relay.</li>
        <li style="margin-bottom: 0;"><strong>Group Channels:</strong> Create multi-member rooms and voice conferences.</li>
      </ul>
    </div>

    <div style="text-align: center;">
      <a href="${clientUrl}" class="btn">Open Shofi Chat Dashboard →</a>
    </div>
  `;

  try {
    const info = await mailTransporter.sendMail({
      from: getFromAddress(),
      to,
      subject: `Welcome to Shofi Chat, ${displayName}! 🚀`,
      html: renderEmailLayout({
        title: 'Welcome to Shofi Chat',
        preheader: 'Your account has been created successfully.',
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
    <h2>New Friend Request 🤝</h2>
    <p>Hi ${recName},</p>
    <p><strong>${fromName}</strong> sent you a friend request on Shofi Chat!</p>

    <div class="card-box" style="display: flex; align-items: center; gap: 16px;">
      <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; background: #262626; flex-shrink: 0; border: 2px solid #10b981;">
        <img src="${senderAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fromName)}`}" alt="${fromName}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <div>
        <div style="font-weight: 600; color: #ffffff; font-size: 16px;">${fromName}</div>
        <div style="font-size: 13px; color: #737373;">${senderEmail || 'Shofi Chat Member'}</div>
      </div>
    </div>

    <p>Connect and start chatting with instant end-to-end encrypted messaging, voice calls, and video chat.</p>

    <div style="text-align: center;">
      <a href="${clientUrl}" class="btn">View & Accept Request →</a>
    </div>
  `;

  try {
    const info = await mailTransporter.sendMail({
      from: getFromAddress(),
      to,
      subject: `💬 ${fromName} sent you a friend request on Shofi Chat`,
      html: renderEmailLayout({
        title: 'New Friend Request on Shofi Chat',
        preheader: `${fromName} sent you a friend request`,
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
