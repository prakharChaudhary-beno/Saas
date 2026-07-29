// modules/search/search.controller.js
// Search controller - validates input and calls service

const searchService = require('./search.service')
const config = require('./search.config')

// ─── Global Search Controller ──────────────────────────────────────────────
const globalSearch = async (req, res, next) => {
  try {
    const { q, limit, modules } = req.query
    
    // ── Validate Query ───────────────────────────────────────────────────────
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      })
    }
    
    const query = q.trim()
    
    if (query.length < config.MIN_QUERY_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Query must be at least ${config.MIN_QUERY_LENGTH} characters`
      })
    }
    
    if (query.length > config.MAX_QUERY_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Query cannot exceed ${config.MAX_QUERY_LENGTH} characters`
      })
    }
    
    // ── Extract User Context ────────────────────────────────────────────────
    const { orgId, companyId, unitId, level, userId, role, permissions, roleId } = req.user
    
    // ── Build Search Parameters ─────────────────────────────────────────────
    const searchParams = {
      query,
      userScope: { orgId, companyId, unitId, level, userId, roleId },
      userPermissions: permissions || [],
      userRole: role,
      requestedModules: modules ? modules.split(',').map(m => m.trim()) : null,
      limit: Math.min(parseInt(limit) || config.DEFAULT_LIMIT, config.MAX_LIMIT)
    }
    
    // ── Execute Search ──────────────────────────────────────────────────────
    const results = await searchService.globalSearch(searchParams)
    
    // ── Log Search (Audit) ───────────────────────────────────────────────────
    console.log(`[Search] User ${userId} searched: "${query}" (Role: ${role}, Level: ${level})`)
    
    // ── Return Results ──────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      query,
      results,
      count: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
    })
    
  } catch (error) {
    console.error('[Search Controller Error]:', error)
    next(error)
  }
}

module.exports = {
  globalSearch
}
