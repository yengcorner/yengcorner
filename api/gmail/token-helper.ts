import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from "firebase-admin/app";
import { getFirestore as getFirestoreAdmin } from "firebase-admin/firestore";

let currentDirname = "";
try {
  const filename = fileURLToPath(import.meta.url);
  currentDirname = path.dirname(filename);
} catch (e) {}

function loadFirebaseConfig(): any {
  const pathsToTry = [
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.resolve(currentDirname, "../../firebase-applet-config.json"),
    path.resolve(currentDirname, "../firebase-applet-config.json"),
    path.resolve("firebase-applet-config.json")
  ];

  for (const p of pathsToTry) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch (e) {}
  }
  throw new Error("Could not find firebase-applet-config.json!");
}

export const firebaseConfig = loadFirebaseConfig();
export const firebaseApp = getClientApps().length === 0 ? initializeClientApp(firebaseConfig) : getClientApp();
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const gmailDocRef = doc(db, "gmail", "settings");

// Initialize Admin SDK ONLY if explicit service account credentials exist
export let dbAdmin: any = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (!getAdminApps().length) {
      initializeAdminApp({
        projectId: firebaseConfig.projectId
      });
    }
    dbAdmin = getFirestoreAdmin(getAdminApp(), firebaseConfig.firestoreDatabaseId);
  } else {
    dbAdmin = null;
  }
} catch (adminErr: any) {
  console.warn("[Gmail Token Helper] Admin SDK initialization skipped/failed:", adminErr.message);
  dbAdmin = null;
}

export const TOKEN_PATH = process.env.VERCEL 
  ? "/tmp/gmail-token.json" 
  : path.join(process.cwd(), "gmail-token.json");

export async function saveGmailConfigToFirestore(data: any): Promise<boolean> {
  // 1. Try Admin SDK if available
  if (dbAdmin) {
    try {
      await dbAdmin.collection("gmail").doc("settings").set(data, { merge: true });
      console.log("[Token Helper] Successfully saved config via Admin SDK");
      return true;
    } catch (err: any) {
      console.warn("[Token Helper] Admin SDK write failed:", err.message);
    }
  }

  // 2. Try REST API with API key (100% reliable server-to-server Firestore write without GCE Metadata dependency)
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const fieldPaths = Object.keys(data).filter(k => data[k] !== undefined).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/gmail/settings?${fieldPaths ? fieldPaths + "&" : ""}key=${firebaseConfig.apiKey}`;

    const fields: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val === null || val === undefined) continue;
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

    if (res.ok) {
      console.log("[Token Helper] Successfully saved config via Firestore REST API");
      return true;
    } else {
      console.warn("[Token Helper] REST API write status:", res.status, await res.text());
    }
  } catch (err: any) {
    console.warn("[Token Helper] REST API write failed:", err.message);
  }

  // 3. Fallback to Client SDK
  try {
    await setDoc(gmailDocRef, data, { merge: true });
    console.log("[Token Helper] Successfully saved config via Client SDK");
    return true;
  } catch (err: any) {
    console.warn("[Token Helper] Client SDK write failed:", err.message);
  }

  return false;
}

export async function fetchGmailConfigFromFirestore(): Promise<any> {
  // Try Admin SDK first
  if (dbAdmin) {
    try {
      const docSnap = await dbAdmin.collection("gmail").doc("settings").get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data && (data.googleSheetsUrl || data.accessToken)) {
          try {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
          } catch (e) {}
          return data;
        }
      }
    } catch (err: any) {
      console.error("[Token Helper] Admin SDK fetch failed:", err.message);
    }
  }

  // REST API fallback
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/gmail/settings?key=${firebaseConfig.apiKey}`;
    const response = await fetch(url);
    if (response.ok) {
      const docObj = await response.json();
      if (docObj && docObj.fields) {
        const result: any = {};
        for (const key of Object.keys(docObj.fields)) {
          const valObj = docObj.fields[key];
          if (valObj.stringValue !== undefined) result[key] = valObj.stringValue;
          else if (valObj.integerValue !== undefined) result[key] = parseInt(valObj.integerValue, 10);
          else if (valObj.doubleValue !== undefined) result[key] = parseFloat(valObj.doubleValue);
          else if (valObj.booleanValue !== undefined) result[key] = valObj.booleanValue;
          else if (valObj.mapValue !== undefined) result[key] = valObj.mapValue;
          else result[key] = valObj;
        }
        if (result.googleSheetsUrl || result.accessToken) {
          try {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(result, null, 2));
          } catch (e) {}
          return result;
        }
      }
    }
  } catch (err: any) {
    console.error("[Token Helper] REST API failed:", err.message);
  }

  // Client SDK fallback
  try {
    const docSnap = await getDoc(gmailDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      try {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
      } catch (e) {}
      return data;
    }
  } catch (err: any) {
    console.error("[Token Helper] Client SDK failed:", err.message);
  }

  // Local cache fallback
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      if (cached && (cached.googleSheetsUrl || cached.accessToken)) {
        return cached;
      }
    } catch (err) {}
  }

  return null;
}

export async function refreshAccessToken(refreshToken: string, existingData: any = {}): Promise<string | null> {
  console.log("[Token Helper] Refreshing Google access token using refresh_token...");
  const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig.projectId;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Token Helper] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Cannot refresh token.");
    return null;
  }

  try {
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      }).toString()
    });

    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        const newAccessToken = refreshData.access_token;
        const updatedAt = new Date().toISOString();

        const updatePayload: any = {
          accessToken: newAccessToken,
          updatedAt: updatedAt
        };

        if (refreshData.refresh_token) {
          updatePayload.refreshToken = refreshData.refresh_token;
        }

        // Save back to Firestore via safe helper
        await saveGmailConfigToFirestore(updatePayload);

        // Update local cache
        try {
          const newCache = {
            ...existingData,
            ...updatePayload
          };
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(newCache, null, 2));
        } catch (e) {}

        console.log("[Token Helper] Google access token refreshed and saved successfully.");
        return newAccessToken;
      }
    } else {
      console.error("[Token Helper] Failed to refresh token. Google API response:", await refreshRes.text());
    }
  } catch (err: any) {
    console.error("[Token Helper] Error during token refresh request:", err.message);
  }

  return null;
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokenData = await fetchGmailConfigFromFirestore();
  if (!tokenData) return null;

  let isExpired = true;
  if (tokenData.accessToken && tokenData.updatedAt) {
    const updatedAtTime = new Date(tokenData.updatedAt).getTime();
    const elapsedMinutes = (Date.now() - updatedAtTime) / (1000 * 60);
    // Refresh if 50 minutes or more have passed
    if (elapsedMinutes < 50) {
      isExpired = false;
    }
  }

  if (isExpired && tokenData.refreshToken) {
    console.log("[Token Helper] Access token is expired or near expiration. Proactively refreshing...");
    const renewedToken = await refreshAccessToken(tokenData.refreshToken, tokenData);
    if (renewedToken) {
      return renewedToken;
    }
  }

  return tokenData.accessToken || null;
}
