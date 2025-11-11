#!/usr/bin/env python3
"""
FAISS Vector Index Service for Face Embeddings
Provides ANN (Approximate Nearest Neighbor) search for face uniqueness detection

Sprint 3 - Core Security Enhancement
"""

import faiss
import numpy as np
import pickle
import redis
import json
import logging
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Result from vector search"""
    face_profile_id: int
    similarity: float
    distance: float
    confidence_level: str  # 'high', 'medium', 'low'


class FaceVectorIndex:
    """
    FAISS-based vector index for face embeddings
    Supports:
    - Fast ANN search (L2 distance)
    - Persistence to Redis
    - Duplicate detection with configurable thresholds
    """
    
    # Thresholds for similarity (cosine similarity converted from L2)
    HIGH_CONFIDENCE_THRESHOLD = 0.85  # Same person, high confidence
    MEDIUM_CONFIDENCE_THRESHOLD = 0.70  # Possible match, needs review
    
    def __init__(
        self,
        dimension: int = 512,
        redis_host: str = 'localhost',
        redis_port: int = 6379,
        redis_db: int = 0,
        index_key: str = 'faiss:face_index',
        map_key: str = 'faiss:id_map'
    ):
        """
        Initialize FAISS index
        
        Args:
            dimension: Embedding vector dimension (512 for MediaPipe)
            redis_host: Redis server host
            redis_port: Redis server port
            redis_db: Redis database number
            index_key: Redis key for FAISS index
            map_key: Redis key for ID mapping
        """
        self.dimension = dimension
        self.index_key = index_key
        self.map_key = map_key
        
        # Initialize FAISS index (L2 distance)
        self.index = faiss.IndexFlatL2(dimension)
        
        # Mapping: faiss_internal_id -> face_profile_id
        self.id_map: Dict[int, int] = {}
        
        # Reverse mapping: face_profile_id -> faiss_internal_id
        self.reverse_map: Dict[int, int] = {}
        
        # Redis connection
        try:
            self.redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                db=redis_db,
                decode_responses=False  # We need bytes for FAISS
            )
            self.redis_client.ping()
            logger.info(f"✅ Connected to Redis at {redis_host}:{redis_port}")
            
            # Try to load existing index
            self.load_from_redis()
        except redis.ConnectionError as e:
            logger.warning(f"⚠️ Redis connection failed: {e}. Running in memory-only mode.")
            self.redis_client = None
    
    def add_vector(
        self,
        face_profile_id: int,
        embedding: np.ndarray,
        persist: bool = True
    ) -> bool:
        """
        Add a face embedding vector to the index
        
        Args:
            face_profile_id: Database face_profile.id
            embedding: Face embedding vector (shape: [dimension])
            persist: Whether to persist to Redis immediately
            
        Returns:
            True if added successfully, False if already exists
        """
        try:
            # Check if already exists
            if face_profile_id in self.reverse_map:
                logger.warning(f"Face profile {face_profile_id} already in index")
                return False
            
            # Normalize embedding to unit length for cosine similarity
            embedding = embedding.astype('float32')
            if embedding.shape[0] != self.dimension:
                raise ValueError(f"Embedding dimension mismatch: expected {self.dimension}, got {embedding.shape[0]}")
            
            # Normalize
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            # Add to FAISS index
            faiss_id = self.index.ntotal
            self.index.add(embedding.reshape(1, -1))
            
            # Update mappings
            self.id_map[faiss_id] = face_profile_id
            self.reverse_map[face_profile_id] = faiss_id
            
            logger.info(f"✅ Added face_profile_id={face_profile_id} as faiss_id={faiss_id}")
            
            # Persist to Redis
            if persist and self.redis_client:
                self.save_to_redis()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to add vector: {e}")
            return False
    
    def search_similar(
        self,
        embedding: np.ndarray,
        k: int = 10,
        exclude_id: Optional[int] = None
    ) -> List[SearchResult]:
        """
        Search for k most similar face embeddings
        
        Args:
            embedding: Query face embedding vector
            k: Number of results to return
            exclude_id: Exclude this face_profile_id from results (for re-enrollment)
            
        Returns:
            List of SearchResult objects sorted by similarity (descending)
        """
        try:
            if self.index.ntotal == 0:
                logger.info("Index is empty, no results")
                return []
            
            # Normalize query embedding
            embedding = embedding.astype('float32')
            if embedding.shape[0] != self.dimension:
                raise ValueError(f"Embedding dimension mismatch: expected {self.dimension}, got {embedding.shape[0]}")
            
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            # Search in FAISS
            distances, indices = self.index.search(embedding.reshape(1, -1), min(k * 2, self.index.ntotal))
            
            # Convert to SearchResult objects
            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if idx == -1 or idx not in self.id_map:
                    continue
                
                face_profile_id = self.id_map[idx]
                
                # Skip excluded ID
                if exclude_id and face_profile_id == exclude_id:
                    continue
                
                # Convert L2 distance to similarity (0-1 range)
                # For normalized vectors: similarity = 1 - (distance^2 / 4)
                similarity = max(0.0, 1.0 - (dist / 4.0))
                
                # Determine confidence level
                if similarity >= self.HIGH_CONFIDENCE_THRESHOLD:
                    confidence = 'high'
                elif similarity >= self.MEDIUM_CONFIDENCE_THRESHOLD:
                    confidence = 'medium'
                else:
                    confidence = 'low'
                
                results.append(SearchResult(
                    face_profile_id=face_profile_id,
                    similarity=float(similarity),
                    distance=float(dist),
                    confidence_level=confidence
                ))
                
                if len(results) >= k:
                    break
            
            logger.info(f"Found {len(results)} similar faces (k={k})")
            return results
            
        except Exception as e:
            logger.error(f"❌ Search failed: {e}")
            return []
    
    def remove_vector(self, face_profile_id: int, persist: bool = True) -> bool:
        """
        Remove a face embedding from the index
        Note: FAISS doesn't support direct removal, so we rebuild the index
        
        Args:
            face_profile_id: Database face_profile.id to remove
            persist: Whether to persist to Redis immediately
            
        Returns:
            True if removed successfully
        """
        try:
            if face_profile_id not in self.reverse_map:
                logger.warning(f"Face profile {face_profile_id} not in index")
                return False
            
            # Get all vectors except the one to remove
            vectors = []
            new_id_map = {}
            
            for faiss_id, profile_id in self.id_map.items():
                if profile_id != face_profile_id:
                    # Extract vector from index
                    vector = self.index.reconstruct(int(faiss_id))
                    vectors.append(vector)
                    new_id_map[len(vectors) - 1] = profile_id
            
            # Rebuild index
            self.index = faiss.IndexFlatL2(self.dimension)
            if vectors:
                self.index.add(np.array(vectors))
            
            # Update mappings
            self.id_map = new_id_map
            self.reverse_map = {v: k for k, v in new_id_map.items()}
            
            logger.info(f"✅ Removed face_profile_id={face_profile_id}, index size={self.index.ntotal}")
            
            # Persist to Redis
            if persist and self.redis_client:
                self.save_to_redis()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to remove vector: {e}")
            return False
    
    def check_duplicate(
        self,
        embedding: np.ndarray,
        exclude_id: Optional[int] = None
    ) -> Tuple[bool, Optional[SearchResult]]:
        """
        Check if an embedding is a duplicate of an existing one
        
        Args:
            embedding: Face embedding to check
            exclude_id: Exclude this face_profile_id (for re-enrollment)
            
        Returns:
            (is_duplicate, best_match)
            - is_duplicate: True if similarity >= HIGH_CONFIDENCE_THRESHOLD
            - best_match: SearchResult of the best match, or None
        """
        results = self.search_similar(embedding, k=1, exclude_id=exclude_id)
        
        if not results:
            return False, None
        
        best_match = results[0]
        is_duplicate = best_match.similarity >= self.HIGH_CONFIDENCE_THRESHOLD
        
        if is_duplicate:
            logger.warning(
                f"⚠️ Duplicate detected! face_profile_id={best_match.face_profile_id}, "
                f"similarity={best_match.similarity:.4f}"
            )
        
        return is_duplicate, best_match
    
    def save_to_redis(self) -> bool:
        """
        Persist FAISS index and ID mappings to Redis
        
        Returns:
            True if saved successfully
        """
        if not self.redis_client:
            logger.warning("Redis not available, skipping persistence")
            return False
        
        try:
            # Serialize FAISS index
            index_bytes = faiss.serialize_index(self.index)
            
            # Serialize ID mappings
            mappings = {
                'id_map': self.id_map,
                'reverse_map': self.reverse_map,
                'dimension': self.dimension,
                'total': self.index.ntotal,
                'updated_at': datetime.utcnow().isoformat()
            }
            map_bytes = pickle.dumps(mappings)
            
            # Save to Redis
            pipe = self.redis_client.pipeline()
            pipe.set(self.index_key, index_bytes)
            pipe.set(self.map_key, map_bytes)
            pipe.execute()
            
            logger.info(f"✅ Saved index to Redis ({self.index.ntotal} vectors)")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to save to Redis: {e}")
            return False
    
    def load_from_redis(self) -> bool:
        """
        Load FAISS index and ID mappings from Redis
        
        Returns:
            True if loaded successfully
        """
        if not self.redis_client:
            logger.warning("Redis not available, skipping load")
            return False
        
        try:
            # Load index
            index_bytes = self.redis_client.get(self.index_key)
            if not index_bytes:
                logger.info("No existing index in Redis")
                return False
            
            self.index = faiss.deserialize_index(index_bytes)
            
            # Load mappings
            map_bytes = self.redis_client.get(self.map_key)
            if not map_bytes:
                logger.warning("Index exists but mappings missing")
                return False
            
            mappings = pickle.loads(map_bytes)
            self.id_map = mappings['id_map']
            self.reverse_map = mappings['reverse_map']
            
            logger.info(
                f"✅ Loaded index from Redis ({self.index.ntotal} vectors, "
                f"updated_at={mappings.get('updated_at', 'unknown')})"
            )
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load from Redis: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Get index statistics"""
        return {
            'total_vectors': self.index.ntotal,
            'dimension': self.dimension,
            'redis_connected': self.redis_client is not None,
            'high_threshold': self.HIGH_CONFIDENCE_THRESHOLD,
            'medium_threshold': self.MEDIUM_CONFIDENCE_THRESHOLD
        }
    
    def rebuild_from_database(self, face_profiles: List[Tuple[int, np.ndarray]]) -> bool:
        """
        Rebuild index from database records
        
        Args:
            face_profiles: List of (face_profile_id, embedding) tuples
            
        Returns:
            True if rebuilt successfully
        """
        try:
            logger.info(f"Rebuilding index from {len(face_profiles)} face profiles...")
            
            # Reset index
            self.index = faiss.IndexFlatL2(self.dimension)
            self.id_map = {}
            self.reverse_map = {}
            
            # Add all vectors
            success_count = 0
            for face_profile_id, embedding in face_profiles:
                if self.add_vector(face_profile_id, embedding, persist=False):
                    success_count += 1
            
            # Save to Redis
            if self.redis_client:
                self.save_to_redis()
            
            logger.info(f"✅ Index rebuilt: {success_count}/{len(face_profiles)} vectors added")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to rebuild index: {e}")
            return False


# Singleton instance
_vector_index: Optional[FaceVectorIndex] = None


def get_vector_index() -> FaceVectorIndex:
    """Get or create the global vector index instance"""
    global _vector_index
    if _vector_index is None:
        _vector_index = FaceVectorIndex()
    return _vector_index


if __name__ == '__main__':
    """Test the vector index"""
    print("Testing FaceVectorIndex...")
    
    # Create test index
    index = FaceVectorIndex(dimension=512)
    
    # Generate test embeddings
    np.random.seed(42)
    test_embeddings = [
        (1, np.random.randn(512).astype('float32')),
        (2, np.random.randn(512).astype('float32')),
        (3, np.random.randn(512).astype('float32')),
    ]
    
    # Add vectors
    for face_id, emb in test_embeddings:
        index.add_vector(face_id, emb, persist=False)
    
    # Search similar
    query = test_embeddings[0][1] + np.random.randn(512).astype('float32') * 0.1
    results = index.search_similar(query, k=3)
    
    print(f"\nSearch results for query similar to face_id=1:")
    for r in results:
        print(f"  face_id={r.face_profile_id}, similarity={r.similarity:.4f}, confidence={r.confidence_level}")
    
    # Check duplicate
    is_dup, match = index.check_duplicate(test_embeddings[0][1])
    print(f"\nDuplicate check: is_duplicate={is_dup}, match={match}")
    
    # Stats
    print(f"\nIndex stats: {index.get_stats()}")
    
    print("\n✅ Test complete!")
