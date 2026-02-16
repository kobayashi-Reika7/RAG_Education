import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type DataStatusResponse } from '../lib/api';

type UploadPhase = 'idle' | 'uploading' | 'done' | 'error';

const ACCEPT = '.pdf,.md,.markdown,.txt,.text,.csv';

export default function DataTab() {
  const [status, setStatus] = useState<DataStatusResponse | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [uploadResult, setUploadResult] = useState<string>('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.getDataStatus();
      setStatus(s);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setPhase('uploading');
    setError('');
    setUploadResult('');

    const results: string[] = [];
    let hasError = false;

    for (const file of Array.from(files)) {
      try {
        const res = await api.uploadFile(file);
        results.push(`${res.filename}: ${res.chunks_created} チャンク作成`);
      } catch (e: unknown) {
        hasError = true;
        results.push(`${file.name}: ${e instanceof Error ? e.message : 'エラー'}`);
      }
    }

    setUploadResult(results.join('\n'));
    setPhase(hasError ? 'error' : 'done');
    await loadStatus();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDelete = async (sourceName: string) => {
    if (!confirm(`「${sourceName}」のデータを削除しますか？`)) return;
    setDeleting(sourceName);
    try {
      await api.deleteSource(sourceName);
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 mb-4">
            <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">データ管理</h2>
          <p className="text-sm text-gray-400 mt-1">PDF・Markdown・テキストファイルをアップロードして学習データを追加</p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-violet-400 bg-violet-50/50 scale-[1.01]'
              : phase === 'uploading'
              ? 'border-gray-300 bg-gray-50 pointer-events-none'
              : 'border-gray-300 bg-white hover:border-violet-300 hover:bg-violet-50/30'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          {phase === 'uploading' ? (
            <div className="space-y-3">
              <div className="spinner mx-auto" style={{ borderTopColor: '#8b5cf6' }} />
              <p className="text-sm font-medium text-gray-500">アップロード中...</p>
              <p className="text-xs text-gray-400">テキスト抽出 → チャンク分割 → Embedding生成</p>
            </div>
          ) : (
            <>
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 transition-all ${
                dragOver ? 'bg-violet-200' : 'bg-gray-100'
              }`}>
                <svg className={`w-7 h-7 ${dragOver ? 'text-violet-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">
                ファイルをドラッグ＆ドロップ
              </p>
              <p className="text-xs text-gray-400 mt-1">
                またはクリックして選択（PDF / Markdown / テキスト、最大10MB）
              </p>
              <div className="flex justify-center gap-2 mt-4">
                {['PDF', 'MD', 'TXT'].map((ext) => (
                  <span key={ext} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-semibold">
                    .{ext.toLowerCase()}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Upload Result */}
        {(phase === 'done' || phase === 'error') && uploadResult && (
          <div className={`rounded-2xl border p-5 ${
            phase === 'done' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {phase === 'done' ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                </div>
              )}
              <span className={`text-sm font-bold ${phase === 'done' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {phase === 'done' ? 'アップロード完了' : '一部エラーあり'}
              </span>
            </div>
            {uploadResult.split('\n').map((line, i) => (
              <p key={i} className="text-[13px] text-gray-700 leading-relaxed">{line}</p>
            ))}
            <button
              onClick={() => { setPhase('idle'); setUploadResult(''); }}
              className="mt-3 text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              閉じる
            </button>
          </div>
        )}

        {/* Current Data Status */}
        {status && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">登録済みデータ</h3>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="text-[11px] font-semibold">{status.total_chunks} チャンク</span>
              </div>
            </div>

            {status.sources.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-400">データがありません</p>
                <p className="text-xs text-gray-300 mt-1">ファイルをアップロードして始めましょう</p>
              </div>
            ) : (
              <div className="space-y-2">
                {status.sources.map((src) => (
                  <div
                    key={src.name}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{src.name}</p>
                      <p className="text-[11px] text-gray-400">{src.chunks} チャンク</p>
                    </div>
                    <button
                      onClick={() => handleDelete(src.name)}
                      disabled={deleting === src.name}
                      className="p-2 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50"
                      title="削除"
                    >
                      {deleting === src.name ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md bg-violet-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider">使い方</span>
          </div>
          <ul className="space-y-1.5 text-[12px] text-violet-800 leading-relaxed">
            <li>アップロードしたファイルは自動でチャンクに分割され、ベクトルDBに登録されます</li>
            <li>登録後すぐに「質問する」「クイズ」「問題演習」で利用可能になります</li>
            <li>不要なデータはゴミ箱アイコンで削除できます</li>
            <li>対応形式: PDF、Markdown(.md)、テキスト(.txt)、CSV</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
