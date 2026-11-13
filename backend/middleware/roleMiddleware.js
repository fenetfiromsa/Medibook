export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {

    // Check whether authentication middleware ran first
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // Check whether the user's role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied. You do not have permission.",
      });
    }

    // Allow access
    next();
  };
};