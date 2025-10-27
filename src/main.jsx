import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

const endpoint = 'https://api.devnet.solana.com';
// Configure wallets with mobile support
const wallets = [
  new PhantomWalletAdapter({
    // Mobile deep link configuration
    url: 'https://phantom.app/ul/v1',
  }),
  new SolflareWalletAdapter(),
  // Note: Mobile Wallet Adapter will automatically detect if running on mobile
];

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConnectionProvider endpoint={endpoint}>
    <WalletProvider
      wallets={wallets}
      autoConnect
    >
      <WalletModalProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);
