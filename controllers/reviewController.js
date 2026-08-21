const Review = require("../models/Review");
const ServiceRequest = require("../models/ServiceRequest");
const User = require("../models/User");

// =====================================
// CREATE REVIEW
// =====================================

const createReview = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      serviceRequestId,
      rating,
      comment,
    } = req.body;

    if (!serviceRequestId) {
      return res.status(400).json({
        success: false,
        message: "Service request ID is required",
      });
    }

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Rating must be a whole number between 1 and 5",
      });
    }

    // =====================================
    // FIND REQUEST
    // =====================================

    const serviceRequest =
      await ServiceRequest.findById(
        serviceRequestId
      );

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    // =====================================
    // ONLY REQUEST OWNER
    // =====================================

    if (
      serviceRequest.user.toString() !==
      userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only review your own service",
      });
    }

    // =====================================
    // MUST BE COMPLETED
    // =====================================

    if (
      serviceRequest.status !==
      "completed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You can review the technician only after service is completed",
      });
    }

    // =====================================
    // TECHNICIAN CHECK
    // =====================================

    if (!serviceRequest.technician) {
      return res.status(400).json({
        success: false,
        message:
          "No technician is assigned to this service",
      });
    }

    // =====================================
    // CHECK EXISTING REVIEW
    // =====================================

    const existingReview =
      await Review.findOne({
        serviceRequest:
          serviceRequestId,
      });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message:
          "You have already reviewed this service",
      });
    }

    // =====================================
    // CREATE REVIEW
    // =====================================

    const review =
      await Review.create({
        serviceRequest:
          serviceRequestId,

        user: userId,

        technician:
          serviceRequest.technician,

        rating: numericRating,

        comment:
          String(comment || "").trim(),
      });

    // =====================================
    // UPDATE TECHNICIAN RATING
    // =====================================

    const technician =
      await User.findById(
        serviceRequest.technician
      );

    if (technician) {
      const oldTotal =
        technician.totalReviews || 0;

      const oldRating =
        technician.rating || 0;

      const newTotal =
        oldTotal + 1;

      const newAverage =
        (
          oldRating * oldTotal +
          numericRating
        ) / newTotal;

      technician.totalReviews =
        newTotal;

      technician.rating =
        Number(
          newAverage.toFixed(2)
        );

      await technician.save();
    }

    // =====================================
    // RESPONSE
    // =====================================

    const populatedReview =
      await Review.findById(
        review._id
      )
        .populate(
          "user",
          "name profilePhoto"
        )
        .populate(
          "technician",
          "name profilePhoto rating totalReviews"
        );

    return res.status(201).json({
      success: true,
      message:
        "Review submitted successfully",
      review: populatedReview,
    });

  } catch (error) {
    console.error(
      "CREATE REVIEW ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit review",
      error: error.message,
    });
  }
};


// =====================================
// GET TECHNICIAN REVIEWS
// =====================================

const getTechnicianReviews =
  async (req, res) => {
    try {
      const {
        technicianId,
      } = req.params;

      const reviews =
        await Review.find({
          technician:
            technicianId,
        })
          .populate(
            "user",
            "name profilePhoto"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        reviews,
      });

    } catch (error) {
      console.error(
        "GET TECHNICIAN REVIEWS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch reviews",
      });
    }
  };


// =====================================
// MY REVIEWS
// =====================================

const getMyReviews =
  async (req, res) => {
    try {
      const userId = req.userId;

      const reviews =
        await Review.find({
          user: userId,
        })
          .populate(
            "technician",
            "name profilePhoto rating totalReviews"
          )
          .populate(
            "serviceRequest",
            "title serviceType status"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        reviews,
      });

    } catch (error) {
      console.error(
        "GET MY REVIEWS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch your reviews",
      });
    }
  };


// =====================================
// ADMIN - ALL REVIEWS
// =====================================

const getAllReviews =
  async (req, res) => {
    try {
      const reviews =
        await Review.find()
          .populate(
            "user",
            "name email"
          )
          .populate(
            "technician",
            "name email rating totalReviews"
          )
          .populate(
            "serviceRequest",
            "title serviceType status"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        reviews,
      });

    } catch (error) {
      console.error(
        "GET ALL REVIEWS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch all reviews",
      });
    }
  };


// =====================================
// ADMIN - DELETE REVIEW
// =====================================

const deleteReview =
  async (req, res) => {
    try {
      const {
        reviewId,
      } = req.params;

      const review =
        await Review.findById(
          reviewId
        );

      if (!review) {
        return res.status(404).json({
          success: false,
          message:
            "Review not found",
        });
      }

      const technician =
        await User.findById(
          review.technician
        );

      await Review.findByIdAndDelete(
        reviewId
      );

      // =====================================
      // RECALCULATE RATING
      // =====================================

      if (technician) {
        const remainingReviews =
          await Review.find({
            technician:
              technician._id,
          }).select("rating");

        const total =
          remainingReviews.length;

        if (total === 0) {
          technician.rating = 0;
          technician.totalReviews = 0;
        } else {
          const sum =
            remainingReviews.reduce(
              (totalRating, item) =>
                totalRating +
                item.rating,
              0
            );

          technician.rating =
            Number(
              (sum / total).toFixed(2)
            );

          technician.totalReviews =
            total;
        }

        await technician.save();
      }

      return res.status(200).json({
        success: true,
        message:
          "Review deleted successfully",
      });

    } catch (error) {
      console.error(
        "DELETE REVIEW ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete review",
      });
    }
  };


module.exports = {
  createReview,
  getTechnicianReviews,
  getMyReviews,
  getAllReviews,
  deleteReview,
};