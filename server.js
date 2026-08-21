const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const reviewRoutes = require("./routes/reviewRoutes");

dotenv.config();

const app = express();

console.log("=================================");
console.log("NEARBYFIX SERVER.JS LOADED");
console.log("=================================");

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://nearyfix.netlify.app",
  "https://www.nearyfix.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an origin
      // Postman / mobile apps / server-to-server
      if (!origin) {
        return callback(null, true);
      }

      // Allow localhost
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow Netlify deploy preview URLs
      if (
        /^https:\/\/[a-z0-9-]+--nearyfix\.netlify\.app$/.test(
          origin
        )
      ) {
        return callback(null, true);
      }

      console.log(
        "CORS BLOCKED ORIGIN:",
        origin
      );

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// =====================================================
// BODY PARSER
// =====================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// =====================================================
// REQUEST LOGGER
// =====================================================

app.use((req, res, next) => {
  console.log(
    `${req.method} ${req.originalUrl}`
  );

  next();
});

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NearbyFix API is running",
  });
});

// =====================================================
// HEALTH
// =====================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// ROUTES
// =====================================================

app.use(
  "/api/auth",
  require("./routes/authRoutes")
);

app.use(
  "/api/profile",
  require("./routes/profileRoutes")
);

app.use(
  "/api/technician",
  require("./routes/technicianRoutes")
);

app.use(
  "/api/requests",
  require("./routes/requestRoutes")
);

app.use(
  "/api/ai",
  require("./routes/aiRoutes")
);

app.use(
  "/api/admin",
  require("./routes/adminRoutes")
);

app.use("/api/reviews", reviewRoutes);

// =====================================================
// API 404
// =====================================================

app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {
  console.error(
    "================================="
  );

  console.error("GLOBAL ERROR:");
  console.error(error);

  console.error(
    "================================="
  );

  if (res.headersSent) {
    return next(error);
  }

  // CORS error
  if (
    error.message === "Not allowed by CORS"
  ) {
    return res.status(403).json({
      success: false,
      message: "CORS: Origin not allowed",
    });
  }

  // Mongoose validation error
  if (
    error.name === "ValidationError"
  ) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: Object.values(
        error.errors
      ).map((err) => err.message),
    });
  }

  // Mongoose CastError
  if (
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${error.path}`,
    });
  }

  return res.status(
    error.status || 500
  ).json({
    success: false,
    message:
      error.message ||
      "Internal server error",
  });
});

// =====================================================
// DATABASE
// =====================================================

const PORT =
  process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(
    "ERROR: MONGO_URI is missing in .env"
  );

  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error(
    "WARNING: JWT_SECRET is missing in .env"
  );
}

// =====================================================
// DATABASE MIGRATION
// =====================================================

const runMigrations = async () => {
  const users =
    mongoose.connection.collection(
      "users"
    );

  try {
    // =================================================
    // OLD ROLE MIGRATION
    // customer -> user
    // =================================================

    const roleMigration =
      await users.updateMany(
        {
          role: "customer",
        },
        {
          $set: {
            role: "user",
          },
        }
      );

    console.log(
      `Customer → User: ${roleMigration.modifiedCount}`
    );

    // =================================================
    // OLD COORDINATE MIGRATION
    // =================================================

    const oldUsers =
      await users
        .find({
          "location.coordinates": {
            $type: "array",
          },
        })
        .toArray();

    let fixed = 0;

    for (const user of oldUsers) {
      const coordinates =
        user.location?.coordinates;

      if (
        Array.isArray(coordinates) &&
        coordinates.length >= 2
      ) {
        const lng = Number(
          coordinates[0]
        );

        const lat = Number(
          coordinates[1]
        );

        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng)
        ) {
          await users.updateOne(
            {
              _id: user._id,
            },
            {
              $set: {
                "location.coordinates": {
                  lat,
                  lng,
                },
              },
            }
          );

          fixed++;
        }
      }
    }

    console.log(
      `Coordinates fixed: ${fixed}`
    );

    // =================================================
    // TECHNICIAN ACCOUNT ROLE
    // =================================================

    const technicianEmail =
      "technician@nearbyfix.com";

    const technician =
      await users.findOne({
        email: technicianEmail,
      });

    if (technician) {
      if (
        technician.role !==
        "technician"
      ) {
        await users.updateOne(
          {
            email: technicianEmail,
          },
          {
            $set: {
              role: "technician",
            },
          }
        );

        console.log(
          `Technician role updated: ${technicianEmail}`
        );
      } else {
        console.log(
          `Technician account ready: ${technicianEmail}`
        );
      }
    } else {
      console.log(
        `Technician account not found: ${technicianEmail}`
      );
    }
  } catch (error) {
    console.error(
      "Migration Error:",
      error
    );
  }
};

// =====================================================
// START DATABASE + SERVER
// =====================================================

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(
      "MongoDB connected successfully"
    );

    await runMigrations();

    app.listen(PORT, () => {
      console.log(
        "================================="
      );

      console.log(
        `NearbyFix backend running on port ${PORT}`
      );

      console.log(
        `http://localhost:${PORT}`
      );

      console.log(
        "================================="
      );
    });
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);
  });

// =====================================================
// UNHANDLED ERRORS
// =====================================================

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "UNHANDLED REJECTION:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );

    process.exit(1);
  }
);