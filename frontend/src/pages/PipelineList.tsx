import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  Download,
  RefreshCw,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { usePipelineStore } from '../store';
import { Card, Badge, Modal } from '../components/ui/UIElements';
import { Button, Input, Select } from '../components/ui/FormElements';
import { formatDate } from '../utils';
import { Pipeline } from '../types';

export const PipelineList: React.FC = () => {  const { 
    pipelines, 
    loading, 
    loadPipelines, 
    deletePipeline, 
    stopPipeline,
    restartPipeline 
  } = usePipelineStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; pipeline: Pipeline | null }>({
    open: false,
    pipeline: null
  });
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  // Pipeline statistics
  const stats = {
    total: pipelines.length,
    running: pipelines.filter(p => p.status === 'running').length,
    stopped: pipelines.filter(p => p.status === 'stopped').length,
    error: pipelines.filter(p => p.status === 'error').length,
    created: pipelines.filter(p => p.status === 'created').length,
  };

  // Helper functions to get source and sink types
  const getSourceTypes = (pipeline: Pipeline) => {
    if (!pipeline.sources_config) return 'N/A';
    const sources = Object.values(pipeline.sources_config);
    return sources.map(source => source.type).join(', ') || 'N/A';
  };
  const getSinkTypes = (pipeline: Pipeline) => {
    if (!pipeline.sinks_config) return 'N/A';
    const sinks = Object.values(pipeline.sinks_config).flat();
    return Array.from(new Set(sinks)).join(', ') || 'N/A';
  };
  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  const filteredPipelines = pipelines.filter(pipeline => {
    const matchesSearch = pipeline.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pipeline.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pipeline.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeletePipeline = async (pipeline: Pipeline) => {
    try {
      await deletePipeline(pipeline.id);
      setDeleteModal({ open: false, pipeline: null });
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
    }
  };
  const handleTogglePipeline = async (pipeline: Pipeline) => {
    try {
      if (pipeline.status === 'running') {
        await stopPipeline(pipeline.id);
      } else {
        await restartPipeline(pipeline.id);
      }
    } catch (error) {
      console.error('Failed to toggle pipeline:', error);
    }
  };

  const handleSelectPipeline = (pipelineId: string) => {
    setSelectedPipelines(prev => 
      prev.includes(pipelineId) 
        ? prev.filter(id => id !== pipelineId)
        : [...prev, pipelineId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPipelines.length === filteredPipelines.length) {
      setSelectedPipelines([]);
    } else {
      setSelectedPipelines(filteredPipelines.map(p => p.id));
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'success' as const;
      case 'stopped':
        return 'secondary' as const;
      case 'error':
        return 'error' as const;
      default:
        return 'warning' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipelines</h1>
          <p className="text-gray-600">Manage your data processing pipelines</p>
        </div>
        <div className="flex space-x-3">          <Button
            variant="secondary"
            onClick={() => loadPipelines()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/pipelines/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Pipeline
            </Button>
          </Link>
        </div>      </div>

      {/* Pipeline Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Server className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pipelines</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className="text-2xl font-bold text-green-600">{stats.running}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <XCircle className="h-8 w-8 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Stopped</p>
              <p className="text-2xl font-bold text-gray-600">{stats.stopped}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Error</p>
              <p className="text-2xl font-bold text-red-600">{stats.error}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Created</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.created}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">            <Input
              type="text"
              placeholder="Search pipelines..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              icon={Search}
            />
          </div>
          <div className="w-full sm:w-48">            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'running', label: 'Running' },
                { value: 'stopped', label: 'Stopped' },
                { value: 'error', label: 'Error' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedPipelines.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedPipelines.length} pipeline(s) selected
            </span>
            <div className="flex space-x-2">
              <Button size="sm" variant="secondary">
                <Play className="h-4 w-4 mr-2" />
                Start Selected
              </Button>
              <Button size="sm" variant="secondary">
                <Pause className="h-4 w-4 mr-2" />
                Stop Selected
              </Button>
              <Button size="sm" variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Pipeline Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedPipelines.length === filteredPipelines.length && filteredPipelines.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sink
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  </td>
                </tr>
              ) : filteredPipelines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <div className="text-gray-500">
                      {searchTerm || statusFilter !== 'all' ? 'No pipelines match your filters' : 'No pipelines found'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPipelines.map((pipeline) => (
                  <tr key={pipeline.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedPipelines.includes(pipeline.id)}
                        onChange={() => handleSelectPipeline(pipeline.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <Link 
                          to={`/pipelines/${pipeline.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-primary-600"
                        >
                          {pipeline.name}
                        </Link>
                        {pipeline.description && (
                          <div className="text-sm text-gray-500">{pipeline.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(pipeline.status)}>
                        {pipeline.status}
                      </Badge>
                    </td>                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getSourceTypes(pipeline)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getSinkTypes(pipeline)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(pipeline.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleTogglePipeline(pipeline)}
                        >
                          {pipeline.status === 'running' ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Link to={`/pipelines/${pipeline.id}`}>
                          <Button size="sm" variant="secondary">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeleteModal({ open: true, pipeline })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, pipeline: null })}
        title="Delete Pipeline"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the pipeline "{deleteModal.pipeline?.name}"? 
            This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteModal({ open: false, pipeline: null })}
            >
              Cancel
            </Button>
            <Button
              variant="error"
              onClick={() => deleteModal.pipeline && handleDeletePipeline(deleteModal.pipeline)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
