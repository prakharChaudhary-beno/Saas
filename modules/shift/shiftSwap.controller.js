// modules/shift/shiftSwap.controller.js

"use strict";

const swapService = require("./shiftSwap.service");

exports.raiseSwapRequest = async (req, res, next) => {
  try {
    const result = await swapService.raiseSwapRequest(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.respondToSwap = async (req, res, next) => {
  try {
    const result = await swapService.respondToSwap(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.approveSwap = async (req, res, next) => {
  try {
    const result = await swapService.managerAction(req.params.id, "APPROVE", req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.rejectSwap = async (req, res, next) => {
  try {
    const result = await swapService.managerAction(req.params.id, "REJECT", req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.cancelSwapRequest = async (req, res, next) => {
  try {
    const result = await swapService.cancelSwapRequest(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.listSwapRequests = async (req, res, next) => {
  try {
    const result = await swapService.listSwapRequests(req.query, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getSwapRequestById = async (req, res, next) => {
  try {
    const result = await swapService.getSwapRequestById(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};
