
import mongoose from "mongoose";

const roleRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },

    currentRole: {
      type: String,
      enum: ["patient", "doctor", "receptionist"],
      required: true,
    },

    requestedRole: {
      type: String,
      enum: ["doctor", "receptionist"],
      required: true,
    },

    reason: {
      type: String,
      required: [true, "Reason for role change is required"],
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const RoleRequest = mongoose.model("RoleRequest", roleRequestSchema);

export default RoleRequest;
