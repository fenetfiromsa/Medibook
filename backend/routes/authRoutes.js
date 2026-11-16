import { verifyCaptcha } from "../middleware/captchaMiddleware.js";
import express from "express";
import {
  requestPasswordReset,
  resetPassword
} from "../controllers/authController.js";
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimitMiddleware.js";
import {
  registerUser,
  loginUser,
} from "../controllers/authController.js";

import {
  verifyEmail
} from "../controllers/authController.js";
const router = express.Router();
router.post(
  "/register",
  registerLimiter,
  verifyCaptcha,
  registerUser
);
router.post("/login", loginLimiter, loginUser);
router.post(
  "/forgot-password",
  passwordResetLimiter,
  requestPasswordReset
);

router.post(
  "/reset-password/:token",
  passwordResetLimiter,
  resetPassword
);
router.get("/verify-email/:token", verifyEmail);
export default router;