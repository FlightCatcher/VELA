# VELA Offline Knowledge Corpus

VELA combines two complementary knowledge paths:

1. Personal documents under `E:\OpenClaw-Knowledge\library`, indexed in SQLite.
2. Large read-only ZIM archives, searched on disk by a local Kiwix service.

The second path avoids expanding or embedding roughly 30 GiB of encyclopedia data. It keeps
memory usage low and returns citations to the original offline article.

## Corpus

- Chinese Wikipedia `maxi` (full articles and images), May 2026.
- Simple English Wikipedia `maxi` (broad, readable supplementary coverage), June 2026.

Together they occupy about 29.4 GiB. Checksums are downloaded from the official Kiwix archive
server and verified after transfer.

## Storage

All corpus content and Kiwix binaries live below:

```text
E:\OpenClaw-Knowledge
├── library\zim
├── logs
├── manifests\checksums
└── tools
```

No ZIM archive is copied to the repository, `.openclaw`, or the system drive.

## Operations

```powershell
.\scripts\manage_knowledge_corpus.ps1 Status
.\scripts\manage_knowledge_corpus.ps1 Complete
.\scripts\manage_knowledge_corpus.ps1 Verify
```

Windows BITS keeps downloads resumable across VELA restarts and network interruptions. Windows
may temporarily pause transfers while Game Mode is active; it resumes them automatically later.

The scheduled task `VELA Offline Knowledge` starts the local-only service at logon. It binds to
`127.0.0.1:18080`, so the archive is not exposed to the LAN or Internet.

## VELA behavior

`knowledge_search` searches the personal vector store and the offline encyclopedia in parallel.
The personal store has a short timeout so a sleeping embedding model cannot block already
available encyclopedia results. If Kiwix is unavailable, personal document search continues.

The knowledge corpus is a retrieval source, not model training. VELA receives only the small set
of relevant passages for each question, which is safer and practical on a 16 GiB machine.
