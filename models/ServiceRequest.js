const mongoose = require("mongoose");

const SERVICE_TYPES = [
  "electrician",
  "plumber",
  "ac-repair",
  "carpenter",
  "mechanic",
  "appliance-repair",
];

const REQUEST_STATUSES = [
  "pending",
  "accepted",
  "on-the-way",
  "arrived",
  "in-progress",
  "completed",
  "cancelled",
];

const serviceRequestSchema = new mongoose.Schema(
  {
    // =====================================
    // CUSTOMER
    // =====================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =====================================
    // SERVICE
    // =====================================

    serviceType: {
      type: String,
      enum: SERVICE_TYPES,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    // =====================================
    // CUSTOMER LOCATION
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
    // STATUS
    // =====================================

    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: "pending",
      index: true,
    },

    // =====================================
    // ASSIGNED TECHNICIAN
    // =====================================

    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // =====================================
    // TECHNICIAN LIVE LOCATION
    // =====================================

    technicianLocation: {
      lat: {
        type: Number,
        default: null,
      },

      lng: {
        type: Number,
        default: null,
      },

      updatedAt: {
        type: Date,
        default: null,
      },
    },

    // =====================================
    // TRACKING
    // =====================================

    trackingEnabled: {
      type: Boolean,
      default: false,
    },

    trackingStarted: {
      type: Boolean,
      default: false,
    },

    // =====================================
    // ETA
    // =====================================

    etaMinutes: {
      type: Number,
      default: null,
      min: 0,
    },

    etaText: {
      type: String,
      default: "",
    },

    // =====================================
    // TIMESTAMPS
    // =====================================

    acceptedAt: {
      type: Date,
      default: null,
    },

    arrivedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ServiceRequest",
  serviceRequestSchema
);