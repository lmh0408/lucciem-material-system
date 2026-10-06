import React from 'react';
import { 
  Layers, 
  RefreshCw, 
  Building2, 
  Package,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

export type TabType = 'materials' | 'matrix' | 'simulator' | 'suppliers';

export type DbStatus = 'connected' | 'loading' | 'syncing' | 'error';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  dbStatus: DbStatus;
  dbMessage: string;
  totalMaterialsCount: number;
  onRefreshFromDb: () => void;
  onReseedDb: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  dbStatus,
  dbMessage,
  totalMaterialsCount,
  onRefreshFromDb,
  onReseedDb,
}) => {
  const tabs = [
    { id: 'simulator' as TabType, label: '재고 현황', icon: RefreshCw, desc: '안전재고 및 발주 수량 산출' },
    { id: 'materials' as TabType, label: '자재 DB', icon: Package, desc: '자재 등록, 사양 수정 및 관리' },
    { id: 'suppliers' as TabType, label: '협력사 및 발주', icon: Building2, desc: '거래처 등록 및 발주서 발행' },
    { id: 'matrix' as TabType, label: '동일 자재 통합 관리', icon: Layers, desc: '품명 불일치 대조 및 표준화' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 및 시스템 명칭 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#BA1B2D] flex items-center justify-center text-white font-bold shadow-md shadow-red-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">루씨엠</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-rose-50 text-[#BA1B2D] font-semibold border border-rose-200">
                  통합 자재 관리 시스템
                </span>
              </div>
            </div>
          </div>

          {/* Firebase DB 연동 상태 및 조작 버튼 (단일 통합 상태 표시) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div 
              id="firebase-db-status-badge"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                dbStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : dbStatus === 'syncing' || dbStatus === 'loading'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
              title="Firebase Firestore 실시간 데이터베이스 연동 중"
            >
              {dbStatus === 'connected' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-semibold text-emerald-900">Firebase DB 연동</span>
                  <span className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded text-[11px] font-bold">
                    {totalMaterialsCount}개 품목
                  </span>
                </>
              )}

              {(dbStatus === 'loading' || dbStatus === 'syncing') && (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                  <span className="font-medium">
                    {dbStatus === 'loading' ? 'DB 조회 중...' : 'DB 동기화 중...'}
                  </span>
                </>
              )}

              {dbStatus === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="font-medium">DB 연결 오류</span>
                </>
              )}
            </div>

            {/* DB 새로고침 버튼 */}
            <button
              id="btn-refresh-firebase-db"
              onClick={onRefreshFromDb}
              disabled={dbStatus === 'loading' || dbStatus === 'syncing'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
              title="Firebase DB에서 최신 데이터 다시 읽어오기"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dbStatus === 'loading' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">DB 새로고침</span>
            </button>

            {/* DB 일괄 백업 버튼 */}
            <button
              id="btn-reseed-firebase-db"
              onClick={onReseedDb}
              disabled={dbStatus === 'loading' || dbStatus === 'syncing'}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#BA1B2D] bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
              title="현재 자재 데이터를 Firebase Firestore에 일괄 백업/동기화"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>DB 동기화</span>
            </button>
          </div>
        </div>

        {/* 메인 내비게이션 탭 */}
        <nav className="flex space-x-1 sm:space-x-3 border-t border-slate-100 overflow-x-auto py-2 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#BA1B2D] text-white font-bold shadow-xs shadow-red-900/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

