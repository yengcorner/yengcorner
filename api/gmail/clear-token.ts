import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

import firebaseConfig from "../../firebase-applet-config.json";
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
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
