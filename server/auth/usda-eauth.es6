'use strict';

let express = require('express');
let passport = require('passport');
let SamlStrategy = require('passport-saml').Strategy;
let vcapServices = require('../vcap-services.es6');

let eAuth = {};

eAuth.loginPath = '/auth/usda-eauth/saml/login';
eAuth.callbackPath = '/auth/usda-eauth/saml/callback';

passport.use(
  new SamlStrategy(
    {
      path: vcapServices.baseUrl + eAuth.callbackPath,
      entryPoint: `${vcapServices.eAuthEntryPoint}?SPID=${vcapServices.eAuthIssuer}`,
      issuer: vcapServices.eAuthIssuer,
      privateCert: vcapServices.eAuthPrivateKey,
      cert: vcapServices.eAuthCert
    },
    (profile, done) => {
      return done(null, {
        email: profile.usdaemail,
        role: 'admin'
      });
    }
  )
);

// router for eAuth specific endpoints
eAuth.router = express.Router();

eAuth.router.get(eAuth.loginPath, (req, res) => {
  res.redirect(`${vcapServices.eAuthEntryPoint}?SPID=${vcapServices.eAuthIssuer}`);
});

eAuth.router.post(
  eAuth.callbackPath,
  passport.authenticate('saml', {
    successRedirect: vcapServices.intakeClientBaseUrl + '/logged-in'
  })
);

module.exports = eAuth;
