import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import * as admin from "firebase-admin";
import { getFirestore as getFirestoreAdmin } from "firebase-admin/firestore";
import storeTokenHandler from "./api/gmail/store-token";
import clearTokenHandler from "./api/gmail/clear-token";
import sendHandler from "./api/gmail/send";

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")
);

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

  const TOKEN_PATH = process.env.VERCEL 
    ? "/tmp/gmail-token.json" 
    : path.join(process.cwd(), "gmail-token.json");

  // Endpoint to store Gmail credentials securely on the server
  app.post("/api/gmail/store-token", storeTokenHandler);

  // Endpoint to clear stored Gmail credentials
  app.post("/api/gmail/clear-token", clearTokenHandler);

  // Endpoint to retrieve active Gmail connection status
  app.get("/api/gmail/status", async (req, res) => {
    try {
      // 1. Try reading from local file cache
      try {
        if (fs.existsSync(TOKEN_PATH)) {
          const data = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
          return res.json({
            connected: true,
            email: data.email,
            updatedAt: data.updatedAt,
          });
        }
      } catch (cacheErr: any) {
        console.warn(`[Gmail Auth] Local cache read failed (non-blocking):`, cacheErr.message);
      }

      // 2. If missing on local disk, check Firestore
      try {
        const docSnap = await getDoc(gmailDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Write back to local cache
          try {
            fs.writeFileSync(
              TOKEN_PATH,
              JSON.stringify(data, null, 2)
            );
          } catch (cacheErr: any) {
            console.warn(`[Gmail Auth] Failed to write back to cache (non-blocking):`, cacheErr.message);
          }
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
  app.post("/api/orders/notify-new", async (req, res) => {
    const { order } = req.body;
    if (!order || !order.id) {
      return res.status(400).json({ error: "Thông tin đơn hàng không hợp lệ." });
    }

    // Immediately respond to the client to make it completely non-blocking
    res.json({ success: true, message: "Thông báo đang được gửi ngầm." });

    // Execute background sending asynchronously
    (async () => {
      try {
        console.log(`[Order Background Notify] Starting background notify for order #${order.id}`);
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
              try {
                fs.writeFileSync(
                  TOKEN_PATH,
                  JSON.stringify(tokenData, null, 2)
                );
              } catch (writeErr: any) {
                console.warn("Could not cache token to disk:", writeErr.message);
              }
            }
          } catch (err: any) {
            console.error("Error loading Gmail token from Firestore:", err.message);
          }
        }

        if (!tokenData) {
          console.warn(`[Order Background Notify] No Gmail token connected in database/cache. Skipping background mail.`);
          return;
        }

        const { accessToken, email: senderEmail } = tokenData;

        // Detail the ordered items for the notification mail
        const itemsDetail = (order.items ?? []).map((item: any) => 
          `- <strong>${item.product?.name || 'Sản phẩm'}</strong> (Phân loại: <em>${item.version || '—'}</em>) x${item.quantity}`
        ).join("<br/>");

        const subtotalFormatted = Number(order.subtotal || 0).toLocaleString("vi-VN") + " đ";
        const customerName = order.shipping?.receiverName || "Khách hàng";
        const phone = order.shipping?.phone || "Chưa có SĐT";
        const address = order.shipping?.address || "Chưa có địa chỉ";
        const email = order.contact?.email || "Chưa có email";
        const snsLink = order.contact?.snsLink || "Không có";
        const note = order.note || "Không có";

        const subject = `[Yeng Corner] 🚨 CÓ ĐƠN HÀNG MỚI CHỜ DUYỆT #${order.id}`;
        const subjectEncoded = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;

        const notificationHtml = `
<div style="background-color: #f8fafc; padding: 30px 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #334155;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
    <div style="background-color: #1e3a8a; padding: 25px 20px; text-align: center; color: #ffffff;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; uppercase tracking-wider;">🚨 BÁO CÁO ĐƠN HÀNG MỚI</h2>
      <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Đơn hàng #${order.id} vừa được đặt trên website và đang chờ bạn duyệt!</p>
    </div>
    
    <div style="padding: 30px; line-height: 1.6;">
      <h3 style="margin-top: 0; color: #1e3a8a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; font-size: 15px;">👤 THÔNG TIN KHÁCH HÀNG</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; width: 140px;">Họ tên:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${customerName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Số điện thoại:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${phone}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Email:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${email}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Mạng xã hội (SNS):</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${snsLink}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Địa chỉ nhận hàng:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${address}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Ghi chú:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #b91c1c;">${note}</td>
        </tr>
      </table>

      <h3 style="color: #1e3a8a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; font-size: 15px;">📦 CHI TIẾT SẢN PHẨM</h3>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; font-size: 13.5px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        ${itemsDetail}
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 15px;">
        <tr>
          <td style="color: #64748b; font-weight: 500;">TỔNG GIÁ TRỊ ĐƠN HÀNG:</td>
          <td style="text-align: right; font-weight: 700; color: #1e3a8a; font-size: 16px;">${subtotalFormatted}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: 500; padding-top: 5px;">HÌNH THỨC THANH TOÁN:</td>
          <td style="text-align: right; font-weight: 700; color: #0f766e; padding-top: 5px;">${order.payment?.method === '50%' ? "Đặt cọc 50%" : "Thanh toán 100%"}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 30px;">
        <a href="https://${req.get("host") || "yengcorner.vercel.app"}/admin" style="background-color: #1e3a8a; color: #ffffff; padding: 12px 30px; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(30,58,138,0.15);">
          Truy cập trang Admin để Duyệt Đơn ⚡
        </a>
      </div>
    </div>
    
    <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
      Đây là email thông báo tự động từ hệ thống website Yeng Corner.
    </div>
  </div>
</div>
        `;

        const rawParts = [
          `From: "Yeng Corner Bot" <${senderEmail}>`,
          `To: ${senderEmail}`, // Send to the admin's email itself
          `Subject: ${subjectEncoded}`,
          "MIME-Version: 1.0",
          "Content-Type: text/html; charset=utf-8",
          "",
          notificationHtml
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
          console.log(`[Order Background Notify] Email successfully sent to admin ${senderEmail}`);
        } else {
          const errText = await googleRes.text();
          console.error(`[Order Background Notify] Google API response error:`, errText);
        }
      } catch (bgErr: any) {
        console.error(`[Order Background Notify] Exception during background notify:`, bgErr.message);
      }
    })();
  });

  // Secure API endpoint to send emails using stored Gmail token
  app.post("/api/gmail/send", sendHandler);

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
    try {
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
      res.json({ success: true, sentCount, failCount, totalSubscribers: (emails || []).length });
    } catch (err: any) {
      console.error("[Notify New Product] General Error:", err);
      res.status(500).json({ success: false, error: "Lỗi hệ thống khi gửi email thông báo: " + err.message });
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
