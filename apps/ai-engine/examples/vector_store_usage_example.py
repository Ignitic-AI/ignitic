"""
Example usage of MongoVectorStoreService with DocumentChunk integration

This file demonstrates how to use the updated MongoVectorStoreService
with DocumentChunk objects from document processors.
"""

from services.mongo_vector_store_service import MongoVectorStoreService
from services.document_processors.base_document_processor import (
    DocumentChunk,
    ProcessingResult,
)
from core.auth import AuthProvider


# Example usage with DocumentChunk objects
def example_document_chunk_usage():
    """
    Example showing how to use MongoVectorStoreService with DocumentChunk objects
    """

    # Create sample DocumentChunk objects (as would come from document processors)
    chunks = [
        DocumentChunk(
            content="This is the first chunk of the document content.",
            metadata={
                "asset_type": "pdf",
                "filename": "sample.pdf",
                "content_hash": "abc123",
                "processor_type": "PDFDocumentProcessor",
            },
            chunk_index=0,
            start_char=0,
            end_char=47,
        ),
        DocumentChunk(
            content="This is the second chunk with more content.",
            metadata={
                "asset_type": "pdf",
                "filename": "sample.pdf",
                "content_hash": "abc123",
                "processor_type": "PDFDocumentProcessor",
            },
            chunk_index=1,
            start_char=48,
            end_char=91,
        ),
    ]

    # Create ProcessingResult (as would come from document processors)
    processing_result = ProcessingResult(
        chunks=chunks,
        metadata={
            "total_chunks": len(chunks),
            "processing_time": 1.5,
            "processor_version": "1.0",
        },
        success=True,
    )

    return chunks, processing_result


async def demo_vector_store_operations(auth_provider: AuthProvider):
    """
    Demonstrate vector store operations with DocumentChunk integration
    """

    # Initialize service
    vector_service = MongoVectorStoreService(auth_provider)

    # Get sample data
    chunks, processing_result = example_document_chunk_usage()

    asset_id = "asset_123"
    user_id = "user_456"

    print("🚀 MongoVectorStoreService DocumentChunk Integration Demo")
    print("=" * 60)

    # Method 1: Store ProcessingResult directly
    print("\n📦 Storing ProcessingResult directly...")
    success = await vector_service.store_processing_result(
        asset_id=asset_id, processing_result=processing_result, user_id=user_id
    )
    print(f"✅ Success: {success}")

    # Method 2: Store DocumentChunk objects
    print("\n📄 Storing DocumentChunk objects...")
    success = await vector_service.store_asset_chunks(
        asset_id="asset_124", chunks=chunks, user_id=user_id
    )
    print(f"✅ Success: {success}")

    # Method 3: Backward compatibility with dictionaries
    print("\n🔄 Backward compatibility with dictionaries...")
    chunk_dicts = [
        {
            "content": "Legacy chunk content from dictionary",
            "metadata": {"legacy": True, "asset_type": "txt"},
        }
    ]
    success = await vector_service.store_asset_chunks_from_dicts(
        asset_id="asset_125", chunk_dicts=chunk_dicts, user_id=user_id
    )
    print(f"✅ Success: {success}")

    # Search and get DocumentChunk objects back
    print("\n🔍 Searching and getting DocumentChunk objects...")
    search_results = await vector_service.search_asset_chunks(
        query="document content", user_id=user_id, limit=5
    )

    print(f"📊 Found {len(search_results)} chunks")
    for i, chunk in enumerate(search_results):
        print(f"  Chunk {i + 1}:")
        print(f"    Content: {chunk.content[:50]}...")
        print(f"    Index: {chunk.chunk_index}")
        print(f"    Score: {chunk.metadata.get('search_score', 'N/A')}")
        print(f"    Asset ID: {chunk.metadata.get('asset_id', 'N/A')}")

    # Get asset info
    print("\n📋 Getting asset information...")
    asset_info = await vector_service.get_asset_info(asset_id, user_id)
    if asset_info:
        print(f"  Asset ID: {asset_info['asset_id']}")
        print(f"  Chunk Count: {asset_info['chunk_count']}")
        print(f"  Asset Type: {asset_info['asset_type']}")
        print(f"  Filename: {asset_info['filename']}")

    print("\n✨ Demo completed!")


if __name__ == "__main__":
    print("This is an example file showing MongoVectorStoreService usage.")
    print(
        "To run the demo, import and call demo_vector_store_operations() with a valid AuthProvider."
    )
