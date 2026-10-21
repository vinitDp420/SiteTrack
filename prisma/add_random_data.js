require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Mukesh', 'Sanjay', 'Dharmendra', 'Vinod', 'Manoj', 'Santosh', 'Rajesh', 'Anil',
  'Prakash', 'Ganesh', 'Sachin', 'Rahul', 'Mahesh', 'Sunil', 'Ajay', 'Vijay',
  'Ashok', 'Kishore', 'Naveen', 'Pradeep', 'Subhash', 'Kamal', 'Babulal', 'Harish',
  'Mohan', 'Suraj', 'Satish', 'Balram', 'Chandan', 'Deepak', 'Gopal', 'Hemant',
  'Ishwar', 'Jagdish', 'Kailash', 'Lalit', 'Madan', 'Nandlal', 'Omkar', 'Pankaj'
];

const LAST_NAMES = [
  'Kumar', 'Verma', 'Singh', 'Chauhan', 'Tiwari', 'Yadav', 'Gupta', 'Sharma',
  'Jadhav', 'Shinde', 'Sawant', 'Gaikwad', 'Mishra', 'Pandey', 'Kadam', 'Patil',
  'More', 'Bhosale', 'Pawar', 'Chavan', 'Salunkhe', 'Deshmukh', 'Kulkarni', 'Joshi',
  'Rathore', 'Meena', 'Gurjar', 'Choudhary', 'Dubey', 'Tripathi', 'Shukla', 'Bishnoi'
];

const TRADES = [
  { trade: 'Master Mason', wage: 950 },
  { trade: 'Rebar Bender & Tier', wage: 850 },
  { trade: 'Structural Welder (6G)', wage: 1100 },
  { trade: 'Licensed Electrician', wage: 1050 },
  { trade: 'Plumber & Pipe Fitter', wage: 900 },
  { trade: 'Finishing Carpenter', wage: 950 },
  { trade: 'Heavy Equipment Operator', wage: 1250 },
  { trade: 'Site Land Surveyor', wage: 1400 },
  { trade: 'Scaffolding Inspector', wage: 1000 },
  { trade: 'Helper / Labourer', wage: 650 },
  { trade: 'Concrete Pump Operator', wage: 1150 },
  { trade: 'Tower Crane Rigger', wage: 1300 },
];

const BANK_NAMES = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Bank of Baroda', 'Canara Bank', 'Punjab National Bank'];
const IFSC_CODES = ['SBIN0004521', 'HDFC0001892', 'ICIC0003412', 'UTIB0002109', 'BARB0007812', 'CNRB0003291', 'PUNB0006742'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('--- Generating & Inserting Rich Random Data for SiteTrack ---');

  const projects = await prisma.project.findMany();
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const supervisor = await prisma.user.findFirst({ where: { role: 'SUPERVISOR' } }) || admin;

  if (projects.length === 0 || !admin) {
    console.error('Projects or Admin user not found. Ensure primary seed is run first.');
    return;
  }

  const now = new Date();

  // 1. Generate 35 Additional Workers across all projects
  console.log('1. Adding 35 Workers across active construction sites...');
  const newWorkers = [];
  for (let i = 0; i < 35; i++) {
    const fName = randomChoice(FIRST_NAMES);
    const lName = randomChoice(LAST_NAMES);
    const fullName = `${fName} ${lName}`;
    const tradeInfo = randomChoice(TRADES);
    const proj = randomChoice(projects);
    const bankIdx = randomInt(0, BANK_NAMES.length - 1);
    const phone = `+91 ${randomInt(91000, 99999)} ${randomInt(10000, 99999)}`;
    const upi = `${fName.toLowerCase()}.${lName.toLowerCase()}${randomInt(10, 99)}@ok${randomChoice(['sbi', 'icici', 'axis', 'hdfc'])}`;
    const accNo = `${randomInt(20, 60)}${randomInt(100000000, 999999999)}`;

    const worker = await prisma.worker.create({
      data: {
        name: fullName,
        phone,
        wageRate: tradeInfo.wage + randomInt(-50, 100),
        status: Math.random() > 0.08 ? 'ACTIVE' : 'INACTIVE',
        projectId: proj.id,
        bankAccountName: fullName,
        bankAccountNumber: accNo,
        ifscCode: IFSC_CODES[bankIdx],
        upiId: upi,
        paymentType: Math.random() > 0.4 ? 'DAILY' : 'MONTHLY',
      },
    });
    newWorkers.push(worker);
  }
  console.log(`Successfully added ${newWorkers.length} workers.`);

  // 2. Add Attendance Logs for the past 14 days for these workers
  console.log('2. Adding 14-day attendance records for new workers...');
  let attCount = 0;
  for (const w of newWorkers) {
    if (w.status !== 'ACTIVE') continue;

    // Today's shift (50% on-site right now)
    if (Math.random() > 0.3) {
      await prisma.attendance.create({
        data: {
          workerId: w.id,
          projectId: w.projectId,
          date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          checkInTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, randomInt(15, 55)),
          status: 'ON_SITE',
          manualBackup: Math.random() > 0.85,
        },
      });
      attCount++;
    }

    // Past 10 days
    for (let d = 1; d <= 10; d++) {
      if (d === 7) continue; // Sunday off
      const shiftDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const isPresent = Math.random() > 0.12;

      if (isPresent) {
        const hours = randomChoice([8.0, 8.5, 9.0, 9.5, 8.0, 8.0]);
        const inMins = randomInt(10, 50);
        await prisma.attendance.create({
          data: {
            workerId: w.id,
            projectId: w.projectId,
            date: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate()),
            checkInTime: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 8, inMins),
            checkOutTime: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 8 + Math.floor(hours), inMins + (hours % 1) * 60),
            hoursWorked: hours,
            status: 'PRESENT',
            manualBackup: Math.random() > 0.9,
          },
        });
        attCount++;
      }
    }
  }
  console.log(`Added ${attCount} attendance records.`);

  // 3. Add Payments / Disbursal Vouchers
  console.log('3. Generating Payout vouchers...');
  let payCount = 0;
  for (const w of newWorkers) {
    const numPayments = randomInt(1, 3);
    for (let p = 0; p < numPayments; p++) {
      const isSuccess = Math.random() > 0.2;
      const status = isSuccess ? 'SUCCESS' : Math.random() > 0.5 ? 'PROCESSING' : 'PENDING';
      const daysAgo = randomInt(1, 15);
      await prisma.payment.create({
        data: {
          workerId: w.id,
          projectId: w.projectId,
          amount: w.paymentType === 'DAILY' ? w.wageRate * randomInt(1, 3) : w.wageRate * 26,
          type: w.paymentType,
          status,
          razorpayPayoutId: `pout_RZP${randomInt(100000, 999999)}${Date.now().toString().slice(-4)}`,
          paymentDate: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
        },
      });
      payCount++;
    }
  }
  console.log(`Added ${payCount} payment records.`);

  // 4. Add Suppliers
  console.log('4. Adding Industrial Suppliers...');
  const newSuppliers = [
    { name: 'Tata BlueScope Steel Building Products', phone: '+91 20 6601 2233', materialsSupplied: 'Colorbond Steel Sheets, Roof Trusses, Decking Profiles' },
    { name: 'Asian Paints Pro Project Finishes', phone: '+91 22 6218 1000', materialsSupplied: 'Apex Ultima Exterior Paints, Wall Putty, Damp Proof Primers' },
    { name: 'Havells Industrial Cables & Switchgear', phone: '+91 12 0477 1000', materialsSupplied: 'Armoured Copper Cables, MCBs, DB Boxes, Industrial Conduits' },
    { name: 'Supreme Industries Piping Solutions', phone: '+91 22 2580 4000', materialsSupplied: 'CPVC Plumbing Pipes, SWR Drainage Fittings, Overhead Water Tanks' },
    { name: 'Godrej Security & Access Solutions', phone: '+91 22 6796 1700', materialsSupplied: 'Fire Rated Steel Doors, Digital Panic Bars, Perimeter Fencing' },
    { name: 'Kirloskar Dewatering & Diesel Gensets', phone: '+91 20 2721 2400', materialsSupplied: 'Silent Diesel Generators (125kVA - 500kVA), Submersible Slurry Pumps' },
  ];

  const createdSuppliers = [];
  for (const sup of newSuppliers) {
    const s = await prisma.supplier.create({ data: sup });
    createdSuppliers.push(s);
  }

  // 5. Add BOQ Items across projects
  console.log('5. Adding Diverse BOQ Line Items...');
  const additionalBOQ = [
    { description: 'CPVC Hot & Cold Water Distribution Piping (1" to 2")', unit: 'Rmt', quantity: 1850, estimatedCost: 740000 },
    { description: 'FRLS Copper Armoured Power Cable 4 Core 25 sq.mm', unit: 'm', quantity: 2400, estimatedCost: 1440000 },
    { description: 'Fire Suppression Sprinkler Piping & Chrome Heads', unit: 'Points', quantity: 640, estimatedCost: 960000 },
    { description: 'Vitrified Anti-Skid Floor Tiles 800x800mm', unit: 'm²', quantity: 3800, estimatedCost: 3230000 },
    { description: 'Anodized Aluminium Sliding Window Sections (Heavy Grade)', unit: 'm²', quantity: 850, estimatedCost: 2975000 },
    { description: 'External Weather-Resistant Silicone Texture Paint Coating', unit: 'm²', quantity: 6200, estimatedCost: 1116000 },
    { description: 'Structural Galvanized Steel Cable Tray (300mm x 50mm)', unit: 'm', quantity: 950, estimatedCost: 475000 },
    { description: 'Polyurethane Joint Sealant for Expansion Slabs', unit: 'Rmt', quantity: 1200, estimatedCost: 288000 },
    { description: 'Automatic Passenger Elevator 13-Pax (1.75 m/s, 14 Stops)', unit: 'Sets', quantity: 4, estimatedCost: 7200000 },
    { description: 'Solar Rooftop Grid-Tied PV Array 50kWp', unit: 'kWp', quantity: 50, estimatedCost: 2500000 },
  ];

  for (const item of additionalBOQ) {
    const p = randomChoice(projects);
    await prisma.bOQItem.create({
      data: {
        projectId: p.id,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        estimatedCost: item.estimatedCost,
      },
    });
  }

  // 6. Add Material Requests & Stock Items
  console.log('6. Adding Material Requests & Site Stock Inventory...');
  const matRequestsData = [
    { itemName: 'Armoured Copper Power Cable (500m)', quantity: 500, unit: 'm', status: 'ORDERED' },
    { itemName: 'CPVC Heavy Plumbing Pipe 32mm', quantity: 120, unit: 'Lengths', status: 'APPROVED' },
    { itemName: 'Asian Paints Damp Proof Primer (20L Cans)', quantity: 40, unit: 'Buckets', status: 'RECEIVED' },
    { itemName: 'Diesel Fuel for Excavator & Batching Plant', quantity: 1500, unit: 'Liters', status: 'RECEIVED' },
    { itemName: 'Scaffolding Swivel Couplers & Clamps', quantity: 500, unit: 'Nos', status: 'REQUESTED' },
    { itemName: 'Submersible Sump Dewatering Pump 5HP', quantity: 3, unit: 'Units', status: 'APPROVED' },
    { itemName: 'High-Impact Polycarbonate Safety Goggles', quantity: 80, unit: 'Nos', status: 'RECEIVED' },
    { itemName: 'Industrial Core Bit 100mm Diamond Tip', quantity: 6, unit: 'Nos', status: 'REQUESTED' },
  ];

  for (const req of matRequestsData) {
    const p = randomChoice(projects);
    const sup = randomChoice(createdSuppliers);
    await prisma.materialRequest.create({
      data: {
        projectId: p.id,
        itemName: req.itemName,
        quantity: req.quantity,
        unit: req.unit,
        status: req.status,
        requestedById: supervisor.id,
        approvedById: req.status !== 'REQUESTED' ? admin.id : null,
        supplierId: sup ? sup.id : null,
      },
    });
  }

  const newStockData = [
    { itemName: 'Havells 4-Core Armoured Cable', quantityOnHand: 420, unit: 'm' },
    { itemName: 'Supreme CPVC Pipes 32mm', quantityOnHand: 85, unit: 'Lengths' },
    { itemName: 'Apex Exterior Weather Paint (20L)', quantityOnHand: 32, unit: 'Buckets' },
    { itemName: 'Scaffolding Gi Pipes 48mm', quantityOnHand: 650, unit: 'Rmt' },
    { itemName: 'Anchor Fasteners M12 (Grade 8.8)', quantityOnHand: 2400, unit: 'Nos' },
    { itemName: 'Safety Fall Arrest Harnesses', quantityOnHand: 45, unit: 'Sets' },
    { itemName: 'Welding Electrodes E7018 (5kg boxes)', quantityOnHand: 78, unit: 'Boxes' },
    { itemName: 'Diesel Reserve Fuel', quantityOnHand: 850, unit: 'Liters' },
  ];

  for (const stock of newStockData) {
    const p = randomChoice(projects);
    await prisma.stockItem.create({
      data: {
        projectId: p.id,
        itemName: stock.itemName,
        quantityOnHand: stock.quantityOnHand,
        unit: stock.unit,
      },
    });
  }

  // 7. Add Vehicles & Machinery with Fuel / Hours Logs
  console.log('7. Adding Heavy Construction Machinery & Vehicle Fuel Logs...');
  const newVehicles = [
    { name: 'Volvo EC210D Crawler Excavator', plateNumber: 'MH-14-EX-9921', status: 'ACTIVE', maintenanceDueDate: new Date('2026-11-20') },
    { name: 'Ashok Leyland 2518 RMC Transit Mixer', plateNumber: 'MH-12-TM-3341', status: 'ACTIVE', maintenanceDueDate: new Date('2026-11-10') },
    { name: 'CASE 1107 EX-D Vibratory Soil Compactor', plateNumber: 'TS-08-VR-4412', status: 'ACTIVE', maintenanceDueDate: new Date('2026-12-01') },
    { name: 'Kirloskar 250 kVA Mobile DG Genset Trailer', plateNumber: 'KA-05-DG-7711', status: 'ACTIVE', maintenanceDueDate: new Date('2026-11-30') },
    { name: 'ACE 14XW Rough Terrain Mobile Crane', plateNumber: 'DL-01-CR-8822', status: 'ACTIVE', maintenanceDueDate: new Date('2026-12-15') },
  ];

  for (const v of newVehicles) {
    const p = randomChoice(projects);
    const createdV = await prisma.vehicle.create({
      data: {
        name: v.name,
        plateNumber: v.plateNumber,
        status: v.status,
        projectId: p.id,
        maintenanceDueDate: v.maintenanceDueDate,
      },
    });

    // Add 4 realistic operational & fuel logs
    for (let day = 1; day <= 4; day++) {
      await prisma.vehicleLog.create({
        data: {
          vehicleId: createdV.id,
          date: new Date(now.getTime() - day * 24 * 60 * 60 * 1000),
          hoursUsed: randomChoice([6.5, 7.0, 7.5, 8.0, 8.5]),
          fuelFilled: randomChoice([45, 55, 60, 75, 80]),
          notes: randomChoice([
            'Subgrade compaction & grading on access road.',
            'Continuous foundation pour at Sector 3.',
            'Trenching for storm water drain lines.',
            'Lifting of steel reinforcement bundles to 3rd floor.',
            'Uninterrupted DG power supplied during main grid maintenance.',
          ]),
        },
      });
    }
  }

  // 8. Add Precision Tools & Equipment
  console.log('8. Adding Precision Hand Tools & Safety Gear...');
  const newTools = [
    { name: 'Hilti TE 70-ATC SDS-Max Demolition Hammer', quantity: 3, status: 'AVAILABLE' },
    { name: 'Geomax Zone 60 DG Automatic Dual-Grade Laser', quantity: 2, status: 'AVAILABLE' },
    { name: 'Makita 18V Cordless Rebar Tier Tool', quantity: 4, status: 'IN_USE' },
    { name: 'Mikasa Plate Compactor (Honda GX160 Engine)', quantity: 3, status: 'AVAILABLE' },
    { name: 'Lincoln Electric Inverter Welding Machine 400A', quantity: 5, status: 'IN_USE' },
    { name: 'Elcometer Concrete Cover Meter & Rebar Locator', quantity: 1, status: 'AVAILABLE' },
  ];

  for (const t of newTools) {
    const p = randomChoice(projects);
    const assignedW = t.status === 'IN_USE' ? randomChoice(newWorkers) : null;
    await prisma.tool.create({
      data: {
        name: t.name,
        quantity: t.quantity,
        projectId: p.id,
        assignedWorkerId: assignedW ? assignedW.id : null,
        status: t.status,
      },
    });
  }

  // 9. Add Daily Tasks & Daily Reports
  console.log('9. Adding Tasks & Site Reports...');
  const taskDescriptions = [
    { title: 'Rebar Tying at Level 4 Slab', desc: 'Complete binding of top and bottom reinforcement meshes with 18G wire.' },
    { title: 'Column Shuttering Verticality Inspection', desc: 'Verify plumb and diagonal alignment using laser level prior to concrete pour.' },
    { title: 'Electrical Conduit Routing in Brickwork', desc: 'Chase brick walls and embed 25mm PVC conduits for power circuits.' },
    { title: 'Dewatering Pump Fueling & Maintenance', desc: 'Clean strainer, top up diesel and ensure pit water level is below footing base.' },
    { title: 'Plaster Slump & Mortar Quality Check', desc: 'Perform field moisture test on 1:4 cement mortar mix at batching area.' },
    { title: 'Scaffolding Safety Guardrail Tightening', desc: 'Inspect top rail, mid rail and toe board fixings on external perimeter.' },
  ];

  for (const td of taskDescriptions) {
    const p = randomChoice(projects);
    const w = randomChoice(newWorkers);
    await prisma.dailyTask.create({
      data: {
        projectId: p.id,
        title: td.title,
        description: td.desc,
        date: now,
        assignedWorkerId: w.id,
        status: Math.random() > 0.4 ? 'DONE' : 'PENDING',
      },
    });
  }

  const reportNotes = [
    'Core wall shuttering climbed to Level 16. Structural engineer approved rebar reinforcement. Ready for concrete pour tomorrow morning.',
    'Heavy rain at 2:00 PM caused temporary site pause for 45 minutes. Dewatering pumps deployed immediately. Excavation pit secured.',
    'Third-party safety audit completed by Bureau Veritas. High compliance score awarded. Minor housekeeping items addressed on spot.',
    'Delivered 35 metric tonnes of TMT rebars from Apex Steel. Mill test certificates verified by quality supervisor.',
  ];

  for (const note of reportNotes) {
    const p = randomChoice(projects);
    await prisma.dailyReport.create({
      data: {
        projectId: p.id,
        note,
        date: new Date(now.getTime() - randomInt(1, 5) * 24 * 60 * 60 * 1000),
        submittedById: supervisor.id,
      },
    });
  }

  // 10. Add Fraud Alerts & Safety Surveillance
  console.log('10. Adding Safety & Fraud Surveillance Incidents...');
  const alertsData = [
    { alertType: 'PPE_VIOLATION', severity: 'HIGH', status: 'PENDING', details: 'Absence of chin strap and hard hat in active excavator radius' },
    { alertType: 'PPE_VIOLATION', severity: 'CRITICAL', status: 'INVESTIGATING', details: 'Worker working at height (6.5m) without safety harness hooked to lifeline' },
    { alertType: 'BUDDY_PUNCHING', severity: 'HIGH', status: 'PENDING', details: 'Suspicious dual card swipe within 2.8 seconds on Gate Kiosk Node' },
    { alertType: 'GEO_FENCE_BREACH', severity: 'MEDIUM', status: 'RESOLVED', details: 'Check-in attempted from unauthorized remote coordinate (520m outside site perimeter)' },
    { alertType: 'BIOMETRIC_SPOOF', severity: 'CRITICAL', status: 'INVESTIGATING', details: 'Anti-spoofing IR camera detected printed color photograph presented to kiosk' },
    { alertType: 'GHOST_WORKER', severity: 'MEDIUM', status: 'DISMISSED', details: 'Unmatched face biometric attempted clock-in on registered worker profile' },
  ];

  for (const a of alertsData) {
    const w = randomChoice(newWorkers);
    await prisma.fraudAlert.create({
      data: {
        workerId: w.id,
        alertType: a.alertType,
        severity: a.severity,
        status: a.status,
        details: a.details,
        timestamp: new Date(now.getTime() - randomInt(1, 48) * 60 * 60 * 1000),
      },
    });
  }

  // 11. Add Reminders
  console.log('11. Adding Administrative & Site Reminders...');
  const remindersData = [
    { note: 'Renew Cranes & Hoists Third-Party Load Testing Certification before expiry.', dueDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000) },
    { note: 'Release fortnightly subcontractor labour wage payments via Razorpay batch disbursal.', dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    { note: 'Conduct mandatory Monthly Site Safety Toolbox Talk on Working at Heights.', dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) },
    { note: 'Review concrete compressive cube strength test 28-day results for Sector 2 pour.', dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
  ];

  for (const r of remindersData) {
    await prisma.reminder.create({
      data: {
        note: r.note,
        dueDate: r.dueDate,
        userId: admin.id,
        isRead: false,
      },
    });
  }

  console.log('\n--- Random Data Generation Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Error adding random data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
