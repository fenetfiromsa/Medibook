
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true, //removes the space 
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,//not to include the pass in normal queries
    },

    role: {
      type: String,
      enum: [ //enum means user can only have one
        "admin",
        "doctor",
        "receptionist",
        "patient",
        "security_auditor",
      ],
      default: "patient",
    },

    isActive: {
      type: Boolean,
      default: true, // initially active
    },

    isEmailVerified: {
      type: Boolean,
      default: false, // initially not verified
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,//created at and updated at 
  }
);

const User = mongoose.model("User", userSchema);

export default User;
