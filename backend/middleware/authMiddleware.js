import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check whether the Authorization header contains a Bearer token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Reject requests without a token
    if (!token) {
      return res.status(401).json({
        message: "Not authorized. No token provided.",
      });
    }

    // Verify the JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Find the user in MongoDB
    const user = await User.findById(decoded.id);

    // Check whether the account exists
    if (!user) {
      return res.status(401).json({
        message: "User not found.",
      });
    }

    // Check whether the account is active
    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account has been disabled.",
      });
    }

    // Attach the authenticated user to the request
    req.user = user;

    // Continue to the next middleware or controller
    next();

  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired token.",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      message: "Authentication failed.",
    });
  }
};