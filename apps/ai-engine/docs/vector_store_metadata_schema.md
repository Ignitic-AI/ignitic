# Vector Store Metadata Schema

## Overview

This document defines the metadata structure for asset document chunks stored in the MongoDB vector store. This approach eliminates the need for separate asset models in MongoDB by storing all necessary asset information as metadata with each vector chunk.

## Metadata Structure

### Core Asset Information

```python
{
    # Asset Identity
    "asset_id": "asset_123",           # Backend asset ID (primary key)
    "user_id": "user_456",             # Asset owner ID
    "org_id": "org_789",               # Organization ID (optional)
    
    # Asset Properties
    "asset_type": "pdf",               # File type: pdf, docx, txt, etc.
    "filename": "document.pdf",        # Original filename
    "content_hash": "sha256_hash",     # Content hash for change detection
    "file_size": 1024576,              # File size in bytes
    
    # Chunk Information
    "chunk_index": 1,                  # Chunk number (0-based)
    "total_chunks": 5,                 # Total chunks for this asset
    "chunk_size": 1000,                # Characters in this chunk
    "chunk_overlap": 200,              # Overlap with adjacent chunks
    
    # Processing Information
    "processed_at": "2025-10-09T12:00:00Z",     # Processing timestamp
    "processor_type": "PDFDocumentProcessor",   # Processor used
    "processing_version": "1.0",               # Schema version
    
    # Search and Filtering
    "namespace": "user_456",           # For user isolation
    "tags": ["document", "report"],    # Optional categorization
    "language": "en"                   # Detected language
}
```

## Index Configuration

### Vector Index Setup

```python
from langgraph.store.mongodb import create_vector_index_config
from langchain_openai import OpenAIEmbeddings  # Using OpenRouter

index_config = create_vector_index_config(
    dims=1536,  # OpenAI text-embedding-ada-002 dimensions
    embed=OpenAIEmbeddings(
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=OPENROUTER_API_KEY,
        model="text-embedding-ada-002"
    ),
    fields=["content"],  # Embed the main text content
    filters=[
        "asset_id",
        "user_id", 
        "org_id",
        "asset_type",
        "namespace",
        "tags"
    ]
)
```

### Document Structure in Vector Store

```python
{
    "content": "This is the extracted text from chunk 1...",  # Text to embed
    "metadata": {
        # All metadata fields from above structure
        "asset_id": "asset_123",
        "user_id": "user_456",
        # ... rest of metadata
    }
}
```

## Query Patterns

### 1. Find All Chunks for an Asset

```python
results = await store.search(
    namespace=("user", user_id),
    query="",  # Empty for metadata-only search
    filter={"asset_id": asset_id},
    limit=100
)
```

### 2. Delete All Chunks for an Asset

```python
# Get all chunks first
chunks = await store.search(
    namespace=("user", user_id),
    query="",
    filter={"asset_id": asset_id},
    limit=1000
)

# Delete each chunk
for chunk in chunks:
    await store.adelete(
        namespace=("user", user_id),
        key=chunk.key
    )
```

### 3. Semantic Search within User's Assets

```python
results = await store.search(
    namespace=("user", user_id),
    query="search query here",
    filter={"asset_type": "pdf"},  # Optional filtering
    limit=10
)
```

### 4. Organization-wide Search

```python
results = await store.search(
    namespace=("org", org_id),
    query="search query here",
    filter={"asset_type": ["pdf", "docx"]},
    limit=20
)
```

## Namespace Strategy

### User Namespace
- **Format**: `("user", user_id)`
- **Usage**: Personal assets belonging to individual users
- **Isolation**: Complete separation between users

### Organization Namespace  
- **Format**: `("org", org_id)`
- **Usage**: Shared assets within organization
- **Access**: All org members can access

### Hybrid Assets
For assets that belong to both user and org:
```python
# Store in both namespaces with same metadata
await store.aput(("user", user_id), chunk_key, document)
await store.aput(("org", org_id), chunk_key, document)
```

## Operations Support

### Asset Lifecycle Management

1. **Create Asset**: Store all chunks with metadata
2. **Update Asset**: Delete old chunks, store new chunks
3. **Delete Asset**: Remove all chunks by asset_id
4. **Query Status**: Check chunk count and processing status

### Change Detection

Use `content_hash` to detect if asset content changed:
```python
existing_chunks = await store.search(
    namespace=("user", user_id),
    filter={"asset_id": asset_id},
    limit=1
)

if existing_chunks and existing_chunks[0].metadata["content_hash"] != new_hash:
    # Content changed, need to reprocess
    pass
```

## Performance Considerations

### Indexing Strategy
- **Primary Filters**: `asset_id`, `user_id`, `org_id` (most common queries)
- **Secondary Filters**: `asset_type`, `tags` (categorical filtering)
- **Compound Indexes**: Consider MongoDB compound indexes for common query patterns

### Batch Operations
- Process multiple chunks in batches for better performance
- Use `abatch` operations when available

### Memory Efficiency
- Store only essential metadata to minimize document size
- Use efficient data types (strings for IDs, integers for counts)

## Error Handling

### Missing Assets
When asset is deleted from backend but chunks remain:
```python
# Cleanup orphaned chunks periodically
async def cleanup_orphaned_chunks(user_id: str):
    # Get list of valid asset_ids from backend
    valid_assets = await asset_service.get_user_assets(user_id)
    valid_asset_ids = {asset.id for asset in valid_assets}
    
    # Find chunks with invalid asset_ids
    # Delete orphaned chunks
```

### Partial Processing
Handle cases where chunk processing fails:
```python
metadata["processing_status"] = "failed"
metadata["error_message"] = "PDF parsing failed"
metadata["retry_count"] = 1
```

This metadata schema provides complete asset management capabilities without requiring separate MongoDB models, while maintaining efficiency and supporting all necessary operations.