import express from "express";

import { protect } from "../middleware/authMiddleware.js";

import {
  authorizeRoles
} from "../middleware/roleMiddleware.js";

import {
  getPublicData,
  getProtectedData,
  getAdminData,
  getDoctorData,
  getReceptionistData,
  getPatientData,
  getAuditorData
} from "../controllers/testController.js";

const router = express.Router();

// Public route
router.get("/public", getPublicData);

// Any authenticated user
router.get("/protected", protect, getProtectedData);

// Admin only
router.get(
  "/admin",
  protect,
  authorizeRoles("admin"),
  getAdminData
);

// Doctor only
router.get(
  "/doctor",
  protect,
  authorizeRoles("doctor"),
  getDoctorData
);

// Receptionist only
router.get(
  "/receptionist",
  protect,
  authorizeRoles("receptionist"),
  getReceptionistData
);

// Patient only
router.get(
  "/patient",
  protect,
  authorizeRoles("patient"),
  getPatientData
);

// Security auditor only
router.get(
  "/auditor",
  protect,
  authorizeRoles("security_auditor"),
  getAuditorData
);

export default router;