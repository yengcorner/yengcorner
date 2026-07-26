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

export default async function handler(req: Request, res: Response) {
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
    let tokenData: any = null;
    // Check disk cache
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      }
    } catch (e) {}

    // Fallback to Firestore REST
    if (!tokenData || !tokenData.accessToken) {
      tokenData = await readFromFirestoreRest(firebaseConfig);
    }

    if (tokenData && tokenData.accessToken) {
      // Validate access token with Google UserInfo
      const testRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` }
      });

      if (testRes.ok) {
        const userInfo = await testRes.json();
        return res.status(200).json({
          connected: true,
          email: userInfo.email || tokenData.email,
          accessToken: tokenData.accessToken,
          updatedAt: tokenData.updatedAt || new Date().toISOString()
        });
      }

      // If token expired, attempt refresh
      if (tokenData.refreshToken) {
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
              const updated = {
                ...tokenData,
                accessToken: refreshData.access_token,
                updatedAt: new Date().toISOString()
              };
              await saveToFirestoreRest(firebaseConfig, updated);
              return res.status(200).json({
                connected: true,
                email: tokenData.email,
                accessToken: refreshData.access_token,
                updatedAt: updated.updatedAt
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ connected: false, email: null, accessToken: null });
  } catch (err: any) {
    return res.status(200).json({ connected: false, email: null, accessToken: null, error: err.message });
  }
}
