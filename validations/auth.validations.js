const Joi = require("joi");

const superAdminLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Email must be valid"
    }),

  password: Joi.string()
    .min(6)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 6 characters"
    })
});
const tenantLoginSchema = Joi.object({

  email: Joi.string()
    .email()
    .required(),

  password: Joi.string()
    .min(6)
    .required()

});
const createRoleSchema = Joi.object({

  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Role name is required"
    }),

  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z_]+$/)
    .required()
    .messages({
      "string.pattern.base": "Slug must contain only lowercase letters and underscores"
    }),

  description: Joi.string()
    .allow("")
    .optional(),
    level: Joi.string()
    .valid("org", "company", "unit")
    .required(),

  permissions: Joi.array()
    .items(
      Joi.string().hex().length(24)
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one permission is required"
    })

});
// Update schema — all fields optional
const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z_]+$/).optional()
    .messages({ "string.pattern.base": "Slug must contain only lowercase letters and underscores" }),
  description: Joi.string().allow("").optional(),
  level: Joi.string().valid("org", "company", "unit").optional(),
  permissions: Joi.array().items(Joi.string().hex().length(24)).min(1).optional()
    .messages({ "array.min": "At least one permission is required" }),
  userClass: Joi.string().optional(),
  modules: Joi.array().items(Joi.string()).optional(),
});

const validateRoleUpdate = (req, res, next) => {
  const { error } = updateRoleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  next();
};

const validateRole = (req, res, next) => {

  const { error } = createRoleSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  next();

};

const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Email must be valid"
    })
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 6 characters"
    })
});

module.exports = {
  superAdminLoginSchema,
  tenantLoginSchema,
  createRoleSchema,
  updateRoleSchema,
  validateRole,
  validateRoleUpdate,
  forgotPasswordSchema,
  resetPasswordSchema
};