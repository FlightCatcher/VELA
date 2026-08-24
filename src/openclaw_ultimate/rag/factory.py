from __future__ import annotations

from openclaw_ultimate.config import Settings
from openclaw_ultimate.models import (
    OpenAICompatibleEmbeddingModel,
)
from openclaw_ultimate.rag.chunking import MarkdownChunker
from openclaw_ultimate.rag.kiwix import KiwixKnowledgeClient
from openclaw_ultimate.rag.service import KnowledgeBase
from openclaw_ultimate.rag.store import SQLiteKnowledgeStore


def build_knowledge_base(
    settings: Settings,
) -> KnowledgeBase:
    external_sources = (
        (
            KiwixKnowledgeClient(
                base_url=settings.knowledge_kiwix_base_url,
                timeout=settings.knowledge_kiwix_timeout,
                result_limit=settings.knowledge_kiwix_result_limit,
            ),
        )
        if settings.knowledge_kiwix_enabled
        else ()
    )
    return KnowledgeBase(
        root=settings.knowledge_root,
        store=SQLiteKnowledgeStore(settings.knowledge_db_path),
        embedding_model=OpenAICompatibleEmbeddingModel(
            model=settings.embedding_model,
            base_url=settings.openai_base_url,
            api_key=settings.ollama_api_key,
            timeout=settings.model_timeout,
        ),
        chunker=MarkdownChunker(
            max_characters=(settings.knowledge_chunk_characters),
            overlap_characters=(settings.knowledge_chunk_overlap),
        ),
        max_file_bytes=settings.knowledge_max_file_bytes,
        embedding_batch_size=(settings.knowledge_embedding_batch_size),
        external_sources=external_sources,
        local_search_timeout=settings.knowledge_local_search_timeout,
    )
