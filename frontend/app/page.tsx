'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const SCHEDULER_ADDRESS = '0x0e13299e56724Ce459e621b370f89552F87ede8B';
const SCHEDULER_ABI = [
  'function scheduleOrder(address token, address receiver, uint256 amount, uint256 executeAt) external returns (uint256)',
  'function cancelOrder(uint256 orderId) external',
  'function nextOrderId() external view returns (uint256)',
  'function orders(uint256) external view returns (uint256 id, address sender, address receiver, address token, uint256 amount, uint256 executeAt, uint256 createdAt, bool executed, bool cancelled)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)'
];

const translations = {
  tr: {
    serverStatus: 'Sunucu Durumu',
    active: 'Aktif',
    offline: 'Çevrimdışı',
    gasPool: 'Otomatik Gas Havuzu',
    gasPoolTooltip: 'Otomatik Gas Havuzu: Geleceğe dönük planlanan işlemlerin, cüzdanınızdan gas ücreti harcamadan sistem (relayer) tarafından otomatik çalıştırılmasını sağlayan bakiyedir.',
    smartWallet: 'Biyometrik Cüzdan',
    metaMask: 'MetaMask',
    disconnect: 'Çıkış',
    connectMetaMask: 'Cüzdan Bağla',
    biometricWallet: 'Biyometrik Cüzdan',
    scheduleNewTransfer: 'Yeni Transfer Planla',
    paymentCurrency: 'Ödeme Para Birimi',
    receiverAddress: 'Alıcı Cüzdan Adresi (Receiver)',
    amountToSend: 'Gönderilecek Miktar',
    executeDateTime: 'Gönderim Tarihi & Saati (Gelecek Zaman)',
    sendingTx: 'İşlem Gönderiliyor...',
    lockAndSchedule: 'Kilitle ve Planla',
    scheduledOrders: 'Planlanmış Emirleriniz',
    noOrders: 'Henüz planlanmış bir emir bulunmuyor.',
    cancellable: 'İptal Edilebilir',
    cancelTime: 'İptal Süresi',
    cancel: 'İptal Et',
    locked: 'Geri Dönüşsüz',
    guaranteedLock: 'Garantili Kilitleme Tamamlandı',
    shareCheque: 'Çek Yaprağı Paylaş',
    sent: 'Gönderildi',
    cancelled: 'İptal Edildi',
    expired: 'Süre doldu',
    receiver: 'Alıcı',
    amount: 'Miktar',
    date: 'Tarih',
    countdown: 'Sayaç',
    txSuccess: 'İşlem Başarılı!',
    done: 'Tamam',
    warning: 'Dikkat!',
    warningMsg: 'Gönderinizi <strong>24 saatten kısa</strong> bir süre içinde gerçekleşecek şekilde planladınız.<br><br>Gönderimi onayladığınız takdirde <strong>iptal etme şansınız olmayacak.</strong><br>Onaylıyor musunuz?',
    discard: 'Vazgeç',
    yesLock: 'Evet, Kilitle',
    chequeTitle: 'PayWhen Blokzincir Ödeme Çeki',
    lockedAndGuaranteed: '🔒 Kilitli ve Garantili',
    protocolGuarantee: 'PayWhen Protokolü Garantisi',
    chequeLabelSender: 'Gönderen (Cüzdan)',
    chequeLabelReceiver: 'Alıcı (Receiver)',
    chequeLabelTime: 'Planlanan Gönderim Zamanı',
    passkeyTitle: 'Biyometrik Cüzdan (Passkey)',
    passkeySimWarning: 'Circle Web3 Services API anahtarları henüz tanımlanmadığı için bu işlem yerel tarayıcı WebAuthn API\'sini simüle ederek TouchID/FaceID akışını canlandıracaktır.',
    usernamePlaceholder: 'Örn: ahmet@paywhen.xyz',
    createPasskey: 'Yeni Biyometrik Cüzdan Yarat',
    loginPasskey: 'Mevcut Cüzdana Giriş Yap',
    usernameLabel: 'Kullanıcı Adı veya E-posta',
    orderId: 'Emir',
    loading: 'Yükleniyor...',
    
    // Alerts/Errors
    walletRejected: 'Cüzdan bağlantısı reddedildi.',
    metamaskNotFound: 'MetaMask cüzdanı bulunamadı.',
    enterUsername: 'Lütfen kullanıcı adı girin.',
    passkeyCreated: 'Biyometrik cüzdan başarıyla oluşturuldu!',
    loginSuccess: 'Giriş başarılı!',
    circleRegError: 'Circle Kayıt Hatası',
    circleLoginError: 'Circle Giriş Hata',
    errorPrefix: 'Hata',
    connectWalletFirst: 'Lütfen önce cüzdanınızı bağlayın.',
    selectFutureTime: 'Lütfen gelecek bir tarih ve saat seçin.',
    orderCreatedNoCancel: 'Emir <strong>#{orderId}</strong> başarıyla oluşturuldu.<br><br>Bu emir 24 saatten kısa süre içinde gönderileceğinden <strong>iptal edilemez.</strong>',
    orderCreatedWithCancel: 'Emir <strong>#{orderId}</strong> başarıyla planlandı.<br><br>İptal etmek isterseniz ilk <strong>24 saat</strong> içinde bu hakkı kullanabilirsiniz.',
    cancelExpired: '24 saatlik iptal süresi dolduğu için bu işlem artık geri alınamaz.',
    orderCancelledMsg: 'Emir <strong>#{id}</strong> iptal edildi ve kilitli fonlar cüzdanınıza iade edildi.',
    switchNetworkError: 'Lütfen cüzdanınızı ARC Testnet ağına geçirin.',
  },
  en: {
    serverStatus: 'Server Status',
    active: 'Active',
    offline: 'Offline',
    gasPool: 'Auto Gas Pool',
    gasPoolTooltip: 'Auto Gas Pool: The balance used to run scheduled operations automatically without paying gas from your wallet (paid by relayer).',
    smartWallet: 'Smart Wallet',
    metaMask: 'MetaMask',
    disconnect: 'Disconnect',
    connectMetaMask: 'Connect Wallet',
    biometricWallet: 'Passkey Wallet',
    scheduleNewTransfer: 'Schedule New Transfer',
    paymentCurrency: 'Payment Currency',
    receiverAddress: 'Receiver Wallet Address',
    amountToSend: 'Amount to Send',
    executeDateTime: 'Execution Date & Time (Future)',
    sendingTx: 'Sending Transaction...',
    lockAndSchedule: 'Lock & Schedule',
    scheduledOrders: 'Your Scheduled Orders',
    noOrders: 'No scheduled orders found yet.',
    cancellable: 'Cancellable',
    cancelTime: 'Cancellation Time',
    cancel: 'Cancel',
    locked: 'Locked',
    guaranteedLock: 'Guaranteed Lock Completed',
    shareCheque: 'Share Cheque Leaf',
    sent: 'Sent',
    cancelled: 'Cancelled',
    expired: 'Expired',
    receiver: 'Receiver',
    amount: 'Amount',
    date: 'Date',
    countdown: 'Countdown',
    txSuccess: 'Transaction Successful!',
    done: 'Done',
    warning: 'Warning!',
    warningMsg: 'You have scheduled your transfer to execute within <strong style="color: var(--primary)">less than 24 hours</strong>.<br><br>If you confirm, you <strong style="color: var(--danger)">will not have the chance to cancel it.</strong><br>Do you confirm?',
    discard: 'Cancel',
    yesLock: 'Yes, Lock',
    chequeTitle: 'PayWhen Blockchain Payment Cheque',
    lockedAndGuaranteed: '🔒 Locked & Guaranteed',
    protocolGuarantee: 'PayWhen Protocol Guarantee',
    chequeLabelSender: 'Sender (Wallet)',
    chequeLabelReceiver: 'Receiver (Wallet)',
    chequeLabelTime: 'Scheduled Execution Time',
    passkeyTitle: 'Passkey Wallet',
    passkeySimWarning: 'Since Circle Web3 Services API keys are not defined yet, this process will simulate the TouchID/FaceID flow by using the local browser WebAuthn API.',
    usernamePlaceholder: 'e.g. john@paywhen.xyz',
    createPasskey: 'Create New Passkey Wallet',
    loginPasskey: 'Login to Existing Wallet',
    usernameLabel: 'Username or Email',
    orderId: 'Order',
    loading: 'Loading...',
    
    // Alerts/Errors
    walletRejected: 'Wallet connection rejected.',
    metamaskNotFound: 'MetaMask wallet not found.',
    enterUsername: 'Please enter a username.',
    passkeyCreated: 'Passkey wallet successfully created!',
    loginSuccess: 'Login successful!',
    circleRegError: 'Circle Registration Error',
    circleLoginError: 'Circle Login Error',
    errorPrefix: 'Error',
    connectWalletFirst: 'Please connect your wallet first.',
    selectFutureTime: 'Please select a future date and time.',
    orderCreatedNoCancel: 'Order <strong>#{orderId}</strong> successfully created.<br><br>This order cannot be cancelled as it is scheduled within <strong>24 hours.</strong>',
    orderCreatedWithCancel: 'Order <strong>#{orderId}</strong> successfully scheduled.<br><br>If you want to cancel, you can do so within the first <strong>24 hours.</strong>',
    cancelExpired: 'This operation cannot be cancelled because the 24-hour cancellation window has expired.',
    orderCancelledMsg: 'Order <strong>#{id}</strong> cancelled and locked funds returned to your wallet.',
    switchNetworkError: 'Please switch your wallet to the ARC Testnet network.',
  }
};

interface Order {
  id: number;
  sender: string;
  receiver: string;
  amount: number;
  token_symbol: string;
  token_address: string;
  execute_at: number;
  created_at: number;
  status: 'pending' | 'executed' | 'cancelled';
}

export default function Home() {
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<'USDC' | 'EURC'>('USDC');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('0x8172189cCE9b68F94Ee23fB5077748495B85098F');
  const [receiverAddress, setReceiverAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [executeAt, setExecuteAt] = useState('');
  const [relayerGas, setRelayerGas] = useState('Yükleniyor...');
  const [serverStatus, setServerStatus] = useState<'active' | 'offline'>('active');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMsg, setSuccessModalMsg] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showChequeModal, setShowChequeModal] = useState(false);
  const [activeCheque, setActiveCheque] = useState<Order | null>(null);

  // Time ticker state (just used to trigger render tick for count downs)
  const [time, setTime] = useState(Date.now());

  // Load language preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('paywhen_lang') as 'tr' | 'en';
      if (savedLang === 'tr' || savedLang === 'en') {
        setLanguage(savedLang);
        setRelayerGas(savedLang === 'en' ? 'Loading...' : 'Yükleniyor...');
      }
    }
  }, []);

  const t = (key: keyof typeof translations.tr) => {
    return translations[language][key] || translations.tr[key] || '';
  };

  const handleLanguageChange = (lang: 'tr' | 'en') => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('paywhen_lang', lang);
    }
    if (relayerGas === 'Yükleniyor...' || relayerGas === 'Loading...') {
      setRelayerGas(lang === 'en' ? 'Loading...' : 'Yükleniyor...');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userAddress) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [userAddress]);

  const checkBackendStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.paywhen.xyz';
      const resp = await fetch(`${apiUrl}/api/status`);
      const data = await resp.json();
      setRelayerGas(`${parseFloat(data.relayerBalanceETH).toFixed(2)} USDC`);
      setServerStatus('active');
    } catch (e) {
      setRelayerGas('0.00 USDC');
      setServerStatus('offline');
    }
  };

  const fetchOrders = async () => {
    if (!userAddress) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.paywhen.xyz';
      const resp = await fetch(`${apiUrl}/api/orders?address=${userAddress.toLowerCase()}`);
      if (!resp.ok) throw new Error('API request failed');
      const data = await resp.json();
      setOrders(data as Order[]);
    } catch (e) {
      console.error('API fetch error, using local fallback:', e);
    }
  };

  const ensureArcTestnet = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return false;
    const ARC_TESTNET_HEX_ID = '0x4cee0a';
    try {
      const currentChainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      const chainIdDecimal = parseInt(currentChainId, 16);
      if (chainIdDecimal === 5042002) {
        return true;
      }

      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARC_TESTNET_HEX_ID }],
        });
        return true;
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: ARC_TESTNET_HEX_ID,
                  chainName: 'ARC Testnet',
                  nativeCurrency: {
                    name: 'ARC',
                    symbol: 'ARC',
                    decimals: 18,
                  },
                  rpcUrls: ['https://rpc.testnet.arc.network'],
                  blockExplorerUrls: ['https://explorer.testnet.arc.network'],
                },
              ],
            });
            return true;
          } catch (addError) {
            console.error('Error adding ARC network:', addError);
            return false;
          }
        }
        console.error('Error switching to ARC network:', switchError);
        return false;
      }
    } catch (e) {
      console.error('ensureArcTestnet error:', e);
      return false;
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const isCorrectNetwork = await ensureArcTestnet();
        if (!isCorrectNetwork) {
          alert(t('switchNetworkError'));
          return;
        }
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        setUserAddress(accounts[0]);
      } catch (err: any) {
        alert(t('walletRejected'));
      }
    } else {
      alert(t('metamaskNotFound'));
    }
  };

  const disconnectWallet = () => {
    setUserAddress(null);
  };

  const selectToken = (symbol: 'USDC' | 'EURC', address: string) => {
    setSelectedTokenSymbol(symbol);
    setSelectedTokenAddress(address);
    if (amount) {
      setAmount('');
    }
  };

  const scheduleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      alert(t('connectWalletFirst'));
      return;
    }

    const executeTime = new Date(executeAt).getTime();
    if (executeTime <= Date.now()) {
      alert(t('selectFutureTime'));
      return;
    }

    const msUntilExecution = executeTime - Date.now();
    if (msUntilExecution < 24 * 3600 * 1000) {
      setShowConfirmModal(true);
    } else {
      executeContractSchedule();
    }
  };

  const executeContractSchedule = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      const isCorrectNetwork = await ensureArcTestnet();
      if (!isCorrectNetwork) {
        alert(t('switchNetworkError'));
        setLoading(false);
        return;
      }

      let orderId = orders.length + 1;
      const executeTimeSec = Math.floor(new Date(executeAt).getTime() / 1000);

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const schedulerContract = new ethers.Contract(SCHEDULER_ADDRESS, SCHEDULER_ABI, signer);
      const tokenContract = new ethers.Contract(selectedTokenAddress, ERC20_ABI, signer);

      const parsedAmount = ethers.utils.parseUnits(amount, 6); // USDC/EURC has 6 decimals on ARC

      // Check allowance
      const currentAllowance = await tokenContract.allowance(userAddress!, SCHEDULER_ADDRESS);
      if (currentAllowance.lt(parsedAmount)) {
        console.log('Requesting token approval...');
        const approveTx = await tokenContract.approve(SCHEDULER_ADDRESS, parsedAmount);
        await approveTx.wait();
        console.log('Token approved successfully!');
      }

      console.log('Sending schedule order tx...');
      const scheduleTx = await schedulerContract.scheduleOrder(
        selectedTokenAddress,
        receiverAddress,
        parsedAmount,
        executeTimeSec
      );
      
      const receipt = await scheduleTx.wait();
      
      // Parse orderId from events
      const orderScheduledEvent = receipt.events?.find((x: any) => x.event === 'OrderScheduled');
      if (orderScheduledEvent && orderScheduledEvent.args) {
        orderId = orderScheduledEvent.args.orderId.toNumber();
      }

      const newOrder: Order = {
        id: orderId,
        sender: userAddress!.toLowerCase(),
        receiver: receiverAddress.toLowerCase(),
        amount: parseFloat(amount),
        token_symbol: selectedTokenSymbol,
        token_address: selectedTokenAddress,
        execute_at: executeTimeSec,
        created_at: Math.floor(Date.now() / 1000),
        status: 'pending'
      };

      // Save to SQLite via backend API
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.paywhen.xyz';
        await fetch(`${apiUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrder)
        });
      } catch (dbErr) {
        console.error('Database save error:', dbErr);
      }

      setOrders(prev => [newOrder, ...prev]);

      // Show success modal
      const within24 = (new Date(executeAt).getTime() - Date.now()) < 24 * 3600 * 1000;
      if (within24) {
        setSuccessModalMsg(t('orderCreatedNoCancel').replace('{orderId}', String(orderId)));
      } else {
        setSuccessModalMsg(t('orderCreatedWithCancel').replace('{orderId}', String(orderId)));
      }
      setShowSuccessModal(true);

      // Reset form
      setReceiverAddress('');
      setAmount('');
      setExecuteAt('');
    } catch (err: any) {
      console.error(err);
      alert(`${t('errorPrefix')}: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (id: number) => {
    const o = orders.find(x => x.id === id);
    if (!o) return;

    const isLockedImmediately = (o.execute_at - o.created_at) < 24 * 3600;
    if (isLockedImmediately) {
      alert(t('cancelExpired'));
      return;
    }

    const secondsElapsed = Math.floor(Date.now() / 1000) - o.created_at;
    if (secondsElapsed > 24 * 3600) {
      alert(t('cancelExpired'));
      return;
    }

    setLoading(true);
    try {
      const isCorrectNetwork = await ensureArcTestnet();
      if (!isCorrectNetwork) {
        alert(t('switchNetworkError'));
        setLoading(false);
        return;
      }

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const schedulerContract = new ethers.Contract(SCHEDULER_ADDRESS, SCHEDULER_ABI, signer);
      const tx = await schedulerContract.cancelOrder(id);
      await tx.wait();

      // Update SQLite status via backend API
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.paywhen.xyz';
        await fetch(`${apiUrl}/api/orders/${id}/cancel`, {
          method: 'POST'
        });
      } catch (dbErr) {
        console.error('Database cancel error:', dbErr);
      }

      setOrders(prev => prev.map(x => x.id === id ? { ...x, status: 'cancelled' } : x));
      setSuccessModalMsg(t('orderCancelledMsg').replace('{id}', String(id)));
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error(err);
      alert(`${t('errorPrefix')}: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const openCheque = (order: Order) => {
    setActiveCheque(order);
    setShowChequeModal(true);
  };

  return (
    <>
      {/* TOP BAR STATUS */}
      <div className="top-status-bar">
        <div className="container top-status-content">
          <div className="status-indicator">
            <span>{t('serverStatus')}:</span>
            {serverStatus === 'active' ? (
              <span style={{ color: 'var(--success)' }}>
                <i className="fa-solid fa-circle-check"></i> {t('active')}
              </span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>
                <i className="fa-solid fa-circle-xmark"></i> {t('offline')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div className="gas-info">
              <span>{t('gasPool')}:</span>
              <span className="gas-badge">{relayerGas}</span>
              <span className="tooltip" data-tooltip={t('gasPoolTooltip')}>
                <i className="fa-regular fa-circle-question"></i>
              </span>
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => handleLanguageChange(language === 'en' ? 'tr' : 'en')}
              title={language === 'en' ? 'Switch to Turkish' : 'English\'e geç'}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <span>{language === 'en' ? '🇬🇧' : '🇹🇷'}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.5px' }}>
                {language === 'en' ? 'EN' : 'TR'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <header>
        <div className="container header-content">
          <div className="logo">
            <span>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary)' }}></i> PayWhen
            </span>
            <span className="logo-badge">Scheduler</span>
          </div>
          
          {userAddress ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <i className="fa-solid fa-wallet" style={{ color: 'var(--accent)', marginRight: '6px' }}></i>
                Wallet Connected
              </span>
              <span className="gas-badge" style={{ fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--border)' }}>
                {userAddress.substring(0, 6)}...{userAddress.substring(38)}
              </span>
              <button className="btn btn-outline" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }} onClick={disconnectWallet}>
                <i className="fa-solid fa-right-from-bracket"></i> {t('disconnect')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={connectWallet}>
                <i className="fa-solid fa-wallet"></i> {t('connectMetaMask')}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        <div className="grid">
          {/* SCHEDULE PANEL */}
          <div className="panel">
            <h2 className="panel-title">
              <i className="fa-regular fa-calendar-plus" style={{ color: 'var(--primary)' }}></i> {t('scheduleNewTransfer')}
            </h2>

            <form onSubmit={scheduleTransferSubmit}>
              {/* Currency Selection */}
              <div className="form-group">
                <label>{t('paymentCurrency')}</label>
                <div className="token-selector">
                  <button
                    type="button"
                    className={`token-btn ${selectedTokenSymbol === 'USDC' ? 'active' : ''}`}
                    onClick={() =>
                      selectToken('USDC', '0x8172189cCE9b68F94Ee23fB5077748495B85098F')
                    }
                  >
                    USDC
                  </button>
                  <button
                    type="button"
                    className={`token-btn ${selectedTokenSymbol === 'EURC' ? 'active' : ''}`}
                    onClick={() =>
                      selectToken('EURC', '0xe2935B5077748495B85098F8172189cCE9b68F94')
                    }
                  >
                    EURC
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>{t('receiverAddress')}</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={receiverAddress}
                  onChange={e => setReceiverAddress(e.target.value)}
                  required
                />
              </div>

              {/* Amount Input */}
              <div className="form-group">
                <label>{t('amountToSend')}</label>
                <div className="input-wrapper">
                  <input
                    type="number"
                    step="0.0001"
                    placeholder={`0.0000 ${selectedTokenSymbol}`}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                  <span className="input-suffix">{selectedTokenSymbol}</span>
                </div>
              </div>

              <div className="form-group">
                <label>{t('executeDateTime')}</label>
                <input
                  type="datetime-local"
                  value={executeAt}
                  onChange={e => setExecuteAt(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <span>{t('sendingTx')}</span>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i> {t('lockAndSchedule')}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* SCHEDULED ORDERS LIST */}
          <div className="panel">
            <h2 className="panel-title">
              <i className="fa-solid fa-list-check" style={{ color: 'var(--primary)' }}></i> {t('scheduledOrders')}
            </h2>

            <div id="ordersList">
              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  {t('noOrders')}
                </div>
              ) : (
                orders.map(o => {
                  const timeStr = new Date(o.execute_at * 1000).toLocaleString();
                  const secondsLeft = o.execute_at - Math.floor(time / 1000);
                  const cancelTimeLeft = (o.created_at + 24 * 3600) - Math.floor(time / 1000);

                  const pad = (n: number) => String(n).padStart(2, '0');

                  let statusBadge = null;
                  let actionBtn = null;

                  if (o.status === 'pending') {
                    const isLockedImmediately = (o.execute_at - o.created_at) < 24 * 3600;
                    if (cancelTimeLeft > 0 && !isLockedImmediately) {
                      const absCancel = Math.abs(cancelTimeLeft);
                      const ch = Math.floor(absCancel / 3600);
                      const cm = Math.floor((absCancel % 3600) / 60);
                      const cs = absCancel % 60;
                      const cancelStr = `${pad(ch)}h${pad(cm)}m${pad(cs)}s`;

                      statusBadge = <span className="order-status status-pending">{t('cancellable')}</span>;
                      actionBtn = (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="cancel-countdown" style={{ fontSize: '11px' }}>
                            <i className="fa-regular fa-clock"></i> {t('cancelTime')}: {cancelStr}
                          </span>
                          <button className="btn btn-danger" onClick={() => cancelOrder(o.id)}>
                            <i className="fa-solid fa-xmark"></i> {t('cancel')}
                          </button>
                        </div>
                      );
                    } else {
                      statusBadge = (
                        <span className="order-status status-locked">
                          <i className="fa-solid fa-lock"></i> {t('locked')}
                        </span>
                      );
                      actionBtn = (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
                            <i className="fa-solid fa-shield-halved"></i> {t('guaranteedLock')}
                          </span>
                          <button className="btn btn-success" onClick={() => openCheque(o)}>
                            <i className="fa-solid fa-ticket"></i> {t('shareCheque')}
                          </button>
                        </div>
                      );
                    }
                  } else if (o.status === 'executed') {
                    statusBadge = <span className="order-status status-executed">{t('sent')}</span>;
                  } else {
                    statusBadge = <span className="order-status status-cancelled">{t('cancelled')}</span>;
                  }

                  // Seconds Left formatted countdown
                  let countdownText = t('expired');
                  if (secondsLeft > 0) {
                    const h = Math.floor(secondsLeft / 3600);
                    const m = Math.floor((secondsLeft % 3600) / 60);
                    const s = secondsLeft % 60;
                    countdownText = `${pad(h)}h${pad(m)}m${pad(s)}s`;
                  }

                  return (
                    <div className="order-item" key={o.id}>
                      <div className="order-header">
                        <span className="order-id">{t('orderId')} #{o.id}</span>
                        {statusBadge}
                      </div>
                      <div className="order-details">
                        <div>
                          <strong>{t('receiver')}:</strong> {o.receiver.substring(0, 8)}...
                        </div>
                        <div>
                          <strong>{t('amount')}:</strong> {o.amount} {o.token_symbol}
                        </div>
                        <div>
                          <strong>{t('date')}:</strong> {timeStr}
                        </div>
                        <div>
                          <strong>{t('countdown')}:</strong> <span className="countdown">{countdownText}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: '15px', textAlign: 'right' }}>{actionBtn}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="modal" style={{ display: 'flex', zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center', padding: '40px 35px' }}>
            <div style={{ width: '70px', height: '70px', background: 'rgba(16,185,129,0.15)', border: '2px solid var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px', color: 'var(--success)' }}>
              <i className="fa-solid fa-check"></i>
            </div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '22px', marginBottom: '10px', color: '#fff' }}>{t('txSuccess')}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.7, marginBottom: '25px' }} dangerouslySetInnerHTML={{ __html: successModalMsg }}></p>
            <button className="btn btn-primary" onClick={() => setShowSuccessModal(false)} style={{ maxWidth: '200px', margin: '0 auto' }}>
              <i className="fa-solid fa-check-double"></i> {t('done')}
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL (24h warning) */}
      {showConfirmModal && (
        <div className="modal" style={{ display: 'flex', zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '440px', textAlign: 'center', padding: '40px 35px' }}>
            <div style={{ width: '70px', height: '70px', background: 'rgba(245,158,11,0.15)', border: '2px solid var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px', color: 'var(--primary)' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '20px', marginBottom: '12px', color: '#fff' }}>{t('warning')}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.8, marginBottom: '28px' }} dangerouslySetInnerHTML={{ __html: t('warningMsg') }} />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowConfirmModal(false)} style={{ width: 'auto', padding: '10px 22px' }}>
                <i className="fa-solid fa-xmark"></i> {t('discard')}
              </button>
              <button className="btn btn-primary" onClick={executeContractSchedule} style={{ width: 'auto', padding: '10px 22px' }}>
                <i className="fa-solid fa-lock"></i> {t('yesLock')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHEQUE MODAL */}
      {showChequeModal && activeCheque && (
        <div className="modal" style={{ display: 'flex' }} onClick={e => e.target === e.currentTarget && setShowChequeModal(false)}>
          <div className="modal-content">
            <span className="close-modal" onClick={() => setShowChequeModal(false)}>&times;</span>
            <div className="cheque">
              <div className="cheque-header">
                <div className="cheque-title">
                  <i className="fa-solid fa-file-invoice-dollar"></i> {t('chequeTitle')}
                </div>
                <div className="cheque-no">
                  NO: PAYWHEN-{String(activeCheque.id).padStart(6, '0')}
                </div>
              </div>
              <div className="cheque-body">
                <div>
                  <div className="cheque-row">
                    <span className="cheque-label">{t('chequeLabelSender')}</span>
                    <span className="cheque-value">{activeCheque.sender}</span>
                  </div>
                  <div className="cheque-row">
                    <span className="cheque-label">{t('chequeLabelReceiver')}</span>
                    <span className="cheque-value">{activeCheque.receiver}</span>
                  </div>
                  <div className="cheque-row">
                    <span className="cheque-label">{t('chequeLabelTime')}</span>
                    <span className="cheque-value">{new Date(activeCheque.execute_at * 1000).toLocaleString()}</span>
                  </div>
                </div>
                <div className="cheque-amount-box">
                  {activeCheque.amount.toFixed(2)} {activeCheque.token_symbol}
                </div>
              </div>
              <div className="cheque-footer">
                <div className="cheque-status-stamp">{t('lockedAndGuaranteed')}</div>
                <div className="cheque-signature">
                  <div className="cheque-signature-line"></div>
                  <div>{t('protocolGuarantee')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
