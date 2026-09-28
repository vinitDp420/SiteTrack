import React from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

const phases = [
  {
    name: 'Phase 1: Research & Design',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    tasks: [
      { name: 'Literature Review & Requirements Gathering', start: 1, end: 2, progress: 100 },
      { name: 'System Architecture Design', start: 2, end: 3, progress: 100 },
    ],
  },
  {
    name: 'Phase 2: Development & AI Training',
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    tasks: [
      { name: 'PPE Detection YOLOv8 Model Training', start: 4, end: 6, progress: 75 },
      { name: 'Kiosk Application Implementation', start: 5, end: 7, progress: 40 },
      { name: 'Payroll API Infrastructure Setup', start: 7, end: 8, progress: 0 },
    ],
  },
  {
    name: 'Phase 3: System Integration & Testing',
    color: 'bg-teal-500',
    lightColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
    tasks: [
      { name: 'End-to-End System Integration', start: 9, end: 10, progress: 0 },
      { name: 'Field Trials & Hyperparameter Tuning', start: 11, end: 12, progress: 0 },
    ],
  },
];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TimelinePage() {
  return (
    <div className="min-h-screen bg-gray-50/50 p-8 sm:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Project Timeline</h1>
          <p className="text-gray-500 mt-3 text-lg max-w-3xl">
            Interactive Gantt chart illustrating the 12-month lifecycle for the AI-Driven Construction Site Management project.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-2 sm:p-6">
            <div className="overflow-x-auto pb-4">
              <div className="min-w-[900px]">
                {/* Timeline Header (Months) */}
                <div className="grid grid-cols-12 gap-px bg-gray-50 border-b border-gray-200 sticky top-0 z-20 rounded-t-xl">
                  {months.map((month, idx) => (
                    <div key={month} className="p-4 text-center">
                      <div className="font-semibold text-sm text-gray-800">Month {idx + 1}</div>
                      <div className="text-xs text-gray-400 font-medium mt-1 uppercase tracking-wider">{month}</div>
                    </div>
                  ))}
                </div>

                {/* Timeline Body */}
                <div className="divide-y divide-gray-100 relative">
                  {/* Vertical Grid Lines */}
                  <div className="absolute inset-0 grid grid-cols-12 gap-px pointer-events-none z-0">
                    {months.map((_, i) => (
                      <div key={`grid-${i}`} className="border-r border-gray-100/60 h-full" />
                    ))}
                  </div>

                  {phases.map((phase) => (
                    <div key={phase.name} className="relative z-10 pb-6">
                      {/* Phase Header */}
                      <div className={`px-6 py-4 ${phase.lightColor} border-y border-white/50 backdrop-blur-sm flex items-center sticky left-0`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${phase.color} mr-3 shadow-sm`} />
                        <h3 className={`font-semibold ${phase.textColor} tracking-wide`}>{phase.name}</h3>
                      </div>

                      {/* Phase Tasks */}
                      <div className="py-6 space-y-5">
                        {phase.tasks.map((task) => {
                          const colStart = task.start;
                          const colSpan = task.end - task.start + 1;
                          
                          return (
                            <div key={task.name} className="grid grid-cols-12 gap-px px-px relative">
                              <div
                                className="relative h-14 flex items-center px-4 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer bg-white border border-gray-200 overflow-hidden group"
                                style={{ gridColumn: `${colStart} / span ${colSpan}` }}
                              >
                                {/* Progress Background Fill */}
                                <div 
                                  className={`absolute top-0 left-0 bottom-0 ${phase.color} opacity-[0.12] transition-all duration-500 ease-out`} 
                                  style={{ width: `${task.progress}%` }}
                                />
                                {/* Solid Color Left Accent Line */}
                                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${phase.color}`} />
                                
                                <div className="relative z-10 flex items-center justify-between w-full pl-3 pr-1">
                                  <span className="font-medium text-gray-800 text-sm truncate pr-4">
                                    {task.name}
                                  </span>
                                  
                                  <div className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                                    {task.progress === 100 ? (
                                      <CheckCircle2 className={`w-5 h-5 ${phase.textColor}`} />
                                    ) : task.progress > 0 ? (
                                      <span className={`text-xs font-bold ${phase.textColor} bg-white px-2.5 py-1 rounded-full border ${phase.borderColor} shadow-sm inline-block`}>
                                        {task.progress}%
                                      </span>
                                    ) : (
                                      <CircleDashed className="w-5 h-5 text-gray-300" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
