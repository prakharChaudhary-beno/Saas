const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * SSO Connection Configuration
 * 
 * Stores the mapping between an organization and their WorkOS SSO connection
 */
const ssoConnectionSchema = new Schema({
  org_id: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  
  // WorkOS Connection ID (from WorkOS dashboard or API)
  connectionId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Email domain associated with this connection (e.g., "company.com")
  domain: {
    type: String,
    lowercase: true,
    trim: true,
    index: true
  },
  
  // Is SSO active for this organization
  active: {
    type: Boolean,
    default: true
  },
  
  // Provider type (Okta, Azure AD, Google Workspace, etc.)
  provider: {
    type: String,
    enum: ['okta', 'azure', 'azuread', 'google', 'onelogin', 'saml', 'mock', 'other'],
    default: 'saml'
  },
  
  // Environment (development or production)
  environment: {
    type: String,
    enum: ['development', 'production'],
    default: 'development'
  },
  
  // Metadata
  lastUsedAt: {
    type: Date,
    default: null
  },
  
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'sso_connections'
});

// Indexes
ssoConnectionSchema.index({ org_id: 1, active: 1 });
ssoConnectionSchema.index({ domain: 1, active: 1 });
ssoConnectionSchema.index({ domain: 1, environment: 1, active: 1 });

const SSOConnection = mongoose.model('SSOConnection', ssoConnectionSchema);

module.exports = SSOConnection;
