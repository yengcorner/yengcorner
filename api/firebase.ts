import { initializeApp } from "firebase/app";
import { getFirestore, doc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const firebaseApp = initializeApp(firebaseConfig);

export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId
);

export const gmailDocRef = doc(
  db,
  "gmail",
  "settings"
);
