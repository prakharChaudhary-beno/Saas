// utils/searchQueryBuilder.js
// Reusable query builder with permission filters and scope isolation

const mongoose = require('mongoose')

class SearchQueryBuilder {
  constructor(query, userScope) {
    this.query = query
    this.scope = userScope
    this.regex = new RegExp(this.escapeRegex(query), 'i')
  }
  
  // ─── Escape Regex Special Characters ─────────────────────────────────────
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  // ─── Convert to ObjectId if valid ─────────────────────────────────────────
  toObjectId(id) {
    if (!id) return id
    try {
      return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
    } catch {
      return id
    }
  }
  
  // ─── Scope Filter Builder ─────────────────────────────────────────────────
  // CRITICAL: Enforces multi-tenant data isolation
  getScopeFilter() {
    const { level, orgId, companyId, unitId } = this.scope
    
    switch(level) {
      case 'org':
        // Org Admin sees ALL within org
        return { org_id: this.toObjectId(orgId) }
        
      case 'company':
        // Company Admin sees only their company
        return { 
          org_id: this.toObjectId(orgId), 
          company_id: this.toObjectId(companyId) 
        }
        
      case 'unit':
        // Unit Admin/Employee sees only their unit
        return { 
          org_id: this.toObjectId(orgId), 
          company_id: this.toObjectId(companyId), 
          unit_id: this.toObjectId(unitId) 
        }
        
      default:
        // Deny by default - security-first
        console.error('[SearchQueryBuilder] Unknown level:', level)
        return { _id: null }
    }
  }
  
  // ─── Build Or Condition for Multiple Fields ───────────────────────────────
  buildOrCondition(fields) {
    return {
      $or: fields.map(field => ({
        [field]: { $regex: this.regex }
      }))
    }
  }
  
  // ─── Combined Filter with Scope + Soft Delete ─────────────────────────────
  buildFilter(additionalFilters = {}) {
    return {
      ...this.getScopeFilter(),
      isDeleted: { $ne: true }, // Exclude soft-deleted records
      ...additionalFilters
    }
  }
  
  // ─── Text Search Query (when text index exists) ───────────────────────────
  buildTextSearch() {
    return {
      $text: { $search: this.query },
      score: { $meta: "textScore" }
    }
  }
  
  // ─── Pagination Helper ────────────────────────────────────────────────────
  static getPagination(limit = 5, skip = 0) {
    return {
      limit: Math.min(limit, 20),
      skip: Math.max(skip, 0)
    }
  }
}

module.exports = SearchQueryBuilder
