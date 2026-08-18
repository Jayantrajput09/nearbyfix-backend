const nodemailer = require("nodemailer");

let transporter = null;

const createTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "EMAIL_USER or EMAIL_PASS missing. Email notifications disabled."
    );

    return null;
  }

  transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const mailer = createTransporter();

    if (!mailer) {
      return {
        success: false,
        skipped: true,
        error: "Email transporter is not configured",
      };
    }

    await mailer.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"NearbyFix" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("EMAIL SENT SUCCESSFULLY:", to);

    return {
      success: true,
    };
  } catch (error) {
    console.error("EMAIL SEND ERROR:", error);

    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendEmail,
};