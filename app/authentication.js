var passport = require('passport');
var OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
var graph = require('./graph');

// In-memory storage of logged-in users
// For demo purposes only, production apps should store
// this in a reliable storage
var users = {};

// Configure simple-oauth2
const { ClientCredentials, ResourceOwnerPassword, AuthorizationCode } = require('simple-oauth2');
const oauth2Config = {
    client: {
        id: process.env.OAUTH_APP_ID,
        secret: process.env.OAUTH_APP_PASSWORD
    },
    auth: {
        tokenHost: process.env.OAUTH_AUTHORITY,
        authorizePath: process.env.OAUTH_AUTHORIZE_ENDPOINT,
        tokenPath: process.env.OAUTH_TOKEN_ENDPOINT
    }
};


// Callback function called once the sign-in is complete
// and an access token has been obtained
async function signInComplete(iss, sub, profile, accessToken, refreshToken, params, done) {
    console.log("LOGIN: signInComplete...");
    if (!profile.oid) {
        return done(new Error("No OID found in user profile."));
    }

    // Create a simple-oauth2 token from raw tokens
    const oauth2client = new ClientCredentials(oauth2Config);
    let oauthToken = await oauth2client.createToken(params);

    // Save the profile and tokens in user storage
    users[profile.oid] = { profile, oauthToken };
    console.log("LOGIN: signInComplete: token set in user storage.");
    return done(null, users[profile.oid]);
}



function configurePassport() {
    console.log("Configuring passport");

    // Configure passport

    // Passport calls serializeUser and deserializeUser to
    // manage users
    passport.serializeUser(function (user, done) {
        // Use the OID property of the user as a key
        users[user.profile.oid] = user;
        done(null, user.profile.oid);
    });

    passport.deserializeUser(function (id, done) {
        done(null, users[id]);
    });

    // Configure OIDC strategy
    passport.use(new OIDCStrategy(
        {
            identityMetadata: `${process.env.OAUTH_AUTHORITY}${process.env.OAUTH_ID_METADATA}`,
            clientID: process.env.OAUTH_APP_ID,
            responseType: 'code id_token',
            responseMode: 'form_post',
            redirectUrl: process.env.OAUTH_REDIRECT_URI,
            allowHttpForRedirectUrl: true, // TODO: for prod this should be false
            clientSecret: process.env.OAUTH_APP_PASSWORD,
            validateIssuer: false,
            passReqToCallback: false,
            scope: process.env.OAUTH_SCOPES.split(' '),
            useCookieInsteadOfSession: true,
            cookieEncryptionKeys: [
                { 'key': process.env.OAUTH_COOKIE_KEY, 'iv': process.env.OAUTH_COOKIE_IV },
            ]
        },
        signInComplete
    ));
}

module.exports = {
    configurePassport
};