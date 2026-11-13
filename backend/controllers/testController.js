export const getPublicData = (req, res) => {
  res.status(200).json({
    message: "This is a public route.",
  });
};

export const getProtectedData = (req, res) => {
  res.status(200).json({
    message: "You are authenticated.",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

export const getAdminData = (req, res) => {
  res.status(200).json({
    message: "Welcome, administrator.",
  });
};

export const getDoctorData = (req, res) => {
  res.status(200).json({
    message: "Welcome, doctor.",
  });
};

export const getReceptionistData = (req, res) => {
  res.status(200).json({
    message: "Welcome, receptionist.",
  });
};

export const getPatientData = (req, res) => {
  res.status(200).json({
    message: "Welcome, patient.",
  });
};

export const getAuditorData = (req, res) => {
  res.status(200).json({
    message: "Welcome, security auditor.",
  });
};