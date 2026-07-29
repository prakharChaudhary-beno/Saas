// migrations/create-search-indexes.js
// Run this script ONCE to create text indexes for fast search
// Usage: node migrations/create-search-indexes.js

require('dotenv').config()
const mongoose = require('mongoose')

// ─── Connect to MongoDB ─────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env')
  process.exit(1)
}

// ─── Create Text Indexes ───────────────────────────────────────────────────
async function createSearchIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected successfully\n')
    
    const db = mongoose.connection.db
    
    // ── 1. Employees Collection ─────────────────────────────────────────────
    console.log('📝 Creating text index on employees...')
    try {
      await db.collection('employees').createIndex(
        {
          name: 'text',
          employeeId: 'text',
          email: 'text',
          phone: 'text'
        },
        {
          weights: {
            name: 10,
            employeeId: 8,
            email: 5,
            phone: 4
          },
          name: 'employee_text_index',
          background: true
        }
      )
      console.log('   ✅ employees text index created\n')
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('   ⚠️  employees text index already exists\n')
      } else {
        throw err
      }
    }
    
    // ── 2. Departments Collection ───────────────────────────────────────────
    console.log('📝 Creating text index on departments...')
    try {
      await db.collection('departments').createIndex(
        { name: 'text', description: 'text' },
        {
          weights: { name: 8, description: 3 },
          name: 'department_text_index',
          background: true
        }
      )
      console.log('   ✅ departments text index created\n')
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('   ⚠️  departments text index already exists\n')
      } else {
        throw err
      }
    }
    
    // ── 3. Designations Collection ───────────────────────────────────────────
    console.log('📝 Creating text index on designations...')
    try {
      await db.collection('designations').createIndex(
        { name: 'text', description: 'text' },
        {
          weights: { name: 8, description: 3 },
          name: 'designation_text_index',
          background: true
        }
      )
      console.log('   ✅ designations text index created\n')
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('   ⚠️  designations text index already exists\n')
      } else {
        throw err
      }
    }
    
    // ── 4. Holidays Collection ───────────────────────────────────────────────
    console.log('📝 Creating text index on holidays...')
    try {
      await db.collection('holidays').createIndex(
        { name: 'text', description: 'text' },
        {
          weights: { name: 8, description: 4 },
          name: 'holiday_text_index',
          background: true
        }
      )
      console.log('   ✅ holidays text index created\n')
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('   ⚠️  holidays text index already exists\n')
      } else {
        throw err
      }
    }
    
    // ── 5. Audit Logs Collection ─────────────────────────────────────────────
    console.log('📝 Creating text index on auditlogs...')
    try {
      await db.collection('auditlogs').createIndex(
        { action: 'text', module: 'text', description: 'text' },
        {
          weights: { action: 7, module: 5, description: 4 },
          name: 'auditlog_text_index',
          background: true
        }
      )
      console.log('   ✅ auditlogs text index created\n')
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('   ⚠️  auditlogs text index already exists\n')
      } else {
        throw err
      }
    }
    
    // ── 6. Notifications Collection ─────────────────────────────────────────
    console.log('📝 Creating text index on notifications...')
    try {
      await db.collection('notifications').createIndex(
        { title: 'text', message: 'text' },
        {
          weights: { title: 7, message: 5 },
          name: 'notification_text_index',
          background: true
        }
      )
      console.log('   ✅ notifications text index created\n')
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('   ⚠️  notifications text index already exists\n')
      } else {
        throw err
      }
    }
    
    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('═════════════════════════════════════════')
    console.log('✅ All search indexes created successfully!')
    console.log('═════════════════════════════════════════\n')
    
    // ── List All Indexes ─────────────────────────────────────────────────────
    console.log('📋 Verifying created indexes...\n')
    
    const collections = ['employees', 'departments', 'designations', 'holidays', 'auditlogs', 'notifications']
    
    for (const colName of collections) {
      const indexes = await db.collection(colName).getIndexes()
      const textIndexes = indexes.filter(idx => Object.values(idx.key || {}).includes('text'))
      
      if (textIndexes.length > 0) {
        console.log(`   ${colName}:`)
        textIndexes.forEach(idx => console.log(`      - ${idx.name}`))
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error creating indexes:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('\n🔌 MongoDB connection closed')
    process.exit(0)
  }
}

// ─── Run Migration ─────────────────────────────────────────────────────────
createSearchIndexes()
