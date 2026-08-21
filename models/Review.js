const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // =====================================
    // SERVICE REQUEST
    // =====================================

    serviceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
      unique: true,
      index: true,
    },

    // =====================================
    // USER WHO GAVE REVIEW
    // =====================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =====================================
    // TECHNICIAN BEING REVIEWED
    // =====================================

    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =====================================
    // RATING
    // =====================================

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // =====================================
    // REVIEW
    // =====================================

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Review",
  reviewSchema
);