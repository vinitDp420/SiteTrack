require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Full Database Seeding for SiteTrack ---');

  // 1. Password Hashes
  const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
  const supervisorPasswordHash = bcrypt.hashSync('Supervisor@123', 10);
  const workerPasswordHash = bcrypt.hashSync('Worker@123', 10);

  // 2. Clear old data in strict reverse-dependency order
  console.log('Cleaning old test data...');
  await prisma.fraudAlert.deleteMany({});
  await prisma.vehicleLog.deleteMany({});
  await prisma.dailyTask.deleteMany({});
  await prisma.tool.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.materialRequest.deleteMany({});
  await prisma.stockItem.deleteMany({});
  await prisma.dailyReport.deleteMany({});
  await prisma.bOQItem.deleteMany({});
  await prisma.scheduleMilestone.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.reminder.deleteMany({});
  await prisma.worker.deleteMany({});
  await prisma.supplier.deleteMany({});

  // 3. Upsert Users
  console.log('Seeding Users...');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sitetrack.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@sitetrack.com',
      name: 'Admin Manager',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@sitetrack.com' },
    update: { passwordHash: supervisorPasswordHash },
    create: {
      email: 'supervisor@sitetrack.com',
      name: 'Site Supervisor',
      passwordHash: supervisorPasswordHash,
      role: 'SUPERVISOR',
    },
  });

  const workerUser = await prisma.user.upsert({
    where: { email: 'worker@sitetrack.com' },
    update: { passwordHash: workerPasswordHash },
    create: {
      email: 'worker@sitetrack.com',
      name: 'Vinit Patil',
      role: 'WORKER',
      passwordHash: workerPasswordHash,
    },
  });

  // 4. Upsert Projects
  console.log('Seeding Projects...');
  const pAlpha = await prisma.project.upsert({
    where: { code: '4092-B' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Skyline Heights Residential',
      code: '4092-B',
      location: 'Sector 12, Pune, Maharashtra',
      latitude: 18.5204,
      longitude: 73.8567,
      status: 'ACTIVE',
    },
  });

  const pBeta = await prisma.project.upsert({
    where: { code: 'ST-2026-HYD' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Hyderabad Metro Mall',
      code: 'ST-2026-HYD',
      location: 'Gachibowli, Hyderabad, Telangana',
      latitude: 17.4435,
      longitude: 78.3772,
      status: 'ACTIVE',
    },
  });

  const pGamma = await prisma.project.upsert({
    where: { code: 'ST-2026-BLR' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Namma Metro Phase 3 Extension',
      code: 'ST-2026-BLR',
      location: 'Whitefield, Bengaluru, Karnataka',
      latitude: 12.9698,
      longitude: 77.75,
      status: 'ACTIVE',
    },
  });

  const pDelta = await prisma.project.upsert({
    where: { code: 'ST-2026-MUM' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'BKC Commercial Tower',
      code: 'ST-2026-MUM',
      location: 'Bandra Kurla Complex, Mumbai, Maharashtra',
      latitude: 19.0661,
      longitude: 72.8699,
      status: 'ACTIVE',
    },
  });

  const pEpsilon = await prisma.project.upsert({
    where: { code: 'ST-2026-CHN' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Chennai Industrial Park',
      code: 'ST-2026-CHN',
      location: 'Sriperumbudur, Chennai, Tamil Nadu',
      latitude: 12.9943,
      longitude: 79.9489,
      status: 'ACTIVE',
    },
  });

  const pZeta = await prisma.project.upsert({
    where: { code: 'ST-2026-GOA' },
    update: { status: 'ON_HOLD' },
    create: {
      name: 'Goa Beach Resort & Spa',
      code: 'ST-2026-GOA',
      location: 'Calangute, North Goa',
      latitude: 15.5488,
      longitude: 73.752,
      status: 'ON_HOLD',
    },
  });

  // 5. Seed Workers with bank & payout details
  console.log('Seeding Workers...');
  const workers = [
    // Pune
    { name: 'Vinit Patil', phone: '+91 98201 11111', wageRate: 850, projectId: pAlpha.id, userId: workerUser.id, bankAccountName: 'Vinit Patil', bankAccountNumber: '20345678901', ifscCode: 'SBIN0001234', upiId: 'vinit.patel@okhdfcbank', paymentType: 'DAILY' },
    { name: 'Viraj Mali', phone: '+91 98202 22222', wageRate: 1100, projectId: pAlpha.id, bankAccountName: 'Viraj Mali', bankAccountNumber: '30456789012', ifscCode: 'ICIC0002345', upiId: 'viraj.mali@paytm', paymentType: 'MONTHLY' },
    { name: 'Amit Patel', phone: '+91 98203 33333', wageRate: 700, projectId: pAlpha.id, bankAccountName: 'Amit Patel', bankAccountNumber: '40567890123', ifscCode: 'HDFC0003456', upiId: 'amit.patel@upi', paymentType: 'DAILY' },
    { name: 'Sunita Devi', phone: '+91 98204 44444', wageRate: 800, projectId: pAlpha.id, bankAccountName: 'Sunita Devi', bankAccountNumber: '50678901234', ifscCode: 'BARB0005678', upiId: 'sunita.devi@ybl', paymentType: 'DAILY' },
    { name: 'Rohit Sharma', phone: '+91 98205 55555', wageRate: 950, projectId: pAlpha.id, bankAccountName: 'Rohit Sharma', bankAccountNumber: '60789012345', ifscCode: 'CNRB0001122', upiId: 'rohit.s@okaxis', paymentType: 'DAILY' },

    // Hyderabad
    { name: 'Ramesh Yadav', phone: '+91 97001 44444', wageRate: 950, projectId: pBeta.id, bankAccountName: 'Ramesh Yadav', bankAccountNumber: '50678901234', ifscCode: 'CNRB0004567', paymentType: 'DAILY' },
    { name: 'Vikram Nair', phone: '+91 97002 66666', wageRate: 1200, projectId: pBeta.id, bankAccountName: 'Vikram Nair', bankAccountNumber: '70890123456', ifscCode: 'SBIN0006789', paymentType: 'MONTHLY' },
    { name: 'Anita Joshi', phone: '+91 97003 77777', wageRate: 900, projectId: pBeta.id, bankAccountName: 'Anita Joshi', bankAccountNumber: '80901234567', ifscCode: 'UTIB0007890', paymentType: 'MONTHLY' },
    { name: 'Suresh Babu', phone: '+91 97004 88888', wageRate: 750, projectId: pBeta.id, bankAccountName: 'Suresh Babu', bankAccountNumber: '91012345678', ifscCode: 'IOBA0001234', upiId: 'suresh.b@paytm', paymentType: 'DAILY' },

    // Bengaluru
    { name: 'Deepak Thakur', phone: '+91 96001 88888', wageRate: 1350, projectId: pGamma.id, bankAccountName: 'Deepak Thakur', bankAccountNumber: '91012345678', ifscCode: 'KKBK0008901', paymentType: 'MONTHLY' },
    { name: 'Kavitha Reddy', phone: '+91 96002 99999', wageRate: 1100, projectId: pGamma.id, bankAccountName: 'Kavitha Reddy', bankAccountNumber: '10123456789', ifscCode: 'IDFB0009012', upiId: 'kavitha.r@paytm', paymentType: 'DAILY' },
    { name: 'Lakshmi Iyer', phone: '+91 96003 20202', wageRate: 850, projectId: pGamma.id, bankAccountName: 'Lakshmi Iyer', bankAccountNumber: '32345678901', ifscCode: 'SBIN0002345', paymentType: 'MONTHLY' },
    { name: 'Arjun Menon', phone: '+91 96004 30303', wageRate: 1050, projectId: pGamma.id, bankAccountName: 'Arjun Menon', bankAccountNumber: '43456789012', ifscCode: 'FDRL0001234', paymentType: 'DAILY' },

    // Mumbai
    { name: 'Raj Kumar Singh', phone: '+91 95001 40404', wageRate: 1400, projectId: pDelta.id, bankAccountName: 'Raj Kumar Singh', bankAccountNumber: '54567890123', ifscCode: 'HDFC0001234', paymentType: 'MONTHLY' },
    { name: 'Priya Sharma', phone: '+91 95002 50505', wageRate: 1150, projectId: pDelta.id, bankAccountName: 'Priya Sharma', bankAccountNumber: '65678901234', ifscCode: 'SBIN0005566', upiId: 'priya.s@oksbi', paymentType: 'DAILY' },
    { name: 'Meera Pillai', phone: '+91 95003 60606', wageRate: 900, projectId: pDelta.id, bankAccountName: 'Meera Pillai', bankAccountNumber: '76789012345', ifscCode: 'AXIS0005678', paymentType: 'DAILY' },
  ];

  const createdWorkers = [];
  for (const w of workers) {
    const created = await prisma.worker.create({ data: w });
    createdWorkers.push(created);
  }

  // 6. Seed Attendance & Shifts (Past 7 days + Today active)
  console.log('Seeding Attendance records...');
  const now = new Date();
  for (const w of createdWorkers) {
    // Today's shift (Currently ON_SITE)
    await prisma.attendance.create({
      data: {
        workerId: w.id,
        projectId: w.projectId,
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        checkInTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30),
        status: 'ON_SITE',
        manualBackup: false,
      },
    });

    // Past 6 days completed shifts
    for (let dayOffset = 1; dayOffset <= 6; dayOffset++) {
      const shiftDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const hours = 8 + (dayOffset % 2 === 0 ? 0.5 : 0);
      await prisma.attendance.create({
        data: {
          workerId: w.id,
          projectId: w.projectId,
          date: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate()),
          checkInTime: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 8, 30),
          checkOutTime: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 8 + Math.floor(hours), 30 + (hours % 1) * 60),
          hoursWorked: hours,
          status: 'PRESENT',
          manualBackup: dayOffset === 3,
        },
      });
    }
  }

  // 7. Seed Payroll Records
  console.log('Seeding Payroll...');
  for (const w of createdWorkers) {
    await prisma.payroll.create({
      data: {
        workerId: w.id,
        periodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        periodEnd: new Date(now.getFullYear(), now.getMonth(), 0),
        totalHours: 176,
        totalEarnings: (w.wageRate / 8) * 176,
        status: 'PROCESSED',
      },
    });
  }

  // 8. Seed Payments / Disbursals
  console.log('Seeding Payments ledger...');
  let payIndex = 100;
  for (const w of createdWorkers) {
    payIndex++;
    await prisma.payment.create({
      data: {
        workerId: w.id,
        projectId: w.projectId,
        amount: w.wageRate,
        type: w.paymentType,
        status: payIndex % 5 === 0 ? 'PROCESSING' : payIndex % 7 === 0 ? 'PENDING' : 'SUCCESS',
        razorpayPayoutId: `pout_IN${Date.now().toString().slice(-6)}${payIndex}`,
        paymentDate: new Date(now.getTime() - (payIndex % 4) * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 9. Seed Fraud Alerts & Safety Surveillance
  console.log('Seeding Fraud Alerts...');
  const fraudData = [
    { workerId: createdWorkers[0].id, alertType: 'PPE_VIOLATION', severity: 'HIGH', status: 'PENDING', details: 'Hard hat missing in Zone 4 (Active Crane Lifting Area)' },
    { workerId: createdWorkers[1].id, alertType: 'PPE_VIOLATION', severity: 'MEDIUM', status: 'RESOLVED', details: 'High-visibility safety vest unbuttoned near batching plant' },
    { workerId: createdWorkers[2].id, alertType: 'BUDDY_PUNCHING', severity: 'CRITICAL', status: 'INVESTIGATING', details: 'Consecutive RFID/PIN clock-in within 3.2 seconds at Gate Kiosk 01' },
    { workerId: createdWorkers[5].id, alertType: 'GEO_FENCE_BREACH', severity: 'HIGH', status: 'PENDING', details: 'Clock-in attempted 380 meters outside site geofence perimeter' },
    { workerId: createdWorkers[6].id, alertType: 'BIOMETRIC_SPOOF', severity: 'CRITICAL', status: 'RESOLVED', details: 'Anti-spoofing algorithm flagged non-live 2D mobile screen presentation' },
    { workerId: createdWorkers[9].id, alertType: 'PPE_VIOLATION', severity: 'LOW', status: 'DISMISSED', details: 'Temporary removal of safety glasses during eye drop medication' },
  ];
  for (const fa of fraudData) {
    await prisma.fraudAlert.create({ data: fa });
  }

  // 10. Seed Schedule Milestones (Gantt)
  console.log('Seeding Schedule Milestones...');
  const milestones = [
    // Pune
    { projectId: pAlpha.id, name: 'Site Clearance & Bulk Excavation', startDate: new Date('2026-07-01'), endDate: new Date('2026-07-20'), plannedProgress: 100, actualProgress: 100 },
    { projectId: pAlpha.id, name: 'Raft Foundation & Water-Proofing', startDate: new Date('2026-07-21'), endDate: new Date('2026-08-25'), plannedProgress: 100, actualProgress: 90 },
    { projectId: pAlpha.id, name: 'Superstructure RCC Columns (G+12)', startDate: new Date('2026-08-26'), endDate: new Date('2026-11-30'), plannedProgress: 55, actualProgress: 42 },
    { projectId: pAlpha.id, name: 'Brickwork & Internal Plastering', startDate: new Date('2026-12-01'), endDate: new Date('2027-02-28'), plannedProgress: 0, actualProgress: 0 },

    // Hyderabad
    { projectId: pBeta.id, name: 'Geotechnical Soil Investigation', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-15'), plannedProgress: 100, actualProgress: 100 },
    { projectId: pBeta.id, name: 'Cast-in-Situ Piling Works', startDate: new Date('2026-06-16'), endDate: new Date('2026-08-10'), plannedProgress: 95, actualProgress: 88 },
    { projectId: pBeta.id, name: 'Structural Steel Portal Frames', startDate: new Date('2026-08-11'), endDate: new Date('2026-10-31'), plannedProgress: 40, actualProgress: 25 },
    { projectId: pBeta.id, name: 'HVAC & MEP Duct Routing', startDate: new Date('2026-11-01'), endDate: new Date('2027-03-31'), plannedProgress: 0, actualProgress: 0 },

    // Bengaluru
    { projectId: pGamma.id, name: 'TBM Tunnel Drive (Downline Track)', startDate: new Date('2026-05-01'), endDate: new Date('2026-09-30'), plannedProgress: 75, actualProgress: 68 },
    { projectId: pGamma.id, name: 'Underground Station Box Concreting', startDate: new Date('2026-07-15'), endDate: new Date('2026-11-15'), plannedProgress: 45, actualProgress: 38 },
    { projectId: pGamma.id, name: 'Ballastless Track Slab Installation', startDate: new Date('2026-11-16'), endDate: new Date('2027-02-15'), plannedProgress: 0, actualProgress: 0 },

    // Mumbai
    { projectId: pDelta.id, name: 'Diaphragm Wall & Anchor Struts', startDate: new Date('2026-06-01'), endDate: new Date('2026-07-31'), plannedProgress: 100, actualProgress: 100 },
    { projectId: pDelta.id, name: 'Jump-Form Core Wall Up to L20', startDate: new Date('2026-08-01'), endDate: new Date('2026-12-31'), plannedProgress: 60, actualProgress: 52 },
    { projectId: pDelta.id, name: 'Unitized Glass Facade Installation', startDate: new Date('2027-01-01'), endDate: new Date('2027-04-30'), plannedProgress: 0, actualProgress: 0 },
  ];
  await prisma.scheduleMilestone.createMany({ data: milestones });

  // 11. Seed BOQ Items
  console.log('Seeding BOQ Items...');
  const boqData = [
    // Pune
    { projectId: pAlpha.id, description: 'M25 Grade Ready-Mix Concrete', unit: 'm³', quantity: 650, estimatedCost: 1820000 },
    { projectId: pAlpha.id, description: 'Fe500D TMT Thermo-Mechanically Treated Rebars', unit: 'MT', quantity: 72, estimatedCost: 3960000 },
    { projectId: pAlpha.id, description: 'AAC Light-weight Aerated Blocks 600x200x150mm', unit: 'Nos', quantity: 18000, estimatedCost: 630000 },
    { projectId: pAlpha.id, description: 'Manufactured Crushed Sand (M-Sand)', unit: 'm³', quantity: 320, estimatedCost: 288000 },
    { projectId: pAlpha.id, description: 'Double Coat External Plastering with Waterproofing', unit: 'm²', quantity: 4200, estimatedCost: 504000 },

    // Hyderabad
    { projectId: pBeta.id, description: 'High-Tensile Structural Steel H-Beams', unit: 'MT', quantity: 280, estimatedCost: 15400000 },
    { projectId: pBeta.id, description: 'M35 Self-Compacting Concrete (SCC)', unit: 'm³', quantity: 820, estimatedCost: 3280000 },
    { projectId: pBeta.id, description: 'Pre-Cast Bored Piling Units (600mm dia)', unit: 'Nos', quantity: 140, estimatedCost: 4900000 },
    { projectId: pBeta.id, description: 'EPDM Geo-Synthetic Waterproofing Membrane', unit: 'm²', quantity: 3400, estimatedCost: 1190000 },

    // Bengaluru
    { projectId: pGamma.id, description: 'Reinforced Pre-Cast TBM Tunnel Lining Rings', unit: 'Rings', quantity: 1450, estimatedCost: 58000000 },
    { projectId: pGamma.id, description: 'Head-Hardened High Speed Rail Track (UIC-60)', unit: 'km', quantity: 6.8, estimatedCost: 34000000 },
    { projectId: pGamma.id, description: 'Overhead 25kV Catenary Mast Structures', unit: 'Sets', quantity: 96, estimatedCost: 3840000 },

    // Mumbai
    { projectId: pDelta.id, description: 'Double Glazed Low-E Unitized Curtain Wall', unit: 'm²', quantity: 9200, estimatedCost: 69000000 },
    { projectId: pDelta.id, description: 'High-Strength M50 Core Wall Concrete', unit: 'm³', quantity: 1500, estimatedCost: 8250000 },
    { projectId: pDelta.id, description: 'Structural Post-Tensioning Strand Cables', unit: 'MT', quantity: 45, estimatedCost: 4050000 },
  ];
  await prisma.bOQItem.createMany({ data: boqData });

  // 12. Seed Suppliers
  console.log('Seeding Suppliers...');
  const s1 = await prisma.supplier.create({
    data: { name: 'Apex Steel & TMT Rebars Ltd.', phone: '+91 22 4001 1111', materialsSupplied: 'Fe500D TMT Steel, Structural H-Beams, Binding Wire' },
  });
  const s2 = await prisma.supplier.create({
    data: { name: 'UltraTech ReadyMix Concrete Hub', phone: '+91 80 4002 2222', materialsSupplied: 'M25, M30, M35, M50 Ready-Mix Concrete, OPC 53 Cement' },
  });
  const s3 = await prisma.supplier.create({
    data: { name: 'Rajshree Infra Blocks & Sands', phone: '+91 20 4003 3333', materialsSupplied: 'AAC Blocks, M-Sand, Plaster Sand, Coarse Aggregates' },
  });
  const s4 = await prisma.supplier.create({
    data: { name: 'Larsen Safety & Hardware Supplies', phone: '+91 40 4004 4444', materialsSupplied: 'Safety Helmets, Harnesses, High-Vis Vests, Angle Grinders' },
  });

  // 13. Seed Material Requests
  console.log('Seeding Material Requests...');
  const matRequests = [
    { projectId: pAlpha.id, itemName: 'M25 Ready-Mix Concrete (60m³)', quantity: 60, unit: 'm³', status: 'RECEIVED', requestedById: supervisor.id, approvedById: admin.id, supplierId: s2.id },
    { projectId: pAlpha.id, itemName: 'Fe500D Rebars 16mm (8MT)', quantity: 8, unit: 'MT', status: 'ORDERED', requestedById: supervisor.id, approvedById: admin.id, supplierId: s1.id },
    { projectId: pAlpha.id, itemName: 'AAC Blocks 600x200mm (2000 Nos)', quantity: 2000, unit: 'Nos', status: 'APPROVED', requestedById: supervisor.id, approvedById: admin.id, supplierId: s3.id },
    { projectId: pAlpha.id, itemName: 'ISI Approved Safety Helmets', quantity: 50, unit: 'Nos', status: 'REQUESTED', requestedById: supervisor.id, supplierId: s4.id },

    { projectId: pBeta.id, itemName: 'Structural Steel Beams (25MT)', quantity: 25, unit: 'MT', status: 'ORDERED', requestedById: supervisor.id, approvedById: admin.id, supplierId: s1.id },
    { projectId: pBeta.id, itemName: 'M35 Concrete (120m³)', quantity: 120, unit: 'm³', status: 'RECEIVED', requestedById: supervisor.id, approvedById: admin.id, supplierId: s2.id },

    { projectId: pGamma.id, itemName: 'Rapid-Setting Grouting Bags', quantity: 400, unit: 'Bags', status: 'APPROVED', requestedById: supervisor.id, approvedById: admin.id, supplierId: s2.id },
    { projectId: pDelta.id, itemName: 'Low-E Double Glazed Panels', quantity: 85, unit: 'm²', status: 'REQUESTED', requestedById: supervisor.id },
  ];
  await prisma.materialRequest.createMany({ data: matRequests });

  // 14. Seed Stock Inventory
  console.log('Seeding Stock Items...');
  const stockData = [
    { projectId: pAlpha.id, itemName: 'M25 Ready-Mix Concrete', quantityOnHand: 340, unit: 'm³' },
    { projectId: pAlpha.id, itemName: 'Fe500D Steel Rebars (12mm-25mm)', quantityOnHand: 48, unit: 'MT' },
    { projectId: pAlpha.id, itemName: 'UltraTech OPC 53 Grade Cement', quantityOnHand: 850, unit: 'Bags' },
    { projectId: pAlpha.id, itemName: 'AAC Masonry Blocks (600x200mm)', quantityOnHand: 4200, unit: 'Nos' },
    { projectId: pAlpha.id, itemName: 'River Sand / M-Sand', quantityOnHand: 180, unit: 'm³' },

    { projectId: pBeta.id, itemName: 'Heavy Structural H-Beams', quantityOnHand: 65, unit: 'MT' },
    { projectId: pBeta.id, itemName: 'High-Performance Concrete M35', quantityOnHand: 210, unit: 'm³' },
    { projectId: pBeta.id, itemName: 'Waterproofing Membrane Rolls', quantityOnHand: 85, unit: 'Rolls' },

    { projectId: pGamma.id, itemName: 'Pre-Cast Concrete Lining Segments', quantityOnHand: 180, unit: 'Rings' },
    { projectId: pGamma.id, itemName: 'Rapid-Hardening Grout Bags', quantityOnHand: 920, unit: 'Bags' },
    { projectId: pGamma.id, itemName: 'TBM Tungsten Carbide Cutter Discs', quantityOnHand: 16, unit: 'Nos' },

    { projectId: pDelta.id, itemName: 'Low-E DGU Facade Units', quantityOnHand: 410, unit: 'm²' },
    { projectId: pDelta.id, itemName: 'Post-Tensioning High Tensile Wire', quantityOnHand: 22, unit: 'MT' },
  ];
  await prisma.stockItem.createMany({ data: stockData });

  // 15. Seed Vehicles & Heavy Equipment + Vehicle Logs
  console.log('Seeding Vehicles & Fuel Logs...');
  const vehicles = [
    { name: 'JCB 3DX EcoXcellence Backhoe Loader', plateNumber: 'MH-14-BH-0012', projectId: pAlpha.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-11-15') },
    { name: 'TATA Signa 2823.K Tipper Truck', plateNumber: 'MH-12-TP-7755', projectId: pAlpha.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-11-28') },
    { name: 'CAT 323D Heavy Hydraulic Excavator', plateNumber: 'TS-09-EX-0034', projectId: pBeta.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-12-05') },
    { name: 'Schwing Stetter Mobile Transit Mixer 6m³', plateNumber: 'TS-11-TM-0089', projectId: pBeta.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-11-20') },
    { name: 'Liebherr 280 EC-H High-Rise Tower Crane', plateNumber: 'MH-01-CR-2201', projectId: pDelta.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-12-10') },
    { name: 'KATO 50-Tonne All-Terrain Mobile Crane', plateNumber: 'KA-04-CR-8890', projectId: pGamma.id, status: 'MAINTENANCE', maintenanceDueDate: new Date('2026-10-25') },
  ];

  for (const v of vehicles) {
    const veh = await prisma.vehicle.create({ data: v });
    // Add logs
    await prisma.vehicleLog.createMany({
      data: [
        { vehicleId: veh.id, date: new Date(now.getTime() - 24 * 60 * 60 * 1000), hoursUsed: 7.5, fuelFilled: 65, notes: 'Excavation & foundation trenching. Engine pressure normal.' },
        { vehicleId: veh.id, date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), hoursUsed: 8.0, fuelFilled: 70, notes: 'Full shift operation on Sector C. Hyd fluid checked.' },
        { vehicleId: veh.id, date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), hoursUsed: 6.0, fuelFilled: 50, notes: 'Material shifting from stockyard to site gate.' },
      ],
    });
  }

  // 16. Seed Hand Tools & Machinery
  console.log('Seeding Tools...');
  const tools = [
    { name: 'Bosch Professional GBH 2-26 Rotary Hammer', quantity: 6, projectId: pAlpha.id, status: 'AVAILABLE' },
    { name: 'Leica TS16 Robotic Total Station & Tripod', quantity: 1, projectId: pAlpha.id, assignedWorkerId: createdWorkers[1].id, status: 'IN_USE' },
    { name: 'Heavy-Duty 32mm Rebar Bending Machine', quantity: 2, projectId: pAlpha.id, assignedWorkerId: createdWorkers[0].id, status: 'IN_USE' },
    { name: 'Hilti DD 250 Diamond Core Drilling System', quantity: 1, projectId: pBeta.id, status: 'AVAILABLE' },
    { name: 'Digital Torque Wrench Calibration Kit', quantity: 3, projectId: pDelta.id, status: 'AVAILABLE' },
    { name: 'Dewalt Heavy 9" Angle Grinder Set', quantity: 8, projectId: pBeta.id, assignedWorkerId: createdWorkers[5].id, status: 'IN_USE' },
  ];
  await prisma.tool.createMany({ data: tools });

  // 17. Seed Daily Reports & Tasks
  console.log('Seeding Daily Reports & Tasks...');
  await prisma.dailyReport.createMany({
    data: [
      { projectId: pAlpha.id, note: 'Foundation slab pour completed. 65m³ concrete placed. Core compressive test cubes casted. Curing started.', date: new Date(now.getTime() - 24 * 60 * 60 * 1000), submittedById: supervisor.id },
      { projectId: pBeta.id, note: 'Raft rebar binding 92% done. Dewatering pumps running continuously. Slump test: 110mm.', date: new Date(now.getTime() - 24 * 60 * 60 * 1000), submittedById: supervisor.id },
      { projectId: pGamma.id, note: 'TBM "Kaveri" progressed 14.2m today. Segment rings 942-950 assembled. Grouting pressure stable at 2.4 bar.', date: new Date(now.getTime() - 24 * 60 * 60 * 1000), submittedById: supervisor.id },
    ],
  });

  await prisma.dailyTask.createMany({
    data: [
      { projectId: pAlpha.id, title: 'RCC Column Shuttering Level 3', description: 'Erect column formwork as per drawing DRG-S-302.', date: now, assignedWorkerId: createdWorkers[0].id, status: 'DONE' },
      { projectId: pAlpha.id, title: 'Water Curing of Foundation Slab', description: 'Ensure ponding water curing for minimum 10 days.', date: now, assignedWorkerId: createdWorkers[1].id, status: 'PENDING' },
      { projectId: pBeta.id, title: 'Portal Frame Rebar Tying', description: 'Tie Fe500 20mm rebars at 150mm c/c spacing.', date: now, assignedWorkerId: createdWorkers[5].id, status: 'PENDING' },
      { projectId: pDelta.id, title: 'Curtain Wall Anchor Alignment', description: 'Verify bracket torque with digital torque wrench.', date: now, assignedWorkerId: createdWorkers[13].id, status: 'PENDING' },
    ],
  });

  // 18. Seed Reminders
  console.log('Seeding Reminders...');
  await prisma.reminder.createMany({
    data: [
      { note: 'Submit weekly labour attendance & wage verification report to HR.', dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), userId: supervisor.id },
      { note: 'Skyline Heights: Structural consultant inspection of 4th floor slab.', dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), userId: admin.id },
      { note: 'Vendor Payment: Apex Steel Invoice #AST-2026-904 (DueDate: Friday).', dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), userId: admin.id },
      { note: 'Fire Safety NOC Renewal for Pune Sector 12 site.', dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), userId: supervisor.id },
    ],
  });

  console.log('\n--- Full Seeding Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
