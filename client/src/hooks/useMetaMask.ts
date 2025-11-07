/**
 * MetaMask React Hook
 * 
 * Provides React integration for MetaMask wallet connection and payments.
 * 
 * Features:
 * - Connect/disconnect wallet
 * - Account and balance management
 * - Send ETH and ERC-20 tokens
 * - Transaction monitoring
 * 
 * @module client/src/hooks/useMetaMask
 */

import { useState, useEffect, useCallback } from 'react';
import { web3Service, TransactionResult, SupportedToken } from '@/lib/web3';
import { toast } from 'sonner';

export interface MetaMaskState {
  isInstalled: boolean;
  isConnected: boolean;
  account: string | null;
  balance: string | null;
  chainId: number | null;
  isLoading: boolean;
  error: string | null;
}

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    isInstalled: false,
    isConnected: false,
    account: null,
    balance: null,
    chainId: null,
    isLoading: false,
    error: null,
  });

  /**
   * Check if MetaMask is installed
   */
  useEffect(() => {
    const isInstalled = web3Service.isMetaMaskInstalled();
    setState((prev) => ({ ...prev, isInstalled }));

    if (!isInstalled) {
      console.warn('[MetaMask] MetaMask is not installed');
    }
  }, []);

  /**
   * Connect to MetaMask
   */
  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const account = await web3Service.connect();
      const balance = await web3Service.getBalance();
      const chainId = await web3Service.getChainId();

      setState({
        isInstalled: true,
        isConnected: true,
        account,
        balance,
        chainId,
        isLoading: false,
        error: null,
      });

      toast.success('MetaMask connected successfully');
      return account;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to connect to MetaMask';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  /**
   * Disconnect from MetaMask
   */
  const disconnect = useCallback(() => {
    web3Service.disconnect();
    setState({
      isInstalled: state.isInstalled,
      isConnected: false,
      account: null,
      balance: null,
      chainId: null,
      isLoading: false,
      error: null,
    });
    toast.info('MetaMask disconnected');
  }, [state.isInstalled]);

  /**
   * Refresh balance
   */
  const refreshBalance = useCallback(async () => {
    if (!state.account) return;

    try {
      const balance = await web3Service.getBalance();
      setState((prev) => ({ ...prev, balance }));
    } catch (error: any) {
      console.error('[MetaMask] Failed to refresh balance:', error);
    }
  }, [state.account]);

  /**
   * Send ETH payment
   * 
   * @param to - Recipient address
   * @param amountInEth - Amount in ETH
   * @returns Transaction result
   */
  const sendETH = useCallback(
    async (to: string, amountInEth: string): Promise<TransactionResult> => {
      if (!state.isConnected) {
        throw new Error('MetaMask not connected');
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        toast.info('Sending transaction...');
        const result = await web3Service.sendETH(to, amountInEth);

        toast.success('Transaction sent! Waiting for confirmation...');

        // Wait for confirmation
        const confirmed = await web3Service.waitForTransaction(result.hash);

        if (confirmed.status === 'confirmed') {
          toast.success('Transaction confirmed!');
          await refreshBalance();
        } else {
          toast.error('Transaction failed');
        }

        setState((prev) => ({ ...prev, isLoading: false }));
        return confirmed;
      } catch (error: any) {
        const errorMessage = error.message || 'Transaction failed';
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        toast.error(errorMessage);
        throw error;
      }
    },
    [state.isConnected, refreshBalance]
  );

  /**
   * Send ERC-20 token payment
   * 
   * @param tokenAddress - Token contract address
   * @param to - Recipient address
   * @param amount - Amount in token units
   * @returns Transaction result
   */
  const sendToken = useCallback(
    async (
      tokenAddress: string,
      to: string,
      amount: string
    ): Promise<TransactionResult> => {
      if (!state.isConnected) {
        throw new Error('MetaMask not connected');
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        toast.info('Sending token transaction...');
        const result = await web3Service.sendToken(tokenAddress, to, amount);

        toast.success('Token transaction sent! Waiting for confirmation...');

        // Wait for confirmation
        const confirmed = await web3Service.waitForTransaction(result.hash);

        if (confirmed.status === 'confirmed') {
          toast.success('Token transaction confirmed!');
        } else {
          toast.error('Token transaction failed');
        }

        setState((prev) => ({ ...prev, isLoading: false }));
        return confirmed;
      } catch (error: any) {
        const errorMessage = error.message || 'Token transaction failed';
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        toast.error(errorMessage);
        throw error;
      }
    },
    [state.isConnected]
  );

  /**
   * Pay for order with MetaMask
   * 
   * Converts USD amount to ETH and sends payment.
   * 
   * @param merchantAddress - Merchant's wallet address
   * @param usdAmount - Amount in USD cents
   * @param token - Token to use for payment (default: ETH)
   * @returns Transaction result
   */
  const payOrder = useCallback(
    async (
      merchantAddress: string,
      usdAmount: number,
      token: SupportedToken = 'ETH'
    ): Promise<TransactionResult> => {
      if (!state.isConnected) {
        throw new Error('MetaMask not connected');
      }

      try {
        // Convert USD to crypto amount
        const cryptoAmount = await web3Service.convertUSDToToken(usdAmount, token);

        console.log(
          `[MetaMask] Paying $${(usdAmount / 100).toFixed(2)} = ${cryptoAmount} ${token}`
        );

        // Send payment based on token type
        if (token === 'ETH') {
          return await sendETH(merchantAddress, cryptoAmount);
        } else {
          // Get token address
          const tokenInfo = await import('@/lib/web3').then(
            (m) => m.SUPPORTED_TOKENS[token]
          );
          if (!tokenInfo.address) {
            throw new Error(`Token ${token} not supported`);
          }
          return await sendToken(tokenInfo.address, merchantAddress, cryptoAmount);
        }
      } catch (error: any) {
        console.error('[MetaMask] Payment failed:', error);
        throw error;
      }
    },
    [state.isConnected, sendETH, sendToken]
  );

  /**
   * Switch network
   * 
   * @param chainId - Target chain ID
   */
  const switchNetwork = useCallback(async (chainId: number) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await web3Service.switchNetwork(chainId);
      const newChainId = await web3Service.getChainId();
      setState((prev) => ({ ...prev, chainId: newChainId, isLoading: false }));
      toast.success('Network switched successfully');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to switch network';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  /**
   * Get token balance
   * 
   * @param token - Token symbol
   * @returns Token balance
   */
  const getTokenBalance = useCallback(
    async (token: SupportedToken): Promise<string> => {
      if (!state.account) {
        throw new Error('No account connected');
      }

      if (token === 'ETH') {
        return await web3Service.getBalance();
      }

      const tokenInfo = await import('@/lib/web3').then(
        (m) => m.SUPPORTED_TOKENS[token]
      );
      if (!tokenInfo.address) {
        throw new Error(`Token ${token} not supported`);
      }

      return await web3Service.getTokenBalance(tokenInfo.address);
    },
    [state.account]
  );

  return {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    refreshBalance,
    sendETH,
    sendToken,
    payOrder,
    switchNetwork,
    getTokenBalance,
  };
}
