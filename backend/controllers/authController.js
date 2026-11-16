import crypto from "crypto";
import User from "../models/User.js";
import { sendEmail } from "../utils/emailService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
      tokenVersion: user.tokenVersion,
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
      role: "patient",
    });
    await sendVerificationEmail(user);

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
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
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

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    // Use the same response whether or not the account exists.
    if (!user) {
      return res.status(200).json({
        message: "If the account exists, a reset email will be sent.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.passwordResetToken = hashedToken;

    user.passwordResetExpires =
      Date.now() + 15 * 60 * 1000;

    await user.save();

    const resetUrl =
      `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "MediBook Password Reset",
        html: `
          <h2>Password Reset</h2>
          <p>You requested a password reset.</p>
          <p>This link expires in 15 minutes.</p>
          <a href="${resetUrl}">Reset Password</a>
        `,
      });
    } catch (emailError) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      throw emailError;
    }

    return res.status(200).json({
      message: "If the account exists, a reset email will be sent.",
    });

  } catch (error) {
    console.error("Password reset request error:", error.message);

    return res.status(500).json({
      message: "Unable to process password reset.",
    });
  }
};


export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset link.",
      });
    }

    user.password = await bcrypt.hash(password, 12);

    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    // Reset failed login attempts after a successful password reset.
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.tokenVersion += 1;

    await user.save();

    return res.status(200).json({
      message: "Password reset successful. Please log in again.",
    });

  } catch (error) {
    console.error("Password reset error:", error.message);

    return res.status(500).json({
      message: "Unable to reset password.",
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification link.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await user.save();

    return res.status(200).json({
      message: "Email verified successfully.",
    });

  } catch (error) {
    console.error("Email verification error:", error.message);

    return res.status(500).json({
      message: "Unable to verify email.",
    });
  }
};
export const sendVerificationEmail = async (user) => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  user.emailVerificationToken = hashedToken;

  user.emailVerificationExpires =
    Date.now() + 24 * 60 * 60 * 1000;

  await user.save();

  const verificationUrl =
    `${process.env.FRONTEND_URL}/verify-email/${rawToken}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your MediBook email",
    html: `
      <h2>Welcome to MediBook</h2>
      <p>Please verify your email address.</p>
      <p>This link expires in 24 hours.</p>
      <a href="${verificationUrl}">Verify Email</a>
    `,
  });
};