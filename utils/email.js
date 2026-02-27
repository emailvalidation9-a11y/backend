const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1) Fallback if no email configuration is provided
    if (!process.env.EMAIL_HOST && !process.env.SMTP_HOST) {
        console.warn('⚠️ SMTP Configuration missing. Falling back to console logging for email.');
        console.log(`\n========= DEV EMAIL =========`);
        console.log(`To: ${options.email}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Message: \n${options.message}`);
        console.log(`=============================\n`);
        return;
    }

    // 2) Create a transporter
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    // 2) Define the email options
    const mailOptions = {
        from: `TrueValidator <${process.env.EMAIL_FROM}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html, // Optional HTML version
    };

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
