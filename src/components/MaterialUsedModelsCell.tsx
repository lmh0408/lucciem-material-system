import React from 'react';
import { MaterialItem } from '../types/inventory';

export function MaterialUsedModelsCell({ item }: { item: MaterialItem }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <span
        title={`옥외보관함: ${item.usedIn.outdoor}개`}
        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
          item.usedIn.outdoor > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-300'
        }`}
      >
        옥
      </span>
      <span
        title={`실내보관함: ${item.usedIn.indoor}개`}
        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
          item.usedIn.indoor > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-300'
        }`}
      >
        실
      </span>
      <span
        title={`이동형보관함: ${item.usedIn.mobile}개`}
        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
          item.usedIn.mobile > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-300'
        }`}
      >
        이
      </span>
      <span
        title={`L.SEND case: ${item.usedIn.lsend}개`}
        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
          item.usedIn.lsend > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-300'
        }`}
      >
        L
      </span>
    </div>
  );
}
