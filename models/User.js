const mongoose = require("mongoose");

const SERVICE_TYPES = [
  "electrician",
  "plumber",
  "ac-repair",
  "carpenter",
  "mechanic",
  "appliance-repair",
];

const userSchema = new mongoose.Schema(
  {
    // =====================================
    // BASIC USER
    // =====================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // =====================================
    // ROLE
    // =====================================

    role: {
      type: String,
      enum: ["user", "technician", "admin"],
      default: "user",
    },

    // =====================================
    // PROFILE
    // =====================================

    profilePhoto: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    skills: {
      type: [String],
      default: [],
    },

    experience: {
      type: Number,
      default: 0,
      min: 0,
    },

    serviceTypes: {
      type: [String],
      enum: SERVICE_TYPES,
      default: [],
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    // =====================================
    // LOCATION
    // =====================================

    location: {
      address: {
        type: String,
        default: "",
      },

      city: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      pincode: {
        type: String,
        default: "",
      },

      coordinates: {
        lat: {
          type: Number,
          default: null,
        },

        lng: {
          type: Number,
          default: null,
        },
      },
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
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);