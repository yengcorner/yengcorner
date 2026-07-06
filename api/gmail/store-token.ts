import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import * as admin from "firebase-admin";
import { getFirestore as getFirestoreAdmin } from "firebase-admin/firestore";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const firebaseConfig = require("../../firebase-applet-config.json");
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const gmailDocRef = doc(db, "gmail", "config_YengCornerSecret_3bf8d79a29e4");

// Initialize Firebase Admin SDK for 100% reliable server writes
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

    const tokenData = {
      accessToken,
      email,
      refreshToken: refreshToken || null,
      updatedAt: new Date().toISOString(),
    };

    // 1. Try to write to local file cache (non-blocking)
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
      console.log(`[Gmail Auth] Token cached locally at ${TOKEN_PATH}`);
    } catch (cacheErr: any) {
      console.warn(`[Gmail Auth] Could not write to local cache (non-blocking):`, cacheErr.message);
    }

    // 2. Write to Firestore for durable persistence using Admin SDK if available
    if (dbAdmin) {
      console.log(`[Gmail Auth] Storing token in Firestore via Admin SDK...`);
      await dbAdmin.collection("gmail").doc("config_YengCornerSecret_3bf8d79a29e4").set(tokenData);
    } else {
      console.log(`[Gmail Auth] Falling back to Client SDK to store token...`);
      await setDoc(gmailDocRef, tokenData);
    }
    console.log(`[Gmail Auth] Token stored successfully in Firestore for ${email}`);

    return res.status(200).json({ success: true, email });
  } catch (err: any) {
    console.error("[Gmail Auth] Error storing token:", err);
    return res.status(500).json({ success: false, error: "Could not save Gmail token: " + err.message });
  }
}
