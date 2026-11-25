import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useLanguage from '../hooks/useLanguage';
import api from '../services/api';

const Navbar = ({ onMenuClick, sidebarOpen = false }) => {
  const { user, logout } = useAuth();
  const { language, lowData, toggleLanguage, toggleLowData, t } = useLanguage();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const retryNotifications = useRef(null);
  const userId = user?.id || user?._id;

  useEffect(() => {
    if (!userId) return undefined;
    let mounted = true;
    const loadNotifications = async () => {
      try {
        const response = await api.get('/notifications', { params: { page: 1, limit: 8 } });
        if (!mounted) return;
        setNotifications(response.data.data.notifications);
        setUnreadCount(response.data.data.unreadCount);
        setError('');
      } catch (requestError) {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load notifications.');
      }
    };
    retryNotifications.current = loadNotifications;

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30_000);
    return () => {
      mounted = false;
      retryNotifications.current = null;
      window.clearInterval(timer);
    };
  }, [userId]);

  const markRead = async (notification) => {
    if (!notification.readAt) {
      try {
        await api.put(`/notifications/${notification._id}/read`);
        setUnreadCount((count) => Math.max(0, count - 1));
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
        )));
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to mark notification as read.');
        return;
      }
    }
    setOpen(false);
    navigate('/alerts');
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadCount(0);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to mark notifications as read.');
    }
  };

  const dashboardPath = `/${user?.role}/dashboard`;
  const profilePath = user?.role === 'patient' ? '/patient/profile' : user?.role === 'admin' ? '/admin/users' : '/doctor/dashboard';
  const initials = (user?.name || 'User')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={sidebarOpen}
            onClick={onMenuClick}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link to={dashboardPath} className="flex items-center gap-2 font-bold text-slate-900">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm text-white">HC</span>
            <span>Health Connect</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={language === 'en' ? 'Switch language to Telugu' : 'భాషను ఇంగ్లీష్‌కు మార్చండి'}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            {t('preference.language')}
          </button>
          <button
            type="button"
            onClick={toggleLowData}
            aria-pressed={lowData}
            aria-label={`${t('preference.lowData')}: ${lowData ? t('preference.on') : t('preference.off')}`}
            className="rounded-lg border border-slate-300 px-1.5 py-2 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 sm:px-2.5 sm:text-xs"
          >
            <span className="sm:hidden">Data</span>
            <span className="hidden sm:inline">{t('preference.lowData')}: {lowData ? t('preference.on') : t('preference.off')}</span>
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label={`Notifications, ${unreadCount} unread`}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" />
              </svg>
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {open && (
              <section className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="flex items-center justify-between gap-2 px-2 py-1">
                  <h2 className="font-bold text-slate-900">Notifications</h2>
                  {unreadCount > 0 && <button type="button" onClick={markAllRead} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Mark all read</button>}
                </div>
                {error && <div role="alert" className="mx-2 my-2 rounded-lg bg-red-50 p-2 text-xs text-red-950"><p>{error}</p><button type="button" onClick={() => retryNotifications.current?.()} className="mt-1 font-bold underline">Retry</button></div>}
                <ul className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto">
                  {notifications.map((notification) => (
                    <li key={notification._id}>
                      <button type="button" onClick={() => markRead(notification)} className={`w-full rounded-lg px-2 py-3 text-left hover:bg-slate-50 ${notification.readAt ? 'text-slate-600' : 'bg-indigo-50/60 text-slate-900'}`}>
                        <span className="block text-sm">{notification.message}</span>
                        <span className="mt-1 block text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!notifications.length && <p className="px-2 py-6 text-center text-sm text-slate-500">You’re all caught up.</p>}
                <Link to="/alerts" onClick={() => setOpen(false)} className="mt-2 block rounded-lg px-2 py-2 text-center text-sm font-semibold text-indigo-600 hover:bg-indigo-50">View alerts</Link>
              </section>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 px-2 py-1.5 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 sm:px-3"
            >
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-950">{initials}</span>
              <span className="hidden max-w-36 sm:block">
                <span className="block truncate text-sm font-semibold text-slate-900">{user?.name}</span>
                <span className="block text-xs capitalize text-slate-600">{user?.role}</span>
              </span>
            </button>
            {userMenuOpen && (
              <div role="menu" className="absolute right-0 top-12 z-50 min-w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <Link role="menuitem" to={profilePath} onClick={() => setUserMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">{user?.role === 'patient' ? 'My profile' : user?.role === 'admin' ? 'Manage users' : 'Dashboard'}</Link>
                <button role="menuitem" type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-800">Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
