const { BrevoClient } = require("@getbrevo/brevo");

let brevoClient = null;

const createBrevoClient = () => {
  if (brevoClient) {
    return brevoClient;
  }

  if (!process.env.BREVO_API_KEY) {
    console.warn(
      "BREVO_API_KEY missing. Email notifications disabled."
    );

    return null;
  }

  brevoClient = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
    timeoutInSeconds: 30,
    maxRetries: 2,
  });

  return brevoClient;
};

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

    const brevo = createBrevoClient();

    if (!brevo) {
      return {
        success: false,
        skipped: true,
        error: "BREVO_API_KEY is not configured",
      };
    }

    const senderEmail =
      process.env.EMAIL_FROM_EMAIL;

    const senderName =
      process.env.EMAIL_FROM_NAME ||
      "NearbyFix";

    if (!senderEmail) {
      return {
        success: false,
        error: "EMAIL_FROM_EMAIL is not configured",
      };
    }

    console.log("====================================");
    console.log("SENDING EMAIL WITH BREVO API");
    console.log("TO:", to);
    console.log(
      "FROM:",
      `${senderName} <${senderEmail}>`
    );
    console.log("SUBJECT:", subject);
    console.log("====================================");

    const result =
      await brevo.transactionalEmails.sendTransacEmail({
        sender: {
          name: senderName,
          email: senderEmail,
        },

        to: [
          {
            email: to,
          },
        ],

        subject,

        textContent: text,

        htmlContent:
          html || `<p>${text}</p>`,
      });

    console.log(
      "BREVO EMAIL SENT SUCCESSFULLY:"
    );

    console.log(result);

    return {
      success: true,
      data: result,
    };

  } catch (error) {
    console.error(
      "BREVO API EMAIL ERROR:",
      error
    );

    return {
      success: false,
      error:
        error?.message ||
        "Brevo failed to send email",
    };
  }
};

module.exports = {
  sendEmail,
};