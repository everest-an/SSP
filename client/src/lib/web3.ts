/**
 * Web3 Service for MetaMask Integration
 * 
 * This module provides Web3 functionality for connecting to MetaMask
 * and processing cryptocurrency payments.
 * 
 * Features:
 * - MetaMask wallet connection
 * - Account management
 * - ETH and ERC-20 token transfers
 * - Transaction monitoring
 * - Gas estimation
 * 
 * @module client/src/lib/web3
 */

import { ethers, BrowserProvider, Eip1193Provider } from 'ethers';

/**
 * Supported tokens for payment
 */
export const SUPPORTED_TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: null, // Native token
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    // Ethereum mainnet USDT address
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    // Ethereum mainnet USDC address
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
} as const;

export type SupportedToken = keyof typeof SUPPORTED_TOKENS;

/**
 * ERC-20 Token ABI (minimal interface for transfers)
 */
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/**
 * Transaction result interface
 */
export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockNumber?: number;
}

/**
 * Web3Service Class
 * 
 * Manages MetaMask connection and cryptocurrency transactions
 */
export class Web3Service {
  private provider: BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private account: string | null = null;

  /**
   * Check if MetaMask is installed
   */
  isMetaMaskInstalled(): boolean {
    const ethereum = (window as any).ethereum;
    return Boolean(ethereum && ethereum.isMetaMask);
  }

  /**
   * Connect to MetaMask wallet
   * 
   * Requests user permission and connects to their wallet.
   * 
   * @returns Connected wallet address
   * @throws Error if MetaMask not installed or connection failed
   */
  async connect(): Promise<string> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask extension.');
    }

    try {
      const ethereum = (window as any).ethereum as Eip1193Provider;
      
      // Request account access
      const accounts = await ethereum.request?.({ 
        method: 'eth_requestAccounts' 
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      // Create provider and signer
      this.provider = new BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();
      this.account = accounts[0];

      console.log('[Web3] Connected to MetaMask:', this.account);

      // Listen for account changes
      ethereum.on?.('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          this.disconnect();
        } else {
          this.account = accounts[0];
          console.log('[Web3] Account changed:', this.account);
        }
      });

      // Listen for chain changes
      ethereum.on?.('chainChanged', () => {
        window.location.reload();
      });

      return this.account;
    } catch (error: any) {
      console.error('[Web3] Connection failed:', error);
      throw new Error(error.message || 'Failed to connect to MetaMask');
    }
  }

  /**
   * Disconnect from MetaMask
   */
  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.account = null;
    console.log('[Web3] Disconnected from MetaMask');
  }

  /**
   * Get connected account address
   */
  getAccount(): string | null {
    return this.account;
  }

  /**
   * Get current network chain ID
   */
  async getChainId(): Promise<number> {
    if (!this.provider) {
      throw new Error('Not connected to MetaMask');
    }

    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }

  /**
   * Get ETH balance of an address
   * 
   * @param address - Wallet address (defaults to connected account)
   * @returns Balance in ETH as string
   */
  async getBalance(address?: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Not connected to MetaMask');
    }

    const addr = address || this.account;
    if (!addr) {
      throw new Error('No address provided');
    }

    const balance = await this.provider.getBalance(addr);
    return ethers.formatEther(balance);
  }

  /**
   * Get ERC-20 token balance
   * 
   * @param tokenAddress - Token contract address
   * @param address - Wallet address (defaults to connected account)
   * @returns Balance as string
   */
  async getTokenBalance(tokenAddress: string, address?: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Not connected to MetaMask');
    }

    const addr = address || this.account;
    if (!addr) {
      throw new Error('No address provided');
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const balance = await contract.balanceOf(addr);
    const decimals = await contract.decimals();

    return ethers.formatUnits(balance, decimals);
  }

  /**
   * Send ETH to an address
   * 
   * @param to - Recipient address
   * @param amountInEth - Amount in ETH
   * @returns Transaction result
   */
  async sendETH(to: string, amountInEth: string): Promise<TransactionResult> {
    if (!this.signer || !this.account) {
      throw new Error('Not connected to MetaMask');
    }

    console.log(`[Web3] Sending ${amountInEth} ETH to ${to}`);

    try {
      // Send transaction
      const tx = await this.signer.sendTransaction({
        to,
        value: ethers.parseEther(amountInEth),
      });

      console.log('[Web3] Transaction sent:', tx.hash);

      return {
        hash: tx.hash,
        from: this.account,
        to: tx.to || to,
        value: amountInEth,
        status: 'pending',
        confirmations: 0,
      };
    } catch (error: any) {
      console.error('[Web3] Transaction failed:', error);
      throw new Error(error.message || 'Transaction failed');
    }
  }

  /**
   * Send ERC-20 tokens to an address
   * 
   * @param tokenAddress - Token contract address
   * @param to - Recipient address
   * @param amount - Amount in token units
   * @returns Transaction result
   */
  async sendToken(
    tokenAddress: string, 
    to: string, 
    amount: string
  ): Promise<TransactionResult> {
    if (!this.signer || !this.account) {
      throw new Error('Not connected to MetaMask');
    }

    console.log(`[Web3] Sending ${amount} tokens to ${to}`);

    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const decimals = await contract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);

      // Send transaction
      const tx = await contract.transfer(to, amountInWei);
      console.log('[Web3] Token transfer sent:', tx.hash);

      await tx.wait();

      return {
        hash: tx.hash,
        from: this.account,
        to,
        value: amount,
        status: 'pending',
        confirmations: 0,
      };
    } catch (error: any) {
      console.error('[Web3] Token transfer failed:', error);
      throw new Error(error.message || 'Token transfer failed');
    }
  }

  /**
   * Wait for transaction confirmation
   * 
   * @param txHash - Transaction hash
   * @param confirmations - Number of confirmations to wait for (default: 1)
   * @returns Transaction receipt
   */
  async waitForTransaction(
    txHash: string, 
    confirmations: number = 1
  ): Promise<TransactionResult> {
    if (!this.provider) {
      throw new Error('Not connected to MetaMask');
    }

    console.log(`[Web3] Waiting for ${confirmations} confirmations for ${txHash}`);

    try {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      const status = receipt.status === 1 ? 'confirmed' : 'failed';

      console.log(`[Web3] Transaction ${status}:`, txHash);

      return {
        hash: receipt.hash,
        from: receipt.from,
        to: receipt.to || '',
        value: '0',
        gasUsed: receipt.gasUsed.toString(),
        status,
        confirmations: confirmations,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      console.error('[Web3] Transaction confirmation failed:', error);
      throw new Error(error.message || 'Transaction confirmation failed');
    }
  }

  /**
   * Estimate gas for ETH transfer
   * 
   * @param to - Recipient address
   * @param amountInEth - Amount in ETH
   * @returns Estimated gas in Gwei
   */
  async estimateGas(to: string, amountInEth: string): Promise<string> {
    if (!this.provider || !this.account) {
      throw new Error('Not connected to MetaMask');
    }

    try {
      const gasEstimate = await this.provider.estimateGas({
        from: this.account,
        to,
        value: ethers.parseEther(amountInEth),
      });

      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      const totalGas = gasEstimate * gasPrice;

      return ethers.formatEther(totalGas);
    } catch (error: any) {
      console.error('[Web3] Gas estimation failed:', error);
      throw new Error(error.message || 'Gas estimation failed');
    }
  }

  /**
   * Convert USD amount to ETH
   * 
   * Note: In production, fetch real-time exchange rate from an API
   * 
   * @param usdAmount - Amount in USD cents
   * @returns Amount in ETH
   */
  async convertUSDToETH(usdAmount: number): Promise<string> {
    // TODO: Fetch real-time ETH price from API (e.g., CoinGecko, Binance)
    // For now, use a mock price
    const ethPriceUSD = 2000; // $2000 per ETH
    const usdInDollars = usdAmount / 100;
    const ethAmount = usdInDollars / ethPriceUSD;

    return ethAmount.toFixed(6);
  }

  /**
   * Convert USD amount to token amount
   * 
   * @param usdAmount - Amount in USD cents
   * @param token - Token symbol
   * @returns Amount in token units
   */
  async convertUSDToToken(usdAmount: number, token: SupportedToken): Promise<string> {
    if (token === 'ETH') {
      return this.convertUSDToETH(usdAmount);
    }

    // For stablecoins (USDT, USDC), 1 token = 1 USD
    if (token === 'USDT' || token === 'USDC') {
      return (usdAmount / 100).toFixed(2);
    }

    throw new Error(`Unsupported token: ${token}`);
  }

  /**
   * Switch to a specific network
   * 
   * @param chainId - Target chain ID
   */
  async switchNetwork(chainId: number): Promise<void> {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error('MetaMask not found');
    }

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      // If chain not added, add it
      if (error.code === 4902) {
        throw new Error('Please add this network to MetaMask first');
      }
      throw error;
    }
  }
}

// Export singleton instance
export const web3Service = new Web3Service();
