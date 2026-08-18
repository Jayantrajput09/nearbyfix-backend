const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

module.exports = {
  register,
  login,
};