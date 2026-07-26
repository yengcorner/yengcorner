import type { Request, Response } from "express";
import fs from "fs";
import { 
  fetchGmailConfigFromFirestore, 
  getValidAccessToken, 
  refreshAccessToken, 
  saveGmailConfigToFirestore,
  gmailDocRef, 
  TOKEN_PATH,
  db
} from "./token-helper";

// Auto-seed/update Google Sheets URL to Firestore on boot or request
async function ensureGoogleSheetsUrlInFirestore() {
  const newUrl = "https://script.google.com/macros/s/AKfycbyLF7z0uuucqD9-EULsAYC8ot27EWkFJoJms0YrRg6eL9qAXKOLcim3PD5V8HhB61Nh/exec";
  try {
    console.log("[Seeder Send] Ensuring Google Sheets URL is set in Firestore...");
    await saveGmailConfigToFirestore({
      googleSheetUrl: newUrl,
      googleSheetsUrl: newUrl
    });
  } catch (err: any) {
    console.error("[Seeder Send] Failed to write Google Sheets URL to Firestore:", err.message);
  }
}

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

  // Ensure Sheet URL is updated
  await ensureGoogleSheetsUrlInFirestore();

  try {
    const { to, subject, bodyHtml } = req.body;

    if (!to || !subject || !bodyHtml) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin người nhận, tiêu đề hoặc nội dung email." });
    }

    // Proactively fetch a valid, automatically refreshed access token
    let accessToken = await getValidAccessToken();
    const tokenData = await fetchGmailConfigFromFirestore();

    // Fallback: Check Authorization header or req.body.accessToken if DB/Cache did not yield token
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let fallbackToken: string | null = null;
    if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      fallbackToken = authHeader.substring(7).trim();
    }
    if (!fallbackToken && req.body?.accessToken) {
      fallbackToken = req.body.accessToken;
    }

    if (!accessToken && fallbackToken) {
      accessToken = fallbackToken;
      console.log("[Gmail Send] Using fallback access token provided in request headers or body.");
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: "Cửa hàng chưa liên kết Gmail. Vui lòng truy cập trang Admin mục \"GMAIL CENTER\" để kết nối."
      });
    }

    const senderEmail = (tokenData && tokenData.email) ? tokenData.email : "taphoayeng12@gmail.com";

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

    // If unauthorized (401), attempt to force refresh and retry one more time
    if (!sendResult.ok && sendResult.status === 401 && tokenData.refreshToken) {
      console.log("[Gmail Send] Access Token expired during request. Forcing renewal using refresh_token...");
      const renewedToken = await refreshAccessToken(tokenData.refreshToken, tokenData);
      if (renewedToken) {
        accessToken = renewedToken;
        console.log("[Gmail Send] Access Token renewed successfully. Retrying send...");
        sendResult = await attemptSend(accessToken);
      }
    }

    if (!sendResult.ok) {
      console.error("[Gmail Send] Gmail API error response:", sendResult.text);
      let isAuthError = sendResult.status === 401 || sendResult.text.includes("Invalid Credentials");
      return res.status(sendResult.status || 400).json({
        success: false,
        error: isAuthError 
          ? "Phiên kết nối Gmail đã hết hạn hoặc bị thu hồi. Vui lòng vào trang Admin mục GMAIL CENTER để kết nối lại." 
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
