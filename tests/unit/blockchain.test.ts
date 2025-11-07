/**
 * Unit Tests for Blockchain Service
 * 
 * Tests blockchain integration functionality including:
 * - Address validation
 * - Transaction creation
 * - Gas fee estimation
 * - Amount formatting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  blockchainService,
  BlockchainNetwork,
  Cryptocurrency,
  TransactionStatus,
  formatBlockchainAmount,
} from '../../server/_core/blockchain';

describe('BlockchainService', () => {
  describe('validateAddress', () => {
    it('should validate Ethereum addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      const invalidAddress = '0xinvalid';

      expect(blockchainService.validateAddress(validAddress, BlockchainNetwork.ETHEREUM_MAINNET)).toBe(true);
      expect(blockchainService.validateAddress(invalidAddress, BlockchainNetwork.ETHEREUM_MAINNET)).toBe(false);
    });

    it('should validate Bitcoin addresses', () => {
      const validP2PKH = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      const validBech32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
      const invalidAddress = 'invalid-btc-address';

      expect(blockchainService.validateAddress(validP2PKH, BlockchainNetwork.BITCOIN)).toBe(true);
      expect(blockchainService.validateAddress(validBech32, BlockchainNetwork.BITCOIN)).toBe(true);
      expect(blockchainService.validateAddress(invalidAddress, BlockchainNetwork.BITCOIN)).toBe(false);
    });
  });

  describe('createTransaction', () => {
    it('should create a transaction with correct parameters', async () => {
      const params = {
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x123456789abcdef123456789abcdef123456789a',
        amount: 1000, // $10.00
        currency: Cryptocurrency.ETH,
        network: BlockchainNetwork.ETHEREUM_SEPOLIA,
        orderId: 1,
      };

      const transaction = await blockchainService.createTransaction(params);

      expect(transaction).toHaveProperty('hash');
      expect(transaction.from).toBe(params.from);
      expect(transaction.to).toBe(params.to);
      expect(transaction.currency).toBe(Cryptocurrency.ETH);
      expect(transaction.network).toBe(BlockchainNetwork.ETHEREUM_SEPOLIA);
      expect(transaction.status).toBe(TransactionStatus.PENDING);
      expect(transaction.confirmations).toBe(0);
    });

    it('should handle different cryptocurrencies', async () => {
      const currencies = [
        Cryptocurrency.ETH,
        Cryptocurrency.USDT,
        Cryptocurrency.USDC,
      ];

      for (const currency of currencies) {
        const params = {
          from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          to: '0x123456789abcdef123456789abcdef123456789a',
          amount: 1000,
          currency,
          network: BlockchainNetwork.ETHEREUM_SEPOLIA,
          orderId: 1,
        };

        const transaction = await blockchainService.createTransaction(params);
        expect(transaction.currency).toBe(currency);
      }
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status', async () => {
      const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const network = BlockchainNetwork.ETHEREUM_SEPOLIA;

      const transaction = await blockchainService.getTransactionStatus(txHash, network);

      expect(transaction).toHaveProperty('hash');
      expect(transaction).toHaveProperty('status');
      expect(transaction).toHaveProperty('confirmations');
      expect(transaction.hash).toBe(txHash);
    });
  });

  describe('getEstimatedGasFee', () => {
    it('should return gas fee estimate for Ethereum mainnet', async () => {
      const fee = await blockchainService.getEstimatedGasFee(
        BlockchainNetwork.ETHEREUM_MAINNET,
        Cryptocurrency.ETH
      );

      expect(fee).toBeGreaterThan(0);
      expect(typeof fee).toBe('number');
    });

    it('should return lower gas fee for testnets', async () => {
      const mainnetFee = await blockchainService.getEstimatedGasFee(
        BlockchainNetwork.ETHEREUM_MAINNET,
        Cryptocurrency.ETH
      );
      
      const testnetFee = await blockchainService.getEstimatedGasFee(
        BlockchainNetwork.ETHEREUM_SEPOLIA,
        Cryptocurrency.ETH
      );

      expect(testnetFee).toBeLessThan(mainnetFee);
    });

    it('should return gas fee for different networks', async () => {
      const networks = [
        BlockchainNetwork.ETHEREUM_MAINNET,
        BlockchainNetwork.POLYGON,
        BlockchainNetwork.BSC,
      ];

      for (const network of networks) {
        const fee = await blockchainService.getEstimatedGasFee(network, Cryptocurrency.ETH);
        expect(fee).toBeGreaterThan(0);
      }
    });
  });
});

describe('formatBlockchainAmount', () => {
  it('should format ETH amount correctly', () => {
    const amount = '1000000000000000000'; // 1 ETH in wei
    const formatted = formatBlockchainAmount(amount, Cryptocurrency.ETH);
    expect(formatted).toBe('1.000000000000000000 ETH');
  });

  it('should format BTC amount correctly', () => {
    const amount = '100000000'; // 1 BTC in satoshi
    const formatted = formatBlockchainAmount(amount, Cryptocurrency.BTC);
    expect(formatted).toBe('1.00000000 BTC');
  });

  it('should handle small amounts', () => {
    const amount = '1000000000000000'; // 0.001 ETH
    const formatted = formatBlockchainAmount(amount, Cryptocurrency.ETH);
    expect(formatted).toContain('0.001');
  });

  it('should handle zero amount', () => {
    const amount = '0';
    const formatted = formatBlockchainAmount(amount, Cryptocurrency.ETH);
    expect(formatted).toBe('0.000000000000000000 ETH');
  });
});
