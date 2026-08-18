const express = require("express");
const jwt = require("jsonwebtoken");

const {
  getSuggestion,
} = require("../services/aiService");

const router = express.Router();

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authorization required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.userId = decoded.id;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    console.error(
      "AI AUTH ERROR:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// =====================================================
// AI SUGGESTIONS
// POST /api/ai/suggestions
// =====================================================

router.post(
  "/suggestions",
  authMiddleware,
  async (req, res) => {
    try {
      const { message } = req.body;

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Message is required",
        });
      }

      const result =
        await getSuggestion(message);

      return res.json({
        success: true,

        // Main response
        reply: result.reply,

        // Compatibility with your Dashboard
        suggestion: result.reply,
        answer: result.reply,
        message: result.reply,

        // Detected service
        suggestedService:
          result.suggestedService || null,
      });
    } catch (error) {
      console.error(
        "AI SUGGESTION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "AI assistant failed",
      });
    }
  }
);

module.exports = router;