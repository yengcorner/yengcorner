import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from "firebase-admin/app";
import { getFirestore as getFirestoreAdmin } from "firebase-admin/firestore";

function loadFirebaseConfig(): any {
  try {
    const p = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch (e) {}

  try {
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const p = path.resolve(dirname, "../../firebase-applet-config.json");
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch (e) {}

  try {
    const p = path.resolve(__dirname, "../../firebase-applet-config.json");
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch (e) {}

  try {
    const p = path.resolve("firebase-applet-config.json");
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch (e) {}

  throw new Error("Could not find firebase-applet-config.json!");
}

const firebaseConfig = loadFirebaseConfig();
const firebaseApp = getClientApps().length === 0 ? initializeClientApp(firebaseConfig) : getClientApp();
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const gmailDocRef = doc(db, "gmail", "settings");

// Initialize Firebase Admin SDK for 100% reliable server writes
let dbAdmin: any = null;
try {
  if (!getAdminApps().length) {
    initializeAdminApp({
      projectId: firebaseConfig.projectId
    });
  }
  dbAdmin = getFirestoreAdmin(getAdminApp(), firebaseConfig.firestoreDatabaseId);
} catch (adminErr: any) {
  console.warn("[Gmail Auth Admin Store] Admin SDK initialization skipped/failed:", adminErr.message);
}

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
    const { accessToken, email, refreshToken } = req.body;
    if (!accessToken || !email) {
      return res.status(400).json({ success: false, error: "Missing accessToken or email" });
    }

    const tokenData: any = {
      accessToken,
      email,
      updatedAt: new Date().toISOString(),
    };

    // ONLY overwrite refreshToken if it is explicitly provided in the request body,
    // otherwise omit it so { merge: true } preserves the existing refreshToken in Firestore.
    if (refreshToken !== undefined && refreshToken !== null) {
      tokenData.refreshToken = refreshToken;
    }

    // 1. Try to write to local file cache (non-blocking) with merging to preserve existing config/urls
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
      console.warn(`[Gmail Auth] Could not write to local cache (non-blocking):`, cacheErr.message);
    }

    // 2. Write to Firestore with { merge: true } to prevent wiping out other fields (e.g. googleSheetsUrl, refreshToken)
    if (dbAdmin) {
      console.log(`[Gmail Auth] Storing token in Firestore via Admin SDK with merge...`);
      await dbAdmin.collection("gmail").doc("settings").set(tokenData, { merge: true });
    } else {
      console.log(`[Gmail Auth] Falling back to Client SDK to store token with merge...`);
      await setDoc(gmailDocRef, tokenData, { merge: true });
    }
    console.log(`[Gmail Auth] Token stored successfully in Firestore for ${email}`);

    return res.status(200).json({ success: true, email });
  } catch (err: any) {
    console.error("[Gmail Auth] Error storing token:", err);
    return res.status(500).json({ success: false, error: "Could not save Gmail token: " + err.message });
  }
}
