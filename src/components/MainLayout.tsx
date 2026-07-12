import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BackendAPI } from '../data/backend';
import { Shift, View } from '../models/types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ViewManager } from './ViewManager';
import { SyncManager } from './SyncManager';
import { OpenShiftModal } from '../pages/CorteCaja';

export function MainLayout() {
  const { reqContext } = useAuth();
  const [currentView, setCurrentView] = useState<View>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [, setActiveShift] = useState<Shift | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);

  useEffect(() => {
    BackendAPI.getActiveShift(reqContext).then((shift) => {
      if (!shift) setShowOpenShiftModal(true);
      else setActiveShift(shift);
    });
  }, [reqContext]);

  const handleNavItemClick = (view: View) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const handleShiftClosed = () => {
    setActiveShift(null);
    setShowOpenShiftModal(true);
    setCurrentView('pos');
  };

  return (
    <div className="app-bg flex h-screen font-sans text-slate-900 dark:text-[#E2E8F0] overflow-hidden transition-colors relative">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        currentView={currentView}
        isExpanded={isSidebarExpanded}
        isOpen={isSidebarOpen}
        onNavItemClick={handleNavItemClick}
        onToggleExpand={setIsSidebarExpanded}
        onRequestClose={() => setIsSidebarOpen(false)}
      />

      <main className="main-canvas flex-1 flex min-w-0 min-h-0 flex-col transition-colors">
        <SyncManager />
        <Header
          isSidebarOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen((open) => !open)}
        />
        <ViewManager currentView={currentView} onShiftClosed={handleShiftClosed} />
        {showOpenShiftModal && (
          <OpenShiftModal
            onOpen={(shift) => {
              setActiveShift(shift);
              setShowOpenShiftModal(false);
            }}
          />
        )}
      </main>
    </div>
  );
}