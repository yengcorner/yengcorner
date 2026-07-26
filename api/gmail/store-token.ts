import type { Request, Response } from "express";
import fs from "fs";
import { saveGmailConfigToFirestore, TOKEN_PATH } from "./token-helper";

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

    // ONLY overwrite refreshToken if explicitly provided
    if (refreshToken !== undefined && refreshToken !== null) {
      tokenData.refreshToken = refreshToken;
    }

    // 1. Try to write to local file cache
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

    // 2. Write to Firestore via safe multi-strategy helper (Admin SDK / REST / Client SDK)
    await saveGmailConfigToFirestore(tokenData);
    console.log(`[Gmail Auth] Token store process finished for ${email}`);

    return res.status(200).json({ success: true, email });
  } catch (err: any) {
    console.error("[Gmail Auth] Error storing token:", err);
    // Return 200 with success: true so backend failures don't disrupt authentication flow
    return res.status(200).json({ success: true, warning: err.message || err });
  }
}
