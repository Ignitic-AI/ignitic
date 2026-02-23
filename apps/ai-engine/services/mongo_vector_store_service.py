"""
mongo_vector_store_service - Unified vector store operations for assets and long-term memory

Architecture:
  MongoVectorStore  - Singleton that owns the MongoDB client and both MongoDBStore
                      instances (asset_vectors, long_term_memory). Keeps connections
                      open for the lifetime of the process.
  VectorStoreService - Auth-scoped service that delegates low-level store access to
                      MongoVectorStore and adds namespace isolation, metadata enrichment,
                      and business-logic operations.
"""

import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from langgraph.store.mongodb import MongoDBStore, create_vector_index_config
from langchain_openai import OpenAIEmbeddings
from pydantic import SecretStr
from pymongo import MongoClient
from dotenv import load_dotenv

from core.auth import AuthProvider
from services.document_processors.base_document_processor import (
    DocumentChunk,
    AssetProcessingResult,
)
from loguru import logger


load_dotenv()


# ---------------------------------------------------------------------------
# MongoVectorStore – singleton, owns connections
# ---------------------------------------------------------------------------


class MongoVectorStore:
    """
    Singleton that manages MongoDB connections and MongoDBStore instances.

    Both the asset vector store (collection: asset_vectors) and the memory
    vector store (collection: long_term_memory) are initialised lazily on
    first access and reused for the lifetime of the process.
    """

    _instance: Optional["MongoVectorStore"] = None

    def __init__(self) -> None:
        self._mongo_uri = os.getenv("MONGO_URI")
        self._mongo_db_name = os.getenv("MONGO_DB_NAME") or "default_db"

        if not self._mongo_uri or not self._mongo_db_name:
            raise ValueError(
                "MONGO_URI and MONGO_DB_NAME environment variables must be set"
            )

        self._client: Optional[MongoClient] = None
        self._asset_store: Optional[MongoDBStore] = None
        self._memory_store: Optional[MongoDBStore] = None

    # ------------------------------------------------------------------
    # Singleton accessor
    # ------------------------------------------------------------------

    @classmethod
    def get_instance(cls) -> "MongoVectorStore":
        """Return the process-wide MongoVectorStore singleton."""
        if cls._instance is None:
            cls._instance = cls()
            logger.info("🗄️ MongoVectorStore singleton created")
        return cls._instance

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_client(self) -> MongoClient:
        """Return (and cache) the shared MongoClient."""
        if self._client is None:
            self._client = MongoClient(self._mongo_uri)
            logger.info("🔌 MongoDB client connected")
        return self._client

    @staticmethod
    def _get_embeddings() -> OpenAIEmbeddings:
        """Create OpenAI-compatible embeddings client pointed at OpenRouter."""
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable must be set")
        return OpenAIEmbeddings(
            model="openai/text-embedding-ada-002",
            api_key=SecretStr(api_key),
            base_url="https://openrouter.ai/api/v1",
        )

    # ------------------------------------------------------------------
    # Store accessors
    # ------------------------------------------------------------------

    async def get_asset_store(self) -> MongoDBStore:
        """Return the asset vector store, initialising it on first call."""
        if self._asset_store is None:
            embeddings = self._get_embeddings()

            index_config = create_vector_index_config(
                dims=1536,
                embed=embeddings,
                fields=["content"],
                filters=[
                    "asset_id",
                    "user_id",
                    "org_id",
                    "asset_type",
                    "namespace",
                    "tags",
                    "chunk_index",
                ],
            )

            db = self._get_client()[self._mongo_db_name]
            self._asset_store = MongoDBStore(
                collection=db["asset_vectors"],
                index_config=index_config,
            )
            logger.info(
                f"🔗 Asset vector store initialised with {type(embeddings).__name__}"
            )

        return self._asset_store

    async def get_memory_store(self) -> MongoDBStore:
        """Return the memory vector store, initialising it on first call."""
        if self._memory_store is None:
            embeddings = self._get_embeddings()

            index_config = create_vector_index_config(
                dims=1536,
                embed=embeddings,
                fields=["content"],
                filters=["user_id", "session_id", "memory_type", "namespace", "tags"],
            )

            db = self._get_client()[self._mongo_db_name]
            self._memory_store = MongoDBStore(
                collection=db["long_term_memory"],
                index_config=index_config,
            )
            logger.info("🧠 Memory vector store initialised")

        return self._memory_store


# ---------------------------------------------------------------------------
# VectorStoreService – auth-scoped, delegates to MongoVectorStore
# ---------------------------------------------------------------------------


class VectorStoreService:
    """
    Auth-scoped service for vector store operations.

    Delegates connection and store management to the MongoVectorStore singleton
    and adds namespace isolation, metadata enrichment, and business-logic.
    """

    def __init__(self, auth_provider: AuthProvider):
        self._auth = auth_provider
        self._user = auth_provider.get_user()
        self._mongo_store = MongoVectorStore.get_instance()

    async def _get_asset_store(self) -> MongoDBStore:
        return await self._mongo_store.get_asset_store()

    async def _get_memory_store(self) -> MongoDBStore:
        return await self._mongo_store.get_memory_store()

    # Asset Vector Operations

    async def store_asset_processing_result(
        self,
        asset_id: str,
        processing_result: AssetProcessingResult,
    ) -> bool:
        """
        Store the results of document processing directly.

        Args:
            asset_id: Backend asset identifier
            processing_result: ProcessingResult from document processor
            user_id: Asset owner ID (optional, will use auth context)
            org_id: Organization ID (optional)

        Returns:
            True if successful, False otherwise
        """
        if not processing_result.success:
            logger.error(
                f"❌ Cannot store failed processing result for asset {asset_id}: {processing_result.error_message}"
            )
            return False

        return await self.store_asset_chunks(asset_id, processing_result.chunks)

    async def store_asset_chunks(
        self,
        asset_id: str,
        chunks: List[DocumentChunk],
    ) -> bool:
        """
        Store asset document chunks in vector store with metadata.

        Args:
            asset_id: Backend asset identifier
            chunks: List of DocumentChunk objects from document processors
            user_id: Asset owner ID (optional, will use auth context)
            org_id: Organization ID (optional)

        Returns:
            True if successful, False otherwise
        """
        try:
            store = await self._get_asset_store()

            namespace = self._get_namespace()

            # Prepare documents for batch storage
            documents = []
            for chunk in chunks:
                # Enrich metadata with standard fields while preserving existing metadata
                enriched_metadata = chunk.metadata.copy()
                enriched_metadata.update(
                    {
                        "asset_id": asset_id,
                        "user_id": self._user.id,
                        "org_id": self._user.org_id,
                        "chunk_index": chunk.chunk_index,
                        "total_chunks": len(chunks),
                        "processed_at": datetime.utcnow().isoformat(),
                        "namespace": namespace[1],  # Extract namespace value
                        "start_char": chunk.start_char,
                        "end_char": chunk.end_char,
                        "created_at": chunk.created_at.isoformat(),
                    }
                )

                # Create document structure
                document = {"content": chunk.content, "metadata": enriched_metadata}

                # Generate unique key for this chunk
                chunk_key = f"{asset_id}_chunk_{chunk.chunk_index}"
                documents.append((chunk_key, document))

            # Batch store all chunks
            await self._batch_store_documents(store, namespace, documents)

            logger.info(f"📄 Stored {len(chunks)} chunks for asset {asset_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to store asset chunks for {asset_id}: {str(e)}")
            return False

    async def update_asset_chunks(
        self,
        asset_id: str,
        chunks: List[DocumentChunk],
    ) -> bool:
        """
        Update asset chunks by deleting old ones and storing new ones.

        Args:
            asset_id: Asset identifier
            chunks: New DocumentChunk objects
            user_id: Asset owner ID
            org_id: Organization ID

        Returns:
            True if successful
        """
        try:
            # Delete existing chunks first
            deleted = await self.delete_asset_chunks(asset_id)
            if not deleted:
                logger.warning(
                    f"⚠️ Failed to delete existing chunks for asset {asset_id}"
                )

            # Store new chunks
            return await self.store_asset_chunks(asset_id, chunks)

        except Exception as e:
            logger.error(f"❌ Failed to update asset chunks for {asset_id}: {str(e)}")
            return False

    async def delete_asset_chunks(
        self, asset_id: str, user_id: Optional[str] = None, org_id: Optional[str] = None
    ) -> bool:
        """
        Delete all chunks for a specific asset.

        Args:
            asset_id: Asset identifier
            user_id: Asset owner ID
            org_id: Organization ID

        Returns:
            True if successful
        """
        try:
            store = await self._get_asset_store()
            current_user = user_id or self._auth.get_user().id
            namespace = self._get_namespace()

            # Find all chunks for this asset
            chunks = store.search(
                namespace,
                query="",  # Empty query for metadata-only search
                filter={"asset_id": asset_id},
                limit=1000,  # Assume max 1000 chunks per asset
            )

            # Delete each chunk
            deleted_count = 0
            for chunk in chunks:
                await store.adelete(namespace, chunk.key)
                deleted_count += 1

            logger.info(f"🗑️ Deleted {deleted_count} chunks for asset {asset_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to delete asset chunks for {asset_id}: {str(e)}")
            return False

    async def search_asset_chunks(
        self,
        query: str,
        asset_type: Optional[str] = None,
        asset_ids: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[DocumentChunk]:
        """
        Semantic search across asset chunks.

        Args:
            query: Search query text
            user_id: User ID for namespace
            org_id: Organization ID for namespace
            asset_type: Filter by asset type (pdf, docx, etc.)
            asset_ids: Filter by specific asset IDs
            limit: Maximum results to return

        Returns:
            List of DocumentChunk objects with search metadata
        """
        try:
            store = await self._get_asset_store()

            namespace = self._get_namespace()

            # Build filter criteria
            filters = {}
            if asset_type:
                filters["asset_type"] = asset_type
            if asset_ids:
                filters["asset_id"] = {"$in": asset_ids}

            # Perform semantic search
            results = store.search(
                namespace, query=query, filter=filters if filters else None, limit=limit
            )

            # Format results as DocumentChunk objects
            formatted_results = []
            for result in results:
                metadata = result.value.get("metadata", {})
                # Add search metadata
                search_metadata = metadata.copy()
                search_metadata.update(
                    {
                        "search_score": getattr(result, "score", 0.0),
                        "storage_key": result.key,
                    }
                )

                chunk = DocumentChunk(
                    content=result.value.get("content", ""),
                    metadata=search_metadata,
                    chunk_index=metadata.get("chunk_index", 0),
                    start_char=metadata.get("start_char"),
                    end_char=metadata.get("end_char"),
                )
                formatted_results.append(chunk)

            logger.info(
                f"🔍 Found {len(formatted_results)} chunks for query: {query[:50]}..."
            )
            return formatted_results

        except Exception as e:
            logger.error(f"❌ Failed to search asset chunks: {str(e)}")
            return []

    # Long-term Memory Operations

    async def store_memory(
        self,
        content: str,
        memory_type: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Store long-term memory content.

        Args:
            content: Memory content to store
            memory_type: Type of memory (conversation, facts, preferences, etc.)
            session_id: Associated session ID
            metadata: Additional metadata
            user_id: User ID

        Returns:
            Memory key/ID
        """
        try:
            store = await self._get_memory_store()
            current_user = self._auth.get_user().id

            # Prepare memory metadata
            memory_metadata = metadata or {}
            memory_metadata.update(
                {
                    "user_id": current_user,
                    "memory_type": memory_type,
                    "session_id": session_id,
                    "stored_at": datetime.utcnow().isoformat(),
                    "namespace": current_user,
                }
            )

            # Create memory document
            document = {"content": content, "metadata": memory_metadata}

            # Generate memory key
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            memory_key = f"{memory_type}_{timestamp}_{current_user}"

            # Store memory
            await store.aput(self._get_namespace(), memory_key, document)

            logger.info(f"🧠 Stored memory: {memory_type} for user {current_user}")
            return memory_key

        except Exception as e:
            logger.error(f"❌ Failed to store memory: {str(e)}")
            raise

    async def search_memories(
        self,
        query: str,
        memory_type: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Search long-term memories.

        Args:
            query: Search query
            memory_type: Filter by memory type
            session_id: Filter by session
            user_id: User ID
            limit: Maximum results

        Returns:
            List of matching memories
        """
        try:
            store = await self._get_memory_store()
            current_user = user_id or self._auth.get_user().id

            # Build filters
            filters = {}
            if memory_type:
                filters["memory_type"] = memory_type
            if session_id:
                filters["session_id"] = session_id

            # Search memories
            results = store.search(
                ("user", current_user),
                query=query,
                filter=filters if filters else None,
                limit=limit,
            )

            # Format results
            formatted_results = []
            for result in results:
                formatted_results.append(
                    {
                        "content": result.value.get("content", ""),
                        "metadata": result.value.get("metadata", {}),
                        "score": getattr(result, "score", 0.0),
                        "key": result.key,
                    }
                )

            logger.info(
                f"🧠 Found {len(formatted_results)} memories for query: {query[:50]}..."
            )
            return formatted_results

        except Exception as e:
            logger.error(f"❌ Failed to search memories: {str(e)}")
            return []

    # Utility Methods

    @staticmethod
    def create_document_chunk_from_dict(
        chunk_dict: Dict[str, Any], chunk_index: int = 0
    ) -> DocumentChunk:
        """
        Create a DocumentChunk from dictionary format for backward compatibility.

        Args:
            chunk_dict: Dictionary with 'content' and 'metadata' keys
            chunk_index: Index of the chunk

        Returns:
            DocumentChunk object
        """
        return DocumentChunk(
            content=chunk_dict.get("content", ""),
            metadata=chunk_dict.get("metadata", {}),
            chunk_index=chunk_index,
            start_char=chunk_dict.get("start_char"),
            end_char=chunk_dict.get("end_char"),
        )

    async def store_asset_chunks_from_dicts(
        self,
        asset_id: str,
        chunk_dicts: List[Dict[str, Any]],
    ) -> bool:
        """
        Store asset chunks from dictionary format (backward compatibility).

        Args:
            asset_id: Backend asset identifier
            chunk_dicts: List of chunk dictionaries
            user_id: Asset owner ID (optional, will use auth context)
            org_id: Organization ID (optional)

        Returns:
            True if successful, False otherwise
        """
        # Convert dictionaries to DocumentChunk objects
        chunks = [
            self.create_document_chunk_from_dict(chunk_dict, i)
            for i, chunk_dict in enumerate(chunk_dicts)
        ]

        return await self.store_asset_chunks(asset_id, chunks)

    def _get_namespace(
        self,
    ) -> Tuple:
        """
        Determine appropriate namespace for asset storage.

        Args:
            user_id: User identifier
            org_id: Organization identifier

        Returns:
            Tuple of (namespace_type, namespace_id)
        """
        user_id = self._auth.get_user().id
        org_id = self._auth.get_user().org_id
        if org_id:
            return ("org", org_id)
        else:
            return ("user", user_id)

    async def _batch_store_documents(
        self,
        store: MongoDBStore,
        namespace: Tuple[str, str],
        documents: List[Tuple[str, Dict[str, Any]]],
    ) -> None:
        """
        Store multiple documents in batch for better performance.

        Args:
            store: MongoDBStore instance
            namespace: Storage namespace
            documents: List of (key, document) tuples
        """
        # For now, store individually (can be optimized with batch operations if available)
        for key, document in documents:
            await store.aput(namespace, key, document)

    async def get_asset_info(
        self, asset_id: str, user_id: Optional[str] = None, org_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get basic information about an asset's chunks.

        Args:
            asset_id: Asset identifier
            user_id: User ID
            org_id: Organization ID

        Returns:
            Asset info dictionary or None
        """
        try:
            store = await self._get_asset_store()
            current_user = user_id or self._auth.get_user().id
            namespace = self._get_namespace()

            # Get first chunk to extract metadata
            chunks = store.search(
                namespace, query="", filter={"asset_id": asset_id}, limit=1
            )

            if not chunks:
                return None

            metadata = chunks[0].value.get("metadata", {})

            # Get total chunk count
            all_chunks = store.search(
                namespace, query="", filter={"asset_id": asset_id}, limit=1000
            )

            return {
                "asset_id": asset_id,
                "chunk_count": len(all_chunks),
                "asset_type": metadata.get("asset_type"),
                "filename": metadata.get("filename"),
                "processed_at": metadata.get("processed_at"),
                "user_id": metadata.get("user_id"),
                "org_id": metadata.get("org_id"),
            }

        except Exception as e:
            logger.error(f"❌ Failed to get asset info for {asset_id}: {str(e)}")
            return None


# Global service factory (kept for backward compatibility)


def get_vector_store_service(auth_provider: AuthProvider) -> VectorStoreService:
    """
    Create a VectorStoreService scoped to the given auth context.

    The underlying MongoVectorStore singleton is reused across calls, so
    MongoDB connections are never duplicated.
    """
    return VectorStoreService(auth_provider)
