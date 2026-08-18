
const mongoose = require("mongoose");

const technicianSchema = new mongoose.Schema(
  {
    // =====================================
    // LINK TO USER ACCOUNT
    // =====================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // =====================================
    // TECHNICIAN PROFILE
    // =====================================

    profilePhoto: {
      type: String,
      default: "",
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    // =====================================
    // SKILLS
    // =====================================

    skills: {
      type: [String],
      default: [],
      validate: {
        validator: function (skills) {
          return skills.every(
            (skill) =>
              typeof skill === "string" &&
              skill.trim().length > 0
          );
        },
        message: "Skills must contain valid text values.",
      },
    },

    // =====================================
    // SERVICES
    // =====================================

    serviceTypes: {
      type: [String],
      enum: [
        "electrician",
        "plumber",
        "ac-repair",
        "carpenter",
        "mechanic",
        "appliance-repair",
      ],
      default: [],
    },

    // =====================================
    // EXPERIENCE
    // =====================================

    experience: {
      type: Number,
      default: 0,
      min: 0,
      max: 60,
    },

    // =====================================
    // AVAILABILITY
    // =====================================

    isAvailable: {
      type: Boolean,
      default: true,
    },

    // =====================================
    // SERVICE AREA
    // =====================================

    serviceRadius: {
      type: Number,
      default: 10,
      min: 1,
      max: 100,
    },

    // =====================================
    // RATING
    // =====================================

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================
    // JOB STATISTICS
    // =====================================

    completedJobs: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalJobs: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================
    // VERIFICATION
    // =====================================

    isVerified: {
      type: Boolean,
      default: false,
    },

    // =====================================
    // PROFILE STATUS
    // =====================================

    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================
// INDEXES
// =====================================

technicianSchema.index({
  skills: 1,
});

technicianSchema.index({
  serviceTypes: 1,
});

technicianSchema.index({
  isAvailable: 1,
});

technicianSchema.index({
  rating: -1,
});

// =====================================
// EXPORT
// =====================================

module.exports = mongoose.model(
  "Technician",
  technicianSchema
);
