// modules/delegation/delegation.controller.js

"use strict";

const delegationService = require("./delegation.service");

exports.createDelegation = async (req, res, next) => {
  try {
    const result = await delegationService.createDelegation(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getMyDelegations = async (req, res, next) => {
  try {
    const result = await delegationService.getMyDelegations(req.query, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getReceivedDelegations = async (req, res, next) => {
  try {
    const result = await delegationService.getReceivedDelegations(req.query, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getDelegationById = async (req, res, next) => {
  try {
    const result = await delegationService.getDelegationById(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.revokeDelegation = async (req, res, next) => {
  try {
    const result = await delegationService.revokeDelegation(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.approveDelegation = async (req, res, next) => {
  try {
    const result = await delegationService.approveDelegation(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.rejectDelegation = async (req, res, next) => {
  try {
    const result = await delegationService.rejectDelegation(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};
