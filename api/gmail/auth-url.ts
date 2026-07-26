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
    const { redirectUri } = req.query;
    if (!redirectUri) {
      return res.status(400).json({ error: "Missing redirectUri" });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig.projectId;
    if (!clientId) {
      return res.status(400).json({ error: "GOOGLE_CLIENT_ID is not configured in environment" });
    }

    const oauthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.modify"
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri as string,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: redirectUri as string
    });

    return res.json({ url: `${oauthUrl}?${params.toString()}` });
  } catch (err: any) {
    console.error("[Gmail Auth URL] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
