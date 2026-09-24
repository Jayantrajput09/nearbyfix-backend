const express = require("express");

const cors = require("cors");

const dotenv = require("dotenv");

const mongoose = require("mongoose");

const http = require("http");

const { Server } = require("socket.io");

const reviewRoutes = require("./routes/reviewRoutes");

dotenv.config();

const app = express();

// =====================================================
// HTTP SERVER
// =====================================================

const server = http.createServer(app);

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

    // Capacitor Android app
  "https://localhost",

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
// SOCKET.IO
// =====================================================

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests without an origin

      if (!origin) {
        return callback(null, true);
      }

      // Allow localhost and main Netlify URLs

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
        "SOCKET CORS BLOCKED ORIGIN:",
        origin
      );

      return callback(
        new Error(
          "Not allowed by Socket.IO CORS"
        )
      );
    },

    credentials: true,
  },
});

// =====================================================
// SOCKET.IO AUTHENTICATION
// =====================================================

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication token missing")
      );
    }

    const decoded =
      require("jsonwebtoken").verify(
        token,
        process.env.JWT_SECRET
      );

    socket.userId = decoded.id;
    socket.userRole = decoded.role;

    next();
  } catch (error) {
    console.error(
      "SOCKET AUTH ERROR:",
      error.message
    );

    next(
      new Error("Invalid or expired token")
    );
  }
});

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on("connection", (socket) => {
  console.log(
    "SOCKET CONNECTED:",
    socket.userId,
    socket.userRole
  );

  // ===================================================
  // JOIN CHAT ROOM
  // ===================================================

  socket.on(
    "joinChat",
    async (requestId, callback) => {
      try {
        if (!requestId) {
          return callback?.({
            success: false,
            message: "Request ID is required",
          });
        }

        const ServiceRequest = require(
          "./models/ServiceRequest"
        );

        const request =
          await ServiceRequest.findById(
            requestId
          );

        if (!request) {
          return callback?.({
            success: false,
            message: "Service request not found",
          });
        }

        // Chat is available only after
        // a technician has been assigned.

        if (!request.technician) {
          return callback?.({
            success: false,
            message:
              "Chat is not available until a technician accepts the request",
          });
        }

        const currentUserId =
          String(socket.userId);

        const isCustomer =
          String(request.user) ===
          currentUserId;

        const isTechnician =
          String(request.technician) ===
          currentUserId;

        // Only the customer and assigned
        // technician can enter this room.

        if (
          !isCustomer &&
          !isTechnician
        ) {
          return callback?.({
            success: false,
            message:
              "You are not authorized to access this chat",
          });
        }

        const roomName =
          `request:${requestId}`;

        socket.join(roomName);

        console.log(
          `SOCKET JOINED CHAT: ${currentUserId} -> ${roomName}`
        );

        return callback?.({
          success: true,
          message: "Joined chat successfully",
          room: roomName,
        });
      } catch (error) {
        console.error(
          "JOIN CHAT ERROR:",
          error
        );

        return callback?.({
          success: false,
          message:
            "Failed to join chat",
        });
      }
    }
  );

  socket.on(
  "sendMessage",
  async (data, callback) => {
    try {
      const { requestId, message } = data || {};

      if (!requestId) {
        return callback?.({
          success: false,
          message: "Request ID is required",
        });
      }

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return callback?.({
          success: false,
          message: "Message cannot be empty",
        });
      }

      const cleanMessage = message.trim();

      if (cleanMessage.length > 1000) {
        return callback?.({
          success: false,
          message:
            "Message cannot exceed 1000 characters",
        });
      }

      const ServiceRequest = require(
        "./models/ServiceRequest"
      );

      const Message = require(
        "./models/Message"
      );

      const request =
        await ServiceRequest.findById(requestId);

      if (!request) {
        return callback?.({
          success: false,
          message: "Service request not found",
        });
      }

      if (!request.technician) {
        return callback?.({
          success: false,
          message:
            "Chat is not available until a technician accepts the request",
        });
      }

      const currentUserId =
        String(socket.userId);

      const isCustomer =
        String(request.user) === currentUserId;

      const isTechnician =
        String(request.technician) ===
        currentUserId;

      if (!isCustomer && !isTechnician) {
        return callback?.({
          success: false,
          message:
            "You are not authorized to send messages in this chat",
        });
      }

      const newMessage =
        await Message.create({
          request: requestId,
          sender: socket.userId,
          message: cleanMessage,
        });

      const populatedMessage =
        await Message.findById(
          newMessage._id
        ).populate(
          "sender",
          "name role profilePhoto"
        );

      const roomName =
        `request:${requestId}`;

      io.to(roomName).emit(
        "newMessage",
        populatedMessage
      );

      return callback?.({
        success: true,
        message: populatedMessage,
      });
    } catch (error) {
      console.error(
        "SOCKET SEND MESSAGE ERROR:",
        error
      );

      return callback?.({
        success: false,
        message: "Failed to send message",
      });
    }
  }
);

  // ===================================================
  // DISCONNECT
  // ===================================================

  socket.on("disconnect", (reason) => {
    console.log(
      "SOCKET DISCONNECTED:",
      socket.userId,
      reason
    );
  });
});
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

app.use(
  "/api/chat",
  require("./routes/chatRoutes")
);

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

    // =================================================
    // START HTTP + SOCKET.IO SERVER
    // =================================================

    server.listen(PORT, () => {
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