/**
 * Vector Index Bridge Service
 * Bridges Node.js backend to Python FAISS service via child process
 * 
 * Sprint 3 - Core Security Enhancement
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export interface SearchResult {
  face_profile_id: number;
  similarity: number;
  distance: number;
  confidence_level: 'high' | 'medium' | 'low';
}

export interface DuplicateCheckResult {
  is_duplicate: boolean;
  best_match: SearchResult | null;
}

export interface IndexStats {
  total_vectors: number;
  dimension: number;
  redis_connected: boolean;
  high_threshold: number;
  medium_threshold: number;
}

/**
 * Vector Index Service
 * Communicates with Python FAISS service via JSON-RPC over stdin/stdout
 */
export class VectorIndexService {
  private pythonProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';

  constructor(
    private pythonPath: string = path.join(process.cwd(), 'venv', 'bin', 'python'),
    private scriptPath: string = path.join(process.cwd(), 'server', 'services', 'faceAuth', 'vectorIndexServer.py')
  ) {}

  /**
   * Start the Python FAISS service
   */
  async start(): Promise<void> {
    if (this.pythonProcess) {
      console.log('[VectorIndex] Service already running');
      return;
    }

    return new Promise((resolve, reject) => {
      console.log(`[VectorIndex] Starting Python service: ${this.pythonPath} ${this.scriptPath}`);
      
      this.pythonProcess = spawn(this.pythonPath, [this.scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      // Handle stdout (JSON-RPC responses)
      this.pythonProcess.stdout?.on('data', (data) => {
        this.handleStdout(data);
      });

      // Handle stderr (logs)
      this.pythonProcess.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message.includes('ERROR') || message.includes('❌')) {
          console.error(`[VectorIndex] ${message}`);
        } else if (message.includes('READY')) {
          console.log('[VectorIndex] ✅ Service ready');
          resolve();
        } else {
          console.log(`[VectorIndex] ${message}`);
        }
      });

      // Handle process exit
      this.pythonProcess.on('exit', (code) => {
        console.log(`[VectorIndex] Process exited with code ${code}`);
        this.pythonProcess = null;
        
        // Reject all pending requests
        for (const [id, { reject }] of this.pendingRequests) {
          reject(new Error('Python process exited'));
        }
        this.pendingRequests.clear();
      });

      // Handle errors
      this.pythonProcess.on('error', (error) => {
        console.error('[VectorIndex] Process error:', error);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pythonProcess && !this.pythonProcess.killed) {
          reject(new Error('Python service startup timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Stop the Python FAISS service
   */
  async stop(): Promise<void> {
    if (!this.pythonProcess) {
      return;
    }

    return new Promise((resolve) => {
      this.pythonProcess!.once('exit', () => {
        console.log('[VectorIndex] Service stopped');
        resolve();
      });

      this.pythonProcess!.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.pythonProcess && !this.pythonProcess.killed) {
          console.warn('[VectorIndex] Force killing process');
          this.pythonProcess.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Handle stdout data from Python process
   */
  private handleStdout(data: Buffer): void {
    this.buffer += data.toString();
    
    // Process complete JSON objects
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      
      if (!line) continue;
      
      try {
        const response = JSON.parse(line);
        this.handleResponse(response);
      } catch (error) {
        console.error('[VectorIndex] Failed to parse response:', line);
      }
    }
  }

  /**
   * Handle JSON-RPC response
   */
  private handleResponse(response: any): void {
    const { id, result, error } = response;
    
    const pending = this.pendingRequests.get(id);
    if (!pending) {
      console.warn(`[VectorIndex] Received response for unknown request ${id}`);
      return;
    }

    this.pendingRequests.delete(id);

    if (error) {
      pending.reject(new Error(error.message || 'Unknown error'));
    } else {
      pending.resolve(result);
    }
  }

  /**
   * Send JSON-RPC request to Python process
   */
  private async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.pythonProcess || this.pythonProcess.killed) {
      throw new Error('Python service not running');
    }

    const id = ++this.requestId;
    const request = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const requestStr = JSON.stringify(request) + '\n';
      this.pythonProcess!.stdin?.write(requestStr);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} (${method}) timeout`));
        }
      }, 30000);
    });
  }

  /**
   * Add a face embedding vector to the index
   */
  async addVector(faceProfileId: number, embedding: number[]): Promise<boolean> {
    const result = await this.sendRequest('add_vector', {
      face_profile_id: faceProfileId,
      embedding
    });
    return result.success;
  }

  /**
   * Search for similar face embeddings
   */
  async searchSimilar(
    embedding: number[],
    k: number = 10,
    excludeId?: number
  ): Promise<SearchResult[]> {
    const result = await this.sendRequest('search_similar', {
      embedding,
      k,
      exclude_id: excludeId
    });
    return result.results;
  }

  /**
   * Check if an embedding is a duplicate
   */
  async checkDuplicate(
    embedding: number[],
    excludeId?: number
  ): Promise<DuplicateCheckResult> {
    const result = await this.sendRequest('check_duplicate', {
      embedding,
      exclude_id: excludeId
    });
    return {
      is_duplicate: result.is_duplicate,
      best_match: result.best_match
    };
  }

  /**
   * Remove a face embedding from the index
   */
  async removeVector(faceProfileId: number): Promise<boolean> {
    const result = await this.sendRequest('remove_vector', {
      face_profile_id: faceProfileId
    });
    return result.success;
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    const result = await this.sendRequest('get_stats', {});
    return result.stats;
  }

  /**
   * Rebuild index from database
   */
  async rebuildFromDatabase(faceProfiles: Array<{ id: number; embedding: number[] }>): Promise<boolean> {
    const result = await this.sendRequest('rebuild_from_database', {
      face_profiles: faceProfiles
    });
    return result.success;
  }
}

// Singleton instance
let vectorIndexService: VectorIndexService | null = null;

/**
 * Get or create the global vector index service
 */
export function getVectorIndexService(): VectorIndexService {
  if (!vectorIndexService) {
    vectorIndexService = new VectorIndexService();
  }
  return vectorIndexService;
}

/**
 * Initialize vector index service on server startup
 */
export async function initializeVectorIndexService(): Promise<void> {
  const service = getVectorIndexService();
  await service.start();
  console.log('[VectorIndex] ✅ Service initialized');
}

/**
 * Cleanup vector index service on server shutdown
 */
export async function shutdownVectorIndexService(): Promise<void> {
  if (vectorIndexService) {
    await vectorIndexService.stop();
    vectorIndexService = null;
  }
}
