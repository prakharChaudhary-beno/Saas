// Find actual database name and list collections
const mongoose = require('mongoose')

const MONGO_URI = 'mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/?retryWrites=true&w=majority'

async function findDatabase() {
  try {
    await mongoose.connect(MONGO_URI)
    
    const adminDb = mongoose.connection.db.admin()
    
    // List all databases
    const databases = await adminDb.listDatabases()
    
    console.log('=== AVAILABLE DATABASES ===\n')
    databases.databases.forEach(db => {
      console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`)
    })
    
    // Connect to each database and check employees count
    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name
      
      if (dbName === 'admin' || dbName === 'local') continue
      
      const db = mongoose.connection.client.db(dbName)
      const collections = await db.listCollections().toArray()
      
      if (collections.find(c => c.name === 'employees')) {
        const count = await db.collection('employees').countDocuments()
        const orgCount = await db.collection('organisations').countDocuments()
        const companyCount = await db.collection('companies').countDocuments()
        const unitCount = await db.collection('units').countDocuments()
        
        console.log(`\n=== ${dbName} ===`)
        console.log(`Organizations: ${orgCount}`)
        console.log(`Companies: ${companyCount}`)
        console.log(`Units: ${unitCount}`)
        console.log(`Employees: ${count}`)
        
        // Find sample employee with "pr"
        const sampleEmp = await db.collection('employees').findOne({
          name: { $regex: /pr/i }
        })
        
        if (sampleEmp) {
          console.log(`\nSample employee matching "pr":`)
          console.log(`  Name: ${sampleEmp.name}`)
          console.log(`  Employee ID: ${sampleEmp.employeeId}`)
          console.log(`  Email: ${sampleEmp.email}`)
          console.log(`  org_id: ${sampleEmp.org_id}`)
          console.log(`  company_id: ${sampleEmp.company_id}`)
          console.log(`  unit_id: ${sampleEmp.unit_id}`)
        }
        
        // List first organization
        const sampleOrg = await db.collection('organisations').findOne({})
        if (sampleOrg) {
          console.log(`\nSample organization:`)
          console.log(`  Name: ${sampleOrg.name}`)
          console.log(`  ID: ${sampleOrg._id}`)
        }
      }
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

findDatabase()
