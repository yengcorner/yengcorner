import nodemailer from 'nodemailer'; 
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { to, subject, html } = req.body; 

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
      user: 'taphoayeng12@gmail.com',
      pass: process.env.SMTP_PASS,
    },
  });
  
    await transporter.sendMail({
      from: '"Yeng Corner" <taphoayeng12o@gmail.com>',
      to: to, // Email của khách lấy từ req.body
      subject: subject, // Tiêu đề lấy từ req.body
      html: html, // Nội dung thư lấy từ req.body
    });
    res.status(200).json({ message: 'Gửi mail thành công!' });
}
