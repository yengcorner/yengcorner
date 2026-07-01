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
  }

  try {
    await setDoc(gmailDocRef, {
      accessToken,
      email,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      success: true,
      email,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
    });
  }
}
