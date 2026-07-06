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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://paywhen-api.knowledge-arena.xyz';
      const resp = await fetch(`${apiUrl}/api/status`);
      const data = await resp.json();
      setRelayerGas(`${parseFloat(data.relayerBalanceETH).toFixed(4)} ETH`);
      setServerStatus('active');
    } catch (e) {
      setRelayerGas('0.0000 ETH');
      setServerStatus('offline');
    }
  };

  const fetchOrders = async () => {
    if (!userAddress) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://paywhen-api.knowledge-arena.xyz';
      const resp = await fetch(`${apiUrl}/api/orders?address=${userAddress.toLowerCase()}`);
      if (!resp.ok) throw new Error('API request failed');
      const data = await resp.json();
      setOrders(data as Order[]);
    } catch (e) {
      console.error('API fetch error, using local fallback:', e);
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        setUserAddress(accounts[0]);
      } catch (err: any) {
        alert('Cüzdan bağlantısı reddedildi.');
      }
    } else {
      alert('MetaMask cüzdanı bulunamadı.');
    }
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
      alert('Lütfen önce cüzdanınızı bağlayın.');
      return;
    }

    const executeTime = new Date(executeAt).getTime();
    if (executeTime <= Date.now()) {
      alert('Lütfen gelecek bir tarih ve saat seçin.');
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
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const schedulerContract = new ethers.Contract(SCHEDULER_ADDRESS, SCHEDULER_ABI, signer);
      const tokenContract = new ethers.Contract(selectedTokenAddress, ERC20_ABI, signer);

      const parsedAmount = ethers.utils.parseUnits(amount, 6); // USDC/EURC has 6 decimals on ARC
      const executeTimeSec = Math.floor(new Date(executeAt).getTime() / 1000);

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
      let orderId = orders.length + 1;
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://paywhen-api.knowledge-arena.xyz';
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
        setSuccessModalMsg(`Emir <strong>#${orderId}</strong> başarıyla oluşturuldu.<br><br>Bu emir 24 saatten kısa süre içinde gönderileceğinden <strong>iptal edilemez.</strong>`);
      } else {
        setSuccessModalMsg(`Emir <strong>#${orderId}</strong> başarıyla planlandı.<br><br>İptal etmek isterseniz ilk <strong>24 saat</strong> içinde bu hakkı kullanabilirsiniz.`);
      }
      setShowSuccessModal(true);

      // Reset form
      setReceiverAddress('');
      setAmount('');
      setExecuteAt('');
    } catch (err: any) {
      console.error(err);
      alert(`Hata: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (id: number) => {
    const o = orders.find(x => x.id === id);
    if (!o) return;

    const secondsElapsed = Math.floor(Date.now() / 1000) - o.created_at;
    if (secondsElapsed > 24 * 3600) {
      alert('24 saatlik iptal süresi dolduğu için bu işlem artık geri alınamaz.');
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const schedulerContract = new ethers.Contract(SCHEDULER_ADDRESS, SCHEDULER_ABI, signer);
      const tx = await schedulerContract.cancelOrder(id);
      await tx.wait();

      // Update SQLite status via backend API
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://paywhen-api.knowledge-arena.xyz';
        await fetch(`${apiUrl}/api/orders/${id}/cancel`, {
          method: 'POST'
        });
      } catch (dbErr) {
        console.error('Database cancel error:', dbErr);
      }

      setOrders(prev => prev.map(x => x.id === id ? { ...x, status: 'cancelled' } : x));
      setSuccessModalMsg(`Emir <strong>#${id}</strong> iptal edildi ve kilitli fonlar cüzdanınıza iade edildi.`);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error(err);
      alert(`Hata: ${err.message || err}`);
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
            <span>Sunucu Durumu:</span>
            {serverStatus === 'active' ? (
              <span style={{ color: 'var(--success)' }}>
                <i className="fa-solid fa-circle-check"></i> Aktif
              </span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>
                <i className="fa-solid fa-circle-xmark"></i> Çevrimdışı
              </span>
            )}
          </div>
          <div className="gas-info">
            <span>Otomatik Gas Havuzu:</span>
            <span className="gas-badge">{relayerGas}</span>
            <span className="tooltip" title="Otomatik Gas Havuzu: Geleceğe dönük planlanan işlemlerin, cüzdanınızdan gas ücreti harcamadan sistem (relayer) tarafından otomatik çalıştırılmasını sağlayan bakiyedir.">
              <i className="fa-regular fa-circle-question"></i>
            </span>
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
          <button className="btn btn-outline" style={{ width: 'auto' }} onClick={connectWallet}>
            <i className="fa-solid fa-wallet"></i>{' '}
            {userAddress
              ? `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`
              : 'Cüzdan Bağla'}
          </button>
        </div>
      </header>

      <main className="container">
        <div className="grid">
          {/* SCHEDULE PANEL */}
          <div className="panel">
            <h2 className="panel-title">
              <i className="fa-regular fa-calendar-plus" style={{ color: 'var(--primary)' }}></i> Yeni Transfer Planla
            </h2>

            <form onSubmit={scheduleTransferSubmit}>
              {/* Currency Selection */}
              <div className="form-group">
                <label>Ödeme Para Birimi</label>
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
                <label>Alıcı Cüzdan Adresi (Receiver)</label>
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
                <label>Gönderilecek Miktar</label>
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
                <label>Gönderim Tarihi & Saati (Gelecek Zaman)</label>
                <input
                  type="datetime-local"
                  value={executeAt}
                  onChange={e => setExecuteAt(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <span>İşlem Gönderiliyor...</span>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i> Kilitle ve Planla
                  </>
                )}
              </button>
            </form>
          </div>

          {/* SCHEDULED ORDERS LIST */}
          <div className="panel">
            <h2 className="panel-title">
              <i className="fa-solid fa-list-check" style={{ color: 'var(--primary)' }}></i> Planlanmış Emirleriniz
            </h2>

            <div id="ordersList">
              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  Henüz planlanmış bir emir bulunmuyor.
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
                    if (cancelTimeLeft > 0) {
                      const absCancel = Math.abs(cancelTimeLeft);
                      const ch = Math.floor(absCancel / 3600);
                      const cm = Math.floor((absCancel % 3600) / 60);
                      const cs = absCancel % 60;
                      const cancelStr = `${pad(ch)}h${pad(cm)}m${pad(cs)}s`;

                      statusBadge = <span className="order-status status-pending">İptal Edilebilir</span>;
                      actionBtn = (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="cancel-countdown" style={{ fontSize: '11px' }}>
                            <i className="fa-regular fa-clock"></i> İptal Süresi: {cancelStr}
                          </span>
                          <button className="btn btn-danger" onClick={() => cancelOrder(o.id)}>
                            <i className="fa-solid fa-xmark"></i> İptal Et
                          </button>
                        </div>
                      );
                    } else {
                      statusBadge = (
                        <span className="order-status status-locked">
                          <i className="fa-solid fa-lock"></i> Geri Dönüşsüz
                        </span>
                      );
                      actionBtn = (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
                            <i className="fa-solid fa-shield-halved"></i> Garantili Kilitleme Tamamlandı
                          </span>
                          <button className="btn btn-success" onClick={() => openCheque(o)}>
                            <i className="fa-solid fa-ticket"></i> Çek Yaprağı Paylaş
                          </button>
                        </div>
                      );
                    }
                  } else if (o.status === 'executed') {
                    statusBadge = <span className="order-status status-executed">Gönderildi</span>;
                  } else {
                    statusBadge = <span className="order-status status-cancelled">İptal Edildi</span>;
                  }

                  // Seconds Left formatted countdown
                  let countdownText = 'Süre doldu';
                  if (secondsLeft > 0) {
                    const h = Math.floor(secondsLeft / 3600);
                    const m = Math.floor((secondsLeft % 3600) / 60);
                    const s = secondsLeft % 60;
                    countdownText = `${pad(h)}h${pad(m)}m${pad(s)}s`;
                  }

                  return (
                    <div className="order-item" key={o.id}>
                      <div className="order-header">
                        <span className="order-id">Emir #{o.id}</span>
                        {statusBadge}
                      </div>
                      <div className="order-details">
                        <div>
                          <strong>Alıcı:</strong> {o.receiver.substring(0, 8)}...
                        </div>
                        <div>
                          <strong>Miktar:</strong> {o.amount} {o.token_symbol}
                        </div>
                        <div>
                          <strong>Tarih:</strong> {timeStr}
                        </div>
                        <div>
                          <strong>Sayaç:</strong> <span className="countdown">{countdownText}</span>
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
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '22px', marginBottom: '10px', color: '#fff' }}>İşlem Başarılı!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.7, marginBottom: '25px' }} dangerouslySetInnerHTML={{ __html: successModalMsg }}></p>
            <button className="btn btn-primary" onClick={() => setShowSuccessModal(false)} style={{ maxWidth: '200px', margin: '0 auto' }}>
              <i className="fa-solid fa-check-double"></i> Tamam
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
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '20px', marginBottom: '12px', color: '#fff' }}>Dikkat!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.8, marginBottom: '28px' }}>
              Gönderinizi <strong style={{ color: 'var(--primary)' }}>24 saatten kısa</strong> bir süre içinde gerçekleşecek şekilde planladınız.
              <br />
              <br />
              Gönderimi onayladığınız takdirde <strong style={{ color: 'var(--danger)' }}>iptal etme şansınız olmayacak.</strong>
              <br />
              Onaylıyor musunuz?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowConfirmModal(false)} style={{ width: 'auto', padding: '10px 22px' }}>
                <i className="fa-solid fa-xmark"></i> Vazgeç
              </button>
              <button className="btn btn-primary" onClick={executeContractSchedule} style={{ width: 'auto', padding: '10px 22px' }}>
                <i className="fa-solid fa-lock"></i> Evet, Kilitle
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
                  <i className="fa-solid fa-file-invoice-dollar"></i> PayWhen Blokzincir Ödeme Çeki
                </div>
                <div className="cheque-no">
                  NO: PAYWHEN-{String(activeCheque.id).padStart(6, '0')}
                </div>
              </div>
              <div className="cheque-body">
                <div>
                  <div className="cheque-row">
                    <span className="cheque-label">Gönderen (Cüzdan)</span>
                    <span className="cheque-value">{activeCheque.sender}</span>
                  </div>
                  <div className="cheque-row">
                    <span className="cheque-label">Alıcı (Receiver)</span>
                    <span className="cheque-value">{activeCheque.receiver}</span>
                  </div>
                  <div className="cheque-row">
                    <span className="cheque-label">Planlanan Gönderim Zamanı</span>
                    <span className="cheque-value">{new Date(activeCheque.execute_at * 1000).toLocaleString()}</span>
                  </div>
                </div>
                <div className="cheque-amount-box">
                  {activeCheque.amount.toFixed(2)} {activeCheque.token_symbol}
                </div>
              </div>
              <div className="cheque-footer">
                <div className="cheque-status-stamp">🔒 Kilitli ve Garantili</div>
                <div className="cheque-signature">
                  <div className="cheque-signature-line"></div>
                  <div>PayWhen Protokolü Garantisi</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
