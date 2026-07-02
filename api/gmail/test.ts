import { Request, Response } from 'express';
import { Resend } from 'resend';
import 'dotenv/config';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: Request, res: Response) {
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'taphoayeng12@gmail.com',  
      subject: 'Có đơn hàng mới test nè bồ!',
      html: '<strong>Hệ thống Resend đã chạy ngon lành cành đào rồi nhé!</strong>'
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev', 
      to: 'taphoayeng12@gmail.com', 
      subject: 'Test gửi mail từ Yeng VN via Resend',
      html: '<h1>Chào bồ!</h1><p>Hệ thống gửi mail qua Resend đã hoạt động ngon lành cành đào.</p>'
    });

    res.status(200).json({ message: 'Gửi mail thành công!', data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
