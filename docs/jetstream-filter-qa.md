# Jetstream Filter QA

Date: 2026-06-03

Endpoint:

```text
wss://jetstream1.us-east.bsky.network/subscribe?wantedCollections=fm.teal.alpha.feed.play
```

Result:

- The websocket opened successfully.
- Three live commit events were observed during the bounded probe.
- All observed events had `commit.collection = "fm.teal.alpha.feed.play"`.
- No unexpected collections were observed.

Observed sample:

```json
[
  {
    "did": "did:plc:q67sl2eyluz4pihms7bqeygm",
    "collection": "fm.teal.alpha.feed.play",
    "rkey": "3mnfykqqzos2h",
    "kind": "commit"
  },
  {
    "did": "did:plc:cinq6tkazox27vopwdqzwebm",
    "collection": "fm.teal.alpha.feed.play",
    "rkey": "3mnfykr7ucc2h",
    "kind": "commit"
  },
  {
    "did": "did:plc:ioyzpvyhecwd5bxg47ynt5cs",
    "collection": "fm.teal.alpha.feed.play",
    "rkey": "3mnfylcsecc2h",
    "kind": "commit"
  }
]
```

