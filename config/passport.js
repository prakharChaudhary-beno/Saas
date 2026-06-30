const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../modules/auth/models/user.model");

console.log("GOOGLE CALLBACK URL:", process.env.GOOGLE_REDIRECT_URI); // ✅ bahar nikalo

passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_REDIRECT_URI
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const existingUser = await User.findOne({ email, isDeleted: false })
        .populate("roleId");

      if (existingUser) {

        // googleId save karo agar pehli baar Google se login kar raha hai
        if (!existingUser.googleId) {
          existingUser.googleId = profile.id;
        }

        // INACTIVE hai toh ACTIVE karo — Google ne email verify kar di hai
        if (existingUser.status === "INACTIVE") {
          existingUser.status = "ACTIVE";
          existingUser.isEmailVerified = true;
        }

        existingUser.isNewUser = false;
        await existingUser.save();

        return done(null, existingUser);
      }

      // Naya user — sirf object return karo (controller handle karega)
      return done(null, {
        email,
        firstName: profile.displayName,
        googleId:  profile.id,
        isNewUser: true
      });

    } catch (error) {
      done(error, null);
    }
  }
));

module.exports = passport;