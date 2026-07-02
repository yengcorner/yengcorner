// ... các dòng import giữ nguyên

export default async function handler(req: Request, res: Response) {
  // ... phần kiểm tra method giữ nguyên

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
