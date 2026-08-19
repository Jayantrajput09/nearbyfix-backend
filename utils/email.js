const { Resend } = require("resend");

let resendClient = null;

const createResendClient = () => {
  if (resendClient) {
    return resendClient;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "RESEND_API_KEY missing. Email notifications disabled."
    );

    return null;
  }

  resendClient = new Resend(
    process.env.RESEND_API_KEY
  );

  return resendClient;
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
}) => {
  try {
    const resend = createResendClient();

    if (!resend) {
      return {
        success: false,
        skipped: true,
        error:
          "RESEND_API_KEY is not configured",
      };
    }

    if (!to) {
      return {
        success: false,
        error: "Recipient email is required",
      };
    }

    // =========================================
    // SENDER EMAIL
    // =========================================
    //
    // For testing, use the email address
    // provided/allowed by your Resend setup.
    //
    // Later, when you verify your own domain,
    // change RESEND_FROM_EMAIL in Render.
    //

    const from =
      process.env.RESEND_FROM_EMAIL ||
      "NearbyFix <onboarding@resend.dev>";

    console.log(
      "SENDING EMAIL WITH RESEND"
    );

    console.log("TO:", to);
    console.log("FROM:", from);
    console.log("SUBJECT:", subject);

    const { data, error } =
      await resend.emails.send({
        from,
        to,
        subject,
        text,
        html,
      });

    if (error) {
      console.error(
        "RESEND EMAIL ERROR:",
        error
      );

      return {
        success: false,
        error:
          error.message ||
          "Resend failed to send email",
      };
    }

    console.log(
      "EMAIL SENT SUCCESSFULLY:",
      data
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error(
      "EMAIL SEND ERROR:",
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