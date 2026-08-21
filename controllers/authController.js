const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");
const { sendEmail } = require("../utils/email");
// =====================================
// REGISTER
// =====================================

const register = async (req, res) => {
  try {
    console.log("=================================");
    console.log("REGISTER REQUEST");
    console.log(req.body);
    console.log("=================================");

    const {
      name,
      email,
      phone,
      password,
      role,
    } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: cleanEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // =====================================
    // ONLY THESE ROLES ARE ALLOWED
    // =====================================

    const selectedRole =
      role === "technician"
        ? "technician"
        : "user";

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: selectedRole,

      // Technician defaults
      skills:
        selectedRole === "technician"
          ? []
          : undefined,

      isAvailable:
        selectedRole === "technician"
          ? true
          : undefined,
    });

    console.log(
      "USER CREATED:",
      user._id,
      "ROLE:",
      user.role
    );

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured",
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePhoto: user.profilePhoto,
        skills: user.skills,
        experience: user.experience,
        bio: user.bio,
        isAvailable: user.isAvailable,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

// =====================================
// LOGIN
// =====================================

const login = async (req, res) => {
  try {
    console.log("=================================");
    console.log("LOGIN REQUEST");
    console.log(req.body);
    console.log("=================================");

    const {
      email,
      password,
    } = req.body;

    // -----------------------------------
    // VALIDATION
    // -----------------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    // -----------------------------------
    // FIND USER
    // -----------------------------------

    const user = await User.findOne({
      email: cleanEmail,
    });

    console.log(
      "USER FOUND:",
      !!user
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    console.log(
      "DATABASE ROLE:",
      user.role
    );

    // -----------------------------------
    // PASSWORD CHECK
    // -----------------------------------

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    // -----------------------------------
// BLOCKED USER CHECK
// -----------------------------------

if (user.isBlocked) {
  return res.status(403).json({
    success: false,
    message:
      "Your account has been blocked by admin",
  });
}

// -----------------------------------
// LOGIN TRACKING
// -----------------------------------

user.lastLogin = new Date();

user.loginCount =
  (user.loginCount || 0) + 1;

await user.save();

    // -----------------------------------
    // JWT SECRET
    // -----------------------------------

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message:
          "JWT_SECRET is not configured",
      });
    }

    // -----------------------------------
    // CREATE TOKEN
    // -----------------------------------

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    console.log(
      "LOGIN SUCCESS"
    );

    console.log(
      "LOGIN ROLE:",
      user.role
    );

    // -----------------------------------
    // RESPONSE
    // -----------------------------------

    return res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};


// =====================================
// FORGOT PASSWORD
// =====================================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    const user = await User.findOne({
      email: cleanEmail,
    });

    // Security:
    // Same response even if user does not exist
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // -----------------------------------
    // GENERATE RESET TOKEN
    // -----------------------------------

    const resetToken =
      crypto.randomBytes(32).toString("hex");

    // Store HASHED token in database
    const hashedToken =
      crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    user.resetPasswordToken =
      hashedToken;

    // Token valid for 15 minutes
    user.resetPasswordExpires =
      new Date(
        Date.now() + 15 * 60 * 1000
      );

    await user.save();

    // -----------------------------------
    // RESET URL
    // -----------------------------------

    const frontendUrl =
      process.env.FRONTEND_URL;

    if (!frontendUrl) {
      return res.status(500).json({
        success: false,
        message:
          "FRONTEND_URL is not configured",
      });
    }

    const resetUrl =
      `${frontendUrl}/reset-password/${resetToken}`;

    // -----------------------------------
    // SEND EMAIL
    // -----------------------------------

    const emailResult = await sendEmail({
      to: user.email,

      subject:
        "Reset your NearbyFix password",

      text:
        `You requested a password reset.\n\n` +
        `Click the link below to reset your password:\n\n` +
        `${resetUrl}\n\n` +
        `This link will expire in 15 minutes.\n\n` +
        `If you did not request this, you can safely ignore this email.`,

      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">

          <h2>Reset your NearbyFix password</h2>

          <p>Hello ${user.name},</p>

          <p>
            We received a request to reset your NearbyFix password.
          </p>

          <p style="margin: 30px 0;">

            <a
              href="${resetUrl}"
              style="
                background: #2563eb;
                color: white;
                padding: 12px 22px;
                text-decoration: none;
                border-radius: 8px;
                display: inline-block;
              "
            >
              Reset Password
            </a>

          </p>

          <p>
            Or copy this link into your browser:
          </p>

          <p>
            ${resetUrl}
          </p>

          <p>
            This link will expire in
            <strong>15 minutes</strong>.
          </p>

          <p>
            If you did not request this password reset,
            you can safely ignore this email.
          </p>

          <br />

          <p>
            — NearbyFix Team
          </p>

        </div>
      `,
    });

    // -----------------------------------
    // EMAIL FAILED
    // -----------------------------------

    if (!emailResult.success) {

      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;

      await user.save();

      console.error(
        "RESET EMAIL FAILED:",
        emailResult.error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to send password reset email",
      });
    }

    console.log(
      "PASSWORD RESET EMAIL SENT:",
      user.email
    );

    return res.status(200).json({
      success: true,
      message:
        "Password reset link sent to your email",
    });

  } catch (error) {

    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to process password reset request",
    });
  }
};


// =====================================
// RESET PASSWORD
// =====================================

const resetPassword = async (req, res) => {
  try {

    const { token } = req.params;

    const {
      password,
      confirmPassword,
    } = req.body;

    // -----------------------------------
    // VALIDATION
    // -----------------------------------

    if (
      !token ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Token and password fields are required",
      });
    }

    if (
      password !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 6 characters",
      });
    }

    // -----------------------------------
    // HASH RECEIVED TOKEN
    // -----------------------------------

    const hashedToken =
      crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // -----------------------------------
    // FIND VALID TOKEN
    // -----------------------------------

    const user = await User.findOne({
      resetPasswordToken:
        hashedToken,

      resetPasswordExpires: {
        $gt: new Date(),
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Password reset link is invalid or has expired",
      });
    }

    // -----------------------------------
    // UPDATE PASSWORD
    // -----------------------------------

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    user.password =
      hashedPassword;

    // Remove used token
    user.resetPasswordToken =
      null;

    user.resetPasswordExpires =
      null;

    await user.save();

    console.log(
      "PASSWORD RESET SUCCESS:",
      user.email
    );

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now login.",
    });

  } catch (error) {

    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Password reset failed",
    });
  }
};
module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
};