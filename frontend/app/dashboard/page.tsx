'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Order {
  id: number;
  sender: string;
  receiver: string;
  amount: number;
  token_symbol: string;
  token_address: string;
  execute_at: number;
  created_at: number;
  status: string;
}

interface Stats {
  totalTx: number;
  executedTx: number;
  cancelledTx: number;
  pendingTx: number;
  uniqueWalletsCount: number;
  volumes: {
    [key: string]: {
      scheduled: number;
      executed: number;
    };
  };
}

const translations = {
  tr: {
    title: 'PayWhen Protokolü Dashboard',
    subtitle: 'Güvenilmez akıllı kontrat tabanlı ödeme zamanlayıcısının anlık işlem ve hacim verileri.',
    backToApp: 'Uygulamaya Dön',
    totalTx: 'Toplam Emir Sayısı',
    uniqueWallets: 'Benzersiz Cüzdan Etkileşimi',
    executedTx: 'Başarıyla Yürütülen',
    cancelledTx: 'İptal Edilen',
    pendingTx: 'Bekleyen (Aktif)',
    successRate: 'Başarı Oranı',
    totalVolume: 'USDC İşlem Hacmi',
    scheduledVolume: 'Planlanan Toplam',
    executedVolume: 'Yürütülen Toplam',
    recentTitle: 'Son Gerçekleşen ve Planlanan Emirler',
    id: 'ID',
    sender: 'Gönderen',
    receiver: 'Alıcı',
    amount: 'Miktar',
    executeAt: 'Çalışma Zamanı',
    status: 'Durum',
    loading: 'İstatistikler yükleniyor...',
    error: 'İstatistikler yüklenirken bir hata oluştu.',
    refresh: 'Yenile',
    statusExecuted: 'Yürütüldü',
    statusCancelled: 'İptal Edildi',
    statusPending: 'Bekliyor',
    noOrders: 'Henüz kayıt bulunamadı.',
    copied: 'Kopyalandı!'
  },
  en: {
    title: 'PayWhen Protocol Dashboard',
    subtitle: 'Live transaction and volume statistics for the trustless smart contract scheduler.',
    backToApp: 'Back to App',
    totalTx: 'Total Scheduled Orders',
    uniqueWallets: 'Unique Wallets Interacted',
    executedTx: 'Successfully Executed',
    cancelledTx: 'Cancelled',
    pendingTx: 'Pending (Active)',
    successRate: 'Success Rate',
    totalVolume: 'USDC Tx Volume',
    scheduledVolume: 'Total Scheduled',
    executedVolume: 'Total Executed',
    recentTitle: 'Recent Executed and Scheduled Orders',
    id: 'ID',
    sender: 'Sender',
    receiver: 'Receiver',
    amount: 'Amount',
    executeAt: 'Execute Time',
    status: 'Status',
    loading: 'Loading statistics...',
    error: 'An error occurred while loading statistics.',
    refresh: 'Refresh',
    statusExecuted: 'Executed',
    statusCancelled: 'Cancelled',
    statusPending: 'Pending',
    noOrders: 'No orders found.',
    copied: 'Copied!'
  }
};

export default function Dashboard() {
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.paywhen.xyz';

  const t = (key: keyof typeof translations.tr) => {
    return translations[language][key] || translations.tr[key] || '';
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('paywhen_lang');
      if (stored === 'en' || stored === 'tr') {
        setLanguage(stored);
      }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/stats/recent`)
      ]);

      if (!statsRes.ok || !recentRes.ok) throw new Error('API error');

      const statsData = await statsRes.json();
      const recentData = await recentRes.json();

      setStats(statsData);
      setRecentOrders(recentData);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: 'tr' | 'en') => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paywhen_lang', lang);
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateSuccessRate = () => {
    if (!stats || stats.totalTx === 0) return 0;
    const finishedTx = stats.executedTx + stats.cancelledTx;
    if (finishedTx === 0) return 100;
    return Math.round((stats.executedTx / finishedTx) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'executed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'cancelled':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'executed':
        return t('statusExecuted');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return t('statusPending');
    }
  };

  const usdcStats = stats?.volumes?.['USDC'] || { scheduled: 0, executed: 0 };
  const successRate = calculateSuccessRate();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Decorative Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10 flex-1 flex flex-col">
        {/* Top Header */}
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-size-200 animate-gradient bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
                PayWhen
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 text-slate-400 font-mono">
                v1.2
              </span>
            </Link>
            <span className="text-slate-500">|</span>
            <span className="text-sm text-slate-400 font-medium">Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Selection */}
            <div className="flex bg-slate-900/60 border border-slate-800/60 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => handleLanguageChange('tr')}
                className={`px-3 py-1 rounded-md transition-all ${
                  language === 'tr' ? 'bg-indigo-600/90 text-white shadow-sm shadow-indigo-900/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TR
              </button>
              <button
                onClick={() => handleLanguageChange('en')}
                className={`px-3 py-1 rounded-md transition-all ${
                  language === 'en' ? 'bg-indigo-600/90 text-white shadow-sm shadow-indigo-900/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
            </div>

            {/* Refresh button */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 hover:bg-slate-800/60 transition-all text-slate-300 disabled:opacity-50"
              title={t('refresh')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2"
                />
              </svg>
            </button>

            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all shadow-sm"
            >
              {t('backToApp')}
            </Link>
          </div>
        </header>

        {/* Dashboard Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            {t('title')}
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            {t('subtitle')}
          </p>
        </div>

        {/* Loading / Error States */}
        {loading && !stats ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-sm">{t('loading')}</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 border border-slate-800/40 rounded-2xl bg-slate-900/20 backdrop-blur-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-rose-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-rose-400 font-semibold mb-4">{t('error')}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-all rounded-lg text-xs font-semibold text-white shadow-lg shadow-indigo-900/30"
            >
              {t('refresh')}
            </button>
          </div>
        ) : stats ? (
          <div className="space-y-8">
            {/* General Statistics Tables */}
            <div className="border border-slate-800/50 rounded-2xl bg-gradient-to-b from-slate-900/40 to-slate-950/40 p-6 backdrop-blur-md space-y-8">
              <h3 className="text-xl font-bold text-white pb-2 border-b border-slate-800/60 flex items-center gap-2">
                <span className="w-2.5 h-5 bg-indigo-500 rounded-sm inline-block shadow-sm shadow-indigo-500/50" />
                {language === 'tr' ? 'Genel Protokol İstatistikleri' : 'Global Protocol Statistics'}
              </h3>

              {/* Group 1: Volumes */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-indigo-500/70 rounded-sm inline-block" />
                  {language === 'tr' ? 'İşlem Hacimleri' : 'Transaction Volumes'}
                </h4>
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                  <table className="w-full text-left border-collapse min-w-[800px] border border-slate-800/60">
                    <thead>
                      <tr className="bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 w-1/3 border border-slate-800/60">{language === 'tr' ? 'Metrik' : 'Metric'}</th>
                        <th className="py-3 px-4 text-right w-1/4 border border-slate-800/60">{language === 'tr' ? 'Değer' : 'Value'}</th>
                        <th className="py-3 px-4 w-5/12 border border-slate-800/60">{language === 'tr' ? 'Açıklama / Durum' : 'Description / Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 font-semibold border border-slate-800/60">{language === 'tr' ? 'Toplam USDC Hacmi' : 'Total USDC Volume'}</td>
                        <td className="py-4 px-4 text-right font-mono text-white text-base font-extrabold whitespace-nowrap border border-slate-800/60">
                          {usdcStats.executed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          {language === 'tr' 
                            ? `Başarıyla transfer edilen miktar (Planlanan toplam: ${usdcStats.scheduled.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC)`
                            : `Successfully transferred volume (Total scheduled: ${usdcStats.scheduled.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC)`}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 font-semibold border border-slate-800/60">{language === 'tr' ? 'Toplam EURC Hacmi' : 'Total EURC Volume'}</td>
                        <td className="py-4 px-4 text-right font-mono text-white text-base font-extrabold whitespace-nowrap border border-slate-800/60">
                          {(stats?.volumes?.['EURC']?.executed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EURC
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          {language === 'tr' 
                            ? `Başarıyla transfer edilen miktar (Planlanan toplam: ${(stats?.volumes?.['EURC']?.scheduled || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} EURC)`
                            : `Successfully transferred volume (Total scheduled: ${(stats?.volumes?.['EURC']?.scheduled || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} EURC)`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Group 2: Counts */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-purple-500/70 rounded-sm inline-block" />
                  {language === 'tr' ? 'İşlem Adetleri' : 'Transaction Counts'}
                </h4>
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                  <table className="w-full text-left border-collapse min-w-[800px] border border-slate-800/60">
                    <thead>
                      <tr className="bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 w-1/3 border border-slate-800/60">{language === 'tr' ? 'Metrik' : 'Metric'}</th>
                        <th className="py-3 px-4 text-right w-1/4 border border-slate-800/60">{language === 'tr' ? 'Değer' : 'Value'}</th>
                        <th className="py-3 px-4 w-5/12 border border-slate-800/60">{language === 'tr' ? 'Açıklama / Durum' : 'Description / Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 border border-slate-800/60">{language === 'tr' ? 'Toplam Planlanan Emir' : 'Total Scheduled Orders'}</td>
                        <td className="py-4 px-4 text-right font-mono text-white font-semibold border border-slate-800/60">{stats.totalTx}</td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          {language === 'tr' 
                            ? 'Dapp üzerinden bugüne kadar zamanlanmış tüm ödemeler'
                            : 'All payments scheduled using the Dapp to date'}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 border border-slate-800/60">{language === 'tr' ? 'Başarıyla Yürütülen Emirler' : 'Executed Orders'}</td>
                        <td className="py-4 px-4 text-right font-mono text-emerald-400 font-semibold border border-slate-800/60">{stats.executedTx}</td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                            {language === 'tr' ? 'Zamanı gelip başarıyla transfer edilenler' : 'Successfully executed transfers'}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 border border-slate-800/60">{language === 'tr' ? 'İptal Edilen Emirler' : 'Cancelled Orders'}</td>
                        <td className="py-4 px-4 text-right font-mono text-rose-400 font-semibold border border-slate-800/60">{stats.cancelledTx}</td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                            {language === 'tr' ? 'Kullanıcılar tarafından 24 saatlik süre içinde geri çekilenler' : 'Orders cancelled by users prior to execution'}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 border border-slate-800/60">{language === 'tr' ? 'Bekleyen (Aktif) Emirler' : 'Pending Orders'}</td>
                        <td className="py-4 px-4 text-right font-mono text-amber-400 font-semibold border border-slate-800/60">{stats.pendingTx}</td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                            {language === 'tr' ? 'Günü geldiğinde relayer tarafından otomatik yürütülecekler' : 'Active orders waiting to be executed'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Group 3: Metrics */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-pink-400 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-pink-500/70 rounded-sm inline-block" />
                  {language === 'tr' ? 'Sistem & Kullanım Metrikleri' : 'System & Usage Metrics'}
                </h4>
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                  <table className="w-full text-left border-collapse min-w-[800px] border border-slate-800/60">
                    <thead>
                      <tr className="bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 w-1/3 border border-slate-800/60">{language === 'tr' ? 'Metrik' : 'Metric'}</th>
                        <th className="py-3 px-4 text-right w-1/4 border border-slate-800/60">{language === 'tr' ? 'Değer' : 'Value'}</th>
                        <th className="py-3 px-4 w-5/12 border border-slate-800/60">{language === 'tr' ? 'Açıklama / Durum' : 'Description / Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 border border-slate-800/60">{language === 'tr' ? 'Tekil Cüzdan Sayısı' : 'Unique Wallets'}</td>
                        <td className="py-4 px-4 text-right font-mono text-white font-semibold border border-slate-800/60">{stats.uniqueWalletsCount}</td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          {language === 'tr' 
                            ? 'Akıllı sözleşmeyle etkileşime giren (gönderen veya alıcı) tekil cüzdanlar'
                            : 'Unique wallet addresses interacting with the contract (as sender or receiver)'}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-4 text-slate-200 border border-slate-800/60">{language === 'tr' ? 'Sistem Başarı Oranı' : 'Success Rate'}</td>
                        <td className="py-4 px-4 text-right font-mono text-indigo-400 font-bold text-base border border-slate-800/60">%{successRate}</td>
                        <td className="py-4 px-4 text-xs text-slate-400 leading-relaxed border border-slate-800/60">
                          {language === 'tr' 
                            ? 'Yürütülen emirlerin, sonuçlanmış (yürütülmüş veya iptal edilmiş) tüm emirlere oranı'
                            : 'Ratio of executed orders to all completed (executed or cancelled) orders'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>


            {/* Bottom Section: Recent Orders Table */}
            <div className="border border-slate-800/50 rounded-2xl bg-gradient-to-b from-slate-900/20 to-slate-950/20 p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-6">
                {t('recentTitle')}
              </h3>

              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                <table className="w-full text-left border-collapse min-w-[850px] border border-slate-800/60">
                  <thead>
                    <tr className="bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 w-[10%] border border-slate-800/60">{t('id')}</th>
                      <th className="py-3 px-4 w-[25%] border border-slate-800/60">{t('sender')}</th>
                      <th className="py-3 px-4 w-[25%] border border-slate-800/60">{t('receiver')}</th>
                      <th className="py-3 px-4 text-right w-[15%] border border-slate-800/60">{t('amount')}</th>
                      <th className="py-3 px-4 w-[15%] border border-slate-800/60">{t('executeAt')}</th>
                      <th className="py-3 px-4 text-center w-[10%] border border-slate-800/60">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-sm border border-slate-800/60">
                          {t('noOrders')}
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-900/20 transition-colors"
                        >
                          <td className="py-4 px-4 text-slate-400 font-mono border border-slate-800/60">#{order.id}</td>
                          <td className="py-4 px-4 font-mono text-xs border border-slate-800/60">
                            <button
                              onClick={() => copyToClipboard(order.sender, `sender-${order.id}`)}
                              className="hover:text-indigo-400 transition-colors cursor-pointer text-left focus:outline-none"
                              title={order.sender}
                            >
                              {copyFeedback === `sender-${order.id}` ? t('copied') : formatAddress(order.sender)}
                            </button>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs border border-slate-800/60">
                            <button
                              onClick={() => copyToClipboard(order.receiver, `receiver-${order.id}`)}
                              className="hover:text-indigo-400 transition-colors cursor-pointer text-left focus:outline-none"
                              title={order.receiver}
                            >
                              {copyFeedback === `receiver-${order.id}` ? t('copied') : formatAddress(order.receiver)}
                            </button>
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-slate-100 whitespace-nowrap border border-slate-800/60">
                            {order.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-[10px] text-slate-400 font-bold">{order.token_symbol}</span>
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-400 whitespace-nowrap border border-slate-800/60">
                            {formatDate(order.execute_at)}
                          </td>
                          <td className="py-4 px-4 text-center whitespace-nowrap border border-slate-800/60">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block ${getStatusColor(order.status)}`}>
                              {getStatusText(order.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </main>
  );
}
