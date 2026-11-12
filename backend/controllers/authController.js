
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

// Create a JWT for the authenticated user
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    }
  );
};

// Save an audit log without allowing logging errors
// to interrupt the authentication process.
const createAuditLog = async (data) => {
  try {
    await AuditLog.create(data);
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
};

// =====================================
// REGISTER USER
// POST /api/auth/register
// =====================================

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string") {
      return res.status(400).json({
        message: "Invalid input format",
      });
    }

    if (!name.trim()) {
      return res.status(400).json({
        message: "Name cannot be empty",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    // Check whether the email is already registered
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    // Hash password before storing it
    const hashedPassword = await bcrypt.hash(password, 12);

    // Public registration always creates a patient.
    // Users cannot choose their own privileged role.
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    // Record successful registration
    await createAuditLog({
      user: user._id,
      action: "USER_REGISTERED",
      resource: "User",
      resourceId: user._id,
      ipAddress: req.ip,
      status: "success",
    });

    // Generate authentication token
    const token = generateToken(user);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handles duplicate email errors caused by
    // simultaneous registration requests.
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    return res.status(500).json({
      message: "Server error during registration",
    });
  }
};

// =====================================
// LOGIN USER
// POST /api/auth/login
// =====================================

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password ||
        typeof email !== "string" ||
        typeof password !== "string") {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Password is excluded by default in User.js.
    // Explicitly include it for password comparison.
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      await createAuditLog({
        action: "FAILED_LOGIN",
        resource: "User",
        ipAddress: req.ip,
        status: "failure",
        details: "Login attempt with unknown email",
      });

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Reject disabled accounts
    if (!user.isActive) {
      return res.status(403).json({
        message: "This account is disabled",
      });
    }

    // Check whether the account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({
        message: "Account temporarily locked. Try again later.",
      });
    }

    // Clear an expired lock
    if (user.lockUntil && user.lockUntil <= new Date()) {
      user.lockUntil = null;
      user.failedLoginAttempts = 0;
    }

    // Compare entered password with stored hash
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      user.failedLoginAttempts += 1;

      // Lock account after five consecutive failures
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }

      await user.save();

      await createAuditLog({
        user: user._id,
        action: "FAILED_LOGIN",
        resource: "User",
        resourceId: user._id,
        ipAddress: req.ip,
        status: "failure",
      });

      if (user.lockUntil) {
        return res.status(423).json({
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Successful login: reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    // Record successful login
    await createAuditLog({
      user: user._id,
      action: "USER_LOGIN",
      resource: "User",
      resourceId: user._id,
      ipAddress: req.ip,
      status: "success",
    });

    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Server error during login",
    });
  }
};
