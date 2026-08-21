const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * SSO State Token
 * 
 * Temporary state storage for SSO flow verification
 * Prevents CSRF attacks and associates state with org/email
 */
const ssoStateSchema = new Schema({
  // Random state token
  state: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Organization context
  org_id: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // WorkOS connection ID
  connectionId: {
    type: String,
    required: true
  },
  
  // Email hint (optional)
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  
  // Expiration
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '5m' } // MongoDB TTL index - auto-delete after 5 minutes
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Document expires after 5 minutes
  }
}, {
  collection: 'sso_states'
});

// TTL index for automatic cleanup
ssoStateSchema.index({ createdAt: 1 }, { expires: 300 });

const SSOState = mongoose.model('SSOState', ssoStateSchema);

module.exports = SSOState;
