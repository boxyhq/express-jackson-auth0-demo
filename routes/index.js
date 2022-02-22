var express = require("express");
var router = express.Router();

let apiController;
let oauthController;

const jacksonOptions = {
  externalUrl: process.env.APP_URL,
  samlAudience: process.env.SAML_AUDIENCE,
  samlPath: "/sso/acs",
  db: {
    engine: "sql",
    type: "postgres",
    url: process.env.DATABASE_URL,
  },
};

(async function init() {
  const jackson = await require("@boxyhq/saml-jackson").controllers(
    jacksonOptions
  );

  apiController = jackson.apiController;
  oauthController = jackson.oauthController;
})();

router.get("/config", async (req, res) => {
  res.render("config");
});

router.post("/config", async (req, res, next) => {
  const { rawMetadata, tenant, product } = req.body;

  const defaultRedirectUrl = "http://localhost:3000/sso/callback";
  const redirectUrl = '["http://localhost:3000/*"]';

  try {
    await apiController.config({
      rawMetadata,
      tenant,
      product,
      defaultRedirectUrl,
      redirectUrl,
    });

    res.redirect("/config");
  } catch (err) {
    next(err);
  }
});

router.get("/sso/authorize", async (req, res, next) => {
  try {
    const tenant = "boxyhq.com";
    const product = "crm";

    const body = {
      response_type: "code",
      client_id: `tenant=${tenant}&product=${product}`,
      redirect_uri: "http://localhost:3000/sso/callback",
      state: "a-random-state-value",
    };

    const { redirect_url } = await oauthController.authorize(body);

    res.redirect(redirect_url);
  } catch (err) {
    next(err);
  }
});

router.post("/sso/acs", async (req, res, next) => {
  try {
    const { SAMLResponse, RelayState } = req.body;

    const body = {
      SAMLResponse,
      RelayState,
    };

    const { redirect_url } = await oauthController.samlResponse(body);

    res.redirect(redirect_url);
  } catch (err) {
    next(err);
  }
});

router.get("/sso/callback", async (req, res, next) => {
  const { code } = req.query;

  const tenant = "boxyhq.com";
  const product = "crm";

  const body = {
    code,
    client_id: `tenant=${tenant}&product=${product}`,
    client_secret: "client_secret",
  };

  try {
    // Get the access token
    const { access_token } = await oauthController.token(body);

    // Get the user information
    const profile = await oauthController.userInfo(access_token);

    // Add the profile to the express session
    req.session.profile = profile;

    res.redirect("/dashboard");
  } catch (err) {
    next(err);
  }
});

router.get("/dashboard", function (req, res, next) {
  const { profile } = req.session;

  if (profile === undefined) {
    return res.redirect("/");
  }

  // Pass the profile to the view
  res.render("dashboard", {
    profile,
  });
});

// GET - Home
router.get("/", function (req, res, next) {
  res.render("index");
});

module.exports = router;
