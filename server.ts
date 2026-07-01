import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import * as admin from "firebase-admin";
import { getFirestore as getFirestoreAdmin } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

function convertToSlug(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "") // remove special characters
    .trim()
    .replace(/\s+/g, "-") // replace spaces with hyphens
    .replace(/-+/g, "-"); // remove double hyphens
}

const app = express();
const PORT = 3000;

// Initialize Firebase Client SDK for server-side persistence
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Always use Firebase Client SDK (db) on the server because Admin SDK does not have permission on the custom named database
const dbAdmin: any = null;

const gmailDocRef = doc(db, "gmail", "config_YengCornerSecret_3bf8d79a29e4");

// Middleware to parse JSON payloads
app.use(express.json({ limit: '10mb' }));

  const TOKEN_PATH = path.join(process.cwd(), "gmail-token.json");

  // Endpoint to store Gmail credentials securely on the server
  app.post("/api/gmail/store-token", async (req, res) => {
    const { accessToken, email } = req.body;
    if (!accessToken || !email) {
      return res.status(400).json({ error: "Missing accessToken or email" });
    }

    try {
      // 1. Write to local file cache
      fs.writeFileSync(
        TOKEN_PATH,
        JSON.stringify({
          accessToken,
          email,
          updatedAt: new Date().toISOString(),
        }, null, 2)
      );

      // 2. Write to Firestore for durable persistence across restarts and rebuilds
      try {
        await setDoc(gmailDocRef, {
          accessToken,
          email,
          updatedAt: new Date().toISOString(),
        });
        console.log(`[Gmail Auth] Token stored successfully in Firestore for ${email}`);
      } catch (fsErr: any) {
        console.warn(`[Gmail Auth] Firestore write failed (falling back to local file cache):`, fsErr.message);
      }

      console.log(`[Gmail Auth] Token stored successfully in local file for ${email}`);
      res.json({ success: true, email });
    } catch (err: any) {
      console.error("[Gmail Auth] Error storing token in local file:", err);
      res.status(500).json({ error: "Could not save Gmail token: " + err.message });
    }
  });

  // Endpoint to clear stored Gmail credentials
  app.post("/api/gmail/clear-token", async (req, res) => {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
      }
      // Delete from Firestore too
      try {
        await deleteDoc(gmailDocRef);
      } catch (fsErr: any) {
        console.warn(`[Gmail Auth] Firestore delete failed:`, fsErr.message);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint to retrieve active Gmail connection status
  app.get("/api/gmail/status", async (req, res) => {
    try {
      // 1. Try reading from local file cache
      if (fs.existsSync(TOKEN_PATH)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
        return res.json({
          connected: true,
          email: data.email,
          updatedAt: data.updatedAt,
        });
      }

      // 2. If missing on local disk, check Firestore
      try {
        const docSnap = await getDoc(gmailDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Write back to local cache
          fs.writeFileSync(
            TOKEN_PATH,
            JSON.stringify(data, null, 2)
          );
          return res.json({
            connected: true,
            email: data?.email,
            updatedAt: data?.updatedAt,
          });
        }
      } catch (fsErr: any) {
        console.warn(`[Gmail Auth] Firestore get failed:`, fsErr.message);
      }

      res.json({ connected: false, email: null, updatedAt: null });
    } catch (err) {
      res.json({ connected: false, email: null, updatedAt: null });
    }
  });

  // Secure API endpoint to send emails using stored Gmail token
  app.post("/api/gmail/send", async (req, res) => {
    const { to, subject, bodyHtml } = req.body;

    if (!to || !subject || !bodyHtml) {
      return res.status(400).json({ error: "Thiếu thông tin người nhận, tiêu đề hoặc nội dung email." });
    }

    let tokenData;

    // 1. Try reading local file cache
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      } catch (err: any) {
        console.error("Could not parse local gmail token:", err);
      }
    }

    // 2. If not found in local file, restore from Firestore automatically
    if (!tokenData) {
      try {
        const docSnap = await getDoc(gmailDocRef);
        if (docSnap.exists()) {
          tokenData = docSnap.data();
          // Cache it locally on disk
          fs.writeFileSync(
            TOKEN_PATH,
            JSON.stringify(tokenData, null, 2)
          );
          console.log(`[Gmail Send] Restored Gmail token for ${tokenData.email} from Firestore`);
        }
      } catch (err: any) {
        console.error("Error loading Gmail token from Firestore (relying on local cache fallback):", err.message);
      }
    }

    if (!tokenData) {
      return res.status(400).json({
        error: "Cửa hàng chưa liên kết Gmail. Vui lòng truy cập trang Admin mục \"GMAIL CENTER\" để kết nối."
      });
    }

    const { accessToken, email: senderEmail } = tokenData;

    try {
      // Construct MIME message with UTF-8
      const subjectEncoded = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
      const rawParts = [
        `From: "Yeng Corner" <${senderEmail}>`,
        `To: ${to}`,
        `Subject: ${subjectEncoded}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        "",
        bodyHtml
      ];
      const raw = rawParts.join("\r\n");
      const base64Safe = Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      console.log(`[Gmail Send] Attempting to send email to ${to} using token of ${senderEmail}`);

      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: base64Safe }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Gmail Send] Google API error response:", errorText);

        if (response.status === 401) {
          return res.status(401).json({
            error: "Phiên kết nối Gmail đã hết hạn (401 Unauthorized). Vui lòng đăng nhập lại Gmail Center ở trang Admin."
          });
        }

        let errorMsg = `Google API trả về lỗi ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error && parsed.error.message) {
            errorMsg = parsed.error.message;
          }
        } catch (e) {}

        return res.status(response.status).json({
          error: `Lỗi từ Google Mail API: ${errorMsg}`
        });
      }

      const resultData = await response.json();
      console.log(`[Gmail Send] Email sent successfully to ${to}, Message ID: ${resultData.id}`);
      res.json({ success: true, messageId: resultData.id });
    } catch (error: any) {
      console.error("[Gmail Send] Server error during Gmail send:", error);
      res.status(500).json({
        error: `Lỗi hệ thống khi gửi email: ${error.message || error}`
      });
    }
  });

  // GET subscription groups list
  app.get("/api/subscribers/groups", async (req, res) => {
    try {
      const docRef = doc(db, "config", "subscription_groups");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.groups)) {
          return res.json({ groups: data.groups });
        }
      }
      // Default initial list
      const defaultGroups = ["BLACKPINK", "AESPA", "NCT WISH", "NewJeans", "ILLIT", "AMEE", "BABYMONSTER", "IVE", "TWICE", "BTS"];
      // Auto seed it on firestore if not exists
      await setDoc(docRef, { groups: defaultGroups });
      res.json({ groups: defaultGroups });
    } catch (err: any) {
      console.error("[Get Groups] Error:", err);
      res.status(500).json({ error: "Lỗi hệ thống khi tải danh sách nhóm nhạc: " + err.message });
    }
  });

  // POST update subscription groups list
  app.post("/api/subscribers/groups", async (req, res) => {
    const { groups } = req.body;
    if (!Array.isArray(groups)) {
      return res.status(400).json({ error: "Danh sách nhóm nhạc không hợp lệ." });
    }
    
    // Clean and validate
    const cleanGroups = groups
      .map(g => (typeof g === 'string' ? g.trim() : ''))
      .filter(g => g.length > 0);

    try {
      await setDoc(doc(db, "config", "subscription_groups"), { groups: cleanGroups });
      res.json({ success: true, groups: cleanGroups });
    } catch (err: any) {
      console.error("[Save Groups] Error:", err);
      res.status(500).json({ error: "Lỗi hệ thống khi lưu danh sách nhóm nhạc: " + err.message });
    }
  });

  // API endpoint for customers to subscribe for new product notifications
  app.post("/api/subscribers/register", async (req, res) => {
    const { email, groups } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email không hợp lệ." });
    }
    const cleanEmail = email.trim().toLowerCase();
    
    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Định dạng email không chính xác." });
    }

    const cleanGroups = Array.isArray(groups)
      ? groups.map(g => (typeof g === 'string' ? g.trim() : '')).filter(g => g.length > 0)
      : [];

    try {
      if (dbAdmin) {
        await dbAdmin.collection("subscriber_emails").doc(cleanEmail).set({
          email: cleanEmail,
          groups: cleanGroups,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        await dbAdmin.collection("subscribers").doc(cleanEmail).set({
          email: cleanEmail,
          groups: cleanGroups,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`[Subscriber Register] Registered ${cleanEmail} via Admin SDK in both collections.`);
      } else {
        const docRefEmails = doc(db, "subscriber_emails", cleanEmail);
        await setDoc(docRefEmails, {
          email: cleanEmail,
          groups: cleanGroups,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        const docRefSubscribers = doc(db, "subscribers", cleanEmail);
        await setDoc(docRefSubscribers, {
          email: cleanEmail,
          groups: cleanGroups,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`[Subscriber Register] Registered ${cleanEmail} via Client SDK in both collections.`);
      }

      res.json({ success: true, message: "Đăng ký nhận thông báo sản phẩm mới thành công!" });
    } catch (err: any) {
      console.error("[Subscriber Register] Error:", err);
      res.status(500).json({ error: "Lỗi hệ thống khi lưu đăng ký: " + err.message });
    }
  });

  // GET endpoint for customer unsubscription
  app.get("/unsubscribe", async (req, res) => {
    const email = req.query.email;
    if (!email || typeof email !== "string") {
      return res.status(400).send("<h1>Lỗi</h1><p>Email không hợp lệ.</p>");
    }
    const cleanEmail = email.trim().toLowerCase();
    try {
      await deleteDoc(doc(db, "subscriber_emails", cleanEmail));
      await deleteDoc(doc(db, "subscribers", cleanEmail));
      console.log(`[Unsubscribe] Unsubscribed ${cleanEmail} successfully.`);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Hủy nhận thông báo - Yeng Corner</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f7f9fc; color: #2d3748; text-align: center; padding: 50px 20px; margin: 0; }
            .card { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            h1 { color: #1e40af; font-size: 24px; margin-bottom: 10px; }
            p { font-size: 15px; line-height: 1.6; color: #4a5568; margin-bottom: 25px; }
            .btn { background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; transition: background-color 0.2s; }
            .btn:hover { background-color: #1e3a8a; }
            .footer { margin-top: 30px; font-size: 12px; color: #a0aec0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="font-size: 48px; margin-bottom: 20px;">👋</div>
            <h1>Đã hủy đăng ký thành công</h1>
            <p>Email <strong>${cleanEmail}</strong> đã được xóa khỏi hệ thống nhận thông tin từ Yeng Corner. Bạn sẽ không nhận được thông báo về các sản phẩm mới nữa.</p>
            <a href="/" class="btn">Quay lại trang chủ</a>
          </div>
          <div class="footer">© 2026 Yeng Corner. All rights reserved.</div>
        </body>
        </html>
      `);
    } catch (err: any) {
      console.error("[Unsubscribe] Error:", err.message);
      res.status(500).send("<h1>Lỗi</h1><p>Có lỗi xảy ra khi hủy nhận thông báo. Vui lòng thử lại sau.</p>");
    }
  });

  // API endpoint to notify all subscribers when a new product is added
  app.post("/api/subscribers/notify-new-product", async (req, res) => {
    const { product, emails } = req.body;
    if (!product || !product.id || !product.name) {
      return res.status(400).json({ error: "Thông tin sản phẩm không hợp lệ." });
    }

    let finalEmails = emails;

    // Fetch subscribers securely from Admin SDK or Client SDK if finalEmails is empty
    if (!Array.isArray(finalEmails) || finalEmails.length === 0) {
      try {
        const list: string[] = [];

        if (dbAdmin) {
          const subscribersSnap = await dbAdmin.collection("subscriber_emails").get();
          subscribersSnap.forEach((docSnap: any) => {
            const data = docSnap.data();
            if (data && data.email) {
              list.push(data.email);
            }
          });
          console.log(`[Admin Secure Query] Fetched all ${list.length} subscribers on server side.`);
        } else {
          const subscribersSnap = await getDocs(collection(db, "subscriber_emails"));
          subscribersSnap.forEach((docSnap: any) => {
            const data = docSnap.data();
            if (data && data.email) {
              list.push(data.email);
            }
          });
          console.log(`[Client Query] Fetched all ${list.length} subscribers from Firestore.`);
        }
        finalEmails = list;
      } catch (err: any) {
        console.error("Error fetching subscribers on server side:", err.message);
      }
    }

    if (!Array.isArray(finalEmails) || finalEmails.length === 0) {
      return res.json({ success: true, sentCount: 0, message: "Không có khách hàng nào đăng ký nhận tin." });
    }

    let tokenData;

    // 1. Try reading local file cache
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      } catch (err: any) {
        console.error("Could not parse local gmail token:", err);
      }
    }

    // 2. If not found in local file, restore from Firestore automatically
    if (!tokenData) {
      try {
        const docSnap = await getDoc(gmailDocRef);
        if (docSnap.exists()) {
          tokenData = docSnap.data();
          fs.writeFileSync(
            TOKEN_PATH,
            JSON.stringify(tokenData, null, 2)
          );
        }
      } catch (err: any) {
        console.error("Error loading Gmail token from Firestore:", err.message);
      }
    }

    if (!tokenData) {
      return res.status(400).json({
        error: "Cửa hàng chưa liên kết Gmail. Vui lòng truy cập trang Admin mục \"GMAIL CENTER\" để kết nối."
      });
    }

    const { accessToken, email: senderEmail } = tokenData;

    try {
      // 2. Format product link
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.get("host");
      const productSlug = convertToSlug(product.name) || String(product.id);
      const productLink = `${protocol}://${host}/product/${productSlug}`;

      // 3. Format email body
      const priceFormatted = Number(product.price).toLocaleString("vi-VN") + " đ";
      const artistName = (product.artist || "Yeng Corner").trim();
      const subject = `[Yeng Corner] 📢 THÔNG BÁO: Siêu phẩm mới của ${artistName} vừa cập bến!`;
      const subjectEncoded = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;

      let optionsHtml = "";
      if (product.variations && product.variations.length > 0) {
        optionsHtml = `
          <div style="margin-top: 15px; padding: 12px; background-color: #e8f0ff; border: 1px solid #b3d1ff; border-radius: 8px;">
            <strong style="color: #1e3a8a; font-size: 13px; display: block; margin-bottom: 6px;">🎁 Các phân loại khả dụng:</strong>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #4a5568; line-height: 1.5;">
              ${product.variations.map((v: any) => `<li>${v.name} - <strong style="color: #2563eb;">${Number(v.price).toLocaleString("vi-VN")} đ</strong></li>`).join("")}
            </ul>
          </div>
        `;
      } else if (product.versions && product.versions.length > 0) {
        optionsHtml = `
          <div style="margin-top: 15px; padding: 12px; background-color: #e8f0ff; border: 1px solid #b3d1ff; border-radius: 8px;">
            <strong style="color: #1e3a8a; font-size: 13px; display: block; margin-bottom: 6px;">🎁 Các phiên bản:</strong>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #4a5568; line-height: 1.5;">
              ${product.versions.map((ver: string) => `<li>${ver}</li>`).join("")}
            </ul>
          </div>
        `;
      }

      const rawTemplate = `
<div style="background-color: #e8f0ff; padding: 30px 15px; font-family: 'Segoe UI', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #b3d1ff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
    <!-- Content Body -->
    <div style="padding: 35px 30px; color: #2d3748; line-height: 1.7;">
      <p style="font-size: 16px; margin-top: 0; font-weight: 600; color: #1e3a8a;">Chào các bạn,</p>
      <p style="font-size: 14.5px; color: #4a5568;">Yeng corner xin thông báo về sản phẩm mới vừa mở bán tại shop và đang chờ các bạn đặt hàng sớm đây!</p>
      
      <!-- Product Showcase Block -->
      <div style="background-color: #f5f9ff; border-left: 5px solid #2563eb; padding: 22px; margin: 25px 0; border-radius: 4px 12px 12px 4px; border-top: 1px solid #e1ecfe; border-right: 1px solid #e1ecfe; border-bottom: 1px solid #e1ecfe;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <!-- Product Image -->
            <td style="width: 38%; vertical-align: top; padding-right: 18px;">
              <img src="{ANH_SAN_PHAM}" alt="{TEN_SAN_PHAM}" style="width: 100%; border-radius: 10px; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: block;">
            </td>
            <!-- Product Specs -->
            <td style="width: 62%; vertical-align: top;">
              <h3 style="margin: 0 0 10px 0; font-size: 17px; color: #1e3a8a; font-weight: 700; line-height: 1.4;">{TEN_SAN_PHAM}</h3>
              <p style="margin: 0 0 12px 0; font-size: 16px; color: #2563eb; font-weight: bold;">Giá: {GIA_SAN_PHAM}</p>
              <p style="margin: 0; font-size: 13px; color: #4a5568; line-height: 1.5;">
                {MO_TA_NGAN}
              </p>
              {HIEN_THI_PHAN_LOAI}
            </td>
          </tr>
        </table>
      </div>

      <!-- Call To Action Button -->
      <div style="text-align: center; margin: 35px 0 20px 0;">
        <a href="{LINK_SAN_PHAM}" style="background-color: #2563eb; color: #ffffff; padding: 14px 40px; text-decoration: none; font-size: 15px; font-weight: bold; border-radius: 30px; display: inline-block; box-shadow: 0 6px 18px rgba(37,99,235,0.2); transition: all 0.2s ease-in-out; letter-spacing: 0.5px;">
          Xem Chi Tiết & Đặt Hàng Ngay ✨
        </a>
      </div>
    </div>

    <!-- Footer block with notice -->
    <div style="background-color: #f0f5ff; padding: 25px; text-align: center; font-size: 12px; color: #4a5568; border-top: 1px solid #e1ecfe; line-height: 1.6;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #b91c1c; background-color: #fef2f2; padding: 8px; border-radius: 6px; display: inline-block; border: 1px solid #fee2e2;">
        ⚠️ Đây là thư một chiều. Vui lòng không trả lời thư này! Nếu khách muốn thay đổi thông tin cá nhân, hãy liên hệ qua facebook của shop!
      </p>
      <p style="margin: 0 0 4px 0; font-size: 11px;">Bạn nhận được thư điện tử này vì đã đăng ký nhận thông tin từ nhóm nhạc ${artistName} tại Yeng Corner.</p>
      <p style="margin: 0 0 8px 0; font-size: 11px; font-style: italic;">
        Nếu bạn không muốn tiếp tục nhận các thông báo này, bạn có thể <a href="{LINK_HUY_DANG_KY}" style="color: #2563eb; text-decoration: underline;">Hủy nhận thông báo</a> bất cứ lúc nào.
      </p>
      <p style="margin: 0; font-weight: 600; color: #1e3a8a;">© 2026 Yeng Corner. All rights reserved.</p>
    </div>
  </div>
</div>
`;

      const bodyHtml = rawTemplate
        .replace(/{TEN_SAN_PHAM}/g, product.name || "")
        .replace(/{ANH_SAN_PHAM}/g, product.image || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80")
        .replace(/{GIA_SAN_PHAM}/g, priceFormatted)
        .replace(/{MO_TA_NGAN}/g, product.info || "Sản phẩm chính hãng chất lượng cao tại Yeng Corner.")
        .replace(/{HIEN_THI_PHAN_LOAI}/g, optionsHtml)
        .replace(/{LINK_SAN_PHAM}/g, productLink);

      let sentCount = 0;
      let failCount = 0;

      // Send to all subscribers via Google Mail API
      for (const toEmail of finalEmails) {
        try {
          const unsubscribeLink = `${protocol}://${host}/unsubscribe?email=${encodeURIComponent(toEmail)}`;
          const personalizedHtml = bodyHtml.replace(/{LINK_HUY_DANG_KY}/g, unsubscribeLink);

          const rawParts = [
            `From: "Yeng Corner" <${senderEmail}>`,
            `To: ${toEmail}`,
            `Subject: ${subjectEncoded}`,
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=utf-8",
            "",
            personalizedHtml
          ];
          const raw = rawParts.join("\r\n");
          const base64Safe = Buffer.from(raw)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const googleRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: base64Safe }),
          });

          if (googleRes.ok) {
            sentCount++;
          } else {
            const errText = await googleRes.text();
            console.error(`[Notify New Product] Failed to send to ${toEmail}:`, errText);
            failCount++;
          }
        } catch (e: any) {
          console.error(`[Notify New Product] Error sending to ${toEmail}:`, e.message);
          failCount++;
        }
      }

      console.log(`[Notify New Product] Finished sending notification: ${sentCount} sent, ${failCount} failed.`);
      res.json({ success: true, sentCount, failCount, totalSubscribers: emails.length });
    } catch (err: any) {
      console.error("[Notify New Product] General Error:", err);
      res.status(500).json({ error: "Lỗi hệ thống khi gửi email thông báo: " + err.message });
    }
  });

  // API endpoint for sending emails using Admin's Gmail SMTP configuration
  app.post("/api/send-email", async (req, res) => {
    const { senderEmail, appPassword, to, subject, bodyHtml } = req.body;

    if (!senderEmail || !appPassword || !to || !subject || !bodyHtml) {
      return res.status(400).json({ 
        error: "Thiếu thông tin cấu hình hoặc nội dung gửi email." 
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: senderEmail,
          pass: appPassword,
        },
      });

      const mailOptions = {
        from: `"YENG CORNER" <${senderEmail}>`,
        to,
        subject,
        html: bodyHtml,
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error sending email via Gmail SMTP:", error);
      res.status(500).json({ 
        error: error.message || "Không thể gửi email. Vui lòng kiểm tra lại cấu hình." 
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
    }).catch((err) => {
      console.error("Vite server error:", err);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Serve static files with specific caching rules
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // Compiled assets are fully hashed by Vite, so they are safe to cache aggressively
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    app.get('*', (req, res) => {
      // Force no-cache for index.html served on SPA fallback routes
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
