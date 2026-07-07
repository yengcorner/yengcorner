import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

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
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const gmailDocRef = doc(db, "gmail", "settings");

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
    // 1. Clear local file cache
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
      }
    } catch (cacheErr: any) {
      console.warn(`[Gmail Auth] Could not delete local cache (non-blocking):`, cacheErr.message);
    }

    // 2. Delete from Firestore
    await deleteDoc(gmailDocRef);
    console.log("[Gmail Auth] Token deleted successfully from Firestore");

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[Gmail Auth] Error clearing token:", err);
    return res.status(500).json({ success: false, error: "Could not clear Gmail token: " + err.message });
  }
}
