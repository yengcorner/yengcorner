import type { Request, Response } from "express";
import fs from "fs";
import { firebaseConfig, saveGmailConfigToFirestore, TOKEN_PATH } from "./token-helper";
import { setDoc } from "firebase/firestore";

export default async function handler(req: Request, res: Response) {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).send("Missing code parameter");
    }

    const redirectUri = state as string;
    if (!redirectUri) {
      return res.status(400).send("Missing state (redirectUri) parameter");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig.projectId;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(400).send("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured on the server. Please check your system Settings.");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      return res.status(400).send(`Failed to exchange authorization code: ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token } = tokenData;

    let email = "taphoayeng12@gmail.com";
    try {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        if (userinfo.email) {
          email = userinfo.email;
        }
      }
    } catch (emailErr) {
      console.error("Failed to fetch user email, using default:", emailErr);
    }

    const firestoreData: any = {
      accessToken: access_token,
      email: email,
      updatedAt: new Date().toISOString()
    };

    if (refresh_token) {
      firestoreData.refreshToken = refresh_token;
    }

    // Write to local disk cache
    try {
      let existingCache: any = {};
      if (fs.existsSync(TOKEN_PATH)) {
        try {
          existingCache = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")) || {};
        } catch (e) {}
      }
      const newCache = {
        ...existingCache,
        ...firestoreData
      };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(newCache, null, 2));
    } catch (err) {}

    // Store in Firestore settings document via safe helper
    await saveGmailConfigToFirestore(firestoreData);

    console.log(`[Gmail OAuth Callback] Token successfully stored for email ${email}`);

    res.send(`
      <html>
        <head>
          <title>Gmail Connection Successful</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background-color: #f8fafc;
              color: #334155;
            }
            .card {
              max-width: 450px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 16px;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
              border: 1px solid #e2e8f0;
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 20px;
              color: #10b981;
            }
            h2 {
              margin-top: 0;
              color: #1e3a8a;
              font-size: 20px;
            }
            p {
              font-size: 14px;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✓</div>
            <h2>Kết nối Gmail thành công!</h2>
            <p>Hệ thống đã kết nối vĩnh viễn (Long-lived session) với email <strong>${email}</strong> và lưu trữ Refresh Token bảo mật.</p>
            <p>Cửa sổ này sẽ tự động đóng lại trong giây lát...</p>
          </div>
          <script>
            setTimeout(() => {
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', email: '${email}' }, '*');
                  window.close();
                } else {
                  window.location.href = '/admin';
                }
              } catch (e) {
                console.error(e);
                window.location.href = '/admin';
              }
            }, 1500);
          </script>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("[Gmail Callback Error]:", err);
    return res.status(500).send(`
      <html>
        <head><title>Gmail Connection Failed</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; color: #ef4444;">
          <h2>Kết nối Gmail thất bại</h2>
          <p>${err.message}</p>
          <button onclick="window.close()">Đóng cửa sổ</button>
        </body>
      </html>
    `);
  }
}
