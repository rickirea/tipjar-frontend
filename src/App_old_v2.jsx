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

  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0.01);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Funciones de ayuda para obtener proveedor y programa
  const getProvider = useCallback(
    () => new AnchorProvider(connection, wallet, {}),
    [connection, wallet]
  );
  const getProgram = useCallback(
    () => new Program(idl, getProvider()),
    [getProvider]
  );

  const [recentTips, setRecentTips] = useState([]);
  const [tipjarStats, setTipjarStats] = useState(null);

  // Obtener PDA del TipJar
  const getTipJarPDA = () => {
    const programId = new web3.PublicKey(idl.address);
    const [tipjarPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('tipjar-v2')],
      programId
    );
    return tipjarPDA;
  };

  // Cargar estadísticas del TipJar
  const fetchTipJarStats = useCallback(async () => {
    try {
      const program = getProgram();
      const tipjarPDA = getTipJarPDA();
      const tipjarAccount = await program.account.tipJar.fetch(tipjarPDA);
      setTipjarStats(tipjarAccount);
    } catch (err) {
      console.error('fetchTipJarStats:', err);
      setTipjarStats(null);
    }
  }, [getProgram]);

  // Inicializar el TipJar (ejecutar una sola vez)
  const initializeTipJar = async () => {
    try {
      if (!wallet.publicKey) return alert('Connect your wallet first!');
      setStatus('Initializing TipJar...');

      const program = getProgram();
      const tipjarPDA = getTipJarPDA();

      await program.methods
        .initialize(wallet.publicKey)
        .accounts({
          tipjar: tipjarPDA,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStatus('TipJar initialized successfully!');
      await fetchTipJarStats();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    }
  };

  // Retirar fondos del TipJar (solo authority)
  const withdrawFunds = async () => {
    if (!wallet.publicKey || !tipjarStats) return;

    if (wallet.publicKey.toString() !== tipjarStats.authority.toString()) {
      return alert('Only the TipJar owner can withdraw funds!');
    }

    try {
      setStatus('Withdrawing funds...');
      const program = getProgram();
      const tipjarPDA = getTipJarPDA();
      // Obtener los lamports reales de la cuenta en lugar de totalAmount
      const accountInfo = await connection.getAccountInfo(tipjarPDA);
      const balance = accountInfo ? accountInfo.lamports : 0;

      // Descontar el rent (saldo mínimo que debe quedarse)
      const rentExemptBalance =
        await connection.getMinimumBalanceForRentExemption(
          accountInfo ? accountInfo.data.length : 56
        );
      const withdrawableAmount = Math.max(0, balance - rentExemptBalance);

      if (withdrawableAmount === 0) {
        return alert('No funds available to withdraw!');
      }

      await program.methods
        .withdraw(new BN(withdrawableAmount))
        .accounts({
          tipjar: tipjarPDA,
          authority: wallet.publicKey,
        })
        .rpc();

      setStatus(
        `Successfully withdrew ${(
          Number(withdrawableAmount) / web3.LAMPORTS_PER_SOL
        ).toFixed(4)} SOL!`
      );
      await fetchTipJarStats();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    }
  };

  // Obtener últimas donaciones
  const fetchRecentTips = useCallback(async () => {
    try {
      const program = getProgram();
      const accounts = await program.account.tip.all();

      const tips = accounts.map((a) => ({
        pubkey: a.publicKey,
        account: a.account,
        timestamp: a.account.timestamp,
      }));

      // Ordenar por timestamp descendente
      tips.sort((x, y) => (y.timestamp ?? 0) - (x.timestamp ?? 0));
      setRecentTips(tips.slice(0, 5));
    } catch (err) {
      console.error('fetchRecentTips:', err);
    }
  }, [getProgram]);

  useEffect(() => {
    fetchRecentTips();
    fetchTipJarStats();
    // Poll cada 10 segundos
    const id = setInterval(() => {
      fetchRecentTips();
      fetchTipJarStats();
    }, 10_000);
    return () => clearInterval(id);
  }, [fetchRecentTips, fetchTipJarStats]);

  const sendTip = async () => {
    if (isLoading) return; // Prevenir doble submit

    try {
      if (!wallet.publicKey) return alert('Connect your wallet first!');
      setIsLoading(true);
      setStatus('Sending tip...');

      const program = getProgram();
      const tipjarPDA = getTipJarPDA();
      const tipKeypair = web3.Keypair.generate();

      const lamports = web3.LAMPORTS_PER_SOL * amount;

      // Llamado a instrucción de enviar propina
      await program.methods
        .sendTip(name, new BN(lamports))
        .accounts({
          tipjar: tipjarPDA,
          tip: tipKeypair.publicKey,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([tipKeypair])
        .rpc();

      setStatus(`Tip sent successfully!`);
      await fetchRecentTips();
      await fetchTipJarStats();
      setName(''); // Limpiar el nombre
      setAmount(0.01); // Reset amount
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='app-container'>
      <h1>Tip Jar</h1>

      <div className='wallet-row'>
        <WalletMultiButton />
      </div>

      {/* Estadísticas del TipJar */}
      {tipjarStats && (
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--glass-border)',
            borderRadius: 12,
            padding: 16,
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                Total Tips
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {tipjarStats.totalTips.toString()}
              </div>
              <div
                style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}
              >
                Withdrawals: {tipjarStats.totalWithdrawals?.toString() || 0}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                Total Amount
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {(
                  Number(tipjarStats.totalAmount) / web3.LAMPORTS_PER_SOL
                ).toFixed(4)}{' '}
                SOL
              </div>
            </div>
          </div>

          {/* Botones solo para el dueño */}
          {wallet.publicKey &&
            wallet.publicKey.toString() ===
              tipjarStats.authority.toString() && (
              <div
                style={{
                  marginTop: 16,
                  textAlign: 'center',
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                <button
                  onClick={withdrawFunds}
                  style={{
                    background:
                      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  💰 Withdraw
                </button>
              </div>
            )}
        </div>
      )}

      {!wallet.connected ? (
        <p>Connect your Phantom wallet using the button above.</p>
      ) : !tipjarStats ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p style={{ marginBottom: 16 }}>
            TipJar has not been initialized yet.
          </p>
          <button onClick={initializeTipJar}>Initialize TipJar</button>
        </div>
      ) : (
        <>
          <input
            type='text'
            placeholder='Your name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
          <input
            type='number'
            step='0.001'
            min='0.001'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            onClick={sendTip}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Tip'}
          </button>
        </>
      )}

      <p className='status'>{status}</p>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <h3 style={{ marginTop: 12 }}>Latest donations</h3>
        {recentTips.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No donations yet</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recentTips.map((t) => (
              <li
                key={t.pubkey.toBase58()}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 8,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {t.account.name || 'anon'}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {t.pubkey.toBase58()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>
                      {(
                        Number(t.account.amount) / web3.LAMPORTS_PER_SOL
                      ).toFixed(4)}{' '}
                      SOL
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {t.timestamp
                        ? new Date(Number(t.timestamp) * 1000).toLocaleString()
                        : 'unknown'}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
