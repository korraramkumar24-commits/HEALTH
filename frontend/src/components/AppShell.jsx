import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import {
  listForUser,
  OUTBOX_UPDATED_EVENT,
  sendOutboxItem,
  syncForUser,
} from '../services/offlineOutbox';

const AppShell = ({ children }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingOfflineItems, setPendingOfflineItems] = useState(0);
  const [offlineSyncError, setOfflineSyncError] = useState('');
  const userId = user?.id || user?._id;

  useEffect(() => {
    if (user?.role !== 'patient' || !userId) {
      return undefined;
    }
    let mounted = true;
    const refreshQueue = async () => {
      try {
        const items = await listForUser(userId);
        if (mounted) {
          setPendingOfflineItems(items.length);
          setOfflineSyncError('');
        }
      } catch (error) {
        if (mounted) setOfflineSyncError(error.message || 'Unable to check offline sync status.');
      }
    };
    const synchronize = async () => {
      if (!navigator.onLine) return;
      try {
        await syncForUser(userId, sendOutboxItem);
        await refreshQueue();
      } catch (error) {
        if (mounted) setOfflineSyncError(error.message || 'Saved offline items could not be synchronized.');
      }
    };
    const handleOutboxChange = () => { void refreshQueue(); };
    const handleOnline = () => { void synchronize(); };
    void refreshQueue();
    if (navigator.onLine) void synchronize();
    window.addEventListener('online', handleOnline);
    window.addEventListener(OUTBOX_UPDATED_EVENT, handleOutboxChange);
    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OUTBOX_UPDATED_EVENT, handleOutboxChange);
    };
  }, [user?.role, userId]);

  return (
    <div className={user?.role === 'admin' ? 'app-shell app-shell-admin' : 'app-shell'}>
      <Navbar sidebarOpen={sidebarOpen} onMenuClick={() => setSidebarOpen((open) => !open)} />
      <div className="flex min-h-[calc(100vh-65px)]">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="min-w-0 flex-1">
          <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">
            Demo application - not for medical use
          </div>
          {user?.role === 'patient' && (pendingOfflineItems > 0 || offlineSyncError) && (
            <div role={offlineSyncError ? 'alert' : 'status'} aria-live="polite" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950">
              {offlineSyncError || `${pendingOfflineItems} health or emergency item(s) are saved on this device and waiting to sync.`}
            </div>
          )}
          {children}
          <footer className="border-t border-slate-200 bg-white px-5 py-4 text-center text-xs font-medium text-slate-600">
            Demo application - not for medical use. Data and alerts are for demonstration only.
          </footer>
        </div>
      </div>
    </div>
  );
};

export default AppShell;
