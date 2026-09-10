// Set fallback connection string for when run outside Next.js process environment
let databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/sitetrack?schema=public';
if (databaseUrl.includes('127.0.0.1') || databaseUrl.includes('localhost')) {
  try {
    const wslIp = require('child_process').execSync('wsl.exe hostname -I').toString().trim().split(' ')[0];
    if (wslIp) {
      databaseUrl = databaseUrl.replace('127.0.0.1', wslIp).replace('localhost', wslIp);
    }
  } catch (e) {
    // Ignore
  }
}
process.env.DATABASE_URL = databaseUrl;

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash passwords
  const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
  const supervisorPasswordHash = bcrypt.hashSync('Supervisor@123', 10);
  const workerPasswordHash = bcrypt.hashSync('Worker@123', 10);

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sitetrack.com' },
    update: {},
    create: {
      email: 'admin@sitetrack.com',
      name: 'Admin Manager',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });
  console.log('Admin user seeded:', admin.email);

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@sitetrack.com' },
    update: {},
    create: {
      email: 'supervisor@sitetrack.com',
      name: 'Site Supervisor',
      passwordHash: supervisorPasswordHash,
      role: 'SUPERVISOR',
    },
  });
  console.log('Supervisor user seeded:', supervisor.email);

  const workerUser = await prisma.user.upsert({
    where: { email: 'worker@sitetrack.com' },
    update: {},
    create: {
      email: 'worker@sitetrack.com',
      name: 'John Doe',
      role: 'WORKER',
      passwordHash: workerPasswordHash,
    },
  });
  console.log('Worker login user seeded:', workerUser.email);

  // 2. Create Projects
  const projectAlpha = await prisma.project.upsert({
    where: { code: '4092-B' },
    update: {},
    create: {
      name: 'Skyline Heights Residential',
      code: '4092-B',
      location: 'Sector 12, Pune, Maharashtra',
      latitude: 18.5204,
      longitude: 73.8567,
      status: 'ACTIVE',
    },
  });

  const projectBeta = await prisma.project.upsert({
    where: { code: 'ST-2026-HYD' },
    update: {},
    create: {
      name: 'Hyderabad Metro Mall',
      code: 'ST-2026-HYD',
      location: 'Gachibowli, Hyderabad, Telangana',
      latitude: 17.4435,
      longitude: 78.3772,
      status: 'ACTIVE',
    },
  });

  const projectGamma = await prisma.project.upsert({
    where: { code: 'ST-2026-BLR' },
    update: {},
    create: {
      name: 'Namma Metro Phase 3 Extension',
      code: 'ST-2026-BLR',
      location: 'Whitefield, Bengaluru, Karnataka',
      latitude: 12.9698,
      longitude: 77.7500,
      status: 'ACTIVE',
    },
  });

  const projectDelta = await prisma.project.upsert({
    where: { code: 'ST-2026-MUM' },
    update: {},
    create: {
      name: 'BKC Commercial Tower',
      code: 'ST-2026-MUM',
      location: 'Bandra Kurla Complex, Mumbai, Maharashtra',
      latitude: 19.0661,
      longitude: 72.8699,
      status: 'ACTIVE',
    },
  });

  const projectEpsilon = await prisma.project.upsert({
    where: { code: 'ST-2026-CHN' },
    update: {},
    create: {
      name: 'Chennai Industrial Park',
      code: 'ST-2026-CHN',
      location: 'Sriperumbudur, Chennai, Tamil Nadu',
      latitude: 12.9943,
      longitude: 79.9489,
      status: 'ACTIVE',
    },
  });

  const projectZeta = await prisma.project.upsert({
    where: { code: 'ST-2026-GOA' },
    update: {},
    create: {
      name: 'Goa Beach Resort & Spa',
      code: 'ST-2026-GOA',
      location: 'Calangute, North Goa',
      latitude: 15.5488,
      longitude: 73.7520,
      status: 'ON_HOLD',
    },
  });

  console.log('All projects seeded.');

  // Clean old sample attendance and workers to avoid foreign key constraint issues
  await prisma.attendance.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.worker.deleteMany({

    where: {
      name: {
        in: [
          'John Doe', 'Sarah Jenkins', 'Mike Ross',
          'Vinit Patil', 'Viraj Mali', 'Amit Patel',
          'Ramesh Yadav', 'Sunita Devi', 'Vikram Nair',
          'Anita Joshi', 'Deepak Thakur', 'Kavitha Reddy',
          'Suresh Babu', 'Lakshmi Iyer', 'Ravi Shankar',
          'Meera Pillai', 'Arjun Menon', 'Raj Kumar Singh', 'Priya Sharma',
        ],
      },

    },
  });

  // 3. Create Workers for each project (with bank details)
  // --- Project Alpha (Pune Residential) ---
  const worker1 = await prisma.worker.create({
    data: { name: 'Vinit Patil', phone: '+91 98201 11111', wageRate: 850, status: 'ACTIVE', projectId: projectAlpha.id, userId: workerUser.id, bankAccountName: 'Vinit Patil', bankAccountNumber: '20345678901', ifscCode: 'SBIN0001234', paymentType: 'DAILY' },
  });
  const worker2 = await prisma.worker.create({
    data: { name: 'Viraj Mali', phone: '+91 98202 22222', wageRate: 1100, status: 'ACTIVE', projectId: projectAlpha.id, bankAccountName: 'Viraj Mali', bankAccountNumber: '30456789012', ifscCode: 'ICIC0002345', paymentType: 'MONTHLY' },
  });
  const worker3 = await prisma.worker.create({
    data: { name: 'Amit Patel', phone: '+91 98203 33333', wageRate: 700, status: 'ACTIVE', projectId: projectAlpha.id, bankAccountName: 'Amit Patel', bankAccountNumber: '40567890123', ifscCode: 'HDFC0003456', upiId: 'amit.patel@upi', paymentType: 'DAILY' },
  });


  // --- Project Beta (Hyderabad Mall) ---
  const worker4 = await prisma.worker.create({
    data: { name: 'Ramesh Yadav', phone: '+91 97001 44444', wageRate: 950, status: 'ACTIVE', projectId: projectBeta.id, bankAccountName: 'Ramesh Yadav', bankAccountNumber: '50678901234', ifscCode: 'CNRB0004567', paymentType: 'DAILY' },
  });
  const worker5 = await prisma.worker.create({
    data: { name: 'Sunita Devi', phone: '+91 97002 55555', wageRate: 800, status: 'ACTIVE', projectId: projectBeta.id, bankAccountName: 'Sunita Devi', bankAccountNumber: '60789012345', ifscCode: 'BARB0005678', upiId: 'sunita.devi@ybl', paymentType: 'DAILY' },
  });

  // --- Project Gamma (Bengaluru Metro) ---
  const worker6 = await prisma.worker.create({
    data: { name: 'Vikram Nair', phone: '+91 96001 66666', wageRate: 1200, status: 'ACTIVE', projectId: projectGamma.id, bankAccountName: 'Vikram Nair', bankAccountNumber: '70890123456', ifscCode: 'SBIN0006789', paymentType: 'MONTHLY' },
  });
  const worker7 = await prisma.worker.create({
    data: { name: 'Anita Joshi', phone: '+91 96002 77777', wageRate: 900, status: 'INACTIVE', projectId: projectGamma.id, bankAccountName: 'Anita Joshi', bankAccountNumber: '80901234567', ifscCode: 'UTIB0007890', paymentType: 'MONTHLY' },
  });

  // --- Project Delta (Mumbai Tower) ---
  const worker8 = await prisma.worker.create({
    data: { name: 'Deepak Thakur', phone: '+91 95001 88888', wageRate: 1350, status: 'ACTIVE', projectId: projectDelta.id, bankAccountName: 'Deepak Thakur', bankAccountNumber: '91012345678', ifscCode: 'KKBK0008901', paymentType: 'MONTHLY' },
  });
  const worker9 = await prisma.worker.create({
    data: { name: 'Kavitha Reddy', phone: '+91 95002 99999', wageRate: 1100, status: 'ACTIVE', projectId: projectDelta.id, bankAccountName: 'Kavitha Reddy', bankAccountNumber: '10123456789', ifscCode: 'IDFB0009012', upiId: 'kavitha.r@paytm', paymentType: 'DAILY' },
  });

  // --- Project Epsilon (Chennai Industrial) ---
  const worker10 = await prisma.worker.create({
    data: { name: 'Suresh Babu', phone: '+91 94001 10101', wageRate: 750, status: 'ACTIVE', projectId: projectEpsilon.id, bankAccountName: 'Suresh Babu', bankAccountNumber: '21234567890', ifscCode: 'IOBA0001234', paymentType: 'DAILY' },
  });
  const worker11 = await prisma.worker.create({
    data: { name: 'Lakshmi Iyer', phone: '+91 94002 20202', wageRate: 850, status: 'ACTIVE', projectId: projectEpsilon.id, bankAccountName: 'Lakshmi Iyer', bankAccountNumber: '32345678901', ifscCode: 'SBIN0002345', paymentType: 'MONTHLY' },
  });

  // --- Project Zeta (Goa Resort) ---
  const worker12 = await prisma.worker.create({
    data: { name: 'Ravi Shankar', phone: '+91 93001 30303', wageRate: 900, status: 'INACTIVE', projectId: projectZeta.id, bankAccountName: 'Ravi Shankar', bankAccountNumber: '43456789012', ifscCode: 'HDFC0003456', paymentType: 'DAILY' },
  });

  console.log('Workers seeded for all projects.');

  // 4. Seed Milestones per project
  await prisma.scheduleMilestone.createMany({
    data: [
      // Alpha - Pune Residential
      { projectId: projectAlpha.id, name: 'Site Clearance & Levelling', startDate: new Date('2026-07-01'), endDate: new Date('2026-07-10'), plannedProgress: 100, actualProgress: 100 },
      { projectId: projectAlpha.id, name: 'Foundation & Basement', startDate: new Date('2026-07-11'), endDate: new Date('2026-08-10'), plannedProgress: 100, actualProgress: 85 },
      { projectId: projectAlpha.id, name: 'Superstructure (G+5)', startDate: new Date('2026-08-11'), endDate: new Date('2026-10-30'), plannedProgress: 40, actualProgress: 22 },
      { projectId: projectAlpha.id, name: 'Finishing & Interiors', startDate: new Date('2026-11-01'), endDate: new Date('2027-01-31'), plannedProgress: 0, actualProgress: 0 },
      // Beta - Hyderabad Mall
      { projectId: projectBeta.id, name: 'Soil Testing & Approvals', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-20'), plannedProgress: 100, actualProgress: 100 },
      { projectId: projectBeta.id, name: 'Piling & Raft Foundation', startDate: new Date('2026-06-21'), endDate: new Date('2026-08-15'), plannedProgress: 90, actualProgress: 75 },
      { projectId: projectBeta.id, name: 'Structural Steel Erection', startDate: new Date('2026-08-16'), endDate: new Date('2026-10-31'), plannedProgress: 10, actualProgress: 0 },
      { projectId: projectBeta.id, name: 'MEP Rough-in & Fit-out', startDate: new Date('2026-11-01'), endDate: new Date('2027-03-31'), plannedProgress: 0, actualProgress: 0 },
      // Gamma - Bengaluru Metro
      { projectId: projectGamma.id, name: 'Tunnel Boring (Section A)', startDate: new Date('2026-05-01'), endDate: new Date('2026-08-31'), plannedProgress: 70, actualProgress: 65 },
      { projectId: projectGamma.id, name: 'Station Box Excavation', startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), plannedProgress: 50, actualProgress: 40 },
      { projectId: projectGamma.id, name: 'Track Laying & OHE', startDate: new Date('2026-10-01'), endDate: new Date('2027-02-28'), plannedProgress: 0, actualProgress: 0 },
      // Delta - Mumbai Tower
      { projectId: projectDelta.id, name: 'Piling Works', startDate: new Date('2026-06-01'), endDate: new Date('2026-07-15'), plannedProgress: 100, actualProgress: 100 },
      { projectId: projectDelta.id, name: 'Core & Shell Construction', startDate: new Date('2026-07-16'), endDate: new Date('2026-12-31'), plannedProgress: 60, actualProgress: 55 },
      { projectId: projectDelta.id, name: 'Glazing & Cladding', startDate: new Date('2027-01-01'), endDate: new Date('2027-04-30'), plannedProgress: 0, actualProgress: 0 },
      // Epsilon - Chennai Industrial
      { projectId: projectEpsilon.id, name: 'Land Preparation', startDate: new Date('2026-08-01'), endDate: new Date('2026-08-15'), plannedProgress: 100, actualProgress: 100 },
      { projectId: projectEpsilon.id, name: 'Industrial Shed Fabrication', startDate: new Date('2026-08-16'), endDate: new Date('2026-10-15'), plannedProgress: 50, actualProgress: 30 },
    ],
  });

  // 5. Seed BOQ Items per project
  await prisma.bOQItem.createMany({
    data: [
      // Alpha - Pune Residential
      { projectId: projectAlpha.id, description: 'M25 Ready-mix Concrete', unit: 'm³', quantity: 450, estimatedCost: 1125000 },
      { projectId: projectAlpha.id, description: 'Fe500 Steel Rebars', unit: 'MT', quantity: 55, estimatedCost: 2805000 },
      { projectId: projectAlpha.id, description: 'AAC Blocks 600x200x150mm', unit: 'Nos', quantity: 12000, estimatedCost: 420000 },
      { projectId: projectAlpha.id, description: 'River Sand (Plastering Grade)', unit: 'm³', quantity: 200, estimatedCost: 180000 },
      // Beta - Hyderabad Mall
      { projectId: projectBeta.id, description: 'Structural Steel H-Beams', unit: 'MT', quantity: 320, estimatedCost: 17600000 },
      { projectId: projectBeta.id, description: 'M30 High-Performance Concrete', unit: 'm³', quantity: 900, estimatedCost: 3150000 },
      { projectId: projectBeta.id, description: 'Pre-stressed Concrete Piles', unit: 'Nos', quantity: 180, estimatedCost: 5400000 },
      { projectId: projectBeta.id, description: 'Waterproofing Membrane', unit: 'm²', quantity: 2500, estimatedCost: 875000 },
      // Gamma - Bengaluru Metro
      { projectId: projectGamma.id, description: 'TBM Tunnel Lining Segments', unit: 'Rings', quantity: 1200, estimatedCost: 48000000 },
      { projectId: projectGamma.id, description: 'High-Speed Railway Track', unit: 'km', quantity: 4.2, estimatedCost: 21000000 },
      { projectId: projectGamma.id, description: 'OHE Mast & Catenary Wire', unit: 'Sets', quantity: 84, estimatedCost: 3360000 },
      // Delta - Mumbai Tower
      { projectId: projectDelta.id, description: 'Glass Curtain Wall System', unit: 'm²', quantity: 8500, estimatedCost: 63750000 },
      { projectId: projectDelta.id, description: 'Core Wall M40 Concrete', unit: 'm³', quantity: 1200, estimatedCost: 6000000 },
      { projectId: projectDelta.id, description: 'Elevator Shaft Lining', unit: 'Floors', quantity: 28, estimatedCost: 2800000 },
      // Epsilon - Chennai Industrial
      { projectId: projectEpsilon.id, description: 'Pre-engineered Steel Shed', unit: 'MT', quantity: 180, estimatedCost: 7200000 },
      { projectId: projectEpsilon.id, description: 'Industrial Flooring (Hardener)', unit: 'm²', quantity: 6000, estimatedCost: 1200000 },
      { projectId: projectEpsilon.id, description: 'Roofing Sandwich Panels', unit: 'm²', quantity: 4800, estimatedCost: 2400000 },
    ],
  });

  // 6. Seed Daily Reports
  await prisma.dailyReport.createMany({
    data: [
      { projectId: projectAlpha.id, note: 'Foundation pour for Sector 2 completed. Curing compounds applied. Engineer inspection cleared.', date: new Date('2026-08-05'), submittedById: supervisor.id },
      { projectId: projectBeta.id, note: 'Raft slab concrete pour underway at Grid C-D. Slump test: 90mm. Temperature: 34°C, shading arranged.', date: new Date('2026-08-05'), submittedById: supervisor.id },
      { projectId: projectGamma.id, note: 'TBM "Kaveri" advanced 18m today. No obstructions. Ring count: 847 of 1200.', date: new Date('2026-08-05'), submittedById: supervisor.id },
      { projectId: projectDelta.id, note: 'Core wall formwork stripped at Level 14. Ready for next pour at Level 15.', date: new Date('2026-08-05'), submittedById: supervisor.id },
    ],
  });

  // 7. Seed Daily Tasks
  await prisma.dailyTask.createMany({
    data: [
      { projectId: projectAlpha.id, title: 'Curing of Foundation Slab', description: 'Ensure water curing of all exposed concrete for minimum 7 days.', date: new Date('2026-08-06'), assignedWorkerId: worker1.id, status: 'PENDING' },
      { projectId: projectAlpha.id, title: 'Column Shuttering at Level 2', description: 'Erect column formwork as per drawing DRG-S-204.', date: new Date('2026-08-06'), assignedWorkerId: worker2.id, status: 'DONE' },
      { projectId: projectBeta.id, title: 'Rebar Placement at Raft Slab', description: 'Place Fe500 rebar at 150mm c/c spacing per structural drawing.', date: new Date('2026-08-06'), assignedWorkerId: worker4.id, status: 'PENDING' },
      { projectId: projectBeta.id, title: 'Dewatering Pump Check', description: 'Inspect and run dewatering pumps in excavation pit, record flow rate.', date: new Date('2026-08-06'), assignedWorkerId: worker5.id, status: 'DONE' },
      { projectId: projectGamma.id, title: 'TBM Grouting Operation', description: 'Annulus grouting behind last 5 rings. Pressure: 2.5 bar.', date: new Date('2026-08-06'), assignedWorkerId: worker6.id, status: 'PENDING' },
      { projectId: projectDelta.id, title: 'MEP Coordination Meeting', description: 'Coordinate with MEP team on Level 12 duct routing conflicts.', date: new Date('2026-08-06'), assignedWorkerId: worker8.id, status: 'PENDING' },
      { projectId: projectEpsilon.id, title: 'Steel Column Erection', description: 'Erect pre-engineered steel columns at Bays A1–A6 per fabrication drawings.', date: new Date('2026-08-06'), assignedWorkerId: worker10.id, status: 'PENDING' },
    ],
  });

  // 8. Seed Suppliers
  const supplier1 = await prisma.supplier.upsert({
    where: { id: 'supplier-apex-001' },
    update: {},
    create: {
      id: 'supplier-apex-001',
      name: 'Apex Steel & Concrete Pvt. Ltd.',
      phone: '+91 22 4001 1111',
      materialsSupplied: 'Reinforcement Steel, M25/M30 Concrete, Cement',
    },
  });
  const supplier2 = await prisma.supplier.upsert({
    where: { id: 'supplier-rajshree-002' },
    update: {},
    create: {
      id: 'supplier-rajshree-002',
      name: 'Rajshree Infra Materials',
      phone: '+91 80 4002 2222',
      materialsSupplied: 'Bricks, AAC Blocks, River Sand, Aggregates',
    },
  });
  const supplier3 = await prisma.supplier.upsert({
    where: { id: 'supplier-bharat-003' },
    update: {},
    create: {
      id: 'supplier-bharat-003',
      name: 'Bharat Structural Steel Works',
      phone: '+91 40 4003 3333',
      materialsSupplied: 'Structural Steel, H-Beams, Pre-engineered Building Systems',
    },
  });

  // 9. Seed Material Requests
  await prisma.materialRequest.createMany({
    data: [
      { projectId: projectAlpha.id, itemName: 'M25 Concrete (50m³)', quantity: 50, unit: 'm³', status: 'APPROVED', requestedById: supervisor.id, approvedById: admin.id, supplierId: supplier1.id },
      { projectId: projectAlpha.id, itemName: 'Fe500 Rebars 16mm', quantity: 5, unit: 'MT', status: 'PENDING', requestedById: supervisor.id, supplierId: supplier1.id },
      { projectId: projectBeta.id, itemName: 'Structural Steel H200 Beams', quantity: 15, unit: 'MT', status: 'APPROVED', requestedById: supervisor.id, approvedById: admin.id, supplierId: supplier3.id },
      { projectId: projectGamma.id, itemName: 'Tunnel Grout (Rapid-Set)', quantity: 200, unit: 'Bags', status: 'PENDING', requestedById: supervisor.id, supplierId: supplier1.id },
      { projectId: projectEpsilon.id, itemName: 'Pre-Eng Steel Columns', quantity: 24, unit: 'Nos', status: 'APPROVED', requestedById: supervisor.id, approvedById: admin.id, supplierId: supplier3.id },
    ],
  });

  // 10. Seed Stock Items
  await prisma.stockItem.createMany({
    data: [
      { projectId: projectAlpha.id, itemName: 'M25 Ready-mix Concrete', quantityOnHand: 280, unit: 'm³' },
      { projectId: projectAlpha.id, itemName: 'Fe500 Steel Rebars', quantityOnHand: 38, unit: 'MT' },
      { projectId: projectAlpha.id, itemName: 'OPC 53 Cement', quantityOnHand: 620, unit: 'Bags' },
      { projectId: projectBeta.id, itemName: 'H-Section Steel Beams', quantityOnHand: 42, unit: 'MT' },
      { projectId: projectBeta.id, itemName: 'M30 Concrete', quantityOnHand: 180, unit: 'm³' },
      { projectId: projectGamma.id, itemName: 'TBM Cutter Discs (spare)', quantityOnHand: 12, unit: 'Nos' },
      { projectId: projectGamma.id, itemName: 'Grout Bags (Rapid-set)', quantityOnHand: 850, unit: 'Bags' },
      { projectId: projectDelta.id, itemName: 'Glass Units (DGU 12mm)', quantityOnHand: 320, unit: 'm²' },
      { projectId: projectEpsilon.id, itemName: 'Steel Columns (Pre-eng)', quantityOnHand: 18, unit: 'Nos' },
      { projectId: projectEpsilon.id, itemName: 'Roofing Panels', quantityOnHand: 420, unit: 'm²' },
    ],
  });

  // 11. Seed Vehicles & Equipment
  const vehicles = [
    { name: 'JCB 3DX Backhoe Loader', plateNumber: 'MH-14-BH-0012', projectId: projectAlpha.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-09-01') },
    { name: 'TATA Tipper 2518', plateNumber: 'MH-12-TP-7755', projectId: projectAlpha.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-09-20') },
    { name: 'CAT 323 Excavator', plateNumber: 'TS-09-EX-0034', projectId: projectBeta.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-08-30') },
    { name: 'Schwing Stetter Batching Plant', plateNumber: 'TS-11-BP-0001', projectId: projectBeta.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-10-15') },
    { name: 'Robbins TBM (Kaveri)', plateNumber: 'KA-TBM-001', projectId: projectGamma.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-11-01') },
    { name: 'Liebherr Tower Crane LTM', plateNumber: 'MH-01-CR-2201', projectId: projectDelta.id, status: 'ACTIVE', maintenanceDueDate: new Date('2026-09-30') },
    { name: 'KATO 35T Mobile Crane', plateNumber: 'TN-07-CR-4411', projectId: projectEpsilon.id, status: 'MAINTENANCE', maintenanceDueDate: new Date('2026-08-10') },
  ];
  for (const v of vehicles) {
    await prisma.vehicle.create({ data: v });
  }

  // 12. Seed Tools
  await prisma.tool.createMany({
    data: [
      { name: 'Bosch GBH 2-26 Rotary Hammer', quantity: 4, projectId: projectAlpha.id, status: 'AVAILABLE' },
      { name: 'Total Station (Leica TS16)', quantity: 1, projectId: projectAlpha.id, assignedWorkerId: worker2.id, status: 'IN_USE' },
      { name: 'Bar Bending Machine', quantity: 2, projectId: projectBeta.id, assignedWorkerId: worker4.id, status: 'IN_USE' },
      { name: 'Core Cutter Machine', quantity: 1, projectId: projectGamma.id, status: 'AVAILABLE' },
      { name: 'Digital Torque Wrench Set', quantity: 3, projectId: projectDelta.id, status: 'AVAILABLE' },
      { name: 'Angle Grinder (9")', quantity: 6, projectId: projectEpsilon.id, assignedWorkerId: worker10.id, status: 'IN_USE' },
    ],
  });

  // 13. Seed Reminders
  await prisma.reminder.createMany({
    data: [
      { note: 'Submit monthly labour hours report to payroll office.', dueDate: new Date('2026-08-10'), userId: supervisor.id },
      { note: 'Hyderabad Mall: Structural consultant review of raft slab drawings.', dueDate: new Date('2026-08-12'), userId: admin.id },
      { note: 'Bengaluru Metro: Weekly TBM progress report to BMRCL.', dueDate: new Date('2026-08-08'), userId: supervisor.id },
      { note: 'Mumbai BKC: Fire NOC application deadline.', dueDate: new Date('2026-08-20'), userId: admin.id },
      { note: 'Chennai Park: Vendor payment — Bharat Structural, Invoice #BSW-2026-034.', dueDate: new Date('2026-08-15'), userId: admin.id },
    ],
  });

  console.log('Workers roster seeded successfully.');
  console.log('Database seeding complete!');
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
