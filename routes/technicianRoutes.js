const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");
const ServiceRequest = require("../models/ServiceRequest");

const { sendEmail } = require("../utils/email");

console.log(
  "SEND EMAIL IMPORT:",
  typeof sendEmail
);

const router = express.Router();
// =====================================================
// CONSTANTS
// =====================================================

const ALLOWED_SERVICE_TYPES = [
  "electrician",
  "plumber",
  "ac-repair",
  "carpenter",
  "mechanic",
  "appliance-repair",
];

const ALLOWED_STATUSES = [
  "accepted",
  "on-the-way",
  "arrived",
  "in-progress",
  "completed",
];

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId =
      decoded.id ||
      decoded._id ||
      decoded.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user ID in token",
      });
    }

    req.userId = userId;
    req.userRole = decoded.role || null;

    next();
  } catch (error) {
    console.error(
      "TECHNICIAN AUTH ERROR:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// =====================================================
// TECHNICIAN ONLY
// =====================================================

const technicianOnly = (req, res, next) => {
  if (req.userRole !== "technician") {
    return res.status(403).json({
      success: false,
      message: "Technician access required",
    });
  }

  next();
};

// =====================================================
// VALIDATE OBJECT ID
// =====================================================

const validateObjectId = (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID",
    });
  }

  next();
};

// =====================================================
// GET TECHNICIAN PROFILE
// GET /api/technician/profile
// =====================================================

router.get(
  "/profile",
  authMiddleware,
  technicianOnly,
  async (req, res) => {
    try {
      const user = await User.findById(
        req.userId
      ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Technician not found",
        });
      }

      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      console.error(
        "GET TECHNICIAN PROFILE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load technician profile",
      });
    }
  }
);

// =====================================================
// UPDATE TECHNICIAN PROFILE
// PUT /api/technician/profile
// =====================================================

router.put(
  "/profile",
  authMiddleware,
  technicianOnly,
  async (req, res) => {
    try {
      const {
        name,
        phone,
        profilePhoto,
        bio,
        skills,
        experience,
        serviceTypes,
        isAvailable,
        address,
        city,
        state,
        pincode,
        lat,
        lng,
      } = req.body;

      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Technician not found",
        });
      }

      // =================================================
      // BASIC INFO
      // =================================================

      if (name !== undefined) {
        const cleanName = String(name).trim();

        if (!cleanName) {
          return res.status(400).json({
            success: false,
            message: "Name cannot be empty",
          });
        }

        user.name = cleanName;
      }

      if (phone !== undefined) {
        user.phone = String(phone).trim();
      }

      // =================================================
      // PHOTO
      // =================================================

      if (profilePhoto !== undefined) {
        user.profilePhoto =
          String(profilePhoto).trim();
      }

      // =================================================
      // BIO
      // =================================================

      if (bio !== undefined) {
        user.bio = String(bio).trim();
      }

      // =================================================
      // SKILLS
      // =================================================

      if (skills !== undefined) {
        if (!Array.isArray(skills)) {
          return res.status(400).json({
            success: false,
            message: "Skills must be an array",
          });
        }

        user.skills = skills
          .map((skill) =>
            String(skill)
              .trim()
              .toLowerCase()
          )
          .filter(Boolean);
      }

      // =================================================
      // EXPERIENCE
      // =================================================

      if (experience !== undefined) {
        const exp = Number(experience);

        if (!Number.isFinite(exp) || exp < 0) {
          return res.status(400).json({
            success: false,
            message:
              "Experience must be a valid number",
          });
        }

        user.experience = exp;
      }

      // =================================================
      // SERVICE TYPES
      // =================================================

      if (serviceTypes !== undefined) {
        if (!Array.isArray(serviceTypes)) {
          return res.status(400).json({
            success: false,
            message:
              "Service types must be an array",
          });
        }

        const cleanServices = serviceTypes
          .map((service) =>
            String(service)
              .trim()
              .toLowerCase()
          )
          .filter(Boolean);

        const invalidServices =
          cleanServices.filter(
            (service) =>
              !ALLOWED_SERVICE_TYPES.includes(
                service
              )
          );

        if (invalidServices.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid service type",
            invalidServices,
          });
        }

        user.serviceTypes = [
          ...new Set(cleanServices),
        ];
      }

      // =================================================
      // AVAILABILITY
      // =================================================

      if (isAvailable !== undefined) {
        user.isAvailable =
          isAvailable === true ||
          isAvailable === "true";
      }

      // =================================================
      // LOCATION
      // =================================================

      const oldLocation = user.location || {};

      const oldCoordinates =
        oldLocation.coordinates || {};

      let latitude =
        oldCoordinates.lat ?? null;

      let longitude =
        oldCoordinates.lng ?? null;

      if (
        lat !== undefined &&
        lat !== null &&
        lat !== ""
      ) {
        const parsedLat = Number(lat);

        if (
          !Number.isFinite(parsedLat) ||
          parsedLat < -90 ||
          parsedLat > 90
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid latitude",
          });
        }

        latitude = parsedLat;
      }

      if (
        lng !== undefined &&
        lng !== null &&
        lng !== ""
      ) {
        const parsedLng = Number(lng);

        if (
          !Number.isFinite(parsedLng) ||
          parsedLng < -180 ||
          parsedLng > 180
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid longitude",
          });
        }

        longitude = parsedLng;
      }

      user.location = {
        address:
          address !== undefined
            ? String(address).trim()
            : oldLocation.address || "",

        city:
          city !== undefined
            ? String(city).trim()
            : oldLocation.city || "",

        state:
          state !== undefined
            ? String(state).trim()
            : oldLocation.state || "",

        pincode:
          pincode !== undefined
            ? String(pincode).trim()
            : oldLocation.pincode || "",

        coordinates: {
          lat: latitude,
          lng: longitude,
        },
      };

      await user.save();

      const updatedUser =
        await User.findById(req.userId)
          .select("-password");

      return res.status(200).json({
        success: true,
        message:
          "Technician profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error(
        "UPDATE TECHNICIAN PROFILE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update technician profile",
      });
    }
  }
);

// =====================================================
// SEARCH TECHNICIANS
// GET /api/technician/search
// =====================================================

router.get(
  "/search",
  authMiddleware,
  async (req, res) => {
    try {
      const search = String(
        req.query.q || ""
      ).trim();

      const query = {
        role: "technician",
      };

      if (search) {
        query.$or = [
          {
            name: {
              $regex: search,
              $options: "i",
            },
          },
          {
            skills: {
              $regex: search,
              $options: "i",
            },
          },
          {
            serviceTypes: {
              $regex: search,
              $options: "i",
            },
          },
          {
            "location.city": {
              $regex: search,
              $options: "i",
            },
          },
          {
            "location.state": {
              $regex: search,
              $options: "i",
            },
          },
        ];
      }

      const technicians =
        await User.find(query)
          .select("-password")
          .sort({
            isAvailable: -1,
            rating: -1,
            totalReviews: -1,
            name: 1,
          })
          .limit(50);

      return res.status(200).json({
        success: true,
        count: technicians.length,
        technicians,
      });
    } catch (error) {
      console.error(
        "TECHNICIAN SEARCH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to search technicians",
      });
    }
  }
);

// =====================================================
// RECOMMENDED TECHNICIANS
// GET /api/technician/recommended
// =====================================================

router.get(
  "/recommended",
  authMiddleware,
  async (req, res) => {
    try {
      const technicians =
        await User.find({
          role: "technician",
          isAvailable: true,
        })
          .select("-password")
          .sort({
            rating: -1,
            totalReviews: -1,
            experience: -1,
            name: 1,
          })
          .limit(20);

      return res.status(200).json({
        success: true,
        count: technicians.length,
        technicians,
      });
    } catch (error) {
      console.error(
        "RECOMMENDED TECHNICIANS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load technicians",
      });
    }
  }
);

// =====================================================
// GET TECHNICIAN REQUESTS
//
// Shows:
// 1. Pending unassigned requests
// 2. Requests accepted by current technician
// 3. On the way
// 4. Arrived
// 5. In progress
// 6. Completed
// =====================================================

router.get(
  "/requests",
  authMiddleware,
  technicianOnly,
  async (req, res) => {
    try {
      const requests =
        await ServiceRequest.find({
          $or: [
            {
              status: "pending",
              $or: [
                { technician: null },
                {
                  technician: {
                    $exists: false,
                  },
                },
              ],
            },
            {
              technician: req.userId,
            },
          ],
        })
          .populate(
            "user",
            "name email phone profilePhoto location"
          )
          .populate(
            "technician",
            "name email phone profilePhoto skills serviceTypes experience rating location isAvailable"
          )
          .sort({
            createdAt: -1,
          });

      console.log(
        "TECHNICIAN REQUESTS:",
        requests.length
      );

      return res.status(200).json({
        success: true,
        count: requests.length,
        requests,
      });
    } catch (error) {
      console.error(
        "GET TECHNICIAN REQUESTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load service requests",
      });
    }
  }
);

// =====================================================
// GET MY TECHNICIAN REQUESTS
// GET /api/technician/my-requests
// =====================================================

router.get(
  "/my-requests",
  authMiddleware,
  technicianOnly,
  async (req, res) => {
    try {
      const requests =
        await ServiceRequest.find({
          technician: req.userId,
        })
          .populate(
            "user",
            "name email phone profilePhoto location"
          )
          .populate(
            "technician",
            "name email phone profilePhoto skills serviceTypes experience rating location isAvailable"
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
        "GET MY TECHNICIAN REQUESTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load technician requests",
      });
    }
  }
);

// =====================================================
// ACCEPT SERVICE REQUEST
// PUT /api/technician/requests/:id/accept
//
// IMPORTANT:
// Pending request normally has:
// status = "pending"
// technician = null
//
// When technician accepts:
// status = "accepted"
// technician = current technician ID
// =====================================================

router.put(
  "/requests/:id/accept",
  authMiddleware,
  technicianOnly,
  validateObjectId,
  async (req, res) => {
    try {
      console.log("");
      console.log("====================================");
      console.log("ACCEPT REQUEST ROUTE HIT");
      console.log("REQUEST ID:", req.params.id);
      console.log("TECHNICIAN ID:", req.userId);
      console.log("====================================");

      // =================================================
      // FIND TECHNICIAN
      // =================================================

      const technician =
        await User.findOne({
          _id: req.userId,
          role: "technician",
        });

      if (!technician) {
        return res.status(403).json({
          success: false,
          message:
            "Technician account not found",
        });
      }

      // =================================================
      // FIND REQUEST BY ID ONLY
      //
      // IMPORTANT:
      // Do NOT require technician to already exist here.
      // Pending request can have technician = null.
      // =================================================

      const request =
        await ServiceRequest.findById(
          req.params.id
        );

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Service request not found",
        });
      }

      // =================================================
      // DEBUG DATABASE STATE
      // =================================================

      console.log("REQUEST FROM DATABASE:");
      console.log({
        id: request._id.toString(),
        status: request.status,
        technician:
          request.technician
            ? request.technician.toString()
            : null,
        customer:
          request.user
            ? request.user.toString()
            : null,
      });

      // =================================================
      // CHECK STATUS
      // =================================================

      if (request.status !== "pending") {
        return res.status(400).json({
          success: false,
          message:
            `Request is already ${request.status}`,
        });
      }

      // =================================================
      // CHECK IF ALREADY ASSIGNED
      // =================================================

      if (
        request.technician &&
        request.technician.toString() !==
          req.userId.toString()
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This request has already been assigned to another technician",
        });
      }

      // =================================================
      // EXPECTED ARRIVAL TIME
      // =================================================

      const expectedTime =
        String(
          req.body?.expectedTime ||
            "30-45 minutes"
        ).trim();

      // =================================================
      // ASSIGN TECHNICIAN
      // =================================================

      request.technician =
        technician._id;

      request.status = "accepted";

      request.acceptedAt = new Date();

      request.trackingStarted = false;

      // If this field exists in your schema,
      // it will be saved.
      request.expectedTime =
        expectedTime;

      await request.save();

      console.log(
        "===================================="
      );

      console.log(
        "REQUEST ACCEPTED SUCCESSFULLY"
      );

      console.log(
        "REQUEST:",
        request._id.toString()
      );

      console.log(
        "TECHNICIAN:",
        technician._id.toString()
      );

      console.log(
        "EXPECTED TIME:",
        expectedTime
      );

      console.log(
        "===================================="
      );

      // =================================================
      // FIND CUSTOMER
      // =================================================

      const customer =
        await User.findById(
          request.user
        );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message:
            "Customer account not found",
        });
      }

      console.log(
        "CUSTOMER:",
        customer.name
      );

      console.log(
        "CUSTOMER EMAIL:",
        customer.email
      );

      // =================================================
      // SEND CUSTOMER CONFIRMATION EMAIL
      // =================================================

      if (customer.email) {
        try {
          await sendEmail({
            to: customer.email,

            subject:
              "✅ NearbyFix - Service Request Confirmed",

            text: `
Hello ${customer.name || "Customer"},

Good news!

Your NearbyFix service request has been ACCEPTED by the technician.

SERVICE
${request.serviceType || "Service"}

PROBLEM
${request.title || "Service Request"}

DESCRIPTION
${request.description || "Not provided"}

TECHNICIAN
${technician.name || "Technician"}

TECHNICIAN PHONE
${technician.phone || "Not provided"}

EXPECTED ARRIVAL
${expectedTime}

The technician will update the request when they are:

1. On The Way
2. Arrived
3. In Progress
4. Completed

Thank you for using NearbyFix.

NearbyFix Team
            `,

            html: `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
NearbyFix Service Confirmed
</title>

</head>

<body style="
  margin:0;
  padding:0;
  background:#f8fafc;
  font-family:Arial,Helvetica,sans-serif;
">

<div style="
  max-width:600px;
  margin:30px auto;
  background:#ffffff;
  border:1px solid #e5e7eb;
  border-radius:16px;
  overflow:hidden;
">

  <div style="
    background:#2563eb;
    padding:25px;
    text-align:center;
  ">

    <h1 style="
      margin:0;
      color:white;
      font-size:26px;
    ">
      NearbyFix
    </h1>

  </div>

  <div style="
    padding:30px;
  ">

    <h2 style="
      color:#16a34a;
      margin-top:0;
    ">
      ✅ Service Request Confirmed
    </h2>

    <p>
      Hello
      <strong>
        ${customer.name || "Customer"}
      </strong>,
    </p>

    <p>
      Good news! Your NearbyFix service request has been
      <strong style="color:#16a34a;">
        ACCEPTED
      </strong>
      by the technician.
    </p>

    <div style="
      margin-top:25px;
      padding:20px;
      background:#f8fafc;
      border-radius:12px;
    ">

      <p>
        <strong>Service:</strong>
        ${request.serviceType || "Service"}
      </p>

      <p>
        <strong>Problem:</strong>
        ${request.title || "Service Request"}
      </p>

      <p>
        <strong>Description:</strong>
        ${request.description || "Not provided"}
      </p>

      <p>
        <strong>Technician:</strong>
        ${technician.name || "Technician"}
      </p>

      <p>
        <strong>Phone:</strong>
        ${technician.phone || "Not provided"}
      </p>

    </div>

    <div style="
      margin-top:20px;
      padding:20px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      border-radius:12px;
      text-align:center;
    ">

      <div style="
        color:#1d4ed8;
        font-size:14px;
        font-weight:bold;
      ">
        EXPECTED ARRIVAL
      </div>

      <div style="
        margin-top:8px;
        font-size:22px;
        font-weight:bold;
        color:#111827;
      ">
        ${expectedTime}
      </div>

    </div>

    <div style="
      margin-top:25px;
      padding:15px;
      background:#f0fdf4;
      border-radius:10px;
    ">

      <p style="
        margin:0;
        color:#166534;
      ">
        The technician will update you when they are
        <strong>
          On The Way
        </strong>
        and when they
        <strong>
          Arrive
        </strong>.
      </p>

    </div>

    <hr style="
      margin:30px 0;
      border:none;
      border-top:1px solid #e5e7eb;
    ">

    <p style="
      color:#64748b;
      font-size:14px;
    ">
      Thank you for using
      <strong>
        NearbyFix
      </strong>.
    </p>

  </div>

</div>

</body>

</html>
            `,
          });

          console.log(
            "===================================="
          );

          console.log(
            "CUSTOMER ACCEPTANCE EMAIL SENT:"
          );

          console.log(
            customer.email
          );

          console.log(
            "===================================="
          );
        } catch (emailError) {
          console.error(
            "CUSTOMER EMAIL ERROR:",
            emailError
          );

          // Email failure must NOT
          // undo request acceptance.
        }
      } else {
        console.log(
          "CUSTOMER HAS NO EMAIL"
        );
      }

      // =================================================
      // GET UPDATED REQUEST
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
            "name email phone profilePhoto skills serviceTypes experience rating location isAvailable"
          );

      // =================================================
      // FINAL RESPONSE
      // =================================================

      return res.status(200).json({
        success: true,

        message:
          "Service request accepted successfully",

        request:
          populatedRequest,
      });

    } catch (error) {
      console.error(
        "===================================="
      );

      console.error(
        "ACCEPT REQUEST ERROR:"
      );

      console.error(error);

      console.error(
        "===================================="
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to accept service request",
      });
    }
  }
);

// =====================================================
// UPDATE REQUEST STATUS
// PUT /api/technician/requests/:id/status
// =====================================================

router.put(
  "/requests/:id/status",
  authMiddleware,
  technicianOnly,
  validateObjectId,
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid request status",
          allowedStatuses:
            ALLOWED_STATUSES,
        });
      }

      const request =
        await ServiceRequest.findOne({
          _id: req.params.id,
          technician: req.userId,
        });

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Service request not found",
        });
      }

      if (request.status === "completed") {
        return res.status(400).json({
          success: false,
          message:
            "Completed request cannot be changed",
        });
      }

      if (request.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message:
            "Cancelled request cannot be changed",
        });
      }

      const statusOrder = {
        accepted: 1,
        "on-the-way": 2,
        arrived: 3,
        "in-progress": 4,
        completed: 5,
      };

      const currentOrder =
        statusOrder[request.status];

      const newOrder =
        statusOrder[status];

      if (
        currentOrder !== undefined &&
        newOrder !== undefined &&
        newOrder < currentOrder
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot move request backwards",
        });
      }

      if (request.status === status) {
        return res.status(400).json({
          success: false,
          message:
            "Request already has this status",
        });
      }

      request.status = status;

      if (status === "on-the-way") {
        request.trackingStarted = true;
      }

      if (status === "arrived") {
        request.arrivedAt = new Date();
        request.trackingStarted = false;
      }

      if (status === "in-progress") {
        request.trackingStarted = false;
      }

      if (status === "completed") {
        request.completedAt = new Date();
        request.trackingStarted = false;
      }

      await request.save();

      // =================================================
      // GET UPDATED REQUEST
      // =================================================

      const updatedRequest =
        await ServiceRequest.findById(
          request._id
        )
          .populate(
            "user",
            "name email phone profilePhoto location"
          )
          .populate(
            "technician",
            "name email phone profilePhoto skills serviceTypes experience rating location isAvailable"
          );

      return res.status(200).json({
        success: true,
        message:
          "Request status updated successfully",
        request: updatedRequest,
      });

    } catch (error) {
      console.error(
        "UPDATE REQUEST STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update request status",
      });
    }
  }
);

// =====================================================
// UPDATE TECHNICIAN LIVE LOCATION
// PUT /api/technician/requests/:id/location
// =====================================================

router.put(
  "/requests/:id/location",
  authMiddleware,
  technicianOnly,
  validateObjectId,
  async (req, res) => {
    try {
      const { lat, lng } = req.body;

      const latitude = Number(lat);
      const longitude = Number(lng);

      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude",
        });
      }

      if (
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid longitude",
        });
      }

      const request =
        await ServiceRequest.findOne({
          _id: req.params.id,
          technician: req.userId,
        });

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Service request not found",
        });
      }

      if (
        request.status === "completed" ||
        request.status === "cancelled"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Tracking is not available for this request",
        });
      }

      request.technicianLocation = {
        lat: latitude,
        lng: longitude,
        updatedAt: new Date(),
      };

      request.trackingStarted = true;

      await request.save();

      return res.status(200).json({
        success: true,
        message:
          "Technician location updated",
        location:
          request.technicianLocation,
      });

    } catch (error) {
      console.error(
        "UPDATE TECHNICIAN LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update technician location",
      });
    }
  }
);

// =====================================================
// PUBLIC TECHNICIAN PROFILE
// GET /api/technician/:id
//
// MUST BE LAST
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  validateObjectId,
  async (req, res) => {
    try {
      const technician =
        await User.findOne({
          _id: req.params.id,
          role: "technician",
        }).select("-password");

      if (!technician) {
        return res.status(404).json({
          success: false,
          message:
            "Technician profile not found",
        });
      }

      return res.status(200).json({
        success: true,
        technician,
      });

    } catch (error) {
      console.error(
        "GET TECHNICIAN BY ID ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load technician profile",
      });
    }
  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;