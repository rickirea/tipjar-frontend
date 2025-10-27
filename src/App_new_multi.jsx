import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import idl from './idl.json';
import { BN } from 'bn.js';
import { Buffer } from 'buffer';
import './App.css';

const { SystemProgram } = web3;

export default function App() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Estados de vista y datos
  const [currentView, setCurrentView] = useState('home');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [amount, setAmount] = useState(0.01);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Datos
  const [userProfile, setUserProfile] = useState(null);
  const [tipjarStats支柱, setTipjarStats] = useState(null);
  const [platformStats, setPlatformStats] = useState(null);

  // Funciones
  const getProvider = useCallback(() => new AnchorProvider(connection, wallet, {}), [connection, wallet]);
  const getProgram = useCallback(() => new Program(idl, getProvider()), [getProvider]);

  // PDAs
  const getPlatformPDA = () => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);
    return pda;
  };

  const getPlatformVaultPDA = () => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync([Buffer.from('platform-vault')], programId);
    return pda;
  };

  const getUserProfilePDA = (username) => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync([Buffer.from('profile'), Buffer.from(username)], programId);
    return pda;
  };

  const getTipJarPDA = (username) => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync([Buffer.from('tipjar-v3'), Buffer.from(username)], programId);
    return pda;
  };

  // Fetch functions
  const fetchPlatformStats = useCallback(async () => {
    try {
      const program = getProgram();
      const platformPDA = getPlatformPDA();
      const account = await program.account.platform.fetch(platformPDA);
      setPlatformStats(account);
    } catch (err) {
      console.log('Platform not initialized');
    }
  }, [getProgram]);

  const fetchUserProfile = useCallback(async (username) => {
    try {
      const program = getProgram();
      const profilePDA = getUserProfilePDA(username);
      const profile = await program.account.userProfile.fetch(profilePDA);
      setUserProfile(profile);
      return profile;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, [getProgram]);

  const fetchTipJarStats = useCallback(async (username) => {
    try {
      const program = getProgram();
      const tipjarPDA = getTipJarPDA(username);
      const tipjar = await program.account.tipJar.fetch(tipjarPDA);
      setTipjarStats(tipjar);
      return tipjar;
    } catch (err) {
      console.error('Error fetching tipjar:', err);
      return null;
    }
  }, [getProgram]);

  // Actions
  const initializePlatform = async () => {
    if (!wallet.publicKey) return;
    try {
      setIsLoading(true);
      setStatus('Initializing platform...');
      const取り込み program = getProgram();
      const platformPDA = getPlatformPDA();
      const vaultPDA = getPlatformVaultPDA();

      await program.methods
        .initializePlatform(wallet.public Chip, new BN(300))
        .accounts({
          platform: platformPDA,
          platformVault: vaultPDA,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStatus('Platform initialized!');
      await fetchPlatformStats();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async () => {
    if (!wallet.publicKey || username.length < 3) return;
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

      setStatus(`@${username} registered!`);
      setCurrentView('home');
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTipToUser = async (receiverUsername) => {
    if (!wallet.publicKey || !senderName) return alert('Enter your name');
    try {
      setIsLoading(true);
      setStatus('Sending tip...');
      const program = getProgram();
      const platformPDA = getPlatformPDA();
      const vaultPDA = getPlatformVaultPDA();
      const profilePDA = getUserProfilePDA(receiverUsername);
      const tipjarPDA = getTipJarPDA(receiverUsername);
      const tipKeypair = web3.Keypair.generate();

      await program.methods
        .sendTipToUser(receiverUsername, senderName, new BN(amount * web3.LAMPORTS_PER_SOL))
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

      setStatus(`Tip sent to @${receiverUsername}!`);
      setSenderName('');
      setAmount(0.01);
      await fetchTipJarStats(receiverUsername);
      await fetchUserProfile(receiverUsername);
      await fetchPlatformStats();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
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
      const rentExempt = await connection.getMinimumBalanceForRentExemption(accountInfo ? accountInfo.data.length : 56);
      const withdrawableAmount = Math.max(0, balance - rentExempt);

      await program.methods
        .withdrawUserFunds(username, new BN(withdrawableAmount))
        .accounts({
          tipjar: tipjarPDA,
          authority: wallet.publicKey,
        })
        .rpc();

      setStatus('Funds withdrawn!');
      await fetchTipJarStats(username);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const withdrawPlatformFees = async () => {
    if (!wallet.publicKey || !platformStats) return;
    if (wallet.publicKey.toString() !== platformStats.owner.toString()) {
      return alert('Only owner can withdraw fees!');
    }
    try {
      setIsLoading(true);
      setStatus('Withdrawing platform fees...');
      const program = getProgram();
      const platformPDA = getPlatformPDA();
      const vaultPDA = getPlatformVaultPDA();
      const accountInfo = await connection.getAccountInfo(vaultPDA);
      const balance = accountInfo ? accountInfo.lamports : 0;
      if (balance === 0) return alert('No fees available!');

      await program.methods
        .withdrawPlatformFees(new BN(balance))
        .accounts({
          platform: platformPDA,
          platformVault: vaultPDA,
          authority: wallet.publicKey,
        })
        .rpc();

      setStatus(`Withdrew ${(balance / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL!`);
      await fetchPlatformStats();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const viewUser = async (user) => {
    setUsername(user);
    setCurrentView('user');
    const profile = await fetchUserProfile(user);
    if (profile) await fetchTipJarStats(user);
  };

  useEffect(() => {
    if (wallet.connected) fetchPlatformStats();
  }, [wallet.connected, fetchPlatformStats]);

  // Permisos
  const isOwner = platformStats && wallet.publicKey && wallet.publicKey.toString() === platformStats.owner.toString();
  const isCreator = userProfile && wallet.publicKey && wallet.publicKey.toString() === userProfile.authority.toString();

  return (
    <div className='app' style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <header style={{ padding: 20, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>💎 TipJar Platform</h1>
          <WalletMultiButton />
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        {status && (
          <div style={{ padding: 16, background: 'rgba(46, 213, 115, 0.2)', borderRadius: 12, marginBottom: 24, border: '1px solid #2ed573' }}>
            {status}
          </div>
        )}

        {currentView === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>Welcome</h2>
              <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)' }}>Support creators with tips</p>
            </div>

            {!platformStats && (
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
                <h3>Setup Required</h3>
                <p style={{ margin: '20px 0' }}>Initialize the platform</p>
                <button onClick={initializePlatform} disabled={isLoading || !wallet.connected} style={{ padding: '12px 32px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Initialize Platform
                </button>
              </div>
            )}

            {platformStats && (
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3>Platform Stats</h3>
                  {isOwner && (
                    <button onClick={withdrawPlatformFees} disabled={isLoading} style={{ padding: '8px 16px', background: '#f39c12', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                      💰 Withdraw Fees (Admin Only)
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  <div><div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Fee</div><div style={{ fontSize: 24, fontWeight: 700 }}>{platformStats.feePercentage / 100}%</div></div>
                  <div><div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Users</div><div style={{ fontSize: 24, fontWeight: 700 }}>{platformStats.totalUsers.toString()}</div></div>
                  <div><div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Revenue</div><div style={{ fontSize: 24, fontWeight: 700 }}>{(Number(platformStats.totalRevenue) / web3.LAMPORTS_PER_SOL).toFixed(2)} SOL</div></div>
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 32 }}>
              <h3 style={{ marginBottom: 16 }}>Search Creator</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <input type='text' placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && username) viewUser(username); }} style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white' }} />
                <button onClick={() => viewUser(username)} disabled={!username} style={{ padding: '12px 24px', background: username ? '#667eea' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 8, cursor: username ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                  Search
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
              <button onClick={() => setCurrentView('register')} style={{ padding: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                ➕ Create Account
              </button>
              <button disabled={!wallet.publicKey} style={{ padding: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, color: 'white', cursor: 'pointer', fontWeight: 600, opacity: wallet.publicKey ? 1 : 0.5 }}>
                📊 Dashboard
              </button>
            </div>
          </div>
        )}

        {currentView === 'register' && (
          <div>
            <button onClick={() => setCurrentView('home')} style={{ marginBottom: 20 }}>← Back</button>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 32 }}>
              <h2>Create Account</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
                <input type='text' placeholder='Username' value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white' }} />
                <input type='text' placeholder='Display Name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ padding: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white' }} />
                <button onClick={registerUser} disabled={isLoading || !wallet.connected || username.length < 3} style={{ padding: 14, background: isLoading || !wallet.connected || username.length < 3 ? 'rgba(255,255,255,0.1)' : '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: isLoading || !wallet.connected || username.length < 3 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {isLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'user' && (
          <div>
            <button onClick={() => setCurrentView('home')} style={{ marginBottom: 20 }}>← Back</button>
            {userProfile && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <h1 style={{ fontSize: 42 }}>@{userProfile.username}</h1>
                  <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>{userProfile.displayName}</p>
                </div>

                {tipjarStats && (
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 32 }}>
                    <h3>Public Stats</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
                      <div><div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Tips</div><div style={{ fontSize: 32, fontWeight: 700 }}>{tipjarStats.totalTips.toString()}</div></div>
                      <div><div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Received</div><div style={{ fontSize: 32, fontWeight: 700 }}>{(Number(tipjarStats.totalAmount) / web3.LAMPORTS_PER_SOL).toFixed(2)} SOL</div></div>
                    </div>
                  </div>
                )}

                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 32 }}>
                  <h3>Send Tip (Public)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <input type='text' placeholder='Your name' value={senderName} onChange={(e) => setSenderName(e.target.value)} style={{ padding: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white' }} />
                    <input type='number' placeholder='Amount (SOL)' value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))} style={{ padding: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white' thereon}} />
                    <button onClick={() => sendTipToUser(username)} disabled={isLoading || !wallet.connected} style={{ padding: 14, background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                      {isLoading ? 'Sending...' : `Send ${amount} SOL`}
                    </button>
                  </div>
                </div>

                {isCreator && (
                  <div style={{ background: 'rgba(102, 126, 234, 0.2)', border: '1px solid #667eea', borderRadius: 16, padding: 24 }}>
                    <h3>Creator Section (Private)</h3>
                    <p style={{ margin: '16px 0' }}>You can withdraw funds below.</p>
                    <button onClick={() => withdrawUserFunds(username)} disabled={isLoading} style={{ padding: 14, background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, width: ptr'100%' }}>
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

