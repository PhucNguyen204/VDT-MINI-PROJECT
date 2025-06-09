import { create } from 'zustand';
import { 
  Pipeline, 
  CreatePipelineForm, 
  FormValidation, 
  DeploymentState, 
  MetricsData,
  DashboardData,
  SchedulerStatus,
  SystemOverview
} from '../types';
import { pipelineApi, managementApi, monitoringApi, schedulerApi } from '../services/api';

// Pipeline Store
interface PipelineStore {
  // State
  pipelines: Pipeline[];
  currentPipeline: Pipeline | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadPipelines: () => Promise<void>;
  loadPipeline: (id: string) => Promise<void>;
  createPipeline: (data: CreatePipelineForm) => Promise<Pipeline>;
  deletePipeline: (id: string) => Promise<void>;
  stopPipeline: (id: string) => Promise<void>;
  restartPipeline: (id: string) => Promise<void>;
  setCurrentPipeline: (pipeline: Pipeline | null) => void;
  clearError: () => void;
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  // Initial state
  pipelines: [],
  currentPipeline: null,
  loading: false,
  error: null,

  // Actions
  loadPipelines: async () => {
    set({ loading: true, error: null });
    try {
      const pipelines = await pipelineApi.list();
      set({ pipelines, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  loadPipeline: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const pipeline = await pipelineApi.getById(id);
      set({ currentPipeline: pipeline, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createPipeline: async (data: CreatePipelineForm) => {
    set({ loading: true, error: null });
    try {
      const pipeline = await pipelineApi.create(data);
      const pipelines = get().pipelines;
      set({ 
        pipelines: [...pipelines, pipeline], 
        currentPipeline: pipeline,
        loading: false 
      });
      return pipeline;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deletePipeline: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await managementApi.delete(id);
      const pipelines = get().pipelines.filter(p => p.id !== id);
      set({ pipelines, loading: false });
      if (get().currentPipeline?.id === id) {
        set({ currentPipeline: null });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  stopPipeline: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const updatedPipeline = await managementApi.stop(id);
      const pipelines = get().pipelines.map(p => 
        p.id === id ? updatedPipeline : p
      );
      set({ pipelines, loading: false });
      if (get().currentPipeline?.id === id) {
        set({ currentPipeline: updatedPipeline });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  restartPipeline: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const updatedPipeline = await managementApi.restart(id);
      const pipelines = get().pipelines.map(p => 
        p.id === id ? updatedPipeline : p
      );
      set({ pipelines, loading: false });
      if (get().currentPipeline?.id === id) {
        set({ currentPipeline: updatedPipeline });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  setCurrentPipeline: (pipeline: Pipeline | null) => {
    set({ currentPipeline: pipeline });
  },

  clearError: () => {
    set({ error: null });
  }
}));

// Create Pipeline Form Store
interface CreatePipelineStore {
  // State
  currentStep: number;
  formData: CreatePipelineForm;
  validation: FormValidation;
  deployment: DeploymentState;

  // Actions
  setCurrentStep: (step: number) => void;
  updateFormData: (data: Partial<CreatePipelineForm>) => void;
  updateValidation: (validation: Partial<FormValidation>) => void;
  resetForm: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setDeploymentState: (deployment: Partial<DeploymentState>) => void;
  isStepValid: (step: number) => boolean;
}

const initialFormData: CreatePipelineForm = {
  name: '',
  description: '',
  tags: [],
  sources: {},
  transforms: {},
  sinks: {}
};

const initialValidation: FormValidation = {
  errors: {},
  warnings: {},
  isValid: false
};

const initialDeployment: DeploymentState = {
  status: 'idle',
  progress: 0,
  logs: []
};

export const useCreatePipelineStore = create<CreatePipelineStore>((set, get) => ({
  // Initial state
  currentStep: 0,
  formData: initialFormData,
  validation: initialValidation,
  deployment: initialDeployment,

  // Actions
  setCurrentStep: (step: number) => {
    set({ currentStep: step });
  },

  updateFormData: (data: Partial<CreatePipelineForm>) => {
    const currentData = get().formData;
    set({ formData: { ...currentData, ...data } });
  },

  updateValidation: (validation: Partial<FormValidation>) => {
    const currentValidation = get().validation;
    set({ validation: { ...currentValidation, ...validation } });
  },

  resetForm: () => {
    set({ 
      currentStep: 0,
      formData: { ...initialFormData },
      validation: { ...initialValidation },
      deployment: { ...initialDeployment }
    });
  },

  nextStep: () => {
    const currentStep = get().currentStep;
    if (currentStep < 4) {
      set({ currentStep: currentStep + 1 });
    }
  },

  prevStep: () => {
    const currentStep = get().currentStep;
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  },
  setDeploymentState: (deployment: Partial<DeploymentState>) => {
    const currentDeployment = get().deployment;
    set({ deployment: { ...currentDeployment, ...deployment } });
  },

  isStepValid: (step: number) => {
    const { formData } = get();
    
    switch (step) {
      case 1: // Basic Info
        return !!(formData.name && formData.name.trim().length > 0);
      
      case 2: // Source Config
        return Object.keys(formData.sources).length > 0;
      
      case 3: // Transform Config
        return true; // Transforms are optional
      
      case 4: // Sink Config
        return Object.keys(formData.sinks).length > 0;
      
      case 5: // Review
        return !!(formData.name && 
                 Object.keys(formData.sources).length > 0 && 
                 Object.keys(formData.sinks).length > 0);
      
      default:
        return false;
    }
  }
}));

// Monitoring Store
interface MonitoringStore {
  // State
  overview: SystemOverview | null;
  dashboards: Record<string, DashboardData>;
  metrics: Record<string, MetricsData[]>;
  loading: boolean;
  error: string | null;

  // Actions
  loadOverview: (timeRange?: string) => Promise<void>;
  loadDashboard: (pipelineId: string, timeRange?: string) => Promise<void>;
  loadMetrics: (pipelineId: string, options?: any) => Promise<void>;
  collectMetrics: (pipelineId?: string) => Promise<void>;
  clearError: () => void;
}

export const useMonitoringStore = create<MonitoringStore>((set, get) => ({
  // Initial state
  overview: null,
  dashboards: {},
  metrics: {},
  loading: false,
  error: null,

  // Actions
  loadOverview: async (timeRange = '1h') => {
    set({ loading: true, error: null });
    try {
      const overview = await monitoringApi.getOverview(timeRange);
      set({ overview, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  loadDashboard: async (pipelineId: string, timeRange = '1h') => {
    set({ loading: true, error: null });
    try {
      const dashboard = await monitoringApi.getDashboard(pipelineId, timeRange);
      const dashboards = get().dashboards;
      set({ 
        dashboards: { ...dashboards, [pipelineId]: dashboard },
        loading: false 
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  loadMetrics: async (pipelineId: string, options = {}) => {
    set({ loading: true, error: null });
    try {
      const metrics = await monitoringApi.getMetrics(pipelineId, options.timeRange, options.category);
      const currentMetrics = get().metrics;
      set({ 
        metrics: { ...currentMetrics, [pipelineId]: metrics },
        loading: false 
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  collectMetrics: async (pipelineId?: string) => {
    try {
      if (pipelineId) {
        await monitoringApi.collectMetrics(pipelineId);
      } else {
        await monitoringApi.collectAllMetrics();
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));

// Scheduler Store
interface SchedulerStore {
  // State
  status: SchedulerStatus | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadStatus: () => Promise<void>;
  startScheduler: (intervalSeconds?: number) => Promise<void>;
  stopScheduler: () => Promise<void>;
  updateInterval: (intervalSeconds: number) => Promise<void>;
  clearError: () => void;
}

export const useSchedulerStore = create<SchedulerStore>((set, get) => ({
  // Initial state
  status: null,
  loading: false,
  error: null,

  // Actions
  loadStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await schedulerApi.getStatus();
      set({ status, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  startScheduler: async (intervalSeconds = 30) => {
    set({ loading: true, error: null });
    try {
      const status = await schedulerApi.start(intervalSeconds);
      set({ status, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  stopScheduler: async () => {
    set({ loading: true, error: null });
    try {
      const status = await schedulerApi.stop();
      set({ status, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateInterval: async (intervalSeconds: number) => {
    set({ loading: true, error: null });
    try {
      await schedulerApi.updateInterval(intervalSeconds);
      // Reload status to get updated interval
      const status = await schedulerApi.getStatus();
      set({ status, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));
