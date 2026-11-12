import mongoose from "mongoose";

const securityAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, "Alert type is required"],
      enum: [
        "multiple_failed_logins",
        "account_locked",
        "suspicious_activity",
        "unauthorized_access",
        "role_change",
        "other",
      ],
    },

    description: {
      type: String,
      required: [true, "Alert description is required"],
      trim: true,
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    relatedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: ["open", "investigating", "resolved"],
      default: "open",
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const SecurityAlert = mongoose.model("SecurityAlert", securityAlertSchema);

export default SecurityAlert;