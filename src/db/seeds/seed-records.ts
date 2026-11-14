import type { Pool } from "pg";
import { DATASETS_DEFINITIONS } from "./constants.js";

// Deterministic Pseudo-Random Number Generator (Mulberry32)
export function createPrng(seed = 42) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable deterministic UUIDs for each dataset record
export const getSupplierId = (i: number) =>
  `00000001-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;

export const getEmployeeId = (i: number) =>
  `00000002-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;

export const getCustomerId = (i: number) =>
  `00000003-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;

export const getProductId = (i: number) =>
  `00000004-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;

export const getSaleId = (i: number) =>
  `00000005-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;

export const getShipmentId = (i: number) =>
  `00000006-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;

export const getRelId = (prefix: number, i: number) =>
  `000000${prefix.toString(16).padStart(2, "0")}-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;

// Datasets IDs from DATASETS_DEFINITIONS
const SUPPLIER_DATASET_ID = "10000000-0000-4000-8000-000000000005";
const EMPLOYEE_DATASET_ID = "10000000-0000-4000-8000-000000000004";
const CUSTOMER_DATASET_ID = "10000000-0000-4000-8000-000000000001";
const PRODUCT_DATASET_ID = "10000000-0000-4000-8000-000000000002";
const SALE_DATASET_ID = "10000000-0000-4000-8000-000000000003";
const SHIPMENT_DATASET_ID = "10000000-0000-4000-8000-000000000006";

// Synthetic Name and Vocabulary Pools
const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Gregory", "Christine", "Frank", "Debra",
  "Alexander", "Rachel", "Raymond", "Carolyn", "Patrick", "Janet", "Jack", "Catherine",
  "Dennis", "Maria", "Jerry", "Heather", "Tyler", "Diane", "Aaron", "Ruth",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
];

const COMPANY_PREFIXES = [
  "Apex", "Nexus", "Vertex", "Quantum", "Omega", "Alpha", "Titan", "Pinnacle",
  "Vanguard", "Horizon", "Catalyst", "Zenith", "Synergy", "Beacon", "Core", "Global",
  "Prime", "Starlight", "Hyperion", "Summit", "Sterling", "Atlas", "Crest", "Velocity",
  "Eclipse", "Aura", "Matrix", "Sol", "Terra", "Nova", "Integra", "Strata",
];

const COMPANY_SUFFIXES = [
  "Technologies", "Solutions", "Logistics", "Enterprises", "Industries", "Group",
  "Systems", "Partners", "Dynamics", "Networks", "Labs", "Corporation", "Ventures",
  "International", "Innovations", "Global", "Holdings", "Consulting", "Services",
];

const CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
  "San Francisco", "Columbus", "Fort Worth", "Indianapolis", "Charlotte", "Seattle",
  "Denver", "Washington", "Boston", "El Paso", "Nashville", "Detroit", "Portland",
  "Las Vegas", "Memphis", "Louisville", "Baltimore", "Milwaukee", "Albuquerque",
  "Tucson", "Fresno", "Sacramento", "Mesa", "Atlanta", "Kansas City", "Colorado Springs",
  "Miami", "Raleigh", "Omaha", "Long Beach", "Virginia Beach", "Oakland", "Minneapolis",
];

const COUNTRIES = [
  "United States", "United Kingdom", "Germany", "Canada", "Australia",
  "Japan", "Netherlands", "Sweden", "France", "Switzerland",
];

const PRODUCT_CATEGORIES = [
  "Laptops", "Smartphones", "Monitors", "Networking",
  "Audio", "Accessories", "Storage", "Peripherals",
];

const PRODUCT_MODELS = [
  "UltraBook Pro", "SyncMaster 4K", "Pulse Wireless Headset", "Quantum NVMe SSD",
  "Titan Gigabit Router", "AeroPad Tablet", "HyperCharge Dock", "Matrix Mechanical Keyboard",
  "OmniVision Webcam", "Vortex Gaming Mouse", "SecureKey Flash Drive", "OptiClear Display",
  "EchoNoise Earbuds", "PowerBank Extreme", "SpeedPort Hub", "FlexStand Arm",
  "NanoDrive External", "CyberShield Firewall", "SoundBar Studio", "GlideTrack Touchpad",
];

// Helper to format ISO date YYYY-MM-DD
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

// Batch insertion function for dataset_records using PostgreSQL UNNEST
async function insertRecordsBatch(
  pool: Pool,
  batch: {
    ids: string[];
    datasetIds: string[];
    recordData: string[]; // JSON strings
    createdBys: string[];
    createdAts: string[];
    updatedAts: string[];
  }
) {
  await pool.query(
    `INSERT INTO dataset_records (id, dataset_id, record_data, created_by, created_at, updated_at)
     SELECT * FROM UNNEST(
       $1::uuid[],
       $2::uuid[],
       $3::jsonb[],
       $4::text[],
       $5::timestamptz[],
       $6::timestamptz[]
     )
     ON CONFLICT (id) DO UPDATE SET
       record_data = EXCLUDED.record_data,
       updated_at = EXCLUDED.updated_at`,
    [
      batch.ids,
      batch.datasetIds,
      batch.recordData,
      batch.createdBys,
      batch.createdAts,
      batch.updatedAts,
    ]
  );
}

// Batch insertion function for record_relationships using PostgreSQL UNNEST
async function insertRelationshipsBatch(
  pool: Pool,
  batch: {
    ids: string[];
    sourceDatasetIds: string[];
    sourceRecordIds: string[];
    targetDatasetIds: string[];
    targetRecordIds: string[];
    relationshipTypes: string[];
    descriptions: (string | null)[];
    createdAts: string[];
  }
) {
  await pool.query(
    `INSERT INTO record_relationships (
       id, source_dataset_id, source_record_id,
       target_dataset_id, target_record_id,
       relationship_type, description, created_at
     )
     SELECT * FROM UNNEST(
       $1::uuid[],
       $2::uuid[],
       $3::uuid[],
       $4::uuid[],
       $5::uuid[],
       $6::varchar[],
       $7::text[],
       $8::timestamptz[]
     )
     ON CONFLICT (id) DO NOTHING`,
    [
      batch.ids,
      batch.sourceDatasetIds,
      batch.sourceRecordIds,
      batch.targetDatasetIds,
      batch.targetRecordIds,
      batch.relationshipTypes,
      batch.descriptions,
      batch.createdAts,
    ]
  );
}

export async function seedAllRecordsAndRelationships(
  pool: Pool,
  adminUserId: string
): Promise<void> {
  console.log("\n--- [Step 3/3] Generating Synthetic Records & Cross-Dataset Relationships ---");

  const prng = createPrng(42);
  const BATCH_SIZE = 5000;
  const now = new Date();
  const nowIso = now.toISOString();

  // =========================================================================
  // 1. SUPPLIERS (5,000 records)
  // =========================================================================
  console.log("Seeding 1/6: Supplier Information (5,000 records)...");
  {
    const ids: string[] = [];
    const datasetIds: string[] = [];
    const recordData: string[] = [];
    const createdBys: string[] = [];
    const createdAts: string[] = [];
    const updatedAts: string[] = [];

    const categories = ["Electronics", "Raw Materials", "Packaging", "Machinery", "Office Supplies", "Chemicals"];
    const supplierCountries = ["USA", "Germany", "Japan", "China", "UK", "Canada", "France", "South Korea", "India", "Taiwan"];

    for (let i = 0; i < 5000; i++) {
      const code = `SUP-${String(i + 1).padStart(5, "0")}`;
      const prefix = COMPANY_PREFIXES[i % COMPANY_PREFIXES.length]!;
      const suffix = COMPANY_SUFFIXES[(i * 3) % COMPANY_SUFFIXES.length]!;
      const company = `${prefix} ${suffix} ${i + 1}`;
      const fName = FIRST_NAMES[i % FIRST_NAMES.length]!;
      const lName = LAST_NAMES[(i * 7) % LAST_NAMES.length]!;
      const contact = `${fName} ${lName}`;
      const email = `contact@${prefix.toLowerCase()}${i + 1}.com`;
      const country = supplierCountries[i % supplierCountries.length]!;
      const city = CITIES[(i * 2) % CITIES.length]!;
      const category = categories[i % categories.length]!;
      const rating = Number((3.0 + prng() * 2.0).toFixed(1));
      const isActive = i % 25 !== 0; // 96% active
      const startDate = formatDate(new Date(2018 + (i % 6), (i * 3) % 12, 1 + (i % 28)));
      const website = `https://www.${prefix.toLowerCase()}${i + 1}.com`;

      ids.push(getSupplierId(i));
      datasetIds.push(SUPPLIER_DATASET_ID);
      recordData.push(
        JSON.stringify({
          supplier_code: code,
          company_name: company,
          contact_name: contact,
          contact_email: email,
          phone: `+1-555-${String(100 + (i % 900))}-${String(1000 + (i % 9000))}`,
          country,
          city,
          category,
          rating,
          is_active: isActive,
          contract_start_date: startDate,
          website,
        })
      );
      createdBys.push(adminUserId);
      createdAts.push(nowIso);
      updatedAts.push(nowIso);
    }

    await insertRecordsBatch(pool, { ids, datasetIds, recordData, createdBys, createdAts, updatedAts });
    console.log("✓ Seeded 5,000 Supplier Information records.");
  }

  // =========================================================================
  // 2. EMPLOYEES (5,000 records) + Hierarchy Relationships
  // =========================================================================
  console.log("Seeding 2/6: Employee Directory (5,000 records)...");
  {
    const ids: string[] = [];
    const datasetIds: string[] = [];
    const recordData: string[] = [];
    const createdBys: string[] = [];
    const createdAts: string[] = [];
    const updatedAts: string[] = [];

    // Relationship arrays
    const relIds: string[] = [];
    const relSourceDatasets: string[] = [];
    const relSourceRecords: string[] = [];
    const relTargetDatasets: string[] = [];
    const relTargetRecords: string[] = [];
    const relTypes: string[] = [];
    const relDescs: (string | null)[] = [];
    const relCreatedAts: string[] = [];

    const departments = [
      "Sales", "Engineering", "Marketing", "Human Resources",
      "Finance", "Customer Support", "Operations", "Product",
    ];
    const titles = [
      "Account Executive", "Senior Software Engineer", "Product Manager",
      "Financial Analyst", "Operations Specialist", "Customer Success Lead",
      "Marketing Manager", "DevOps Engineer", "HR Business Partner", "Technical Architect",
    ];
    const locations = ["New York", "San Francisco", "London", "Berlin", "Tokyo", "Singapore", "Remote"];

    for (let i = 0; i < 5000; i++) {
      const code = `EMP-${String(i + 1).padStart(5, "0")}`;
      const fName = FIRST_NAMES[i % FIRST_NAMES.length]!;
      const lName = LAST_NAMES[(i * 11) % LAST_NAMES.length]!;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${i + 1}@datascope.corp`;
      const dept = departments[i % departments.length]!;
      const title = titles[(i * 3) % titles.length]!;
      const isAccountManager = i < 200; // First 200 employees are account managers

      // Manager hierarchy: CEO at i=0 has no manager, others report to leads in first 50
      const managerIndex = i === 0 ? null : (i - 1) % 50;
      const managerId = managerIndex !== null ? getEmployeeId(managerIndex) : null;

      const hireDate = formatDate(new Date(2017 + (i % 8), (i * 5) % 12, 1 + (i % 28)));
      const salary = 45000 + (i % 150) * 1100;
      const status = i % 50 === 0 ? "On Leave" : i % 100 === 0 ? "Terminated" : "Active";
      const location = locations[i % locations.length]!;

      ids.push(getEmployeeId(i));
      datasetIds.push(EMPLOYEE_DATASET_ID);
      recordData.push(
        JSON.stringify({
          employee_code: code,
          first_name: fName,
          last_name: lName,
          email,
          department: dept,
          job_title: title,
          manager_id: managerId,
          hire_date: hireDate,
          salary,
          status,
          location,
          is_account_manager: isAccountManager,
        })
      );
      createdBys.push(adminUserId);
      createdAts.push(nowIso);
      updatedAts.push(nowIso);

      // Add hierarchy relationship
      if (managerIndex !== null) {
        relIds.push(getRelId(0x20, i));
        relSourceDatasets.push(EMPLOYEE_DATASET_ID);
        relSourceRecords.push(getEmployeeId(i));
        relTargetDatasets.push(EMPLOYEE_DATASET_ID);
        relTargetRecords.push(managerId!);
        relTypes.push("REPORTS_TO");
        relDescs.push(`Employee reports to manager ${managerIndex + 1}`);
        relCreatedAts.push(nowIso);
      }
    }

    await insertRecordsBatch(pool, { ids, datasetIds, recordData, createdBys, createdAts, updatedAts });
    await insertRelationshipsBatch(pool, {
      ids: relIds,
      sourceDatasetIds: relSourceDatasets,
      sourceRecordIds: relSourceRecords,
      targetDatasetIds: relTargetDatasets,
      targetRecordIds: relTargetRecords,
      relationshipTypes: relTypes,
      descriptions: relDescs,
      createdAts: relCreatedAts,
    });
    console.log(`✓ Seeded 5,000 Employee Directory records and ${relIds.length} manager relationships.`);
  }

  // =========================================================================
  // 3. CUSTOMERS (100,000 records) + Account Manager Relationships
  // =========================================================================
  console.log("Seeding 3/6: Customer Information (100,000 records in 20 batches of 5,000)...");
  {
    const industries = [
      "Technology", "Healthcare", "Finance", "Manufacturing",
      "Retail", "Education", "Telecommunications", "Energy",
    ];
    const tiers = ["Enterprise", "Mid-Market", "SMB", "Startup"];

    for (let b = 0; b < 100000; b += BATCH_SIZE) {
      const ids: string[] = [];
      const datasetIds: string[] = [];
      const recordData: string[] = [];
      const createdBys: string[] = [];
      const createdAts: string[] = [];
      const updatedAts: string[] = [];

      const relIds: string[] = [];
      const relSourceDatasets: string[] = [];
      const relSourceRecords: string[] = [];
      const relTargetDatasets: string[] = [];
      const relTargetRecords: string[] = [];
      const relTypes: string[] = [];
      const relDescs: (string | null)[] = [];
      const relCreatedAts: string[] = [];

      for (let i = b; i < b + BATCH_SIZE; i++) {
        const code = `CUST-${String(i + 1).padStart(6, "0")}`;
        const prefix = COMPANY_PREFIXES[i % COMPANY_PREFIXES.length]!;
        const suffix = COMPANY_SUFFIXES[(i * 5) % COMPANY_SUFFIXES.length]!;
        const company = `${prefix} ${suffix} ${i + 1}`;
        const fName = FIRST_NAMES[i % FIRST_NAMES.length]!;
        const lName = LAST_NAMES[(i * 13) % LAST_NAMES.length]!;
        const contact = `${fName} ${lName}`;
        const email = `client.${i + 1}@${prefix.toLowerCase()}${i % 1000}.com`;
        const phone = `+1-800-${String(100 + (i % 900))}-${String(1000 + (i % 9000))}`;
        const industry = industries[i % industries.length]!;
        const tier = tiers[i % tiers.length]!;

        // Account manager is deterministically linked to one of the 200 account managers
        const accountManagerIdx = i % 200;
        const accountManagerId = getEmployeeId(accountManagerIdx);

        const country = COUNTRIES[i % COUNTRIES.length]!;
        const city = CITIES[(i * 3) % CITIES.length]!;
        const annualRevenue = 150000 + (i % 500) * 8500;
        const isActive = i % 20 !== 0; // 95% active
        const registeredDate = formatDate(new Date(2019 + (i % 6), (i * 2) % 12, 1 + (i % 28)));
        const website = `https://www.${prefix.toLowerCase()}${i + 1}.io`;

        ids.push(getCustomerId(i));
        datasetIds.push(CUSTOMER_DATASET_ID);
        recordData.push(
          JSON.stringify({
            customer_code: code,
            company_name: company,
            contact_name: contact,
            email,
            phone,
            industry,
            tier,
            account_manager_id: accountManagerId,
            country,
            city,
            annual_revenue: annualRevenue,
            is_active: isActive,
            registered_date: registeredDate,
            website,
          })
        );
        createdBys.push(adminUserId);
        createdAts.push(nowIso);
        updatedAts.push(nowIso);

        // Relationship to Account Manager (Employee)
        relIds.push(getRelId(0x30, i));
        relSourceDatasets.push(CUSTOMER_DATASET_ID);
        relSourceRecords.push(getCustomerId(i));
        relTargetDatasets.push(EMPLOYEE_DATASET_ID);
        relTargetRecords.push(accountManagerId);
        relTypes.push("ACCOUNT_MANAGER");
        relDescs.push(`Customer account managed by Employee EMP-${String(accountManagerIdx + 1).padStart(5, "0")}`);
        relCreatedAts.push(nowIso);
      }

      await insertRecordsBatch(pool, { ids, datasetIds, recordData, createdBys, createdAts, updatedAts });
      await insertRelationshipsBatch(pool, {
        ids: relIds,
        sourceDatasetIds: relSourceDatasets,
        sourceRecordIds: relSourceRecords,
        targetDatasetIds: relTargetDatasets,
        targetRecordIds: relTargetRecords,
        relationshipTypes: relTypes,
        descriptions: relDescs,
        createdAts: relCreatedAts,
      });

      if ((b + BATCH_SIZE) % 25000 === 0) {
        console.log(`  ... Customer records inserted: ${b + BATCH_SIZE} / 100,000`);
      }
    }
    console.log("✓ Seeded 100,000 Customer Information records and 100,000 account manager relationships.");
  }

  // =========================================================================
  // 4. PRODUCTS (20,000 records) + Supplier Relationships
  // =========================================================================
  console.log("Seeding 4/6: Product Inventory (20,000 records in 4 batches of 5,000)...");
  {
    const statuses = ["In Stock", "In Stock", "In Stock", "Low Stock", "Out of Stock"];
    const warehouses = ["Warehouse A", "Warehouse B", "Warehouse C", "Warehouse D", "Central Hub"];

    for (let b = 0; b < 20000; b += BATCH_SIZE) {
      const ids: string[] = [];
      const datasetIds: string[] = [];
      const recordData: string[] = [];
      const createdBys: string[] = [];
      const createdAts: string[] = [];
      const updatedAts: string[] = [];

      const relIds: string[] = [];
      const relSourceDatasets: string[] = [];
      const relSourceRecords: string[] = [];
      const relTargetDatasets: string[] = [];
      const relTargetRecords: string[] = [];
      const relTypes: string[] = [];
      const relDescs: (string | null)[] = [];
      const relCreatedAts: string[] = [];

      for (let i = b; i < b + BATCH_SIZE; i++) {
        const sku = `SKU-${String(i + 1).padStart(5, "0")}`;
        const model = PRODUCT_MODELS[i % PRODUCT_MODELS.length]!;
        const name = `${model} v${(i % 5) + 1}.0 - Gen ${Math.floor(i / 100) + 1}`;
        const category = PRODUCT_CATEGORIES[i % PRODUCT_CATEGORIES.length]!;

        // Supplier link: 20,000 products linked across 5,000 suppliers
        const supplierIdx = i % 5000;
        const supplierId = getSupplierId(supplierIdx);

        const costPrice = Number((15.0 + (i % 250) * 8.5).toFixed(2));
        const unitPrice = Number((costPrice * 1.45).toFixed(2));
        const stockQty = (i * 17) % 1500;
        const reorderLevel = 50 + (i % 30) * 5;
        const status = stockQty === 0 ? "Out of Stock" : stockQty < reorderLevel ? "Low Stock" : "In Stock";
        const warehouse = warehouses[i % warehouses.length]!;
        const restockDate = formatDate(new Date(2025, (i * 3) % 12, 1 + (i % 28)));
        const isDiscontinued = i % 80 === 0;

        ids.push(getProductId(i));
        datasetIds.push(PRODUCT_DATASET_ID);
        recordData.push(
          JSON.stringify({
            sku,
            product_name: name,
            category,
            supplier_id: supplierId,
            unit_price: unitPrice,
            cost_price: costPrice,
            stock_quantity: stockQty,
            reorder_level: reorderLevel,
            status,
            warehouse_location: warehouse,
            last_restock_date: restockDate,
            is_discontinued: isDiscontinued,
          })
        );
        createdBys.push(adminUserId);
        createdAts.push(nowIso);
        updatedAts.push(nowIso);

        // Relationship to Supplier
        relIds.push(getRelId(0x10, i));
        relSourceDatasets.push(PRODUCT_DATASET_ID);
        relSourceRecords.push(getProductId(i));
        relTargetDatasets.push(SUPPLIER_DATASET_ID);
        relTargetRecords.push(supplierId);
        relTypes.push("SUPPLIED_BY");
        relDescs.push(`Product supplied by SUP-${String(supplierIdx + 1).padStart(5, "0")}`);
        relCreatedAts.push(nowIso);
      }

      await insertRecordsBatch(pool, { ids, datasetIds, recordData, createdBys, createdAts, updatedAts });
      await insertRelationshipsBatch(pool, {
        ids: relIds,
        sourceDatasetIds: relSourceDatasets,
        sourceRecordIds: relSourceRecords,
        targetDatasetIds: relTargetDatasets,
        targetRecordIds: relTargetRecords,
        relationshipTypes: relTypes,
        descriptions: relDescs,
        createdAts: relCreatedAts,
      });
    }
    console.log("✓ Seeded 20,000 Product Inventory records and 20,000 supplier relationships.");
  }

  // =========================================================================
  // 5. SALES TRANSACTIONS (100,000 records) + Customer & Product Relationships
  // =========================================================================
  console.log("Seeding 5/6: Sales Transactions (100,000 records in 20 batches of 5,000)...");
  {
    const paymentStatuses = ["Paid", "Paid", "Paid", "Pending", "Refunded"];
    const paymentMethods = ["Credit Card", "Wire Transfer", "ACH", "PayPal", "Net 30"];
    const channels = ["Direct Sales", "Partner", "Online Portal", "Enterprise Contract"];

    for (let b = 0; b < 100000; b += BATCH_SIZE) {
      const ids: string[] = [];
      const datasetIds: string[] = [];
      const recordData: string[] = [];
      const createdBys: string[] = [];
      const createdAts: string[] = [];
      const updatedAts: string[] = [];

      const relIds: string[] = [];
      const relSourceDatasets: string[] = [];
      const relSourceRecords: string[] = [];
      const relTargetDatasets: string[] = [];
      const relTargetRecords: string[] = [];
      const relTypes: string[] = [];
      const relDescs: (string | null)[] = [];
      const relCreatedAts: string[] = [];

      for (let i = b; i < b + BATCH_SIZE; i++) {
        const code = `TRX-${String(i + 1).padStart(6, "0")}`;

        // Customer link: customer index i % 100,000
        const customerIdx = i % 100000;
        const customerId = getCustomerId(customerIdx);

        // Product link: product index (i * 7) % 20,000
        const productIdx = (i * 7) % 20000;
        const productId = getProductId(productIdx);

        const qty = 1 + (i % 8);
        const unitPrice = Number((25.0 + (productIdx % 250) * 12.0).toFixed(2));
        const discount = i % 5 === 0 ? (i % 20) : 0;
        const total = Number(((qty * unitPrice) * (1 - discount / 100)).toFixed(2));
        const paymentStatus = paymentStatuses[i % paymentStatuses.length]!;
        const paymentMethod = paymentMethods[(i * 3) % paymentMethods.length]!;
        const trxDate = formatDate(new Date(2024, (i * 3) % 12, 1 + (i % 28)));
        const channel = channels[i % channels.length]!;
        const isReconciled = paymentStatus === "Paid";

        ids.push(getSaleId(i));
        datasetIds.push(SALE_DATASET_ID);
        recordData.push(
          JSON.stringify({
            transaction_code: code,
            customer_id: customerId,
            product_id: productId,
            quantity: qty,
            unit_price: unitPrice,
            total_amount: total,
            discount_percent: discount,
            payment_status: paymentStatus,
            payment_method: paymentMethod,
            transaction_date: trxDate,
            channel,
            is_reconciled: isReconciled,
          })
        );
        createdBys.push(adminUserId);
        createdAts.push(nowIso);
        updatedAts.push(nowIso);

        // Relationship 1: Sale -> Customer
        relIds.push(getRelId(0x40, i));
        relSourceDatasets.push(SALE_DATASET_ID);
        relSourceRecords.push(getSaleId(i));
        relTargetDatasets.push(CUSTOMER_DATASET_ID);
        relTargetRecords.push(customerId);
        relTypes.push("PURCHASED_BY");
        relDescs.push(`Sale transaction purchased by Customer CUST-${String(customerIdx + 1).padStart(6, "0")}`);
        relCreatedAts.push(nowIso);

        // Relationship 2: Sale -> Product
        relIds.push(getRelId(0x50, i));
        relSourceDatasets.push(SALE_DATASET_ID);
        relSourceRecords.push(getSaleId(i));
        relTargetDatasets.push(PRODUCT_DATASET_ID);
        relTargetRecords.push(productId);
        relTypes.push("CONTAINS_PRODUCT");
        relDescs.push(`Sale order contains Product SKU-${String(productIdx + 1).padStart(5, "0")}`);
        relCreatedAts.push(nowIso);
      }

      await insertRecordsBatch(pool, { ids, datasetIds, recordData, createdBys, createdAts, updatedAts });
      await insertRelationshipsBatch(pool, {
        ids: relIds,
        sourceDatasetIds: relSourceDatasets,
        sourceRecordIds: relSourceRecords,
        targetDatasetIds: relTargetDatasets,
        targetRecordIds: relTargetRecords,
        relationshipTypes: relTypes,
        descriptions: relDescs,
        createdAts: relCreatedAts,
      });

      if ((b + BATCH_SIZE) % 25000 === 0) {
        console.log(`  ... Sales records inserted: ${b + BATCH_SIZE} / 100,000`);
      }
    }
    console.log("✓ Seeded 100,000 Sales Transactions and 200,000 customer/product relationships.");
  }

  // =========================================================================
  // 6. SHIPMENT & DELIVERY (50,000 records) + Strict Transaction & Customer Match
  // =========================================================================
  console.log("Seeding 6/6: Shipment & Delivery (50,000 records in 10 batches of 5,000)...");
  {
    const carriers = ["FedEx", "UPS", "DHL Express", "USPS", "FreightLink"];
    const shippingMethods = ["Standard", "Express", "Overnight", "Ground", "Two-Day Air"];
    const statuses = ["Delivered", "Delivered", "In Transit", "Out for Delivery", "Delayed"];

    for (let b = 0; b < 50000; b += BATCH_SIZE) {
      const ids: string[] = [];
      const datasetIds: string[] = [];
      const recordData: string[] = [];
      const createdBys: string[] = [];
      const createdAts: string[] = [];
      const updatedAts: string[] = [];

      const relIds: string[] = [];
      const relSourceDatasets: string[] = [];
      const relSourceRecords: string[] = [];
      const relTargetDatasets: string[] = [];
      const relTargetRecords: string[] = [];
      const relTypes: string[] = [];
      const relDescs: (string | null)[] = [];
      const relCreatedAts: string[] = [];

      for (let i = b; i < b + BATCH_SIZE; i++) {
        const tracking = `TRK-${String(i + 1).padStart(6, "0")}`;

        // Link directly to transaction i (0 <= i < 50,000)
        const trxIdx = i;
        const transactionId = getSaleId(trxIdx);

        // Strict Requirement: Shipment customer ID MUST match transaction's customer ID!
        // In Sales transaction i, customerIdx = i % 100,000
        const customerIdx = i % 100000;
        const customerId = getCustomerId(customerIdx);

        const carrier = carriers[i % carriers.length]!;
        const method = shippingMethods[(i * 3) % shippingMethods.length]!;
        const status = statuses[i % statuses.length]!;
        const cost = Number((8.5 + (i % 80) * 1.5).toFixed(2));
        const weight = Number((0.5 + (i % 120) * 0.35).toFixed(2));
        const shippedDate = formatDate(new Date(2024, (i * 3) % 12, 1 + (i % 25)));
        const estDelivery = formatDate(new Date(2024, (i * 3) % 12, 4 + (i % 25)));
        const actDelivery = status === "Delivered" ? estDelivery : null;
        const isSignatureReq = i % 4 === 0;

        ids.push(getShipmentId(i));
        datasetIds.push(SHIPMENT_DATASET_ID);
        recordData.push(
          JSON.stringify({
            tracking_number: tracking,
            transaction_id: transactionId,
            customer_id: customerId,
            carrier,
            shipping_method: method,
            status,
            shipping_cost: cost,
            weight_kg: weight,
            shipped_date: shippedDate,
            estimated_delivery_date: estDelivery,
            actual_delivery_date: actDelivery,
            is_signature_required: isSignatureReq,
          })
        );
        createdBys.push(adminUserId);
        createdAts.push(nowIso);
        updatedAts.push(nowIso);

        // Relationship 1: Shipment -> Sales Transaction
        relIds.push(getRelId(0x60, i));
        relSourceDatasets.push(SHIPMENT_DATASET_ID);
        relSourceRecords.push(getShipmentId(i));
        relTargetDatasets.push(SALE_DATASET_ID);
        relTargetRecords.push(transactionId);
        relTypes.push("SHIPPED_FOR_TRANSACTION");
        relDescs.push(`Shipment fulfillment for Transaction TRX-${String(trxIdx + 1).padStart(6, "0")}`);
        relCreatedAts.push(nowIso);

        // Relationship 2: Shipment -> Customer (Strictly matching)
        relIds.push(getRelId(0x70, i));
        relSourceDatasets.push(SHIPMENT_DATASET_ID);
        relSourceRecords.push(getShipmentId(i));
        relTargetDatasets.push(CUSTOMER_DATASET_ID);
        relTargetRecords.push(customerId);
        relTypes.push("DELIVERED_TO_CUSTOMER");
        relDescs.push(`Shipment destination for Customer CUST-${String(customerIdx + 1).padStart(6, "0")}`);
        relCreatedAts.push(nowIso);
      }

      await insertRecordsBatch(pool, { ids, datasetIds, recordData, createdBys, createdAts, updatedAts });
      await insertRelationshipsBatch(pool, {
        ids: relIds,
        sourceDatasetIds: relSourceDatasets,
        sourceRecordIds: relSourceRecords,
        targetDatasetIds: relTargetDatasets,
        targetRecordIds: relTargetRecords,
        relationshipTypes: relTypes,
        descriptions: relDescs,
        createdAts: relCreatedAts,
      });

      if ((b + BATCH_SIZE) % 25000 === 0) {
        console.log(`  ... Shipment records inserted: ${b + BATCH_SIZE} / 50,000`);
      }
    }
    console.log("✓ Seeded 50,000 Shipment & Delivery records and 100,000 transaction/customer relationships.");
  }

  console.log("\n✓ All 280,000 records and 424,950 relationships seeded successfully!");
}
