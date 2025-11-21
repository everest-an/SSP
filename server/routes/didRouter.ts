/**
 * DID Router
 * 
 * tRPC routes for DID registration, login, and recovery
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  registerDID,
  validateRegistrationInput,
  createLocalStorageData,
  encryptLocalStorage,
  type RegistrationInput,
} from '../services/didRegistrationService';
import {
  loginWithDID,
  recoverWithBackupIDAndPrivateKey,
  validateLoginInput,
  verifySessionToken,
} from '../services/didLoginService';

/**
 * DID Router
 */
export const didRouter = router({
  /**
   * Register a new DID
   * 
   * Creates a new decentralized identity with face biometrics
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        faceVector: z.array(z.number()).length(512),
        deviceInfo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log('DID registration request received');

        // Validate input
        const validation = validateRegistrationInput(input);
        if (!validation.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: validation.errors.join(', '),
          });
        }

        // Register DID
        const result = await registerDID(input);

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.message || 'Registration failed',
          });
        }

        // Create local storage data
        const localData = createLocalStorageData(result, input.faceVector);

        // Encrypt local storage data
        const encryptedLocal = encryptLocalStorage(localData, input.faceVector);

        console.log('DID registration successful:', result.did);

        return {
          success: true,
          did: result.did,
          ethAddress: result.ethAddress,
          backupID: result.backupIDFormatted,
          backupQR: result.backupQR,
          arweaveID: result.arweaveID,
          
          // Encrypted local storage (to be saved on client)
          encryptedLocalStorage: {
            encrypted: encryptedLocal.encrypted,
            iv: encryptedLocal.iv,
            tag: encryptedLocal.tag,
          },
          
          // Warning message
          message: 'Please save your BackupID in a safe place. You will need it to recover your account if you lose your device.',
        };
      } catch (error) {
        console.error('DID registration error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Registration failed',
        });
      }
    }),

  /**
   * Login with DID
   * 
   * Authenticates user using face biometrics and reconstructs identity from shards
   */
  login: publicProcedure
    .input(
      z.object({
        faceVector: z.array(z.number()).length(512),
        encryptedLocalStorage: z.object({
          encrypted: z.string(),
          iv: z.string(),
          tag: z.string(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log('DID login request received');

        // Validate input
        const validation = validateLoginInput({
          faceVector: input.faceVector,
        });
        
        if (!validation.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: validation.errors.join(', '),
          });
        }

        // Login with DID
        const result = await loginWithDID(
          { faceVector: input.faceVector },
          input.encryptedLocalStorage
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: result.message || 'Login failed',
          });
        }

        console.log('DID login successful:', result.did);

        return {
          success: true,
          did: result.did,
          ethAddress: result.ethAddress,
          sessionToken: result.sessionToken,
          message: 'Login successful',
        };
      } catch (error) {
        console.error('DID login error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Login failed',
        });
      }
    }),

  /**
   * Recover account with BackupID
   * 
   * Recovers account using BackupID shard and private key
   */
  recover: publicProcedure
    .input(
      z.object({
        did: z.string().regex(/^did:ethr:0x[a-fA-F0-9]{40}$/),
        backupIDShard: z.string(),
        privateKey: z.string(),
        arweaveID: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log('DID recovery request received');

        // Recover with BackupID and private key
        const result = await recoverWithBackupIDAndPrivateKey(
          input.did,
          input.backupIDShard,
          input.privateKey,
          input.arweaveID
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: result.message || 'Recovery failed',
          });
        }

        console.log('DID recovery successful:', result.did);

        return {
          success: true,
          did: result.did,
          ethAddress: result.ethAddress,
          sessionToken: result.sessionToken,
          message: 'Recovery successful. Please re-register your face for biometric login.',
        };
      } catch (error) {
        console.error('DID recovery error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Recovery failed',
        });
      }
    }),

  /**
   * Verify session token
   * 
   * Validates a session token and returns user info
   */
  verifySession: publicProcedure
    .input(
      z.object({
        sessionToken: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const verification = verifySessionToken(input.sessionToken);

        if (!verification.valid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: verification.message || 'Invalid session token',
          });
        }

        return {
          valid: true,
          did: verification.userID?.did,
          ethAddress: verification.userID?.ethAddress,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Session verification failed',
        });
      }
    }),

  /**
   * Get DID info
   * 
   * Returns DID information for authenticated user
   */
  getInfo: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Get user from context
        const user = ctx.user;

        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        // TODO: Query DID info from database
        // For now, return basic info

        return {
          success: true,
          userId: user.id,
          email: user.email,
          // did: user.did,
          // ethAddress: user.ethAddress,
          message: 'DID info retrieved (TODO: implement database query)',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get DID info',
        });
      }
    }),

  /**
   * Update DID
   * 
   * Updates DID information (e.g., add new face vector)
   */
  update: protectedProcedure
    .input(
      z.object({
        faceVector: z.array(z.number()).length(512).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get user from context
        const user = ctx.user;

        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        // TODO: Update DID info in database

        console.log('DID update request for user:', user.id);

        return {
          success: true,
          message: 'DID updated successfully (TODO: implement database update)',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update DID',
        });
      }
    }),
});
