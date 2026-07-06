import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import * as admin from "firebase-admin";
import { getFirestore as getFirestoreAdmin } from "firebase-admin/firestore";

import firebaseConfig from "../../firebase-applet-config.json";
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const gmailDocRef = doc(db, "gmail", "config_YengCornerSecret_3bf8d79a29e4");

// Initialize Firebase Admin SDK for 100% reliable server reads
let dbAdmin: any = null;
try {
  const adminAny = admin as any;
  if (adminAny.apps.length === 0) {
    adminAny.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  dbAdmin = getFirestoreAdmin(adminAny.apps[0] || adminAny.initializeApp({ projectId: firebaseConfig.projectId }), firebaseConfig.firestoreDatabaseId);
} catch (adminErr: any) {
  console.warn("[Gmail Send Admin] Admin SDK initialization skipped/failed:", adminErr.message);
}

const TOKEN_PATH = process.env.VERCEL 
  ? "/tmp/gmail-token.json" 
  : path.join(process.cwd(), "gmail-token.json");

// Helper function to fetch Gmail & Sheets configuration from Firestore using Firebase Admin SDK with ultra-reliable REST API fallbacks
async function fetchGmailConfigFromFirestore(): Promise<any> {
  // 1. Try reading from local file cache first (extremely fast)
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      if (cached && (cached.googleSheetsUrl || cached.accessToken)) {
        console.log("[Firestore Config Helper Send] Found valid config in local disk cache.");
        return cached;
      }
    } catch (err: any) {
      console.warn("[Firestore Config Helper Send] Failed to parse local disk cache (non-blocking):", err.message);
    }
  }

  // 2. Query Firestore via Firebase Admin SDK (100% reliable, bypasses auth and connection limits)
  if (dbAdmin) {
    try {
      console.log("[Firestore Config Helper Send] Fetching configuration via Firebase Admin SDK...");
      const docSnap = await dbAdmin.collection("gmail").doc("config_YengCornerSecret_3bf8d79a29e4").get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data && (data.googleSheetsUrl || data.accessToken)) {
          console.log("[Firestore Config Helper Send] Successfully retrieved config via Admin SDK.");
          try {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
          } catch (writeErr: any) {
            console.warn("[Firestore Config Helper Send] Could not cache Admin SDK result to disk:", writeErr.message);
          }
          return data;
        }
      } else {
        console.log("[Firestore Config Helper Send] Admin SDK completed, but document does not exist yet.");
      }
    } catch (err: any) {
      console.error("[Firestore Config Helper Send] Admin SDK fetch failed, trying fallbacks:", err.message);
    }
  }

  // 3. Query Firestore via Google REST API (secondary reliable fallback)
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/gmail/config_YengCornerSecret_3bf8d79a29e4?key=${firebaseConfig.apiKey}`;
    console.log(`[Firestore Config Helper Send] Fetching fresh config via REST API from: ${url}`);
    
    const response = await fetch(url);
    if (response.ok) {
      const docObj = await response.json();
      if (docObj && docObj.fields) {
        const result: any = {};
        for (const key of Object.keys(docObj.fields)) {
          const valObj = docObj.fields[key];
          if (valObj.stringValue !== undefined) {
            result[key] = valObj.stringValue;
          } else if (valObj.integerValue !== undefined) {
            result[key] = parseInt(valObj.integerValue, 10);
          } else if (valObj.doubleValue !== undefined) {
            result[key] = parseFloat(valObj.doubleValue);
          } else if (valObj.booleanValue !== undefined) {
            result[key] = valObj.booleanValue;
          } else if (valObj.mapValue !== undefined) {
            result[key] = valObj.mapValue;
          } else {
            result[key] = valObj;
          }
        }
        if (result.googleSheetsUrl || result.accessToken) {
          console.log("[Firestore Config Helper Send] Successfully restored config from Firestore via REST API.");
          // Cache back to local disk
          try {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(result, null, 2));
          } catch (writeErr: any) {
            console.warn("[Firestore Config Helper Send] Could not cache to local disk:", writeErr.message);
          }
          return result;
        }
      }
    } else {
      console.warn(`[Firestore Config Helper Send] REST API returned non-OK status: ${response.status}`);
    }
  } catch (err: any) {
    console.error("[Firestore Config Helper Send] Error during Firestore REST request:", err.message);
  }

  // 4. Fallback to Firebase Client SDK (might be slow or blocked in serverless)
  try {
    console.log("[Firestore Config Helper Send] Falling back to Firebase Client SDK...");
    const docSnap = await getDoc(gmailDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      try {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
      } catch (writeErr: any) {
        console.warn("[Firestore Config Helper Send] Could not cache SDK result:", writeErr.message);
      }
      return data;
    }
  } catch (err: any) {
    console.error("[Firestore Config Helper Send] Client SDK fetch failed:", err.message);
  }

  return null;
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

  try {
    const { to, subject, bodyHtml } = req.body;

    if (!to || !subject || !bodyHtml) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin người nhận, tiêu đề hoặc nội dung email." });
    }

    // Fetch configuration using the ultra-reliable REST & local disk fallback helper
    const tokenData = await fetchGmailConfigFromFirestore();

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
