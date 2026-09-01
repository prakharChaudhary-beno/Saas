// modules/subscription/models/trialExtensionRequest.model.js

const mongoose = require('mongoose');

const trialExtensionRequestSchema = new mongoose.Schema(
  {
    org_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'org_id is required'],
      index: true
    },
    subscription_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'subscription_id is required']
    },
    requested_days: {
      type: Number,
      required: [true, 'requested_days is required'],
      min: [1, 'Must request at least 1 day']
    },
    reason: {
      type: String,
      default: '',
      maxlength: [500, 'Reason cannot exceed 500 characters']
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true
    },
    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'requested_by is required']
    },
    requested_at: {
      type: Date,
      default: Date.now
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewed_at: {
      type: Date,
      default: null
    },
    review_note: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexes
trialExtensionRequestSchema.index({ org_id: 1, status: 1 });
trialExtensionRequestSchema.index({ status: 1, requested_at: -1 });

module.exports = mongoose.model('TrialExtensionRequest', trialExtensionRequestSchema);
