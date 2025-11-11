#!/usr/bin/env python3
"""
FAISS Vector Index JSON-RPC Server
Provides a JSON-RPC interface over stdin/stdout for Node.js integration

Sprint 3 - Core Security Enhancement
"""

import sys
import json
import logging
import numpy as np
from typing import Dict, Any
from vectorIndex import get_vector_index

# Configure logging to stderr (stdout is for JSON-RPC)
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)


class JSONRPCServer:
    """Simple JSON-RPC 2.0 server over stdin/stdout"""
    
    def __init__(self):
        self.vector_index = get_vector_index()
        self.methods = {
            'add_vector': self.add_vector,
            'search_similar': self.search_similar,
            'check_duplicate': self.check_duplicate,
            'remove_vector': self.remove_vector,
            'get_stats': self.get_stats,
            'rebuild_from_database': self.rebuild_from_database,
        }
    
    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a single JSON-RPC request"""
        request_id = request.get('id')
        method = request.get('method')
        params = request.get('params', {})
        
        if method not in self.methods:
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'error': {
                    'code': -32601,
                    'message': f'Method not found: {method}'
                }
            }
        
        try:
            result = self.methods[method](params)
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': result
            }
        except Exception as e:
            logger.error(f"Error handling {method}: {e}", exc_info=True)
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'error': {
                    'code': -32603,
                    'message': str(e)
                }
            }
    
    def add_vector(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Add a face embedding vector"""
        face_profile_id = params['face_profile_id']
        embedding = np.array(params['embedding'], dtype='float32')
        
        success = self.vector_index.add_vector(face_profile_id, embedding)
        return {'success': success}
    
    def search_similar(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Search for similar embeddings"""
        embedding = np.array(params['embedding'], dtype='float32')
        k = params.get('k', 10)
        exclude_id = params.get('exclude_id')
        
        results = self.vector_index.search_similar(embedding, k, exclude_id)
        
        return {
            'results': [
                {
                    'face_profile_id': r.face_profile_id,
                    'similarity': r.similarity,
                    'distance': r.distance,
                    'confidence_level': r.confidence_level
                }
                for r in results
            ]
        }
    
    def check_duplicate(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Check if embedding is a duplicate"""
        embedding = np.array(params['embedding'], dtype='float32')
        exclude_id = params.get('exclude_id')
        
        is_duplicate, best_match = self.vector_index.check_duplicate(embedding, exclude_id)
        
        return {
            'is_duplicate': is_duplicate,
            'best_match': {
                'face_profile_id': best_match.face_profile_id,
                'similarity': best_match.similarity,
                'distance': best_match.distance,
                'confidence_level': best_match.confidence_level
            } if best_match else None
        }
    
    def remove_vector(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Remove a vector from the index"""
        face_profile_id = params['face_profile_id']
        success = self.vector_index.remove_vector(face_profile_id)
        return {'success': success}
    
    def get_stats(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get index statistics"""
        stats = self.vector_index.get_stats()
        return {'stats': stats}
    
    def rebuild_from_database(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Rebuild index from database records"""
        face_profiles = [
            (fp['id'], np.array(fp['embedding'], dtype='float32'))
            for fp in params['face_profiles']
        ]
        success = self.vector_index.rebuild_from_database(face_profiles)
        return {'success': success}
    
    def run(self):
        """Main server loop - read from stdin, write to stdout"""
        logger.info("Starting JSON-RPC server...")
        logger.info("READY")  # Signal to Node.js that we're ready
        
        try:
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    request = json.loads(line)
                    response = self.handle_request(request)
                    
                    # Write response to stdout
                    sys.stdout.write(json.dumps(response) + '\n')
                    sys.stdout.flush()
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {e}")
                    error_response = {
                        'jsonrpc': '2.0',
                        'id': None,
                        'error': {
                            'code': -32700,
                            'message': 'Parse error'
                        }
                    }
                    sys.stdout.write(json.dumps(error_response) + '\n')
                    sys.stdout.flush()
        
        except KeyboardInterrupt:
            logger.info("Server interrupted")
        except Exception as e:
            logger.error(f"Server error: {e}", exc_info=True)
        finally:
            logger.info("Server shutting down")


if __name__ == '__main__':
    server = JSONRPCServer()
    server.run()
