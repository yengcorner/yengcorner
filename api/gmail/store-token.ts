import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const gmailDocRef = doc(
  db,
  "gmail",
  "config_YengCornerSecret_3bf8d79a29e4"
);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { accessToken, email } = req.body;

  if (!accessToken || !email) {
    return res.status(400).json({
      error: "Missing accessToken or email",
    });
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
    await setDoc(gmailDocRef, {
    const { accessToken, email, refreshToken } = req.body;
    if (!accessToken || !email) {
      return res.status(400).json({ success: false, error: "Missing accessToken or email" });
    }

    const tokenData = {
accessToken,
email,
      refreshToken: refreshToken || null,
updatedAt: new Date().toISOString(),
    });
    };

    return res.json({
      success: true,
      email,
    });
    // 1. Try to write to local file cache (non-blocking)
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
      console.log(`[Gmail Auth] Token cached locally at ${TOKEN_PATH}`);
    } catch (cacheErr: any) {
      console.warn(`[Gmail Auth] Could not write to local cache (non-blocking):`, cacheErr.message);
    }

    // 2. Write to Firestore for durable persistence
    await setDoc(gmailDocRef, tokenData);
    console.log(`[Gmail Auth] Token stored successfully in Firestore for ${email}`);

    return res.status(200).json({ success: true, email });
} catch (err: any) {
  console.error(err);

  return res.status(500).json({
    error: err?.message,
    stack: err?.stack,
    name: err?.name,
  });
  }}
    console.error("[Gmail Auth] Error storing token:", err);
    return res.status(500).json({ success: false, error: "Could not save Gmail token: " + err.message });
  }
}
