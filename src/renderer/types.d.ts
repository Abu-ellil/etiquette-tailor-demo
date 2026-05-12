export interface Session {
  userId: number;
  username: string;
  name: string;
  role: string;
  branch_id: number;
  worker_type?: string | null;
}

export interface ElectronAPI {
  auth: {
    login: (credentials: { username: string; password: string; remember?: boolean }) => Promise<Session | null>;
    getSession: () => Promise<Session | null>;
    logout: () => Promise<void>;
  };

  branches: {
    getAll: () => Promise<any[]>;
    getById: (id: number) => Promise<any>;
    update: (id: number, data: any) => Promise<void>;
    create: (data: any) => Promise<{ id: number }>;
  };

  settings: {
    getAll: () => Promise<Record<string, string>>;
    set: (settings: Record<string, string>) => Promise<void>;
  };

  users: {
    getAll: () => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: number, data: any) => Promise<any>;
    deactivate: (id: number) => Promise<void>;
  };

  workers: {
    getAll: () => Promise<any[]>;
    getRates: (workerId: number) => Promise<any[]>;
    setRate: (data: any) => Promise<any>;
    getActiveRate: (workerId: number, pieceType: string) => Promise<any>;
    getWorkerTasks: (userId: number) => Promise<any[]>;
    getMonthlyEarnings: (userId: number, month: string) => Promise<any>;
    getWorkerOrderDetails: (userId: number, startDate: string, endDate: string) => Promise<any[]>;
    getAccount: (userId: number) => Promise<any>;
    addPayment: (userId: number, amount: number, note: string | null) => Promise<number>;
    getPayments: (userId: number) => Promise<any[]>;
    getWorkerEarnings: (userId: number, startDate: string, endDate: string) => Promise<any>;
    batchPayments: (payments: Array<{userId: number; amount: number; note: string | null}>) => Promise<number>;
    getProductivity: (branchId?: number, startDate?: string, endDate?: string) => Promise<any[]>;
    getOverdueTasks: (branchId?: number) => Promise<any[]>;
    getWorkloads: (branchId?: number) => Promise<any[]>;
    getRecommended: (pieceType: string, taskType: string) => Promise<any[]>;
  };

  customers: {
    getAll: () => Promise<any[]>;
    search: (query: string) => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: number, data: any) => Promise<any>;
    delete: (id: number) => Promise<void>;
    getOutstandingOrders: (customerId: number) => Promise<any[]>;
    getOrders: (customerId: number) => Promise<any[]>;
  };

  orders: {
    getAll: (branchId?: number, status?: string) => Promise<any[]>;
    get: (id: number) => Promise<any>;
    search: (query: string) => Promise<any[]>;
    create: (data: any) => Promise<any>;
    createWithTasks: (payload: any) => Promise<{ orderId: number; orderNumber: string }>;
    update: (id: number, data: any) => Promise<any>;
    updateStatus: (id: number, status: string) => Promise<any>;
    getMeasurements: (orderId: number) => Promise<any>;
    updateMeasurements: (orderId: number, data: any) => Promise<any>;
    getTasks: (orderId: number) => Promise<any[]>;
    createTask: (data: any) => Promise<any>;
    updateTaskStatus: (taskId: number, status: string) => Promise<any>;
    reassignTask: (taskId: number, workerId: number, wageType: string, wageRate: number, wageAmount: number) => Promise<any>;
    getStats: (branchId?: number) => Promise<any>;
    getAllTasks: (filters?: { branchId?: number; workerId?: number; taskType?: string }) => Promise<any[]>;
    recalculateTaskWages: (orderId: number, newPrice: number) => Promise<number>;
    addPayment: (orderId: number, amount: number, method: 'cash' | 'card', note: string | null) => Promise<number>;
    getPayments: (orderId: number) => Promise<any[]>;
    deletePayment: (paymentId: number) => Promise<void>;
    getItems: (orderId: number) => Promise<any[]>;
    createItem: (data: any) => Promise<any>;
    updateItem: (id: number, data: any) => Promise<any>;
    deleteItem: (id: number) => Promise<void>;
    recalculateTotal: (orderId: number) => Promise<void>;
  };

  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };

  shell: {
    openExternal: (url: string) => Promise<void>;
  };

  pieceTypes: {
    getAll: () => Promise<any[]>;
    updateBasePrice: (name_en: string, base_price: number) => Promise<void>;
    getBasePrice: (name_en: string) => Promise<number>;
    create: (data: any) => Promise<number>;
    update: (id: number, data: any) => Promise<void>;
    delete: (id: number) => Promise<void>;
  };

  dailyProduction: {
    create: (data: any) => Promise<any>;
    getAll: (filters?: { worker_id?: number; start_date?: string; end_date?: string }) => Promise<any[]>;
    getByDate: (date: string) => Promise<any[]>;
    getWorkerSummary: (workerId: number, startDate: string, endDate: string) => Promise<any>;
    getAllWorkersProduction: (startDate: string, endDate: string) => Promise<any[]>;
    getGrouped: (startDate: string, endDate: string) => Promise<any[]>;
    delete: (id: number) => Promise<void>;
    update: (id: number, data: any) => Promise<void>;
  };

  reports: {
    getStats: (branchId?: number, period?: string) => Promise<any>;
    getPaymentSplit: (branchId?: number, period?: string) => Promise<any>;
    getMonthlyRevenue: (months?: number, branchId?: number) => Promise<any[]>;
    getRecentOrders: (limit?: number, branchId?: number, period?: string) => Promise<any[]>;
    getAdvanced: (filter: any) => Promise<any>;
    getDailyStats: (days: number, branchId?: number) => Promise<any[]>;
    getWorkerContribution: (branchId?: number, startDate?: string, endDate?: string) => Promise<any[]>;
    exportPDF: (htmlContent: string, filename: string) => Promise<string>;
    sendEmail: (to: string, subject: string, body: string, htmlContent?: string, filename?: string) => Promise<{ sent: boolean; method: string }>;
    saveEmail: (email: string, label?: string) => Promise<number>;
    getEmails: () => Promise<any[]>;
    deleteEmail: (id: number) => Promise<void>;
  };

  notifications: {
    getForUser: (userId: number, role: string, limit?: number) => Promise<any[]>;
    getUnreadCount: (userId: number, role: string) => Promise<number>;
    markAsRead: (notificationId: number) => Promise<void>;
    markAllAsRead: (userId: number, role: string) => Promise<void>;
    softDelete: (notificationId: number) => Promise<void>;
    generateOverdue: () => Promise<number>;
  };

  backup: {
    create: () => Promise<{ success: boolean; path?: string; error?: string }>;
    restore: () => Promise<{ success: boolean; error?: string }>;
    list: () => Promise<any[]>;
    lastDate: () => Promise<string | null>;
    dbSize: () => Promise<{ usedBytes: number; label: string }>;
  };

  expenses: {
    create: (data: any) => Promise<number>;
    getAll: (filters?: any) => Promise<any[]>;
    delete: (id: number) => Promise<void>;
    getProfitReport: (startDate: string, endDate: string, branchId?: number) => Promise<any>;
  };

  sync: {
    getStatus: () => Promise<{ lastExport: string | null; lastImport: string | null; syncFolderPath: string | null }>;
    exportData: (branchId: number, folderPath: string) => Promise<any>;
    importData: (branchId: number, folderPath: string) => Promise<any>;
    mergeData: (branchId: number, folderPath: string) => Promise<any>;
    resolveConflict: (branchId: number, type: string, id: number, source: 'local' | 'remote') => Promise<any>;
    selectFolder: () => Promise<string | null>;
  };

  updater: {
    check: () => Promise<{ checking?: boolean; error?: string }>;
    quitAndInstall: () => Promise<void>;
    getVersion: () => Promise<string>;
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string | any[] }) => void) => () => void;
    onUpdateNotAvailable: (callback: () => void) => () => void;
    onUpdateDownloaded: (callback: () => void) => () => void;
    onUpdateError: (callback: (msg: string) => void) => () => void;
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
  };

}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
  const __APP_VERSION__: string;
}
