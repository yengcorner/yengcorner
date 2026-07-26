import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function loadFirebaseConfig(): any {
  try {
    const p = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {}

  try {
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const p = path.resolve(dirname, "../../firebase-applet-config.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {}

  try {
    const p = path.resolve(__dirname, "../../firebase-applet-config.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {}

  try {
    const p = path.resolve("firebase-applet-config.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {}

  return null;
}

const firebaseConfig = loadFirebaseConfig() || {};
const TOKEN_PATH = process.env.VERCEL 
  ? "/tmp/gmail-token.json" 
  : path.join(process.cwd(), "gmail-token.json");

async function saveToFirestoreRest(config: any, data: any): Promise<boolean> {
  if (!config || !config.projectId || !config.apiKey) return false;
  try {
    const dbId = config.firestoreDatabaseId || "(default)";
    const fieldsToUpdate = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null);
    const fieldMasks = fieldsToUpdate.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents/gmail/settings?${fieldMasks ? fieldMasks + "&" : ""}key=${config.apiKey}`;

    const fields: any = {};
    for (const key of fieldsToUpdate) {
      const val = data[key];
      if (typeof val === "string") fields[key] = { stringValue: val };
      else if (typeof val === "boolean") fields[key] = { booleanValue: val };
      else if (typeof val === "number") fields[key] = { doubleValue: val };
      else if (typeof val === "object") fields[key] = { stringValue: JSON.stringify(val) };
    }

    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function readFromFirestoreRest(config: any): Promise<any> {
  if (!config || !config.projectId || !config.apiKey) return null;
  try {
    const dbId = config.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents/gmail/settings?key=${config.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const docData = await res.json();
    if (!docData.fields) return null;

    const result: any = {};
    for (const [key, fieldObj] of Object.entries<any>(docData.fields)) {
      if (fieldObj.stringValue !== undefined) {
        try {
          result[key] = JSON.parse(fieldObj.stringValue);
        } catch {
          result[key] = fieldObj.stringValue;
        }
      } else if (fieldObj.booleanValue !== undefined) {
        result[key] = fieldObj.booleanValue;
      } else if (fieldObj.doubleValue !== undefined) {
        result[key] = Number(fieldObj.doubleValue);
      } else if (fieldObj.integerValue !== undefined) {
        result[key] = Number(fieldObj.integerValue);
      }
    }
    return result;
  } catch (e) {
    return null;
  }
}

async function getStoredTokenData(): Promise<any> {
  // 1. Try local cache
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const text = fs.readFileSync(TOKEN_PATH, "utf-8");
      const parsed = JSON.parse(text);
      if (parsed && parsed.accessToken) {
        return parsed;
      }
    }
  } catch (e) {}

  // 2. Try Firestore REST
  const fsData = await readFromFirestoreRest(firebaseConfig);
  if (fsData && fsData.accessToken) {
    return fsData;
  }

  return null;
}

async function refreshAccessTokenSelf(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig.projectId;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      }).toString()
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        const payload = {
          accessToken: data.access_token,
          updatedAt: new Date().toISOString()
        };
        await saveToFirestoreRest(firebaseConfig, payload);
        return data.access_token;
      }
    }
  } catch (e) {}
  return null;
}

async function ensureGoogleSheetsUrlInFirestore() {
  const newUrl = "https://script.google.com/macros/s/AKfycbyLF7z0uuucqD9-EULsAYC8ot27EWkFJoJms0YrRg6eL9qAXKOLcim3PD5V8HhB61Nh/exec";
  try {
    await saveToFirestoreRest(firebaseConfig, {
      googleSheetUrl: newUrl,
      googleSheetsUrl: newUrl
    });
  } catch (err: any) {}
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

  await ensureGoogleSheetsUrlInFirestore();

  try {
    const { to, subject, bodyHtml } = req.body || {};

    if (!to || !subject || !bodyHtml) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin người nhận, tiêu đề hoặc nội dung email." });
    }

    const tokenData = await getStoredTokenData() || {};
    let accessToken = tokenData.accessToken;

    // Fallback token check from Authorization header or req.body.accessToken
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
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: "Cửa hàng chưa liên kết Gmail. Vui lòng truy cập trang Admin mục \"GMAIL CENTER\" để kết nối."
      });
    }

    const senderEmail = tokenData.email || "taphoayeng12@gmail.com";

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

    // If unauthorized (401), attempt to force refresh and retry
    if (!sendResult.ok && sendResult.status === 401 && tokenData.refreshToken) {
      const renewedToken = await refreshAccessTokenSelf(tokenData.refreshToken);
      if (renewedToken) {
        accessToken = renewedToken;
        sendResult = await attemptSend(accessToken);
      }
    }

    if (!sendResult.ok) {
      console.error("[Gmail Send] Gmail API error response:", sendResult.text);
      const isAuthError = sendResult.status === 401 || sendResult.text.includes("Invalid Credentials");
      return res.status(sendResult.status || 400).json({
        success: false,
        error: isAuthError 
          ? "Phiên kết nối Gmail đã hết hạn hoặc bị thu hồi. Vui lòng vào trang Admin mục GMAIL CENTER để kết nối lại." 
          : `Lỗi từ Google Gmail API: ${sendResult.text}`
      });
    }

    return res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("[Gmail Send] Server error during Gmail send:", error);
    return res.status(500).json({
      success: false,
      error: `Lỗi hệ thống khi gửi email: ${error.message || error}`
    });
  }
}
