// modules/organisation/organization.controller.js

const Organization = require("./models/organization.model");
const AppError = require("../../utils/appError");
const Company = require("../company/models/company.model");
const Unit = require("../unit/models/unit.model");
const Department = require("../department/department.model");
const User = require("../auth/models/user.model");
const LOB = require("../lob/models/lob.model");

// ─── GET /api/v1/organization/config ─────────────────────
exports.getConfig = async (req, res, next) => {
  try {
    if (!req.user.orgId) {
      return next(new AppError("Organization ID not found in user context", 400));
    }

    const org = await Organization.findById(req.user.orgId).select(
      "name logo_url address timezone currency fiscalYearStart industry country contact_email contact_phone"
    );

    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    res.json({
      success: true,
      message: "Organization config fetched successfully",
      data: org,
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/v1/organization/config ─────────────────────
exports.updateConfig = async (req, res, next) => {
  try {
    if (!req.user.orgId) {
      return next(new AppError("Organization ID not found in user context", 400));
    }

    const allowedUpdates = [
      "logo_url",
      "address",
      "timezone",
      "currency",
      "fiscalYearStart",
      "industry",
      "country",
      "contact_email",
      "contact_phone",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate timezone if provided
    if (updates.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: updates.timezone });
      } catch {
        return next(new AppError("Invalid IANA timezone. Example: Asia/Kolkata", 400));
      }
    }

    // Validate currency if provided
    if (updates.currency && !/^[A-Z]{3}$/.test(updates.currency.toUpperCase())) {
      return next(new AppError("Invalid currency code. Must be 3 uppercase letters. Example: INR", 400));
    }

    if (updates.currency) updates.currency = updates.currency.toUpperCase();

    const org = await Organization.findByIdAndUpdate(
      req.user.orgId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select(
      "name logo_url address timezone currency fiscalYearStart industry country contact_email contact_phone"
    );

    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    res.json({
      success: true,
      message: "Organization config updated successfully",
      data: org,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/organization/logo (Upload) ─────────────────────
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.user.orgId) {
      return next(new AppError("Organization ID not found in user context", 400));
    }

    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    // File uploaded to Cloudinary via multer middleware
    const logoUrl = req.file.path; // Cloudinary URL

    const org = await Organization.findByIdAndUpdate(
      req.user.orgId,
      { logo_url: logoUrl },
      { new: true }
    ).select("logo_url");

    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    res.json({
      success: true,
      message: "Logo uploaded successfully",
      data: { logo_url: org.logo_url },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/organization/hierarchy-tree ─────────────────────
// Returns complete nested hierarchy: Organization → Company → Units → Departments → Employees
exports.getHierarchyTree = async (req, res, next) => {
  try {
    if (!req.user.orgId) {
      return next(new AppError("Organization ID not found in user context", 400));
    }

    const orgId = req.user.orgId;
    const companyId = req.user.companyId;

    // Import models
    const Company = require("../company/models/company.model");
    const Unit = require("../unit/models/unit.model");
    const Department = require("../department/department.model");
    const User = require("../auth/models/user.model");

    // Fetch Organization
    const org = await Organization.findById(orgId).select("name logo_url industry country");
    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    // Fetch Company
    const company = await Company.findById(companyId).select("company_name logo_url company_email company_phone");
    if (!company) {
      return next(new AppError("Company not found", 404));
    }

    // Import LOB model
    const LOB = require("../lob/models/lob.model");
    
    // Fetch LOBs under this company
    const lobs = await LOB.find({ company_id: companyId, org_id: orgId })
      .select("name description")
      .lean();

    // Build hierarchy: Organization → Company → LOB → Unit → Department → Employees
    const lobNodes = [];
    
    for (const lob of lobs) {
      // Fetch Units under this LOB
      const units = await Unit.find({ lob_id: lob._id, company_id: companyId, org_id: orgId })
        .select("name description location logo_url")
        .lean();

      const unitNodes = [];
      for (const unit of units) {
        // Fetch all departments under this unit
        const allDepartments = await Department.find({ unit_id: unit._id, company_id: companyId })
          .select("name color location parentId")
          .lean();

        // Build recursive department tree (ONLY departments, NO employees/designations)
        const buildDeptTree = (parentId = null) => {
          const nodes = [];
          
          for (const dept of allDepartments) {
            const deptParentId = dept.parentId?._id?.toString() || dept.parentId?.toString() || null;
            
            if (deptParentId === parentId) {
              // Recursively get sub-departments
              const subDepts = buildDeptTree(dept._id.toString());
              
              nodes.push({
                id: dept._id,
                level: "department",
                name: dept.name,
                color: dept.color,
                location: dept.location,
                employeeCount: 0, // Placeholder - employees shown in designations only
                children: subDepts
              });
            }
          }
          
          return nodes;
        };

        const deptNodes = buildDeptTree(null);

        // NOW fetch ALL employees in this unit and group by designation
        const allDeptIds = allDepartments.map(d => d._id);
        
        const allEmployees = await User.find({ 
          department_id: { $in: allDeptIds },
          status: "active" 
        })
          .select("first_name last_name email phone employee_id profile_photo designation_id reports_to status department_id")
          .populate("designation_id", "name")
          .populate("reports_to", "first_name last_name profile_photo")
          .lean();

        // Group employees by designation
        const employeesByDesignation = {};
        allEmployees.forEach(emp => {
          const designationName = emp.designation_id?.name || "Unassigned";
          const designationId = emp.designation_id?._id?.toString() || "unassigned";
          
          if (!employeesByDesignation[designationId]) {
            employeesByDesignation[designationId] = {
              id: designationId,
              level: "designation",
              name: designationName,
              employeeCount: 0,
              children: []
            };
          }
          
          const dept = allDepartments.find(d => d._id.equals(emp.department_id));
          
          employeesByDesignation[designationId].children.push({
            id: emp._id,
            level: "employee",
            name: `${emp.first_name} ${emp.last_name}`,
            email: emp.email,
            phone: emp.phone,
            employeeId: emp.employee_id,
            profilePhoto: emp.profile_photo,
            designation: designationName,
            department: dept?.name || "N/A",
            reportsTo: emp.reports_to ? {
              id: emp.reports_to._id,
              name: `${emp.reports_to.first_name} ${emp.reports_to.last_name}`,
              profilePhoto: emp.reports_to.profile_photo
            } : null,
            status: emp.status
          });
          employeesByDesignation[designationId].employeeCount++;
        });

        const designationNodes = Object.values(employeesByDesignation);

        // Combine: Unit → [Departments..., Designations...] (FLAT, separate)
        unitNodes.push({
          id: unit._id,
          level: "unit",
          name: unit.name,
          description: unit.description,
          location: unit.location,
          logo: unit.logo_url,
          employeeCount: allEmployees.length,
          children: [...deptNodes, ...designationNodes]
        });
      }

      lobNodes.push({
        id: lob._id,
        level: "lob",
        name: lob.name,
        description: lob.description,
        employeeCount: unitNodes.reduce((sum, unit) => sum + unit.employeeCount, 0),
        children: unitNodes
      });
    }

    // Build complete tree
    const tree = {
      id: org._id,
      level: "organization",
      name: org.name,
      logo: org.logo_url,
      industry: org.industry,
      country: org.country,
      children: [
        {
          id: company._id,
          level: "company",
          name: company.company_name,
          logo: company.logo_url,
          email: company.company_email,
          phone: company.company_phone,
          employeeCount: lobNodes.reduce((sum, lob) => sum + lob.employeeCount, 0),
          children: lobNodes
        }
      ]
    };

    res.json({
      success: true,
      message: "Organization hierarchy fetched successfully",
      data: tree
    });
  } catch (err) {
    next(err);
  }
};