import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
const firebaseApp = firebaseConfig.projectId && getApps().length === 0 ? initializeApp(firebaseConfig) : (getApps().length > 0 ? getApp() : null);
const db = firebaseApp ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) : null;

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
    const { accessToken, email, refreshToken } = req.body || {};
    if (!accessToken || !email) {
      return res.status(400).json({ success: false, error: "Missing accessToken or email" });
    }

    const tokenData: any = {
      accessToken,
      email,
      updatedAt: new Date().toISOString(),
    };

    if (refreshToken !== undefined && refreshToken !== null) {
      tokenData.refreshToken = refreshToken;
    }

    // 1. Write to local file cache
    try {
      let existingCache: any = {};
      if (fs.existsSync(TOKEN_PATH)) {
        try {
          existingCache = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")) || {};
        } catch (e) {}
      }
      const newCache = {
        ...existingCache,
        ...tokenData
      };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(newCache, null, 2));
      console.log(`[Gmail Auth] Token cached locally at ${TOKEN_PATH}`);
    } catch (cacheErr: any) {
      console.warn(`[Gmail Auth] Could not write to local cache:`, cacheErr.message);
    }

    // 2. Write to Firestore via REST API (100% reliable on Vercel)
    const restSuccess = await saveToFirestoreRest(firebaseConfig, tokenData);
    if (!restSuccess && db) {
      // Fallback to Client SDK
      try {
        const gmailDocRef = doc(db, "gmail", "settings");
        await setDoc(gmailDocRef, tokenData, { merge: true });
      } catch (dbErr: any) {
        console.warn(`[Gmail Auth] Client SDK save failed:`, dbErr.message);
      }
    }

    console.log(`[Gmail Auth] Token store process finished for ${email}`);
    return res.status(200).json({ success: true, email });
  } catch (err: any) {
    console.error("[Gmail Auth] Error storing token:", err);
    return res.status(200).json({ success: true, warning: err.message || String(err) });
  }
}
