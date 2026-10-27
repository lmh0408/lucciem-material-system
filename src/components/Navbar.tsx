import React from 'react';
import { createPortal } from 'react-dom';
import { GOOGLE_APPS_SCRIPT_CODE } from '../data/googleAppsScriptCode';
import { 
  Layers, 
  RefreshCw, 
  Building2, 
  Package,
  Save,
  FileSpreadsheet,
  ExternalLink,
  Download,
  Settings,
  X,
  Copy,
  Check,
} from 'lucide-react';

export type TabType = 'materials' | 'simulator' | 'suppliers';
export type DbStatus = 'connected' | 'loading' | 'syncing' | 'error';

/** 화면 표시 버전 v1.1 */
const DISPLAYED_APP_VERSION = 'v1.1';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onReseedDb: () => void;
  onSyncFromGoogleSheet?: () => void;
  googleSheetUrl?: string;
  googleScriptUrl?: string;
  onGoogleSheetSettingsChange?: (settings: { googleSheetUrl: string; googleScriptUrl: string }) => void;
  isSaving?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onReseedDb,
  onSyncFromGoogleSheet,
  googleSheetUrl = 'https://docs.google.com/spreadsheets/d/1cqYtwVvxJU9UmQ0oHJYMFupGZDae5sN1bh3Grvrt7Xs/edit?usp=sharing',
  googleScriptUrl = '',
  onGoogleSheetSettingsChange,
  isSaving = false,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isAppsScriptCopied, setIsAppsScriptCopied] = React.useState(false);
  const [editingGoogleSheetUrl, setEditingGoogleSheetUrl] = React.useState(googleSheetUrl);
  const [editingGoogleScriptUrl, setEditingGoogleScriptUrl] = React.useState(googleScriptUrl);

  React.useEffect(() => setEditingGoogleSheetUrl(googleSheetUrl), [googleSheetUrl]);
  React.useEffect(() => setEditingGoogleScriptUrl(googleScriptUrl), [googleScriptUrl]);

  const copyAppsScriptCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setIsAppsScriptCopied(true);
      window.setTimeout(() => setIsAppsScriptCopied(false), 2000);
    } catch {
      window.alert('클립보드 접근이 차단되었습니다. 브라우저 권한을 허용한 뒤 다시 시도해 주세요.');
    }
  };

  const tabs = [
    { id: 'simulator' as TabType, label: '재고 현황', icon: RefreshCw, desc: '안전재고 및 발주 수량 산출' },
    { id: 'materials' as TabType, label: '자재 DB', icon: Package, desc: '자재 등록, 사양 수정 및 관리' },
    { id: 'suppliers' as TabType, label: '협력사 및 발주', icon: Building2, desc: '거래처 등록 및 발주서 발행' },
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
                <span className="font-bold text-slate-900 text-lg tracking-tight">통합 자재 관리 시스템</span>
                <span className="text-xs font-semibold text-slate-500">{DISPLAYED_APP_VERSION}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              id="btn-save-materials"
              onClick={onReseedDb}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
                isSaving
                  ? 'bg-[#BA1B2D] text-white border border-red-700 ring-4 ring-rose-400/50 scale-95 shadow-inner cursor-wait animate-pulse'
                  : 'text-[#BA1B2D] bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:shadow-xs'
              }`}
              title="현재 앱의 자재·협력사 데이터를 원장(자재관리DB·협력사관리DB)에 저장합니다"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span className="font-bold text-white">저장 중...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>저장</span>
                </>
              )}
            </button>

            <button
              id="btn-load-google-sheet"
              onClick={onSyncFromGoogleSheet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="원장 자재관리DB에서 앱으로 자재 데이터를 불러옵니다"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>불러오기</span>
            </button>

            <a
              id="btn-view-google-sheet"
              href={googleSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
              title="원장 구글 시트를 새 탭에서 엽니다"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>시트 열기</span>
              <ExternalLink className="w-3 h-3 text-emerald-600 opacity-70" />
            </a>

            <a
              id="btn-download-source"
              href="/api/download-source"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="서버에 배포된 현재 프로젝트 소스를 내려받습니다"
            >
              <Download className="w-3.5 h-3.5" />
              <span>소스 받기</span>
            </a>

            <button
              type="button"
              id="btn-settings"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="구글 시트 및 동기화 설정"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>설정</span>
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

      {isSettingsOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onGoogleSheetSettingsChange?.({
                googleSheetUrl: editingGoogleSheetUrl.trim(),
                googleScriptUrl: editingGoogleScriptUrl.trim(),
              });
              setIsSettingsOpen(false);
            }}
            className="relative my-auto w-full max-w-[720px] rounded-2xl border border-slate-200 bg-white px-10 py-9 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="absolute right-5 top-5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="설정 닫기"
            >
              <X className="h-5 w-5" />
            </button>
            <section className="pr-8">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">1. 시트 연결</h2>
              <label className="mt-6 block text-sm font-bold text-slate-700">
                구글 스프레드시트 URL
                <input
                  value={editingGoogleSheetUrl}
                  onChange={(event) => setEditingGoogleSheetUrl(event.target.value)}
                  required
                  type="url"
                  className="mt-3 w-full rounded-full border border-slate-200 bg-slate-50 px-5 py-3.5 font-mono text-sm font-normal tracking-wide text-slate-700 outline-none focus:border-[#BA1B2D] focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </section>
            <section className="mt-8 border-t border-slate-200 pt-8 pr-8">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">2. 저장 연결</h2>
              <button
                type="button"
                onClick={copyAppsScriptCode}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700"
              >
                {isAppsScriptCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isAppsScriptCopied ? '코드 복사 완료' : 'Apps Script 코드 복사'}
              </button>
              <label className="mt-6 block text-sm font-bold text-slate-700">
                저장용 웹앱 URL
                <input
                  value={editingGoogleScriptUrl}
                  onChange={(event) => setEditingGoogleScriptUrl(event.target.value)}
                  required
                  type="url"
                  className="mt-3 w-full rounded-full border border-slate-200 bg-slate-50 px-5 py-3.5 font-mono text-sm font-normal tracking-wide text-slate-700 outline-none focus:border-[#BA1B2D] focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </section>
            <div className="mt-8 flex justify-end gap-2 pr-8">
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                취소
              </button>
              <button type="submit" className="rounded-lg bg-[#BA1B2D] px-4 py-2 text-sm font-bold text-white hover:bg-[#a01625]">
                저장
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </header>
  );
};

