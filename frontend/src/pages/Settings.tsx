// import React, { useEffect, useState } from 'react';
// import { Save, RefreshCw, Play, Pause } from 'lucide-react';
// import { useSchedulerStore } from '../store';
// import { Card } from '../components/ui/UIElements';
// import { Button, Input, Select, Toggle } from '../components/ui/FormElements';

// export const Settings: React.FC = () => {
//   const { 
//     status, 
//     loading, 
//     loadStatus, 
//     startScheduler, 
//     stopScheduler, 
//     updateInterval 
//   } = useSchedulerStore();

//   const [config, setConfig] = useState({
//     enabled: false,
//     interval: 60,
//     maxConcurrent: 5,
//     retryAttempts: 3,
//     notificationsEnabled: true,
//     logLevel: 'info'
//   });

//   useEffect(() => {
//     loadStatus();
//   }, [loadStatus]);
//   useEffect(() => {
//     if (status) {
//       setConfig({
//         enabled: status.is_running,
//         interval: status.interval_seconds || 60,
//         maxConcurrent: 5, // Default value as it's not in SchedulerStatus
//         retryAttempts: 3, // Default value as it's not in SchedulerStatus
//         notificationsEnabled: true,
//         logLevel: 'info'
//       });
//     }
//   }, [status]);
//   const handleSaveSettings = async () => {
//     try {
//       await updateInterval(config.interval);
//       // Show success message
//     } catch (error) {
//       console.error('Failed to save settings:', error);
//     }
//   };

//   const handleToggleScheduler = async () => {
//     try {
//       if (status?.is_running) {
//         await stopScheduler();
//       } else {
//         await startScheduler();
//       }
//     } catch (error) {
//       console.error('Failed to toggle scheduler:', error);
//     }
//   };

//   return (
//     <div className="space-y-6 max-w-4xl">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
//           <p className="text-gray-600">Configure your data pipeline system</p>
//         </div>
//         <div className="flex space-x-3">
//           <Button
//             variant="secondary"
//             onClick={loadStatus}
//             disabled={loading}
//           >
//             <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
//             Refresh
//           </Button>
//           <Button onClick={handleSaveSettings}>
//             <Save className="h-4 w-4 mr-2" />
//             Save Changes
//           </Button>
//         </div>
//       </div>

//       {/* Scheduler Settings */}
//       <Card className="p-6">
//         <div className="flex items-center justify-between mb-6">
//           <div>
//             <h3 className="text-lg font-medium text-gray-900">Scheduler Configuration</h3>
//             <p className="text-sm text-gray-600">Control the pipeline execution scheduler</p>
//           </div>
//           <div className="flex items-center space-x-4">
//             <span className="text-sm text-gray-600">
//               Status: {status?.is_running ? (
//                 <span className="text-green-600 font-medium">Running</span>
//               ) : (
//                 <span className="text-gray-600 font-medium">Stopped</span>
//               )}
//             </span>
//             <Button
//               variant="secondary"
//               onClick={handleToggleScheduler}
//               disabled={loading}
//             >
//               {status?.is_running ? (
//                 <>
//                   <Pause className="h-4 w-4 mr-2" />
//                   Stop Scheduler
//                 </>
//               ) : (
//                 <>
//                   <Play className="h-4 w-4 mr-2" />
//                   Start Scheduler
//                 </>
//               )}
//             </Button>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           <div>            <Toggle
//               label="Enable Scheduler"
//               checked={config.enabled}
//               onChange={(checked) => setConfig({ ...config, enabled: checked })}
//             />
//             <p className="text-sm text-gray-500 mt-1">Automatically execute pipelines based on schedule</p>
//           </div>

//           <div>
//             <Input
//               label="Check Interval (seconds)"
//               type="number"
//               value={config.interval}
//               onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) })}
//               min={10}
//               max={3600}
//               helpText="How often to check for scheduled pipelines"
//             />
//           </div>

//           <div>
//             <Input
//               label="Max Concurrent Pipelines"
//               type="number"
//               value={config.maxConcurrent}
//               onChange={(e) => setConfig({ ...config, maxConcurrent: parseInt(e.target.value) })}
//               min={1}
//               max={20}
//               helpText="Maximum number of pipelines running simultaneously"
//             />
//           </div>

//           <div>
//             <Input
//               label="Retry Attempts"
//               type="number"
//               value={config.retryAttempts}
//               onChange={(e) => setConfig({ ...config, retryAttempts: parseInt(e.target.value) })}
//               min={0}
//               max={10}
//               helpText="Number of retry attempts for failed pipelines"
//             />
//           </div>
//         </div>
//       </Card>

//       {/* System Settings */}
//       <Card className="p-6">
//         <h3 className="text-lg font-medium text-gray-900 mb-6">System Configuration</h3>
        
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           <div>
//             <Select
//               label="Log Level"
//               value={config.logLevel}
//               onValueChange={(value) => setConfig({ ...config, logLevel: value })}
//               options={[
//                 { value: 'debug', label: 'Debug' },
//                 { value: 'info', label: 'Info' },
//                 { value: 'warning', label: 'Warning' },
//                 { value: 'error', label: 'Error' },
//               ]}
//               helpText="Minimum log level to record"
//             />
//           </div>

//           <div>
//             <Toggle
//               label="Enable Notifications"
//               checked={config.notificationsEnabled}
//               onChange={(checked) => setConfig({ ...config, notificationsEnabled: checked })}
//               helpText="Send notifications for pipeline events"
//             />
//           </div>
//         </div>
//       </Card>

//       {/* Database Settings */}
//       <Card className="p-6">
//         <h3 className="text-lg font-medium text-gray-900 mb-6">Database Configuration</h3>
        
//         <div className="space-y-4">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <Input
//               label="Connection Pool Size"
//               type="number"
//               value={10}
//               readOnly
//               helpText="Maximum database connections"
//             />

//             <Input
//               label="Query Timeout (seconds)"
//               type="number"
//               value={30}
//               readOnly
//               helpText="Maximum time for database queries"
//             />
//           </div>

//           <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
//             <p className="text-sm text-blue-800">
//               <strong>Note:</strong> Database settings are read-only in this version. 
//               Contact your system administrator to modify these settings.
//             </p>
//           </div>
//         </div>
//       </Card>

//       {/* API Settings */}
//       <Card className="p-6">
//         <h3 className="text-lg font-medium text-gray-900 mb-6">API Configuration</h3>
        
//         <div className="space-y-4">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <Input
//               label="API Rate Limit (requests/minute)"
//               type="number"
//               value={1000}
//               readOnly
//               helpText="Maximum API requests per minute"
//             />

//             <Input
//               label="Request Timeout (seconds)"
//               type="number"
//               value={30}
//               readOnly
//               helpText="Maximum time for API requests"
//             />
//           </div>

//           <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
//             <p className="text-sm text-blue-800">
//               <strong>Note:</strong> API settings are configured at the server level. 
//               These values are for reference only.
//             </p>
//           </div>
//         </div>
//       </Card>
//     </div>
//   );
// };

// Empty export to make this a module
export {};
