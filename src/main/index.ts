import { app, BrowserWindow, ipcMain, shell, autoUpdater, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import started from 'electron-squirrel-startup';
import nodemailer from 'nodemailer';
import { initializeSchema } from '../db/schema';
import {
  authenticateUser,
  getAllUsers,
  createUser,
  updateUser,
  deactivateUser,
} from '../db/auth';
import {
  getAllBranches,
  getBranchById,
} from '../db/branches';
import {
  searchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerOrders,
  getCustomerOutstandingOrders,
  getAllCustomers,
} from '../db/customers';
import {
  getAllOrders,
  getOrder,
  searchOrders,
  createOrder,
  createOrderWithTasks,
  WorkflowPayload,
  updateOrder,
  updateOrderStatus,
  getOrderMeasurements,
  updateOrderMeasurements,
  getOrderTasks,
  createOrderTask,
  updateTaskStatus,
  reassignTask,
  getOrderStats,
  getAllTasks,
  getPaymentSplit,
  getMonthlyRevenue,
  getRecentOrders,
  getDailyStats,
  getWorkerContribution,
  getAdvancedReport,
  getSetting,
  setSetting,
} from '../db';
import {
  createExpense,
  getExpenses,
  deleteExpense,
  getProfitReport,
} from '../db/expenses';
import {
  validateLicenseKey,
  activateLicense,
  getLicenseStatus,
  isDemoMode,
  enableDemoMode,
  disableDemoMode,
  checkDemoRestrictions,
  getDemoUsage,
  clearLicense,
  getHardwareId,
} from '../db/license';
import {
  createNotification,
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  softDeleteNotification,
  clearReadNotifications,
  generateOverdueNotifications,
} from '../db/notifications';
import { createBackup, restoreBackup, listLocalBackups, getLastBackupDate, getDbFileSize } from '../db/backup';
import { syncAllOrderPayments } from '../db/orders';
import { exportBranchData, importBranchData, getSyncStatus, mergeBranchData, resolveConflict, getAutoSyncStatus, enableAutoSync, disableAutoSync, setAutoSyncInterval, recordAutoExport, recordAutoImport, checkForRemoteUpdate, getRemoteFileInfo } from '../db/sync';
import db from '../db/schema';

function saveSession(session: any) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('saved_session', ?)").run(JSON.stringify(session));
}

function loadSession(): any | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'saved_session'").get() as { value: string } | undefined;
  return row ? JSON.parse(row.value) : null;
}

function clearSession() {
  db.prepare("DELETE FROM settings WHERE key = 'saved_session'").run();
}

let currentSession: {
  userId: number;
  username: string;
  name: string;
  role: string;
  branch_id: number;
  worker_type?: string | null;
} | null = null;

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

// Auto-sync
let autoSyncTimer: NodeJS.Timeout | null = null;

function currentBranchId(): number {
  return currentSession?.branch_id || 1;
}

function startAutoSyncLoop(): void {
  if (autoSyncTimer) {
    console.log('[auto-sync] already running');
    return;
  }

  const intervalStr = getSetting('auto_sync_interval') || '30';
  const intervalSec = parseInt(intervalStr, 10);
  const intervalMs = intervalSec * 1000;
  const folderPath = getSetting('sync_folder_path');

  if (!folderPath) {
    console.log('[auto-sync] no folder path set, skipping');
    return;
  }

  console.log(`[auto-sync] starting with interval ${intervalSec}s, folder: ${folderPath}`);

  const doSync = () => {
    if (getSetting('auto_sync_enabled') !== '1') {
      console.log('[auto-sync] disabled, stopping loop');
      stopAutoSyncLoop();
      return;
    }

    try {
      const folder = getSetting('sync_folder_path');
      if (!folder) return;

      const branchId = currentBranchId();
      console.log(`[auto-sync] cycle start: branch ${branchId}`);

      // Always export our data
      const exportResult = exportBranchData(branchId, folder);
      recordAutoExport();
      console.log(`[auto-sync] export: ${exportResult.success ? 'ok' : exportResult.error}`);

      // If remote file exists, always import (importBranchData is idempotent)
      const fileInfo = getRemoteFileInfo(folder, branchId);
      console.log(`[auto-sync] remote exists: ${fileInfo.exists}`);

      if (fileInfo.exists) {
        const result = importBranchData(branchId, folder);
        if (result.success) {
          recordAutoImport();
          console.log('[auto-sync] imported:', result.counts);
          mainWindow?.webContents.send('sync:auto-imported', {
            success: true,
            counts: result.counts,
          });
        } else {
          console.error('[auto-sync] import error:', result.error);
        }
      }

      setSetting('auto_sync_last_remote_check', new Date().toISOString());
    } catch (err) {
      console.error('[auto-sync] error:', err);
    }
  };

  doSync();
  autoSyncTimer = setInterval(doSync, intervalMs);
}

function stopAutoSyncLoop(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

function restartAutoSyncLoop(): void {
  stopAutoSyncLoop();
  if (getSetting('auto_sync_enabled') === '1') {
    startAutoSyncLoop();
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    icon: path.join(__dirname, '../../icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

function registerIpcHandlers() {
  ipcMain.handle('auth:login', async (_event, username: string, password: string, remember?: boolean) => {
    const session = authenticateUser(username, password);
    if (session) {
      currentSession = session;
      if (remember) {
        saveSession(session);
      } else {
        clearSession();
      }
    }
    return session;
  });

  ipcMain.handle('auth:getSession', async () => {
    if (currentSession) return currentSession;
    // Restore from DB
    const saved = loadSession();
    if (saved) {
      // Verify user still exists and is active
      const user = db.prepare('SELECT id, active FROM users WHERE id = ?').get(saved.userId) as any;
      if (user && user.active) {
        currentSession = saved;
        return saved;
      }
      // User deactivated or deleted — clear stored session
      clearSession();
    }
    return null;
  });

  ipcMain.handle('auth:logout', async () => {
    currentSession = null;
    clearSession();
  });

  ipcMain.handle('branches:getAll', async () => {
    return getAllBranches();
  });

  ipcMain.handle('branches:getById', async (_event, id: number) => {
    return getBranchById(id);
  });

  ipcMain.handle('users:getAll', async (_event, branchId?: number) => {
    return getAllUsers(branchId);
  });

  ipcMain.handle('users:create', async (_event, data: any) => {
    return createUser(data);
  });

  ipcMain.handle('users:update', async (_event, id: number, data: any) => {
    return updateUser(id, data);
  });

  ipcMain.handle('users:deactivate', async (_event, id: number) => {
    return deactivateUser(id);
  });

  ipcMain.handle('workers:getAll', async (_event, branchId?: number) => {
    return getAllWorkers(branchId);
  });

  ipcMain.handle('workers:getRates', async (_event, userId: number) => {
    return getWorkerRates(userId);
  });

  ipcMain.handle('workers:setRate', async (_event, rate: any) => {
    return setWorkerRate(rate);
  });

  ipcMain.handle('workers:getActiveRate', async (_event, userId: number, pieceType: string) => {
    return getActiveRate(userId, pieceType);
  });

  ipcMain.handle('workers:getWorkerTasks', async (_event, userId: number) => {
    return getWorkerTasks(userId);
  });

  ipcMain.handle('workers:getMonthlyEarnings', async (_event, userId: number, month: string) => {
    return getMonthlyEarnings(userId, month);
  });

  ipcMain.handle('workers:getWorkerOrderDetails', async (_event, userId: number, startDate: string, endDate: string) => {
    return getWorkerOrderDetails(userId, startDate, endDate);
  });

  ipcMain.handle('workers:getAccount', async (_event, userId: number) => {
    return getWorkerAccount(userId);
  });

  ipcMain.handle('workers:addPayment', async (_event, userId: number, amount: number, note: string | null) => {
    return addWorkerPayment(userId, amount, note, currentSession?.userId ?? null);
  });

  ipcMain.handle('workers:getPayments', async (_event, userId: number) => {
    return getWorkerPayments(userId);
  });

  ipcMain.handle('workers:getWorkerEarnings', async (_event, userId: number, startDate: string, endDate: string) => {
    return getWorkerEarnings(userId, startDate, endDate);
  });

  ipcMain.handle('workers:batchPayments', async (_event, payments: Array<{userId: number; amount: number; note: string | null}>) => {
    return batchWorkerPayments(payments, currentSession?.userId ?? null);
  });

  ipcMain.handle('workers:getProductivity', async (_event, branchId?: number, startDate?: string, endDate?: string) => {
    return getAllWorkerProductivity(branchId, startDate, endDate);
  });

  ipcMain.handle('workers:getOverdueTasks', async (_event, branchId?: number) => {
    return getOverdueTasks(branchId);
  });

  ipcMain.handle('workers:getWorkloads', async (_event, branchId?: number) => {
    return getWorkerWorkloads(branchId);
  });

  ipcMain.handle('workers:getRecommended', async (_event, pieceType: string, taskType: string) => {
    return getRecommendedWorkers(pieceType, taskType);
  });

  // Daily Production handlers
  ipcMain.handle('dailyProduction:create', async (_event, data: any) => {
    return createDailyProduction({
      ...data,
      created_by: currentSession?.userId ?? null,
    });
  });

  ipcMain.handle('dailyProduction:getAll', async (_event, filters?: { worker_id?: number; start_date?: string; end_date?: string }) => {
    return getDailyProduction(filters);
  });

  ipcMain.handle('dailyProduction:getByDate', async (_event, date: string) => {
    return getDailyProductionByDate(date);
  });

  ipcMain.handle('dailyProduction:getWorkerSummary', async (_event, workerId: number, startDate: string, endDate: string) => {
    return getWorkerProductionSummary(workerId, startDate, endDate);
  });

  ipcMain.handle('dailyProduction:getAllWorkersProduction', async (_event, startDate: string, endDate: string) => {
    return getAllWorkersProduction(startDate, endDate);
  });

  ipcMain.handle('dailyProduction:getGrouped', async (_event, startDate: string, endDate: string) => {
    return getDailyProductionGrouped(startDate, endDate);
  });

  ipcMain.handle('dailyProduction:delete', async (_event, id: number) => {
    return deleteDailyProduction(id);
  });

  ipcMain.handle('dailyProduction:update', async (_event, id: number, data: any) => {
    return updateDailyProduction(id, data);
  });

  ipcMain.handle('customers:getAll', async (_event, branchId?: number) => {
    return getAllCustomers(branchId);
  });

  ipcMain.handle('customers:search', async (_event, query: string, branchId?: number) => {
    return searchCustomers(query, branchId);
  });

  ipcMain.handle('customers:create', async (_event, data: any) => {
    return createCustomer(data);
  });

  ipcMain.handle('customers:update', async (_event, id: number, data: any) => {
    return updateCustomer(id, data);
  });

  ipcMain.handle('customers:delete', async (_event, id: number) => {
    return deleteCustomer(id);
  });

  ipcMain.handle('customers:getOutstandingOrders', async (_event, customerId: number) => {
    return getCustomerOutstandingOrders(customerId);
  });

  ipcMain.handle('customers:getOrders', async (_event, customerId: number) => {
    return getCustomerOrders(customerId);
  });

  ipcMain.handle('orders:getAll', async (_event, branchId?: number, status?: string) => {
    return getAllOrders(branchId, status);
  });

  ipcMain.handle('orders:get', async (_event, id: number) => {
    return getOrder(id);
  });

  ipcMain.handle('orders:search', async (_event, query: string, branchId?: number) => {
    return searchOrders(query, branchId);
  });

  ipcMain.handle('orders:create', async (_event, data: any, measurements?: any, items?: any) => {
    const result = createOrder(data, measurements, items);
    try {
      const orderId = typeof result === 'object' ? result.id : result;
      const order = getOrder(orderId);
      if (order) {
        const msg = `Order ${order.order_number} created for ${data.customer_name || 'customer'}`;
        createNotification({ type: 'order_created', title: 'New Order', message: msg, order_id: orderId, target_role: 'admin' });
        createNotification({ type: 'order_created', title: 'New Order', message: msg, order_id: orderId, target_role: 'manager' });
      }
    } catch (e) { console.error('Notification error:', e); }
    return result;
  });

  ipcMain.handle('orders:createWithTasks', (_e, payload) => {
    return createOrderWithTasks(payload);
  });

  ipcMain.handle('orders:update', async (_event, id: number, data: any) => {
    return updateOrder(id, data);
  });

  ipcMain.handle('orders:updateStatus', async (_event, id: number, status: string) => {
    const result = updateOrderStatus(id, status);
    try {
      const order = getOrder(id);
      if (order) {
        const msg = `Order ${order.order_number} is now "${status}"`;
        createNotification({ type: 'order_status_changed', title: 'Order Status Updated', message: msg, order_id: id, target_role: 'admin' });
        createNotification({ type: 'order_status_changed', title: 'Order Status Updated', message: msg, order_id: id, target_role: 'manager' });
        const tasks = getOrderTasks(id);
        for (const task of tasks) {
          if (task.assigned_to) {
            createNotification({ type: 'order_status_changed', title: 'Order Status Changed', message: msg, order_id: id, task_id: task.id, target_user_id: task.assigned_to });
          }
        }
      }
    } catch (e) { console.error('Notification error:', e); }
    return result;
  });

  ipcMain.handle('orders:delete', async (_event, orderId: number) => {
    return updateOrder(orderId, { is_deleted: 1 });
  });

  ipcMain.handle('orders:getMeasurements', async (_event, orderId: number) => {
    return getOrderMeasurements(orderId);
  });

  ipcMain.handle('orders:updateMeasurements', async (_event, orderId: number, measurements: any) => {
    return updateOrderMeasurements(orderId, measurements);
  });

  ipcMain.handle('orders:getTasks', async (_event, orderId: number) => {
    return getOrderTasks(orderId);
  });

  ipcMain.handle('orders:createTask', async (_event, data: any) => {
    return createOrderTask(data);
  });

  ipcMain.handle('orders:updateTaskStatus', async (_event, taskId: number, status: string) => {
    // Worker permission check: only allow updating tasks matching their type
    if (currentSession?.role === 'worker') {
      const task = db.prepare('SELECT task_type FROM order_tasks WHERE id = ?').get(taskId) as any;
      if (task) {
        const allowedType: Record<string, string> = { master_cutter: 'cutting', tailor: 'sewing' };
        const expected = allowedType[currentSession.worker_type || ''];
        if (!expected || task.task_type !== expected) {
          throw new Error('You are not authorized to update this task type');
        }
      }
    }
    const result = updateTaskStatus(taskId, status);
    try {
      const tasks = db.prepare('SELECT * FROM order_tasks WHERE id = ?').get(taskId) as any;
      if (tasks) {
        const order = getOrder(tasks.order_id);
        if (order) {
          const msg = `${tasks.task_type} task on order ${order.order_number} is now "${status}"`;
          createNotification({ type: 'task_status_changed', title: 'Task Updated', message: msg, order_id: tasks.order_id, task_id: taskId, target_role: 'admin' });
          createNotification({ type: 'task_status_changed', title: 'Task Updated', message: msg, order_id: tasks.order_id, task_id: taskId, target_role: 'manager' });
        }
      }
    } catch (e) { console.error('Notification error:', e); }
    return result;
  });

  ipcMain.handle('orders:reassignTask', async (_event, taskId: number, newUserId: number, wageType: string, wageRate: number, wageAmount: number) => {
    return reassignTask(taskId, newUserId, wageType, wageRate, wageAmount);
  });

  ipcMain.handle('orders:getStats', async (_event, branchId?: number) => {
    return getOrderStats(branchId);
  });

  ipcMain.handle('reports:getStats', async (_event, branchId?: number, period?: string) => {
    return getReportStats(branchId, period);
  });

  ipcMain.handle('reports:getPaymentSplit', async (_event, branchId?: number, period?: string) => {
    return getPaymentSplit(branchId, period);
  });

  ipcMain.handle('reports:getMonthlyRevenue', async (_event, months?: number, branchId?: number) => {
    return getMonthlyRevenue(months, branchId);
  });

  ipcMain.handle('reports:getRecentOrders', async (_event, limit?: number, branchId?: number, period?: string) => {
    return getRecentOrders(limit, branchId, period);
  });

  ipcMain.handle('reports:getAdvanced', async (_event, filter: any) => {
    return getAdvancedReport(filter);
  });

  ipcMain.handle('reports:getDailyStats', async (_event, days: number, branchId?: number) => {
    return getDailyStats(days, branchId);
  });

  ipcMain.handle('reports:getWorkerContribution', async (_event, branchId?: number, startDate?: string, endDate?: string) => {
    return getWorkerContribution(branchId, startDate, endDate);
  });

  ipcMain.handle('reports:exportPDF', async (_event, htmlContent: string, filename: string) => {
    const pdfFilename = filename.replace(/\.html$/i, '.pdf');
    const filePath = path.join(os.tmpdir(), pdfFilename);
    const htmlPath = path.join(os.tmpdir(), filename.replace(/\.html$/i, '-temp.html'));
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

    const pdfWin = new BrowserWindow({
      width: 800,
      height: 1100,
      show: false,
      webPreferences: { offscreen: true as any },
    });

    await pdfWin.loadFile(htmlPath);
    const pdfData = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
    });
    pdfWin.close();

    fs.writeFileSync(filePath, pdfData);
    try { fs.unlinkSync(htmlPath); } catch { /* ignore */ }
    await shell.openPath(filePath);
    return filePath;
  });

  ipcMain.handle('reports:sendEmail', async (_event, to: string, subject: string, body: string, htmlContent?: string, filename?: string) => {
    const settings = getAllSettings();

    if (settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
      let pdfBuffer: Buffer | null = null;

      if (htmlContent) {
        const pdfFilename = (filename || 'report.pdf').replace(/\.html$/i, '.pdf');
        const htmlPath = path.join(os.tmpdir(), pdfFilename.replace('.pdf', '-email-temp.html'));
        fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

        const pdfWin = new BrowserWindow({
          width: 800,
          height: 1100,
          show: false,
          webPreferences: { offscreen: true as any },
        });

        await pdfWin.loadFile(htmlPath);
        const pdfData = await pdfWin.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
        });
        pdfWin.close();
        try { fs.unlinkSync(htmlPath); } catch { /* ignore */ }

        pdfBuffer = Buffer.from(pdfData);
      }

      const port = parseInt(settings.smtp_port || '587');
      const secure = settings.smtp_secure === 'ssl' ? true : port === 465;

      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port,
        secure,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass,
        },
      });

      const mailOptions: nodemailer.SendMailOptions = {
        from: settings.smtp_from_name
          ? `"${settings.smtp_from_name}" <${settings.smtp_from || settings.smtp_user}>`
          : settings.smtp_from || settings.smtp_user,
        to,
        subject,
        text: body,
      };

      if (pdfBuffer) {
        const attachmentName = (filename || 'report.pdf').replace(/\.html$/i, '.pdf');
        mailOptions.attachments = [{
          filename: attachmentName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }];
      }

      await transporter.sendMail(mailOptions);
      return { sent: true, method: 'smtp' };
    }

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    await shell.openExternal(`mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`);
    return { sent: true, method: 'mailto' };
  });

  ipcMain.handle('reports:saveEmail', async (_event, email: string, label?: string) => {
    return saveReportEmail(email, label);
  });

  ipcMain.handle('reports:getEmails', async () => {
    return getReportEmails();
  });

  ipcMain.handle('reports:deleteEmail', async (_event, id: number) => {
    return deleteReportEmail(id);
  });

  ipcMain.handle('orders:getAllTasks', async (_event, filters?: { branchId?: number; workerId?: number; taskType?: string }) => {
    return getAllTasks(filters);
  });

  ipcMain.handle('orders:recalculateTaskWages', async (_event, orderId: number, newPrice: number) => {
    return recalculateTaskWages(orderId, newPrice);
  });

  ipcMain.handle('orders:addPayment', async (_event, orderId: number, amount: number, method: 'cash' | 'card', note: string | null) => {
    const result = addOrderPayment(orderId, amount, method, note, currentSession?.userId ?? null);
    try {
      const order = getOrder(orderId);
      if (order) {
        const msg = `${amount} ${getAllSettings().currency || 'QAR'} ${method} payment on order ${order.order_number}`;
        createNotification({ type: 'payment_received', title: 'Payment Received', message: msg, order_id: orderId, target_role: 'admin' });
        createNotification({ type: 'payment_received', title: 'Payment Received', message: msg, order_id: orderId, target_role: 'manager' });
      }
    } catch (e) { console.error('Notification error:', e); }
    return result;
  });

  ipcMain.handle('orders:getPayments', async (_event, orderId: number) => {
    return getOrderPayments(orderId);
  });

  ipcMain.handle('orders:deletePayment', async (_event, paymentId: number) => {
    return deleteOrderPayment(paymentId);
  });

  // Order Items
  ipcMain.handle('orders:getItems', async (_event, orderId: number) => {
    return getOrderItems(orderId);
  });

  ipcMain.handle('orders:createItem', async (_event, data: any) => {
    return createOrderItem(data);
  });

  ipcMain.handle('orders:updateItem', async (_event, id: number, data: any) => {
    return updateOrderItem(id, data);
  });

  ipcMain.handle('orders:deleteItem', async (_event, id: number) => {
    return deleteOrderItem(id);
  });

  ipcMain.handle('orders:recalculateTotal', async (_event, orderId: number) => {
    return recalculateOrderTotal(orderId);
  });

  // Settings
  ipcMain.handle('settings:getAll', async () => {
    return getAllSettings();
  });

  ipcMain.handle('settings:set', async (_event, settings: Record<string, string>) => {
    return setSettings(settings);
  });

  // Branch management
  ipcMain.handle('branches:update', async (_event, id: number, data: any) => {
    return updateBranch(id, data);
  });

  ipcMain.handle('branches:create', async (_event, data: any) => {
    return createBranch(data);
  });

  // Backup & Restore
  ipcMain.handle('backup:create', async () => {
    return createBackup(mainWindow ?? undefined);
  });

  ipcMain.handle('backup:restore', async () => {
    return restoreBackup(mainWindow ?? undefined);
  });

  ipcMain.handle('backup:list', async () => {
    return listLocalBackups();
  });

  ipcMain.handle('backup:lastDate', async () => {
    return getLastBackupDate();
  });

  ipcMain.handle('backup:dbSize', async () => {
    return getDbFileSize();
  });

  // Expenses
  ipcMain.handle('expenses:create', async (_event, data: any) => {
    return createExpense({ ...data, created_by: currentSession?.userId ?? null });
  });

  ipcMain.handle('expenses:getAll', async (_event, filters?: any) => {
    return getExpenses(filters);
  });

  ipcMain.handle('expenses:delete', async (_event, id: number) => {
    return deleteExpense(id);
  });

  ipcMain.handle('expenses:getProfitReport', async (_event, startDate: string, endDate: string, branchId?: number) => {
    return getProfitReport(startDate, endDate, branchId);
  });

  // Sync
  ipcMain.handle('sync:export', async (_event, branchId: number, folderPath: string) => {
    return exportBranchData(branchId, folderPath);
  });

  ipcMain.handle('sync:import', async (_event, branchId: number, folderPath: string) => {
    return importBranchData(branchId, folderPath);
  });

  ipcMain.handle('sync:getStatus', async () => {
    return getSyncStatus();
  });

  ipcMain.handle('sync:merge', async (_event, branchId: number, folderPath: string) => {
    return mergeBranchData(branchId, folderPath);
  });

  ipcMain.handle('sync:resolveConflict', async (_event, branchId: number, type: string, id: number, source: 'local' | 'remote') => {
    return resolveConflict(branchId, type, id, source);
  });

  ipcMain.handle('sync:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Sync Folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Auto-sync
  ipcMain.handle('sync:enableAuto', async () => {
    enableAutoSync();
    lastRemoteMtime = null; // reset so existing files are detected
    startAutoSyncLoop();
    return getAutoSyncStatus(currentBranchId(), getSetting('sync_folder_path'));
  });

  ipcMain.handle('sync:disableAuto', async () => {
    disableAutoSync();
    stopAutoSyncLoop();
    return getAutoSyncStatus(currentBranchId(), getSetting('sync_folder_path'));
  });

  ipcMain.handle('sync:setAutoInterval', async (_event, seconds: number) => {
    setAutoSyncInterval(seconds);
    restartAutoSyncLoop();
    return { success: true };
  });

  ipcMain.handle('sync:getAutoStatus', async () => {
    return getAutoSyncStatus(currentBranchId(), getSetting('sync_folder_path'));
  });

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { checking: true };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());

  // Piece types
  ipcMain.handle('pieceTypes:getAll', async () => {
    return getPieceTypes();
  });

  ipcMain.handle('pieceTypes:updateBasePrice', async (_event, name_en: string, base_price: number) => {
    return updateBasePrice(name_en, base_price);
  });

  ipcMain.handle('pieceTypes:getBasePrice', async (_event, name_en: string) => {
    return getBasePrice(name_en);
  });

  ipcMain.handle('pieceTypes:create', async (_event, data: any) => {
    return createPieceType(data);
  });

  ipcMain.handle('pieceTypes:update', async (_event, id: number, data: any) => {
    return updatePieceType(id, data);
  });

  ipcMain.handle('pieceTypes:delete', async (_event, id: number) => {
    return deletePieceType(id);
  });

  // Notifications
  ipcMain.handle('notifications:getForUser', async (_event, userId: number, role: string, limit?: number) => {
    return getNotificationsForUser(userId, role, limit || 20);
  });

  ipcMain.handle('notifications:getUnreadCount', async (_event, userId: number, role: string) => {
    return getUnreadCount(userId, role);
  });

  ipcMain.handle('notifications:markAsRead', async (_event, notificationId: number) => {
    return markAsRead(notificationId);
  });

  ipcMain.handle('notifications:markAllAsRead', async (_event, userId: number, role: string) => {
    return markAllAsRead(userId, role);
  });

  ipcMain.handle('notifications:softDelete', async (_event, notificationId: number) => {
    return softDeleteNotification(notificationId);
  });

  ipcMain.handle('notifications:clearRead', async (_event, userId: number, role: string) => {
    return clearReadNotifications(userId, role);
  });

  ipcMain.handle('notifications:generateOverdue', async () => {
    return generateOverdueNotifications();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle('print:receipt', async () => {
    if (mainWindow) {
      await mainWindow.webContents.print({ silent: false, printBackground: true });
    }
  });
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // License handlers
  ipcMain.handle('license:validate', async (_event, key: string) => {
    const hwid = await getHardwareId();
    return validateLicenseKey(key, hwid);
  });

  ipcMain.handle('license:activate', async (_event, key: string) => {
    const hwid = await getHardwareId();
    return activateLicense(key, hwid);
  });

  ipcMain.handle('license:getHardwareId', async () => {
    return getHardwareId();
  });

  ipcMain.handle('license:getStatus', async () => {
    return getLicenseStatus();
  });

  ipcMain.handle('license:isDemo', async () => {
    return isDemoMode();
  });

  ipcMain.handle('license:enableDemo', async () => {
    enableDemoMode();
    return { success: true };
  });

  ipcMain.handle('license:disableDemo', async () => {
    disableDemoMode();
    return { success: true };
  });

  ipcMain.handle('license:checkRestrictions', async () => {
    return checkDemoRestrictions();
  });

  ipcMain.handle('license:getDemoUsage', async () => {
    return getDemoUsage();
  });

  ipcMain.handle('license:clear', async () => {
    clearLicense();
    return { success: true };
  });
}

app.on('ready', () => {
  initializeSchema();
  syncAllOrderPayments(); // ensure orders.paid matches actual payment records
  registerIpcHandlers();
  createWindow();

  autoUpdater.setFeedURL({
    url: 'https://github.com/Abu-ellil/etiquette-tailor/releases/latest/download/',
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:not-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded');
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update:error', err?.message || 'Unknown error');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
    setInterval(() => autoUpdater.checkForUpdates(), 30 * 60 * 1000);
  }

  // Start auto-sync if enabled
  if (getSetting('auto_sync_enabled') === '1' && getSetting('sync_folder_path')) {
    startAutoSyncLoop();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
