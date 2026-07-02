import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import 'dotenv/config';

export default async function handler(req: Request, res: Response) {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
   // Tạm thời sửa chỗ này trong file test.ts
auth: {
  user: 'taphoayeng12@gmail.com',
  pass: 'xsmtpsib-5c454fcf06e8c7b9c3ab15ef70390a897e77f56ac64603ee14f13adaeaf1e103-YVF0pIOJiIGiqjqO', 
},
  });

  try {
    await transporter.sendMail({
      from: '"Yeng corner" <taphoayeng12@gmail.com>',
      to: 'taphoayeng12@gmail.com', 
      subject: 'Test gửi mail từ Yeng VN',
      html: '<h1>Chào bồ!</h1><p>Hệ thống gửi mail đã hoạt động ngon lành.</p>'
    });
    res.status(200).json({ message: 'Gửi mail thành công!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
