import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const EMAIL_USER = process.env.EMAIL_USER || process.env.GMAIL_USER || 'shofiqul.sujon2201@gmail.com';
const EMAIL_PASS = (process.env.EMAIL_PASS || process.env.GMAIL_PASS || 'ykiq zcfo dxep cntz').replace(/\s+/g, '');
const SHARED_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_chat_app_2026_production';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html, secret } = body;

    // Basic authentication to prevent abuse
    if (secret && secret !== SHARED_SECRET && secret !== 'chat_app_email_relay') {
      return NextResponse.json({ success: false, error: 'Unauthorized email relay request' }, { status: 401 });
    }

    if (!to || !subject || !html) {
      return NextResponse.json({ success: false, error: 'Missing required fields: to, subject, html' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER.trim(),
        pass: EMAIL_PASS.trim(),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Generate clean plain-text version for RFC multipart compliance (prevents spam flags)
    const plainText = body.text || html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const mailOptions = {
      from: `"Shofi Chat" <${EMAIL_USER.trim()}>`,
      to,
      replyTo: EMAIL_USER.trim(),
      subject,
      text: plainText,
      html,
      headers: {
        'X-Mailer': 'ShofiChat Notification Engine',
        'X-Priority': '3',
      },
    };

    const info: any = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, result) => {
        if (error) {
          console.error('[Vercel Email Relay] Error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      });
    });

    console.log(`[Vercel Email Relay] Successfully sent email to ${to} (MessageId: ${info?.messageId})`);
    return NextResponse.json({ success: true, messageId: info?.messageId, relay: 'vercel-serverless' }, { status: 200 });
  } catch (error: any) {
    console.error('[Vercel Email Relay] Failed:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
