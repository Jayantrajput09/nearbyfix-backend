const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ===============================
// GET PROFILE
// ===============================
const getProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// ===============================
// UPDATE PROFILE
// ===============================
const updateProfile = async (req, res) => {
  try {
    console.log("PROFILE UPDATE REQUEST");
    console.log(req.body);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const {
      name,
      phone,
      address,
      city,
      state,
      pincode,
      lat,
      lng,
    } = req.body;

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Personal information
    if (name !== undefined) {
      user.name = name;
    }

    if (phone !== undefined) {
      user.phone = phone;
    }

    // Location
    user.location = {
      address: address || "",
      city: city || "",
      state: state || "",
      pincode: pincode || "",
      coordinates: {
        lat:
          lat !== null &&
          lat !== undefined &&
          lat !== ""
            ? Number(lat)
            : null,

        lng:
          lng !== null &&
          lng !== undefined &&
          lng !== ""
            ? Number(lng)
            : null,
      },
    };

    await user.save();

    console.log("PROFILE UPDATED:", user._id);

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        location: user.location,
      },
    });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};