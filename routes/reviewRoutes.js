const express = require("express");

const router = express.Router();

const {
  createReview,
  getTechnicianReviews,
  getMyReviews,
  getAllReviews,
  deleteReview,
} = require("../controllers/reviewController");

const authMiddleware = require(
  "../middleware/authMiddleware"
);


// =====================================
// CREATE REVIEW
// USER
// =====================================

router.post(
  "/",
  authMiddleware,
  createReview
);


// =====================================
// GET TECHNICIAN REVIEWS
// PUBLIC
// =====================================

router.get(
  "/technician/:technicianId",
  getTechnicianReviews
);


// =====================================
// MY REVIEWS
// USER
// =====================================

router.get(
  "/my",
  authMiddleware,
  getMyReviews
);


// =====================================
// ADMIN - GET ALL REVIEWS
// =====================================

router.get(
  "/admin",
  authMiddleware,
  (req, res, next) => {
    if (req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  },
  getAllReviews
);


// =====================================
// ADMIN - DELETE REVIEW
// =====================================

router.delete(
  "/admin/:reviewId",
  authMiddleware,
  (req, res, next) => {
    if (req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  },
  deleteReview
);


module.exports = router;