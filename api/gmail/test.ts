import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import 'dotenv/config';

export default async function handler(req: Request, res: Response) {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
  user: 'taphoayeng12@gmail.com',
  pass: process.env.SMTP_PASS, // Đảm bảo ghi y hệt thế này
},
  });

  try {
    await transporter.sendMail({
      from: '"Yeng VN" <taphoayeng12o@gmail.com>',
      to: 'taphoayeng12o@gmail.com', // Điền email của bồ vào đây để nhận test
      subject: 'Test gửi mail từ Yeng VN',
      html: '<h1>Chào bồ!</h1><p>Hệ thống gửi mail đã hoạt động ngon lành.</p>'
    });
    res.status(200).json({ message: 'Gửi mail thành công!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
