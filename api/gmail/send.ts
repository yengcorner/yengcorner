import { Resend } from 'resend'; 
import { Request, Response } from 'express';

// Khởi tạo Resend với API Key đã cấu hình trên Vercel
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { to, subject, html } = req.body; 

  try {
    // Thay thế toàn bộ cụm Nodemailer bằng hàm send của Resend
    await resend.emails.send({
      from: 'onboarding@resend.dev', // Giai đoạn test bắt buộc phải giữ nguyên mail mặc định này của Resend
      to: to,                         // Email của khách lấy động từ trang admin truyền sang
      subject: subject,               // Tiêu đề mail lấy từ trang admin
      html: html,                     // Nội dung chi tiết đơn hàng lấy từ trang admin
    });

    // Trả về phản hồi thành công giống hệt code cũ cho admin nhận biết
    return res.status(200).json({ message: 'Gửi mail thành công!' });
    
  } catch (err: any) {
    // Nếu có lỗi phát sinh trong quá trình gửi, trả về lỗi 500 để check
    return res.status(500).json({ error: err.message });
  }
}
