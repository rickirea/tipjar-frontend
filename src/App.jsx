import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { QRCodeSVG } from 'qrcode.react';
import idl from './idl.json';
import { BN } from 'bn.js';
import { Buffer } from 'buffer';
import './App.css';

const { SystemProgram } = web3;

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection } = useConnection();
  const wallet = useWallet();

  // Estados de vista y datos
  const [currentView, setCurrentView] = useState('home');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [amount, setAmount] = useState(0.01);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('success'); // 'success', 'error', 'warning'
  const [isLoading, setIsLoading] = useState(false);

  // Datos
  const [userProfile, setUserProfile] = useState(null);
  const [tipjarStats, setTipjarStats] = useState(null);
  const [platformStats, setPlatformStats] = useState(null);
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(true);
  const [availableFees, setAvailableFees] = useState(0);

  // Funciones
  const getProvider = useCallback(
    () => new AnchorProvider(connection, wallet, {}),
    [connection, wallet]
  );
  const getProgram = useCallback(
    () => new Program(idl, getProvider()),
    [getProvider]
  );

  // PDAs
  const getPlatformPDA = () => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('platform-v4')],
      programId
    );
    return pda;
  };

  const getPlatformVaultPDA = () => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('platform-vault-v4')],
      programId
    );
    return pda;
  };

  const getUserProfilePDA = (username) => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('profile-v4'), Buffer.from(username)],
      programId
    );
    return pda;
  };

  const getTipJarPDA = (username) => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('tipjar-v4'), Buffer.from(username)],
      programId
    );
    return pda;
  };

  // Fetch functions
  const fetchPlatformStats = useCallback(async () => {
    setIsLoadingPlatform(true);
    try {
      const program = getProgram();
      const platformPDA = getPlatformPDA();
      const vaultPDA = getPlatformVaultPDA();

      // Fetch platform account
      const account = await program.account.platform.fetch(platformPDA);
      setPlatformStats(account);

      // Fetch actual balance from vault
      const vaultInfo = await connection.getAccountInfo(vaultPDA);
      const vaultBalance = vaultInfo ? vaultInfo.lamports : 0;
      const rentExemption = await connection.getMinimumBalanceForRentExemption(
        8 + 8
      );
      const available = vaultBalance - rentExemption;
      setAvailableFees(Math.max(0, available));
    } catch {
      console.log('Platform not initialized');
      setPlatformStats(null);
    } finally {
      setIsLoadingPlatform(false);
    }
  }, [getProgram, connection]);

  const fetchUserProfile = useCallback(
    async (username) => {
      try {
        const program = getProgram();
        const profilePDA = getUserProfilePDA(username);
        const profile = await program.account.userProfile.fetch(profilePDA);
        setUserProfile(profile);
        return profile;
      } catch (err) {
        console.error('Error fetching profile:', err);
        if (err.message.includes('does not exist')) {
          setStatus(`User @${username} not found`);
          setStatusType('error');
          setTimeout(() => setStatus(''), 5000);
        }
        return null;
      }
    },
    [getProgram]
  );

  const fetchTipJarStats = useCallback(
    async (username) => {
      try {
        const program = getProgram();
        const tipjarPDA = getTipJarPDA(username);
        const tipjar = await program.account.tipJar.fetch(tipjarPDA);

        // Obtener el balance real del PDA
        const accountInfo = await connection.getAccountInfo(tipjarPDA);
        const realBalance = accountInfo ? accountInfo.lamports : 0;

        // Calcular rent exemption (space = discriminator + authority + username + total_tips + total_amount + total_withdrawals + platform_fees_paid)
        const accountSpace = 8 + 32 + 4 + 20 + 8 + 8 + 8 + 8; // discriminator + authority + username (Vec<u8>) + total_tips + total_amount + total_withdrawals + platform_fees_paid
        const rentExemption =
          await connection.getMinimumBalanceForRentExemption(accountSpace);

        // Balance disponible = balance real - rent exemption
        const availableBalance = Math.max(0, realBalance - rentExemption);

        // Combinar los datos del account con el balance disponible
        const statsWithBalance = {
          ...tipjar,
          realBalance: realBalance, // Balance real en lamports
          rentExemption: rentExemption, // Rent exemption en lamports
          availableBalance: availableBalance, // Balance disponible en lamports
          availableBalanceSOL: availableBalance / web3.LAMPORTS_PER_SOL, // Balance disponible en SOL
        };

        setTipjarStats(statsWithBalance);
        return statsWithBalance;
      } catch (err) {
        console.error('Error fetching tipjar:', err);
        return null;
      }
    },
    [getProgram, connection]
  );

  // Actions
  const initializePlatform = async () => {
    if (!wallet.publicKey) {
      return alert('Please connect your wallet first');
    }
    try {
      setIsLoading(true);
      setStatus('Initializing platform...');
      const program = getProgram();
      const platformPDA = getPlatformPDA();
      const vaultPDA = getPlatformVaultPDA();

      await program.methods
        .initializePlatform(wallet.publicKey, new BN(300))
        .accounts({
          platform: platformPDA,
          platformVault: vaultPDA,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStatus('Platform initialized successfully! 🚀');
      setStatusType('success');
      setTimeout(() => setStatus(''), 5000);

      // Forzar actualización de la UI inmediatamente
      await fetchPlatformStats();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setStatusType('error');
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async () => {
    if (!wallet.publicKey || username.length < 3) return;

    // Verificar saldo antes de intentar registrar
    const balance = await connection.getBalance(wallet.publicKey);
    const minBalance = 50000000; // ~0.05 SOL en lamports
    if (balance < minBalance) {
      setStatus(
        `Insufficient balance. You need at least ${(
          minBalance / web3.LAMPORTS_PER_SOL
        ).toFixed(4)} SOL to register. Current balance: ${(
          balance / web3.LAMPORTS_PER_SOL
        ).toFixed(4)} SOL`
      );
      setStatusType('error');
      setTimeout(() => setStatus(''), 8000);
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Registering...');
      const program = getProgram();
      const profilePDA = getUserProfilePDA(username);
      const tipjarPDA = getTipJarPDA(username);
      const platformPDA = getPlatformPDA();

      await program.methods
        .registerUser(username, displayName || username)
        .accounts({
          userProfile: profilePDA,
          tipjar: tipjarPDA,
          platform: platformPDA,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const registeredUsername = username;

      // Guardar el username en localStorage para auto-load futuro
      if (wallet.publicKey) {
        localStorage.setItem(
          `creator_${wallet.publicKey.toString()}`,
          registeredUsername
        );
      }

      // Redirigir al perfil del creador recién creado
      setUsername(registeredUsername); // Establecer el username para la vista de usuario
      setCurrentView('user');

      // Fetch el perfil y stats
      const profile = await fetchUserProfile(registeredUsername);
      if (profile) await fetchTipJarStats(registeredUsername);

      setStatus(`User @${registeredUsername} registered successfully! 🎉`);
      setStatusType('success');
      setTimeout(() => setStatus(''), 5000);
    } catch (err) {
      let errorMessage = err.message;

      // Mejorar mensajes de error comunes
      if (
        err.message.includes('Attempt to debit an account but found no record')
      ) {
        errorMessage =
          'Insufficient balance. You need at least 0.05 SOL to create an account. Please add funds to your wallet.';
      } else if (err.message.includes('InsufficientFunds')) {
        errorMessage = 'Insufficient balance for this transaction.';
      } else if (err.message.includes('UsernameTooShort')) {
        errorMessage = 'Username must be at least 3 characters long.';
      } else if (err.message.includes('UsernameTooLong')) {
        errorMessage = 'Username must be at most 20 characters long.';
      } else if (err.message.includes('InvalidUsername')) {
        errorMessage = 'Username must contain only alphanumeric characters.';
      }

      setStatus(`Error: ${errorMessage}`);
      setStatusType('error');
      setTimeout(() => setStatus(''), 8000);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTipToUser = async (receiverUsername) => {
    if (!wallet.publicKey) {
      setStatus('Please connect your wallet to send tips');
      setStatusType('warning');
      setTimeout(() => setStatus(''), 5000);
      return;
    }
    if (!senderName) {
      setStatus('Please enter your name');
      setStatusType('error');
      setTimeout(() => setStatus(''), 5000);
      return;
    }
    try {
      setIsLoading(true);
      setStatus('Sending tip...');
      setStatusType('success');
      const program = getProgram();
      const platformPDA = getPlatformPDA();
      const vaultPDA = getPlatformVaultPDA();
      const profilePDA = getUserProfilePDA(receiverUsername);
      const tipjarPDA = getTipJarPDA(receiverUsername);
      const tipKeypair = web3.Keypair.generate();

      await program.methods
        .sendTipToUser(
          receiverUsername,
          senderName,
          new BN(amount * web3.LAMPORTS_PER_SOL)
        )
        .accounts({
          platform: platformPDA,
          platformVault: vaultPDA,
          userProfile: profilePDA,
          tipjar: tipjarPDA,
          tip: tipKeypair.publicKey,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([tipKeypair])
        .rpc();

      console.log('Tip sent! Refreshing data...');

      // Mostrar success message inmediatamente
      setStatus(`Tip sent successfully to @${receiverUsername}! 🎉`);
      setStatusType('success');

      // Limpiar campos
      setSenderName('');
      setAmount(0.01);

      // Refrescar todos los datos en paralelo
      try {
        await Promise.all([
          fetchTipJarStats(receiverUsername),
          fetchUserProfile(receiverUsername),
          fetchPlatformStats(),
        ]);
        console.log('Data refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing data:', refreshError);
        // No mostrar error al usuario, la transacción fue exitosa
      }

      setTimeout(() => setStatus(''), 5000);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setStatusType('error');
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const withdrawUserFunds = async (username) => {
    if (!wallet.publicKey) return;
    try {
      setIsLoading(true);
      setStatus('Withdrawing...');
      const program = getProgram();
      const tipjarPDA = getTipJarPDA(username);
      const accountInfo = await connection.getAccountInfo(tipjarPDA);
      const balance = accountInfo ? accountInfo.lamports : 0;
      const rentExempt = await connection.getMinimumBalanceForRentExemption(
        accountInfo ? accountInfo.data.length : 56
      );
      const withdrawableAmount = Math.max(0, balance - rentExempt);

      await program.methods
        .withdrawUserFunds(username, new BN(withdrawableAmount))
        .accounts({
          tipjar: tipjarPDA,
          authority: wallet.publicKey,
        })
        .rpc();

      setStatus(`Funds withdrawn successfully! 💰`);
      setStatusType('success');
      await fetchTipJarStats(username);
      setTimeout(() => setStatus(''), 5000);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setStatusType('error');
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const withdrawPlatformFees = async () => {
    if (!wallet.publicKey || !platformStats) return;
    if (wallet.publicKey.toString() !== platformStats.owner.toString()) {
      setStatus('Only platform owner can withdraw fees!');
      setStatusType('error');
      setTimeout(() => setStatus(''), 5000);
      return;
    }
    try {
      setIsLoading(true);
      setStatus('Checking balance...');
      const program = getProgram();
      const platformPDA = getPlatformPDA();
      const vaultPDA = getPlatformVaultPDA();
      const accountInfo = await connection.getAccountInfo(vaultPDA);
      const balance = accountInfo ? accountInfo.lamports : 0;

      if (balance === 0) {
        setStatus('No fees available to withdraw!');
        setStatusType('warning');
        setTimeout(() => setStatus(''), 5000);
        return;
      }

      // Calculamos el withdrawable amount (balance - rent exemption)
      const rentExemption = await connection.getMinimumBalanceForRentExemption(
        8 + 8
      ); // discriminator + total_fees
      const withdrawableAmount = balance - rentExemption;

      if (withdrawableAmount <= 0) {
        setStatus('Insufficient balance to withdraw (need to maintain rent)!');
        setStatusType('warning');
        setTimeout(() => setStatus(''), 5000);
        return;
      }

      setStatus('Withdrawing platform fees...');
      setStatusType('success');

      await program.methods
        .withdrawPlatformFees(new BN(withdrawableAmount))
        .accounts({
          platform: platformPDA,
          platformVault: vaultPDA,
          authority: wallet.publicKey,
        })
        .rpc();

      setStatus(
        `Successfully withdrew ${(
          withdrawableAmount / web3.LAMPORTS_PER_SOL
        ).toFixed(4)} SOL! 🎉`
      );
      setStatusType('success');
      await fetchPlatformStats();
      setTimeout(() => setStatus(''), 5000);
    } catch (err) {
      console.error('Withdraw error:', err);
      if (err.message.includes('already been processed')) {
        setStatus('Transaction was already processed');
        setStatusType('warning');
      } else {
        setStatus(`Error: ${err.message}`);
        setStatusType('error');
      }
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const viewUser = async (user) => {
    if (!user) return;
    if (!wallet.publicKey) {
      setStatus(
        'Please connect your wallet to view creator profiles and send tips'
      );
      setStatusType('warning');
      setTimeout(() => setStatus(''), 5000);
      return;
    }
    setUsername(user);
    setCurrentView('user');
    const profile = await fetchUserProfile(user);
    if (profile) await fetchTipJarStats(user);
  };

  useEffect(() => {
    // Verificar plataforma siempre, incluso sin wallet conectada
    fetchPlatformStats();
  }, [fetchPlatformStats]);

  // Detectar URLs dinámicas como /@username
  useEffect(() => {
    const urlPath = location.pathname;
    const match = urlPath.match(/^\/@([a-zA-Z0-9_]+)$/);

    if (match && match[1]) {
      const urlUsername = match[1];

      // Si la URL tiene un username pero el usuario actual es diferente
      if (username !== urlUsername || currentView !== 'user') {
        const loadUserFromUrl = async () => {
          try {
            const profile = await fetchUserProfile(urlUsername);
            if (profile) {
              setUsername(urlUsername);
              setCurrentView('user');
              await fetchTipJarStats(urlUsername);
            } else {
              // Usuario no encontrado, volver al home
              setStatus(`User @${urlUsername} not found`);
              setStatusType('error');
              setTimeout(() => setStatus(''), 5000);
              navigate('/');
              setCurrentView('home');
            }
          } catch (err) {
            console.error('Error loading user from URL:', err);
          }
        };
        loadUserFromUrl();
      }
    }
  }, [
    location.pathname,
    username,
    currentView,
    fetchUserProfile,
    fetchTipJarStats,
    navigate,
  ]);

  // Auto-navegar a su perfil cuando se conecta el wallet y es un creador
  // SOLO si NO hay una URL dinámica activa
  useEffect(() => {
    const checkAndLoadCreator = async () => {
      if (!wallet.publicKey || !platformStats) return;

      // Verificar si hay una URL dinámica activa
      const urlPath = location.pathname;
      const hasDynamicUrl = urlPath.match(/^\/@([a-zA-Z0-9_]+)$/);

      // Si hay una URL dinámica, NO auto-redirigir
      if (hasDynamicUrl) return;

      // Verificar si hay un username guardado para este wallet
      const storedUsername = localStorage.getItem(
        `creator_${wallet.publicKey.toString()}`
      );

      if (storedUsername && currentView === 'home') {
        // Este wallet es un creador conocido, cargar su perfil
        const profile = await fetchUserProfile(storedUsername);
        if (profile) {
          setUsername(storedUsername);
          setCurrentView('user');
          await fetchTipJarStats(storedUsername);
        }
      }
    };

    checkAndLoadCreator();
  }, [
    wallet.publicKey,
    platformStats,
    currentView,
    location.pathname,
    fetchUserProfile,
    fetchTipJarStats,
  ]);

  // Permisos y roles - calcular siempre que cambien los datos
  const isOwner =
    platformStats &&
    wallet.publicKey &&
    wallet.publicKey.toString() === platformStats.owner.toString();

  const isCreator =
    userProfile &&
    wallet.publicKey &&
    userProfile.authority &&
    wallet.publicKey.toString() === userProfile.authority.toString();

  // Debug: Log para verificar permisos
  useEffect(() => {
    if (userProfile && wallet.publicKey) {
      console.log('Wallet:', wallet.publicKey.toString());
      console.log('Profile Authority:', userProfile.authority?.toString());
      console.log(
        'Is Creator:',
        wallet.publicKey.toString() === userProfile.authority?.toString()
      );
    }
  }, [userProfile, wallet.publicKey]);

  return (
    <div
      className='app'
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <header
        style={{
          padding: 20,
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            💎 TipJar Platform
          </h1>
          <WalletMultiButton />
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>
        {status && (
          <div
            style={{
              padding: 16,
              background:
                statusType === 'success'
                  ? 'rgba(46, 213, 115, 0.2)'
                  : statusType === 'error'
                  ? 'rgba(235, 77, 75, 0.2)'
                  : 'rgba(255, 193, 7, 0.2)',
              borderRadius: 12,
              marginBottom: 24,
              border: `1px solid ${
                statusType === 'success'
                  ? '#2ed573'
                  : statusType === 'error'
                  ? '#eb4d4b'
                  : '#ffc107'
              }`,
              color: 'white',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{status}</span>
            <button
              onClick={() => setStatus('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: 20,
                cursor: 'pointer',
                padding: '0 8px',
              }}
            >
              ×
            </button>
          </div>
        )}

        {currentView === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>
                Welcome
              </h2>
              <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)' }}>
                Support creators with tips
              </p>
            </div>

            {isLoadingPlatform ? (
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  padding: 32,
                  textAlign: 'center',
                }}
              >
                <p>Loading platform...</p>
              </div>
            ) : !platformStats ? (
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  padding: 32,
                  textAlign: 'center',
                }}
              >
                <h3>Setup Required</h3>
                <p style={{ margin: '20px 0' }}>Initialize the platform</p>
                <div>
                  <button
                    onClick={initializePlatform}
                    disabled={isLoading || !wallet.connected}
                    style={{
                      padding: '12px 32px',
                      background:
                        isLoading || !wallet.connected
                          ? 'rgba(255,255,255,0.1)'
                          : '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor:
                        isLoading || !wallet.connected
                          ? 'not-allowed'
                          : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Initialize Platform
                  </button>
                  {!wallet.connected && (
                    <p style={{ marginTop: 12, fontSize: 14, opacity: 0.8 }}>
                      Connect your wallet to initialize the platform
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Platform Stats - Solo visible para admin y no-payers */}
            {platformStats && (isOwner || !wallet.publicKey) && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 32,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}
                >
                  <h3>Platform Stats</h3>
                  {isOwner && (
                    <button
                      onClick={withdrawPlatformFees}
                      disabled={isLoading}
                      style={{
                        padding: '8px 16px',
                        background: '#f39c12',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      💰 Withdraw Fees (Admin Only)
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 20,
                  }}
                >
                  <div>
                    <div
                      style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}
                    >
                      Fee
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                      {platformStats.feePercentage / 100}%
                    </div>
                  </div>
                  <div>
                    <div
                      style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}
                    >
                      Users
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                      {platformStats.totalUsers.toString()}
                    </div>
                  </div>
                  {isOwner && (
                    <div>
                      <div
                        style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}
                      >
                        Available to Withdraw
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>
                        {(availableFees / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: 24,
                marginBottom: 32,
              }}
            >
              <h3 style={{ marginBottom: 16 }}>Search Creator</h3>
              {!platformStats && !isLoadingPlatform && (
                <p
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: 'rgba(255, 193, 7, 0.2)',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 193, 7, 0.5)',
                    fontSize: 14,
                  }}
                >
                  ⚠️ Platform must be initialized before searching creators
                </p>
              )}
              {platformStats && !wallet.publicKey && (
                <p
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: 'rgba(255, 193, 7, 0.2)',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 193, 7, 0.5)',
                    fontSize: 14,
                  }}
                >
                  ⚠️ Connect your wallet to search creators and send tips
                </p>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type='text'
                  placeholder='Username'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => {
                    if (
                      e.key === 'Enter' &&
                      username &&
                      platformStats &&
                      wallet.publicKey
                    )
                      viewUser(username);
                  }}
                  disabled={!platformStats}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 8,
                    color: 'white',
                    opacity: platformStats ? 1 : 0.5,
                  }}
                />
                <button
                  onClick={() => viewUser(username)}
                  disabled={!username || !platformStats || !wallet.publicKey}
                  style={{
                    padding: '12px 24px',
                    background:
                      username && platformStats && wallet.publicKey
                        ? '#667eea'
                        : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor:
                      username && platformStats && wallet.publicKey
                        ? 'pointer'
                        : 'not-allowed',
                    fontWeight: 600,
                  }}
                >
                  Search
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 20,
              }}
            >
              <button
                onClick={() => {
                  if (!platformStats) {
                    setStatus(
                      'Platform must be initialized before creating accounts'
                    );
                    setStatusType('warning');
                    setTimeout(() => setStatus(''), 5000);
                    return;
                  }
                  if (!wallet.publicKey) {
                    setStatus('Connect your wallet to create an account');
                    setStatusType('warning');
                    setTimeout(() => setStatus(''), 5000);
                    return;
                  }
                  setCurrentView('register');
                }}
                disabled={!platformStats || !wallet.publicKey}
                style={{
                  padding: 20,
                  background:
                    platformStats && wallet.publicKey
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  color: 'white',
                  cursor:
                    platformStats && wallet.publicKey
                      ? 'pointer'
                      : 'not-allowed',
                  fontWeight: 600,
                  opacity: platformStats && wallet.publicKey ? 1 : 0.5,
                }}
              >
                ➕ Create Account
              </button>
              <button
                disabled={!wallet.publicKey}
                style={{
                  padding: 20,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  opacity: wallet.publicKey ? 1 : 0.5,
                }}
              >
                📊 Dashboard
              </button>
            </div>
          </div>
        )}

        {currentView === 'register' && (
          <div>
            <button
              onClick={() => setCurrentView('home')}
              style={{ marginBottom: 20 }}
            >
              ← Back
            </button>
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: 32,
              }}
            >
              <h2>Create Account</h2>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  marginTop: 24,
                }}
              >
                <input
                  type='text'
                  placeholder='Username'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    padding: 12,
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 8,
                    color: 'white',
                  }}
                />
                <input
                  type='text'
                  placeholder='Display Name'
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    padding: 12,
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 8,
                    color: 'white',
                  }}
                />
                <button
                  onClick={registerUser}
                  disabled={
                    isLoading || !wallet.connected || username.length < 3
                  }
                  style={{
                    padding: 14,
                    background:
                      isLoading || !wallet.connected || username.length < 3
                        ? 'rgba(255,255,255,0.1)'
                        : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor:
                      isLoading || !wallet.connected || username.length < 3
                        ? 'not-allowed'
                        : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {isLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'user' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => setCurrentView('home')}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ← Back to Home
              </button>
              {isCreator && (
                <button
                  onClick={() => {
                    // Reload current user data
                    fetchTipJarStats(username);
                    fetchUserProfile(username);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#2ed573',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  🔄 Refresh My Balance
                </button>
              )}
            </div>
            {userProfile && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <h1 style={{ fontSize: 42 }}>@{userProfile.username}</h1>
                  <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>
                    {userProfile.displayName}
                  </p>
                </div>

                {tipjarStats && (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      padding: 24,
                      marginBottom: 32,
                    }}
                  >
                    <h3>Public Stats</h3>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isCreator ? '1fr 1fr' : '1fr',
                        gap: 24,
                        marginTop: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 14,
                          }}
                        >
                          Total Tips Received
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 700 }}>
                          {tipjarStats.totalTips.toString()}
                        </div>
                      </div>
                      {/* Solo el creador ve el monto */}
                      {isCreator && (
                        <div>
                          <div
                            style={{
                              color: 'rgba(255,255,255,0.7)',
                              fontSize: 14,
                            }}
                          >
                            Total Earned
                          </div>
                          <div style={{ fontSize: 32, fontWeight: 700 }}>
                            {tipjarStats.availableBalanceSOL !== undefined
                              ? tipjarStats.availableBalanceSOL.toFixed(4)
                              : (
                                  Number(tipjarStats.totalAmount) /
                                  web3.LAMPORTS_PER_SOL
                                ).toFixed(4)}{' '}
                            SOL
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sección de compartir - Solo visible para creator */}
                {isCreator && (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      padding: 24,
                      marginBottom: 32,
                    }}
                  >
                    <h3>Share Your Tip Link</h3>
                    <div style={{ marginTop: 20 }}>
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 14,
                            marginBottom: 8,
                          }}
                        >
                          Your Tip Link:
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: 'rgba(255,255,255,0.1)',
                            padding: '12px 16px',
                            borderRadius: 8,
                          }}
                        >
                          <input
                            type='text'
                            readOnly
                            value={`${window.location.origin}/@${username}`}
                            style={{
                              flex: 1,
                              background: 'transparent',
                              border: 'none',
                              color: 'white',
                              fontSize: 14,
                            }}
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/@${username}`
                              );
                              setStatus('Link copied to clipboard! 📋');
                              setStatusType('success');
                              setTimeout(() => setStatus(''), 3000);
                            }}
                            style={{
                              padding: '8px 16px',
                              background: '#2ed573',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-block',
                            padding: 16,
                            background: 'white',
                            borderRadius: 12,
                          }}
                        >
                          <QRCodeSVG
                            value={`${window.location.origin}/@${username}`}
                            size={180}
                            level='M'
                          />
                        </div>
                        <p
                          style={{
                            marginTop: 16,
                            fontSize: 14,
                            color: 'rgba(255,255,255,0.7)',
                          }}
                        >
                          Share this QR code so others can send you tips!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 32,
                  }}
                >
                  <h3>Send Tip (Public)</h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      marginTop: 16,
                    }}
                  >
                    <input
                      type='text'
                      placeholder='Your name'
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      style={{
                        padding: 12,
                        background: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 8,
                        color: 'white',
                      }}
                    />
                    <input
                      type='number'
                      placeholder='Amount (SOL)'
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value))}
                      style={{
                        padding: 12,
                        background: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 8,
                        color: 'white',
                      }}
                    />
                    <button
                      onClick={() => sendTipToUser(username)}
                      disabled={isLoading || !wallet.connected}
                      style={{
                        padding: 14,
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {isLoading ? 'Sending...' : `Send ${amount} SOL`}
                    </button>
                  </div>
                </div>

                {isCreator && (
                  <div
                    style={{
                      background: 'rgba(102, 126, 234, 0.2)',
                      border: '1px solid #667eea',
                      borderRadius: 16,
                      padding: 24,
                    }}
                  >
                    <h3>Creator Section (Private)</h3>
                    <p style={{ margin: '16px 0' }}>
                      You can withdraw funds below.
                    </p>
                    <button
                      onClick={() => withdrawUserFunds(username)}
                      disabled={isLoading}
                      style={{
                        padding: 14,
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600,
                        width: '100%',
                      }}
                    >
                      💰 Withdraw Funds (Creator Only)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
