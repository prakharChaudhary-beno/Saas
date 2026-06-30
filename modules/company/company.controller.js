// modules/company/company.controller.js

const companyService = require("./company.service");

exports.createCompany = async (req, res, next) => {
  try {
    const company = await companyService.createCompany(req.body, req.user);
    return res.status(201).json({ success: true, message: "Company created successfully", data: company });
  } catch (err) { next(err); }
};

exports.getCompanies = async (req, res, next) => {
  try {
    const result = await companyService.getCompanies(req.user, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.getCompanyById = async (req, res, next) => {
  try {
    const company = await companyService.getCompanyById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: company });
  } catch (err) { next(err); }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const company = await companyService.updateCompany(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "Company updated successfully", data: company });
  } catch (err) { next(err); }
};

exports.deleteCompany = async (req, res, next) => {
  try {
    const result = await companyService.deleteCompany(req.params.id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};