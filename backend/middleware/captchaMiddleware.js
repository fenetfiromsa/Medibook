export const verifyCaptcha = async (req, res, next) => {
  try {
    const { captchaToken } = req.body;

    if (!captchaToken) {
      return res.status(400).json({
        message: "CAPTCHA verification is required.",
      });
    }

    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: captchaToken,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      return res.status(403).json({
        message: "CAPTCHA verification failed.",
      });
    }

    next();

  } catch (error) {
    console.error("CAPTCHA error:", error.message);

    return res.status(500).json({
      message: "CAPTCHA verification unavailable.",
    });
  }
};