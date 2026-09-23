const express = require("express");
const mongoose = require("mongoose");

const Message = require("../models/Message");
const ServiceRequest = require("../models/ServiceRequest");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// =====================================================
// CHECK CHAT ACCESS
// =====================================================

const getAuthorizedRequest = async (requestId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return null;
  }

  const request = await ServiceRequest.findById(requestId);

  if (!request) {
    return null;
  }

  // Chat is available only after technician is assigned
  if (!request.technician) {
    return null;
  }

  const currentUserId = String(userId);

  const isCustomer =
    String(request.user) === currentUserId;

  const isTechnician =
    String(request.technician) === currentUserId;

  if (!isCustomer && !isTechnician) {
    return null;
  }

  return request;
};

// =====================================================
// GET CHAT MESSAGES
// =====================================================

router.get(
  "/:requestId/messages",
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      const request = await getAuthorizedRequest(
        requestId,
        req.userId
      );

      if (!request) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to access this chat",
        });
      }

      const messages = await Message.find({
        request: requestId,
      })
        .populate(
          "sender",
          "name role profilePhoto"
        )
        .sort({
          createdAt: 1,
        });

      return res.status(200).json({
        success: true,
        messages,
      });
    } catch (error) {
      console.error(
        "GET CHAT MESSAGES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load chat messages",
      });
    }
  }
);

// =====================================================
// SEND MESSAGE
// =====================================================

router.post(
  "/:requestId/messages",
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { message } = req.body;

      const request = await getAuthorizedRequest(
        requestId,
        req.userId
      );

      if (!request) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to use this chat",
        });
      }

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Message cannot be empty",
        });
      }

      const cleanMessage = message.trim();

      if (cleanMessage.length > 1000) {
        return res.status(400).json({
          success: false,
          message:
            "Message cannot exceed 1000 characters",
        });
      }

      const newMessage = await Message.create({
        request: requestId,
        sender: req.userId,
        message: cleanMessage,
      });

      const populatedMessage =
        await Message.findById(
          newMessage._id
        ).populate(
          "sender",
          "name role profilePhoto"
        );

      return res.status(201).json({
        success: true,
        message: populatedMessage,
      });
    } catch (error) {
      console.error(
        "SEND CHAT MESSAGE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  }
);

module.exports = router;