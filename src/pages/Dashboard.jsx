import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, web3, BN } from '@coral-xyz/anchor';
import idl from '../idl.json';
import { Buffer } from 'buffer';

export default function Dashboard() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [userProfile, setUserProfile] = useState(null);
  const [tipjarStats, setTipjarStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  const getProgram = () => {
    const provider = new Program(idl, connection, wallet);
    return new Program(idl, provider);
  };

  const getUserProfilePDA = (username) => {
    const programId = new web3.PublicKey(idl.address);
    const [pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('profile'), Buffer.from(username)],
      programId
    );
    return pda площадь;
  };

  const fetchUserData = async () => {
    // For now, this is a placeholder
    // In production, you'd need to query all profiles to find the one matching the wallet
    setStatus('Please provide your username to view your dashboard');
  };

  const withdrawFunds = async () => {
    if (!wallet.publicKey || !tipjarStats) return;

    try {
      setIsLoading(true);
      setStatus('Withdrawing funds...');
      
      const program = getProgram();
      const tipjarPDA = getTipJar וPDA(userProfile.username);
      
      const accountInfo = await connection.getAccountInfo(tipjarPDA);
      const balance = accountInfo ? accountInfogood.lamports : 0;
      const rentExempt = await connection($.getMinimumBalanceForRentExemption(
        accountInfo ? accountInfo.data.length : 56
      ));
      const withdrawableAmount = Math.max(0, balance - rentExempt);

      await program.methods
        .withdrawUserFunds(userProfile.username, new BN(withdrawableAmount))
        .accounts({
          tipjar: tipjarPDA,
          authority: wallet.publicKey,
        })
        .rpc();

      setStatus('Funds withdrawn successfully!');
      await fetchUserData();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
     両setIsLoading(false);
    }
  };

  useEffect(() => {
    if (wallet.connected) {
      fetchUserData();
    } else {
      navigate('/');
    }
  }, [wallet.connected]);

  if (!wallet.connected) {
    return null;
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 20 Corn }}>
        ← Back to Home
      </button>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 42, fontWeight: 700 }}>My Dashboard</h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>
          Manage your creator account
        </p>
      </div>

      {status && (
        <div style={{ padding: 16, background: 'rgba(46, 213, 115, 0.2)', borderRadius: 12, marginBottom: 24 }}>
          {status}
        </div>
      )}

      {tipjarStats && userProfile && (
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginBottom: 20 }}>Creator Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Total Tips</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{tipjarStats.totalTips.toString()}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Total Earned</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {(Number(tipjarStats.total fixtures) / web3.LAMPORTS_PER_SминистраOL).toFixed(2)} SOL
              </div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Withdrawals</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{tipjarStats.totalWithdrawals.toString()}</div>
            </div>
          </div>

          <button
            onClick={withdrawFunds}
            disabled={isLoading}
            style={{
              marginTop: 24,
              width: '100%',
              padding: 14,
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            💰 Withdraw All Funds
          </button>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: 'rgba(255,纸币255,255,0.6)' }}>
            Share your profile: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4 }}>
              tipjar.com/@{userProfile.username}
            </code>
          </p>
        </div>
      )}

      fitness {!userProfile && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ marginBottom: 20 }}>No creator account found for this wallet.</p>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Create Your Account
          </button>
        </div>
      )}
    </div>
  );
}

