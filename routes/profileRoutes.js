const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// =====================================
// AUTH MIDDLEWARE
// =====================================

const authMiddleware = (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authorization required",
      });
    }

    const token =
      authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    req.userId = decoded.id;
    req.userRole = decoded.role;

    next();

  } catch (error) {

    console.error(
      "PROFILE AUTH ERROR:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// =====================================
// GET PROFILE
// GET /api/profile
// =====================================

router.get(
  "/",
  authMiddleware,
  async (req, res) => {

    try {

      const user =
        await User.findById(
          req.userId
        ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.json({
        success: true,
        user,
      });

    } catch (error) {

      console.error(
        "GET PROFILE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load profile",
      });
    }
  }
);

// =====================================
// UPDATE PROFILE
// PUT /api/profile
// =====================================

router.put(
  "/",
  authMiddleware,
  async (req, res) => {

    try {

      console.log(
        "================================="
      );

      console.log(
        "UPDATE PROFILE BODY:"
      );

      console.log(
        JSON.stringify(
          req.body,
          null,
          2
        )
      );

      console.log(
        "================================="
      );

      const {
        name,
        phone,
        profilePhoto,
        bio,
        skills,
        experience,
        serviceTypes,
        isAvailable,

        // NEW:
        location,

        // ALSO ACCEPT OLD FLAT FORMAT
        address,
        city,
        state,
        pincode,
        lat,
        lng,

      } = req.body;

      const user =
        await User.findById(
          req.userId
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // =================================
      // BASIC INFO
      // =================================

      if (name !== undefined) {
        user.name =
          String(name).trim();
      }

      if (phone !== undefined) {
        user.phone =
          String(phone).trim();
      }

      // =================================
      // PROFILE PHOTO
      // =================================

      if (
        profilePhoto !== undefined
      ) {
        user.profilePhoto =
          profilePhoto;
      }

      // =================================
      // TECHNICIAN INFO
      // =================================

      if (bio !== undefined) {
        user.bio =
          String(bio);
      }

      if (skills !== undefined) {

        user.skills =
          Array.isArray(skills)
            ? skills
            : [];
      }

      if (
        experience !== undefined
      ) {

        const exp =
          Number(experience);

        user.experience =
          Number.isFinite(exp)
            ? exp
            : 0;
      }

      if (
        serviceTypes !== undefined
      ) {

        user.serviceTypes =
          Array.isArray(serviceTypes)
            ? serviceTypes
            : [];
      }

      if (
        isAvailable !== undefined
      ) {

        user.isAvailable =
          Boolean(isAvailable);
      }

      // =================================
      // LOCATION
      // =================================

      if (!user.location) {
        user.location = {};
      }

      // ---------------------------------
      // NEW NESTED FORMAT
      // ---------------------------------

      if (
        location &&
        typeof location === "object"
      ) {

        if (
          location.address !== undefined
        ) {
          user.location.address =
            String(
              location.address
            );
        }

        if (
          location.city !== undefined
        ) {
          user.location.city =
            String(
              location.city
            );
        }

        if (
          location.state !== undefined
        ) {
          user.location.state =
            String(
              location.state
            );
        }

        if (
          location.pincode !== undefined
        ) {
          user.location.pincode =
            String(
              location.pincode
            );
        }

        if (
          location.coordinates &&
          typeof location.coordinates ===
            "object"
        ) {

          const latitude =
            Number(
              location.coordinates.lat
            );

          const longitude =
            Number(
              location.coordinates.lng
            );

          if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
          ) {

            user.location.coordinates = {
              lat: latitude,
              lng: longitude,
            };
          }
        }
      }

      // ---------------------------------
      // OLD FLAT FORMAT
      // Keep this for compatibility
      // ---------------------------------

      if (
        address !== undefined
      ) {
        user.location.address =
          String(address);
      }

      if (
        city !== undefined
      ) {
        user.location.city =
          String(city);
      }

      if (
        state !== undefined
      ) {
        user.location.state =
          String(state);
      }

      if (
        pincode !== undefined
      ) {
        user.location.pincode =
          String(pincode);
      }

      if (
        lat !== undefined &&
        lng !== undefined
      ) {

        const latitude =
          Number(lat);

        const longitude =
          Number(lng);

        if (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude)
        ) {

          user.location.coordinates = {
            lat: latitude,
            lng: longitude,
          };
        }
      }

      // =================================
      // SAVE
      // =================================

      await user.save();

      // =================================
      // RETURN UPDATED USER
      // =================================

      const safeUser =
        await User.findById(
          user._id
        ).select("-password");

      console.log(
        "PROFILE SAVED LOCATION:",
        safeUser.location
      );

      return res.json({
        success: true,
        message:
          "Profile updated successfully",
        user: safeUser,
      });

    } catch (error) {

      console.error(
        "UPDATE PROFILE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update profile",
      });
    }
  }
);

// =====================================
// LIVE LOCATION
// PUT /api/profile/location
// =====================================

router.put(
  "/location",
  authMiddleware,
  async (req, res) => {

    try {

      const latitude =
        Number(req.body.lat);

      const longitude =
        Number(req.body.lng);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid latitude and longitude are required",
        });
      }

      if (
        latitude < -90 ||
        latitude > 90
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude",
        });
      }

      if (
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid longitude",
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.userId,
          {
            $set: {
              "location.coordinates": {
                lat: latitude,
                lng: longitude,
              },
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.json({
        success: true,
        message:
          "Live location updated",
        location: user.location,
      });

    } catch (error) {

      console.error(
        "LIVE LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update location",
      });
    }
  }
);

module.exports = router;