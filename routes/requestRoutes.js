const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");
const ServiceRequest = require("../models/ServiceRequest");
const { sendEmail } = require("../utils/email");

const router = express.Router();

// =====================================================
// ALLOWED SERVICES
// =====================================================

const ALLOWED_SERVICES = [
  "electrician",
  "plumber",
  "ac-repair",
  "carpenter",
  "mechanic",
  "appliance-repair",
];

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

const authMiddleware = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization header missing",
      });
    }

    if (
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authorization format",
      });
    }

    const token =
      authHeader
        .substring(7)
        .trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET is missing in .env"
      );

      return res.status(500).json({
        success: false,
        message:
          "Server authentication configuration missing",
      });
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid token payload",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        decoded.id
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid user ID in token",
      });
    }

    req.userId = decoded.id;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    console.error(
      "REQUEST AUTH ERROR:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired token",
    });
  }
};

// =====================================================
// OBJECT ID VALIDATION
// =====================================================

const validateObjectId = (
  req,
  res,
  next
) => {
  const { id } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID",
    });
  }

  next();
};

// =====================================================
// NORMALIZE LOCATION
// =====================================================

const buildLocation = (
  location,
  user
) => {
  const profileLocation =
    user?.location || {};

  const incomingCoordinates =
    location?.coordinates || {};

  const profileCoordinates =
    profileLocation?.coordinates || {};

  const lat =
    incomingCoordinates.lat !==
      undefined &&
    incomingCoordinates.lat !==
      null &&
    incomingCoordinates.lat !== ""
      ? Number(
          incomingCoordinates.lat
        )
      : profileCoordinates.lat !==
          undefined &&
        profileCoordinates.lat !==
          null &&
        profileCoordinates.lat !== ""
      ? Number(
          profileCoordinates.lat
        )
      : null;

  const lng =
    incomingCoordinates.lng !==
      undefined &&
    incomingCoordinates.lng !==
      null &&
    incomingCoordinates.lng !== ""
      ? Number(
          incomingCoordinates.lng
        )
      : profileCoordinates.lng !==
          undefined &&
        profileCoordinates.lng !==
          null &&
        profileCoordinates.lng !== ""
      ? Number(
          profileCoordinates.lng
        )
      : null;

  return {
    address:
      location?.address !==
        undefined &&
      location?.address !== null
        ? String(
            location.address
          ).trim()
        : String(
            profileLocation.address ||
              ""
          ).trim(),

    city:
      location?.city !==
        undefined &&
      location?.city !== null
        ? String(
            location.city
          ).trim()
        : String(
            profileLocation.city ||
              ""
          ).trim(),

    state:
      location?.state !==
        undefined &&
      location?.state !== null
        ? String(
            location.state
          ).trim()
        : String(
            profileLocation.state ||
              ""
          ).trim(),

    pincode:
      location?.pincode !==
        undefined &&
      location?.pincode !== null
        ? String(
            location.pincode
          ).trim()
        : String(
            profileLocation.pincode ||
              ""
          ).trim(),

    coordinates: {
      lat,
      lng,
    },
  };
};

// =====================================================
// CREATE SERVICE REQUEST
// POST /api/requests
// =====================================================

router.post(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      console.log(
        "===================================="
      );

      console.log(
        "CREATE SERVICE REQUEST"
      );

      console.log(
        "USER:",
        req.userId
      );

      console.log(
        "BODY:",
        req.body
      );

      console.log(
        "===================================="
      );

      const {
        technicianId,
        technician,
        serviceType,
        title,
        description,
        location,
      } = req.body;

      // =================================================
      // USER
      // =================================================

      const user =
        await User.findById(
          req.userId
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found",
        });
      }

      // =================================================
      // TECHNICIAN ID
      // =================================================

      const finalTechnicianId =
        technicianId || technician;

      if (!finalTechnicianId) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a technician before creating a request",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          finalTechnicianId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid technician ID",
        });
      }

      // =================================================
      // TECHNICIAN
      // =================================================

      const technicianUser =
        await User.findOne({
          _id: finalTechnicianId,
          role: "technician",
        });

      if (!technicianUser) {
        return res.status(404).json({
          success: false,
          message:
            "Technician not found",
        });
      }

      // =================================================
      // PREVENT SELF REQUEST
      // =================================================

      if (
        req.userId.toString() ===
        technicianUser._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot create a request for yourself",
        });
      }

      // =================================================
      // AVAILABILITY
      // =================================================

      if (
        technicianUser.isAvailable ===
        false
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This technician is currently unavailable",
        });
      }

      // =================================================
      // SERVICE
      // =================================================

      const cleanServiceType =
        String(serviceType || "")
          .trim()
          .toLowerCase();

      if (
        !ALLOWED_SERVICES.includes(
          cleanServiceType
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid service type",
        });
      }

      // =================================================
      // TECHNICIAN SERVICE CHECK
      // =================================================

      if (
        Array.isArray(
          technicianUser.serviceTypes
        ) &&
        technicianUser.serviceTypes
          .length > 0 &&
        !technicianUser.serviceTypes.includes(
          cleanServiceType
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selected technician does not provide this service",
        });
      }

      // =================================================
      // TITLE
      // =================================================

      const cleanTitle =
        String(title || "").trim();

      if (!cleanTitle) {
        return res.status(400).json({
          success: false,
          message:
            "Problem title is required",
        });
      }

      if (cleanTitle.length < 3) {
        return res.status(400).json({
          success: false,
          message:
            "Problem title must be at least 3 characters",
        });
      }

      // =================================================
      // DESCRIPTION
      // =================================================

      const cleanDescription =
        String(
          description || ""
        ).trim();

      if (!cleanDescription) {
        return res.status(400).json({
          success: false,
          message:
            "Problem description is required",
        });
      }

      // =================================================
      // LOCATION
      // =================================================

      const requestLocation =
        buildLocation(
          location,
          user
        );

      // =================================================
      // COORDINATES
      // =================================================

      if (
        requestLocation.coordinates
          .lat !== null &&
        !Number.isFinite(
          requestLocation.coordinates
            .lat
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid latitude",
        });
      }

      if (
        requestLocation.coordinates
          .lng !== null &&
        !Number.isFinite(
          requestLocation.coordinates
            .lng
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid longitude",
        });
      }

      // =================================================
      // CREATE REQUEST
      // =================================================

      const request =
        await ServiceRequest.create({
          user: user._id,

          technician:
            technicianUser._id,

          serviceType:
            cleanServiceType,

          title:
            cleanTitle,

          description:
            cleanDescription,

          location:
            requestLocation,

          status: "pending",

          trackingStarted:
            false,
        });

      console.log(
        "SERVICE REQUEST CREATED:",
        request._id.toString()
      );

      // =================================================
      // POPULATE
      // =================================================

      const populatedRequest =
        await ServiceRequest.findById(
          request._id
        )
          .populate(
            "user",
            "name email phone profilePhoto location"
          )
          .populate(
            "technician",
            "name email phone profilePhoto skills serviceTypes experience rating isAvailable location"
          );

      // =================================================
      // EMAIL
      // =================================================

      if (technicianUser.email) {
        try {
          const customerName =
            user.name ||
            "Customer";

          await sendEmail({
            to: technicianUser.email,

            subject:
              `🔧 New NearbyFix Service Request from ${customerName}`,

            text: `
Hello ${
              technicianUser.name ||
              "Technician"
            },

You have received a new service request on NearbyFix.

Customer:
${customerName}

Service:
${cleanServiceType}

Problem:
${cleanTitle}

Description:
${cleanDescription}

Customer Location:
${
  requestLocation.address ||
  "Not provided"
}
${requestLocation.city || ""}
${requestLocation.state || ""}
${requestLocation.pincode || ""}

Please login to your NearbyFix technician dashboard to view and accept the request.

NearbyFix
            `,

            html: `
<div style="
  font-family:Arial,sans-serif;
  max-width:600px;
  margin:auto;
  padding:25px;
  border:1px solid #e5e7eb;
  border-radius:15px;
">

  <h2 style="color:#2563eb;">
    🔧 New NearbyFix Request
  </h2>

  <p>
    Hello <strong>${
      technicianUser.name ||
      "Technician"
    }</strong>,
  </p>

  <p>
    You have received a new service request.
  </p>

  <hr />

  <p>
    <strong>Customer:</strong>
    ${customerName}
  </p>

  <p>
    <strong>Service:</strong>
    ${cleanServiceType}
  </p>

  <p>
    <strong>Problem:</strong>
    ${cleanTitle}
  </p>

  <p>
    <strong>Description:</strong>
    ${cleanDescription}
  </p>

  <p>
    <strong>Customer Location:</strong><br />
    ${
      requestLocation.address ||
      "Not provided"
    }<br />
    ${requestLocation.city || ""}<br />
    ${requestLocation.state || ""}<br />
    ${requestLocation.pincode || ""}
  </p>

  <p>
    Please login to your NearbyFix technician dashboard
    to view and accept the request.
  </p>

  <hr />

  <p style="color:#64748b;">
    NearbyFix
  </p>

</div>
            `,
          });
        } catch (emailError) {
          console.error(
            "TECHNICIAN EMAIL ERROR:",
            emailError.message
          );
        }
      }

      // =================================================
      // RESPONSE
      // =================================================

      return res.status(201).json({
        success: true,

        message:
          "Service request sent successfully",

        request:
          populatedRequest,
      });
    } catch (error) {
      console.error(
        "CREATE SERVICE REQUEST ERROR:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        const messages =
          Object.values(
            error.errors || {}
          ).map(
            (item) =>
              item.message
          );

        return res.status(400).json({
          success: false,
          message:
            messages.join(", ") ||
            "Service request validation failed",
        });
      }

      if (
        error.name ===
        "CastError"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid data supplied for service request",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to create service request",
      });
    }
  }
);

// =====================================================
// GET MY REQUESTS
// GET /api/requests/my
// =====================================================

router.get(
  "/my",
  authMiddleware,
  async (req, res) => {
    try {
      const requests =
        await ServiceRequest.find({
          user: req.userId,
        })
          .populate(
            "technician",
            "name email phone profilePhoto skills serviceTypes experience rating isAvailable location"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        count: requests.length,
        requests,
      });
    } catch (error) {
      console.error(
        "GET MY REQUESTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to load requests",
      });
    }
  }
);

// =====================================================
// GET SINGLE REQUEST
// GET /api/requests/:id
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  validateObjectId,
  async (req, res) => {
    try {
      const request =
        await ServiceRequest.findById(
          req.params.id
        )
          .populate(
            "user",
            "name email phone profilePhoto location"
          )
          .populate(
            "technician",
            "name email phone profilePhoto skills serviceTypes experience rating isAvailable location"
          );

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Service request not found",
        });
      }

      const requestUserId =
        request.user?._id?.toString();

      const requestTechnicianId =
        request.technician?._id?.toString();

      const currentUserId =
        req.userId.toString();

      const isCustomer =
        requestUserId ===
        currentUserId;

      const isTechnician =
        requestTechnicianId ===
        currentUserId;

      if (
        !isCustomer &&
        !isTechnician
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not allowed to view this request",
        });
      }

      return res.status(200).json({
        success: true,
        request,
      });
    } catch (error) {
      console.error(
        "GET SERVICE REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to load service request",
      });
    }
  }
);

// =====================================================
// CANCEL REQUEST
// PUT /api/requests/:id/cancel
// =====================================================

router.put(
  "/:id/cancel",
  authMiddleware,
  validateObjectId,
  async (req, res) => {
    try {
      const request =
        await ServiceRequest.findOne({
          _id: req.params.id,
          user: req.userId,
        });

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Service request not found",
        });
      }

      if (
        [
          "completed",
          "cancelled",
        ].includes(request.status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This request cannot be cancelled",
        });
      }

      request.status =
        "cancelled";

      request.trackingStarted =
        false;

      request.cancelledAt =
        new Date();

      await request.save();

      return res.status(200).json({
        success: true,

        message:
          "Service request cancelled",

        request,
      });
    } catch (error) {
      console.error(
        "CANCEL REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to cancel request",
      });
    }
  }
);

module.exports = router;