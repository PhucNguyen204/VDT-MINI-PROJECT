// Date and time utilities
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
};

export const timeRangeToMilliseconds = (timeRange: string): number => {
  const units: Record<string, number> = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  const match = timeRange.match(/^(\d+)([smhd])$/);
  if (!match) return 60 * 60 * 1000; // Default 1 hour
  
  const [, value, unit] = match;
  return parseInt(value) * (units[unit] || units.h);
};

// Validation utilities
export const validatePipelineName = (name: string): string[] => {
  const errors: string[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Pipeline name is required');
  } else {
    if (name.length < 3) {
      errors.push('Pipeline name must be at least 3 characters');
    }
    if (name.length > 50) {
      errors.push('Pipeline name must be less than 50 characters');
    }
    if (!/^[a-z0-9-_]+$/.test(name)) {
      errors.push('Pipeline name can only contain lowercase letters, numbers, hyphens, and underscores');
    }
  }
  
  return errors;
};

export const validatePort = (port: number): string[] => {
  const errors: string[] = [];
  
  if (!port || isNaN(port)) {
    errors.push('Port is required');
  } else {
    if (port < 1024 || port > 65535) {
      errors.push('Port must be between 1024 and 65535');
    }
  }
  
  return errors;
};

export const validateS3Bucket = (bucket: string): string[] => {
  const errors: string[] = [];
  
  if (!bucket || bucket.trim().length === 0) {
    errors.push('S3 bucket name is required');
  } else {
    if (bucket.length < 3 || bucket.length > 63) {
      errors.push('S3 bucket name must be between 3 and 63 characters');
    }
    if (!/^[a-z0-9.-]+$/.test(bucket)) {
      errors.push('S3 bucket name can only contain lowercase letters, numbers, periods, and hyphens');
    }
    if (bucket.startsWith('.') || bucket.endsWith('.')) {
      errors.push('S3 bucket name cannot start or end with a period');
    }
    if (bucket.includes('..')) {
      errors.push('S3 bucket name cannot contain consecutive periods');
    }
  }
  
  return errors;
};

export const validateEmail = (email: string): string[] => {
  const errors: string[] = [];
  
  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }
  }
  
  return errors;
};

// Format utilities
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  return Math.round((value / total) * 100) + '%';
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
};

// Status utilities
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    running: 'text-green-600 bg-green-100',
    stopped: 'text-gray-600 bg-gray-100',
    error: 'text-red-600 bg-red-100',
    starting: 'text-yellow-600 bg-yellow-100',
    stopping: 'text-yellow-600 bg-yellow-100',
    created: 'text-blue-600 bg-blue-100'
  };
  
  return colors[status] || 'text-gray-600 bg-gray-100';
};

export const getStatusIcon = (status: string): string => {
  const icons: Record<string, string> = {
    running: 'play-circle',
    stopped: 'stop-circle',
    error: 'x-circle',
    starting: 'loader',
    stopping: 'loader',
    created: 'circle'
  };
  
  return icons[status] || 'circle';
};

export const getHealthColor = (health: string): string => {
  const colors: Record<string, string> = {
    healthy: 'text-green-600',
    unhealthy: 'text-red-600',
    unknown: 'text-gray-600'
  };
  
  return colors[health] || 'text-gray-600';
};

// Form utilities
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// URL utilities
export const buildUrl = (base: string, params: Record<string, any>): string => {
  const url = new URL(base);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value.toString());
    }
  });
  
  return url.toString();
};

// Local storage utilities
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue || null;
    }
  },
  
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
};

// Array utilities
export const uniqueBy = <T>(array: T[], key: keyof T): T[] => {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

export const sortBy = <T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

// Error utilities
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
};

export const isNetworkError = (error: any): boolean => {
  return error?.code === 'NETWORK_ERROR' || 
         error?.message?.includes('Network Error') ||
         !navigator.onLine;
};

// Color utilities for charts
export const generateColors = (count: number): string[] => {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];
  
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  
  return result;
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
