export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'SiteTrack API',
    version: '1.0.0',
    description: 'AI-Powered Construction Workforce & Site Management Platform API',
  },
  servers: [
    { url: 'http://localhost:3000/api', description: 'Development server' },
  ],
  tags: [
    { name: 'Attendance', description: 'Worker check-in/out and shift tracking' },
    { name: 'Payments', description: 'Automated daily wage payouts via Razorpay' },
    { name: 'Fraud Alerts', description: 'PPE violations, ghost workers, buddy punching alerts' },
    { name: 'Workers', description: 'Worker management and biometric enrollment' },
    { name: 'Projects', description: 'Construction project management' },
    { name: 'Payroll', description: 'Payroll records and summaries' },
    { name: 'Safety Violations', description: 'CCTV PPE violation detection logs' },
    { name: 'Alerts Stream', description: 'Real-time SSE alerts for safety violations' },
  ],
  paths: {
    '/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Get attendance logs',
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'workerId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'List of attendance records' } },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Clock in or record attendance',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['workerId'],
                properties: {
                  workerId: { type: 'string' },
                  projectId: { type: 'string' },
                  checkInTime: { type: 'string', format: 'date-time' },
                  checkOutTime: { type: 'string', format: 'date-time' },
                  hoursWorked: { type: 'number' },
                  manualBackup: { type: 'boolean' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Attendance recorded' }, '400': { description: 'Validation error' } },
      },
      put: {
        tags: ['Attendance'],
        summary: 'Clock out (update active session)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workerId: { type: 'string' },
                  attendanceId: { type: 'string' },
                  checkOutTime: { type: 'string', format: 'date-time' },
                  hoursWorked: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Checked out' }, '404': { description: 'No active session' } },
      },
    },
    '/payments/process-daily': {
      post: {
        tags: ['Payments'],
        summary: 'Process daily wage payout for a worker',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['workerId'],
                properties: {
                  workerId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Payout processed' }, '400': { description: 'Invalid request' } },
      },
    },
    '/fraud-alerts': {
      get: {
        tags: ['Fraud Alerts'],
        summary: 'Get fraud/safety alerts with stats',
        responses: { '200': { description: 'Alerts and statistics' } },
      },
      post: {
        tags: ['Fraud Alerts'],
        summary: 'Create a fraud alert or run AI anomaly scan',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['scan_anomalies'] },
                  workerId: { type: 'string' },
                  alertType: { type: 'string' },
                  severity: { type: 'string' },
                  details: { type: 'string' },
                  status: { type: 'string' },
                  projectId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Alert created or scan completed' } },
      },
      patch: {
        tags: ['Fraud Alerts'],
        summary: 'Update alert status',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'status'],
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  resolutionNotes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Alert updated' } },
      },
    },
    '/safety-violations': {
      get: {
        tags: ['Safety Violations'],
        summary: 'Get PPE violation logs',
        responses: { '200': { description: 'List of violations' } },
      },
      post: {
        tags: ['Safety Violations'],
        summary: 'Log a PPE safety violation from CCTV AI',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workerId: { type: 'string' },
                  workerName: { type: 'string' },
                  projectId: { type: 'string' },
                  cameraName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Violation logged' } },
      },
    },
    '/alerts/stream': {
      get: {
        tags: ['Alerts Stream'],
        summary: 'SSE stream for real-time alerts',
        responses: {
          '200': {
            description: 'Server-sent events stream of alerts',
            content: { 'text/event-stream': { schema: { type: 'string' } } },
          },
        },
      },
      post: {
        tags: ['Alerts Stream'],
        summary: 'Push an alert to all SSE clients',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['alertType'],
                properties: {
                  workerId: { type: 'string' },
                  alertType: { type: 'string' },
                  severity: { type: 'string' },
                  details: { type: 'string' },
                  projectId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Alert broadcast to clients' } },
      },
    },
    '/workers': {
      get: { tags: ['Workers'], summary: 'List all workers', responses: { '200': { description: 'List of workers' } } },
      post: {
        tags: ['Workers'],
        summary: 'Create a new worker',
        responses: { '200': { description: 'Worker created' } },
      },
    },
    '/projects': {
      get: { tags: ['Projects'], summary: 'List all projects', responses: { '200': { description: 'List of projects' } } },
    },
    '/payroll': {
      get: { tags: ['Payroll'], summary: 'Get payroll records', responses: { '200': { description: 'Payroll records' } } },
    },
  },
};
