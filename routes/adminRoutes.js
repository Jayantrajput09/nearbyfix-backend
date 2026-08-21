const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const ServiceRequest = require("../models/ServiceRequest");

const adminMiddleware = require(
  "../middleware/adminMiddleware"
);

const router = express.Router();


// =====================================
// VALIDATE USER ID
// =====================================

const validateUserId = (
  req,
  res,
  next
) => {
  if (
    !mongoose.Types.ObjectId.isValid(
      req.params.id
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID",
    });
  }

  next();
};


// =====================================
// ADMIN DASHBOARD STATS
// GET /api/admin/stats
// =====================================

router.get(
  "/stats",
  adminMiddleware,
  async (req, res) => {
    try {
      const [
        totalUsers,
        totalCustomers,
        totalTechnicians,
        totalAdmins,
        blockedUsers,
        totalRequests,
        pendingRequests,
        completedRequests,
      ] = await Promise.all([

        User.countDocuments(),

        User.countDocuments({
          role: "user",
        }),

        User.countDocuments({
          role: "technician",
        }),

        User.countDocuments({
          role: "admin",
        }),

        User.countDocuments({
          isBlocked: true,
        }),

        ServiceRequest.countDocuments(),

        ServiceRequest.countDocuments({
          status: "pending",
        }),

        ServiceRequest.countDocuments({
          status: "completed",
        }),

      ]);

      return res.status(200).json({
        success: true,

        stats: {
          totalUsers,
          totalCustomers,
          totalTechnicians,
          totalAdmins,
          blockedUsers,
          totalRequests,
          pendingRequests,
          completedRequests,
        },
      });

    } catch (error) {
      console.error(
        "ADMIN STATS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load admin statistics",
      });
    }
  }
);


// =====================================
// GET ALL USERS
// GET /api/admin/users
// =====================================

router.get(
  "/users",
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        search = "",
        role = "",
        status = "",
      } = req.query;

      const filter = {};

      // SEARCH NAME / EMAIL / PHONE
      if (search.trim()) {
        filter.$or = [
          {
            name: {
              $regex: search.trim(),
              $options: "i",
            },
          },
          {
            email: {
              $regex: search.trim(),
              $options: "i",
            },
          },
          {
            phone: {
              $regex: search.trim(),
              $options: "i",
            },
          },
        ];
      }

      // FILTER ROLE
      if (
        [
          "user",
          "technician",
          "admin",
        ].includes(role)
      ) {
        filter.role = role;
      }

      // FILTER STATUS
      if (status === "blocked") {
        filter.isBlocked = true;
      }

      if (status === "active") {
        filter.isBlocked = false;
      }

      const users =
        await User.find(filter)
          .select("-password")
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        count: users.length,
        users,
      });

    } catch (error) {
      console.error(
        "GET ADMIN USERS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load users",
      });
    }
  }
);


// =====================================
// BLOCK USER
// PUT /api/admin/users/:id/block
// =====================================

router.put(
  "/users/:id/block",
  adminMiddleware,
  validateUserId,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // ADMIN CANNOT BLOCK SELF
      if (
        user._id.toString() ===
        req.user._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot block your own admin account",
        });
      }

      user.isBlocked = true;

      await user.save();

      return res.status(200).json({
        success: true,
        message:
          "User blocked successfully",
      });

    } catch (error) {
      console.error(
        "BLOCK USER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to block user",
      });
    }
  }
);


// =====================================
// UNBLOCK USER
// PUT /api/admin/users/:id/unblock
// =====================================

router.put(
  "/users/:id/unblock",
  adminMiddleware,
  validateUserId,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.isBlocked = false;

      await user.save();

      return res.status(200).json({
        success: true,
        message:
          "User unblocked successfully",
      });

    } catch (error) {
      console.error(
        "UNBLOCK USER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to unblock user",
      });
    }
  }
);


// =====================================
// DELETE USER
// DELETE /api/admin/users/:id
// =====================================

router.delete(
  "/users/:id",
  adminMiddleware,
  validateUserId,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // ADMIN CANNOT DELETE SELF
      if (
        user._id.toString() ===
        req.user._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot delete your own admin account",
        });
      }

      // DELETE RELATED REQUESTS
      await ServiceRequest.deleteMany({
        $or: [
          {
            user: user._id,
          },
          {
            technician: user._id,
          },
        ],
      });

      // DELETE USER
      await User.findByIdAndDelete(
        user._id
      );

      return res.status(200).json({
        success: true,
        message:
          "User deleted successfully",
      });

    } catch (error) {
      console.error(
        "DELETE USER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete user",
      });
    }
  }
);


// =====================================
// GET ALL SERVICE REQUESTS
// GET /api/admin/requests
// =====================================

router.get(
  "/requests",
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        status = "",
        search = "",
      } = req.query;

      const filter = {};

      if (status) {
        filter.status = status;
      }

      const requests =
        await ServiceRequest.find(filter)
          .populate(
            "user",
            "name email phone profilePhoto"
          )
          .populate(
            "technician",
            "name email phone profilePhoto"
          )
          .sort({
            createdAt: -1,
          });

      let filteredRequests =
        requests;

      if (search.trim()) {
        const searchText =
          search.toLowerCase();

        filteredRequests =
          requests.filter((request) => {
            return (
              request.title
                ?.toLowerCase()
                .includes(searchText) ||

              request.serviceType
                ?.toLowerCase()
                .includes(searchText) ||

              request.user?.name
                ?.toLowerCase()
                .includes(searchText) ||

              request.technician?.name
                ?.toLowerCase()
                .includes(searchText)
            );
          });
      }

      return res.status(200).json({
        success: true,
        count:
          filteredRequests.length,
        requests:
          filteredRequests,
      });

    } catch (error) {
      console.error(
        "GET ADMIN REQUESTS ERROR:",
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


module.exports = router;