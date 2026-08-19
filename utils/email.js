const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.BREVO_SMTP_LOGIN,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

const sendEmail = async ({
  to,
  subject,
  text,
  html,
}) => {
  try {
    if (!to) {
      return {
        success: false,
        error: "Recipient email is required",
      };
    }

    if (
      !process.env.BREVO_SMTP_LOGIN ||
      !process.env.BREVO_SMTP_KEY
    ) {
      console.error(
        "BREVO SMTP credentials missing"
      );

      return {
        success: false,
        error: "Brevo SMTP credentials are missing",
      };
    }

    const from =
      process.env.EMAIL_FROM ||
      "NearbyFix <jr9691522@gmail.com>";

    console.log("=================================");
    console.log("SENDING EMAIL WITH BREVO");
    console.log("TO:", to);
    console.log("FROM:", from);
    console.log("SUBJECT:", subject);
    console.log("=================================");

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    console.log(
      "EMAIL SENT SUCCESSFULLY:",
      info.messageId
    );

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(
      "BREVO EMAIL ERROR:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendEmail,
};