// module.exports = (schema) => {
//   return (req, res, next) => {

//     const { error } = schema.validate(req.body);

//     if (error) {
//       return res.status(400).json({
//         success: false,
//         message: error.details[0].message
//       });
//     }

//     next();
//   };
// };


// middlewares/validate.middleware.js
// source = "body" (default) | "query" | "params"

module.exports = (schema, source = "body") => {
  return (req, res, next) => {

    const { error, value } = schema.validate(req[source], {
      abortEarly: true,   // pehli error pe ruk jao
      allowUnknown: false // extra fields allow nahi
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Validated + default values wapas req mein daal do
    req[source] = value;

    next();
  };
};