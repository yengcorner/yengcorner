import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Initialize Firebase using the configuration file
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const gmailDocRef = doc(db, "gmail", "config_YengCornerSecret_3bf8d79a29e4");

const TOKEN_PATH = process.env.VERCEL 
  ? "/tmp/gmail-token.json" 
  : path.join(process.cwd(), "gmail-token.json");

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { to, subject, bodyHtml } = req.body;

    if (!to || !subject || !bodyHtml) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin người nhận, tiêu đề hoặc nội dung email." });
    }

    let tokenData: any = null;

    // 1. Try reading local file cache
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      }
    } catch (err: any) {
      console.warn("Could not read local gmail token cache:", err.message);
    }

    // 2. If not found in local file, restore from Firestore automatically
    if (!tokenData) {
      try {
        const docSnap = await getDoc(gmailDocRef);
        if (docSnap.exists()) {
          tokenData = docSnap.data();
          // Cache it locally on disk
          try {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
          } catch (cacheErr: any) {
            console.warn("Could not cache token locally:", cacheErr.message);
          }
        }
      } catch (err: any) {
        console.error("Error loading Gmail token from Firestore:", err.message);
      }
    }

    if (!tokenData || !tokenData.accessToken) {
      return res.status(400).json({
        success: false,
        error: "Cửa hàng chưa liên kết Gmail. Vui lòng truy cập trang Admin mục \"GMAIL CENTER\" để kết nối."
      });
    }

    let accessToken = tokenData.accessToken;
    const senderEmail = tokenData.email;

    // Helper to attempt sending message using the current accessToken
    const attemptSend = async (token: string): Promise<{ ok: boolean; status: number; text: string }> => {
      const subjectEncoded = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
      const rawParts = [
        `From: Yeng Corner <${senderEmail}>`,
        `To: ${to}`,
        `Subject: ${subjectEncoded}`,
        "MIME-Version: 1.0",
        `Content-Type: text/html; charset="utf-8"`,
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(bodyHtml).toString("base64")
      ];
      const rawMime = rawParts.join("\r\n");

      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: Buffer.from(rawMime)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
        })
      });

      const text = await gmailRes.text();
      return { ok: gmailRes.ok, status: gmailRes.status, text };
    };

    let sendResult = await attemptSend(accessToken);

    // If unauthorized (401), and we have a refreshToken, attempt to renew the accessToken
    if (!sendResult.ok && sendResult.status === 401 && tokenData.refreshToken) {
      console.log("[Gmail Send] Access Token expired. Attempting to refresh using refresh_token...");
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig.projectId;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: tokenData.refreshToken,
              grant_type: "refresh_token"
            }).toString()
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.access_token) {
              accessToken = refreshData.access_token;
              tokenData.accessToken = accessToken;
              tokenData.updatedAt = new Date().toISOString();

              // Update Firestore and Local cache with the new accessToken
              await setDoc(gmailDocRef, tokenData);
              try {
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
              } catch (e) {}

              console.log("[Gmail Send] Access Token renewed successfully. Retrying email send...");
              sendResult = await attemptSend(accessToken);
            }
          } else {
            console.error("[Gmail Send] Failed to refresh token:", await refreshRes.text());
          }
        }
      } catch (refreshErr: any) {
        console.error("[Gmail Send] Error renewing token:", refreshErr.message);
      }
    }

    if (!sendResult.ok) {
      console.error("[Gmail Send] Gmail API error response:", sendResult.text);
      let isAuthError = sendResult.status === 401 || sendResult.text.includes("Invalid Credentials");
      return res.status(sendResult.status || 400).json({
        success: false,
        error: isAuthError 
          ? "Phiên kết nối Gmail đã hết hạn (1 giờ). Vui lòng vào Admin -> GMAIL CENTER để bấm kết nối lại." 
          : `Lỗi từ Google Gmail API: ${sendResult.text}`
      });
    }

    console.log(`[Gmail Send] Email successfully sent to ${to}`);
    return res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("[Gmail Send] Server error during Gmail send:", error);
    return res.status(500).json({
      success: false,
      error: `Lỗi hệ thống khi gửi email: ${error.message || error}`
    });
  }
}
